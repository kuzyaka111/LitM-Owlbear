import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
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
