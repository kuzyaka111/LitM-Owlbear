import {SHEET_SCALE} from './sheet-scale.js';
import letters from './question-letters.json' with {type:'json'};

// Alegreya SC Medium outlines, optically centred in the same 20 × 20 box
// for HTML and native board cards. Text metrics and browser hinting cannot
// move the glyph away from its diamond.
// User adjustment: one screen pixel left at the default sheet zoom.
export const QUESTION_LETTER_SHIFT_X=-1/SHEET_SCALE;
export const questionLetterViewBox=`${-QUESTION_LETTER_SHIFT_X} 0 20 20`;
export const questionLetterPath=letter=>letters[letter]?.path||'';
export function questionLetterCommands(letter,rect){
 return (letters[letter]?.commands||[]).map(command=>command.map((value,index)=>index?index%2?rect.x+(value+QUESTION_LETTER_SHIFT_X)*rect.width/20:rect.y+value*rect.height/20:value));
}
