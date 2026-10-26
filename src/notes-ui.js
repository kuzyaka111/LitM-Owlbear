import {dressScroll} from './scroll-view.js';
import {newNoteCard,newNoteSection,newNoteHeading,attachListEditor} from './notes-model.js';
export function mountNotes(root,state,save,fit,tools){
 const {el,btn,dialog}=tools,host=root.querySelector('.mt-notes-cards');
 function resizeEditor(input){if(input.offsetParent){input.style.height='0px';input.style.height=Math.max(100,input.scrollHeight)+'px';}}
 function layout(){host.querySelectorAll('.mt-note-text').forEach(resizeEditor);}
 function titleInput(value,label,onInput){const input=el('input','mt-note-title');input.value=value;input.placeholder=label;input.maxLength=120;input.setAttribute('aria-label',label);input.addEventListener('click',e=>e.stopPropagation());input.addEventListener('keydown',e=>e.stopPropagation());input.addEventListener('input',()=>{onInput(input.value);save();});return input;}
 function trackFold(details,item){details.open=!item.collapsed;details.addEventListener('toggle',()=>{if(!details.isConnected)return;const closed=!details.open;if(item.collapsed!==closed){item.collapsed=closed;save();}if(details.open)layout();});}
 function persist(){draw();save();fit();layout();}
 function reveal(card){if(!card.open){card.open=true;persist();}const node=[...host.querySelectorAll('.mt-notes-card')].find(n=>n.dataset.noteId===card.id);node?.scrollIntoView?.({block:'nearest',inline:'nearest'});}
 function deleteNote(card){dialog('Удалить заметку?',(form,close)=>{
  form.append(el('p','',`Заметка «${card.title||'Без названия'}» будет удалена целиком, вместе со всеми заголовками, подзаголовками и текстом.`));
  form.append(btn('Отмена','mt-note-cancel',close),btn('Удалить заметку','mt-primary mt-confirm-delete-note',()=>{state.noteCards=state.noteCards.filter(x=>x!==card);if(card.sections.some(s=>s.id==='original-notes-body'||s.children.some(x=>x.id==='original-notes-body')))state.notes='';persist();close();}));
 });}
 function bodyEditor(section){const input=el('textarea','mt-note-text');input.value=section.text;input.maxLength=5000;input.rows=4;input.placeholder='Текст заметки…\n- Пункт списка';input.setAttribute('aria-label','Текст заметки');if(section.id==='original-notes-body')input.id='mt-notes-text';const update=()=>{section.text=input.value;if(section.id==='original-notes-body')state.notes=input.value;save();resizeEditor(input);};input.addEventListener('input',update);input.addEventListener('focus',()=>resizeEditor(input));attachListEditor(input,update);return input;}
 function sectionNode(section,siblings,sub=false){
  const detail=el('details','mt-note-section'+(sub?' mt-note-subsection':' mt-note-top-section'));trackFold(detail,section);
  const summary=el('summary',sub?'mt-note-subheading':'mt-note-section-heading');summary.setAttribute('aria-label',sub?'Свернуть или развернуть подзаголовок':'Свернуть или развернуть заголовок');
  const arrow=el('span','mt-note-arrow','▸');arrow.setAttribute('aria-hidden','true');summary.append(arrow,titleInput(section.title,sub?'Подзаголовок':'Заголовок',v=>section.title=v),btn('×','mt-note-delete',e=>{e.preventDefault();e.stopPropagation();siblings.splice(siblings.indexOf(section),1);if(section.id==='original-notes-body')state.notes='';persist();},sub?'Удалить подзаголовок':'Удалить заголовок'));
  const content=el('div','mt-note-section-content');content.append(bodyEditor(section));
  if(!sub){for(const child of section.children)content.append(sectionNode(child,section.children,true));const add=btn('+ Подзаголовок','mt-add-note-subsection',()=>{section.children.push(newNoteSection());persist();});add.disabled=section.children.length>=50;content.append(add);}
  detail.append(summary,content);return detail;
 }
 function draw(){
  host.replaceChildren();const library=el('article','mt-theme mt-notes-compendium');library.append(el('div','mt-theme-head','Компендиум заметок'));const list=el('div','mt-note-index');
  for(const card of state.noteCards){const row=el('div','mt-note-index-row');const open=btn(card.title||'Без названия','mt-open-note',()=>reveal(card));open.dataset.noteId=card.id;open.setAttribute('aria-pressed',String(card.open));open.title=card.open?'Заметка открыта — перейти':'Открыть заметку';row.append(open,btn('×','mt-note-delete',()=>deleteNote(card),'Удалить заметку '+(card.title||'Без названия')));list.append(row);}
  if(!state.noteCards.length)list.append(el('p','mt-empty-notes','Здесь будут твои заметки.'));library.append(list);
  const add=btn('+ Заметка','mt-add-note',()=>{const card=newNoteCard();state.noteCards.push(card);persist();reveal(card);host.lastElementChild.querySelector('input')?.focus();});add.disabled=state.noteCards.length>=30;library.append(add);host.append(dressScroll(library));
  for(const card of state.noteCards.filter(x=>x.open)){
   const article=el('article','mt-theme mt-notes-card');article.dataset.noteId=card.id;const head=el('div','mt-theme-head mt-note-heading');
   head.append(titleInput(card.title,'Название заметки',v=>{card.title=v;const entry=[...list.querySelectorAll('.mt-open-note')].find(n=>n.dataset.noteId===card.id);if(entry)entry.textContent=v||'Без названия';}),btn('×','mt-note-close',()=>{card.open=false;persist();},'Закрыть заметку'));
   const body=el('div','mt-note-body');for(const section of card.sections)body.append(sectionNode(section,card.sections));const addHeading=btn('+ Заголовок','mt-add-note-section',()=>{card.sections.push(newNoteHeading());persist();});addHeading.disabled=card.sections.length>=50;body.append(addHeading);article.append(head,body);host.append(dressScroll(article));
  }
 }
 layout.draw=draw;draw();return layout;
}
