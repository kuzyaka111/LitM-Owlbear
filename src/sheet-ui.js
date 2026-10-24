import {openDiceTray} from './dice.js';
import {createActionPanel,createActionTagList,calculateAction} from './action-panel.js';
import {createScratchEffects} from './scratch-effects.js';
import {appendAutoSlot} from './auto-slots.js';
import {dressScroll} from './scroll-view.js';
import {createScrollMotion} from './scroll-motion.js';
import {mountNotes} from './notes-ui.js';
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
  const win=doc.defaultView,toolbar=q('.mt-toolbar'),sizeToolbar=()=>q('.mt-v4').style.setProperty('--toolbar-height',toolbar.getBoundingClientRect().height+'px');
  if(win.ResizeObserver){const observer=new win.ResizeObserver(sizeToolbar);observer.observe(toolbar);win.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}sizeToolbar();
  const selected=new Set(state.selected),expanded=new Map();
  let specialAction=null,rollModifier=0,rolling=false,currentRoll=0,resizePending,selectionSequence=0;
  state.settings??={scrollAnimation:true,diceAnimation:true};
  q('.mt-v4').dataset.scrollAnimation=state.settings.scrollAnimation?'on':'off';
  const actionPanel=createActionPanel(q('.mt-action-card'),visible=>{q('.mt-stage').classList.toggle('mt-with-selection',visible);return fit();});
  let activeTab='party',shared=fellowshipDefaults(),sharedReady=false,sharedBusy=false;
  const service=actions.fellowship;
  const report=error=>{const node=q('.mt-ui-message');node.hidden=false;node.textContent=error?.message||String(error);};
  function localSave(){state.selected=[...selected];save();}
  function allTags(){
    const tags=new Map();const addTheme=t=>{for(const kind of ['power','weakness'])t[kind].forEach((slot,i)=>{if(slot.text&&!slot.scratched)tags.set(tagKey(t,kind,i),{text:slot.text,kind,source:getBook(t.bookId).name});});};
    state.heroThemes.forEach(addTheme);if(sharedReady)addTheme(fellowshipTheme(shared));
    state.cards.forEach(c=>{if(c.type==='theme')addTheme(c.theme);else c.items.forEach(item=>{if(item.text.trim()&&!item.scratched)tags.set(`card:${c.id}:${item.id}`,{text:item.text,kind:'power',source:c.title});});});
    state.relationships.forEach(r=>{if(r.tag)tags.set('relationship:'+r.id,{text:r.tag,kind:'power',source:r.companion});});
    for(const kind of ['power','weakness'])state.actionExtras[kind].forEach(x=>tags.set(`extra:${kind}:${x.id}`,{text:x.text,kind,source:'Тег действия'}));
    return tags;
  }
  const actionLists=Object.fromEntries(['power','weakness'].map(kind=>[kind,createActionTagList(q('.mt-action-list[data-kind="'+kind+'"]'),(key,item)=>{
    const row=el('div','mt-action-tag');const text=btn(item.text,'',()=>select(key));text.title=item.source;row.append(text,btn('×','',()=>{selected.delete(key);if(key.startsWith('extra:'))state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);refreshSelection();localSave();},'Убрать '+item.text));return row;
  },kind==='power'?'Выбери подходящие теги силы':'Выбери мешающие теги слабости')]));
  function refreshSelection(){
    const tags=allTags();for(const key of selected)if(!tags.has(key)&&!(key.startsWith('theme:fellowship:')&&!sharedReady))selected.delete(key);
    qa('[data-key]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.key))));
    const pendingRemovals=[];
    for(const kind of ['power','weakness']){
      const pending=actionLists[kind].sync([...selected].map(key=>[key,tags.get(key)]).filter(([,item])=>item?.kind===kind));if(pending)pendingRemovals.push(pending);
    }
    q('.mt-clear').disabled=!selected.size;state.selected=[...selected];
    const chosen=[...selected].map(key=>tags.get(key)).filter(Boolean);
    const base=chosen.reduce((n,t)=>n+(t.kind==='power'?1:-1),0);
    if(!chosen.length){specialAction=null;rollModifier=0;q('.mt-roll-modifier').value='0';}

    const result=calculateAction(base,specialAction,rollModifier);currentRoll=result.roll;
    q('.mt-action-power-value').textContent=result.power===null?'—':result.power;
    q('.mt-action-roll-value').textContent=(result.roll>0?'+':'')+result.roll;
    qa('[data-special]').forEach(button=>{const active=specialAction===button.dataset.special;button.setAttribute('aria-pressed',String(active));button.querySelector('span').textContent=active?'◆':'◇';button.disabled=false;});
    const hideForTab=activeTab==='notes'||activeTab==='settings';actionPanel.show(chosen.length>0&&!hideForTab,hideForTab,pendingRemovals.length?Promise.allSettled(pendingRemovals):undefined);
  }
  function select(key){
    if(selected.has(key)){selected.delete(key);if(key.startsWith('extra:'))for(const kind of ['power','weakness'])state.actionExtras[kind]=state.actionExtras[kind].filter(x=>`extra:${kind}:${x.id}`!==key);}else selected.add(key);
    refreshSelection();localSave();
    const sequence=++selectionSequence,panel=q('#panel-'+activeTab);
    // The calculator can narrow the row before Owlbear finishes resizing its host.
    Promise.resolve(resizePending).then(()=>new Promise(resolve=>win.requestAnimationFrame?win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)):resolve())).then(()=>{
      if(sequence!==selectionSequence||panel.hidden)return;
      const tag=[...panel.querySelectorAll('.mt-tag-text[data-key]')].find(node=>node.dataset.key===key),card=tag?.closest('.mt-scroll-frame'),row=card?.closest('.mt-card-row');
      if(!row)return;const bounds=card.getBoundingClientRect(),viewport=row.getBoundingClientRect();
      if(bounds.right>viewport.right-8)row.scrollLeft+=bounds.right-viewport.right+8;
      else if(bounds.left<viewport.left+8)row.scrollLeft+=bounds.left-viewport.left-8;
    }).catch(report);
  }
  function preserveReplace(host,node){if(host.querySelector('.mt-inline-editor')){host._pendingCard=node;return;}const scroll=host.querySelector('.mt-scroll-body')?.scrollTop||0;host.replaceChildren(node);const body=node.querySelector('.mt-scroll-body');if(body)body.scrollTop=scroll;}
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
    const t=fellowshipTheme(shared);preserveReplace(q('.mt-fellowship-host'),renderTheme(t,{isSelected:key=>selected.has(key),select,report,busy:!sharedReady||sharedBusy,
      expanded:expanded.get(t.id),onExpand:open=>{expanded.set(t.id,open);return fit();},shared:true,
      change:async change=>{sharedBusy=true;drawShared();
        try{await service.update(fellowshipPatch(change));}
        catch(e){throw e;}finally{sharedBusy=false;drawShared();refreshSelection();}
      }},tools));
  }
  drawShared();
  if(service){service.subscribe((value,ready)=>{shared=value;sharedReady=ready;drawShared();refreshSelection();});void service.start().catch(error=>{drawShared();report(error);const retry=btn('Повторить','mt-retry-shared',()=>{retry.disabled=true;void service.start().then(()=>retry.remove()).catch(e=>{report(e);retry.disabled=false;});});q('.mt-fellowship-host .mt-theme').append(retry);});}
  else {drawShared();}

  function field(label,value,onInput,max=80,multi=false){const l=el('label','mt-field');l.append(el('span','',label));const input=el(multi?'textarea':'input');input.value=value;input.maxLength=max;if(multi)input.rows=2;input.addEventListener('input',()=>onInput(input.value));l.append(input);return {label:l,input};}
  function drawCharacter(){
    state.relationships=state.relationships.filter(r=>r.companion.trim()||r.tag.trim());
    const article=el('article','mt-theme mt-character-card');const head=el('div','mt-theme-head');head.append(el('span','','Персонаж'));article.append(head);
    const body=el('div','mt-character-body');const name=field('Имя героя',state.name,value=>{state.name=value;localSave();},80,true);name.input.className='mt-editor-name';
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
    const quint=el('details','mt-details mt-quintessences');quint.open=expanded.get('quint')||false;quint.addEventListener('toggle',()=>expanded.set('quint',quint.open));quint.append(el('summary','','Квинтэссенции · '+state.quintessenceIds.length));
    for(const item of quintessences){const active=state.quintessenceIds.includes(item.id),row=el('div','mt-improvement-row'+(!active?' mt-inactive-improvement':''));
      const toggle=btn(active?'◆':'◇','mt-improvement-toggle',()=>{state.quintessenceIds=active?state.quintessenceIds.filter(x=>x!==item.id):[...state.quintessenceIds,item.id];drawCharacter();localSave();},'Активировать '+item.name);toggle.setAttribute('aria-pressed',String(active));
      const title=btn(item.name,'mt-improvement-title',()=>dialog(item.name,form=>form.append(el('p','',item.text),el('small','mt-source-note','The Hero · стр. '+item.page))));title.title=item.text;row.append(toggle,title);quint.append(row);
    }
    if(state.quintessences){const legacy=el('details','mt-details'),copy=el('p','',state.quintessences);copy.title='Двойное нажатие — изменить';copy.addEventListener('dblclick',()=>inlineText(copy,state.quintessences,async value=>{state.quintessences=value;drawCharacter();localSave();},2000,'Прежние записи о квинтэссенциях'));legacy.append(el('summary','','Прежние записи'),copy);quint.append(legacy);}growth.append(quint);article.append(growth);
    preserveReplace(q('.mt-character-host'),dressScroll(article));
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
      const items=el('div','mt-backpack-items');function itemRow(item){const row=el('div','mt-item-row'+(item.scratched?' mt-scratched':''));const key=`card:${card.id}:${item.id}`;let timer;const text=btn(item.text,'mt-tag-text',()=>{});text.dataset.key=key;text.title=item.text;const edit=()=>inlineText(text,item.text,async value=>{item.text=value;drawInventory();refreshSelection();localSave();},160,'Тег рюкзака');text.addEventListener('click',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(text.isConnected&&!item.scratched)select(key);},230);});text.addEventListener('dblclick',()=>{clearTimeout(timer);edit();});row.append(text,scratchButton(item.scratched,()=>{item.scratched=!item.scratched;drawInventory();refreshSelection();localSave();},(item.scratched?'Восстановить ':'Зачеркнуть ')+item.text),btn('×','mt-remove-item',()=>{card.items=card.items.filter(x=>x!==item);drawInventory();refreshSelection();localSave();},'Удалить тег '+item.text));return row;}card.items.forEach(item=>items.append(itemRow(item)));article.append(items);
      appendAutoSlot(items,{fields:[{key:'text',label:'Новый тег рюкзака',max:160}],items:card.items,limit:50,create:()=>({id:makeId(),text:'',scratched:false}),save:localSave,refresh:refreshSelection,remove:item=>{card.items=card.items.filter(x=>x!==item);drawInventory();refreshSelection();localSave();},commit:(item,row)=>{row.replaceWith(itemRow(item));refreshSelection();},className:'mt-item-row'});
      const notes=el('details','mt-details mt-backpack-notes');notes.append(el('summary','','Записи'),field('Записи рюкзака',card.notes,v=>{card.notes=v;localSave();},2000,true).label);article.append(notes);host.append(dressScroll(article));
    }
    q('.mt-add-backpack').disabled=q('.mt-add-theme').disabled=state.cards.length>=30;
  }
  function addCard(type){if(state.cards.length>=30)return;state.cards.push(newCard(type));drawInventory();refreshSelection();localSave();fit();q('.mt-inventory-host').lastElementChild.scrollIntoView?.({block:'nearest',inline:'nearest'});}
  q('.mt-add-backpack').addEventListener('click',()=>addCard('bag'));q('.mt-add-theme').addEventListener('click',()=>addCard('theme'));
  drawInventory();
  const layoutNotes=mountNotes(root,state,localSave,fit,tools);
  qa('.mt-add-action-tag').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const input=form.querySelector('input'),kind=form.dataset.kind;if(input.value.trim()&&state.actionExtras[kind].length<30){const item={id:makeId(),text:input.value.trim()};state.actionExtras[kind].push(item);selected.add(`extra:${kind}:${item.id}`);input.value='';refreshSelection();localSave();}}));
  for(const [key,label] of [['scrollAnimation','Анимация свитков'],['diceAnimation','Анимация бросков']]){
    const button=btn('','mt-setting',()=>{state.settings[key]=!state.settings[key];sync();q('.mt-v4').dataset.scrollAnimation=state.settings.scrollAnimation?'on':'off';motion.stop();localSave();});
    function sync(){button.replaceChildren(el('span','',state.settings[key]?'◆':'◇'),el('span','',label));button.setAttribute('aria-pressed',String(state.settings[key]));}sync();q('.mt-settings-list').append(button);
  }
  dressScroll(q('.mt-settings-card'));
  q('.mt-roll-dice').addEventListener('click',async()=>{
    if(rolling)return;rolling=true;const button=q('.mt-roll-dice');button.disabled=true;
    const bonus=currentRoll,sacrifice=specialAction==='sacrifice';
    const onFirstResult=()=>{selected.clear();state.actionExtras={power:[],weakness:[]};refreshSelection();localSave();};
    try{await openDiceTray(root,{bonus,sacrifice,onFirstResult,animated:state.settings.diceAnimation&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches});}
    catch(error){report(error);}finally{rolling=false;button.disabled=false;fit();}
  });
  qa('[data-special]').forEach(button=>button.addEventListener('click',()=>{specialAction=specialAction===button.dataset.special?null:button.dataset.special;refreshSelection();}));
  q('.mt-roll-modifier').addEventListener('input',e=>{rollModifier=Math.max(-99,Math.min(99,Math.trunc(Number(e.target.value)||0)));refreshSelection();});
  q('.mt-clear').addEventListener('click',()=>{selected.clear();state.actionExtras={power:[],weakness:[]};refreshSelection();localSave();});
  q('.mt-close-sheet').addEventListener('click',()=>Promise.resolve().then(actions.close).catch(report));
  let switchSequence=0;
  function reveal(panel){const sequence=++switchSequence;motion.stop();panel.style.visibility='hidden';Promise.resolve(fit()).then(()=>new Promise(resolve=>{const win=root.ownerDocument.defaultView;if(win.requestAnimationFrame)win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve));else resolve();})).then(()=>{if(sequence!==switchSequence)return;motion.play(panel);panel.style.visibility='';}).catch(error=>{if(sequence===switchSequence)panel.style.visibility='';report(error);});}
  const tabs=qa('[role=tab]');function switchTab(button){const changed=activeTab!==button.dataset.sheetTab;activeTab=button.dataset.sheetTab;tabs.forEach(b=>{const active=b===button;b.setAttribute('aria-selected',String(active));b.setAttribute('aria-pressed',String(active));b.tabIndex=active?0:-1;q('#'+b.getAttribute('aria-controls')).hidden=!active;});q('.mt-row-actions').hidden=activeTab!=='party';refreshSelection();if(activeTab==='notes')layoutNotes();if(changed)reveal(q('#panel-'+activeTab));}
  tabs.forEach((b,i)=>{b.addEventListener('click',()=>switchTab(b));b.addEventListener('keydown',e=>{const n=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(n!==null){e.preventDefault();switchTab(tabs[n]);tabs[n].focus();}});});
  function fit(){
    if(rolling)return;
    const openCards=[...q('#panel-'+activeTab).querySelectorAll('.mt-scroll-frame:has(.mt-scroll-toggle[aria-expanded=true])')];
    if(!q('.mt-action-card').hidden&&q('.mt-action-card .mt-scroll-toggle[aria-expanded=true]'))openCards.push(q('.mt-action-card'));
    const requestedHeight=Math.max(650,...openCards.map(card=>card.querySelector('.mt-scroll-main').scrollHeight+card.querySelector('.mt-scroll-extension-inner').scrollHeight+78+toolbar.getBoundingClientRect().height+44));
    const minimumWidth=Math.max(480,q('.mt-tabs').scrollWidth+16);
    return resizePending=actions.fitWindow?.(activeTab==='themes'?4:activeTab==='settings'?1:activeTab==='notes'?1+state.noteCards.filter(c=>c.open).length:2+state.cards.length,!q('.mt-action-card').hidden,requestedHeight,minimumWidth);
  }
  qa('[role=tabpanel]').forEach(panel=>{const version=el('div','mt-sheet-version','v'+packageInfo.version);panel.querySelector('.mt-card-row').after(version);});
  dressScroll(q('.mt-action-card'),{extensionLabel:'Особые действия',onExpand:fit});refreshSelection();createScratchEffects(root);reveal(q('#panel-party'));
}
