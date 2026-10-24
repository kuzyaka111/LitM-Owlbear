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
test('note cards and sections save names, text, fold state, list edits and deletion',async()=>{
 const memory=new Map(),store=makeStore({getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},{room:'r',player:'p'},'sheet');const dom=new JSDOM('<main id="mist-table-design"></main>'),r=dom.window.document.querySelector('main'),state=mountUI(r,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{close:async()=>{}});
 const input=(node,value)=>{node.value=value;node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};r.querySelector('.mt-add-note').click();let card=r.querySelectorAll('.mt-notes-card')[1];input(card.querySelector('.mt-note-heading input'),'Север');card.querySelector('.mt-add-note-section').click();card=r.querySelectorAll('.mt-notes-card')[1];input(card.querySelectorAll('.mt-note-subheading input')[1],'Задачи');const area=card.querySelectorAll('textarea')[1];input(area,'- Найти мост');area.setSelectionRange(area.value.length,area.value.length);area.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(area.value,'- Найти мост\n- ');area.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(area.value,'- Найти мост\n');
 card.open=false;card.dispatchEvent(new dom.window.Event('toggle'));let saved=store.load().noteCards[1];assert.equal(saved.title,'Север');assert.equal(saved.sections[1].title,'Задачи');assert.equal(saved.sections[1].text,area.value);assert(saved.collapsed);
 card.querySelector('.mt-note-heading .mt-note-delete').click();assert.equal(store.load().noteCards.length,1);assert.equal(state.noteCards.length,1);
});
