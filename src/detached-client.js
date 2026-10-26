import {createDetachedStorage} from './detached-storage.js';
const OPEN='__legendMistOpenDetached';
export const isDetached=win=>new URLSearchParams(win.location.search).get('detached')==='1';
export function openDetached(win,view,{preview=false}={}){
 if(preview){const url=new URL(view==='gm'?'./gm.html':'./index.html',win.location.href);url.search='?surface=sheet';return win.open(url.href,'_blank','noopener');}
 const parent=win.parent;
 let open;
 for(let i=0;i<parent.frames.length;i++){
  try{const host=parent.frames[i];if(host.location.origin===win.location.origin&&typeof host[OPEN]==='function'){open=host[OPEN];break;}}catch(error){if(error.name!=='SecurityError')throw error;}
 }
 if(!open||open.version!==2)throw Error('Фоновая часть комнаты ещё не обновилась. Нажмите Ctrl+F5 во вкладке Owlbear, снова откройте лист и повторите.');
 const existing=open.find?.(view);if(existing){existing.focus();return existing;}
 // Open from the clicked, visible frame while its user activation is live.
 // A hidden background iframe may not carry activation in some browsers.
 let child;
 try{const attached=open(view,url=>{child=win.open(url,'_blank');return child;});attached.focus();return attached;}catch(error){child?.close();throw error;}
}
export function connectDetached(win,{onDisconnect=()=>{},onError=()=>{}}={}){
 const token=win.location.hash.slice(1),origin=win.location.origin;
 if(!win.opener||!token)return Promise.reject(Error('Откройте эту вкладку кнопкой из комнаты Owlbear.'));
 const channel=new win.MessageChannel(),port=channel.port1,pending=new Map();let active=true,storage,timer,lastSeen=Date.now(),welcomeTimer;
 const send=packet=>{if(!active)throw Error('Связь с комнатой закрыта.');port.postMessage(packet);};
 const request=(command,data)=>new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timeout=setTimeout(()=>{pending.delete(id);reject(Error('Комната не ответила. Проверьте вкладку Owlbear.'));},15000);pending.set(id,{resolve,reject,timeout});try{send({type:'command',request:id,command,data});}catch(error){clearTimeout(timeout);pending.delete(id);reject(error);}});
 const disconnect=message=>{if(!active)return;active=false;clearTimeout(welcomeTimer);clearInterval(timer);win.removeEventListener('message',sdk);for(const p of pending.values()){clearTimeout(p.timeout);p.reject(Error(message));}pending.clear();port.close();onDisconnect(message);};
 const sdk=event=>{if(active&&event.source===win&&event.origin===origin&&event.data?.ref===token&&event.data.id?.startsWith('OBR_'))send({type:'sdk',message:event.data});};
 return new Promise((resolve,reject)=>{
  welcomeTimer=setTimeout(()=>{const message='Комната не ответила. Вернитесь в Owlbear и откройте вкладку заново.';disconnect(message);reject(Error(message));},12000);
  port.onmessage=event=>{
   const packet=event.data;lastSeen=Date.now();
   if(packet.type==='disconnected'){disconnect(packet.message);reject(Error(packet.message));return;}
   if(packet.type==='response'){const p=pending.get(packet.request);if(p){clearTimeout(p.timeout);pending.delete(packet.request);packet.error?p.reject(Error(packet.error)):p.resolve(packet.data);}return;}
   if(packet.type==='welcome'){
    if(storage)return;clearTimeout(welcomeTimer);
    const view=win.document.body.dataset.view;if(packet.scope.view!==view){disconnect('Не совпадает тип окна.');reject(Error('Не совпадает тип окна.'));return;}
    try{storage=createDetachedStorage({initial:packet.values,scope:packet.scope,request,cache:win.localStorage,report:onError,notify:key=>{const e=new win.CustomEvent('legend-mist-store');Object.defineProperty(e,'key',{value:key});win.dispatchEvent(e);}});}catch{const message='Браузер не разрешил хранение данных. Разрешите его для расширения и откройте вкладку заново.';disconnect(message);reject(Error(message));return;}
    win.addEventListener('message',sdk);
    // Same-origin synthetic SDK transport. The real room ref never leaves its background iframe.
    win.postMessage({id:'OBR_READY',data:{ref:token,userId:packet.scope.player}},origin);
    timer=win.setInterval(()=>{if(win.opener?.closed||Date.now()-lastSeen>15000){disconnect('Связь с комнатой потеряна. Откройте вкладку заново из Owlbear.');return;}send({type:'ping'});},3000);
    win.addEventListener('pagehide',()=>{if(active){try{send({type:'bye'});}catch{}disconnect('Вкладка закрыта.');}},{once:true});
    win.addEventListener('beforeunload',event=>{if(storage.dirty){event.preventDefault();event.returnValue='';}});
    resolve({storage,scope:packet.scope,request,dispose:()=>disconnect('Вкладка закрыта.')});return;
   }
   if(packet.type==='sdk'&&active)win.postMessage(packet.message,origin);
   else if(packet.type==='storage-change'&&storage)storage.receive(packet.key,packet.value);
   else if(packet.type==='storage-snapshot'&&storage)for(const key of new Set([...Object.keys(packet.values),...Array.from({length:storage.length},(_,i)=>storage.key(i))]))storage.receive(key,packet.values[key]??null);
  };
  port.start?.();win.opener.postMessage({type:'legend-mist-detached-connect',token},origin,[channel.port2]);
 });
}
