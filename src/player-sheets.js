import {clean,defaults} from './storage.js';
import {createCharacterManagement} from './character-management.js';
export const SHEET_CHANNEL='io.github.kuzyaka111.legend-mist/player-sheets/v1';
const LIMIT=2_000_000, CHUNK=6000;
const encode=bytes=>btoa(Array.from(new Uint8Array(bytes),b=>String.fromCharCode(b)).join(''));
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const keyPair=()=>crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);
async function secret(privateKey,publicKey){return crypto.subtle.deriveKey({name:'ECDH',public:await crypto.subtle.importKey('jwk',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[])},privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function peer(obr,connectionId){
 if(connectionId===await obr.player.getConnectionId())return {id:obr.player.id,connectionId,role:await obr.player.getRole(),name:await obr.player.getName()};
 return (await obr.party.getPlayers()).find(p=>p.connectionId===connectionId);
}
// Broadcast is visible to every participant. Sheet contents are encrypted to the
// requesting GM, and the role comes from Owlbear's connection, never the payload.
export function createSheetPublisher(obr,store,{report=console.error,beforeCommand=async()=>{}}={}){
 let alive=true,timer,off=()=>{},offStore=()=>{};const subscriptions=new Map(),queues=new Map(),commands=new Map(),pairPromise=keyPair();
 async function send(subscription,result){
  if(!alive)return;const requester=await peer(obr,subscription.connectionId);
  if(!alive||requester?.role!=='GM'||Date.now()-subscription.time>180000){subscriptions.delete(subscription.connectionId);return;}
  const body=new TextEncoder().encode(JSON.stringify({state:store.exists()?clean(store.load(),'sheet'):null,characters:store.exists()?store.listCharacters?.():[],result}));
  if(body.length>LIMIT)throw Error('Лист слишком большой для отправки ведущему.');
  const pair=await pairPromise,key=await secret(pair.privateKey,subscription.publicKey),iv=crypto.getRandomValues(new Uint8Array(12));
  const payload=encode(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,body)),publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey),transfer=crypto.randomUUID(),total=Math.ceil(payload.length/CHUNK);
  // Recheck after encryption so a demoted/disconnected GM receives no new data.
  if(!alive||(await peer(obr,subscription.connectionId))?.role!=='GM')return;
  for(let index=0;index<total&&alive;index++)await obr.broadcast.sendMessage(SHEET_CHANNEL,{type:'sheet',request:subscription.request,player:obr.player.id,transfer,index,total,iv:encode(iv),publicKey,chunk:payload.slice(index*CHUNK,(index+1)*CHUNK)},{destination:'ALL'});
 }
 function queueSend(s){const task=(queues.get(s.connectionId)||Promise.resolve()).then(()=>{if(subscriptions.get(s.connectionId)===s)return send(s);});queues.set(s.connectionId,task.catch(()=>{}));return task;}
 async function receiveCommand(event){
  const d=event.data,sub=subscriptions.get(event.connectionId);if(!alive||d.player!==obr.player.id||!sub||sub.request!==d.request||(await peer(obr,event.connectionId))?.role!=='GM')return;
  if(typeof d.transfer!=='string'||d.transfer.length>80||!Number.isInteger(d.total)||d.total<1||d.total>500||!Number.isInteger(d.index)||d.index<0||d.index>=d.total||typeof d.chunk!=='string'||d.chunk.length>CHUNK)return;
  const id=event.connectionId+':'+d.transfer;let t=commands.get(id);if(!t){if(commands.size>8)return;t={parts:Array(d.total),iv:d.iv};commands.set(id,t);}if(t.parts.length!==d.total)return;t.parts[d.index]=d.chunk;if(t.parts.filter(v=>v!==undefined).length!==d.total)return;commands.delete(id);
  const pair=await pairPromise,key=await secret(pair.privateKey,sub.publicKey),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(t.iv)},key,decode(t.parts.join('')));if(plain.byteLength>LIMIT)return;const body=JSON.parse(new TextDecoder().decode(plain));if(typeof body.operation!=='string'||body.operation.length>100)return;
  const run=async()=>{let result;try{if(!alive||(await peer(obr,event.connectionId))?.role!=='GM')return;await beforeCommand(body.command);if(!alive||(await peer(obr,event.connectionId))?.role!=='GM')return;result={operation:body.operation,ok:true,value:store.applyCharacterCommand(body.operation,body.command)};}catch(e){result={operation:body.operation,ok:false,error:e.message};}await send(sub,result);};
  const work=(queues.get(event.connectionId)||Promise.resolve()).then(run);queues.set(event.connectionId,work.catch(()=>{}));await work;
 }
 const receive=async event=>{const d=event.data;if(d?.type==='command')return receiveCommand(event);if(!alive||d?.type!=='request'||d.player!==obr.player.id||typeof d.request!=='string'||d.request.length>80||!d.publicKey)return;
  const requester=await peer(obr,event.connectionId);if(!alive||requester?.role!=='GM')return;
  const subscription={request:d.request,connectionId:event.connectionId,publicKey:d.publicKey,time:Date.now()};subscriptions.set(event.connectionId,subscription);await queueSend(subscription);
 };
 return {start(){off=obr.broadcast.onMessage(SHEET_CHANNEL,e=>void receive(e).catch(report));offStore=store.subscribe(()=>{clearTimeout(timer);timer=setTimeout(()=>{for(const s of subscriptions.values())void queueSend(s).catch(report);},250);});},dispose(){alive=false;clearTimeout(timer);off();offStore();subscriptions.clear();queues.clear();}};
}
export function createSheetDirectory(obr,storage,{report=console.error,onTaken=async()=>{}}={}){
 const cacheKey='legend-mist-gm-sheets:v1:'+JSON.stringify([obr.room.id,obr.player.id]);
 let alive=true,pair,players=[],off=()=>{},offParty=()=>{},offRole=()=>{},interval,generation=0;const listeners=new Set(),requests=new Map(),transfers=new Map(),entries=new Map(),publicKeys=new Map(),pending=new Map();
 const emit=()=>{if(alive)for(const fn of listeners)fn();};
 const guard=async()=>{if(!alive||await obr.player.getRole()!=='GM')throw Error('Просмотр листов доступен только ведущему.');};
 async function refresh(){await guard();if(pending.size)return;const epoch=generation,list=await obr.party.getPlayers();await guard();if(epoch!==generation)return;
  players=[...list];if(!players.some(p=>p.id===obr.player.id))players.push({id:obr.player.id,name:await obr.player.getName(),role:'GM',connectionId:await obr.player.getConnectionId()});
  requests.clear();transfers.clear();emit();
  for(const p of players){if(!alive||epoch!==generation)return;const request=crypto.randomUUID();requests.set(request,{player:p.id,connectionId:p.connectionId,sequence:0});await obr.broadcast.sendMessage(SHEET_CHANNEL,{type:'request',player:p.id,request,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)},{destination:'ALL'});}
 }
 function saveCache(){try{storage.setItem(cacheKey,JSON.stringify([...entries]));}catch{report(Error('Не удалось сохранить копии листов для просмотра без подключения.'));}}
 async function receive(event){const d=event.data,request=requests.get(d?.request);if(!alive||d?.type!=='sheet'||!request||d.player!==request.player||event.connectionId!==request.connectionId)return;
  if(!players.some(p=>p.id===d.player&&p.connectionId===event.connectionId))return;
  if(typeof d.transfer!=='string'||d.transfer.length>80||!Number.isInteger(d.total)||d.total<1||d.total>500||!Number.isInteger(d.index)||d.index<0||d.index>=d.total||typeof d.chunk!=='string'||d.chunk.length>CHUNK)return;
  const id=d.request+':'+d.transfer;let t=transfers.get(id);if(!t){if(transfers.size>=players.length*2+4)return;t={parts:Array(d.total),iv:d.iv,publicKey:d.publicKey,sequence:++request.sequence};transfers.set(id,t);}
  if(t.parts.length!==d.total)return;t.parts[d.index]=d.chunk;if(t.parts.filter(v=>v!==undefined).length!==d.total)return;transfers.delete(id);
  const epoch=generation,key=await secret(pair.privateKey,t.publicKey),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(t.iv)},key,decode(t.parts.join('')));if(plain.byteLength>LIMIT)throw Error('Получен слишком большой лист.');
  const body=JSON.parse(new TextDecoder().decode(plain));if(!alive||epoch!==generation||await obr.player.getRole()!=='GM')return;const sender=await peer(obr,event.connectionId);if(epoch!==generation||requests.get(d.request)!==request||sender?.id!==d.player)return;
  publicKeys.set(d.player,{connectionId:event.connectionId,key:t.publicKey});if(t.sequence===request.sequence){const name=sender.name||'Игрок';entries.set(d.player,{name,state:body.state?clean(body.state,'sheet'):null,characters:Array.isArray(body.characters)?body.characters.map(c=>({id:c.id,state:clean(c.state,'sheet')})):[],receivedAt:Date.now()});saveCache();emit();}
  if(body.result){const p=pending.get(body.result.operation);if(p?.player===d.player){pending.delete(body.result.operation);clearTimeout(p.timer);body.result.ok?p.resolve(body.result.value):p.reject(Error(body.result.error||'Не удалось передать персонажа.'));}}

 }
 async function command(player,operation,command){
  await guard();const request=[...requests].find(([,r])=>r.player===player),remote=publicKeys.get(player);if(!request||!remote||remote.connectionId!==request[1].connectionId)throw Error('Игрок должен быть в комнате с обновлённым расширением. Дождитесь загрузки его листов.');
  const key=await secret(pair.privateKey,remote.key),iv=crypto.getRandomValues(new Uint8Array(12)),bytes=new TextEncoder().encode(JSON.stringify({operation,command}));if(bytes.length>LIMIT)throw Error('Персонаж слишком большой для передачи.');const payload=encode(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes)),transfer=crypto.randomUUID(),total=Math.ceil(payload.length/CHUNK);
  await guard();const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(operation);reject(Error('Подтверждение не получено. Персонаж сохранён у ведущего; повторите действие после подключения игрока.'));},10000);pending.set(operation,{player,resolve,reject,timer});});response.catch(()=>{});
  try{for(let index=0;index<total;index++)await obr.broadcast.sendMessage(SHEET_CHANNEL,{type:'command',request:request[0],player,transfer,index,total,iv:encode(iv),chunk:payload.slice(index*CHUNK,(index+1)*CHUNK)},{destination:'ALL'});}catch(e){const p=pending.get(operation);clearTimeout(p?.timer);pending.delete(operation);p?.reject(e);}
  return response;
 }
 const management=createCharacterManagement({storage,key:cacheKey+':vault',guard,command,entries,emit,onTaken,defaults});
 return {management,
  async start(){await guard();pair=await keyPair();try{for(const [id,e]of JSON.parse(storage.getItem(cacheKey)||'[]'))if(typeof id==='string'&&e&&typeof e.name==='string')entries.set(id,{name:e.name,state:e.state?clean(e.state,'sheet'):null,characters:Array.isArray(e.characters)?e.characters.map(c=>({id:c.id,state:clean(c.state,'sheet')})):[],receivedAt:Number(e.receivedAt)||0});}catch{}
   off=obr.broadcast.onMessage(SHEET_CHANNEL,e=>void receive(e).catch(report));offParty=obr.party.onChange(()=>void refresh().catch(report));offRole=obr.player.onChange(p=>{if(p.role!=='GM'){++generation;requests.clear();transfers.clear();entries.clear();players=[];publicKeys.clear();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Доступ ведущего закрыт.'));}pending.clear();clearInterval(interval);emit();}});await refresh();interval=setInterval(()=>void refresh().catch(report),60000);
  },refresh,
  list(){return [...new Set([...players.map(p=>p.id),...entries.keys()])].map(id=>({id,...entries.get(id),name:players.find(p=>p.id===id)?.name||entries.get(id)?.name||'Игрок',online:players.some(p=>p.id===id)}));},
  subscribe(fn){listeners.add(fn);fn();return()=>listeners.delete(fn);},
  dispose(){alive=false;++generation;clearInterval(interval);off();offParty();offRole();requests.clear();transfers.clear();entries.clear();publicKeys.clear();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Панель закрыта. Персонаж сохранён для продолжения передачи.'));}pending.clear();listeners.clear();},
 };
}
