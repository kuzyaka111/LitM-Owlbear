import './board-styles.js';
import {createBoardScene,watchBoardTools} from './board-scene.js';
import {makeStore} from './storage.js';
import {makeFellowshipStore} from './fellowship.js';
import OBR,{buildImage,buildPath} from '@owlbear-rodeo/sdk';
import { watchGMTool } from './bridge.js';

if (OBR.isAvailable) {
  OBR.onReady(() => {
    const fellowship=makeFellowshipStore(OBR.room);void fellowship.start().catch(console.error);
    const board=createBoardScene(OBR,{build:buildImage,buildPath,store:makeStore(localStorage,{room:OBR.room.id,player:OBR.player.id},'sheet'),fellowship});
    void board.start().catch(console.error);
    const boardTools=watchBoardTools(OBR,board,window.location.href);
    const controller = watchGMTool(OBR, window.location.href);
    window.addEventListener('pagehide', () => { void controller.dispose();board.dispose();fellowship.dispose();void boardTools.dispose(); }, { once: true });
  });
}
