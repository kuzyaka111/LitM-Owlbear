import {boardDebug} from './board-debug.js';
import {canDeleteBoardCard,deleteSource} from './board-model.js';
import {BOARD_KEY,BOARD_TOOL,BOARD_EDITOR,validRecord,cleanCard,editCard,cardFields,fieldValue,activationValue,textToggle,cardPoint,hitField,applySource} from './board-model.js';
import {renderBoardGraphics,BOARD_GRAPHICS_VERSION} from './board-graphics.js';
import {inlineEditorOptions} from './board-inline.js';
import {makeBoardObjects} from './board-objects.js';
import {BOARD_PART,reconcileBoardObjects,applyPaint,previewBoardChanges} from './board-diff.js';
import {fellowshipPatch,fellowshipTheme} from './fellowship-model.js';
export function createBoardScene(obr,{store,fellowship,base=globalThis.location?.href,render=renderBoardGraphics,build,buildPath,report=console.error,upgrade=true}={}){
 let items=[],alive=true,off=()=>{},offShared=()=>{},offReady=()=>{},epoch=0,lastSignature=null;const partsCache=new Map(),verified=new WeakSet();let dpiPromise;const getDpi=()=>dpiPromise??=obr.scene.grid.getDpi();const offGrid=obr.scene.grid.onChange?.(()=>{dpiPromise=null;})||(()=>{});const resets=new Set();const listeners=new Set(),queues=new Map(),activations=new Map(),acknowledging=new Set();
 const record=item=>{const r=item?.metadata?.[BOARD_KEY];if(!r||typeof r!=='object')return null;if(verified.has(r))return r;if(!validRecord(r))return null;verified.add(r);return r;};
 const notify=()=>listeners.forEach(fn=>fn(items));
 const enqueue=(id,fn)=>{const work=(queues.get(id)||Promise.resolve()).then(()=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('legend-mist-card:'+obr.room?.id+':'+id,fn):fn());queues.set(id,work.catch(()=>{}));return work;};
 async function sync(next,complete=true){
  if(complete){partsCache.clear();for(const item of next)if(item.metadata?.[BOARD_PART])partsCache.set(item.id,item);}
  items=next.filter(item=>record(item));if(!alive)return;
  const signature=items.map(i=>i.id+':'+record(i).rev+':'+record(i).placed+':'+record(i).deleted).sort().join('|');if(signature===lastSignature)return;
  let cleanup=[];

  if(store){const states=new Map(),dirty=new Set(),renamed=new Set(),unrestored=new Set();
   for(const item of items){const r=record(item);if(r.owner!==obr.player.id||r.source==='fellowship')continue;
    const id=r.characterId||store.legacyId||null;if(!states.has(id))states.set(id,store.loadCharacter?store.loadCharacter(id):store.load());const state=states.get(id);if(!state){unrestored.add(item.id);continue;}
    const nameBefore=state.name,before=JSON.stringify(state);if(!(r.deleted?deleteSource(state,r):applySource(state,r.source,r.card)))unrestored.add(item.id);if(before!==JSON.stringify(state))dirty.add(id);if(nameBefore!==state.name)renamed.add(id);
   }
   for(const id of dirty){const state=states.get(id);if(!(store.saveCharacter?store.saveCharacter(id,state):store.save(state))){report(Error('Не удалось сохранить карточку на этом устройстве.'));return;}if(renamed.has(id))void syncCharacter(state.name,id).catch(report);}
   cleanup=items.filter(item=>{const r=record(item);return r.owner===obr.player.id&&!r.placed&&!acknowledging.has(item.id)&&!unrestored.has(item.id);}).map(i=>i.id);
  }lastSignature=signature;notify();
  if(cleanup.length){cleanup.forEach(id=>acknowledging.add(id));void obr.scene.items.deleteItems(cleanup).catch(error=>{cleanup.forEach(id=>acknowledging.delete(id));report(error);});}
 }
 async function refresh(ready){
  const current=++epoch;off();offShared();items=[];partsCache.clear();dpiPromise=null;lastSignature=null;notify();resets.forEach(fn=>fn());if(!ready||!alive)return;
  off=obr.scene.items.onChange(next=>{if(current===epoch)void sync(next).catch(report);});const next=await obr.scene.items.getItems();if(current!==epoch||!alive)return;await sync(next);
  if(store?.loadCharacter){const retired=items.filter(i=>{const r=record(i);return r.owner===obr.player.id&&r.source!=='fellowship'&&!store.loadCharacter(r.characterId||store.legacyId);});if(retired.length)await obr.scene.items.deleteItems(retired.flatMap(i=>[i.id,...(record(i).parts||[])]));}
  for(const item of upgrade?[...items]:[]){const r=record(item);if(item.type==='PATH'&&r.placed&&r.owner===obr.player.id&&r.interactionVersion!==BOARD_GRAPHICS_VERSION){const stale=[...partsCache.values()].filter(p=>p.attachedTo===item.id&&!r.parts?.includes(p.id)).map(p=>p.id);await update(item.id,card=>card);const latest=record(items.find(i=>i.id===item.id));const remove=stale.filter(id=>!latest?.parts?.includes(id));if(remove.length)await obr.scene.items.deleteItems(remove);}}
  if(fellowship)offShared=fellowship.subscribe((shared,loaded)=>{if(!loaded||current!==epoch)return;for(const item of items){const r=record(item);if(r.owner===obr.player.id&&r.source==='fellowship'&&r.placed&&JSON.stringify(r.card.data)!==JSON.stringify(fellowshipTheme(shared)))void update(item.id,()=>({type:'theme',data:fellowshipTheme(shared)})).catch(report);}});
 }
 async function start(){offReady();offReady=obr.scene.onReadyChange?.(ready=>void refresh(ready).catch(report))||(()=>{});await refresh(await obr.scene.isReady());}
 async function place(source,character,card,point){
  const current=epoch;boardDebug('place-start',{source,point});
  if(!await obr.scene.isReady())throw Error('Откройте сцену, чтобы разместить карточку.');
  const characterId=store?.activeId?.()||null;
  const existing=(await obr.scene.items.getItems()).find(item=>{const r=record(item);return r?.placed&&r.owner===obr.player.id&&r.source===source&&(source==='fellowship'||(r.characterId||store?.legacyId||null)===characterId);});if(existing)throw Error('Эта карточка уже находится на поле.');
  const data={v:1,owner:obr.player.id,source,...(characterId?{characterId}:{}),character:character.slice(0,80),card:cleanCard(card),placed:true,rev:crypto.randomUUID()};
  if(new TextEncoder().encode(JSON.stringify(data)).length>12000)throw Error('Слишком много текста для одной карточки на поле. Разделите заметку.');
  const plan=await render(data);data.hits=plan.hits;data.interactionVersion=plan.interactionVersion;const gridDpi=await getDpi();
  const {root:item,parts}=makeBoardObjects({record:data,plan,point,build,buildPath,gridDpi});
  if(current!==epoch)throw Error('Сцена изменилась. Повторите перенос.');
  try{await obr.scene.items.addItems([item,...parts]);}catch(error){boardDebug('add-error',{message:error?.error?.message||error?.message});throw Error(error?.error?.message||error?.message||'Owlbear не принял карточку.');}
  if(obr.tool)void obr.tool.activateTool(BOARD_TOOL).then(()=>obr.tool.activateMode(BOARD_TOOL,BOARD_TOOL+'/edit')).catch(report);
  boardDebug('place-success',{id:item.id,point:item.position,parts:parts.length});for(const part of parts)partsCache.set(part.id,part);await sync([...items.filter(i=>i.id!==item.id),item],false);return item;
 }
 async function update(id,change,{character}={}){
  return enqueue(id,async()=>{
   if(!alive)throw Error('Карточка недоступна.');
   const started=performance.now();
   for(let attempt=0;attempt<4;attempt++){
    const item=items.find(i=>i.id===id)||(await obr.scene.items.getItems([id]))[0],before=record(item);if(!before||!before.placed)throw Error('Карточка уже возвращена в лист.');
    if(before.source!=='fellowship'&&before.owner!==obr.player.id&&await obr.player.getRole()!=='GM')throw Error('Изменять карточку может её владелец или ведущий.');
    if(before.source!=='fellowship'&&before.owner===obr.player.id&&store?.loadCharacter&&!store.loadCharacter(before.characterId||store.legacyId))throw Error('Этот персонаж больше не закреплён за вами.');
    const readAt=performance.now(),current=epoch,next=structuredClone(before);next.card=change(next.card);next.rev=crypto.randomUUID();
    if(character!==undefined)next.character=character;if(next.card.type==='character')next.character=next.card.data.name;
    if(before.interactionVersion===BOARD_GRAPHICS_VERSION&&next.character===before.character&&JSON.stringify(next.card)===JSON.stringify(before.card))return before;
    const plan=await render(next);next.hits=plan.hits;next.interactionVersion=plan.interactionVersion;const gridDpi=await getDpi(),renderAt=performance.now();
    const objects=makeBoardObjects({id,record:next,plan,point:item.position,existing:item,build,buildPath,gridDpi});
    const missing=(before.parts||[]).filter(id=>!partsCache.has(id));if(missing.length)for(const part of await obr.scene.items.getItems(missing))partsCache.set(part.id,part);
    const diff=reconcileBoardObjects((before.parts||[]).map(id=>partsCache.get(id)).filter(Boolean),objects);next.parts=objects.parts.map(p=>p.id);
    if(current!==epoch)throw Error('Сцена изменилась. Повторите действие.');
    const preparedAt=performance.now();let applied=false,stopPreview=()=>{},feedbackMs=null;if(record(items.find(i=>i.id===id))?.rev!==before.rev&&items.some(i=>i.id===id))continue;try{stopPreview=await previewBoardChanges(obr,diff.update,{parts:objects.parts,record:next});feedbackMs=Math.round(performance.now()-started);}catch{}
    try{if(diff.add.length)await obr.scene.items.addItems(diff.add);await obr.scene.items.updateItems([item,...diff.update.map(p=>p.before)],drafts=>{
     const draft=drafts.find(d=>d.id===id);if(draft?.metadata?.[BOARD_KEY]?.rev!==before.rev)return;
     draft.metadata[BOARD_KEY]=next;if(draft.type==='PATH'){if(JSON.stringify(item.commands)!==JSON.stringify(objects.root.commands))draft.commands=objects.root.commands;}else if(JSON.stringify(item.image)!==JSON.stringify(objects.root.image))draft.image=objects.root.image;applied=true;
     for(const pair of diff.update){const target=drafts.find(d=>d.id===pair.before.id);if(target)applyPaint(target,pair.before,pair.after);}
    });}
    catch(error){stopPreview();if(diff.add.length)await obr.scene.items.deleteItems(diff.add.map(p=>p.id)).catch(report);throw error;}
    stopPreview();if(applied){
     const writtenAt=performance.now();if(diff.remove.length)await obr.scene.items.deleteItems(diff.remove);
     for(const id of diff.remove)partsCache.delete(id);for(const part of diff.add)partsCache.set(part.id,part);for(const pair of diff.update)partsCache.set(pair.after.id,pair.after);
     const root={...item,metadata:{...item.metadata,[BOARD_KEY]:next},...(item.type==='PATH'?{commands:objects.root.commands}:{image:objects.root.image})};
     await sync([...items.filter(i=>i.id!==id),root],false);boardDebug('board-update',{ms:Math.round(performance.now()-started),feedbackMs,readMs:Math.round(readAt-started),renderMs:Math.round(renderAt-readAt),prepareMs:Math.round(preparedAt-renderAt),writeMs:Math.round(writtenAt-preparedAt),tailMs:Math.round(performance.now()-writtenAt),added:diff.add.length,updated:diff.update.length,removed:diff.remove.length,total:objects.parts.length,cachedParts:partsCache.size});return next;
    }
    if(diff.add.length)await obr.scene.items.deleteItems(diff.add.map(p=>p.id));
   }throw Error('Карточка меняется другим участником. Повторите действие.');
  });
 }
 async function edit(id,fieldId,value){
  const item=items.find(i=>i.id===id)||(await obr.scene.items.getItems([id]))[0],r=record(item);if(!r)throw Error('Карточка недоступна.');
  if(r.source!=='fellowship')return update(id,card=>editCard(card,fieldId,value));
  const field=cardFields(r.card).find(f=>f.id===fieldId);if(!field)throw Error('Поле недоступно.');
  // Brotherhood remains a room document: write its individual field first.
  if(r.source==='fellowship'){
   const next=editCard(r.card,fieldId,value),p=field.path;
   const change=field.option?{field:p[0],value:next.data[p[0]]}:p.length===3?{kind:p[0],index:p[1],field:p[2],value:fieldValue(next,field)}:{field:p[0],value:fieldValue(next,field)};
   await fellowship.update(fellowshipPatch(change));
  }
  return update(id,card=>editCard(card,fieldId,value));
 }
 function activateControl(id,fieldId,hit={}){
  const r=record(items.find(i=>i.id===id));
  if(r?.source==='fellowship'){const field=cardFields(r.card).find(f=>f.id===fieldId);if(!field)return Promise.reject(Error('Поле недоступно.'));return edit(id,fieldId,activationValue(r.card,field,hit));}
  return new Promise((resolve,reject)=>{
   let batch=activations.get(id);if(!batch){batch={requests:[],running:false};activations.set(id,batch);}batch.requests.push({fieldId,hit,resolve,reject});if(batch.running)return;batch.running=true;
   void (async()=>{try{while(batch.requests.length){const requests=batch.requests.splice(0);try{const result=await update(id,card=>requests.reduce((next,request)=>{const field=cardFields(next).find(f=>f.id===request.fieldId);if(!field||field.kind==='text')throw Error('Поле недоступно.');return editCard(next,request.fieldId,activationValue(next,field,request.hit));},card));requests.forEach(request=>request.resolve(result));}catch(error){requests.forEach(request=>request.reject(error));}}}finally{if(activations.get(id)===batch)activations.delete(id);}})();
  });
 }
 async function returnToSheet(id){
  return enqueue(id,async()=>{
   const item=(await obr.scene.items.getItems([id]))[0],r=record(item);if(!r)return;
   if(r.owner!==obr.player.id&&await obr.player.getRole()!=='GM')throw Error('Вернуть карточку может её владелец или ведущий.');
   // Keep a recoverable hidden record until the owner loads this scene again.
   await obr.scene.items.updateItems([id],drafts=>{if(drafts[0]){drafts[0].metadata[BOARD_KEY]={...r,placed:false,rev:crypto.randomUUID()};drafts[0].visible=false;}});
   await sync(await obr.scene.items.getItems());
  });
 }
 async function deleteCard(id){
  return enqueue(id,async()=>{
   const item=(await obr.scene.items.getItems([id]))[0],r=record(item);if(!r)return;
   if(!r.placed||!canDeleteBoardCard(r))throw Error('Эту карточку нельзя удалить с поля.');
   if(r.owner!==obr.player.id&&await obr.player.getRole()!=='GM')throw Error('Удалить карточку может её владелец или ведущий.');
   // Preserve the deletion until the owner's sheet has saved it, including offline owners.
   await obr.scene.items.updateItems([id],drafts=>{if(drafts[0]){drafts[0].metadata[BOARD_KEY]={...r,placed:false,deleted:true,rev:crypto.randomUUID()};drafts[0].visible=false;}});
   await sync(await obr.scene.items.getItems());
  });
 }
 async function ghost(character,card,point){
  const plan=await render({character,card}),record={owner:obr.player.id,rev:crypto.randomUUID(),character,card},gridDpi=await getDpi(),objects=makeBoardObjects({record,plan,point,build,buildPath,gridDpi}),ids=[objects.root.id,...objects.parts.map(p=>p.id)];
  objects.root.metadata={};objects.root.locked=true;objects.root.disableHit=true;for(const part of objects.parts)part.metadata={};let removed=false,moving=Promise.resolve(),pending=null,running=false;
  await obr.scene.local.addItems([objects.root,...objects.parts]);return {move(point){pending=point;if(!running){running=true;moving=(async()=>{try{while(pending&&!removed){const latest=pending;pending=null;await obr.scene.local.updateItems([objects.root.id],drafts=>{if(drafts[0])drafts[0].position=latest;});}}finally{running=false;}})().catch(report);}return moving;},async remove(){if(removed)return;removed=true;await moving;await obr.scene.local.deleteItems(ids);}};
 }
 async function syncCharacter(name,characterId=store?.activeId?.()||null){for(const item of items){const r=record(item);if(r.owner===obr.player.id&&r.placed&&r.character!==name&&(r.source==='fellowship'||(r.characterId||store?.legacyId||null)===characterId))await update(item.id,card=>card,{character:name});}}

 return {async syncNow(){if(await obr.scene.isReady())await sync(await obr.scene.items.getItems());},onReset(fn){resets.add(fn);return()=>resets.delete(fn);},owner:obr.player.id,isActive:r=>!store?.activeId||r.source==='fellowship'||(r.characterId||store.legacyId)===store.activeId(),syncCharacter,start,place,ghost,edit,activateControl,update,returnToSheet,deleteCard,record,items:()=>items,subscribe(fn){listeners.add(fn);fn(items);return()=>listeners.delete(fn);},dispose(){alive=false;++epoch;off();offShared();offReady();offGrid();partsCache.clear();listeners.clear();resets.clear();}};
}
export function watchBoardTools(obr,scene,base=location.href){
 let installed=false,queue=Promise.resolve(),alive=true,clickTimer=null,offPlayer=()=>{},selected='',activating=false,clickSequence=0;
 const cancelClick=()=>{clearTimeout(clickTimer);clickTimer=null;return ++clickSequence;};
 const fail=error=>{const data=error?.error||error,details=data?.details?.flatMap(d=>d.context?.details?.map(e=>e.message)||[d.message]).join('; '),message=details||data?.message||String(error);boardDebug('tool-error',{message:message.slice(0,1000)});console.error(message);void obr.notification.show(message.slice(0,300),'ERROR');};
 const icon=new URL('./sheet.svg',base).href;
 const openEditor=async(item,hit)=>obr.popover.open({id:BOARD_EDITOR,...await inlineEditorOptions(obr,item,hit,base)});
 const resolve=async(event,kind)=>{let item=event.target;if(!scene.record(item)&&item?.attachedTo)item=scene.items().find(i=>i.id===item.attachedTo)||(await obr.scene.items.getItems([item.attachedTo]))[0];const r=scene.record(item);if(!r?.placed)return null;const dpi=item.type==='PATH'?150:await obr.scene.grid.getDpi();return {item,r,hit:hitField(r,cardPoint(item,event.pointerPosition,dpi),kind)};};
 const activate=async()=>{if(activating||!alive||!installed)return;activating=true;try{const active=await obr.tool.getActiveTool();if(/^rodeo\.owlbear\.tools?\/(move|select)$/.test(active)){await obr.tool.activateTool(BOARD_TOOL);await obr.tool.activateMode(BOARD_TOOL,BOARD_TOOL+'/edit');}}finally{activating=false;}};
 const applyHit=async(result,hit=result.hit)=>{if(scene.activateControl)return scene.activateControl(result.item.id,hit.id,hit);const field=cardFields(result.r.card).find(f=>f.id===hit.id);if(field)await scene.edit(result.item.id,field.id,activationValue(result.r.card,field,hit));};
 const refresh=()=>queue=queue.then(async()=>{
  const ready=alive&&await obr.scene.isReady();if(ready===installed)return;
  if(!ready){await obr.tool.remove(BOARD_TOOL);await obr.tool.removeMode(BOARD_TOOL+'/edit');await obr.contextMenu.remove(BOARD_TOOL+'/return');await obr.contextMenu.remove(BOARD_TOOL+'/delete');installed=false;return;}
  await obr.tool.create({id:BOARD_TOOL,icons:[{icon,label:'Карточки: текст и зачёркивание'}],defaultMode:BOARD_TOOL+'/edit'});
  await obr.tool.createMode({id:BOARD_TOOL+'/edit',icons:[{icon,label:'Карточки',filter:{activeTools:[BOARD_TOOL]}}],preventDrag:{},
   onToolClick:async(_,event)=>{try{const sequence=cancelClick();const control=await resolve(event,'control');if(sequence!==clickSequence)return;if(control?.hit){void applyHit(control).catch(fail);return;}const result=await resolve(event,'text'),field=result?.hit&&textToggle(result.r.card,result.hit.id);if(sequence!==clickSequence)return;if(!field)return true;clickTimer=setTimeout(()=>{clickTimer=null;void applyHit(result,{id:field.id}).catch(fail);},260);}catch(e){fail(e);}},
   onToolDoubleClick:async(_,event)=>{cancelClick();try{const result=await resolve(event,'text');if(result?.hit)await openEditor(result.item,result.hit);else return true;}catch(e){fail(e);}},onDeactivate:cancelClick
  });
  await obr.contextMenu.create({id:BOARD_TOOL+'/return',icons:[{icon,label:'Вернуть в лист',filter:{min:1,max:1,every:[{key:['metadata',BOARD_KEY,'placed'],value:true}]}}],onClick:({items})=>void scene.returnToSheet(items[0].id).catch(fail)});
  await obr.contextMenu.create({id:BOARD_TOOL+'/delete',icons:[
   {icon,label:'Удалить карточку',filter:{min:1,max:1,every:[{key:['metadata',BOARD_KEY,'placed'],value:true},{key:['metadata',BOARD_KEY,'card','type'],value:'status'}]}},
   {icon,label:'Удалить карточку',filter:{min:1,max:1,every:[{key:['metadata',BOARD_KEY,'placed'],value:true},{key:['metadata',BOARD_KEY,'card','type'],value:'theme'},{key:['metadata',BOARD_KEY,'card','data','bookId'],value:'story'}]}}
  ],onClick:({items})=>void scene.deleteCard(items[0].id).catch(fail)});
  installed=true;offPlayer();offPlayer=obr.player.onChange?.(player=>{const key=(player.selection||[]).join('|');if(key===selected)return;selected=key;if(player.selection?.length===1&&scene.items().some(i=>i.id===player.selection[0]&&scene.record(i)?.placed))void activate().catch(fail);})||(()=>{});
 }).catch(fail);
 const unsubscribe=obr.scene.onReadyChange(()=>{void refresh();});void refresh();
 return {async dispose(){alive=false;cancelClick();offPlayer();unsubscribe();await refresh();}};
}
