import {createActionStatuses} from './action-statuses.js';
import {openCharacterPicker} from './character-picker.js';
import {mountBoardReturn} from './board-return.js';
import {createSheetTransfer} from './sheet-transfer.js';
import {openDiceTray} from './dice.js';
import {createActionPanel,createActionTagList,calculateAction} from './action-panel.js';
import {createScratchEffects} from './scratch-effects.js';
import {appendAutoSlot} from './auto-slots.js';
import {dressScroll} from './scroll-view.js';
import {createScrollMotion} from './scroll-motion.js';
import {createCardReorder} from './card-reorder.js';
import {mountNotes} from './notes-ui.js';
import {mountStatuses} from './status-ui.js';
import {SHEET_SCALE,renderedScale} from './sheet-scale.js';
import {mountAnimationSettings,syncAnimationSettings} from './animation-settings.js';
import packageInfo from '../package.json' with { type: 'json' };
import { newCard, makeId } from './storage.js';
import { makeTheme, getBook, quintessences, improvementById, tagKey } from './theme-model.js';
import { fellowshipDefaults } from './fellowship.js';
import { fellowshipTheme, fellowshipPatch } from './fellowship-model.js';
import { editorTools, renderTheme } from './editor-ui.js';

export function mountSheet(root,state,save,actions) {
  const tools=editorTools(root),{doc,el,btn,dialog,inlineText,scratchButton}=tools;
  const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
  const motion=createScrollMotion(root);
  const win=doc.defaultView,toolbar=q('.mt-toolbar'),sizeToolbar=()=>q('.mt-v4').style.setProperty('--toolbar-height',toolbar.getBoundingClientRect().height/SHEET_SCALE+'px');
  if(win.ResizeObserver){const observer=new win.ResizeObserver(sizeToolbar);observer.observe(toolbar);win.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}sizeToolbar();
  const selected=new Set(state.selected),expanded=new Map();
  let actionPinned=false;state.actionFieldKinds??={};const getActionSources=()=>actions.actionSources?.get()||{tags:new Map(),statuses:new Map()};
  let statusPanel;
  let specialAction=null,rollModifier=0,rolling=false,currentRoll=0,resizePending,selectionSequence=0;
  state.settings??={scrollAnimation:true,diceAnimation:true};
  syncAnimationSettings(root,state.settings);let settingsCardCount=()=>1,statusColumnCount=()=>1;
  let panelLayoutSequence=0;
  const actionPanel=createActionPanel(q('.mt-action-card'),visible=>{
    const sequence=++panelLayoutSequence,stage=q('.mt-stage');
    if(!visible){stage.classList.remove('mt-with-selection');return fit();}
    // Reserve the calculator column only once the host has room for it.
    const resized=fit(),reserve=()=>{if(sequence===panelLayoutSequence)stage.classList.add('mt-with-selection');};
    if(resized?.then)return Promise.resolve(resized).then(()=>new Promise(resolve=>win.requestAnimationFrame?win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)):resolve())).then(reserve);
    reserve();return resized;
  });
  let activeTab='party',shared=fellowshipDefaults(),sharedReady=false;
  const pendingShared=[];
  const sharedView=()=>Object.assign({},shared,...pendingShared.map(write=>write.patch));
  const service=actions.fellowship;
  const report=error=>{const node=q('.mt-ui-message');node.hidden=false;node.textContent=error?.message||String(error);};
  function localSave(){state.selected=[...selected];save();void actions.board?.syncCharacter?.(state.name).catch(report);}
  function allTags(){
    const tags=new Map();const addTheme=t=>{for(const kind of ['power','weakness'])t[kind].forEach((slot,i)=>{if(slot.text&&!slot.scratched)tags.set(tagKey(t,kind,i),{text:slot.text,kind,source:getBook(t.bookId).name});});};
    state.heroThemes.forEach(addTheme);if(sharedReady)addTheme(fellowshipTheme(sharedView()));
    state.cards.forEach(c=>{if(c.type==='theme')addTheme(c.theme);else c.items.forEach(item=>{if(item.text.trim()&&!item.scratched)tags.set(`card:${c.id}:${item.id}`,{text:item.text,kind:'power',source:c.title});});});
    state.relationships.forEach(r=>{if(r.tag)tags.set('relationship:'+r.id,{text:r.tag,kind:'power',source:r.companion});});
    for(const kind of ['power','weakness'])state.actionExtras[kind].forEach(x=>tags.set(`extra:${kind}:${x.id}`,{text:x.text,kind,source:'Тег действия'}));
    for(const [key,item]of getActionSources().tags)tags.set(key,{...item,kind:item.forced?item.kind:state.actionFieldKinds[key]||item.kind});
    return tags;
  }
  const actionLists=Object.fromEntries(['power','weakness'].map(kind=>[kind,createActionTagList(q('.mt-action-list[data-kind="'+kind+'"]'),(key,item)=>{
    const row=el('div','mt-action-tag'+(item.forced?' mt-auto-action-tag':''));const text=btn(item.text,'',()=>select(key));text.title=item.source;text.disabled=!!item.forced;row.append(text);if(!item.forced)row.append(btn('×','',()=>{selected.delete(key);if(key.startsWith('extra:'))state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);refreshSelection();localSave();},'Убрать '+item.text));return row;
  },kind==='power'?'Выбери подходящие теги силы':'Выбери мешающие теги слабости')]));
  function refreshSelection(){
    const tags=allTags();for(const key of selected)if(!tags.has(key)&&!(key.startsWith('theme:fellowship:')&&!sharedReady))selected.delete(key);
    qa('[data-key]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.key))));
    const chosenKeys=new Set([...selected,...[...tags].filter(([,item])=>item.forced).map(([key])=>key)]);
    const statusResult=statusPanel?.render()||{values:[],bonus:0};
    const pendingRemovals=[];
    for(const kind of ['power','weakness']){
      const pending=actionLists[kind].sync([...chosenKeys].map(key=>[key,tags.get(key)]).filter(([,item])=>item?.kind===kind));if(pending)pendingRemovals.push(pending);
    }
    state.selected=[...selected];
    const chosen=[...chosenKeys].map(key=>tags.get(key)).filter(Boolean);
    const base=chosen.reduce((n,t)=>n+(t.kind==='power'?1:-1),0)+statusResult.bonus;
    if(!chosen.length&&!statusResult.values.length){specialAction=null;rollModifier=0;q('.mt-roll-modifier').value='0';}

    const result=calculateAction(base,specialAction,rollModifier);currentRoll=result.roll;
    q('.mt-action-power-value').textContent=result.power===null?'—':result.power;
    q('.mt-action-roll-value').textContent=(result.roll>0?'+':'')+result.roll;
    qa('[data-special]').forEach(button=>{const active=specialAction===button.dataset.special;button.setAttribute('aria-pressed',String(active));button.querySelector('span').textContent=active?'◆':'◇';button.disabled=false;});
    const hideForTab=['notes','settings','statuses'].includes(activeTab)&&!actionPinned;q('.mt-open-action').setAttribute('aria-pressed',String(actionPinned));actionPanel.show((chosen.length>0||statusResult.values.length>0||actionPinned)&&!hideForTab,hideForTab,pendingRemovals.length?Promise.allSettled(pendingRemovals):undefined);
  }
  function select(key){
    if(selected.has(key)){selected.delete(key);if(key.startsWith('extra:'))for(const kind of ['power','weakness'])state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);}else selected.add(key);
    refreshSelection();localSave();
    const sequence=++selectionSequence,panel=q('#panel-'+activeTab);
    // The calculator can narrow the row before Owlbear finishes resizing its host.
    const keepVisible=()=>{
      if(sequence!==selectionSequence||panel.hidden)return;
      const tag=[...panel.querySelectorAll('.mt-tag-text[data-key]')].find(node=>node.dataset.key===key),card=tag?.closest('.mt-scroll-frame'),row=card?.closest('.mt-card-row');
      if(!row)return;const bounds=card.getBoundingClientRect(),viewport=row.getBoundingClientRect(),scale=renderedScale(root),margin=8*scale;
      if(bounds.right>viewport.right-margin)row.scrollLeft+=(bounds.right-viewport.right+margin)/scale;
      else if(bounds.left<viewport.left+margin)row.scrollLeft+=(bounds.left-viewport.left-margin)/scale;
    };
    if(resizePending?.then)Promise.resolve(resizePending).then(()=>new Promise(resolve=>win.requestAnimationFrame?win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)):resolve())).then(keepVisible).catch(report);
    else keepVisible();
  }
  function preserveReplace(host,node){if(host.querySelector('.mt-inline-editor')){host._pendingCard=node;return;}const scroll=host.querySelector('.mt-scroll-body')?.scrollTop||0,flowScroll=host.querySelector('.mt-scroll-flow')?.scrollTop||0;host.replaceChildren(node);const body=node.querySelector('.mt-scroll-body'),flow=node.querySelector('.mt-scroll-flow');if(body)body.scrollTop=scroll;if(flow)flow.scrollTop=flowScroll;}
  function mutateTheme(t,change){if(change.kind)t[change.kind][change.index][change.field]=change.value;else t[change.field]=change.value;}
  function themeContext(t,host,core=false,card){
    return {core,isSelected:key=>selected.has(key),select,report,expanded:expanded.get(t.id),onExpand:open=>{expanded.set(t.id,open);return fit();},
      change:async change=>{mutateTheme(t,change);drawLocal(t,host,core,card);refreshSelection();localSave();},
      replace:core?async(bookId,reset)=>{const replacement=reset?makeTheme(bookId,t.id):{...structuredClone(t),bookId};const b=getBook(bookId);if(reset&&b.might!=='variable')replacement.might=b.might;Object.assign(t,replacement);drawLocal(t,host,core,card);refreshSelection();localSave();}:null,
      remove:card?()=>removeCard(card):null};
  }
  function drawLocal(t,host,core=false,card){preserveReplace(host,renderTheme(t,themeContext(t,host,core,card),tools));}
  state.heroThemes.forEach(t=>{const host=el('div','mt-card-slot');q('.mt-themes').append(host);drawLocal(t,host,true);});

  function drawShared(){
    const t=fellowshipTheme(sharedView()),host=q('.mt-fellowship-host'),current=host.querySelector('.mt-fellowship-theme');
    if(current?.updateTheme){current.updateTheme(t,{disabled:!sharedReady});current.setAttribute('aria-busy',String(pendingShared.length>0));return;}
    const card=renderTheme(t,{isSelected:key=>selected.has(key),select,report,busy:!sharedReady,
      expanded:expanded.get(t.id),onExpand:open=>{expanded.set(t.id,open);return fit();},shared:true,
      change:async change=>{
        const write={patch:fellowshipPatch(change)},before=new Set(selected);pendingShared.push(write);drawShared();refreshSelection();
        const removed=[...before].filter(key=>key.startsWith('theme:fellowship:')&&!selected.has(key));
        try{await service.update(write.patch);}
        catch(error){pendingShared.splice(pendingShared.indexOf(write),1);drawShared();const available=allTags();removed.forEach(key=>{if(available.has(key))selected.add(key);});refreshSelection();throw error;}
        pendingShared.splice(pendingShared.indexOf(write),1);drawShared();refreshSelection();
      }},tools);card.setAttribute('aria-busy',String(pendingShared.length>0));preserveReplace(host,card);
  }
  drawShared();
  if(service){service.subscribe((value,ready)=>{shared=value;sharedReady=ready;drawShared();refreshSelection();});void service.start().catch(error=>{drawShared();report(error);const retry=btn('Повторить','mt-retry-shared',()=>{retry.disabled=true;void service.start().then(()=>retry.remove()).catch(e=>{report(e);retry.disabled=false;});});q('.mt-fellowship-host .mt-theme').append(retry);});}
  else {drawShared();}

  function field(label,value,onInput,max=80,multi=false){const l=el('label','mt-field');l.append(el('span','',label));const input=el(multi?'textarea':'input');input.value=value;input.maxLength=max;if(multi)input.rows=2;input.addEventListener('input',()=>onInput(input.value));l.append(input);return {label:l,input};}
  function drawCharacter(){
    state.relationships=state.relationships.filter(r=>r.companion.trim()||r.tag.trim());
    const article=el('article','mt-theme mt-character-card');const head=el('div','mt-theme-head');head.append(el('span','','Персонаж'));article.append(head);
    const body=el('div','mt-character-body');const name=field('Имя героя',state.name,value=>{state.name=value;localSave();},80,true);name.input.className='mt-editor-name';
    if(actions.characters){const choose=btn('Выбрать','mt-character-select',e=>{e.preventDefault();openCharacterPicker(root,actions.characters,actions.reloadSheet);},'Выбрать персонажа');name.input.setAttribute('aria-label','Имя героя');name.label.firstElementChild.append(choose);}
    const player=field('Имя игрока',state.playerName,value=>{state.playerName=value;localSave();});player.input.className='mt-editor-name mt-player-name';body.append(name.label,player.label);
    const relationships=el('section','mt-relationships');relationships.setAttribute('aria-label','Отношения в братстве');relationships.append(el('h4','mt-relationships-heading','Отношения в братстве'));
    function relationshipRow(r){const row=el('div','mt-relationship');let timer;const tag=btn(r.tag||'Тег отношения','',()=>{clearTimeout(timer);if(r.tag)timer=setTimeout(()=>{if(tag.isConnected)select('relationship:'+r.id);},230);});tag.dataset.key='relationship:'+r.id;tag.title=r.companion;tag.addEventListener('dblclick',()=>{clearTimeout(timer);editRelationship();});
      function editRelationship(){inlineText(tag,r.tag,async value=>{r.tag=value;drawCharacter();refreshSelection();localSave();},80,'Тег отношения');}
      const companion=el('small','',r.companion||'Спутник');companion.title='Двойное нажатие — изменить';companion.addEventListener('dblclick',()=>inlineText(companion,r.companion,async value=>{r.companion=value;drawCharacter();localSave();},80,'Спутник'));
      row.append(companion,tag,btn('×','',()=>{state.relationships=state.relationships.filter(x=>x!==r);drawCharacter();refreshSelection();localSave();},'Удалить отношение'));return row;
    }
    state.relationships.forEach(r=>relationships.append(relationshipRow(r)));
    appendAutoSlot(relationships,{fields:[{key:'companion',label:'Спутник',max:80},{key:'tag',label:'Тег отношения',max:80}],items:state.relationships,limit:20,create:()=>({id:makeId(),companion:'',tag:''}),save:localSave,refresh:refreshSelection,remove:r=>{state.relationships=state.relationships.filter(x=>x!==r);drawCharacter();refreshSelection();localSave();},commit:(r,row)=>{row.replaceWith(relationshipRow(r));refreshSelection();},className:'mt-relationship'});body.append(relationships);article.append(body);
    const growth=el('div','mt-hero-growth');growth.append(el('span','mt-tag-label','ПОТЕНЦИАЛ'));const pips=el('div','mt-promise');for(let i=1;i<=5;i++){const b=btn(i<=state.promise?'◆':'◇','mt-pip',()=>{state.promise=i===state.promise?i-1:i;drawCharacter();localSave();},'Потенциал '+i);b.setAttribute('aria-pressed',String(i<=state.promise));pips.append(b);}growth.append(pips);
    const quint=el('div','mt-improvements mt-quintessences');quint.setAttribute('aria-label','Квинтэссенции');
    for(const item of quintessences){const active=state.quintessenceIds.includes(item.id),row=el('div','mt-improvement-row'+(!active?' mt-inactive-improvement':''));
      const toggle=btn(active?'◆':'◇','mt-improvement-toggle',()=>{state.quintessenceIds=active?state.quintessenceIds.filter(x=>x!==item.id):[...state.quintessenceIds,item.id];drawCharacter();localSave();},'Активировать '+item.name);toggle.setAttribute('aria-pressed',String(active));
      const title=btn(item.name,'mt-improvement-title',()=>dialog(item.name,form=>form.append(el('p','',item.text),el('small','mt-source-note','Герой · стр. '+item.page))));title.title=item.text;row.append(toggle,title);quint.append(row);
    }
    if(state.quintessences){const legacy=el('details','mt-details'),copy=el('p','',state.quintessences);copy.title='Двойное нажатие — изменить';copy.addEventListener('dblclick',()=>inlineText(copy,state.quintessences,async value=>{state.quintessences=value;drawCharacter();localSave();},2000,'Прежние записи о квинтэссенциях'));legacy.append(el('summary','','Прежние записи'),copy);quint.append(legacy);}article.append(growth,quint);
    preserveReplace(q('.mt-character-host'),dressScroll(article,{flowingFooter:true,extensionLabel:'Квинтэссенции',expanded:expanded.get('quint')||false,onExpand:open=>{expanded.set('quint',open);return fit();}}));
  }
  drawCharacter();

  function removeCard(card){if(card.type==='bag'&&card.id==='original-backpack')return;state.cards=state.cards.filter(c=>c!==card);drawInventory();refreshSelection();localSave();fit();}
  function drawInventory(){
    q('.mt-inventory-host').replaceChildren();
    for(const card of state.cards){const host=el('div','mt-card-slot');host.dataset.cardId=card.id;q('.mt-inventory-host').append(host);
      if(card.type==='theme'){drawLocal(card.theme,host,false,card);continue;}
      card.items=card.items.filter(item=>item.text.trim());
      const primary=card.id==='original-backpack',article=el('article','mt-theme mt-backpack-card'+(primary?' mt-primary-backpack':' mt-storage-card')),head=el('div','mt-theme-head');
      if(primary)head.append(el('span','','Рюкзак'));
      else {const title=btn(card.title||'Хранилище','mt-storage-title',()=>{});title.title='Двойное нажатие — изменить название';title.addEventListener('dblclick',()=>inlineText(title,card.title,async value=>{card.title=value;drawInventory();localSave();},80,'Название хранилища'));head.append(title,btn('×','mt-remove-card',()=>removeCard(card),'Удалить хранилище '+card.title));}
      article.append(head);
      const items=el('div','mt-backpack-items');function itemRow(item){const row=el('div','mt-item-row mt-tag-row'+(item.scratched?' mt-scratched':''));const key=`card:${card.id}:${item.id}`;let timer;const text=btn(item.text,'mt-tag-text',()=>{});text.dataset.key=key;text.title=item.text;const edit=()=>inlineText(text,item.text,async value=>{item.text=value;drawInventory();refreshSelection();localSave();},160,'Тег рюкзака');text.addEventListener('click',e=>{if(e.detail===0){if(!item.scratched)select(key);return;}clearTimeout(timer);timer=setTimeout(()=>{if(text.isConnected&&!item.scratched)select(key);},230);});text.addEventListener('dblclick',()=>{clearTimeout(timer);edit();});row.append(text,scratchButton(item.scratched,()=>{item.scratched=!item.scratched;drawInventory();refreshSelection();localSave();},(item.scratched?'Восстановить ':'Зачеркнуть ')+item.text),btn('×','mt-remove-item',()=>{card.items=card.items.filter(x=>x!==item);drawInventory();refreshSelection();localSave();},'Удалить тег '+item.text));return row;}card.items.forEach(item=>items.append(itemRow(item)));article.append(items);
      appendAutoSlot(items,{fields:[{key:'text',label:'Новый тег рюкзака',max:160}],items:card.items,limit:50,create:()=>({id:makeId(),text:'',scratched:false}),save:localSave,refresh:refreshSelection,remove:item=>{card.items=card.items.filter(x=>x!==item);drawInventory();refreshSelection();localSave();},commit:(item,row)=>{row.replaceWith(itemRow(item));refreshSelection();},className:'mt-item-row mt-tag-row'});
      host.append(dressScroll(article));
    }
    q('.mt-add-backpack').disabled=q('.mt-add-theme').disabled=state.cards.length>=30;
  }
  function addCard(type){
    if(state.cards.length>=30)return;
    motion.stop();state.cards.push(newCard(type));drawInventory();refreshSelection();localSave();
    const card=q('.mt-inventory-host').lastElementChild.querySelector('.mt-scroll-frame');
    motion.unfold(card,fit(),()=>{const row=card.closest('.mt-card-row');row.scrollLeft=Math.max(0,row.scrollWidth-row.clientWidth);});
  }
  q('.mt-add-backpack').addEventListener('click',()=>addCard('bag'));q('.mt-add-theme').addEventListener('click',()=>addCard('theme'));
  drawInventory();
  const layoutNotes=mountNotes(root,state,localSave,fit,tools);
  const layoutStatuses=mountStatuses(root,state,()=>{refreshSelection();localSave();},fit,tools);
  statusColumnCount=layoutStatuses.columns;
  statusPanel=createActionStatuses(q('.mt-action-statuses'),state,getActionSources,()=>{refreshSelection();localSave();},tools);
  q('.mt-open-action').addEventListener('click',()=>{actionPinned=!actionPinned;refreshSelection();});
  function pickFieldTag(kind){dialog('Добавить тег с поля',(form,close)=>{const search=el('input');search.placeholder='Найти тег';search.setAttribute('aria-label','Найти тег с поля');const list=el('div','mt-action-source-options');function draw(){list.replaceChildren();for(const [key,item]of getActionSources().tags){if(item.forced||!item.text.toLowerCase().includes(search.value.toLowerCase()))continue;const add=btn(item.text,'',()=>{state.actionFieldKinds[key]=kind;selected.add(key);refreshSelection();localSave();close();});add.title=item.source;list.append(add);}if(!list.childElementCount)list.append(el('p','','На поле нет подходящих тегов.'));}search.addEventListener('input',draw);form.append(search,list);draw();});}
  qa('.mt-add-action-tag').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.querySelector('input'),kind=form.dataset.kind;if(!input.value.trim()){pickFieldTag(kind);return;}if(input.value.trim()&&state.actionExtras[kind].length<30){const item={id:makeId(),text:input.value.trim()};state.actionExtras[kind].push(item);selected.add(`extra:${kind}:${item.id}`);input.value='';refreshSelection();localSave();}}));
  settingsCardCount=mountAnimationSettings(root,state,localSave,fit,motion,tools);
  dressScroll(q('.mt-settings-card'));
  q('.mt-roll-dice').addEventListener('click',async()=>{
    if(rolling)return;rolling=true;const button=q('.mt-roll-dice');button.disabled=true;
    const bonus=currentRoll,sacrifice=specialAction==='sacrifice';
    const onFirstResult=()=>{selected.clear();statusPanel.clear();state.actionExtras={power:[],weakness:[]};refreshSelection();localSave();};
    try{await openDiceTray(root,{bonus,sacrifice,onFirstResult,animated:state.settings.diceAnimation&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches});}
    catch(error){report(error);}finally{rolling=false;button.disabled=false;fit();}
  });
  qa('[data-special]').forEach(button=>button.addEventListener('click',()=>{specialAction=specialAction===button.dataset.special?null:button.dataset.special;refreshSelection();}));
  q('.mt-roll-modifier').addEventListener('input',e=>{rollModifier=Math.max(-99,Math.min(99,Math.trunc(Number(e.target.value)||0)));refreshSelection();});
  q('.mt-clear').addEventListener('click',()=>{selected.clear();statusPanel.clear();state.actionExtras={power:[],weakness:[]};state.actionFieldKinds={};specialAction=null;rollModifier=0;q('.mt-roll-modifier').value='0';refreshSelection();localSave();});
  q('.mt-close-sheet').addEventListener('click',()=>Promise.resolve().then(actions.close).catch(report));
  let switchSequence=0;
  function reveal(panel){const sequence=++switchSequence;motion.stop();panel.style.visibility='hidden';Promise.resolve(fit()).then(()=>new Promise(resolve=>{const win=root.ownerDocument.defaultView;if(win.requestAnimationFrame)win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve));else resolve();})).then(()=>{if(sequence!==switchSequence)return;motion.play(panel);panel.style.visibility='';}).catch(error=>{if(sequence===switchSequence)panel.style.visibility='';report(error);});}
  const tabs=qa('[role=tab]');function switchTab(button){const changed=activeTab!==button.dataset.sheetTab;activeTab=button.dataset.sheetTab;tabs.forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;q('#'+b.getAttribute('aria-controls')).hidden=!active;});q('.mt-row-actions').hidden=activeTab!=='party';q('.mt-status-actions').hidden=activeTab!=='statuses';refreshSelection();if(activeTab==='notes')layoutNotes();if(activeTab==='statuses')layoutStatuses();if(changed)reveal(q('#panel-'+activeTab));}
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>switchTab(b));b.addEventListener('keydown',e=>{const n=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(n!==null){e.preventDefault();switchTab(tabs[n]);tabs[n].focus();}});});
  function fit(){
    if(rolling)return;
    const openCards=[...q('#panel-'+activeTab).querySelectorAll('.mt-scroll-frame:has(.mt-scroll-toggle[aria-expanded=true])')];
    if(!q('.mt-action-card').hidden&&q('.mt-action-card .mt-scroll-toggle[aria-expanded=true]'))openCards.push(q('.mt-action-card'));
    const requestedHeight=Math.max(650*SHEET_SCALE,...openCards.map(card=>(card.querySelector('.mt-scroll-main').scrollHeight+card.querySelector('.mt-scroll-extension-inner').scrollHeight+78+44)*SHEET_SCALE+toolbar.getBoundingClientRect().height));
    const rowActions=[...toolbar.querySelectorAll('.mt-row-actions')].find(node=>!node.hidden);
    const minimumWidth=Math.max(480,q('.mt-tabs').scrollWidth+(rowActions?rowActions.scrollWidth+6:0)+16)*SHEET_SCALE;
    return resizePending=actions.fitWindow?.(activeTab==='themes'?Math.max(1,[...q('.mt-themes').children].filter(n=>n.dataset.onBoard!=='true').length):activeTab==='settings'?settingsCardCount():activeTab==='statuses'?statusColumnCount():activeTab==='notes'?1+state.noteCards.filter(c=>c.open).length:Math.max(1,[...q('#panel-party').querySelectorAll('.mt-card-slot')].filter(n=>n.dataset.onBoard!=='true').length),!q('.mt-action-card').hidden,requestedHeight,minimumWidth);
  }
  qa('[role=tabpanel]').forEach(panel=>{const version=el('div','mt-sheet-version','v'+packageInfo.version);panel.querySelector('.mt-card-row').after(version);});
  dressScroll(q('.mt-action-card'),{extensionLabel:'Особые действия',onExpand:fit});refreshSelection();createScratchEffects(root);if(actions.actionSources){const off=actions.actionSources.subscribe(()=>refreshSelection());win.addEventListener('pagehide',off,{once:true});}
  let transfer;
  if(actions.board)transfer=createSheetTransfer(root,state,save,{scene:actions.board,resize:actions.boardResize,toScene:actions.boardPoint,getShared:()=>sharedReady?sharedView():null,fit,report,
   redraw:key=>{if(key==='character')drawCharacter();else if(key.startsWith('card:'))drawInventory();else if(key.startsWith('theme:')){const t=state.heroThemes.find(t=>'theme:'+t.id===key),host=[...q('.mt-themes').children].find(h=>h.querySelector('[data-theme-id]')?.dataset.themeId===t?.id);if(t&&host)drawLocal(t,host,true);}else if(key.startsWith('status:'))layoutStatuses.draw();else if(key.startsWith('note:'))layoutNotes.draw();refreshSelection();}
  });
  if(actions.board){const offReturn=mountBoardReturn(root,actions.board,{fit,report});win.addEventListener('pagehide',offReturn,{once:true});}
  state.cardOrder??={};createCardReorder(root,{getOrder:key=>state.cardOrder[key],setOrder:(key,order)=>{state.cardOrder[key]=order;localSave();fit();},transfer,beforeDrag:()=>motion.stop()});
  reveal(q('#panel-party'));
}
