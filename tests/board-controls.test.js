import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {defaults} from '../src/storage.js';
import {sourceCard,editCard,cardFields,activationValue,fieldValue,textToggle,cardPoint,cardWorldPoint} from '../src/board-model.js';
import {boardCardElement} from '../src/board-render.js';
import {inlineEditorOptions,bindInlineInput} from '../src/board-inline.js';
import {makeTheme,quintessences} from '../src/theme-model.js';
test('scene diamonds follow sheet counters and bounded improvement choices',()=>{
 let theme=sourceCard(defaults('sheet'),'theme:hero-0');const field=cardFields(theme).find(f=>f.id==='improve');theme=editCard(theme,field.id,activationValue(theme,field,{value:2}));assert.equal(theme.data.improve,2);theme=editCard(theme,field.id,activationValue(theme,field,{value:2}));assert.equal(theme.data.improve,1);
 for(const invalid of [-1,4,1.5,'2',true])assert.throws(()=>editCard(theme,'improve',invalid));
 const choice=cardFields(theme).find(f=>f.option);theme=editCard(theme,choice.id,true);assert.equal(fieldValue(theme,choice),true);theme=editCard(theme,choice.id,false);assert.equal(fieldValue(theme,choice),false);assert.throws(()=>editCard(theme,'improvements:invented',true));
 let character=sourceCard(defaults('sheet'),'character');character=editCard(character,'promise',5);assert.equal(character.data.promise,5);assert.throws(()=>editCard(character,'promise',6));character=editCard(character,'quintessenceIds:'+quintessences[0].id,true);assert(character.data.quintessenceIds.includes(quintessences[0].id));
 const story={type:'theme',data:makeTheme('story')};assert.equal(editCard(story,'storyImprovements.0.active',true).data.storyImprovements[0].active,true);
});
test('rendered diamonds have independent hit regions and text maps only to scratchable tags',()=>{
 const state=defaults('sheet'),doc=new JSDOM().window.document;
 const theme=sourceCard(state,'theme:hero-0'),node=boardCardElement({card:theme,source:'theme:hero-0',character:'Эрин'},doc);assert.equal(node.querySelectorAll('[data-board-kind=count]').length,9);assert.deepEqual([...node.querySelectorAll('[data-track=improve] [data-board-value]')].map(n=>n.dataset.boardValue),['1','2','3']);
 const char=boardCardElement({card:sourceCard(state,'character'),source:'character',character:'Эрин'},doc);assert.equal(char.querySelectorAll('[data-board-field=promise]').length,5);
 assert.equal(textToggle(theme,'power.1.text').id,'power.1.scratched');assert.equal(textToggle(theme,'quest'),undefined);assert.equal(textToggle({type:'status',data:{kind:'status',marks:[]}},'name'),undefined);
});
test('inline editor anchors at the text field after scale, rotation and viewport transform',async()=>{
 const item={id:'card',type:'PATH',position:{x:100,y:200},rotation:90,scale:{x:2,y:2}},point={x:10,y:20};const restored=cardPoint(item,cardWorldPoint(item,point,150),150);assert(Math.abs(restored.x-point.x)<1e-8);assert(Math.abs(restored.y-point.y)<1e-8);
 const hit={id:'power.1.text',x:10,y:20,width:100,height:30,style:{fontSize:15,lineHeight:24}},obr={scene:{grid:{getDpi:async()=>150}},viewport:{transformPoint:async p=>({x:p.x*.5+20,y:p.y*.5+10})}};
 const options=await inlineEditorOptions(obr,item,hit,'https://example.org/project/background.html');assert.equal(options.hidePaper,true);assert.equal(options.disableClickAway,true);assert(Math.abs(options.anchorPosition.left-20)<1e-8);assert(Math.abs(options.anchorPosition.top-120)<1e-8);assert.equal(options.width,60);assert(options.height>=100&&options.height<=101);assert.equal(new URL(options.url).searchParams.get('field'),hit.id);assert.equal(options.url.startsWith('https://example.org/project/card-editor.html'),true);
});
test('inline editing saves once on Enter or blur, cancels on Escape and keeps Shift+Enter for text',async()=>{
 const dom=new JSDOM('<textarea></textarea>'),input=dom.window.document.querySelector('textarea'),events=[];input.value='Новый тег';let unbind=bindInlineInput(input,{save:async value=>events.push(value),close:async()=>events.push('close'),report:assert.fail});
 input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,cancelable:true}));assert.deepEqual(events,[]);input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',cancelable:true}));input.dispatchEvent(new dom.window.FocusEvent('blur'));await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['Новый тег','close']);unbind();
 input.readOnly=false;events.length=0;unbind=bindInlineInput(input,{save:async value=>events.push(value),close:async()=>events.push('close'),report:assert.fail});input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));input.dispatchEvent(new dom.window.FocusEvent('blur'));assert.deepEqual(events,['close']);unbind();
 events.length=0;unbind=bindInlineInput(input,{save:async value=>events.push(value),close:async()=>events.push('close'),report:assert.fail});input.dispatchEvent(new dom.window.FocusEvent('blur'));await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['Новый тег','close']);unbind();dom.window.close();
});

import {watchBoardTools} from '../src/board-scene.js';
import {BOARD_KEY,BOARD_TOOL} from '../src/board-model.js';
test('card selection enables controls automatically; scratches, count clicks and double-click editing reach the right fields',async()=>{
 const card=sourceCard(defaults('sheet'),'theme:hero-0'),root={id:'root',type:'PATH',position:{x:100,y:200},rotation:0,scale:{x:1,y:1},metadata:{[BOARD_KEY]:{placed:true,card,hits:[{id:'power.1.scratched',kind:'toggle',x:200,y:40,width:20,height:30},{id:'power.1.text',kind:'text',x:20,y:40,width:170,height:30},{id:'improve',kind:'count',value:2,x:30,y:100,width:20,height:20}]}}};
 let mode,onPlayer,active='rodeo.owlbear.tool/move';const edits=[],activated=[],popovers=[];
 const scene={record:i=>i?.metadata?.[BOARD_KEY],items:()=>[root],edit:async(id,field,value)=>{edits.push({id,field,value});root.metadata[BOARD_KEY].card=editCard(root.metadata[BOARD_KEY].card,field,value);},returnToSheet:async()=>{}};
 const obr={scene:{isReady:async()=>true,onReadyChange:()=>()=>{},grid:{getDpi:async()=>150},items:{getItems:async ids=>ids.includes(root.id)?[root]:[]}},player:{onChange:fn=>{onPlayer=fn;return()=>{};}},tool:{create:async()=>{},createMode:async m=>{mode=m;},remove:async()=>{},removeMode:async()=>{},getActiveTool:async()=>active,activateTool:async id=>{active=id;activated.push(id);},activateMode:async(t,m)=>activated.push(m)},popover:{open:async p=>popovers.push(p)},viewport:{transformPoint:async p=>p},contextMenu:{create:async()=>{},remove:async()=>{}},notification:{show:assert.fail}};
 const controller=watchBoardTools(obr,scene,'https://example.org/background.html');await new Promise(r=>setTimeout(r,0));onPlayer({selection:['root']});await new Promise(r=>setTimeout(r,0));assert.deepEqual(activated,[BOARD_TOOL,BOARD_TOOL+'/edit']);
 await mode.onToolClick({}, {target:{id:'child',attachedTo:'root'},pointerPosition:{x:310,y:250}});assert.equal(edits.at(-1).field,'power.1.scratched');assert.equal(edits.at(-1).value,true);
 await mode.onToolClick({}, {target:root,pointerPosition:{x:140,y:310}});assert.equal(edits.at(-1).value,2);await mode.onToolClick({}, {target:root,pointerPosition:{x:140,y:310}});assert.equal(edits.at(-1).value,1);
 const event={target:root,pointerPosition:{x:150,y:250}},before=edits.length;const click=mode.onToolClick({},event);await mode.onToolDoubleClick({},event);await click;await new Promise(r=>setTimeout(r,280));assert.equal(edits.length,before);assert.equal(popovers.length,1);assert.equal(popovers[0].hidePaper,true);assert.deepEqual(popovers[0].anchorPosition,{left:120,top:240});await controller.dispose();
});

test('right-click deletion is offered only for status cards and story themes, and the menu is removed on disposal',async()=>{
 const menus=new Map(),removed=[],deleted=[],returned=[];
 const obr={scene:{isReady:async()=>true,onReadyChange:()=>()=>{}},player:{onChange:()=>()=>{}},tool:{create:async()=>{},createMode:async()=>{},remove:async()=>{},removeMode:async()=>{}},contextMenu:{create:async m=>menus.set(m.id,m),remove:async id=>removed.push(id)},notification:{show:assert.fail}};
 const controller=watchBoardTools(obr,{deleteCard:async id=>deleted.push(id),returnToSheet:async id=>returned.push(id)},'https://example.org/background.html');await new Promise(r=>setTimeout(r,0));
 const menu=menus.get(BOARD_TOOL+'/delete'),matches=record=>menu.icons.some(icon=>icon.filter.every.every(({key,value})=>key.reduce((v,k)=>v?.[k],{metadata:{[BOARD_KEY]:record}})===value));
 for(const kind of ['status','numeric','story'])assert(matches({placed:true,card:{type:'status',data:{kind}}}));
 assert(matches({placed:true,card:{type:'theme',data:{bookId:'story'}}}));
 for(const card of [{type:'bag'},{type:'character'},{type:'note'},{type:'theme',data:{bookId:'past'}}])assert(!matches({placed:true,card}));
 assert(!matches({placed:false,card:{type:'status'}}));
 menu.onClick({items:[{id:'temporary'}]});assert.deepEqual(deleted,['temporary']);assert.deepEqual(returned,[]);
 await controller.dispose();assert(removed.includes(BOARD_TOOL+'/delete'));assert(removed.includes(BOARD_TOOL+'/return'));
});
