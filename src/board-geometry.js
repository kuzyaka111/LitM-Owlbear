// Lightweight protocol constants shared by startup code and the lazy renderer.
export const BOARD_GRAPHICS_VERSION=14;
export const rectCommands=(x,y,w,h)=>[[0,x,y],[1,x+w,y],[1,x+w,y+h],[1,x,y+h],[5]];
