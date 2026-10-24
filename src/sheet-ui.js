import { newCard, makeId } from './storage.js';
import { makeTheme, getBook, quintessences, improvementById, tagKey } from './theme-model.js';
import { fellowshipDefaults } from './fellowship.js';
import { fellowshipTheme, fellowshipPatch } from './fellowship-model.js';
import { editorTools, renderTheme } from './editor-ui.js';

export function mountSheet(root,state,save,actions) {
  const tools=editorTools(root),{doc,el,btn,dialog,editText,catalogDialog}=tools;
  const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
  const selected=new Set(state.selected),expanded=new Map(),replacements=new Map();
  let activeTab='party',shared=fellowshipDefaults(),sharedReady=false,sharedBusy=false,sharedStatus='Подключаем братство…',deleted=null;
  const service=actions.fellowship;
  const report=error=>{const node=q('.mt-ui-message');node.hidden=false;node.textContent=error?.message||String(error);};
  function localSave(){state.selected=[...selected];save();}
  function allTags(){
    const tags=new Map();const addTheme=t=>{for(const kind of ['power','weakness'])t[kind].forEach((slot,i)=>{if(slot.text&&!slot.scratched)tags.set(tagKey(t,kind,i),{text:slot.text,kind,source:getBook(t.bookId).name});});};
    state.heroThemes.forEach(addTheme);if(sharedReady)addTheme(fellowshipTheme(shared));
    state.cards.forEach(c=>{if(c.type==='theme')addTheme(c.theme);else c.items.forEach(item=>{if(!item.scratched)tags.set(`card:${c.id}:${item.id}`,{text:item.text,kind:'power',source:c.title});});});
    state.relationships.forEach(r=>{if(r.tag)tags.set('relationship:'+r.id,{text:r.tag,kind:'power',source:r.companion});});
    for(const kind of ['power','weakness'])state.actionExtras[kind].forEach(x=>tags.set(`extra:${kind}:${x.id}`,{text:x.text,kind,source:'Тег действия'}));
    return tags;
  }
  function refreshSelection(){
    const tags=allTags();for(const key of selected)if(!tags.has(key)&&!(key.startsWith('theme:fellowship:')&&!sharedReady))selected.delete(key);
    qa('[data-key]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.key))));
    for(const kind of ['power','weakness']){
      const list=q('.mt-action-list[data-kind="'+kind+'"]');list.replaceChildren();
      for(const key of selected){const item=tags.get(key);if(!item||item.kind!==kind)continue;
        const row=el('div','mt-action-tag');const text=btn(item.text,'',()=>select(key));text.title=item.source;row.append(text,btn('×','',()=>{selected.delete(key);if(key.startsWith('extra:'))state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);refreshSelection();localSave();},'Убрать '+item.text));list.append(row);
      }
      if(!list.childElementCount)list.append(el('p','mt-empty-action',kind==='power'?'Выбери подходящие теги силы':'Выбери мешающие теги слабости'));
    }
    q('.mt-clear').disabled=!selected.size;state.selected=[...selected];
  }
  function select(key){if(selected.has(key)){selected.delete(key);if(key.startsWith('extra:'))for(const kind of ['power','weakness'])state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);}else selected.add(key);refreshSelection();localSave();}
  function preserveReplace(host,node){const previous=host.querySelector('.mt-theme'),scroll=previous?.scrollTop||0;host.replaceChildren(node);node.scrollTop=scroll;}
  function mutateTheme(t,change){if(change.kind)t[change.kind][change.index][change.field]=change.value;else t[change.field]=change.value;}
  function themeContext(t,host,core=false,card){
    return {core,isSelected:key=>selected.has(key),select,report,expanded:expanded.get(t.id),onExpand:open=>expanded.set(t.id,open),
      change:async change=>{mutateTheme(t,change);drawLocal(t,host,core,card);refreshSelection();localSave();},
      replace:async(bookId,reset)=>{replacements.set(t.id,structuredClone(t));const replacement=reset?makeTheme(bookId,t.id):{...structuredClone(t),bookId};const b=getBook(bookId);if(reset&&b.might!=='variable')replacement.might=b.might;Object.assign(t,replacement);drawLocal(t,host,core,card);refreshSelection();localSave();},
      undo:replacements.has(t.id)?()=>{Object.assign(t,replacements.get(t.id));replacements.delete(t.id);drawLocal(t,host,core,card);refreshSelection();localSave();}:null,
      remove:card?()=>removeCard(card):null};
  }
  function drawLocal(t,host,core=false,card){preserveReplace(host,renderTheme(t,themeContext(t,host,core,card),tools));}
  state.heroThemes.forEach(t=>{const host=el('div','mt-card-slot');q('.mt-themes').append(host);drawLocal(t,host,true);});

  function drawShared(){
    const t=fellowshipTheme(shared);preserveReplace(q('.mt-fellowship-host'),renderTheme(t,{isSelected:key=>selected.has(key),select,report,busy:!sharedReady||sharedBusy,
      expanded:expanded.get(t.id),onExpand:open=>expanded.set(t.id,open),sharedStatus,
      change:async change=>{sharedBusy=true;sharedStatus='Сохраняем для всех…';drawShared();
        try{await service.update(fellowshipPatch(change));sharedStatus=actions.preview?'Предпросмотр · сохранено на устройстве':'Общее для комнаты · сохранено';}
        catch(e){sharedStatus='Не сохранено: '+e.message;throw e;}finally{sharedBusy=false;drawShared();refreshSelection();}
      }},tools));
  }
  drawShared();
  if(service){service.subscribe((value,ready)=>{shared=value;sharedReady=ready;if(ready&&!sharedBusy)sharedStatus=actions.preview?'Братство · локальный предпросмотр':'Братство · общее для комнаты';drawShared();refreshSelection();});void service.start().catch(error=>{sharedStatus='Нет соединения';drawShared();report(error);const retry=btn('Повторить','mt-retry-shared',()=>{retry.disabled=true;void service.start().then(()=>retry.remove()).catch(e=>{report(e);retry.disabled=false;});});q('.mt-fellowship-host .mt-theme').append(retry);});}
  else {sharedStatus='Нет подключения к комнате';drawShared();}

  function field(label,value,onInput,max=80,multi=false){const l=el('label','mt-field');l.append(el('span','',label));const input=el(multi?'textarea':'input');input.value=value;input.maxLength=max;if(multi)input.rows=2;input.addEventListener('input',()=>onInput(input.value));l.append(input);return {label:l,input};}
  function drawCharacter(){
    const article=el('article','mt-theme mt-character-card');const head=el('div','mt-theme-head');head.append(el('span','','Персонаж'),el('span','mt-save-state',''));article.append(head);
    const body=el('div','mt-character-body');const name=field('Имя героя',state.name,value=>{state.name=value;localSave();},80,true);name.input.className='mt-editor-name';body.append(name.label,field('Имя игрока',state.playerName,value=>{state.playerName=value;localSave();}).label);
    const about=el('details','mt-details');about.append(el('summary','','О персонаже'),field('Описание',state.concept,value=>{state.concept=value;localSave();},500,true).label);body.append(about);
    const relationships=el('details','mt-details mt-relationships');relationships.open=true;relationships.append(el('summary','','Отношения в братстве'));
    state.relationships.forEach((r,index)=>{const row=el('div','mt-relationship');const tag=btn(r.tag||'Тег отношения','',()=>{if(r.tag)select('relationship:'+r.id);else editRelationship();});tag.dataset.key='relationship:'+r.id;tag.title=r.companion;tag.addEventListener('dblclick',()=>editRelationship());
      function editRelationship(){dialog('Отношение',(form,close)=>{let companion=r.companion,text=r.tag;form.append(field('Спутник',companion,v=>{companion=v;}).label,field('Тег отношения',text,v=>{text=v;}).label);const saveButton=el('button','mt-primary','Сохранить');saveButton.type='submit';form.append(saveButton);form.addEventListener('submit',()=>{r.companion=companion;r.tag=text;drawCharacter();refreshSelection();localSave();close();});});}
      row.append(el('small','',r.companion||'Спутник'),tag,btn('✎','',editRelationship,'Редактировать отношение'),btn('×','',()=>{state.relationships.splice(index,1);drawCharacter();refreshSelection();localSave();},'Удалить отношение'));relationships.append(row);
    });
    relationships.append(btn('+ Отношение','mt-add-relationship',()=>{if(state.relationships.length<20){state.relationships.push({id:makeId(),companion:'',tag:''});drawCharacter();localSave();}}));body.append(relationships);article.append(body);
    const growth=el('div','mt-hero-growth');growth.append(el('span','mt-tag-label','ПОТЕНЦИАЛ'));const pips=el('div','mt-promise');for(let i=1;i<=5;i++){const b=btn(i<=state.promise?'◆':'◇','mt-pip',()=>{state.promise=i===state.promise?i-1:i;drawCharacter();localSave();},'Потенциал '+i);b.setAttribute('aria-pressed',String(i<=state.promise));pips.append(b);}growth.append(pips);
    const quint=el('details','mt-details mt-quintessences');quint.open=expanded.get('quint')||false;quint.addEventListener('toggle',()=>expanded.set('quint',quint.open));quint.append(el('summary','','Квинтэссенции · '+state.quintessenceIds.length));
    for(const id of state.quintessenceIds){const item=improvementById(id);if(!item)continue;const row=el('div','mt-improvement-row');const b=btn(item.name,'',()=>dialog(item.name,form=>form.append(el('p','',item.text),el('small','mt-source-note','The Hero · стр. '+item.page))));b.title=item.text;row.append(b,btn('×','',()=>{state.quintessenceIds=state.quintessenceIds.filter(x=>x!==id);drawCharacter();localSave();},'Удалить квинтэссенцию '+item.name));quint.append(row);}
    quint.append(btn('+ Выбрать из книги','mt-add-quintessence',()=>catalogDialog('Квинтэссенции',quintessences,state.quintessenceIds,async ids=>{state.quintessenceIds=ids;drawCharacter();localSave();})));
    if(state.quintessences){const legacy=el('details','mt-details');legacy.append(el('summary','','Прежние записи'),el('p','',state.quintessences),btn('✎','',()=>editText('Прежние записи о квинтэссенциях',state.quintessences,async value=>{state.quintessences=value;drawCharacter();localSave();},2000)));quint.append(legacy);}growth.append(quint);article.append(growth);
    const storage=el('details','mt-details mt-storage-details');storage.append(el('summary','','Сохранение'));const info=el('div','mt-storage-info');const old=root.querySelector('.mt-prototype-note');if(old)info.append(old);storage.append(info);article.append(storage);preserveReplace(q('.mt-character-host'),article);
  }
  drawCharacter();

  function removeCard(card){deleted={card:structuredClone(card),index:state.cards.indexOf(card),selection:[...selected]};state.cards=state.cards.filter(c=>c!==card);q('.mt-undo').hidden=false;q('.mt-undo span').textContent='Карточка удалена.';drawInventory();refreshSelection();localSave();fit();}
  function drawInventory(){
    q('.mt-inventory-host').replaceChildren();
    for(const card of state.cards){const host=el('div','mt-card-slot');host.dataset.cardId=card.id;q('.mt-inventory-host').append(host);
      if(card.type==='theme'){drawLocal(card.theme,host,false,card);continue;}
      const article=el('article','mt-theme mt-backpack-card'),head=el('div','mt-theme-head');head.append(el('span','','Рюкзак'),btn('×','mt-remove-card',()=>removeCard(card),'Удалить карточку '+card.title));article.append(head);
      const title=btn(card.title||'Рюкзак','mt-backpack-title',()=>{});const editTitle=()=>editText('Название рюкзака',card.title,async value=>{card.title=value;drawInventory();localSave();},80);title.addEventListener('dblclick',editTitle);article.append(title,btn('✎','mt-edit-backpack-title',editTitle,'Изменить название рюкзака'));
      const items=el('div','mt-backpack-items');for(const item of card.items){const row=el('div','mt-item-row'+(item.scratched?' mt-scratched':''));const key=`card:${card.id}:${item.id}`;let timer;const text=btn(item.text,'mt-tag-text',()=>{});text.dataset.key=key;text.title=item.text;const edit=()=>editText('Тег рюкзака',item.text,async value=>{item.text=value;drawInventory();refreshSelection();localSave();});text.addEventListener('click',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(text.isConnected&&!item.scratched)select(key);},230);});text.addEventListener('dblclick',()=>{clearTimeout(timer);edit();});row.append(text,btn(item.scratched?'↶':'╱','mt-scratch',()=>{item.scratched=!item.scratched;drawInventory();refreshSelection();localSave();},'Зачеркнуть '+item.text),btn('✎','mt-edit-tag',edit,'Редактировать '+item.text),btn('×','mt-remove-item',()=>{card.items=card.items.filter(x=>x!==item);drawInventory();refreshSelection();localSave();},'Удалить тег '+item.text));items.append(row);}article.append(items);
      const form=el('form','mt-add-card-item'),input=el('input');input.maxLength=160;input.required=true;input.placeholder='Новый тег';input.setAttribute('aria-label','Новый тег рюкзака');const add=el('button','','+');add.type='submit';add.setAttribute('aria-label','Добавить тег рюкзака');form.append(input,add);form.addEventListener('submit',e=>{e.preventDefault();if(input.value.trim()&&card.items.length<50){card.items.push({id:makeId(),text:input.value.trim(),scratched:false});drawInventory();refreshSelection();localSave();}});article.append(form);
      const notes=el('details','mt-details mt-backpack-notes');notes.append(el('summary','','Записи'),field('Записи рюкзака',card.notes,v=>{card.notes=v;localSave();},2000,true).label);article.append(notes);host.append(article);
    }
    q('.mt-add-backpack').disabled=q('.mt-add-theme').disabled=state.cards.length>=30;
  }
  function addCard(type){if(state.cards.length>=30)return;state.cards.push(newCard(type));drawInventory();refreshSelection();localSave();fit();q('.mt-inventory-host').lastElementChild.scrollIntoView?.({block:'nearest',inline:'nearest'});}
  q('.mt-add-backpack').addEventListener('click',()=>addCard('bag'));q('.mt-add-theme').addEventListener('click',()=>addCard('theme'));
  q('.mt-undo button').addEventListener('click',()=>{if(deleted&&state.cards.length<30){state.cards.splice(deleted.index,0,deleted.card);deleted.selection.forEach(k=>selected.add(k));deleted=null;q('.mt-undo').hidden=true;drawInventory();refreshSelection();localSave();fit();}});
  drawInventory();
  const notes=q('#mt-notes-text');notes.value=state.notes;notes.addEventListener('input',()=>{state.notes=notes.value;localSave();});
  qa('.mt-add-action-tag').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.querySelector('input'),kind=form.dataset.kind;if(input.value.trim()&&state.actionExtras[kind].length<30){const item={id:makeId(),text:input.value.trim()};state.actionExtras[kind].push(item);selected.add(`extra:${kind}:${item.id}`);input.value='';refreshSelection();localSave();}}));
  q('.mt-clear').addEventListener('click',()=>{selected.clear();state.actionExtras={power:[],weakness:[]};refreshSelection();localSave();});
  q('.mt-close-sheet').addEventListener('click',()=>Promise.resolve().then(actions.close).catch(report));
  const tabs=qa('[role=tab]');function switchTab(button){activeTab=button.dataset.sheetTab;tabs.forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;q('#'+b.getAttribute('aria-controls')).hidden=!active;});fit();}
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>switchTab(b));b.addEventListener('keydown',e=>{const n=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(n!==null){e.preventDefault();switchTab(tabs[n]);tabs[n].focus();}});});
  function fit(){actions.fitWindow?.(activeTab==='themes'?4:activeTab==='notes'?1:2+state.cards.length);}
  refreshSelection();fit();
}
