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
import {createActionSources} from './action-sources.js';
import {createBoardScene} from './board-scene.js';
import {BOARD_KEY} from './board-model.js';
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
import {createGMCloud} from './gm-cloud.js';
import {getCloudClient} from './cloud-client.js';
import {createSheetDirectory} from './player-sheets.js';
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
  await Promise.all([view==='sheet'?scrollAssetsReady:Promise.resolve(),document.fonts.load('400 15px "Bad Script"'),document.fonts.load('500 13px "Alegreya SC"')]);
  if (thisGeneration !== generation) return;
  renderedRole = role;
  if (view === 'gm' && role !== 'GM' && inOwlbear) { message('Эта панель доступна только ведущему комнаты.'); return; }
  const scope = inOwlbear ? { room: OBR.room.id, player: OBR.player.id } : { room: 'preview', player: 'preview' };
  let storage;
  try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Локальное хранилище недоступно'); } }; }
  const close = async () => {
    if(view==='gm'){await gmBoard?.flush();await cloud?.flush().catch(()=>{});}
    if (inOwlbear) { if (view === 'gm') await OBR.modal.close(MODAL_ID); else await OBR.popover.close(SHEET_POPOVER_ID); }
    else message('Предпросмотр закрыт. Обнови страницу, чтобы открыть его снова.');
  };
  const fellowship = view === 'sheet' ? (inOwlbear ? makeFellowshipStore(OBR.room) : makePreviewFellowship(storage)) : null;
  if (fellowship) window.addEventListener('pagehide', () => fellowship.dispose(), { once: true });
  let resizeQueue = Promise.resolve(),miniature=false;
  let reloading=false;const reloadSheet=()=>{if(!reloading){reloading=true;window.location.reload();}};
  const localStore=makeStore(storage,scope,view);
  const cloud=view==='gm'?createGMCloud({client:getCloudClient,localStore,storage,roomId:scope.room,localScope:scope.player,allowed:async()=>!inOwlbear||await OBR.player.getRole()==='GM',deferRemote:()=>!!root.querySelector('input:focus,textarea:focus,select:focus')}):null;
  if(cloud){disposeGM=()=>cloud.dispose();await cloud.start();if(thisGeneration!==generation){cloud.dispose();return;}}
  const store=cloud?.store||localStore;
  const playerSheets=inOwlbear&&view==='gm'?createSheetDirectory(OBR,storage,{onTaken:async character=>{
    if(await OBR.player.getRole()!=='GM')throw Error('Действие доступно только ведущему.');
    if(!await OBR.scene.isReady())return;
    const items=await OBR.scene.items.getItems(),roots=items.filter(i=>{const r=i.metadata?.[BOARD_KEY];return r?.owner===character.from&&r.source!=='fellowship'&&(r.characterId===character.id||!r.characterId&&character.id.startsWith('legacy-'));});
    const ids=roots.flatMap(i=>[i.id,...(i.metadata[BOARD_KEY].parts||[])]);if(ids.length)await OBR.scene.items.deleteItems(ids);
  }}):null;
  const releaseSheets=()=>{playerSheets?.dispose();playerSheets?.fellowship.dispose();cloud?.dispose();};
  if(playerSheets){playerSheets.fellowship=makeFellowshipStore(OBR.room);disposeGM=releaseSheets;await playerSheets.fellowship.start();if(thisGeneration!==generation){releaseSheets();return;}await playerSheets.start();if(thisGeneration!==generation){releaseSheets();return;}}
  const actionSources=inOwlbear&&view==='sheet'?createActionSources(OBR,error=>{const node=root.querySelector('.mt-ui-message');if(node){node.hidden=false;node.textContent=error.message;}else console.error(error);},()=>store.activeId?.()):null;
  if(actionSources)await actionSources.start();
  const gmBoard=inOwlbear&&view==='gm'?createGMBoard(OBR,{store,build:buildImage,buildPath,report:error=>{const node=root.querySelector('.mt-gm-message');if(node){node.hidden=false;node.textContent=error.message;}else console.error(error);}}):null;
  if(gmBoard){const release=()=>{gmBoard.dispose();releaseSheets();};disposeGM=release;await gmBoard.start();if(thisGeneration!==generation||await OBR.player.getRole()!=='GM'){release();return;}}
  const board=inOwlbear&&view==='sheet'?createBoardScene(OBR,{build:buildImage,buildPath,store,fellowship,upgrade:false,report:error=>{const node=root.querySelector('.mt-ui-message');if(node){node.hidden=false;node.textContent=error.message;}else console.error(error);}}):null;
  const fitWindow = (count, hasSelection, requestedHeight, minimumWidth) => { if (!inOwlbear || view !== 'sheet'||miniature) return resizeQueue; resizeQueue = resizeQueue.then(async () => { if(miniature)return;const size = await sheetBounds(OBR, count, hasSelection, requestedHeight, minimumWidth); await OBR.popover.setWidth(SHEET_POPOVER_ID, size.width); await OBR.popover.setHeight(SHEET_POPOVER_ID, size.height); }).catch(console.error); return resizeQueue; };
  if(board)await board.start();
  if(view==='sheet'&&store.activeId){const active=store.activeId();const off=store.subscribe(()=>{if(store.activeId()!==active)reloadSheet();});window.addEventListener('pagehide',off,{once:true});}
  mountUI(root, view, view === 'gm' ? gmTemplate : sheetTemplate, store, {
    characters:view==='sheet'?store:null,reloadSheet,
    close, fellowship, fitWindow, preview: !inOwlbear,board,actionSources,playerSheets,cloud,
    registerDispose:fn=>{const before=disposeGM;disposeGM=()=>{before();fn();};},
    placeObstacle:gmBoard?obstacle=>gmBoard.place(obstacle):null,
    placeSceneEffect:gmBoard?effect=>gmBoard.place(effect):null,
    obstaclesChanged:()=>gmBoard?.changed(),
    pickObstacleImage:inOwlbear?async()=>{const assets=await OBR.assets.downloadImages(false);return assets[0]?.image||null;}:null,
    boardResize:(mini,size)=>{miniature=mini;resizeQueue=resizeQueue.then(async()=>{await OBR.popover.setWidth(SHEET_POPOVER_ID,Math.round(size.width*(mini ? .3 : 1)));await OBR.popover.setHeight(SHEET_POPOVER_ID,Math.round(size.height*(mini ? .3 : 1)));});return resizeQueue;},
    boardPoint:event=>OBR.viewport.inverseTransformPoint({x:16+event.clientX,y:96+event.clientY}),
    openSheet: async () => { if (inOwlbear) { await OBR.modal.close(MODAL_ID); await openSheet(OBR, window.location.href); } else window.location.href = new URL('./index.html', window.location.href).href; },
  });
  if(board)window.addEventListener('pagehide',()=>board.dispose(),{once:true});
  if(actionSources)window.addEventListener('pagehide',()=>actionSources.dispose(),{once:true});
  if(gmBoard)window.addEventListener('pagehide',()=>gmBoard.dispose(),{once:true});
  if(cloud){const refresh=()=>void cloud.refresh().catch(()=>{});window.addEventListener('online',refresh);window.addEventListener('focus',refresh);window.addEventListener('pagehide',()=>{window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);cloud.dispose();},{once:true});}
  if(playerSheets)window.addEventListener('pagehide',()=>{playerSheets.dispose();playerSheets.fellowship.dispose();},{once:true});
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
