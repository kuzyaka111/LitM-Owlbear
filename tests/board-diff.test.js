import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBoardObjects,BOARD_PART} from '../src/board-objects.js';
import {reconcileBoardObjects,previewBoardChanges,feedbackItems} from '../src/board-diff.js';
import {BOARD_KEY,sourceCard} from '../src/board-model.js';
import {defaults} from '../src/storage.js';
function builder(type,props={}){const item={id:crypto.randomUUID(),type,...props},api={build:()=>structuredClone(item)};for(const key of ['id','commands','fillColor','fillOpacity','strokeColor','strokeOpacity','strokeWidth','fillRule','scale','position','rotation','layer','createdUserId','attachedTo','locked','disableHit','disableAutoZIndex','zIndex','metadata','name'])api[key]=value=>{item[key]=value;return api;};return api;}
const build=(image,grid)=>builder('IMAGE',{image,grid}),buildPath=()=>builder('PATH');
const record=()=>({v:1,owner:'p',rev:crypto.randomUUID(),character:'Эрин',source:'theme:hero-0',card:sourceCard(defaults('sheet'),'theme:hero-0'),placed:true});
const base={width:244,height:200,dpi:150,hits:[],parts:[{key:'paper',type:'image',url:'https://example.org/board-assets/paper.png',x:14,y:30,width:216,height:150},{key:'text',type:'path',commands:[[0,10,20],[1,12,24],[5]],fill:'#333333',alpha:1},{key:'diamond',type:'path',commands:[[0,10,10],[1,12,12],[5]],fill:'#333333',alpha:0}]};
const objects=plan=>makeBoardObjects({record:record(),plan,point:{x:100,y:200},id:'root',build,buildPath});
test('changing one diamond preserves every part ID and updates only its graphic',()=>{
 const old=objects(base),changed=structuredClone(base);changed.parts[2].alpha=1;const next=objects(changed),patch=reconcileBoardObjects(old.parts,next);
 assert.equal(patch.add.length,0);assert.equal(patch.remove.length,0);assert.equal(patch.update.length,1);assert.equal(patch.update[0].before.id,old.parts[2].id);assert.deepEqual(next.root.metadata[BOARD_KEY].parts,old.parts.map(p=>p.id));
 assert.equal(next.parts[0].id,old.parts[0].id);assert.equal(next.parts[1].id,old.parts[1].id);assert.equal(next.parts[2].metadata[BOARD_PART].key,'diamond');
});
test('adding and removing a strike leaves paper and glyph objects intact',()=>{
 const old=objects(base),strike={key:'strike',type:'image',url:'https://example.org/board-assets/scratch-tear.png',x:10,y:40,width:180,height:6},next=objects({...base,parts:[...base.parts,strike]}),patch=reconcileBoardObjects(old.parts,next);
 assert.equal(patch.add.length,1);assert.equal(patch.update.length,0);assert.equal(patch.remove.length,0);const restored=objects(base),back=reconcileBoardObjects(next.parts,restored);assert.equal(back.add.length,0);assert.equal(back.update.length,0);assert.deepEqual(back.remove,[patch.add[0].id]);assert.deepEqual(restored.root.metadata[BOARD_KEY].parts,old.parts.map(p=>p.id));
});
test('wrapped text updates moved graphics and old exports without keys upgrade safely',()=>{
 const old=objects(base),changed=structuredClone(base);changed.parts[1].commands[1][2]=44;changed.parts[2].commands[1][2]=22;const next=objects(changed),patch=reconcileBoardObjects(old.parts,next);assert.equal(patch.update.length,2);assert.equal(patch.add.length,0);assert.equal(patch.remove.length,0);
 for(const p of old.parts)delete p.metadata[BOARD_PART].key;const upgrade=reconcileBoardObjects(old.parts,objects(base));assert.equal(upgrade.add.length,3);assert.equal(upgrade.remove.length,3);
});

test('native visual feedback is dispatched before saving and can be stopped without changing shared objects',async()=>{
 const original=objects(base),changed=structuredClone(base);changed.parts[2].alpha=1;const next=objects(changed),diff=reconcileBoardObjects(original.parts,next),events=[];
 const obr={interaction:{startItemInteraction:async state=>{const local=structuredClone(state);events.push('start');return [update=>{update(local);events.push(local[0].fillOpacity);},()=>events.push('stop')];}}};const stop=await previewBoardChanges(obr,diff.update);assert.deepEqual(events,['start',1]);assert.equal(original.parts[2].fillOpacity,0);stop();assert.deepEqual(events,['start',1,'stop']);
});

test('counter feedback uses small unattached overlays and retains the matching paper color',()=>{
 const before={id:'diamond',type:'PATH',attachedTo:'root',zIndex:50,visible:true,commands:[[0,10,10],[1,15,15],[1,20,10],[5]],style:{fillColor:'#eee',fillOpacity:0,strokeOpacity:1,strokeWidth:1},metadata:{[BOARD_PART]:{key:'field:promise:1:0',background:'#3c291f'}}};const after=structuredClone(before);after.style.fillOpacity=1;const result=feedbackItems([{before,after}]);assert.equal(result.state.length,2);assert(result.state.every(i=>!i.attachedTo&&!i.visible&&i.id!==before.id));assert.equal(result.values[0].style.fillColor,'#3c291f');assert.equal(result.values[1].style.fillOpacity,1);assert.equal(before.style.fillOpacity,0);
});

test('changing a graphic type creates a replacement instead of reusing an incompatible item ID',()=>{const old=objects(base),plan=structuredClone(base);plan.parts[0]={key:'paper',type:'path',commands:[[0,0,0],[1,10,10]],fill:'#333333',alpha:1};const next=objects(plan),diff=reconcileBoardObjects(old.parts,next);assert.equal(diff.add.length,1);assert.deepEqual(diff.remove,[old.parts[0].id]);assert.notEqual(next.parts[0].id,old.parts[0].id);});

test('restoring a scratched tag previews only its text row without involving the scroll hierarchy',()=>{
 const ink={id:'ink',type:'PATH',attachedTo:'root',position:{x:100,y:200},scale:{x:1,y:1},zIndex:50,visible:true,commands:[[0,10,20],[1,15,25],[5]],style:{fillColor:'#38342e',fillOpacity:1,strokeOpacity:0},metadata:{[BOARD_PART]:{key:'field:power.1.text:0'}}};const before={...structuredClone(ink),id:'strike',metadata:{[BOARD_PART]:{key:'tag-strike:power.1.text'}}},after=structuredClone(before);after.style.fillOpacity=0;const result=feedbackItems([{before,after}],{parts:[ink,after],record:{hits:[{id:'power.1.text',kind:'text',x:10,y:20,width:180,height:26,style:{background:'#f5e8c6'}}]}});assert.equal(result.state.length,3);assert(result.state.every(p=>!p.attachedTo&&p.id!==ink.id&&p.id!==before.id));assert.equal(result.values[0].style.fillColor,'#f5e8c6');assert.equal(result.values[1].style.fillOpacity,1);assert.equal(result.values[2].style.fillOpacity,0);
});
