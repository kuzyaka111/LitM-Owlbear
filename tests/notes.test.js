import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import {clean,makeStore} from '../src/storage.js';
import {continueList} from '../src/notes-model.js';
import {mountUI} from '../src/ui.js';
test('old notes migrate exactly once, empty/deleted cards do not resurrect',()=>{
 const raw={notes:'Первая строка\n- Пункт\n- Ещё'},data=clean(raw,'sheet');assert.equal(data.noteCards[0].sections[0].text,raw.notes);assert.deepEqual(clean(data,'sheet'),data);data.noteCards=[];assert.deepEqual(clean(data,'sheet').noteCards,[]);assert.equal(clean({notes:''},'sheet').noteCards[0].sections[0].text,'');
});
test('list Enter continues indentation, splits text and exits empty bullets',()=>{
 assert.deepEqual(continueList('- Пункт',7,7),{start:7,end:7,text:'\n- '});assert.deepEqual(continueList('  - Один',8,8),{start:8,end:8,text:'\n  - '});assert.deepEqual(continueList('- abcdef',5,5),{start:5,end:5,text:'\n- '});assert.deepEqual(continueList('- Один\n- ',9,9),{start:7,end:9,text:''});assert.equal(continueList('Обычный текст',13,13),null);assert.equal(continueList('a - b',5,5),null);
});
test('compendium opens and closes notes without loss; only confirmed deletion removes them',()=>{
 const memory=new Map(),store=makeStore({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},{room:'r',player:'p'},'sheet');const dom=new JSDOM('<main id="mist-table-design"></main>'),r=dom.window.document.querySelector('main'),state=mountUI(r,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{close:async()=>{}});
 const input=(node,value)=>{node.value=value;node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 assert(r.querySelector('.mt-notes-cards').firstElementChild.classList.contains('mt-notes-compendium'));r.querySelector('.mt-add-note').click();let card=r.querySelectorAll('.mt-notes-card')[1];input(card.querySelector('.mt-note-heading input'),'Север');input(card.querySelector('.mt-note-section-heading input'),'Места');card.querySelector('.mt-add-note-subsection').click();card=r.querySelectorAll('.mt-notes-card')[1];input(card.querySelector('.mt-note-subheading input'),'Мост');const area=card.querySelector('.mt-note-subsection textarea');input(area,'- Найти мост');area.setSelectionRange(area.value.length,area.value.length);area.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(area.value,'- Найти мост\n- ');
 const heading=card.querySelector('.mt-note-top-section');heading.open=false;heading.dispatchEvent(new dom.window.Event('toggle'));card.querySelector('.mt-note-close').click();assert.equal(r.querySelectorAll('.mt-notes-card').length,1);let saved=store.load().noteCards[1];assert.equal(saved.open,false);assert.equal(saved.sections[0].title,'Места');assert(saved.sections[0].collapsed);assert.equal(saved.sections[0].children[0].title,'Мост');assert.equal(saved.sections[0].children[0].text,area.value);
 r.querySelectorAll('.mt-open-note')[1].click();assert.equal(r.querySelectorAll('.mt-notes-card').length,2);assert.equal(r.querySelectorAll('.mt-notes-card')[1].tagName,'ARTICLE');
 r.querySelectorAll('.mt-note-index-row .mt-note-delete')[1].click();assert.equal(state.noteCards.length,2);r.querySelector('.mt-note-cancel').click();assert.equal(store.load().noteCards.length,2);r.querySelectorAll('.mt-note-index-row .mt-note-delete')[1].click();r.querySelector('.mt-confirm-delete-note').click();assert.equal(store.load().noteCards.length,1);assert.equal(r.querySelectorAll('.mt-open-note').length,1);assert.equal(r.querySelectorAll('.mt-notes-card').length,1);
});
test('previous notes preserve section titles and text while adding heading hierarchy',()=>{
 const v=clean({notes:'старый текст',noteCards:[{id:'old',title:'Название',collapsed:true,sections:[{id:'part',title:'Старый раздел',text:'Не потерять',collapsed:true}]}]},'sheet').noteCards[0];assert.equal(v.open,false);assert.equal(v.sections[0].text,'Не потерять');assert.equal(v.sections[0].title,'Старый раздел');assert(v.sections[0].collapsed);assert.deepEqual(v.sections[0].children,[]);
});
