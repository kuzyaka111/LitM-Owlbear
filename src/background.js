import './board-styles.js';
import {createBoardScene,watchBoardTools} from './board-scene.js';
import {watchGMBoardReturn} from './gm-board.js';
import {makeStore} from './storage.js';
import {makeFellowshipStore} from './fellowship.js';
import OBR,{buildImage,buildPath} from '@owlbear-rodeo/sdk';
import { watchGMTool } from './bridge.js';
import {createSheetPublisher} from './player-sheets.js';
import {createDetachedHost} from './detached-host.js';

if (OBR.isAvailable) {
  OBR.onReady(() => {
    let detachedHost;try{detachedHost=createDetachedHost(OBR,window);}catch(error){console.error(error);}
    const fellowship=makeFellowshipStore(OBR.room);void fellowship.start().catch(console.error);
    const store=makeStore(localStorage,{room:OBR.room.id,player:OBR.player.id},'sheet');
    const publisher=createSheetPublisher(OBR,store,{beforeCommand:command=>command.type==='revoke'?board.syncNow():undefined});publisher.start();
    const board=createBoardScene(OBR,{build:buildImage,buildPath,store,fellowship});
    void board.start().catch(console.error);
    const boardTools=watchBoardTools(OBR,board,window.location.href);
    const gmReturn=watchGMBoardReturn(OBR,window.location.href);
    const controller = watchGMTool(OBR, window.location.href);
    window.addEventListener('pagehide', () => { detachedHost?.dispose();publisher.dispose();void controller.dispose();board.dispose();fellowship.dispose();void boardTools.dispose();void gmReturn.dispose(); }, { once: true });
  });
}
