import {editorTools} from './editor-ui.js';
export function openCharacterPicker(root,store,reload=()=>root.ownerDocument.defaultView.location.reload()){
 const {el,btn,dialog}=editorTools(root);
 return dialog('Выбрать персонажа',(form,close,report)=>{
  const run=fn=>{try{fn();close();reload();}catch(e){report(e.message);}};
  const picker=form.closest('dialog');picker.classList.add('mt-character-picker');
  const heading=picker.querySelector('h2'),header=el('header','mt-character-picker-header');heading.replaceWith(header);header.append(heading,btn('Создать нового','',()=>run(()=>store.createCharacter())));
  const list=el('div','mt-character-choices');
  for(const c of store.listCharacters()){
   const row=el('div','mt-character-choice'),choose=btn(c.state.name||'Без имени','',()=>run(()=>store.selectCharacter(c.id)));choose.setAttribute('aria-pressed',String(c.id===store.activeId()));
   row.append(choose,btn('Удалить','',()=>dialog('Удалить персонажа?',(confirmation,done)=>{confirmation.closest('dialog').classList.add('mt-character-picker');confirmation.append(el('p','',`Удалить «${c.state.name||'Без имени'}» вместе с темами, рюкзаком, статусами и заметками?`),btn('Отмена','',done),btn('Удалить персонажа','',()=>{try{store.deleteCharacter(c.id);done();close();reload();}catch(e){report(e.message);done();}}));}),'Удалить '+(c.state.name||'персонажа')));list.append(row);
  }
  if(!list.children.length)list.append(el('p','','За вами пока нет закреплённых персонажей.'));
  form.append(list);
 });
}
