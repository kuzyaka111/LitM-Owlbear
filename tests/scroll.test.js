import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createScrollMotion} from '../src/scroll-motion.js';
import {dressScroll} from '../src/scroll-view.js';

test('scroll keeps live fields, toggles accessible improvements and restores expanded state',()=>{
 const dom=new JSDOM('<article><header class="mt-theme-head">Тема</header><input value="Тег"><div class="mt-improvements"><button>◇</button></div></article>');
 const card=dom.window.document.querySelector('article'),input=card.querySelector('input'),changes=[];
 dressScroll(card,{onExpand:value=>changes.push(value)});
 const toggle=card.querySelector('.mt-scroll-toggle'),extra=card.querySelector('.mt-scroll-extension');
 assert.equal(card.querySelector('.mt-scroll-main input'),input);
 assert.equal(extra.inert,true);assert.equal(extra.getAttribute('aria-hidden'),'true');
 toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(extra.inert,false);
 toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(extra.inert,true);
 assert.deepEqual(changes,[true,false]);assert.equal(card.querySelectorAll('.mt-scroll-top').length,1);
 dressScroll(card);assert.equal(card.querySelectorAll('.mt-scroll-top').length,1);
 const copy=dom.window.document.createElement('article');copy.innerHTML='<div class="mt-improvements">Развитие</div>';
 dressScroll(copy,{expanded:true});assert.equal(copy.querySelector('.mt-scroll-toggle').getAttribute('aria-expanded'),'true');assert.equal(copy.querySelector('.mt-scroll-extension').inert,false);
});

test('plain cards have no expansion control',()=>{
 const dom=new JSDOM('<article><textarea>Заметка</textarea></article>');
 const card=dressScroll(dom.window.document.querySelector('article'));
 assert.equal(card.querySelector('.mt-scroll-toggle'),null);
 assert.equal(card.querySelector('.mt-scroll-main textarea').value,'Заметка');
});


test('entrance installs initial keyframes synchronously and measures after stop',()=>{
 const dom=new JSDOM('<main><section><div class="mt-card-row"><article class="mt-scroll-frame"><div class="mt-scroll-body"></div></article></div></section></main>');
 const root=dom.window.document.querySelector('main'),card=root.querySelector('article'),body=card.firstElementChild,calls=[];
 card.getBoundingClientRect=()=>({width:224,left:0,right:224});body.getBoundingClientRect=()=>({height:483});
 for(const node of [card,body])node.animate=(frames,options)=>{calls.push({node,frames,options});return {cancel(){},finished:new Promise(()=>{})};};
 createScrollMotion(root).play(root.querySelector('section'));
 assert.equal(calls.length,2);assert.equal(calls[0].frames[0].opacity,0);assert.equal(calls[1].frames[0].height,'0px');assert.equal(calls[0].options.fill,'both');
});

test('long rows preserve spacing: every card shares one translation and no entry delay',()=>{
 const dom=new JSDOM('<main><section><div class="mt-card-row">'+Array.from({length:7},()=>'<article class="mt-scroll-frame"><div class="mt-scroll-body"></div></article>').join('')+'</div></section></main>');
 const root=dom.window.document.querySelector('main'),cards=[...root.querySelectorAll('article')],moves=[];let started=false;
 cards.forEach((card,i)=>{
  card.getBoundingClientRect=()=>{assert.equal(started,false);return {width:224,left:i*236,right:i*236+224}};
  card.firstElementChild.getBoundingClientRect=()=>{assert.equal(started,false);return {height:481}};
  card.animate=(frames,options)=>{started=true;moves.push({frames,options});return {cancel(){},finished:new Promise(()=>{})};};
  card.firstElementChild.animate=()=>({cancel(){},finished:new Promise(()=>{})});
 });
 createScrollMotion(root).play(root.querySelector('section'));
 assert.equal(moves.length,7);for(const move of moves)assert.deepEqual(move,moves[0]);
 assert.equal(moves[0].options.delay,undefined);assert(moves[0].frames[0].transform.includes('translate3d(-'));assert(moves[0].frames.slice(1).every(f=>f.transform.startsWith('translate3d(0,0,0)')));assert(moves[0].frames.some(f=>f.transform.includes('rotate(.35deg)')));
});


test('only a press and click on the dialog backdrop close the extra window',async()=>{
 const {editorTools}=await import('../src/editor-ui.js');
 const dom=new JSDOM('<main><section class="sheet"></section></main>'),root=dom.window.document.querySelector('main');
 const d=editorTools(root).dialog('Темник',()=>{});d.getBoundingClientRect=()=>({left:100,right:400,top:100,bottom:400});
 const emit=(type,x,y)=>d.dispatchEvent(new dom.window.MouseEvent(type,{clientX:x,clientY:y,bubbles:true}));
 emit('pointerdown',120,120);emit('click',120,120);assert(d.isConnected);
 emit('pointerdown',120,120);emit('click',10,10);assert(d.isConnected);
 emit('pointerdown',10,10);emit('click',10,10);assert(!d.isConnected);assert(root.querySelector('.sheet'));
});

test('tear effect animates only a new scratch, never restore or an unchanged rerender',async()=>{
 const {createScratchEffects}=await import('../src/scratch-effects.js');
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 const draw=scratched=>{root.innerHTML='<div class="mt-tag-row '+(scratched?'mt-scratched':'')+'"><button class="mt-tag-text" data-key="tag-1">Тег</button></div>';};
 draw(true);const effects=createScratchEffects(root);assert(!root.querySelector('.mt-scratch-reveal'));
 draw(false);effects.refresh();assert(!root.querySelector('.mt-scratch-reveal'));
 draw(true);effects.refresh();assert(root.querySelector('.mt-scratch-reveal'));
 draw(true);effects.refresh();assert(!root.querySelector('.mt-scratch-reveal'));
 draw(false);effects.refresh();draw(true);effects.refresh();assert(root.querySelector('.mt-scratch-reveal'));effects.dispose();
});
