import {renderedScale} from './sheet-scale.js';
export function createCardReorder(root,{getOrder,setOrder,beforeDrag=()=>{}}){
 const doc=root.ownerDocument,win=doc.defaultView,animations=new Map();let drag=null,suppress=null,frame;
 const tab=row=>row.closest('[role=tabpanel]')?.id.replace('panel-','');
 function identify(item){
  if(item.matches('.mt-fellowship-host'))return 'fellowship';
  if(item.matches('.mt-character-host'))return 'character';
  if(item.dataset.cardId)return 'card:'+item.dataset.cardId;
  if(item.matches('.mt-notes-compendium'))return 'notes-library';
  if(item.dataset.noteId)return 'note:'+item.dataset.noteId;
  if(item.dataset.statusId)return 'status:'+item.dataset.statusId;
  const theme=item.querySelector('[data-theme-id]');return theme?'theme:'+theme.dataset.themeId:null;
 }
 function items(row){return [...row.querySelectorAll('.mt-card-slot,:scope > .mt-scroll-frame')].filter(item=>identify(item));}
 function ordered(row){return items(row).sort((a,b)=>Number(a.style.order||0)-Number(b.style.order||0));}
 function apply(){
  root.querySelectorAll('.mt-card-row').forEach(row=>{
   const cards=items(row),saved=getOrder(tab(row))||[];
   cards.sort((a,b)=>{const ai=saved.indexOf(identify(a)),bi=saved.indexOf(identify(b));return (ai<0?saved.length:ai)-(bi<0?saved.length:bi);});
   cards.forEach((item,i)=>{item.style.order=String(i);const head=item.querySelector('.mt-scroll-top');if(head){head.classList.add('mt-reorder-handle');head.tabIndex=0;head.title=(item.dataset.statusId?'Двойное нажатие — перевернуть и очистить · ':'')+'Перетащите за шапку для перестановки · Alt + ← / →';}});
  });
 }
 function arrange(cards){
  const before=new Map(cards.map(item=>[item,item.getBoundingClientRect()])),scale=renderedScale(root);
  cards.forEach((item,i)=>{animations.get(item)?.cancel();animations.delete(item);item.style.order=String(i);});
  if(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||root.querySelector('[data-scroll-animation=off]'))return;
  for(const item of cards){if(item===drag?.item||typeof item.animate!=='function')continue;const after=item.getBoundingClientRect(),dx=(before.get(item).left-after.left)/scale,dy=((before.get(item).top||0)-(after.top||0))/scale;if(!dx&&!dy)continue;
   const a=item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:180,easing:'cubic-bezier(.22,.7,.25,1)'});animations.set(item,a);a.finished.then(()=>{if(animations.get(item)===a)animations.delete(item);},()=>{});
  }
 }
 function update(x,y){
  const others=ordered(drag.row).filter(item=>item!==drag.item);let index;
  if(drag.row.matches('.mt-status-cards')){
   const rects=others.map(item=>item.getBoundingClientRect()),columns=[...new Set(rects.map(r=>Math.round(r.left)))];
   const column=columns.find(left=>{const rect=rects.find(r=>Math.round(r.left)===left);return x<rect.right+6*renderedScale(root);});
   index=column===undefined?others.length:rects.findIndex(r=>Math.round(r.left)===column&&y<r.top+r.height/2);
   if(index<0)index=rects.reduce((last,r,i)=>Math.round(r.left)===column?i+1:last,others.length);
  }else index=others.findIndex(item=>x<item.getBoundingClientRect().left+item.getBoundingClientRect().width/2);
  if(index<0)index=others.length;
  const next=[...others];next.splice(index,0,drag.item);if(next.some((item,i)=>ordered(drag.row)[i]!==item))arrange(next);
  const rect=drag.item.getBoundingClientRect(),scale=renderedScale(root),baseX=rect.left-drag.translation.x,baseY=(rect.top||0)-drag.translation.y;
  drag.translation={x:x-drag.offset.x-baseX,y:y-drag.offset.y-baseY};drag.item.style.transform=`translate(${drag.translation.x/scale}px,${drag.translation.y/scale}px)`;
 }
 function autoScroll(){
  if(!drag?.active)return;const bounds=drag.row.getBoundingClientRect(),old=drag.row.scrollLeft;
  if(drag.x<bounds.left+32)drag.row.scrollLeft-=10;else if(drag.x>bounds.right-32)drag.row.scrollLeft+=10;
  if(old!==drag.row.scrollLeft)update(drag.x,drag.y);frame=win.requestAnimationFrame?.(autoScroll);
 }
 function move(e){
  if(!drag||e.pointerId!==drag.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.active){if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5)return;drag.active=true;beforeDrag();drag.item.classList.add('mt-card-dragging');drag.head.setPointerCapture?.(e.pointerId);frame=win.requestAnimationFrame?.(autoScroll);}
  e.preventDefault();update(e.clientX,e.clientY);
 }
 function finish(e,cancel=false){
  if(!drag||e.pointerId!==drag.pointerId)return;const current=drag;if(frame!==undefined)win.cancelAnimationFrame?.(frame);
  if(current.active){
   const before=current.item.getBoundingClientRect();current.item.style.transform=current.transform;current.item.classList.remove('mt-card-dragging');
   if(cancel)arrange(current.original);else setOrder(tab(current.row),ordered(current.row).map(identify));
   const after=current.item.getBoundingClientRect(),scale=renderedScale(root),dx=(before.left-after.left)/scale,dy=((before.top||0)-(after.top||0))/scale;
   if(!cancel&&(dx||dy)&&typeof current.item.animate==='function'&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches&&!root.querySelector('[data-scroll-animation=off]'))current.item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:180,easing:'ease-out'});
   suppress={head:current.head,until:Date.now()+400};current.head.releasePointerCapture?.(e.pointerId);
  }
  drag=null;doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',cancelDrag);
 }
 const up=e=>finish(e),cancelDrag=e=>finish(e,true);
 root.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag||e.target.closest('select,input,textarea,.mt-delete-card,.mt-remove-card,.mt-note-close,.mt-clear,.mt-status-flipping'))return;
  const head=e.target.closest('.mt-reorder-handle'),card=head?.closest('.mt-scroll-frame'),row=card?.closest('.mt-card-row');if(!row)return;
  const item=items(row).find(item=>item===card||item.contains(card));if(!item)return;
  const rect=item.getBoundingClientRect();drag={head,item,row,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,offset:{x:e.clientX-rect.left,y:e.clientY-(rect.top||0)},translation:{x:0,y:0},transform:item.style.transform,original:ordered(row),active:false};
  doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',cancelDrag);
 });
 root.addEventListener('click',e=>{if(suppress&&Date.now()<suppress.until&&suppress.head.contains(e.target)){suppress=null;e.preventDefault();e.stopImmediatePropagation();}},true);
 root.addEventListener('keydown',e=>{
  if(!e.altKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('select,input,textarea'))return;
  const head=e.target.closest('.mt-reorder-handle'),row=head?.closest('.mt-card-row'),card=head?.closest('.mt-scroll-frame');if(!row)return;
  beforeDrag();const cards=ordered(row),index=cards.findIndex(item=>item===card||item.contains(card)),next=index+(e.key==='ArrowLeft'?-1:1);if(index<0||next<0||next>=cards.length)return;
  e.preventDefault();[cards[index],cards[next]]=[cards[next],cards[index]];arrange(cards);setOrder(tab(row),cards.map(identify));
 });
 apply();const observer=new win.MutationObserver(()=>{if(!drag?.active)apply();});observer.observe(root,{childList:true,subtree:true});win.addEventListener('pagehide',()=>{observer.disconnect();if(drag)finish({pointerId:drag.pointerId},true);animations.forEach(a=>a.cancel());},{once:true});return {apply};
}
