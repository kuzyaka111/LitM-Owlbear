import test from 'node:test';
import assert from 'node:assert/strict';
import { openSheet, watchSheetAction, SHEET_POPOVER_ID } from '../src/bridge.js';
const viewport={getWidth:async()=>1280,getHeight:async()=>900};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('sheet opens a compact transparent popover below toolbar from the project path', async () => {
  let result;
  await openSheet({ viewport, popover: { open: async args => { result = args; } } }, 'https://example.github.io/LitM-Owlbear/index.html');
  assert.deepEqual(result, { id: SHEET_POPOVER_ID, url: 'https://example.github.io/LitM-Owlbear/index.html?surface=sheet', width:964,height:650,anchorReference:'POSITION',anchorPosition:{left:16,top:96},anchorOrigin:{horizontal:'LEFT',vertical:'TOP'},transformOrigin:{horizontal:'LEFT',vertical:'TOP'},marginThreshold:0,hidePaper:true,disableClickAway:true });
});

test('extension button opens sheet once, closes launcher and supports reopening', async () => {
  let callback, calls = 0, closed = 0, disconnected = 0, release;
  const obr = { viewport, popover: { open: () => { ++calls; return new Promise(resolve => { release = resolve; }); } }, action: {
    isOpen: async () => true,
    onOpenChange: fn => { callback = fn; return () => { ++disconnected; }; },
    close: async () => { ++closed; callback(false); },
  } };
  const controller = watchSheetAction(obr, 'https://example.org/ext/index.html'); await tick(); callback(true); assert.equal(calls, 1);
  release(); await tick(); assert.equal(closed, 1);
  callback(true); await tick(); assert.equal(calls, 2); release(); await tick(); assert.equal(closed, 2);
  controller.dispose(); assert.equal(disconnected, 1); callback(true); await tick(); assert.equal(calls, 2);
});

test('failed sheet open leaves action available and reports the failure', async () => {
  let error, closed = 0;
  const controller = watchSheetAction({ viewport, popover: { open: async () => { throw new Error('Connection lost'); } }, action: {
    isOpen: async () => true, onOpenChange: () => () => {}, close: async () => { ++closed; },
  } }, 'https://example.org/ext/index.html', e => { error = e; });
  await tick(); assert.equal(error.message, 'Connection lost'); assert.equal(closed, 0); controller.dispose();
});
