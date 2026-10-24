import {newNoteCard,newNoteSection,attachListEditor} from './notes-model.js';
export function mountNotes(root,state,save,fit,tools){
 const {el,btn}=tools,host=root.querySelector('.mt-notes-cards'),add=root.querySelector('.mt-add-note');
 function titleInput(value,label,onInput){const input=el('input','mt-note-title');input.value=value;input.placeholder=label;input.maxLength=120;input.setAttribute('aria-label',label);input.addEventListener('click',e=>e.stopPropagation());input.addEventListener('keydown',e=>e.stopPropagation());input.addEventListener('input',()=>{onInput(input.value);save();});return input;}
 function trackFold(details,item){details.open=!item.collapsed;details.addEventListener('toggle',()=>{const closed=!details.open;if(item.collapsed!==closed){item.collapsed=closed;save();}});}
 function draw(){
  host.replaceChildren();
  for(const card of state.noteCards){
   const article=el('details','mt-theme mt-notes-card');article.dataset.noteId=card.id;trackFold(article,card);
   const head=el('summary','mt-theme-head mt-note-heading');head.setAttribute('aria-label','Свернуть или развернуть заметку');
   const arrow=el('span','mt-note-arrow','▸');arrow.setAttribute('aria-hidden','true');
   const remove=btn('×','mt-note-delete',e=>{e.preventDefault();e.stopPropagation();state.noteCards=state.noteCards.filter(x=>x!==card);draw();save();fit();},'Удалить карточку заметок');
   head.append(arrow,titleInput(card.title,'Заголовок заметки',v=>card.title=v),remove);article.append(head);article.addEventListener('toggle',()=>{if(article.open)article.querySelectorAll('.mt-note-text').forEach(input=>{if(input.offsetParent){input.style.height='0px';input.style.height=Math.max(120,input.scrollHeight)+'px';}});});
   const body=el('div','mt-note-body');
   for(const section of card.sections){
    const detail=el('details','mt-note-section');trackFold(detail,section);const summary=el('summary','mt-note-subheading');summary.setAttribute('aria-label','Свернуть или развернуть раздел');
    const arrow=el('span','mt-note-arrow','▸');arrow.setAttribute('aria-hidden','true');
    summary.append(arrow,titleInput(section.title,'Подзаголовок',v=>section.title=v),btn('×','mt-note-delete',e=>{e.preventDefault();e.stopPropagation();card.sections=card.sections.filter(x=>x!==section);draw();save();},'Удалить раздел заметки'));
    const input=el('textarea','mt-note-text');input.value=section.text;input.maxLength=5000;input.rows=6;input.placeholder='Текст заметки…\n- Пункт списка';input.setAttribute('aria-label','Текст заметки');if(section.id==='original-notes-body')input.id='mt-notes-text';
    const update=()=>{section.text=input.value;if(section.id==='original-notes-body')state.notes=input.value;save();resize();};
    const resize=()=>{input.style.height='0px';input.style.height=Math.max(120,input.scrollHeight)+'px';};input.addEventListener('input',update);input.addEventListener('focus',resize);attachListEditor(input,update);
    detail.append(summary,input);detail.addEventListener('toggle',()=>{if(detail.open)resize();});body.append(detail);
   }
   const addSection=btn('+ Подзаголовок','mt-add-note-section',()=>{if(card.sections.length>=50)return;card.sections.push(newNoteSection());draw();save();const node=host.querySelector(`[data-note-id="${card.id}"]`);node.querySelectorAll('.mt-note-subheading input').item(card.sections.length-1)?.focus();});addSection.disabled=card.sections.length>=50;body.append(addSection);article.append(body);host.append(article);
  }
  add.disabled=state.noteCards.length>=30;
 }
 add.addEventListener('click',()=>{if(state.noteCards.length>=30)return;state.noteCards.push(newNoteCard());draw();save();fit();host.lastElementChild.querySelector('input').focus();host.lastElementChild.scrollIntoView?.({block:'nearest',inline:'nearest'});});draw();
 return ()=>host.querySelectorAll('.mt-note-text').forEach(input=>{if(input.offsetParent){input.style.height='0px';input.style.height=Math.max(120,input.scrollHeight)+'px';}});
}
