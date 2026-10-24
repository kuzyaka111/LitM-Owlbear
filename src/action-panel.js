// A sacrifice is a Quick outcome, so it has no spendable effect Power.
export function calculateAction(base,mode,modifier=0){
 if(mode==='sacrifice')return {power:null,roll:modifier};
 const trade=mode==='caution'&&base<=2?1:mode==='hedge'&&base>=2?-1:0;
 return {power:Math.max(1,base+trade),roll:base-trade+modifier};
}
export function createActionPanel(panel,onVisibility){
 const win=panel.ownerDocument.defaultView;
 let visible=false,animation,sequence=0;
 return {show(next){
  if(next===visible)return;
  visible=next;const token=++sequence;
  const body=panel.querySelector('.mt-scroll-body');
  const from=panel.hidden?0:body?.getBoundingClientRect().height||0;
  animation?.cancel();
  const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(next){panel.hidden=false;panel.inert=false;onVisibility(true);}
  else panel.inert=true;
  const finish=()=>{if(token!==sequence)return;animation?.cancel();animation=null;if(!next){panel.hidden=true;panel.inert=false;onVisibility(false);}};
  if(!body||reduced||typeof body.animate!=='function'){finish();return;}
  animation=body.animate([{height:from+'px'},{height:(next?body.scrollHeight:0)+'px'}],{duration:next?380:160,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
  animation.finished.then(finish,()=>{});
 }};
}
