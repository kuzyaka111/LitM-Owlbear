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

test('four tabs retain notes and support keyboard navigation', () => {
  const { root: r, event, store, dom } = ui();
  assert.deepEqual([...r.querySelectorAll('[role=tab]')].map(x => x.textContent), ['Персонаж', 'Братство', 'Рюкзак', 'Заметки']);
  assert(!r.querySelector('#panel-character').hidden); assert(r.querySelector('#panel-notes').hidden);
  r.querySelector('#tab-notes').click(); const notes = r.querySelector('#mt-notes-text'); notes.value = 'Не удалять'; notes.dispatchEvent(event('input'));
  r.querySelector('#tab-bag').click(); r.querySelector('#tab-notes').click(); assert.equal(notes.value, 'Не удалять'); assert.equal(store.load().notes, 'Не удалять');
  r.querySelector('#tab-notes').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(r.querySelector('#tab-character').getAttribute('aria-selected'), 'true'); assert.equal(r.querySelectorAll('[role=tab][tabindex="0"]').length, 1);
});

test('both card types can be edited, removed, undone and reopened', () => {
  const { root: r, event, store } = ui(); r.querySelector('#tab-bag').click();
  r.querySelector('.mt-add-backpack').click(); r.querySelector('.mt-add-theme').click(); assert.equal(store.load().cards.length, 3);
  const card = r.querySelector('.mt-bag-cards').lastElementChild, title = card.querySelector('.mt-card-title textarea');
  title.value = 'Верный спутник'; title.dispatchEvent(event('input'));
  const input = card.querySelector('.mt-add-card-item input'); input.value = 'Чуткий слух'; card.querySelector('form').dispatchEvent(event('submit'));
  card.querySelector('[data-tag="Чуткий слух"]').click(); assert(r.querySelector('.mt-selected-text').textContent.includes('Чуткий слух'));
  card.querySelector('.mt-track button').click(); assert.equal(store.load().cards.at(-1).improve, 1);
  card.querySelector('.mt-theme-head button').click(); assert.equal(store.load().cards.length, 2); assert(!r.querySelector('.mt-selected-text').textContent.includes('Чуткий слух'));
  r.querySelector('.mt-undo button').click(); assert.equal(store.load().cards.length, 3); assert.equal(store.load().cards.at(-1).title, 'Верный спутник'); assert(r.querySelector('.mt-selected-text').textContent.includes('Чуткий слух'));
  const reopened = ui(store); assert.equal(reopened.root.querySelectorAll('.mt-inventory-card').length, 3);
  assert.equal(reopened.store.load().cards.at(-1).items[0].text, 'Чуткий слух');
});

test('card item identity keeps identical names on different cards independent', () => {
  const store = makeStore(storage(), {}, 'sheet'), data = store.load(); const card = newCard('bag');
  card.items = [{ id: 'rope', text: 'Верёвка' }]; data.cards.push(card); store.save(data);
  const { root: r } = ui(store); const ropes = r.querySelectorAll('[data-tag="Верёвка"]'); assert.equal(ropes.length, 2);
  ropes[0].click(); assert.equal(ropes[1].getAttribute('aria-pressed'), 'false');
});

test('character card saves relationships, player, promise and quintessences', () => {
  const { root: r, store, event } = ui();
  r.querySelector('.mt-add-relationship').click(); const inputs = r.querySelectorAll('.mt-relationship input');
  inputs[0].value = 'Элла'; inputs[0].dispatchEvent(event('input')); inputs[1].value = 'Доверие'; inputs[1].dispatchEvent(event('input'));
  r.querySelectorAll('.mt-promise button')[3].click(); assert.equal(store.load().promise, 4);
  const p = r.querySelector('#mt-player-name'); p.value = 'Кузя'; p.dispatchEvent(event('input'));
  assert.equal(store.load().playerName, 'Кузя'); assert.equal(store.load().relationships[0].tag, 'Доверие');
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

test('fellowship editor retains unsaved fields during remote updates and after a failed save', async () => {
  const room = sharedRoom(), a = makeFellowshipStore(room), b = makeFellowshipStore(room);
  const { root: r, event } = ui(undefined, a); await b.start(); await settle();
  const form = r.querySelector('.mt-fellowship-form'), name = form.querySelector('input'); name.value = 'Мой черновик'; name.dispatchEvent(event('input'));
  await b.update({ name: 'Имя другого игрока', quest: 'Общая цель' }); assert.equal(name.value, 'Мой черновик');
  room.fail(true); form.dispatchEvent(event('submit')); await settle(); assert.equal(name.value, 'Мой черновик'); assert(r.querySelector('.mt-fellowship-status').classList.contains('mt-error'));
  room.fail(false); form.dispatchEvent(event('submit')); await settle();
  assert.equal((await room.getMetadata())[FELLOWSHIP_PREFIX + 'name'], 'Мой черновик'); assert.equal((await room.getMetadata())[FELLOWSHIP_PREFIX + 'quest'], 'Общая цель');
  assert.equal(r.querySelector('.mt-fellowship-form button').disabled, true); a.dispose(); b.dispose();
});

test('new local card text and shared fellowship text cannot inject HTML', async () => {
  const room = sharedRoom({ [FELLOWSHIP_PREFIX + 'name']: '<img src=x onerror=alert(1)>' }), service = makeFellowshipStore(room);
  const { root: r, event } = ui(undefined, service); await settle();
  const title = r.querySelector('.mt-card-title textarea'); title.value = '<img src=x>'; title.dispatchEvent(event('input'));
  assert.equal(r.querySelectorAll('img').length, 0); assert(r.querySelector('.mt-fellowship-card h3').textContent.includes('<img')); service.dispose();
});
