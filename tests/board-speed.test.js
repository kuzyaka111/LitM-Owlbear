import {BOARD_GRAPHICS_VERSION} from '../src/board-graphics.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoardScene} from '../src/board-scene.js';
import {BOARD_KEY,sourceCard} from '../src/board-model.js';
import {BOARD_PART} from '../src/board-diff.js';
import {defaults} from '../src/storage.js';
function builder(type,props={}){const item={id:crypto.randomUUID(),type,...props},api={build:()=>structuredClone(item)};for(const key of ['id','commands','fillColor','fillOpacity','strokeColor','strokeOpacity','strokeWidth','fillRule','scale','position','rotation','layer','createdUserId','attachedTo','locked','disableHit','disableAutoZIndex','zIndex','metadata','name'])api[key]=value=>{item[key]=value;return api;};return api;}
function fixture(){let items=[],listener=()=>{},fail=false;const calls={read:0,add:0,remove:0,write:0,keys:[]};
 const api={getItems:async ids=>{calls.read++;return structuredClone(ids?items.filter(i=>ids.includes(i.id)):items);},onChange:fn=>{listener=fn;return()=>{};},addItems:async next=>{calls.add++;items.push(...structuredClone(next));listener(structuredClone(items));},deleteItems:async ids=>{calls.remove++;items=items.filter(i=>!ids.includes(i.id));listener(structuredClone(items));},updateItems:async(input,change)=>{calls.write++;const ids=input.map(i=>typeof i==='string'?i:i.id),drafts=structuredClone(items);change(drafts.filter(i=>ids.includes(i.id)).map(item=>new Proxy(item,{set(target,key,value){calls.keys.push({id:item.id,key});target[key]=value;return true;}})));if(fail)throw Error('Denied');items=drafts;listener(structuredClone(items));}};
 const obr={player:{id:'p'},scene:{isReady:async()=>true,items:api,grid:{getDpi:async()=>150}}},state=defaults('sheet');
 const render=async r=>({width:244,height:200,dpi:150,interactionVersion:BOARD_GRAPHICS_VERSION,hits:[],parts:[{key:'paper',type:'image',url:'https://example.org/board-assets/paper.png',x:14,y:30,width:216,height:150},{key:'text',type:'path',commands:[[0,10,20],[1,12,24],[5]],fill:'#333333',alpha:1},{key:'mark',type:'path',commands:[[0,10,10],[1,12,12],[5]],fill:'#333333',alpha:r.card.data.improve/3}]});
 const scene=createBoardScene(obr,{render,build:(image,grid)=>builder('IMAGE',{image,grid}),buildPath:()=>builder('PATH')});return {scene,state,calls,api,obr,get items(){return items;},set fail(value){fail=value;},reset(){Object.assign(calls,{read:0,add:0,remove:0,write:0,keys:[]});}};
}
test('a native counter click makes one batched write, no reads or replacement objects, and never rewrites root geometry',async()=>{
 const f=fixture();await f.scene.start();const root=await f.scene.place('theme:hero-0',f.state.name,sourceCard(f.state,'theme:hero-0'),{x:0,y:0}),ids=root.metadata[BOARD_KEY].parts;f.reset();await f.scene.activateControl(root.id,'improve',{value:2});
 assert.equal(f.calls.read,0);assert.equal(f.calls.add,0);assert.equal(f.calls.remove,0);assert.equal(f.calls.write,1);assert.deepEqual(f.scene.items()[0].metadata[BOARD_KEY].parts,ids);assert.equal(f.scene.items()[0].metadata[BOARD_KEY].card.data.improve,2);
 assert(!f.calls.keys.some(k=>k.id===root.id&&k.key==='commands'));assert(!f.calls.keys.some(k=>k.id===ids[0]||k.id===ids[1]));assert(f.calls.keys.some(k=>k.id===ids[2]&&k.key==='fillOpacity'));f.scene.dispose();
});
test('rapid control clicks use the latest queued card and a failed write preserves the last saved state',async()=>{
 const f=fixture();await f.scene.start();const root=await f.scene.place('theme:hero-0',f.state.name,sourceCard(f.state,'theme:hero-0'),{x:0,y:0});await f.scene.edit(root.id,'improve',0);f.reset();
 await Promise.all([f.scene.activateControl(root.id,'improve',{value:1}),f.scene.activateControl(root.id,'improve',{value:1})]);assert.equal(f.scene.items()[0].metadata[BOARD_KEY].card.data.improve,0);assert.equal(f.calls.add,0);assert.equal(f.calls.remove,0);const before=structuredClone(f.items);f.fail=true;await assert.rejects(f.scene.edit(root.id,'improve',3),/Denied/);assert.deepEqual(f.items,before);assert.equal(f.scene.items()[0].metadata[BOARD_KEY].card.data.improve,0);f.scene.dispose();
});

test('a burst of control clicks preserves every toggle while batching queued writes',async()=>{
 const f=fixture();await f.scene.start();const root=await f.scene.place('theme:hero-0',f.state.name,sourceCard(f.state,'theme:hero-0'),{x:0,y:0});await f.scene.edit(root.id,'improve',0);f.reset();await Promise.all(Array.from({length:100},()=>f.scene.activateControl(root.id,'improve',{value:1})));assert.equal(f.scene.items()[0].metadata[BOARD_KEY].card.data.improve,0);assert(f.calls.write<=2);assert.equal(f.calls.add,0);assert.equal(f.calls.remove,0);f.scene.dispose();
});

test('a failed save stops the immediate preview and leaves the shared card unchanged',async()=>{
 const f=fixture();await f.scene.start();const root=await f.scene.place('theme:hero-0',f.state.name,sourceCard(f.state,'theme:hero-0'),{x:0,y:0});let stopped=0,shown=0;f.obr.interaction={startItemInteraction:async state=>[update=>{update(structuredClone(state));shown++;},()=>stopped++]};const before=structuredClone(f.items);f.fail=true;await assert.rejects(f.scene.activateControl(root.id,'improve',{value:3}),/Denied/);assert.equal(shown,1);assert.equal(stopped,1);assert.deepEqual(f.items,before);f.scene.dispose();
});
test('upgrading an old card removes pre-existing unreferenced decorations while retaining all source data',async()=>{
 const f=fixture();await f.scene.start();const root=await f.scene.place('theme:hero-0',f.state.name,sourceCard(f.state,'theme:hero-0'),{x:0,y:0}),before=structuredClone(f.scene.items()[0].metadata[BOARD_KEY]);await f.api.updateItems([root.id],drafts=>{drafts[0].metadata[BOARD_KEY].interactionVersion=2;});const part=structuredClone(f.items.find(i=>i.id===before.parts[0]));part.id='stale-decoration';part.metadata[BOARD_PART].rev='old';await f.api.addItems([part]);await f.scene.start();assert(!f.items.some(i=>i.id==='stale-decoration'));assert.equal(f.scene.items()[0].metadata[BOARD_KEY].interactionVersion,BOARD_GRAPHICS_VERSION);assert.deepEqual(f.scene.items()[0].metadata[BOARD_KEY].card,before.card);assert.deepEqual(f.scene.items()[0].metadata[BOARD_KEY].parts,before.parts);f.scene.dispose();
});
