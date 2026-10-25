import OBR,{buildImage,buildPath} from '@owlbear-rodeo/sdk';
import { createIcons, Feather, X, UserRound, Sprout, BookOpen, ArrowUpRight } from 'lucide';
import './style.css';
import './fog.css';
import './scrolls.css';
import './fonts/fonts.css';
import './typography.css';
import './scratch-effects.css';
import './dice.css';
import './status-settings.css';
import './board.css';
import './gm.css';
import {createGMBoard} from './gm-board.js';
import {createBoardScene} from './board-scene.js';
import rollImage from './scroll-roll.svg';
import paperImage from './parchment.svg';
import brownRoll from './scroll-roll-brown.svg';
import adventureRoll from './scroll-roll-adventure.svg';
import greatnessRoll from './scroll-roll-greatness.svg';
const tearImages=import.meta.glob('./paper-tears/tear-*.svg',{query:'?url',import:'default',eager:true});
const scrollAssetsReady=Promise.all([rollImage,paperImage,brownRoll,adventureRoll,greatnessRoll,...Object.values(tearImages)].map(src=>{const image=new Image();image.src=src;return image.decode().catch(()=>{});}));
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
let disposeGM=()=>{};

function message(text) {
  const p = document.createElement('p'); p.className = 'mt-loading'; p.setAttribute('role', 'status'); p.textContent = text; root.replaceChildren(p);
}

async function start(inOwlbear) {
  if(view==='gm'){disposeGM();disposeGM=()=>{};}
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
    if(view==='gm')await gmBoard?.flush();
    if (inOwlbear) { if (view === 'gm') await OBR.modal.close(MODAL_ID); else await OBR.popover.close(SHEET_POPOVER_ID); }
    else message('Предпросмотр закрыт. Обнови страницу, чтобы открыть его снова.');
  };
  const fellowship = view === 'sheet' ? (inOwlbear ? makeFellowshipStore(OBR.room) : makePreviewFellowship(storage)) : null;
  if (fellowship) window.addEventListener('pagehide', () => fellowship.dispose(), { once: true });
  let resizeQueue = Promise.resolve(),miniature=false;
  const store=makeStore(storage,scope,view);
  const gmBoard=inOwlbear&&view==='gm'?createGMBoard(OBR,{store,build:buildImage,buildPath,report:error=>{const node=root.querySelector('.mt-gm-message');if(node){node.hidden=false;node.textContent=error.message;}else console.error(error);}}):null;
  if(gmBoard)await gmBoard.start();
  if(gmBoard)disposeGM=()=>gmBoard.dispose();
  const board=inOwlbear&&view==='sheet'?createBoardScene(OBR,{build:buildImage,buildPath,store,fellowship,upgrade:false,report:error=>{const node=root.querySelector('.mt-ui-message');if(node){node.hidden=false;node.textContent=error.message;}else console.error(error);}}):null;
  const fitWindow = (count, hasSelection, requestedHeight, minimumWidth) => { if (!inOwlbear || view !== 'sheet'||miniature) return resizeQueue; resizeQueue = resizeQueue.then(async () => { if(miniature)return;const size = await sheetBounds(OBR, count, hasSelection, requestedHeight, minimumWidth); await OBR.popover.setWidth(SHEET_POPOVER_ID, size.width); await OBR.popover.setHeight(SHEET_POPOVER_ID, size.height); }).catch(console.error); return resizeQueue; };
  if(board)await board.start();
  mountUI(root, view, view === 'gm' ? gmTemplate : sheetTemplate, store, {
    close, fellowship, fitWindow, preview: !inOwlbear,board,
    placeObstacle:gmBoard?obstacle=>gmBoard.place(obstacle):null,
    obstaclesChanged:()=>gmBoard?.changed(),
    pickObstacleImage:inOwlbear?async()=>{const assets=await OBR.assets.downloadImages(false);return assets[0]?.image||null;}:null,
    boardResize:(mini,size)=>{miniature=mini;resizeQueue=resizeQueue.then(async()=>{await OBR.popover.setWidth(SHEET_POPOVER_ID,Math.round(size.width*(mini ? .3 : 1)));await OBR.popover.setHeight(SHEET_POPOVER_ID,Math.round(size.height*(mini ? .3 : 1)));});return resizeQueue;},
    boardPoint:event=>OBR.viewport.inverseTransformPoint({x:16+event.clientX,y:96+event.clientY}),
    openSheet: async () => { if (inOwlbear) { await OBR.modal.close(MODAL_ID); await openSheet(OBR, window.location.href); } else window.location.href = new URL('./index.html', window.location.href).href; },
  });
  if(board)window.addEventListener('pagehide',()=>board.dispose(),{once:true});
  if(gmBoard)window.addEventListener('pagehide',()=>gmBoard.dispose(),{once:true});
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
