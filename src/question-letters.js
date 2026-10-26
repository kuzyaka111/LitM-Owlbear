import letters from './question-letters.json' with {type:'json'};

// Alegreya SC Medium outlines, optically centred in the same 20 × 20 box
// for HTML and native board cards. Text metrics and browser hinting cannot
// move the glyph away from its diamond.
export const questionLetterPath=letter=>letters[letter]?.path||'';
export function questionLetterCommands(letter,rect){
 return (letters[letter]?.commands||[]).map(command=>command.map((value,index)=>index?index%2?rect.x+value*rect.width/20:rect.y+value*rect.height/20:value));
}
