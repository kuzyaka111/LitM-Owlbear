import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {openDiceTray} from '../src/dice.js';
function setup(){
 const dom=new JSDOM('<main></main>');
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 return {dom,root:dom.window.document.querySelector('main')};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('static tray keeps result and frozen bonus until close; resets selection once across rerolls',async()=>{
 const {root,dom}=setup();let reports=0,loads=0;
 const finished=openDiceTray(root,{bonus:3,animated:false,onFirstResult:()=>reports++},{loadRenderer:()=>{loads++;}});
 const check=()=>{const dice=[...root.querySelectorAll('.mt-static-die')].map(d=>Number(d.getAttribute('aria-label')));assert.equal(Number(root.querySelector('output').textContent),dice[0]+dice[1]+3);};
 check();root.querySelector('.mt-dice-reroll').click();check();assert.equal(reports,1);assert.equal(loads,0);
 const cancel=new dom.window.Event('cancel',{cancelable:true});root.querySelector('dialog').dispatchEvent(cancel);assert(cancel.defaultPrevented);assert(root.querySelector('dialog'));
 root.querySelector('.mt-dice-close').click();await finished;assert.equal(root.children.length,0);dom.window.close();
});
test('close resolves immediately during module loading, without clearing selection',async()=>{
 const {root,dom}=setup();let resolveLoad,created=0,reports=0;
 const finished=openDiceTray(root,{bonus:0,animated:true,onFirstResult:()=>reports++},{loadRenderer:()=>new Promise(r=>resolveLoad=r)});
 root.querySelector('.mt-dice-close').click();await finished;assert.equal(reports,0);
 resolveLoad({createDiceRenderer(){created++;}});await flush();assert.equal(created,0);assert.equal(root.children.length,0);dom.window.close();
});
test('close during renderer creation disposes the late renderer without rolling',async()=>{
 const {root,dom}=setup();let resolveCreate,disposed=0,rolls=0;
 const finished=openDiceTray(root,{bonus:0,animated:true},{loadRenderer:async()=>({createDiceRenderer:()=>new Promise(r=>resolveCreate=r)})});
 await flush();root.querySelector('.mt-dice-close').click();await finished;
 resolveCreate({dispose(){disposed++;},roll(){rolls++;}});await flush();assert.equal(disposed,1);assert.equal(rolls,0);dom.window.close();
});
test('load failure offers explicit fallback without silently rolling',async()=>{
 const {root,dom}=setup();let reports=0;
 const finished=openDiceTray(root,{bonus:-2,animated:true,onFirstResult:()=>reports++},{loadRenderer:async()=>{throw Error('WebGL unavailable');}});
 await flush();assert.equal(reports,0);assert.equal(root.querySelector('.mt-dice-reroll').disabled,false);
 root.querySelector('.mt-dice-reroll').click();assert.equal(reports,1);assert.equal(root.querySelectorAll('.mt-static-die').length,2);
 root.querySelector('.mt-dice-close').click();await finished;dom.window.close();
});
test('context loss disposes renderer and replaces reroll handler with static fallback',async()=>{
 const {root,dom}=setup();let callbacks,disposed=0,rolls=0,reports=0;
 const finished=openDiceTray(root,{bonus:2,animated:true,onFirstResult:()=>reports++},{loadRenderer:async()=>({createDiceRenderer:async(host,handlers)=>{callbacks=handlers;return {roll(){rolls++;handlers.onStart();},dispose(){disposed++;}};}})});
 await flush();assert.equal(rolls,1);assert.equal(reports,0);callbacks.onResult([1,6]);assert.equal(root.querySelector('output').textContent,'9');assert.equal(reports,1);
 callbacks.onError(Error('lost'));assert.equal(disposed,1);root.querySelector('.mt-dice-reroll').click();assert.equal(rolls,1);assert.equal(reports,1);
 dom.window.dispatchEvent(new dom.window.Event('pagehide'));await finished;assert.equal(disposed,1);assert.equal(root.children.length,0);dom.window.close();
});
