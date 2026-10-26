import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardScene} from '../src/board-scene.js';
import {buildFakeImage} from './board-fakes.js';
import {defaults} from '../src/storage.js';
import {BOARD_KEY,sourceCard} from '../src/board-model.js';
import {makeTheme} from '../src/theme-model.js';
function fixture(){
 let items=[],listeners=[],state=defaults('sheet'),fail=false;
 const api={async getItems(ids){return structuredClone(ids?items.filter(i=>ids.includes(i.id)):items);},onChange(fn){listeners.push(fn);return()=>listeners=listeners.filter(f=>f!==fn);},async addItems(next){if(fail)throw Error('Denied');items.push(...structuredClone(next));listeners.forEach(fn=>fn(structuredClone(items)));},async updateItems(ids,fn){ids=ids.map(id=>typeof id==='string'?id:id.id);const drafts=structuredClone(items);fn(drafts.filter(i=>ids.includes(i.id)));if(fail)throw Error('Denied');items=drafts;listeners.forEach(fn=>fn(structuredClone(items)));},async deleteItems(ids){items=items.filter(i=>!ids.includes(i.id));listeners.forEach(fn=>fn(structuredClone(items)));}};
 const obr={player:{id:'owner',getRole:async()=>'PLAYER'},scene:{grid:{getDpi:async()=>150},items:api,local:api,isReady:async()=>true}};
 const store={load:()=>structuredClone(state),save:next=>{state=structuredClone(next);return true;}};
 const render=async()=>({image:{url:'data:image/png;base64,test',width:366,height:300,mime:'image/png'},hits:[],dpi:225});
 const scene=createBoardScene(obr,{store,render,build:buildFakeImage});
 return {scene,obr,store,get items(){return items;},set fail(value){fail=value;}};
}
test('scene card updates mirror into the owner sheet and a return cannot overwrite later sheet edits',async()=>{
 const f=fixture();await f.scene.start();const card=sourceCard(f.store.load(),'card:original-backpack'),item=await f.scene.place('card:original-backpack','Эрин',card,{x:100,y:200});
 await f.scene.edit(item.id,'items.0.text','Новый плащ');await f.scene.edit(item.id,'items.0.scratched',true);
 assert.equal(f.store.load().cards[0].items[0].text,'Новый плащ');assert.equal(f.store.load().cards[0].items[0].scratched,true);
 await f.scene.returnToSheet(item.id);assert.equal(f.items.length,0);
 const state=f.store.load();state.cards[0].items[0].text='После возвращения';f.store.save(state);
 await f.obr.scene.items.addItems([{id:'unrelated',metadata:{}}]);assert.equal(f.store.load().cards[0].items[0].text,'После возвращения');f.scene.dispose();
});
test('failed placement leaves source data and scene unchanged; duplicates are rejected',async()=>{
 const f=fixture(),card=sourceCard(f.store.load(),'theme:hero-0');await f.scene.start();const before=f.store.load();f.fail=true;
 await assert.rejects(f.scene.place('theme:hero-0','Эрин',card,{x:0,y:0}),/Denied/);assert.equal(f.items.length,0);assert.deepEqual(f.store.load(),before);
 f.fail=false;await f.scene.place('theme:hero-0','Эрин',card,{x:0,y:0});await assert.rejects(f.scene.place('theme:hero-0','Эрин',card,{x:0,y:0}),/уже/);f.scene.dispose();
});

test('a PLAYER can rename an owned field storage and sync the name to the sheet, while another PLAYER cannot',async()=>{
 const f=fixture(),state=f.store.load();state.cards.push({id:'storage',type:'bag',title:'Хранилище',items:[]});f.store.save(state);assert.equal(await f.obr.player.getRole(),'PLAYER');await f.scene.start();const item=await f.scene.place('card:storage',state.name,sourceCard(state,'card:storage'),{x:0,y:0});
 await f.scene.edit(item.id,'title','Припасы');assert.equal(f.store.load().cards.find(c=>c.id==='storage').title,'Припасы');assert.equal(f.items[0].metadata[BOARD_KEY].card.data.title,'Припасы');f.obr.player.id='other';await assert.rejects(f.scene.edit(item.id,'title','Чужая правка'),/владелец/);assert.equal(f.items[0].metadata[BOARD_KEY].card.data.title,'Припасы');f.scene.dispose();
});
test('queued edits preserve other tag fields and unauthorized clients cannot return a card',async()=>{
 const f=fixture();await f.scene.start();const item=await f.scene.place('theme:hero-0','Эрин',sourceCard(f.store.load(),'theme:hero-0'),{x:0,y:0});
 await Promise.all([f.scene.edit(item.id,'power.1.text','Первый'),f.scene.edit(item.id,'power.2.text','Второй')]);
 const data=f.items[0].metadata[BOARD_KEY].card.data;assert.equal(data.power[1].text,'Первый');assert.equal(data.power[2].text,'Второй');
 f.obr.player.id='someone-else';await assert.rejects(f.scene.returnToSheet(item.id),/владелец/);assert.equal(f.items[0].visible,true);f.scene.dispose();
});

test('players cannot edit or mark another personal card, but a GM can',async()=>{
 const f=fixture();await f.scene.start();const item=await f.scene.place('theme:hero-0','Эрин',sourceCard(f.store.load(),'theme:hero-0'),{x:0,y:0});const before=structuredClone(f.items);
 f.obr.player.id='other';await assert.rejects(f.scene.edit(item.id,'power.1.text','Чужая запись'),/владелец/);await assert.rejects(f.scene.activateControl(item.id,'power.1.scratched'),/владелец/);assert.deepEqual(f.items,before);
 f.obr.player.getRole=async()=>'GM';await f.scene.edit(item.id,'power.1.text','Правка ведущего');assert.equal(f.items[0].metadata[BOARD_KEY].card.data.power[1].text,'Правка ведущего');f.scene.dispose();
});

test('moving a placed card never reloads storage, saves or notifies sheet layout',async()=>{
 const f=fixture();await f.scene.start();const state=f.store.load(),item=await f.scene.place('card:original-backpack',state.name,sourceCard(state,'card:original-backpack'),{x:0,y:0});
 await f.scene.syncCharacter(state.name);let loads=0,saves=0,notifications=0;const load=f.store.load,save=f.store.save;f.store.load=()=>{loads++;return load();};f.store.save=v=>{saves++;return save(v);};const off=f.scene.subscribe(()=>notifications++);notifications=0;
 for(let i=0;i<60;i++)await f.obr.scene.items.updateItems([item.id],drafts=>{drafts[0].position={x:i,y:i};});
 assert.equal(loads,0);assert.equal(saves,0);assert.equal(notifications,0);assert.deepEqual(f.scene.items()[0].position,{x:59,y:59});
 await f.scene.edit(item.id,'items.0.scratched',true);assert(notifications>0);assert(saves>0);off();f.scene.dispose();
});
test('preview movement keeps only the latest pointer instead of queuing stale positions',async()=>{
 const f=fixture();let release;const moves=[];f.obr.scene.local={addItems:async()=>{},deleteItems:async()=>{},updateItems:async(ids,change)=>{const draft=[{position:{}}];change(draft);moves.push(draft[0].position);if(moves.length===1)await new Promise(r=>release=r);}};
 const ghost=await f.scene.ghost('Эрин',sourceCard(f.store.load(),'card:original-backpack'),{x:0,y:0});
 const work=ghost.move({x:1,y:1});for(let i=2;i<=100;i++)ghost.move({x:i,y:i});release();await work;
 assert.deepEqual(moves,[{x:1,y:1},{x:100,y:100}]);await ghost.remove();f.scene.dispose();
});

test('deleting statuses, story tags and story themes removes the source before acknowledging the scene record',async()=>{
 for(const kind of ['status','numeric','story','theme']){
  const f=fixture(),state=f.store.load(),source=kind==='theme'?'card:story-theme':'status:temporary';
  if(kind==='theme')state.cards.push({id:'story-theme',type:'theme',theme:makeTheme('story','story-theme')});
  else state.statusCards.push({id:'temporary',kind,name:'Временная карточка',marks:Array(6).fill(false)});
  f.store.save(state);await f.scene.start();const item=await f.scene.place(source,state.name,sourceCard(state,source),{x:0,y:0}),seen=[];
  const off=f.scene.subscribe(items=>{if(items.some(i=>i.metadata[BOARD_KEY].deleted))seen.push(sourceCard(f.store.load(),source));});
  await f.scene.deleteCard(item.id);assert.equal(sourceCard(f.store.load(),source),null);assert.equal(f.items.length,0);assert.deepEqual(seen,[null]);
  await f.obr.scene.items.addItems([{id:'other',metadata:{}}]);assert.equal(sourceCard(f.store.load(),source),null);off();f.scene.dispose();
 }
});

test('only the owner or GM can delete supported cards; failed writes preserve the source',async()=>{
 const f=fixture(),state=f.store.load();state.statusCards.push({id:'temporary',kind:'story',name:'Ключ'});f.store.save(state);await f.scene.start();
 const item=await f.scene.place('status:temporary',state.name,sourceCard(state,'status:temporary'),{x:0,y:0});
 f.obr.player.id='other';await assert.rejects(f.scene.deleteCard(item.id),/владелец/);assert.equal(f.items[0].visible,true);
 f.obr.player.id='owner';f.fail=true;await assert.rejects(f.scene.deleteCard(item.id),/Denied/);assert(sourceCard(f.store.load(),'status:temporary'));assert.equal(f.items[0].metadata[BOARD_KEY].placed,true);f.fail=false;
 const bag=await f.scene.place('card:original-backpack',state.name,sourceCard(state,'card:original-backpack'),{x:0,y:0});await assert.rejects(f.scene.deleteCard(bag.id),/нельзя/);assert(sourceCard(f.store.load(),'card:original-backpack'));f.scene.dispose();
});

test('GM deletion survives an offline owner and is applied when the owner reconnects',async()=>{
 const f=fixture(),state=f.store.load();state.statusCards.push({id:'temporary',kind:'numeric',name:'Ранен'});f.store.save(state);await f.scene.start();
 const item=await f.scene.place('status:temporary',state.name,sourceCard(state,'status:temporary'),{x:0,y:0});f.scene.dispose();
 f.obr.player.id='gm';f.obr.player.getRole=async()=>'GM';const gm=createBoardScene(f.obr);await gm.start();await gm.deleteCard(item.id);
 assert.equal(f.items.length,1);assert.equal(f.items[0].visible,false);assert.equal(f.items[0].metadata[BOARD_KEY].deleted,true);assert(sourceCard(f.store.load(),'status:temporary'));gm.dispose();
 f.obr.player.id='owner';const owner=createBoardScene(f.obr,{store:f.store});await owner.start();assert.equal(sourceCard(f.store.load(),'status:temporary'),null);assert.equal(f.items.length,0);owner.dispose();
});

test('a failed local save retains a hidden deletion record until saving succeeds',async()=>{
 const f=fixture(),state=f.store.load();state.statusCards.push({id:'temporary',kind:'status',name:'Ранен'});f.store.save(state);await f.scene.start();const item=await f.scene.place('status:temporary',state.name,sourceCard(state,'status:temporary'),{x:0,y:0});f.scene.dispose();
 const errors=[],broken=createBoardScene(f.obr,{store:{load:f.store.load,save:()=>false},report:e=>errors.push(e)});await broken.start();await broken.deleteCard(item.id);assert.equal(f.items[0].metadata[BOARD_KEY].deleted,true);assert(sourceCard(f.store.load(),'status:temporary'));assert(errors.length>0);broken.dispose();
 const recovered=createBoardScene(f.obr,{store:f.store});await recovered.start();assert.equal(f.items.length,0);assert.equal(sourceCard(f.store.load(),'status:temporary'),null);recovered.dispose();
});
