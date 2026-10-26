import {publicObstacle,findObstacle,publicSceneEffect,findSceneEffect} from './gm-model.js';
import {ACTION_FEED,gmActionFeed} from './action-sources.js';
import {renderBoardGraphics,BOARD_GRAPHICS_VERSION} from './board-graphics-loader.js';
import {makeBoardObjects} from './board-objects.js';
import {reconcileBoardObjects,applyPaint} from './board-diff.js';
export const GM_BOARD_KEY='io.github.kuzyaka111.legend-mist/gm-obstacle';
const withCardLock=(obr,id,fn)=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('legend-mist-gm-card:'+obr.room?.id+':'+id,fn):fn();
export async function returnGMCard(obr,id){
 return withCardLock(obr,id,async()=>{
  const item=(await obr.scene.items.getItems([id]))[0],record=item?.metadata?.[GM_BOARD_KEY];if(!record?.placed)return;
  if(record.owner!==obr.player.id&&await obr.player.getRole()!=='GM')throw Error('Вернуть карточку может её владелец или ведущий.');
  // The private source never leaves the panel: only its public scene copy is removed.
  await obr.scene.items.deleteItems([id]);
 });
}
export function watchGMBoardReturn(obr,base=globalThis.location?.href){
 const id=GM_BOARD_KEY+'/return',icon=new URL('./sheet.svg',base).href;let alive=true,installed=false,queue=Promise.resolve();
 const fail=error=>{console.error(error);void obr.notification.show(error?.message||String(error),'ERROR');};
 const refresh=()=>queue=queue.then(async()=>{const ready=alive&&await obr.scene.isReady();if(ready===installed)return;if(!ready){await obr.contextMenu.remove(id);installed=false;return;}
  await obr.contextMenu.create({id,icons:[{icon,label:'Вернуть в панель',filter:{min:1,max:1,every:[{key:['metadata',GM_BOARD_KEY,'placed'],value:true}]}}],onClick:({items})=>void returnGMCard(obr,items[0].id).catch(fail)});installed=true;
 }).catch(fail);
 const off=obr.scene.onReadyChange(()=>void refresh());void refresh();return {refresh,async dispose(){alive=false;off();await refresh();}};
}
export function createGMBoard(obr,{store,build,buildPath,render=renderBoardGraphics,report=console.error}){
 let disposed=false,timer,off=()=>{},offReady=()=>{},items=[],queue=Promise.resolve(),epoch=0;
 const meta=item=>item?.metadata?.[GM_BOARD_KEY];
 const own=()=>items.filter(i=>meta(i)?.owner===obr.player.id);
 const guard=async()=>{if(disposed||await obr.player.getRole()!=='GM')throw Error('Размещать препятствия может только ведущий.');if(!await obr.scene.isReady())throw Error('Сначала откройте сцену Owlbear.');};
 function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;}
 function write(obstacle,existing,point){return existing?withCardLock(obr,existing.id,()=>writeUnlocked(obstacle,existing,point)):writeUnlocked(obstacle,existing,point);}
 async function writeUnlocked(obstacle,existing,point){
  if(existing){const latest=(await obr.scene.items.getItems([existing.id]))[0];if(!meta(latest)?.placed)return null;existing=latest;}
  await guard();const current=epoch,isEffect=!!obstacle.effectKind,data=isEffect?publicSceneEffect(obstacle):publicObstacle(obstacle),previous=meta(existing),character=isEffect?obstacle.sceneName:'Препятствие';if(previous&&previous.interactionVersion===BOARD_GRAPHICS_VERSION&&previous.character===character&&JSON.stringify(previous.card.data)===JSON.stringify(data))return existing;
  // Only this public projection may enter shared scene metadata, glyphs and asset URLs.
  const record={v:1,owner:obr.player.id,source:obstacle.id,...(isEffect?{actionSource:obstacle.actionSource}:{}),character,card:{type:isEffect?'scene-effect':'obstacle',data},rev:crypto.randomUUID(),placed:true};
  const plan=await render(record);record.interactionVersion=plan.interactionVersion??BOARD_GRAPHICS_VERSION;const gridDpi=await obr.scene.grid.getDpi(),objects=makeBoardObjects({id:existing?.id,record,plan,point:existing?.position||point,existing,build,buildPath,gridDpi});
  if(current!==epoch||disposed)throw Error('Сцена изменилась. Повторите размещение.');
  let diff;if(existing){const parts=await obr.scene.items.getItems(previous.parts||[]);diff=reconcileBoardObjects(parts,objects);record.parts=objects.parts.map(p=>p.id);}
  objects.root.metadata={[GM_BOARD_KEY]:record};objects.root.name=data.name||'Препятствие';
  if(!existing){await obr.scene.items.addItems([objects.root,...objects.parts]);items=[...items.filter(i=>i.id!==objects.root.id),objects.root];return objects.root;}
  if(diff.add.length)await obr.scene.items.addItems(diff.add);
  try{await obr.scene.items.updateItems([existing,...diff.update.map(p=>p.before)],drafts=>{const root=drafts.find(i=>i.id===existing.id);if(!root)throw Error('Карточка удалена с поля.');root.metadata=objects.root.metadata;root.name=objects.root.name;if(JSON.stringify(root.commands)!==JSON.stringify(objects.root.commands))root.commands=objects.root.commands;for(const pair of diff.update){const target=drafts.find(i=>i.id===pair.before.id);if(target)applyPaint(target,pair.before,pair.after);}});}catch(error){if(diff.add.length)await obr.scene.items.deleteItems(diff.add.map(i=>i.id)).catch(report);throw error;}
  if(diff.remove.length)await obr.scene.items.deleteItems(diff.remove);items=items.map(i=>i.id===existing.id?objects.root:i);return objects.root;
 }
 async function refresh(ready){const current=++epoch;off();items=[];if(!ready||disposed)return;off=obr.scene.items.onChange(next=>{if(current===epoch)items=next;});const next=await obr.scene.items.getItems();if(current===epoch){items=next;changed();}}
 async function publishFeed(state){if(!obr.scene.getMetadata||!obr.scene.setMetadata)return;await guard();const key=ACTION_FEED+obr.player.id,feed=gmActionFeed(state,obr.player.id),metadata=await obr.scene.getMetadata();if(JSON.stringify(metadata[key])===JSON.stringify(feed))return;if(new TextEncoder().encode(JSON.stringify({...metadata,[key]:feed})).length>=16000)throw Error('Слишком много активных тегов и статусов для сцены. Сократите их количество.');await obr.scene.setMetadata({[key]:feed});}
 function flush(){clearTimeout(timer);return enqueue(async()=>{await guard();const state=store.load();await publishFeed(state);for(const item of own()){const source=meta(item).source,effect=findSceneEffect(state,source),obstacle=effect||findObstacle(state,source);if(source.startsWith('scene-effect:')&&(!effect||effect.status?.hidden||effect.tag?.hidden)){await obr.scene.items.deleteItems([item.id]);items=items.filter(i=>i.id!==item.id);}else if(obstacle)await write(obstacle,item);}});}
 function changed(){clearTimeout(timer);if(disposed)return;timer=setTimeout(()=>{void flush().catch(report);},250);}
 return {async start(){offReady=obr.scene.onReadyChange?.(ready=>void refresh(ready).catch(report))||(()=>{});await refresh(await obr.scene.isReady());},changed,flush,returnToPanel:id=>enqueue(()=>returnGMCard(obr,id)),
  place(obstacle){return enqueue(async()=>{await guard();const current=(await obr.scene.items.getItems()).find(i=>meta(i)?.owner===obr.player.id&&meta(i).source===obstacle.id);const [w,h]=await Promise.all([obr.viewport.getWidth(),obr.viewport.getHeight()]);const point=await obr.viewport.inverseTransformPoint({x:w*.65,y:h*.2});return write(obstacle,current,point);});},
  dispose(){disposed=true;++epoch;clearTimeout(timer);off();offReady();}
 };
}
