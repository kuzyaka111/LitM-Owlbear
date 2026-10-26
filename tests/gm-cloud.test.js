import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createGMCloud} from '../src/gm-cloud.js';
import {cleanGM} from '../src/gm-model.js';
import {makeStore} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
import {fakeCloudDatabase,memoryStorage} from './gm-cloud-fakes.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const sample=name=>cleanGM({scenes:[{id:'scene',name,tags:[{id:'tag',name:'Туман'}],notes:[{id:'note',title:'Запись',sections:[{id:'body',title:'Мост',text:'Секретное письмо'}]}],obstacles:[{id:'guard',name:'Страж'}]}],library:[{id:'wolf',name:'Волк'}],groups:[{id:'group',name:'Группа'}]});
test('a failed client download leaves local notes usable and login retries the connection',async t=>{
 const db=fakeCloudDatabase(),storage=memoryStorage(),localStore=makeStore(storage,{room:'room',player:'player'},'gm');localStore.save(sample('До входа'));let attempts=0;
 const cloud=createGMCloud({client:async()=>{if(++attempts===1)throw Error('network');return db.clientFor(null);},localStore,storage,roomId:'room',poll:100000});t.after(()=>cloud.dispose());
 await cloud.start();assert.equal(cloud.snapshot().status,'error');const next=cloud.store.load();next.scenes[0].name='После сбоя';assert(cloud.store.save(next));assert.equal(localStore.load().scenes[0].name,'После сбоя');await cloud.signIn('owner@example.invalid','test-password');await cloud.flush();assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'После сбоя');
});
function device(t,db,{user='owner',storage=memoryStorage(),local,room='room',allowed,deferRemote,delay=100000}={}){
 const localStore=makeStore(storage,{room,player:'player'},'gm');if(local)localStore.save(local);const client=db.clientFor(user),service=createGMCloud({client:async()=>client,localStore,storage,roomId:room,allowed,deferRemote,delay,poll:100000});t.after(()=>service.dispose());return {service,client,storage,localStore};
}
test('GM migration preserves scenes, notes, groups and obstacles; another device loads the complete panel',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Лес')});await a.service.start();await a.service.flush();assert.equal(a.service.snapshot().status,'saved');const b=device(t,db);await b.service.start();assert.deepEqual(b.service.store.load(),sample('Лес'));
 const next=b.service.store.load();next.scenes[0].notes[0].sections[0].text='Обновлено на другом устройстве';b.service.store.save(next);await b.service.flush();await a.service.refresh();assert.equal(a.service.store.load().scenes[0].notes[0].sections[0].text,'Обновлено на другом устройстве');assert.equal(a.localStore.load().scenes[0].notes[0].sections[0].text,'Секретное письмо');
 const otherRoom=device(t,db,{room:'other'});await otherRoom.service.start();assert.equal(otherRoom.service.store.load().scenes.length,0);const otherOwner=device(t,db,{user:'stranger'});await otherOwner.service.start();assert.equal(otherOwner.service.store.load().scenes.length,0);
});
test('offline edits survive reopening and synchronize when connection returns',async t=>{
 const db=fakeCloudDatabase(),storage=memoryStorage(),a=device(t,db,{storage,local:sample('Мост')});await a.service.start();await a.service.flush();db.offline=true;const next=a.service.store.load();next.scenes[0].name='После дождя';assert(a.service.store.save(next));await assert.rejects(a.service.flush(),/offline/);assert.equal(a.service.snapshot().status,'offline');a.service.dispose();
 const b=device(t,db,{storage});await b.service.start();assert.equal(b.service.store.load().scenes[0].name,'После дождя');db.offline=false;await b.service.refresh();await b.service.flush();assert.equal(b.service.snapshot().status,'saved');assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'После дождя');
});
test('concurrent changes never silently overwrite; keeping local preserves the remote version as a backup',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Исходник')});await a.service.start();await a.service.flush();const b=device(t,db);await b.service.start();const aa=a.service.store.load(),bb=b.service.store.load();aa.scenes[0].name='Версия А';bb.scenes[0].name='Версия Б';a.service.store.save(aa);b.service.store.save(bb);await a.service.flush();await b.service.flush();assert(b.service.snapshot().conflict);assert.equal(b.service.store.load().scenes[0].name,'Версия Б');assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'Версия А');await b.service.keepLocal();assert.equal(b.service.backup().document.scenes[0].name,'Версия А');assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'Версия Б');assert.equal(b.service.snapshot().conflict,false);
});
test('loading the cloud version keeps the unsent local version in backup and refreshes the GM view',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Первая')});await a.service.start();await a.service.flush();const b=device(t,db,{local:sample('Местная')});let received;b.service.subscribeDocument(value=>received=value);await b.service.start();assert(b.service.snapshot().conflict);await b.service.useCloud();assert.equal(received.scenes[0].name,'Первая');assert.equal(b.service.backup().document.scenes[0].name,'Местная');
});
test('remote refresh defers while a field is edited, and quota failure reports an unsaved local copy',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Старая')});await a.service.start();await a.service.flush();let focused=true;const b=device(t,db,{deferRemote:()=>focused});await b.service.start();const next=a.service.store.load();next.scenes[0].name='Новая';a.service.store.save(next);await a.service.flush();await b.service.refresh();assert.equal(b.service.store.load().scenes[0].name,'Старая');focused=false;await b.service.refresh();assert.equal(b.service.store.load().scenes[0].name,'Новая');const original=b.storage.setItem;b.storage.setItem=()=>{throw Error('quota');};next.scenes[0].name='Несохранённая правка';assert.equal(b.service.store.save(next),false);assert.equal(b.service.snapshot().status,'error');b.storage.setItem=original;
});
test('a changed document during upload remains pending and is saved in the next revision',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Начало')});await a.service.start();await a.service.flush();let release;db.writeGate=new Promise(resolve=>release=resolve);const first=a.service.store.load();first.scenes[0].name='Первое';a.service.store.save(first);const pending=a.service.flush();await settle();const second=a.service.store.load();second.scenes[0].name='Последнее';a.service.store.save(second);release();await pending;db.writeGate=null;assert(a.service.snapshot().dirty);await a.service.flush();assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'Последнее');
});
test('PLAYER cannot start cloud access and a disposed reader cannot publish a late response',async t=>{
 const db=fakeCloudDatabase(),denied=device(t,db,{allowed:async()=>false});await assert.rejects(denied.service.start(),/только ведущему/);await assert.rejects(denied.service.signIn('x','y'),/только ведущему/);assert.equal(db.writes,0);
 const a=device(t,db,{local:sample('Секрет')});let release;db.readGate=new Promise(resolve=>release=resolve);const starting=a.service.start();await settle();let callbacks=0;const before=callbacks;a.service.subscribeDocument(()=>callbacks++);a.service.dispose();release();await starting;assert.equal(callbacks,before);
});
test('logging into another account never migrates the previous account local document automatically',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{local:sample('Местный секрет')});await a.service.start();await a.service.flush();await a.service.signOut();await a.service.signIn('second@example.invalid','test-password');await settle();await a.service.flush();assert.equal(a.service.store.load().scenes.length,0);assert.equal(db.rows.get(db.key('second','room')).document.scenes.length,0);assert.equal(db.rows.get(db.key('owner','room')).document.scenes[0].name,'Местный секрет');
});
test('the GM cloud dialog connects without restoring removed headings and remote data updates the editor',async t=>{
 const db=fakeCloudDatabase(),a=device(t,db,{user:null,local:sample('Моя сцена')});await a.service.start();const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://example.org/gm.html'}),root=dom.window.document.querySelector('main');t.after(()=>dom.window.close());const state=mountUI(root,'gm',fs.readFileSync(new URL('../src/gm.html',import.meta.url),'utf8'),a.service.store,{cloud:a.service,close:async()=>{}});assert.equal(root.querySelector('.mt-windowbar,.mt-prototype-note'),null);root.querySelector('.mt-cloud-toggle').click();assert(root.querySelector('[aria-label="Электронная почта"]'));assert(root.querySelector('[aria-label="Пароль"]'));await a.service.signIn('owner@example.invalid','test-password');await a.service.flush();assert.equal(state.scenes[0].name,'Моя сцена');assert(root.querySelector('.mt-cloud-dialog').textContent.includes('owner@example.invalid'));root.querySelector('.mt-dialog-close').click();assert.equal(root.querySelector('.mt-cloud-dialog'),null);
});
