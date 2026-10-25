import {boardDebug} from './board-debug.js';
import {sourceCard,applySource,deleteSource} from './board-model.js';
export function createSheetTransfer(root,state,save,{scene,resize,toScene,getShared,redraw,fit,report}){
 const doc=root.ownerDocument,win=doc.defaultView;let miniature=false,restoring=false,session=null,sequence=0,dimensions=null,disposed=false;
 const known=new Map();let visibleSources=null;
 const identify=node=>{
  if(node.matches('.mt-fellowship-host'))return 'fellowship';
  if(node.matches('.mt-character-host'))return 'character';
  if(node.dataset.cardId)return 'card:'+node.dataset.cardId;
  if(node.dataset.statusId)return 'status:'+node.dataset.statusId;
  if(node.dataset.noteId)return 'note:'+node.dataset.noteId;
  const t=node.querySelector('[data-theme-id]');return t?'theme:'+t.dataset.themeId:null;
 };
 const nodes=()=>[...root.querySelectorAll('.mt-card-slot,.mt-status-cards > .mt-scroll-frame,.mt-notes-cards > .mt-notes-card')];
 function syncVisibility(){const sources=new Set(scene.items().filter(i=>scene.record(i)?.owner===scene.owner&&scene.record(i)?.placed&&(!scene.isActive||scene.isActive(scene.record(i)))).map(i=>scene.record(i).source));for(const node of nodes()){const key=identify(node);if(key)node.dataset.onBoard=String(sources.has(key));}for(const button of root.querySelectorAll('.mt-note-index-row .mt-open-note'))button.closest('.mt-note-index-row').dataset.onBoard=String(sources.has('note:'+button.dataset.noteId));}
 const off=scene.subscribe(items=>{
  let changed=false;for(const item of items){const r=scene.record(item);if(r.owner!==scene.owner||scene.isActive&&!scene.isActive(r))continue;
   const stamp=String(r.deleted)+String(r.placed)+JSON.stringify(r.card);if(known.get(item.id)===stamp)continue;known.set(item.id,stamp);
   if(r.source!=='fellowship'&&(r.deleted?deleteSource(state,r):applySource(state,r.source,r.card))){if(!r.placed)redraw(r.source);changed=true;}
  }if(changed)save();syncVisibility();const sources=items.filter(i=>scene.record(i)?.owner===scene.owner&&scene.record(i)?.placed&&(!scene.isActive||scene.isActive(scene.record(i)))).map(i=>scene.record(i).source).sort().join('|');if(sources!==visibleSources){visibleSources=sources;void fit();}
 });
 const observer=new win.MutationObserver(syncVisibility);observer.observe(root,{childList:true,subtree:true});
 async function restore(){
  if(!miniature||restoring)return;restoring=true;miniature=false;
  try{await resize(false,dimensions);}finally{doc.body.classList.remove('mt-sheet-mini');doc.body.style.removeProperty('--full-sheet-width');doc.body.style.removeProperty('--full-sheet-height');restoring=false;syncVisibility();void fit();}
 }
 function disposeGhost(s){void s?.ghost?.remove().catch(report);if(s)s.canceled=true;}
 function cancel(){boardDebug('transfer-cancel',{miniature,session:session?.source});sequence++;disposeGhost(session);session=null;void restore().catch(report);}
 const inside=e=>dimensions&&e.clientX>=0&&e.clientY>=0&&e.clientX<dimensions.width*.3&&e.clientY<dimensions.height*.3;
 async function begin(drag,e){
  const source=identify(drag.item),card=sourceCard(state,source,getShared());if(!card)return false;
  const id=++sequence,s={id,source,card,character:state.name,point:null,canceled:false,armed:false};session=s;
  boardDebug('transfer-begin',{source,x:e.clientX,y:e.clientY});dimensions={width:win.innerWidth,height:win.innerHeight};s.armed=!inside(e);miniature=true;
  doc.body.style.setProperty('--full-sheet-width',dimensions.width+'px');doc.body.style.setProperty('--full-sheet-height',dimensions.height+'px');doc.body.classList.add('mt-sheet-mini');
  try{
   await resize(true,dimensions);boardDebug('transfer-resized',{full:dimensions,inner:{width:win.innerWidth,height:win.innerHeight}});if(disposed||session!==s||s.canceled)return true;
   const point=await toScene(e);s.point=point;
   const ghost=await scene.ghost(s.character,s.card,point);if(disposed||session!==s||s.canceled){await ghost.remove();return true;}s.ghost=ghost;
  }catch(error){if(session===s){cancel();report(error);}}return true;
 }
 function move(drag,e){
  if(restoring)return true;
  if(miniature){
   if(inside(e)&&session?.armed!==false){disposeGhost(session);session=null;void restore().catch(report);return true;}
   const s=session;if(s&&!inside(e))s.armed=true;if(s)void toScene(e).then(point=>{if(session===s&&!s.canceled){s.point=point;void s.ghost?.move(point);}}).catch(report);
   return true;
  }
  const tabs=root.querySelector('.mt-tabs').getBoundingClientRect();
  if(e.clientY<tabs.top-4&&sourceCard(state,identify(drag.item),getShared())){drag.item.style.transform=drag.transform;void begin(drag,e);return true;}
  return false;
 }
 function finish(drag,e,canceled){
  boardDebug('transfer-finish',{x:e.clientX,y:e.clientY,canceled,miniature,source:session?.source});const s=session;if(canceled){cancel();return false;}
  if(!s||!miniature||inside(e)){if(miniature)void restore().catch(report);return false;}
  session=null;s.canceled=true;sequence++;
  void (async()=>{try{
   const point=await toScene(e);await scene.place(s.source,s.character,s.card,point);syncVisibility();
  }catch(error){await restore();boardDebug('place-error',{message:error.message});report(error);}finally{await s.ghost?.remove();}})();
  return true;
 }
 const hover=e=>{if(miniature&&!session&&inside(e))void restore().catch(report);};
 const offReset=scene.onReset?.(cancel)||(()=>{});
 doc.addEventListener('pointermove',hover);const key=e=>{if(e.key==='Escape')cancel();};doc.addEventListener('keydown',key);
 const dispose=()=>{disposed=true;cancel();off();offReset();observer.disconnect();doc.removeEventListener('pointermove',hover);doc.removeEventListener('keydown',key);};
 win.addEventListener('pagehide',dispose,{once:true});
 return {move,finish,cancel,syncVisibility,isMini:()=>miniature||restoring,dispose};
}
