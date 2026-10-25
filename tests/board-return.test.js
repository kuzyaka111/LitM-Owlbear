import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountBoardReturn} from '../src/board-return.js';
test('return picker offers only own placed cards and restores a dropped card without selecting it on canvas',async()=>{
 const dom=new JSDOM('<main><nav class="mt-tabs"><button class="mt-close-sheet">×</button></nav></main>'),root=dom.window.document.querySelector('main');let listener,returned;
 let items=[{id:'mine',r:{owner:'p',placed:true,card:{type:'bag',data:{title:'Рюкзак Эрин'}}}},{id:'other',r:{owner:'q',placed:true,card:{type:'bag',data:{title:'Чужой'}}}}];
 const scene={owner:'p',items:()=>items,record:i=>i.r,subscribe(fn){listener=fn;fn();return()=>{};},async returnToSheet(id){returned=id;items=items.filter(i=>i.id!==id);listener();}};
 const dispose=mountBoardReturn(root,scene),button=root.querySelector('.mt-board-return');assert.equal(button.hidden,false);button.click();const list=root.querySelector('.mt-board-return-list');assert.equal(list.children.length,1);assert.equal(list.firstChild.textContent,'Рюкзак Эрин');list.firstChild.click();await new Promise(r=>setTimeout(r,0));assert.equal(returned,'mine');assert.equal(button.hidden,true);assert.equal(root.querySelector('dialog'),null);dispose();dom.window.close();
});
