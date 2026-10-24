import OBR from '@owlbear-rodeo/sdk';
import { createIcons, Feather, X, UserRound, Sprout, BookOpen, ArrowUpRight } from 'lucide';
import './style.css';
import './fog.css';
import './scrolls.css';
import './fonts/fonts.css';
import './typography.css';
import './scratch-effects.css';
import './dice.css';
import rollImage from './scroll-roll.svg';
import paperImage from './parchment.svg';
import brownRoll from './scroll-roll-brown.svg';
import adventureRoll from './scroll-roll-adventure.svg';
import greatnessRoll from './scroll-roll-greatness.svg';
const scrollAssetsReady=Promise.all([rollImage,paperImage,brownRoll,adventureRoll,greatnessRoll].map(src=>{const image=new Image();image.src=src;return image.decode().catch(()=>{});}));
import sheetTemplate from './sheet.html?raw';
import gmTemplate from './gm.html?raw';
import { MODAL_ID, SHEET_POPOVER_ID, sheetBounds, openSheet, watchSheetAction } from './bridge.js';
import { makeStore } from './storage.js';
import { mountUI } from './ui.js';
import { makeFellowshipStore, makePreviewFellowship } from './fellowship.js';

const root = document.getElementById('mist-table-design');
const view = document.body.dataset.view;
let generation = 0;
let renderedRole;

function message(text) {
  const p = document.createElement('p'); p.className = 'mt-loading'; p.setAttribute('role', 'status'); p.textContent = text; root.replaceChildren(p);
}

async function start(inOwlbear) {
  const thisGeneration = ++generation;
  const role = inOwlbear ? await OBR.player.getRole() : 'PREVIEW';
  if(view==='sheet')await Promise.all([scrollAssetsReady,document.fonts.load('400 15px "Bad Script"'),document.fonts.load('500 13px "Alegreya SC"')]);
  if (thisGeneration !== generation) return;
  renderedRole = role;
  if (view === 'gm' && role !== 'GM' && inOwlbear) { message('Эта панель доступна только ведущему комнаты.'); return; }
  const scope = inOwlbear ? { room: OBR.room.id, player: OBR.player.id } : { room: 'preview', player: 'preview' };
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
  const close = async () => {
    if (inOwlbear) { if (view === 'gm') await OBR.modal.close(MODAL_ID); else await OBR.popover.close(SHEET_POPOVER_ID); }
    else message('Предпросмотр закрыт. Обнови страницу, чтобы открыть его снова.');
  };
  const fellowship = view === 'sheet' ? (inOwlbear ? makeFellowshipStore(OBR.room) : makePreviewFellowship(storage)) : null;
  if (fellowship) window.addEventListener('pagehide', () => fellowship.dispose(), { once: true });
  let resizeQueue = Promise.resolve();
  const fitWindow = (count, hasSelection, requestedHeight, minimumWidth) => { if (!inOwlbear || view !== 'sheet') return; resizeQueue = resizeQueue.then(async () => { const size = await sheetBounds(OBR, count, hasSelection, requestedHeight, minimumWidth); await OBR.popover.setWidth(SHEET_POPOVER_ID, size.width); await OBR.popover.setHeight(SHEET_POPOVER_ID, size.height); }).catch(console.error); return resizeQueue; };
  mountUI(root, view, view === 'gm' ? gmTemplate : sheetTemplate, makeStore(storage, scope, view), {
    close, fellowship, fitWindow, preview: !inOwlbear,
    openSheet: async () => { if (inOwlbear) { await OBR.modal.close(MODAL_ID); await openSheet(OBR, window.location.href); } else window.location.href = new URL('./index.html', window.location.href).href; },
  });
  createIcons({ icons: { Feather, X, UserRound, Sprout, BookOpen, ArrowUpRight } });
  if (!inOwlbear) {
    const p = root.querySelector('.mt-prototype-note');
    if(p)p.textContent = 'Предпросмотр вне Owlbear · все данные, включая братство, здесь сохраняются только на этом устройстве.';
  }
}

function showError(error) { console.error(error); message('Не удалось открыть расширение. Закрой окно и открой его снова.'); }
if (OBR.isAvailable) {
  OBR.onReady(() => {
    if (view === 'sheet' && new URLSearchParams(window.location.search).get('surface') !== 'sheet') {
      message('Открываем карточки…');
      const launcher = watchSheetAction(OBR, window.location.href, showError);
      window.addEventListener('pagehide', () => launcher.dispose(), { once: true });
      return;
    }
    void start(true).catch(showError);
    if (view === 'gm') OBR.player.onChange((player) => {
      if (player.role === renderedRole) return;
      // Drop existing private UI immediately while checking the updated role.
      ++generation; message('Проверяем доступ…'); void start(true).catch(showError);
    });
  });
} else { void start(false).catch(showError); }
