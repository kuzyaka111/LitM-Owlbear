import {renderedScale} from './sheet-scale.js';
// A sacrifice is a Quick outcome, so it has no spendable effect Power.
export function calculateAction(base,mode,modifier=0){
 if(mode==='sacrifice')return {power:null,roll:modifier};
 const trade=mode==='caution'?1:mode==='hedge'?-1:0;
 return {power:Math.max(1,base+modifier+trade),roll:base-trade+modifier};
}
export function createActionPanel(panel,onVisibility){
 const win=panel.ownerDocument.defaultView;
 let visible=false,animation,sequence=0;
 return {show(next,immediate=false,waitFor){
  if(next===visible&&!immediate)return;
  visible=next;const token=++sequence;
  const body=panel.querySelector('.mt-scroll-body');
  const from=panel.hidden?0:(body?.getBoundingClientRect().height||0)/renderedScale(panel);
  animation?.cancel();
  const reduced=immediate||panel.closest('[data-scroll-animation=off],[data-entrance-animation=off]')||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let resized;
  if(next){panel.hidden=false;panel.inert=false;resized=onVisibility(true);}
  else panel.inert=true;
  const finish=()=>{if(token!==sequence)return;animation?.cancel();animation=null;if(!next){panel.hidden=true;panel.inert=false;onVisibility(false);}};
  const run=()=>{
   if(token!==sequence)return;panel.style.visibility='';
   if(!body||reduced||typeof body.animate!=='function'){finish();return;}
   animation=body.animate([{height:from+'px'},{height:(next?body.scrollHeight:0)+'px'}],{duration:next?380:160,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
   animation.finished.then(finish,()=>{});
  };
  if(next&&resized?.then){
   panel.style.visibility='hidden';
   Promise.resolve(resized).then(()=>new Promise(resolve=>win.requestAnimationFrame?win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)):resolve())).then(run,run);
  }else if(!next&&panel.style.visibility==='hidden'){panel.style.visibility='';finish();}
  else if(!next&&!immediate&&waitFor?.then)Promise.resolve(waitFor).then(run,run);
  else run();
 }};
}

// Retain rows between power recalculations so typing is only played for changed tags.
export function createActionTagList(list,renderRow,emptyText){
 const doc=list.ownerDocument,win=doc.defaultView,rows=new Map();
 const empty=doc.createElement('p');empty.className='mt-empty-action';empty.textContent=emptyText;
 function placeholder(){if(!rows.size)list.replaceChildren(empty);else empty.remove();}
 function animate(entry,removing){
  entry.animations?.forEach(a=>a.cancel());const revision=++entry.revision;
  entry.removing=removing;entry.row.inert=removing;
  const letters=[...entry.text.children],reduced=list.closest('[data-text-animation=off],[data-scroll-animation=off]')||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{
   if(revision!==entry.revision)return;
   entry.animations?.forEach(a=>a.cancel());entry.animations=[];
   if(removing){entry.row.remove();rows.delete(entry.key);placeholder();}
  };
  if(reduced||!letters.length||typeof letters[0].animate!=='function'){finish();return;}
  entry.animations=letters.map((letter,i)=>letter.animate([{opacity:removing?1:0},{opacity:removing?0:1}],{duration:1,delay:500*(removing?letters.length-i:i+1)/letters.length-1,easing:'steps(1,end)',fill:'both'}));
  entry.finished=Promise.allSettled(entry.animations.map(a=>a.finished)).then(finish);
 }
 return {sync(items){
  const present=new Set(items.map(([key])=>key));
  for(const entry of rows.values())if(!present.has(entry.key)&&!entry.removing)animate(entry,true);
  for(const [key,item] of items){
   let entry=rows.get(key);
   if(entry&&(entry.value!==item.text||entry.forced!==!!item.forced)){entry.animations?.forEach(a=>a.cancel());++entry.revision;entry.row.remove();rows.delete(key);entry=null;}
   if(!entry){
    const row=renderRow(key,item),text=row.firstElementChild;text.setAttribute('aria-label',item.text);
    text.replaceChildren(...Array.from(item.text,char=>{const span=doc.createElement('span');span.textContent=char;span.setAttribute('aria-hidden','true');return span;}));
    entry={key,row,text,value:item.text,forced:!!item.forced,revision:0,removing:false,animations:[]};rows.set(key,entry);list.append(row);animate(entry,false);
   }else if(entry.removing)animate(entry,false);
  }
  placeholder();
  const pending=[...rows.values()].filter(entry=>entry.removing&&entry.animations.length).map(entry=>entry.finished);
  return pending.length?Promise.allSettled(pending):undefined;
 }};
}
