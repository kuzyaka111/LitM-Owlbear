import {makeTheme} from '../src/theme-model.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {defaults} from '../src/storage.js';
import {sourceCard,editCard,applySource,cardFields,cardPoint,hitField,BOARD_KEY} from '../src/board-model.js';
import {boardCardElement} from '../src/board-render.js';
import {createSheetTransfer} from '../src/sheet-transfer.js';
const settle=()=>new Promise(r=>setTimeout(r,0));
test('scene edits expose approved controls and preserve source identity',()=>{
 const state=defaults('sheet'),card=sourceCard(state,'theme:hero-0');
 const edited=editCard(card,'power.1.text','Находит дорогу');const scratched=editCard(edited,'power.1.scratched',true);
 assert.equal(card.data.power[1].text,state.heroThemes[0].power[1].text);applySource(state,'theme:hero-0',scratched);
 assert.equal(state.heroThemes[0].power[1].text,'Находит дорогу');assert.equal(state.heroThemes[0].power[1].scratched,true);
 for(const id of ['might','bookId','__proto__.polluted'])assert.throws(()=>editCard(card,id,'x'));
 assert.throws(()=>editCard(card,'power.1.scratched','yes'));
 assert.equal(sourceCard(state,'notes-library'),null);
});
test('fully open scene render has a character caption, no pull tabs or card-management controls',()=>{
 const state=defaults('sheet'),doc=new JSDOM().window.document;
 for(const source of ['theme:hero-0','character','card:original-backpack','note:original-notes']){
  const card=sourceCard(state,source),node=boardCardElement({card,source,character:'Эрин'},doc);
  assert.equal(node.querySelector('.mt-board-owner').textContent,'Эрин');assert.equal(node.querySelector('.mt-scroll-toggle,.mt-delete-card,select,.mt-remove-item'),null);
  assert(node.querySelectorAll('[data-board-field]').length>0);assert.equal(node.querySelector('.mt-scroll-extension:not(.is-open)'),null);
  for(const field of node.querySelectorAll('[data-board-field]'))assert(cardFields(card).some(f=>f.id===field.dataset.boardField));
 }
});
test('scene hit regions account for grid scale, image scaling, rotation and offset',()=>{
 const item={position:{x:100,y:200},rotation:90,scale:{x:2,y:3},grid:{dpi:300,offset:{x:4,y:6}}};
 const point=cardPoint(item,{x:70,y:220},150);assert(Math.abs(point.x-24)<1e-8);assert(Math.abs(point.y-26)<1e-8);
 const r={hits:[{id:'a',kind:'toggle',x:20,y:20,width:10,height:10}]};assert.equal(hitField(r,point,'toggle').id,'a');assert.equal(hitField(r,point,'text'),undefined);
});
function fixture(){
 const dom=new JSDOM('<main><nav class="mt-tabs"></nav><section class="mt-card-slot" data-card-id="original-backpack"><article></article></section></main>'),root=dom.window.document.querySelector('main'),state=defaults('sheet'),events=[],errors=[];
 let items=[],listener;const scene={owner:'p',items:()=>items,record:item=>item.metadata[BOARD_KEY],subscribe(fn){listener=fn;fn(items);return()=>{};},emit(){listener(items);},async ghost(){events.push('ghost');return {move:async()=>{},remove:async()=>events.push('remove-ghost')};},async place(source,character,card){events.push('place');items=[{id:'map-card',metadata:{[BOARD_KEY]:{owner:'p',source,character,card,placed:true}}}];listener(items);}};
 root.querySelector('.mt-tabs').getBoundingClientRect=()=>({top:20});
 const transfer=createSheetTransfer(root,state,()=>events.push('save'),{scene,resize:async mini=>events.push(mini?'mini':'full'),toScene:async e=>({x:e.clientX,y:e.clientY}),getShared:()=>null,redraw:()=>events.push('redraw'),fit:()=>events.push('fit'),report:e=>errors.push(e)});
 return {dom,root,state,events,errors,scene,transfer,drag:{item:root.querySelector('section'),transform:''},pointer:(x,y)=>({clientX:x,clientY:y})};
}
test('export hides a source only after placement succeeds and hovering the miniature restores sheet',async()=>{
 const f=fixture();assert.equal(f.transfer.move(f.drag,f.pointer(600,5)),true);assert.equal(f.transfer.isMini(),true);
 assert.notEqual(f.drag.item.dataset.onBoard,'true');await settle();
 f.transfer.finish(f.drag,f.pointer(600,250),false);await settle();assert.equal(f.drag.item.dataset.onBoard,'true');assert(f.events.includes('save'));assert.deepEqual(f.errors,[]);
 f.dom.window.document.dispatchEvent(new f.dom.window.MouseEvent('pointermove',{clientX:5,clientY:5}));await settle();assert.equal(f.transfer.isMini(),false);f.transfer.dispose();
});
test('returning the held card to miniature or cancelling never publishes or hides it',async()=>{
 for(const mode of ['hover','escape']){
  const f=fixture();f.transfer.move(f.drag,f.pointer(600,5));await settle();
  if(mode==='hover')f.transfer.move(f.drag,f.pointer(5,5));else f.transfer.cancel();
  await settle();assert(!f.events.includes('place'));assert.equal(f.transfer.isMini(),false);assert.notEqual(f.drag.item.dataset.onBoard,'true');f.transfer.dispose();
 }
});
test('failed scene placement restores the full sheet and retains the original card',async()=>{
 const f=fixture();f.scene.place=async()=>{throw Error('Denied');};f.transfer.move(f.drag,f.pointer(600,5));await settle();
 f.transfer.finish(f.drag,f.pointer(600,250),false);await settle();assert.equal(f.transfer.isMini(),false);assert.equal(f.errors[0].message,'Denied');assert.notEqual(f.drag.item.dataset.onBoard,'true');f.transfer.dispose();
});

test('returning a card to a new device recovers its source instead of losing it',()=>{
 const original=defaults('sheet');original.statusCards.push({id:'recover',kind:'numeric',name:'Ранен',marks:[true,false,false,false,false,false],tear:3});
 const source=sourceCard(original,'status:recover'),fresh=defaults('sheet');assert.equal(applySource(fresh,'status:recover',source),true);assert.equal(fresh.statusCards[0].name,'Ранен');assert.equal(fresh.statusCards[0].marks[0],true);
});

test('editing a placed source never redraws hidden sheet cards or resizes the host; return refreshes it',async()=>{
 const f=fixture();await f.scene.place('card:original-backpack','Эрин',sourceCard(f.state,'card:original-backpack'));f.events.length=0;
 f.scene.items()[0].metadata[BOARD_KEY].card.data.items[0].text='Изменённый тег';f.scene.emit();assert(f.events.includes('save'));assert(!f.events.includes('redraw'));assert(!f.events.includes('fit'));assert.equal(f.state.cards[0].items[0].text,'Изменённый тег');
 f.events.length=0;f.scene.items()[0].metadata[BOARD_KEY].placed=false;f.scene.emit();assert(f.events.includes('redraw'));assert(f.events.includes('fit'));assert.equal(f.drag.item.dataset.onBoard,'false');f.transfer.dispose();
});

test('deletion updates an already open sheet and never restores the deleted source',async()=>{
 const f=fixture();f.state.statusCards.push({id:'temporary',kind:'story',name:'Ключ'});
 await f.scene.place('status:temporary','Эрин',sourceCard(f.state,'status:temporary'));f.events.length=0;
 Object.assign(f.scene.items()[0].metadata[BOARD_KEY],{placed:false,deleted:true});f.scene.emit();
 assert.equal(sourceCard(f.state,'status:temporary'),null);assert(f.events.includes('redraw'));assert(f.events.includes('save'));
 f.scene.emit();assert.equal(sourceCard(f.state,'status:temporary'),null);f.transfer.dispose();
});

test('story themes on the field use brown styling without Might controls or labels, including saved colored themes',()=>{
 const dom=new JSDOM(),doc=dom.window.document;
 for(const might of ['origin','adventure','greatness']){const data=makeTheme('story','story');data.might=might;data.power[0].text='Путь домой';const before=structuredClone(data),node=boardCardElement({card:{type:'theme',data},source:'card:story',character:'Герой'},doc);assert(node.querySelector('.mt-story-theme'));assert.equal(node.querySelector('.mt-theme-card').hasAttribute('data-might'),false);assert.equal(node.querySelector('.mt-might,.mt-board-might'),null);assert(node.textContent.includes('Путь домой'));assert.deepEqual(data,before);}
 dom.window.close();
});
