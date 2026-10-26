import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeCharacterStore} from '../src/character-store.js';
import {makeStore,defaults,clean} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
import {latestTask} from '../src/latest-task.js';
import {createActionSources} from '../src/action-sources.js';
import {BOARD_KEY} from '../src/board-model.js';
import {createGMCloud} from '../src/gm-cloud.js';
import {fakeCloudDatabase,memoryStorage} from './gm-cloud-fakes.js';
import {createDetachedStorage} from '../src/detached-storage.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('theme marks retain their controls and later question and book edits remain functional',async t=>{
 const dom=new JSDOM('<main></main>',{url:'https://test.invalid'});t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();});const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'r',player:'p'},'sheet');mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{fitWindow:()=>{},close:()=>{}});
 const card=root.querySelector('.mt-hero-theme'),row=card.querySelector('[data-kind=weakness]'),scratch=row.querySelector('.mt-scratch');scratch.click();await tick();assert.equal(root.querySelector('.mt-hero-theme'),card);assert(row.classList.contains('mt-scratched'));assert(store.load().heroThemes[0].weakness[0].scratched);
 card.querySelector('[aria-label="Вехи 2"]').click();await tick();assert.equal(root.querySelector('.mt-hero-theme'),card);assert.equal(store.load().heroThemes[0].milestone,2);assert.equal(card.querySelector('[aria-label="Вехи 2"]').getAttribute('aria-pressed'),'true');
 card.querySelector('.mt-question').click();root.querySelectorAll('.mt-question-option')[9].click();await tick();assert.equal(root.querySelector('.mt-hero-theme'),card);assert.equal(store.load().heroThemes[0].power[0].q,'J');scratch.click();await tick();assert.equal(store.load().heroThemes[0].weakness[0].scratched,false);
 card.querySelector('.mt-book-picker').click();const select=root.querySelector('[aria-label="Темник"]');select.selectedIndex=(select.selectedIndex+1)%select.options.length;const book=select.value;select.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(store.load().heroThemes[0].bookId,book);assert.notEqual(root.querySelector('.mt-hero-theme'),card);root.querySelector('.mt-hero-theme [data-kind=weakness] .mt-scratch').click();await tick();assert(store.load().heroThemes[0].weakness[0].scratched);
});

test('typing notes measures only the edited text area and retains the other editor',t=>{
 const dom=new JSDOM('<main></main>',{url:'https://test.invalid'});t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();});const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'r',player:'p'},'sheet');mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{fitWindow:()=>{},close:()=>{}});root.querySelector('#tab-notes').click();root.querySelector('.mt-add-note-section').click();const inputs=[...root.querySelectorAll('.mt-note-text')];assert(inputs.length>=2);let reads=0;for(const input of inputs){Object.defineProperty(input,'offsetParent',{get:()=>root});Object.defineProperty(input,'scrollHeight',{get:()=>{reads++;return 140;}});}inputs[0].value='Saved text';inputs[0].dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(reads,1);assert.equal(inputs[0].style.height,'140px');assert.equal(root.querySelectorAll('.mt-note-text')[1],inputs[1]);assert.equal(store.load().notes,'Saved text');
});
test('character lookups reuse validated storage but external changes and failed writes remain safe',()=>{
 const storage=memoryStorage(),scope={room:'r',player:'p'},key='legend-mist-prototype:v1:'+JSON.stringify(['r','p','sheet']);let cleans=0,writes=0;const set=storage.setItem;storage.setItem=(...args)=>{writes++;return set(...args);};
 const store=makeCharacterStore(storage,scope,{clean:(...args)=>{cleans++;return clean(...args);},defaults}),id=store.activeId();const before=cleans;for(let i=0;i<200;i++)assert.equal(store.activeId(),id);assert.equal(cleans,before);
 const state=store.load();state.name='First';assert(store.save(state));const count=writes;assert(store.save(store.load()));assert.equal(writes,count);
 const loaded=store.load();loaded.name='Not saved';assert.equal(store.load().name,'First');const listed=store.listCharacters();listed[0].state.name='Also not saved';assert.equal(store.load().name,'First');
 const raw=JSON.parse(storage.getItem(key));raw.characters[0].state.name='External';set(key,JSON.stringify(raw));assert.equal(store.load().name,'External');
 storage.setItem=()=>{throw Error('quota');};const next=store.load();next.name='Failed';assert.equal(store.save(next),false);assert.equal(store.load().name,'External');
});
test('changing one inventory card retains unrelated cards, focus, and their expanded content',t=>{
 const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://test.invalid'});t.after(()=>{dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();});const root=dom.window.document.querySelector('main'),store=makeStore(dom.window.localStorage,{room:'r',player:'p'},'sheet'),state=store.load();state.cards.push({id:'other',type:'bag',title:'Other',items:[{id:'other-tag',text:'Other tag',scratched:false}]});store.save(state);mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{fitWindow:()=>{},close:()=>{}});
 const untouched=root.querySelector('[data-card-id="other"]'),input=untouched.querySelector('input');input.focus();root.querySelector('[data-card-id="original-backpack"] .mt-scratch').click();assert.equal(root.querySelector('[data-card-id="other"]'),untouched);assert.equal(dom.window.document.activeElement,input);assert(store.load().cards[0].items[0].scratched);
});
test('replaceable resize work collapses a burst and applies the latest request arriving in flight',async()=>{
 let release;const seen=[],schedule=latestTask(async value=>{seen.push(value);if(value===3)await new Promise(resolve=>release=resolve);return value;});schedule(1);schedule(2);const first=schedule(3);await tick();const pending=schedule(4);schedule(5);release();assert.equal(await first,5);assert.equal(await pending,5);assert.deepEqual(seen,[3,5]);
 const retry=latestTask(async value=>{if(value===1)throw Error('denied');return value;});await assert.rejects(retry(1),/denied/);assert.equal(await retry(2),2);
});
test('moving unchanged field cards skips tag projection, but revision and visibility changes refresh it',async()=>{
 let listener,reads=0;const data={type:'bag',data:{id:'bag',items:[{id:'tag',text:'Before'}]}},record={placed:true,rev:'one',owner:'other',get card(){reads++;return data;}},items=[{id:'root',metadata:{[BOARD_KEY]:record}}];const obr={player:{id:'p'},scene:{isReady:async()=>true,onReadyChange:()=>()=>{},onMetadataChange:()=>()=>{},getMetadata:async()=>({}),items:{getItems:async()=>items,onChange:fn=>{listener=fn;return()=>{};}}}};const service=createActionSources(obr);await service.start();reads=0;for(let i=0;i<50;i++){items[0].position={x:i,y:0};listener(items);}assert.equal(reads,0);record.rev='two';data.data.items[0].text='After';listener(items);assert.equal([...service.get().tags.values()][0].text,'After');items[0].visible=false;listener(items);assert.equal(service.get().tags.size,0);service.dispose();
});
test('cloud polling reads only revision until changed, and identical saves do not create new revisions',async t=>{
 const db=fakeCloudDatabase(),storage=memoryStorage(),localStore=makeStore(storage,{room:'r',player:'p'},'gm'),cloud=createGMCloud({client:async()=>db.clientFor(),localStore,storage,roomId:'r',poll:100000,delay:100000});t.after(()=>cloud.dispose());localStore.save(localStore.load());await cloud.start();await cloud.flush();const before=db.writes;db.reads.length=0;for(let i=0;i<5;i++)await cloud.refresh();assert.deepEqual(db.reads,Array(5).fill('revision'));assert(cloud.store.save(cloud.store.load()));await cloud.flush();assert.equal(db.writes,before);
 const row=db.rows.get(db.key('owner','r'));row.revision++;row.document.scenes[0].name='Remote';db.reads.length=0;await cloud.refresh();assert.deepEqual(db.reads,['revision','document,revision,updated_at']);assert.equal(cloud.store.load().scenes[0].name,'Remote');
 const next=cloud.store.load();next.scenes[0].name='Retry';const set=storage.setItem;storage.setItem=()=>{throw Error('quota');};assert.equal(cloud.store.save(next),false);storage.setItem=set;assert(cloud.store.save(next));await cloud.flush();assert.equal(db.rows.get(db.key('owner','r')).document.scenes[0].name,'Retry');
});
test('identical detached writes create one room request while a failed write can still be retried',async()=>{
 const scope={room:'r',player:'p',view:'sheet'},key='legend-mist-prototype:v1:'+JSON.stringify(['r','p','sheet']),calls=[];let offline=false;const storage=createDetachedStorage({initial:{},scope,cache:memoryStorage(),request:async(_,data)=>{calls.push(data);if(offline)throw Error('offline');}});for(let i=0;i<20;i++)storage.setItem(key,'one');await storage.flush();assert.equal(calls.length,1);offline=true;storage.setItem(key,'two');await assert.rejects(storage.flush(),/offline/);offline=false;storage.setItem(key,'two');await storage.flush();assert.equal(calls.length,3);
});
