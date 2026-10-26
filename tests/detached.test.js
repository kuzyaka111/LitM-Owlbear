import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createDetachedHost} from '../src/detached-host.js';
import {allowedDetachedKey,createDetachedStorage} from '../src/detached-storage.js';
import {sharedSDKSubscriptions} from '../src/detached-sdk.js';
import {mountUI} from '../src/ui.js';
import {makeStore} from '../src/storage.js';
import {createSheetTransfer} from '../src/sheet-transfer.js';
import {openDetached} from '../src/detached-client.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const scope={room:'room',player:'player',view:'gm'};
const key=view=>'legend-mist-prototype:v1:'+JSON.stringify(['room','player',view]);
function setup(t,initialRole='GM'){
 const dom=new JSDOM('<main></main>',{url:'https://example.org/LitM-Owlbear/background.html'}),win=dom.window;let currentRole=initialRole;const listeners=new Set(),sent=[],bus=new EventEmitter();
 bus.send=(...args)=>sent.push(args);bus.sendAsync=async(id,data)=>{bus.send(id,data,'native-nonce');return {value:'native',id};};
 const opened=[];win.open=url=>{const popup={url,closed:false,focus(){}};opened.push(popup);return popup;};
 const obr={room:{id:'room',messageBus:bus},player:{id:'player',getRole:async()=>currentRole,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}},scene:{isReady:async()=>true},modal:{open:async()=>{}},viewport:{getWidth:async()=>1280,getHeight:async()=>900},popover:{open:async()=>{}}};
 const host=createDetachedHost(obr,win);t.after(()=>{host.dispose();win.close();});
 function connect(view='gm',{source,origin='https://example.org'}={}){const popup=host.open(view),messages=[],port={postMessage:data=>messages.push(data),close(){this.closed=true;},start(){}};win.dispatchEvent(new win.MessageEvent('message',{origin,source:source||popup,data:{type:'legend-mist-detached-connect',token:new URL(popup.url).hash.slice(1)},ports:[port]}));return {popup,port,messages,request:async packet=>{port.onmessage?.({data:packet});await tick();}};}
 return {win,host,bus,sent,obr,connect,role(value){currentRole=value;for(const fn of listeners)fn({role:value});}};
}
test('detached storage access is limited to the same participant, room and view',()=>{
 assert(allowedDetachedKey(key('sheet'),{...scope,view:'sheet'}));assert(!allowedDetachedKey(key('gm'),{...scope,view:'sheet'}));assert(!allowedDetachedKey('legend-mist-prototype:v1:["other","player","sheet"]',{...scope,view:'sheet'}));
 assert(!allowedDetachedKey('legend-mist-cloud-auth:v1',{...scope,view:'sheet'}));assert(allowedDetachedKey('legend-mist-cloud-auth:v1',scope));assert(allowedDetachedKey('legend-mist-gm-cloud:v1:["owner","room"]:backup',scope));assert(!allowedDetachedKey('legend-mist-gm-cloud:v1:["owner","other"]',scope));assert(!allowedDetachedKey('unrelated-secret',scope));
});
test('native and detached SDK subscriptions do not unsubscribe one another',()=>{
 const calls=[],bus={send:(...args)=>calls.push(args),sendAsync(){},on(){}};const restore=sharedSDKSubscriptions(bus);
 bus.send('OBR_SCENE_ITEMS_SUBSCRIBE',{});bus.send('OBR_SCENE_ITEMS_SUBSCRIBE',{});bus.send('OBR_SCENE_ITEMS_UNSUBSCRIBE',{});assert.equal(calls.length,1);bus.send('OBR_SCENE_ITEMS_UNSUBSCRIBE',{});assert.equal(calls.length,2);
 bus.send('OBR_BROADCAST_SUBSCRIBE',{channel:'io.github.kuzyaka111.legend-mist/a'});bus.send('OBR_BROADCAST_SUBSCRIBE',{channel:'io.github.kuzyaka111.legend-mist/b'});assert.equal(calls.length,4);restore();
});
test('the background opens the correct project URL and reuses one live tab per view',t=>{
 const s=setup(t);const one=s.host.open('sheet'),again=s.host.open('sheet'),gm=s.host.open('gm');assert.equal(one,again);const url=new URL(one.url);assert.equal(url.pathname,'/LitM-Owlbear/index.html');assert.equal(url.searchParams.get('detached'),'1');assert.equal(atob(url.searchParams.get('obrref')),'https://example.org room');assert.equal(new URL(gm.url).pathname,'/LitM-Owlbear/gm.html');
});
test('a visible click opens the popup and the background takes ownership before navigation',t=>{
 const s=setup(t);let destination,visibleCalls=0;const child={closed:false,focus(){}};
 const visible={location:{origin:'https://example.org'},parent:{frames:[s.win]},open(url){destination=url;visibleCalls++;return child;}};
 assert.equal(openDetached(visible,'sheet'),child);assert.equal(visibleCalls,1);assert.equal(child.opener,s.win);assert.equal(new URL(destination).pathname,'/LitM-Owlbear/index.html');assert(new URL(destination).searchParams.has('opened'));
 assert.equal(openDetached(visible,'sheet'),child);assert.equal(visibleCalls,1);
});
test('an old background and a blocked popup give distinct errors without opening a second window',t=>{
 const old=()=>{};const visible={location:{origin:'https://example.org'},parent:{frames:[{location:{origin:'https://example.org'},__legendMistOpenDetached:old}]},open(){throw Error('must not open');}};assert.throws(()=>openDetached(visible,'sheet'),/Ctrl\+F5/);
 const s=setup(t);visible.parent.frames=[s.win];visible.open=()=>null;assert.throws(()=>openDetached(visible,'gm'),/заблокировал/);
});
test('a genuine tab receives scoped data; a forged source or origin receives nothing',async t=>{
 const s=setup(t);s.win.localStorage.setItem(key('gm'),'private');s.win.localStorage.setItem('unrelated-secret','secret');const forged=s.connect('gm',{source:{}});await tick();assert.equal(forged.messages.length,0);const wrong=s.connect('gm',{origin:'https://evil.invalid'});await tick();assert.equal(wrong.messages.length,0);
 const c=s.connect('gm');await tick();assert.equal(c.messages[0].type,'welcome');assert.deepEqual(c.messages[0].values,{[key('gm')]:'private'});assert.deepEqual(c.messages[0].scope,scope);
});
test('players cannot open GM data, while a personal tab has no GM storage access',async t=>{
 const s=setup(t,'PLAYER');s.win.localStorage.setItem(key('gm'),'private');const gm=s.connect('gm');await tick();assert.equal(gm.messages[0].type,'disconnected');const sheet=s.connect('sheet');await tick();assert.equal(sheet.messages[0].values[key('gm')],undefined);
 await sheet.request({type:'command',request:'write',command:'storage',data:{key:key('gm'),value:'stolen'}});assert.match(sheet.messages.at(-1).error,/Нет доступа/);assert.equal(s.win.localStorage.getItem(key('gm')),'private');
});
test('a failed role check never releases a storage snapshot',async t=>{
 const s=setup(t);s.win.localStorage.setItem(key('gm'),'private');s.obr.player.getRole=async()=>{throw Error('room gone');};const c=s.connect('gm');await tick();assert.equal(c.messages[0].type,'disconnected');assert(!c.messages.some(m=>m.type==='welcome'));
});
test('SDK replies and change events traverse the port without exposing the real room ref',async t=>{
 const s=setup(t),c=s.connect('sheet');await tick();await c.request({type:'sdk',message:{id:'OBR_PLAYER_GET_ROLE',nonce:'_caller',data:{},ref:'untrusted'}});assert.deepEqual(c.messages.at(-1),{type:'sdk',message:{id:'OBR_PLAYER_GET_ROLE_RESPONSE_caller',data:{value:'native',id:'OBR_PLAYER_GET_ROLE'}}});
 await c.request({type:'sdk',message:{id:'OBR_SCENE_ITEMS_SUBSCRIBE',data:{}}});s.bus.emit('OBR_SCENE_ITEMS_EVENT_CHANGE',{items:[{id:'card'}]});assert.equal(c.messages.at(-1).message.data.items[0].id,'card');await c.request({type:'sdk',message:{id:'OBR_ARBITRARY_PRIVATE',nonce:'_bad',data:{}}});assert.match(c.messages.at(-1).message.data,/недоступно/);
});
test('demotion immediately disconnects private tabs and drops an in-flight response',async t=>{
 const s=setup(t),c=s.connect('gm');await tick();let release;s.bus.sendAsync=()=>new Promise(resolve=>release=resolve);c.port.onmessage({data:{type:'sdk',message:{id:'OBR_PARTY_GET_PLAYERS',nonce:'_old',data:{}}}});s.role('PLAYER');release({private:'must not arrive'});await tick();assert.equal(c.messages.at(-1).type,'disconnected');assert(!c.messages.some(m=>m.message?.id==='OBR_PARTY_GET_PLAYERS_RESPONSE_old'));
});
test('storage writes persist in the room and notify its existing sheet publisher',async t=>{
 const s=setup(t),c=s.connect('sheet');await tick();let notified;s.win.addEventListener('legend-mist-store',e=>notified=e.key);await c.request({type:'command',command:'storage',request:'save',data:{key:key('sheet'),value:'updated'}});assert.equal(s.win.localStorage.getItem(key('sheet')),'updated');assert.equal(notified,key('sheet'));assert(c.messages.some(m=>m.type==='storage-change'&&m.value==='updated'));
});
test('refreshing an authorized tab reconnects to its background without losing data',async t=>{
 const s=setup(t),first=s.connect('gm');await tick();await first.request({type:'command',request:'save',command:'storage',data:{key:key('gm'),value:'kept'}});await first.request({type:'bye'});const next=s.connect('gm');await tick();assert.equal(next.popup,first.popup);assert.equal(next.messages[0].type,'welcome');assert.equal(next.messages[0].values[key('gm')],'kept');
});
test('closing a tab removes temporary board interactions and ignores late interaction replies',async t=>{
 const s=setup(t),c=s.connect('sheet');await tick();s.bus.sendAsync=async()=>({id:'temporary'});await c.request({type:'sdk',message:{id:'OBR_INTERACTION_START_ITEM_INTERACTION',data:{baseState:[]},nonce:'_start'}});await c.request({type:'bye'});assert(s.sent.some(([id,data])=>id==='OBR_INTERACTION_STOP_ITEM_INTERACTION'&&data.id==='temporary'));
 const next=s.connect('sheet');await tick();let release;s.bus.sendAsync=()=>new Promise(resolve=>release=resolve);next.port.onmessage({data:{type:'sdk',message:{id:'OBR_INTERACTION_START_ITEM_INTERACTION',data:{baseState:[]},nonce:'_late'}}});await next.request({type:'bye'});release({id:'late-temporary'});await tick();assert(s.sent.some(([id,data])=>id==='OBR_INTERACTION_STOP_ITEM_INTERACTION'&&data.id==='late-temporary'));assert(!next.messages.some(m=>m.message?.id==='OBR_INTERACTION_START_ITEM_INTERACTION_RESPONSE_late'));
});
test('local draft survives a failed room write and can be explicitly recovered',async t=>{
 const dom=new JSDOM('',{url:'https://example.org'});t.after(()=>dom.window.close());const cache=dom.window.localStorage,personal={...scope,view:'sheet'};let offline=true;const writes=[],request=async(_,{key,value})=>{if(offline)throw Error('room closed');writes.push([key,value]);};
 const a=createDetachedStorage({initial:{[key('sheet')]:'before'},scope:personal,cache,request});a.setItem(key('sheet'),'after');assert.equal(a.getItem(key('sheet')),'after');await assert.rejects(a.flush(),/room closed/);assert(a.dirty);
 const b=createDetachedStorage({initial:{[key('sheet')]:'before'},scope:personal,cache,request});assert.equal(b.getItem(key('sheet')),'before');assert.equal(b.recovery[key('sheet')],'after');offline=false;await b.recover();assert.equal(writes.at(-1)[1],'after');assert.equal(b.dirty,false);
});
test('quota failure does not pretend to save a draft or replace its current value',t=>{
 const a=createDetachedStorage({initial:{[key('sheet')]:'before'},scope:{...scope,view:'sheet'},request:async()=>{},cache:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});assert.throws(()=>a.setItem(key('sheet'),'after'),/quota/);assert.equal(a.getItem(key('sheet')),'before');assert.equal(a.dirty,false);
});
test('buttons are in sheet settings and fixed GM actions; detached mode offers a return',t=>{
 for(const view of ['sheet','gm']){const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://example.org'});t.after(()=>dom.window.close());const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'room',player:'player'},view);let opened=0;mountUI(root,view,fs.readFileSync(new URL('../src/'+(view==='gm'?'gm':'sheet')+'.html',import.meta.url),'utf8'),store,{openDetached:()=>opened++,detached:true,fitWindow:()=>{},close:()=>{}});assert(root.querySelector(view==='gm'?'.mt-gm-window-actions .mt-detached-button':'.mt-settings-list .mt-detached-button'));root.querySelector('.mt-detached-button').click();assert.equal(opened,1);assert(dom.window.document.querySelector('.mt-detached-bar'));}
});
test('detached sheets keep board updates and visibility but never start a drag transfer',t=>{
 const dom=new JSDOM('<main><nav class="mt-tabs"></nav></main>');t.after(()=>dom.window.close());let resized=0;const root=dom.window.document.querySelector('main'),scene={items:()=>[],subscribe:()=>()=>{}};
 const transfer=createSheetTransfer(root,{},()=>{},{scene,allowDrag:false,resize:()=>resized++,getShared:()=>null,fit:()=>{},report:()=>{}});t.after(()=>transfer.dispose());assert.equal(transfer.move({}, {clientY:-100}),false);assert.equal(resized,0);
});
test('a failed sheet launch displays its message by the clicked setting, not in the sheet footer',async t=>{
 const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://example.org'});t.after(()=>dom.window.close());const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'room',player:'player'},'sheet');mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{openDetached:()=>{throw Error('Разрешите новую вкладку');},fitWindow:()=>{},close:()=>{}});root.querySelector('.mt-detached-button').click();assert.equal(root.querySelector('.mt-settings-list .mt-detached-error').textContent,'Разрешите новую вкладку');assert(root.querySelector('.mt-ui-message').hidden);
});
test('the labelled GM launch button is not constrained to the fixed icon width',t=>{
 const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://example.org'});t.after(()=>dom.window.close());const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'room',player:'player'},'gm');mountUI(root,'gm',fs.readFileSync(new URL('../src/gm.html',import.meta.url),'utf8'),store,{openDetached:()=>{},close:()=>{}});const button=root.querySelector('.mt-gm-window-actions .mt-detached-button');assert.equal(button.textContent,'↗ В отдельную вкладку');assert(!button.classList.contains('mt-icon'));
});
