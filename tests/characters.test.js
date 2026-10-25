import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeStore,defaults} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
import {createBoardScene} from '../src/board-scene.js';
import {sourceCard,BOARD_KEY} from '../src/board-model.js';
import {buildFakeImage} from './board-fakes.js';
import {collectActionSources} from '../src/action-sources.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('legacy character migrates with all data, new sheets start blank, selection survives reopening and stale saves cannot resurrect deleted characters',()=>{
 const storage=memory(),scope={room:'room',player:'a'},key='legend-mist-prototype:v1:'+JSON.stringify(['room','a','sheet']),old=defaults('sheet');old.name='Старый герой';old.notes='Оставить';storage.setItem(key,JSON.stringify(old));const store=makeStore(storage,scope,'sheet'),first=store.activeId();store.save(store.load());const id=store.createCharacter();assert.notEqual(id,first);assert.equal(store.listCharacters().length,2);assert.equal(store.load().name,'Новый персонаж');assert.equal(store.load().cards[0].items.length,0);assert.equal(store.load().noteCards.length,0);
 const fresh=store.load();fresh.name='Второй';fresh.statusCards.push({id:'s',kind:'status',name:'Метка'});store.save(fresh);store.selectCharacter(first);assert.equal(store.load().name,'Старый герой');assert.equal(store.load().notes,'Оставить');assert.equal(store.load().statusCards.length,0);store.selectCharacter(id);assert.equal(makeStore(storage,scope,'sheet').load().name,'Второй');
 store.deleteCharacter(id);assert.equal(store.activeId(),first);assert.equal(store.save(fresh),false);store.deleteCharacter(first);assert.equal(store.activeId(),null);assert.equal(makeStore(storage,scope,'sheet').listCharacters().length,0);assert.equal(store.save(old),false);
});
test('character commands are idempotent and a failed write cannot revoke or grant data',()=>{
 const base=memory();let fail=false;const storage={getItem:base.getItem,setItem:(k,v)=>{if(fail)throw Error('Quota');base.setItem(k,v);}},store=makeStore(storage,{room:'r',player:'p'},'sheet');store.save(store.load());const id=store.activeId();fail=true;assert.throws(()=>store.applyCharacterCommand('a',{type:'revoke',id}),/Quota/);assert.equal(store.listCharacters().length,1);fail=false;
 const removed=store.applyCharacterCommand('a',{type:'revoke',id});assert.deepEqual(store.applyCharacterCommand('a',{type:'revoke',id}),removed);assert.equal(store.listCharacters().length,0);store.applyCharacterCommand('b',{type:'grant',character:removed.character});store.applyCharacterCommand('b',{type:'grant',character:removed.character});assert.equal(store.listCharacters().length,1);const fresh=makeStore(memory(),{room:'r',player:'new'},'sheet');fresh.applyCharacterCommand('first-grant',{type:'grant',character:removed.character});assert.equal(fresh.listCharacters().length,1);assert.equal(fresh.activeId(),id);
});
test('Choose is above the hero name; deletion requires confirmation and cancellation preserves the entire roster',()=>{
 const dom=new JSDOM('<main id="mist-table-design"></main>'),root=dom.window.document.querySelector('main'),store=makeStore(memory(),{room:'test',player:'test'},'sheet');let reloads=0;
 mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{characters:store,reloadSheet:()=>reloads++,close:async()=>{}});
 const choose=root.querySelector('.mt-character-select');assert.equal(choose.textContent,'Выбрать');assert(choose.parentElement.textContent.includes('Имя героя'));choose.click();
 const click=text=>{const button=[...root.querySelectorAll('button')].find(n=>n.textContent===text);assert(button,text);button.click();};click('Создать нового');assert.equal(store.listCharacters().length,2);assert.equal(reloads,1);
 choose.click();const row=root.querySelector('.mt-character-choice');row.querySelectorAll('button')[1].click();assert.equal(store.listCharacters().length,2);click('Отмена');assert.equal(store.listCharacters().length,2);
 row.querySelectorAll('button')[1].click();click('Удалить персонажа');assert.equal(store.listCharacters().length,1);assert.equal(reloads,2);dom.window.close();
});
test('two characters can place identical theme slots independently and field edits update only their source character',async()=>{
 const store=makeStore(memory(),{room:'r',player:'p'},'sheet');store.save(store.load());const first=store.activeId();let items=[],listeners=[];const api={getItems:async ids=>structuredClone(ids?items.filter(i=>ids.includes(i.id)):items),onChange:fn=>{listeners.push(fn);return()=>listeners=listeners.filter(f=>f!==fn);},addItems:async next=>{items.push(...structuredClone(next));for(const fn of listeners)fn(items);},updateItems:async(ids,fn)=>{const names=ids.map(i=>typeof i==='string'?i:i.id);fn(items.filter(i=>names.includes(i.id)));for(const fn of listeners)fn(items);},deleteItems:async ids=>{items=items.filter(i=>!ids.includes(i.id));for(const fn of listeners)fn(items);}};
 const obr={player:{id:'p',getRole:async()=>'PLAYER'},scene:{items:api,isReady:async()=>true,grid:{getDpi:async()=>150}}},scene=createBoardScene(obr,{store,build:buildFakeImage,render:async()=>({image:{url:'https://example.org/paper.png',width:366,height:300,mime:'image/png'},hits:[],dpi:225})});await scene.start();
 const a=await scene.place('theme:hero-0','Первый',sourceCard(store.load(),'theme:hero-0'),{x:0,y:0}),second=store.createCharacter(),b=await scene.place('theme:hero-0','Второй',sourceCard(store.load(),'theme:hero-0'),{x:10,y:0});assert.equal(items.length,2);assert.equal(items[0].metadata[BOARD_KEY].characterId,first);assert.equal(items[1].metadata[BOARD_KEY].characterId,second);
 await scene.edit(a.id,'power.1.text','Только первый');await scene.edit(b.id,'power.1.text','Только второй');assert.equal(store.loadCharacter(first).heroThemes[0].power[1].text,'Только первый');assert.equal(store.loadCharacter(second).heroThemes[0].power[1].text,'Только второй');assert.equal(store.activeId(),second);scene.dispose();
 const tags=collectActionSources(items,{},'p',second).tags;assert.equal(tags.get('theme:hero-0:power:1').text,'Только второй');assert([...tags.keys()].some(k=>k.startsWith('field:'+a.id)));
});
