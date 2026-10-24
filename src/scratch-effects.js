// Remember state across card rerenders; only a new scratch gets an entrance effect.
export function createScratchEffects(root){
 const states=new Map(),win=root.ownerDocument.defaultView;
 function refresh(){
  const present=new Set();
  root.querySelectorAll('.mt-tag-text[data-key]').forEach(text=>{
   const key=text.dataset.key,row=text.closest('.mt-tag-row,.mt-item-row');if(!row)return;
   const scratched=row.classList.contains('mt-scratched');present.add(key);
   if(scratched&&states.get(key)===false&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)row.classList.add('mt-scratch-reveal');
   states.set(key,scratched);
  });
  for(const key of states.keys())if(!present.has(key))states.delete(key);
 }
 refresh();const observer=new win.MutationObserver(refresh);observer.observe(root,{childList:true,subtree:true});
 win.addEventListener('pagehide',()=>observer.disconnect(),{once:true});return {refresh,dispose:()=>observer.disconnect()};
}
