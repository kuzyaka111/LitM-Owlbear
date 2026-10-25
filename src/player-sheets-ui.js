import {sourceCard} from './board-model.js';
import {boardCardElement} from './board-render.js';
export function mountPlayerSheets(container,directory,{report=console.error}={}){
 const doc=container.ownerDocument;let selected=null,selectedCharacter=null,tab='party',off=()=>{},offShared=()=>{},shared,rendered='';
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const n=el('button','',text);n.type='button';n.addEventListener('click',fn);return n;};
 const cards=el('div','mt-player-sheet-cards'),list=el('div','mt-player-sheet-list'),characters=el('div','mt-player-sheet-list'),management=el('div','mt-gm-character-actions'),info=el('p','mt-gm-hint'),tabs=el('nav','mt-gm-subtabs'),heading=el('h2','','Листы игроков');
 const run=fn=>Promise.resolve().then(fn).then(()=>draw()).catch(report);
 container.append(heading,el('p','mt-gm-hint','Просмотр листов и назначение персонажей игрокам.'),button('Обновить листы',()=>void directory?.refresh().catch(report)),list,characters,management,info,tabs,cards);
 function draw(){
  list.replaceChildren();characters.replaceChildren();management.replaceChildren();const entries=directory?.list()||[];
  if(directory?.management)entries.push({id:'vault',name:'У ведущего',online:true,receivedAt:Date.now(),characters:directory.management.list()});
  if(!selected&&entries.length)selected=entries[0].id;
  for(const entry of entries){const b=button(entry.name+(entry.online?'':' · не в комнате'),()=>{selected=entry.id;selectedCharacter=null;draw();});b.setAttribute('aria-pressed',String(entry.id===selected));list.append(b);}
  const clear=()=>{tabs.replaceChildren();cards.replaceChildren();rendered='';};
  const entry=entries.find(e=>e.id===selected);if(!entry){clear();info.textContent='Листы появятся после подключения участников к комнате.';return;}
  if(!entry.receivedAt){clear();info.textContent='Ожидаем лист игрока. У него должно быть включено расширение.';return;}
  const roster=Array.isArray(entry.characters)?entry.characters:entry.state?[{id:entry.state.characterId||entry.id,state:entry.state}]:[];
  if(!roster.some(c=>c.id===selectedCharacter))selectedCharacter=roster[0]?.id||null;
  for(const c of roster){const b=button(c.state.name||'Без имени',()=>{selectedCharacter=c.id;draw();});b.setAttribute('aria-pressed',String(c.id===selectedCharacter));characters.append(b);}
  const character=roster.find(c=>c.id===selectedCharacter),s=character?.state;
  if(directory?.management){const m=directory.management;management.append(button('+ Создать персонажа',()=>run(()=>m.create(entry.id==='vault'?null:entry.id))));
   if(character){const target=el('select','');target.setAttribute('aria-label','Кому выдать персонажа');for(const p of entries.filter(e=>e.id!=='vault'&&e.id!==entry.id)){const option=el('option','',p.name+(p.online?'':' · не в комнате'));option.value=p.id;target.append(option);}
    if(entry.id==='vault'&&character.phase!=='held')management.append(button('Продолжить передачу',()=>run(()=>m.resume(character.id))));
    else{if(entry.id!=='vault')management.append(button('Забрать',()=>run(()=>m.take(entry.id,character.id))));if(target.children.length)management.append(target,button(entry.id==='vault'?'Выдать':'Передать',()=>run(()=>entry.id==='vault'?m.assign(character.id,target.value):m.transfer(entry.id,character.id,target.value))));}
   }
  }
  if(!s){clear();info.textContent='Нет закреплённых персонажей.';return;}
  info.textContent=entry.id==='vault'?'Персонажи у ведущего — выберите игрока для выдачи.':(entry.online?'Получено: ':'Последняя сохранённая копия: ')+new Date(entry.receivedAt).toLocaleString('ru-RU');
  const signature=JSON.stringify([selected,selectedCharacter,tab,s,shared]);if(signature===rendered)return;rendered=signature;
  const left=cards.scrollLeft,top=cards.scrollTop;tabs.replaceChildren();cards.replaceChildren();
  for(const [id,name]of [['party','Персонаж и Братство'],['themes','Темы'],['statuses','Статусы'],['notes','Заметки']]){const b=button(name,()=>{tab=id;draw();});b.setAttribute('aria-pressed',String(tab===id));tabs.append(b);}
  const keys=tab==='party'?['fellowship','character',...s.cards.map(c=>'card:'+c.id)]:tab==='themes'?s.heroThemes.map(t=>'theme:'+t.id):tab==='statuses'?s.statusCards.map(c=>'status:'+c.id):s.noteCards.map(n=>'note:'+n.id);
  for(const key of keys){const card=sourceCard(s,key,shared);if(!card)continue;const node=boardCardElement({character:s.name,source:key,card},doc).cloneNode(true);node.removeAttribute('id');node.classList.add('mt-player-sheet-card');node.inert=true;node.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);cards.append(node);}
  if(!cards.children.length)cards.append(el('p','mt-gm-hint','Здесь пока нет записей.'));
  cards.scrollLeft=left;cards.scrollTop=top;
 }
 if(directory){off=directory.subscribe(draw);if(directory.fellowship)offShared=directory.fellowship.subscribe((value,ready)=>{if(ready){shared=value;draw();}});}else draw();
 return {dispose(){off();offShared();container.replaceChildren();}};
}
