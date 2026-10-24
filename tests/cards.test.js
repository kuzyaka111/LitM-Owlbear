import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { makeStore, clean, newCard } from '../src/storage.js';
import { mountUI } from '../src/ui.js';
import { makeFellowshipStore, FELLOWSHIP_PREFIX } from '../src/fellowship.js';

function storage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; }
const template = fs.readFileSync(new URL('../src/sheet.html', import.meta.url), 'utf8');
function ui(store = makeStore(storage(), { room: 'room', player: '1' }, 'sheet'), fellowship) {
  const dom = new JSDOM('<main></main>'), root = dom.window.document.querySelector('main');
  const state = mountUI(root, 'sheet', template, store, { close: async () => {}, fellowship });
  return { root, state, store, event: type => new dom.window.Event(type, { bubbles: true, cancelable: true }), dom };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function sharedRoom(initial = {}) {
  let metadata = { ...initial }; const listeners = new Set(); let failure = false;
  return {
    async getMetadata() { return structuredClone(metadata); },
    async setMetadata(patch) { if (failure) throw new Error('Не удалось сохранить'); Object.assign(metadata, structuredClone(patch)); listeners.forEach(fn => fn(structuredClone(metadata))); },
    onMetadataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    fail(value) { failure = value; }, listenerCount: () => listeners.size,
  };
}

test('v1 migration preserves name, notes, marks, selected inventory and all old items', () => {
  const s = storage(), key = 'legend-mist-prototype:v1:' + JSON.stringify(['room', '1', 'sheet']);
  const legacy = { name: 'Алисия', notes: 'Мои старые заметки\nВторая строка', bag: ['Кольцо', 'Верёвка'], marks: [0, 7], selected: ['Кольцо', 'Чуткий сон'] };
  s.setItem(key, JSON.stringify(legacy)); const store = makeStore(s, { room: 'room', player: '1' }, 'sheet'); const migrated = store.load();
  assert.equal(migrated.notes, legacy.notes); assert.equal(migrated.name, legacy.name); assert.deepEqual(migrated.marks, legacy.marks);
  assert.deepEqual(migrated.cards[0].items.map(x => x.text), legacy.bag);
  assert(migrated.selected.includes('card:original-backpack:item-0')); store.save(migrated);
  assert.deepEqual(store.load(), migrated);
  assert.equal(clean({ bag: [], notes: '' }, 'sheet').cards[0].items.length, 0);
  assert.equal(clean({ cards: [], notes: '' }, 'sheet').cards.length, 0);
});

test('three tabs preserve notes and support keyboard navigation', () => {
  const {root:r,event,store,dom}=ui();
  assert.deepEqual([...r.querySelectorAll('[role=tab]')].map(x=>x.textContent),['Персонаж и Братство','Темы','Заметки']);
  r.querySelector('#tab-notes').click();const notes=r.querySelector('#mt-notes-text');notes.value='Не удалять';notes.dispatchEvent(event('input'));
  r.querySelector('#tab-themes').click();r.querySelector('#tab-notes').click();assert.equal(store.load().notes,'Не удалять');
  r.querySelector('#tab-notes').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(r.querySelector('#tab-party').getAttribute('aria-selected'),'true');
});

test('every theme has all Might choices, fixed slots and editable questions', async () => {
  const {root:r,event,store}=ui();r.querySelector('.mt-add-theme').click();
  for(const card of r.querySelectorAll('.mt-theme-card')){
    assert.equal(card.querySelectorAll('[data-kind=power]').length,7);assert.equal(card.querySelectorAll('[data-kind=weakness]').length,3);
    assert.deepEqual([...card.querySelector('.mt-might').options].map(o=>o.value),['origin','adventure','greatness']);
  }
  let c=r.querySelector('.mt-hero-theme');let select=c.querySelector('.mt-might');select.value='greatness';select.dispatchEvent(event('change'));await settle();assert.equal(store.load().heroThemes[0].might,'greatness');
  c=r.querySelector('.mt-hero-theme');c.querySelector('.mt-question').click();assert.equal(r.querySelectorAll('.mt-question-option').length,10);r.querySelectorAll('.mt-question-option')[9].click();await settle();assert.equal(store.load().heroThemes[0].power[0].q,'J');
});

test('tags edit, scratch, select weakness and track milestones with persistence', async () => {
  const {root:r,event,store,dom}=ui();let c=r.querySelector('.mt-hero-theme');
  c.querySelector('[data-kind=weakness] .mt-tag-text').click();assert.equal(r.querySelectorAll('.mt-action-list[data-kind=weakness] .mt-action-tag').length,1);
  c.querySelector('[data-kind=weakness] .mt-scratch').click();await settle();assert.equal(store.load().heroThemes[0].weakness[0].scratched,true);assert.equal(store.load().selected.length,0);
  c=r.querySelector('.mt-hero-theme');c.querySelector('.mt-tag-text').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));r.querySelector('.mt-inline-editor').value='Новое имя';r.querySelector('.mt-inline-editor').dispatchEvent(event('blur'));await settle();assert.equal(store.load().heroThemes[0].power[0].text,'Новое имя');
  r.querySelector('.mt-hero-theme [aria-label="Вехи 2"]').click();await settle();assert.equal(store.load().heroThemes[0].milestone,2);
});

test('extra cards delete permanently without restore controls', async () => {
 const {root:r,store}=ui();r.querySelector('.mt-add-backpack').click();r.querySelector('.mt-add-theme').click();assert.equal(store.load().cards.length,3);
 r.querySelector('.mt-inventory-host .mt-delete-card').click();assert.equal(store.load().cards.length,2);assert.equal(r.querySelector('.mt-undo'),null);assert.equal(ui(store).root.querySelectorAll('.mt-inventory-host .mt-card-slot').length,2);
});

test('two clients share fellowship across scene-independent room metadata and preserve unrelated keys', async () => {
  const room = sharedRoom({ 'other.extension/settings': { enabled: true } });
  const a = makeFellowshipStore(room), b = makeFellowshipStore(room); let observed;
  b.subscribe((state, ready) => { if (ready) observed = state; }); await Promise.all([a.start(), b.start()]);
  await Promise.all([a.update({ name: 'Путники' }), b.update({ quest: 'Вернуться домой' })]);
  assert.equal(observed.name, 'Путники'); assert.equal(observed.quest, 'Вернуться домой');
  await a.update({ power1: 'Друг за друга' }); await b.update({ spent1: true }); assert.equal(observed.spent1, true);
  const metadata = await room.getMetadata(); assert.deepEqual(metadata['other.extension/settings'], { enabled: true });
  const fresh = makeFellowshipStore(room); let reopened; fresh.subscribe(s => { reopened = s; }); await fresh.start(); assert.equal(reopened.power1, 'Друг за друга');
  a.dispose(); b.dispose(); fresh.dispose(); assert.equal(room.listenerCount(), 0);
});

test('fellowship does not let a slow initial read replace a newer subscription update', async () => {
  let receive, resolve; const room = { onMetadataChange(fn) { receive = fn; return () => {}; }, getMetadata() { return new Promise(r => { resolve = r; }); } };
  const client = makeFellowshipStore(room); let observed; client.subscribe(s => { observed = s; }); const pending = client.start();
  receive({ [FELLOWSHIP_PREFIX + 'name']: 'Новое' }); resolve({ [FELLOWSHIP_PREFIX + 'name']: 'Старое' }); await pending;
  assert.equal(observed.name, 'Новое'); client.dispose();
});

test('metadata size and failed writes report failure without changing shared data', async () => {
  const room = sharedRoom({ unrelated: 'x'.repeat(15900) }), client = makeFellowshipStore(room); await client.start();
  await assert.rejects(client.update({ quest: 'Я'.repeat(400) }), /недостаточно места/);
  assert.equal((await room.getMetadata())[FELLOWSHIP_PREFIX + 'quest'], undefined);
  room.fail(true); await assert.rejects(client.update({ name: 'X' }), /Не удалось сохранить/); client.dispose();
});

test('shared editor retains draft through remote updates and failed writes', async () => {
 const room=sharedRoom(),a=makeFellowshipStore(room),b=makeFellowshipStore(room);const {root:r,event,dom}=ui(undefined,a);await b.start();await settle();
 r.querySelector('.mt-fellowship-host .mt-tag-text').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));const input=r.querySelector('.mt-inline-editor');input.value='Мой черновик';
 await b.update({name:'Другое имя',quest:'Общая цель',might:'greatness',power6:'Шестой',weakness2:'Третья',question6:'J'});assert.equal(input.value,'Мой черновик');
 room.fail(true);input.dispatchEvent(event('blur'));await settle();assert.equal(input.value,'Мой черновик');assert.equal(input.getAttribute('aria-invalid'),'true');
 room.fail(false);input.dispatchEvent(event('blur'));await settle();const m=await room.getMetadata();assert.equal(m[FELLOWSHIP_PREFIX+'name'],'Мой черновик');assert.equal(m[FELLOWSHIP_PREFIX+'quest'],'Общая цель');assert.equal(m[FELLOWSHIP_PREFIX+'power6'],'Шестой');assert.equal(m[FELLOWSHIP_PREFIX+'question6'],'J');a.dispose();b.dispose();
});

test('shared text is not executable HTML', async () => {
 const room=sharedRoom({[FELLOWSHIP_PREFIX+'name']:'<img src=x onerror=alert(1)>'}),service=makeFellowshipStore(room);const {root:r}=ui(undefined,service);await settle();assert.equal(r.querySelectorAll('img').length,0);assert(r.querySelector('.mt-fellowship-host').textContent.includes('<img'));service.dispose();
});

test('changing themebook preserves chosen Might without restore controls',async()=>{
 const {root:r,event,store}=ui();const get=()=>r.querySelector('.mt-hero-theme');let might=get().querySelector('.mt-might');might.value='greatness';might.dispatchEvent(event('change'));await settle();
 const before=store.load().heroThemes[0];get().querySelector('.mt-book-picker').click();r.querySelector('dialog select').value='skill';r.querySelector('dialog form').dispatchEvent(event('submit'));await settle();assert.equal(store.load().heroThemes[0].might,'greatness');assert.deepEqual(store.load().heroThemes[0].power,before.power);
 assert.equal(get().querySelector('.mt-undo-theme'),null);
});

test('manual action tags can be cleared without accumulating hidden entries',()=>{
 const {root:r,event,store}=ui();const form=r.querySelector('.mt-add-action-tag');form.querySelector('input').value='Дождь';form.dispatchEvent(event('submit'));assert.equal(store.load().actionExtras.power.length,1);r.querySelector('.mt-clear').click();assert.equal(store.load().actionExtras.power.length,0);
});

test('story themes lock type, edit on double click and preserve custom improvements',async()=>{
 const {root:r,event,store,dom}=ui();r.querySelector('.mt-add-theme').click();const card=()=>r.querySelector('.mt-inventory-host .mt-theme-card');
 assert.equal(card().querySelector('.mt-story-type').textContent,'Сюжетная тема');assert.equal(card().querySelector('.mt-book-picker'),null);assert.equal(card().querySelector('.mt-question'),null);
 const title=card().querySelector('.mt-tag-text');title.click();assert.equal(r.querySelector('dialog'),null);title.dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));assert.equal(r.querySelector('dialog'),null);assert(r.querySelector('.mt-inline-editor'));r.querySelector('.mt-inline-editor').value='Путь домой';r.querySelector('.mt-inline-editor').dispatchEvent(event('blur'));await settle();
 assert.equal(card().querySelectorAll('.mt-improvement-row').length,5);card().querySelector('.mt-improvement-title').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true}));r.querySelector('.mt-inline-editor').value='Дар леса';r.querySelector('.mt-inline-editor').dispatchEvent(event('blur'));await settle();card().querySelector('.mt-improvement-toggle').click();await settle();
 const t=store.load().cards.at(-1).theme;assert.equal(t.bookId,'story');assert.deepEqual(t.storyImprovements[0],{text:'Дар леса',active:true});assert.equal(t.power[0].text,'Путь домой');assert.equal(r.textContent.includes('✎'),false);
});
test('book improvements and quintessences are prefilled inactive rows that toggle and persist',async()=>{
 const {root:r,store}=ui();const card=()=>r.querySelector('.mt-hero-theme');assert.equal(card().querySelectorAll('.mt-improvement-row').length,5);assert.equal(card().querySelectorAll('.mt-inactive-improvement').length,5);
 card().querySelector('.mt-improvement-toggle').click();await settle();assert.equal(store.load().heroThemes[0].improvements.length,1);assert.equal(card().querySelector('.mt-improvement-toggle').textContent,'◆');card().querySelector('.mt-improvement-toggle').click();await settle();assert.equal(store.load().heroThemes[0].improvements.length,0);
 assert.equal(r.querySelectorAll('.mt-quintessences .mt-improvement-row').length,18);r.querySelector('.mt-quintessences .mt-improvement-toggle').click();assert.equal(store.load().quintessenceIds.length,1);
});

test('selection panel hides when empty and after the final tag is scratched or cleared',async()=>{
 const {root:r,store}=ui(),panel=r.querySelector('.mt-action-card');assert(panel.hidden);
 r.querySelector('.mt-hero-theme .mt-tag-text').click();assert(!panel.hidden);assert(r.querySelector('.mt-stage').classList.contains('mt-with-selection'));
 r.querySelector('.mt-hero-theme .mt-scratch').click();await settle();assert(panel.hidden);assert.equal(store.load().selected.length,0);
 r.querySelectorAll('.mt-hero-theme')[1].querySelector('.mt-tag-text').click();assert(!panel.hidden);r.querySelector('.mt-clear').click();assert(panel.hidden);assert(!r.querySelector('.mt-stage').classList.contains('mt-with-selection'));
});
