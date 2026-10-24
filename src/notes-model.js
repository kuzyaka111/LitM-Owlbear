const text=(v,fallback='',max=5000)=>typeof v==='string'?v.slice(0,max):fallback;
export const newNoteSection=()=>({id:crypto.randomUUID(),title:'',text:'',collapsed:false});
export const newNoteCard=()=>({id:crypto.randomUUID(),title:'Новая заметка',collapsed:false,sections:[newNoteSection()]});
export function legacyNotes(value){return [{id:'original-notes',title:'Заметки',collapsed:false,sections:[{id:'original-notes-body',title:'',text:value,collapsed:false}]}];}
export function cleanNoteCards(value,previous){
 if(!Array.isArray(value))return legacyNotes(previous);
 const ids=new Set();const unique=(v,fallback)=>{let id=typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)?v:fallback;while(ids.has(id))id+='-copy';ids.add(id);return id;};
 return value.filter(c=>c&&typeof c==='object').slice(0,30).map((c,i)=>({id:unique(c.id,'note-'+i),title:text(c.title,'Заметки',120),collapsed:c.collapsed===true,sections:(Array.isArray(c.sections)?c.sections:[]).filter(s=>s&&typeof s==='object').slice(0,50).map((s,j)=>({id:unique(s.id,`note-${i}-section-${j}`),title:text(s.title,'',120),text:text(s.text),collapsed:s.collapsed===true}))}));
}
// Return a single edit so cursor position, selections and following text are retained.
export function continueList(value,start,end){
 const lineStart=value.lastIndexOf('\n',start-1)+1,lineEnd=value.indexOf('\n',end),stop=lineEnd<0?value.length:lineEnd;
 const before=value.slice(lineStart,start),match=before.match(/^([\t ]*)- /);
 if(!match)return null;
 const line=value.slice(lineStart,stop);
 if(/^([\t ]*)-\s*$/.test(line)&&start===end)return {start:lineStart,end:stop,text:''};
 return {start,end,text:'\n'+match[1]+'- '};
}
export function attachListEditor(input,onChange){
 function enter(e){if(e.isComposing)return;const edit=continueList(input.value,input.selectionStart,input.selectionEnd);if(!edit)return;if(input.value.length-(edit.end-edit.start)+edit.text.length>input.maxLength&&input.maxLength>=0)return;e.preventDefault();input.setRangeText(edit.text,edit.start,edit.end,'end');onChange();}
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey)enter(e);});
 input.addEventListener('beforeinput',e=>{if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak')enter(e);});
}
