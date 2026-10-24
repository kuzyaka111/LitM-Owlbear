import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {calculateAction,createActionPanel} from '../src/action-panel.js';
test('manual trades include modifier in effect Power and roll',()=>{
 assert.deepEqual(calculateAction(2,'caution',3),{power:6,roll:4});
 assert.deepEqual(calculateAction(2,'hedge',-1),{power:1,roll:2});
 assert.deepEqual(calculateAction(3,'caution'),{power:4,roll:2});
 assert.deepEqual(calculateAction(1,'hedge'),{power:1,roll:2});
 assert.deepEqual(calculateAction(-2,null),{power:1,roll:-2});
 assert.deepEqual(calculateAction(5,'sacrifice',2),{power:null,roll:2});
});
test('closing animation can be interrupted without hiding the newly selected tags',async()=>{
 const dom=new JSDOM('<aside hidden><div class="mt-scroll-body"></div></aside>');
 const panel=dom.window.document.querySelector('aside'),body=panel.firstChild,animations=[],visibility=[];
 body.animate=()=>{let finish;const a={finished:new Promise(r=>finish=r),cancel(){},finish:()=>finish()};animations.push(a);return a;};
 const controller=createActionPanel(panel,v=>visibility.push(v));
 controller.show(true);assert.equal(panel.hidden,false);animations[0].finish();await Promise.resolve();
 controller.show(false);assert.equal(panel.hidden,false);assert.equal(panel.inert,true);
 controller.show(true);animations[1].finish();await Promise.resolve();assert.equal(panel.hidden,false);assert.equal(panel.inert,false);
 animations[2].finish();await Promise.resolve();controller.show(false);animations[3].finish();await Promise.resolve();assert.equal(panel.hidden,true);assert.deepEqual(visibility,[true,true,false]);
});
