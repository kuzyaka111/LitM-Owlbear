import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createGMTool, openGM, pageUrl, watchGMTool } from '../src/bridge.js';
import { makeStore, clean } from '../src/storage.js';
import { mountUI } from '../src/ui.js';

const base = 'https://example.github.io/legend-in-the-mist-owlbear/background.html';
function mockOBR(role = 'PLAYER', ready = true) {
  const calls = []; let playerCallback, sceneCallback;
  const state = { role, ready };
  const obr = {
    player: { getRole: async () => state.role, onChange: cb => { playerCallback = cb; return () => {}; } },
    scene: { isReady: async () => state.ready, onReadyChange: cb => { sceneCallback = cb; return () => {}; } },
    tool: { create: async tool => calls.push(['create', tool]), remove: async id => calls.push(['remove', id]) },
    modal: { open: async modal => calls.push(['open', modal]), close: async id => calls.push(['close', id]) },
  };
  return { obr, state, calls, playerChanged: () => playerCallback(), sceneChanged: () => sceneCallback() };
}

test('GM tool has a role filter and clicking does not activate a map tool', () => {
  const m = mockOBR(); const tool = createGMTool(m.obr, base);
  assert.deepEqual(tool.icons[0].filter.roles, ['GM']);
  assert.equal(tool.onClick(), undefined);
});

test('player cannot open the GM modal even by invoking its handler', async () => {
  const m = mockOBR('PLAYER'); assert.equal(await openGM(m.obr, base), false); assert.deepEqual(m.calls, []);
});

test('GM opens a separate modal with a URL valid under a repository path', async () => {
  const m = mockOBR('GM'); assert.equal(await openGM(m.obr, base), true);
  assert.equal(m.calls[0][1].url, 'https://example.github.io/legend-in-the-mist-owlbear/gm.html');
  assert.equal(pageUrl('./gm.svg', base), 'https://example.github.io/legend-in-the-mist-owlbear/gm.svg');
});

test('GM tool follows scene and role changes without duplicate registration', async () => {
  const m = mockOBR('PLAYER', false); const c = watchGMTool(m.obr, base); await c.refresh(); assert.equal(m.calls.length, 0);
  m.state.role = 'GM'; await m.playerChanged(); assert.equal(m.calls.length, 0);
  m.state.ready = true; await m.sceneChanged(); await c.refresh(); assert.equal(m.calls.filter(x => x[0] === 'create').length, 1);
  m.state.role = 'PLAYER'; await m.playerChanged(); assert.equal(m.calls.filter(x => x[0] === 'remove').length, 1);
  assert.equal(m.calls.filter(x => x[0] === 'close').length, 1);
  await c.dispose();
});

test('no GM window can open without a scene', async () => {
  const m = mockOBR('GM', false); assert.equal(await openGM(m.obr, base), false); assert.equal(m.calls.length, 0);
});

function memoryStorage() { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }; }
test('local test data survives reopening and stays separate per player and room', () => {
  const storage = memoryStorage(); const a = makeStore(storage, { room: 'A', player: '1' }, 'sheet');
  const state = a.load(); state.name = 'Мой герой'; assert(a.save(state)); assert.equal(a.load().name, 'Мой герой');
  assert.notEqual(makeStore(storage, { room: 'A', player: '2' }, 'sheet').load().name, 'Мой герой');
  assert.notEqual(makeStore(storage, { room: 'B', player: '1' }, 'sheet').load().name, 'Мой герой');
});

test('blocked or malformed storage does not break the application', () => {
  const store = makeStore({ getItem: () => '{bad', setItem: () => { throw new Error('blocked'); } }, {}, 'sheet');
  assert.equal(store.load().bag.length, 3); assert.equal(store.save(store.load()), false);
  const state = clean({ bag: [null, '<img>', 8], marks: [-1, 0, 2.5, 24], selected: 'bad' }, 'sheet');
  assert.deepEqual(state.bag, ['<img>']); assert.deepEqual(state.marks, [0]); assert.deepEqual(state.selected, []);
});

function ui(view) {
  const dom = new JSDOM('<main id="mist-table-design"></main>'); const root = dom.window.document.querySelector('main');
  const store = makeStore(memoryStorage(), { room: 'A', player: '1' }, view);
  const template = fs.readFileSync(new URL(`../src/${view === 'sheet' ? 'sheet' : 'gm'}.html`, import.meta.url), 'utf8');
  mountUI(root, view, template, store, { close: async () => {}, openSheet: async () => {} });
  return { root, store, event: type => new dom.window.Event(type, { bubbles: true, cancelable: true }) };
}

test('sheet selection, tracks, notes and name changes persist', () => {
  const { root: r, store, event } = ui('sheet'); assert.equal(r.querySelectorAll('.mt-theme').length, 4);
  r.querySelector('[data-tag]').click(); assert.equal(store.load().selected.length, 1);
  r.querySelector('.mt-pip').click(); assert.equal(store.load().marks.length, 1);
  const notes = r.querySelector('#mt-notes-text'); notes.value = 'Запись'; notes.dispatchEvent(event('input')); assert.equal(store.load().notes, 'Запись');
  const name = r.querySelector('.mt-editor-name'); name.value = 'Лира'; name.dispatchEvent(event('input')); assert.equal(store.load().name, 'Лира');
  r.querySelector('.mt-clear').click(); assert.equal(store.load().selected.length, 0);
});

test('user text is rendered as text, not HTML', () => {
  const { root: r, event, store } = ui('sheet');
  r.querySelector('#mt-item-name').value = '<img src=x onerror=alert(1)>';
  r.querySelector('.mt-add-item').dispatchEvent(event('submit'));
  assert.equal(r.querySelectorAll('img').length, 0); assert(store.load().bag.includes('<img src=x onerror=alert(1)>'));
});

test('GM scene tags can be added and removed', () => {
  const { root: r, store, event } = ui('gm');
  r.querySelector('#mt-scene-name').value = 'Дождь'; r.querySelector('.mt-add-scene').dispatchEvent(event('submit')); assert(store.load().scene.includes('Дождь'));
  r.querySelector('[aria-label="Удалить тег Дождь"]').click(); assert(!store.load().scene.includes('Дождь'));
});

test('manifest uses only relative asset paths and a single player-sheet action', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(m.action.title, 'Лист персонажа'); assert.equal(m.manifest_version, 1);
  for (const file of [m.icon, m.background_url, m.action.icon, m.action.popover]) assert(file.startsWith('./'));
});
