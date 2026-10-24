import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {calculateAction,createActionPanel,createActionTagList} from '../src/action-panel.js';
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

test('calculator appears in place after host resize while retaining its unfold animation',async()=>{
 const dom=new JSDOM('<aside hidden><div class="mt-scroll-body"></div></aside>'),panel=dom.window.document.querySelector('aside');
 let resize;const animations=[];panel.firstChild.animate=(frames,options)=>{animations.push({frames,options});return {cancel(){},finished:new Promise(()=>{})};};
 const controller=createActionPanel(panel,open=>open?new Promise(resolve=>resize=resolve):undefined);
 controller.show(true);assert.equal(panel.style.visibility,'hidden');assert.equal(animations.length,0);
 resize();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(panel.style.visibility,'');assert.equal(animations[0].options.duration,380);
 assert(animations[0].frames.every(frame=>!('transform' in frame)));
 controller.show(false);assert.equal(animations[1].options.duration,160);
});

test('calculator types and erases tags over half a second without replaying unchanged tags',async()=>{
 const dom=new JSDOM('<div></div>'),list=dom.window.document.querySelector('div'),animations=[];
 dom.window.Element.prototype.animate=function(frames,options){let finish;const a={frames,options,finished:new Promise(resolve=>finish=resolve),finish:()=>finish(),cancel(){}};animations.push(a);return a;};
 const tags=createActionTagList(list,(_key,item)=>{const row=dom.window.document.createElement('div'),button=dom.window.document.createElement('button');button.textContent=item.text;row.append(button);return row;},'Пусто');
 tags.sync([['tag',{text:'Тест'}]]);assert.equal(list.textContent,'Тест');assert.equal(animations.length,4);
 assert.equal(animations[3].options.delay+animations[3].options.duration,500);assert.equal(animations[0].frames[0].opacity,0);
 tags.sync([['tag',{text:'Тест'}]]);assert.equal(animations.length,4);
 tags.sync([]);assert.equal(list.textContent,'Тест');assert.equal(animations.length,8);assert.equal(animations[4].frames[1].opacity,0);
 animations.slice(4).forEach(a=>a.finish());await new Promise(resolve=>setTimeout(resolve,0));assert.equal(list.textContent,'Пусто');
});

test('last tag finishes erasing before the original collapse animation starts',async()=>{
 const dom=new JSDOM('<aside hidden><div class="mt-scroll-body"></div></aside>'),panel=dom.window.document.querySelector('aside'),calls=[];
 panel.firstChild.animate=(_frames,options)=>{calls.push(options);return {cancel(){},finished:new Promise(()=>{})};};
 const controller=createActionPanel(panel,()=>{});controller.show(true);
 let erase;controller.show(false,false,new Promise(resolve=>erase=resolve));assert.equal(calls.length,1);assert.equal(panel.hidden,false);
 erase();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls.length,2);assert.equal(calls[1].duration,160);
});
