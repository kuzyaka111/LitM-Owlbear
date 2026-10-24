import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeStore} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
import {newStatus,cleanStatuses,flipStatus} from '../src/status-model.js';
import {createScrollMotion} from '../src/scroll-motion.js';
import {createActionTagList} from '../src/action-panel.js';
const template=fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8');
function ui(){const data=new Map(),store=makeStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},{room:'r',player:'p'},'sheet'),dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');mountUI(root,'sheet',template,store,{close:async()=>{}});return {dom,root,store};}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

test('animation settings open a separate card and master controls disable subordinate switches',()=>{
 const {root,store}=ui();root.querySelector('#tab-settings').click();const open=root.querySelector('.mt-open-animation-settings');open.click();open.click();
 assert.equal(root.querySelectorAll('.mt-animation-settings').length,1);assert.equal(store.load().settings.scrollAnimation,true);
 const sway=root.querySelector('[data-animation-option=disableSway]');sway.click();assert.equal(store.load().settings.disableSway,true);assert.equal(root.querySelector('.mt-v4').dataset.swayAnimation,'off');assert.equal(root.querySelector('.mt-v4').dataset.entranceAnimation,'on');
 root.querySelector('.mt-animation-disable-all').click();assert.equal(root.querySelector('.mt-v4').dataset.textAnimation,'off');assert([...root.querySelectorAll('.mt-animation-option')].every(b=>b.disabled&&b.classList.contains('mt-setting-disabled')));
 root.querySelector('.mt-animation-enable-all').click();assert.equal(store.load().settings.disableSway,false);assert([...root.querySelectorAll('.mt-animation-option')].every(b=>!b.disabled));
 root.querySelector('[aria-label="Закрыть настройки анимаций"]').click();assert.equal(open.getAttribute('aria-expanded'),'false');
});

test('statuses start empty and numeric marks and names persist independently',async()=>{
 const {root,store,dom}=ui();root.querySelector('#tab-statuses').click();assert.equal(root.querySelectorAll('.mt-status-scroll').length,0);
 root.querySelector('[data-add-status=numeric]').click();const input=root.querySelector('.mt-status-name');input.value='Ранен';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 root.querySelector('[aria-label="Отметка 2"]').click();root.querySelector('[aria-label="Отметка 5"]').click();
 assert.equal(store.load().statusCards[0].name,'Ранен');assert.deepEqual(store.load().statusCards[0].marks,[false,true,false,false,true,false]);assert.equal(root.querySelectorAll('.mt-status-mark').length,6);
 root.querySelector('[data-add-status=status]').click();root.querySelector('[data-add-status=story]').click();await settle();assert.equal(root.querySelectorAll('.mt-status-scroll').length,3);assert.equal(root.querySelector('[data-status-kind=status] .mt-status-marks'),null);
 root.querySelector('[aria-label="Зачеркнуть сюжетный тег"]').click();assert.equal(store.load().statusCards[2].scratched,true);assert.deepEqual(store.load().selected,[]);assert(root.querySelector('.mt-action-card').hidden);
});

test('double pressing the header flips and clears a numeric status, then restores its numeric format',async()=>{
 const {root,store,dom}=ui();root.querySelector('#tab-statuses').click();root.querySelector('[data-add-status=numeric]').click();let input=root.querySelector('.mt-status-name');input.value='Старое';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));root.querySelector('[aria-label="Отметка 3"]').click();
 root.querySelector('.mt-status-scroll .mt-scroll-top').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));await settle();
 assert.equal(store.load().statusCards[0].kind,'story');assert.equal(store.load().statusCards[0].name,'');assert(store.load().statusCards[0].marks.every(v=>!v));assert.equal(root.querySelector('.mt-status-kind').textContent,'Сюжетный тег');
 root.querySelector('.mt-status-scroll .mt-scroll-top').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));await settle();assert.equal(store.load().statusCards[0].kind,'numeric');assert.equal(root.querySelectorAll('.mt-status-mark').length,6);
});

test('status normalization rejects invalid data and preserves unique identifiers',()=>{
 const cards=cleanStatuses([{id:'same',kind:'numeric',name:'x',marks:[true,'true',1]},{id:'same',kind:'oops',scratched:true},null]);assert.notEqual(cards[0].id,cards[1].id);assert.deepEqual(cards[0].marks,[true,false,false,false,false,false]);assert.equal(cards[1].kind,'status');assert.equal(cards[1].scratched,false);
 const item=newStatus('status');item.name='text';flipStatus(item);assert.equal(item.kind,'story');assert.equal(item.name,'');
});

test('sway and entrance switches control separate animation phases',()=>{
 for(const [disabled,expectPaper,expectRotation] of [['sway',true,false],['entrance',false,true]]){
  const dom=new JSDOM(`<main><section class="mt-v4" data-${disabled}-animation="off"><div class="mt-card-row"><article class="mt-scroll-frame"><div class="mt-scroll-body"></div></article></div></section></main>`),root=dom.window.document.querySelector('main'),card=root.querySelector('article'),body=card.firstChild,calls=[];
  card.getBoundingClientRect=()=>({width:224,right:224});body.getBoundingClientRect=()=>({height:481});
  for(const node of [card,body])node.animate=(frames)=>{calls.push({node,frames});return {cancel(){},finished:new Promise(()=>{})};};
  createScrollMotion(root).play(root.querySelector('section'));assert.equal(calls.some(c=>c.node===body),expectPaper);assert.equal(calls[0].frames.some(f=>/rotate\((?!0deg)/.test(f.transform)),expectRotation);
  if(disabled==='entrance')assert(calls[0].frames.every(f=>f.opacity===1));
 }
});

test('disabled text animation writes calculator tags immediately',()=>{
 const dom=new JSDOM('<main data-text-animation="off"><div></div></main>'),list=dom.window.document.querySelector('div');dom.window.Element.prototype.animate=()=>{throw Error('Text animation must be disabled');};
 const tags=createActionTagList(list,(_key,item)=>{const row=dom.window.document.createElement('div'),b=dom.window.document.createElement('button');b.textContent=item.text;row.append(b);return row;},'Пусто');
 tags.sync([['tag',{text:'Следопыт'}]]);assert.equal(list.textContent,'Следопыт');tags.sync([]);assert.equal(list.textContent,'Пусто');
});
