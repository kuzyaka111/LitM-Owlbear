import OBR from '@owlbear-rodeo/sdk';
import { createIcons, Feather, X, UserRound, Sprout, BookOpen, ArrowUpRight } from 'lucide';
import './style.css';
import sheetTemplate from './sheet.html?raw';
import gmTemplate from './gm.html?raw';
import { MODAL_ID } from './bridge.js';
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
  if (thisGeneration !== generation) return;
  renderedRole = role;
  if (view === 'gm' && role !== 'GM' && inOwlbear) { message('Эта панель доступна только ведущему комнаты.'); return; }
  const scope = inOwlbear ? { room: OBR.room.id, player: OBR.player.id } : { room: 'preview', player: 'preview' };
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
  const close = async () => {
    if (inOwlbear) await (view === 'gm' ? OBR.modal.close(MODAL_ID) : OBR.action.close());
    else message('Предпросмотр закрыт. Обнови страницу, чтобы открыть его снова.');
  };
  const fellowship = view === 'sheet' ? (inOwlbear ? makeFellowshipStore(OBR.room) : makePreviewFellowship(storage)) : null;
  if (fellowship) window.addEventListener('pagehide', () => fellowship.dispose(), { once: true });
  mountUI(root, view, view === 'gm' ? gmTemplate : sheetTemplate, makeStore(storage, scope, view), {
    close, fellowship, preview: !inOwlbear,
    openSheet: async () => { if (inOwlbear) { await OBR.modal.close(MODAL_ID); await OBR.action.open(); } else window.location.href = new URL('./index.html', window.location.href).href; },
  });
  createIcons({ icons: { Feather, X, UserRound, Sprout, BookOpen, ArrowUpRight } });
  if (!inOwlbear) {
    const p = root.querySelector('.mt-prototype-note');
    p.textContent = 'Предпросмотр вне Owlbear · все данные, включая братство, здесь сохраняются только на этом устройстве.';
  }
}

function showError(error) { console.error(error); message('Не удалось открыть расширение. Закрой окно и открой его снова.'); }
if (OBR.isAvailable) {
  OBR.onReady(() => {
    void start(true).catch(showError);
    if (view === 'gm') OBR.player.onChange((player) => {
      if (player.role === renderedRole) return;
      // Drop existing private UI immediately while checking the updated role.
      ++generation; message('Проверяем доступ…'); void start(true).catch(showError);
    });
  });
} else { void start(false).catch(showError); }
