import {openGM,openSheet} from './bridge.js';
import {requests,subscriptionFor,sharedSDKSubscriptions} from './detached-sdk.js';
import {allowedDetachedKey,storageSnapshot} from './detached-storage.js';
export const DETACHED_OPEN='__legendMistOpenDetached';
export function createDetachedHost(obr,win,{storage=win.localStorage,bus=obr.room.messageBus,base=win.location.href}={}){
 const restore=sharedSDKSubscriptions(bus),sessions=new Map(),origin=win.location.origin;let alive=true,role=null,access=0;
 const scope=view=>({room:obr.room.id,player:obr.player.id,view});
 const send=(session,data)=>{try{session.port?.postMessage(data);}catch{}};
 const permitted=session=>alive&&(session.view==='sheet'||role==='GM');
 function dropPort(session){++session.connection;for(const id of session.interactions)bus.send('OBR_INTERACTION_STOP_ITEM_INTERACTION',{id});session.interactions.clear();for(const sub of session.subs.values()){bus.off(sub.event,sub.handler);bus.send(sub.unsubscribe,sub.data);}session.subs.clear();session.port?.close();session.port=null;}
 function disposeSession(session,reason){if(!sessions.has(session.token))return;send(session,{type:'disconnected',message:reason});dropPort(session);sessions.delete(session.token);}
 function publishStorage(event){for(const session of sessions.values())if(session.port&&permitted(session)){if(event?.key){if(allowedDetachedKey(event.key,scope(session.view)))send(session,{type:'storage-change',key:event.key,value:storage.getItem(event.key)});}else send(session,{type:'storage-snapshot',values:storageSnapshot(storage,scope(session.view))});}}
 async function receive(session,packet){
  if(!permitted(session))return;const revision=access,connection=session.connection;
  const current=()=>permitted(session)&&revision===access&&connection===session.connection&&sessions.has(session.token);
  const respond=(data,error)=>{if(current())send(session,{type:'response',request:packet.request,data,error});};
  try{
   if(packet.type==='ping'){send(session,{type:'pong'});return;}
   if(packet.type==='bye'){dropPort(session);return;}
   if(packet.type==='command'){
    if(packet.command==='storage'){
     const {key,value}=packet.data;if(!allowedDetachedKey(key,scope(session.view))||value!==null&&typeof value!=='string')throw Error('Нет доступа к этой записи.');
     if(storage.getItem(key)===value){respond(true);return;}
     if(value===null)storage.removeItem(key);else storage.setItem(key,value);
     const event=new win.CustomEvent('legend-mist-store');Object.defineProperty(event,'key',{value:key});win.dispatchEvent(event);respond(true);return;
    }
    if(packet.command==='return'){const ok=session.view==='gm'?await openGM(obr,base):await openSheet(obr,base);respond(ok!==false);return;}
    throw Error('Неизвестное действие.');
   }
   if(packet.type!=='sdk'||!packet.message||typeof packet.message.id!=='string')throw Error('Неверный запрос.');
   const {id,data,nonce}=packet.message,sub=subscriptionFor(id,data);
   if(sub){
    if(sub.adding&&!session.subs.has(sub.key)){const handler=data=>{if(permitted(session))send(session,{type:'sdk',message:{id:sub.event,data}});};bus.on(sub.event,handler);bus.send(id,sub.data);session.subs.set(sub.key,{...sub,handler});}
    else if(!sub.adding&&session.subs.has(sub.key)){const current=session.subs.get(sub.key);bus.off(current.event,current.handler);bus.send(id,current.data);session.subs.delete(sub.key);}return;
   }
   if(!requests.has(id))throw Error('Это действие недоступно из отдельной вкладки.');
   if(id==='OBR_BROADCAST_SEND_MESSAGE'&&!data?.channel?.startsWith('io.github.kuzyaka111.legend-mist/'))throw Error('Недопустимый канал связи.');
   if(['OBR_INTERACTION_UPDATE_ITEM_INTERACTION','OBR_INTERACTION_STOP_ITEM_INTERACTION'].includes(id)){if(!session.interactions.has(data?.id))throw Error('Временная карточка уже закрыта.');if(id==='OBR_INTERACTION_STOP_ITEM_INTERACTION')session.interactions.delete(data.id);}
   if(nonce){const result=await bus.sendAsync(id,data,id==='OBR_ASSETS_DOWNLOAD_IMAGES'?-1:10000);if(id==='OBR_INTERACTION_START_ITEM_INTERACTION'&&result?.id){if(current())session.interactions.add(result.id);else bus.send('OBR_INTERACTION_STOP_ITEM_INTERACTION',{id:result.id});}if(current())send(session,{type:'sdk',message:{id:id+'_RESPONSE'+nonce,data:result}});}
   else bus.send(id,data);
  }catch(error){if(packet.type==='sdk'&&packet.message?.nonce)send(session,{type:'sdk',message:{id:packet.message.id+'_ERROR'+packet.message.nonce,data:error.message}});else respond(null,error.message);}
 }
 async function hello(event){
  if(event.origin!==origin||event.data?.type!=='legend-mist-detached-connect')return;
  const session=sessions.get(event.data.token),port=event.ports?.[0];if(!session||event.source!==session.window||!port)return;
  const version=access;let actualRole;try{actualRole=await obr.player.getRole();}catch{port.postMessage({type:'disconnected',message:'Не удалось проверить доступ к комнате. Откройте вкладку заново из Owlbear.'});port.close();return;}if(version!==access||!alive){port.postMessage({type:'disconnected',message:'Доступ к комнате изменился. Откройте вкладку заново.'});port.close();return;}role=actualRole;if(!permitted(session)){port.postMessage({type:'disconnected',message:'Панель доступна только ведущему комнаты.'});port.close();return;}
  if(session.port)dropPort(session);
  session.port=port;port.onmessage=e=>{if(session.port===port)void receive(session,e.data);};port.start?.();
  send(session,{type:'welcome',scope:scope(session.view),values:storageSnapshot(storage,scope(session.view))});
 }
 function open(view,provided){
  if(!alive||!['sheet','gm'].includes(view))throw Error('Не удалось открыть вкладку.');
  const existing=[...sessions.values()].find(s=>s.view===view&&!s.window.closed);if(existing){existing.window.focus();return existing.window;}
  const token=crypto.randomUUID(),url=new URL(view==='gm'?'./gm.html':'./index.html',base);url.search='';url.searchParams.set('surface','sheet');url.searchParams.set('detached','1');url.searchParams.set('opened',String(Date.now()));url.searchParams.set('obrref',btoa(origin+' '+obr.room.id));url.hash=token;
  const child=provided?provided(url.href):win.open(url.href,'legend-mist-'+view+'-'+obr.room.id+'-'+obr.player.id);if(!child)throw Error('Браузер заблокировал вкладку. Разрешите всплывающие окна для Owlbear и повторите.');
  sessions.set(token,{token,view,window:child,port:null,subs:new Map(),interactions:new Set(),connection:0});
  if(provided){try{child.opener=win;}catch(error){sessions.delete(token);throw error;}}
  return child;
 }
 open.version=2;open.find=view=>[...sessions.values()].find(s=>s.view===view&&!s.window.closed)?.window;
 win[DETACHED_OPEN]=open;win.addEventListener('message',hello);win.addEventListener('storage',publishStorage);win.addEventListener('legend-mist-store',publishStorage);
 const offRole=obr.player.onChange(player=>{if(role!==player.role){role=player.role;++access;}for(const session of [...sessions.values()])if(!permitted(session))disposeSession(session,'Доступ ведущего закрыт.');});
 const timer=win.setInterval(()=>{for(const session of [...sessions.values()])if(session.window.closed)disposeSession(session,'Вкладка закрыта.');},2000);
 return {open,dispose(){alive=false;++access;for(const s of [...sessions.values()])disposeSession(s,'Комната Owlbear закрыта.');clearInterval(timer);offRole();restore();delete win[DETACHED_OPEN];win.removeEventListener('message',hello);win.removeEventListener('storage',publishStorage);win.removeEventListener('legend-mist-store',publishStorage);}};
}
