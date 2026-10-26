export {BOARD_GRAPHICS_VERSION} from './board-geometry.js';
let renderer;
export function renderBoardGraphics(record){
 renderer??=import('./board-graphics.js').catch(error=>{renderer=null;throw error;});
 return renderer.then(module=>module.renderBoardGraphics(record));
}
