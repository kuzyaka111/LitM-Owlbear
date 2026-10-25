import {publicObstacle,findObstacle} from './gm-model.js';
import {renderBoardGraphics} from './board-graphics.js';
import {makeBoardObjects} from './board-objects.js';
import {reconcileBoardObjects,applyPaint} from './board-diff.js';
export const GM_BOARD_KEY='io.github.kuzyaka111.legend-mist/gm-obstacle';
export function createGMBoard(obr,{store,build,buildPath,render=renderBoardGraphics,report=console.error}){
 let disposed=false,timer,off=()=>{},offReady=()=>{},items=[],queue=Promise.resolve(),epoch=0;
 const meta=item=>item?.metadata?.[GM_BOARD_KEY];
 const own=()=>items.filter(i=>meta(i)?.owner===obr.player.id);
 const guard=async()=>{if(disposed||await obr.player.getRole()!=='GM')throw Error('Размещать препятствия может только ведущий.');if(!await obr.scene.isReady())throw Error('Сначала откройте сцену Owlbear.');};
 function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;}
 async function write(obstacle,existing,point){
  await guard();const current=epoch,data=publicObstacle(obstacle),previous=meta(existing);if(previous&&JSON.stringify(previous.card.data)===JSON.stringify(data))return existing;
  // Only this public projection may enter shared scene metadata, glyphs and asset URLs.
  const record={v:1,owner:obr.player.id,source:obstacle.id,character:'Препятствие',card:{type:'obstacle',data},rev:crypto.randomUUID(),placed:true};
  const plan=await render(record),gridDpi=await obr.scene.grid.getDpi(),objects=makeBoardObjects({id:existing?.id,record,plan,point:existing?.position||point,existing,build,buildPath,gridDpi});
  if(current!==epoch||disposed)throw Error('Сцена изменилась. Повторите размещение.');
  let diff;if(existing){const parts=await obr.scene.items.getItems(previous.parts||[]);diff=reconcileBoardObjects(parts,objects);record.parts=objects.parts.map(p=>p.id);}
  objects.root.metadata={[GM_BOARD_KEY]:record};objects.root.name=data.name||'Препятствие';
  if(!existing){await obr.scene.items.addItems([objects.root,...objects.parts]);items=[...items.filter(i=>i.id!==objects.root.id),objects.root];return objects.root;}
  if(diff.add.length)await obr.scene.items.addItems(diff.add);
  try{await obr.scene.items.updateItems([existing,...diff.update.map(p=>p.before)],drafts=>{const root=drafts.find(i=>i.id===existing.id);if(!root)throw Error('Карточка удалена с поля.');root.metadata=objects.root.metadata;root.name=objects.root.name;if(JSON.stringify(root.commands)!==JSON.stringify(objects.root.commands))root.commands=objects.root.commands;for(const pair of diff.update){const target=drafts.find(i=>i.id===pair.before.id);if(target)applyPaint(target,pair.before,pair.after);}});}catch(error){if(diff.add.length)await obr.scene.items.deleteItems(diff.add.map(i=>i.id)).catch(report);throw error;}
  if(diff.remove.length)await obr.scene.items.deleteItems(diff.remove);items=items.map(i=>i.id===existing.id?objects.root:i);return objects.root;
 }
 async function refresh(ready){const current=++epoch;off();items=[];if(!ready||disposed)return;off=obr.scene.items.onChange(next=>{if(current===epoch)items=next;});const next=await obr.scene.items.getItems();if(current===epoch){items=next;changed();}}
 function flush(){clearTimeout(timer);return enqueue(async()=>{if(!own().length)return;await guard();const state=store.load();for(const item of own()){const obstacle=findObstacle(state,meta(item).source);if(obstacle)await write(obstacle,item);}});}
 function changed(){clearTimeout(timer);if(disposed)return;timer=setTimeout(()=>{void flush().catch(report);},250);}
 return {async start(){offReady=obr.scene.onReadyChange?.(ready=>void refresh(ready).catch(report))||(()=>{});await refresh(await obr.scene.isReady());},changed,flush,
  place(obstacle){return enqueue(async()=>{await guard();const current=(await obr.scene.items.getItems()).find(i=>meta(i)?.owner===obr.player.id&&meta(i).source===obstacle.id);const [w,h]=await Promise.all([obr.viewport.getWidth(),obr.viewport.getHeight()]);const point=await obr.viewport.inverseTransformPoint({x:w*.65,y:h*.2});return write(obstacle,current,point);});},
  dispose(){disposed=true;++epoch;clearTimeout(timer);off();offReady();}
 };
}
