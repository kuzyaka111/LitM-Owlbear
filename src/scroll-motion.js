// Move cards as one spaced row. Only the paper reveal is staggered.
export function createScrollMotion(root,random=Math.random){
 const win=root.ownerDocument.defaultView,media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 let running=[],rows=[];
 function stop(){running.forEach(a=>a.cancel());running=[];rows.forEach(({row,height})=>{row.classList.remove('mt-scroll-entering');row.style.minHeight=height;});rows=[];}
 function unfold(card,ready,onReady){
  stop();const body=card.querySelector(':scope > .mt-scroll-body');
  if(media?.matches||root.querySelector('[data-scroll-animation=off]')||typeof body?.animate!=='function'){
   Promise.resolve(ready).then(()=>{if(card.isConnected)onReady?.();});return;
  }
  const height=body.getBoundingClientRect().height,animation=body.animate([{height:'0px'},{height:height+'px'}],{duration:360,easing:'cubic-bezier(.22,.7,.25,1)',fill:'both'});
  animation.pause();const animations=[animation];running=animations;
  Promise.resolve(ready).then(()=>{if(running!==animations||!card.isConnected)return;onReady?.();animation.play();},()=>{if(running===animations)stop();});
  Promise.allSettled([animation.finished]).then(()=>{if(running===animations)stop();});
 }
 function play(panel){
  stop();if(media?.matches||root.querySelector('[data-scroll-animation=off]'))return;
  // Measure the entire layout before applying any animation.
  const cards=[...panel.querySelectorAll('.mt-scroll-frame:not(.mt-action-card)')].map(card=>({card,rect:card.getBoundingClientRect(),body:card.querySelector(':scope > .mt-scroll-body')})).filter(x=>x.rect.width);
  const measured=cards.map(x=>({...x,height:x.body.getBoundingClientRect().height}));
  rows=[...panel.querySelectorAll('.mt-card-row')].map(row=>({row,height:row.style.minHeight}));
  rows.forEach(({row})=>{row.style.minHeight=row.getBoundingClientRect().height+'px';row.classList.add('mt-scroll-entering');});
  const x=-(Math.max(win.innerWidth,...measured.map(x=>x.rect.right))+32),animations=[];
  for(const [index,{card,body,height}] of measured.entries()){
   if(typeof card.animate!=='function')continue;
   // Same 344ms entrance; independently timed, damped settling thereafter.
   const variants=[{duration:1100,angles:[1.15,-.72,.36,-.12]},{duration:1240,angles:[-.95,.62,-.32,.1]},{duration:1360,angles:[1.3,-.8,.42,-.14]},{duration:1180,angles:[-1.1,.7,-.36,.12]}];
   const variant=variants[Math.min(3,Math.floor(random()*4))],entry=344/variant.duration;
   const frames=[{offset:0,transform:`translate3d(${x}px,0,0)`,opacity:0,easing:'cubic-bezier(.22,.65,.3,1)'},{offset:entry,transform:'translate3d(0,0,0) rotate(0deg)',opacity:1}];
   variant.angles.forEach((angle,i)=>frames.push({offset:entry+(1-entry)*(i+1)/5,transform:`translate3d(0,0,0) rotate(${angle}deg)`,opacity:1,easing:'ease-in-out'}));
   frames.push({offset:1,transform:'translate3d(0,0,0)',opacity:1});
   animations.push(card.animate(frames,{duration:variant.duration,easing:'linear',fill:'both'}));
   animations.push(body.animate([
    {offset:0,height:'0px'},{offset:.4,height:'0px'},
    {offset:.95,height:height+'px'},{offset:1,height:height+'px'}
   ],{duration:860,delay:Math.min(index*24,96),easing:'linear',fill:'both'}));
  }
  running=animations;Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(running===animations)stop();});
 }
 root.addEventListener('pointerdown',e=>{if(e.target.closest('.mt-theme'))stop();});root.addEventListener('keydown',e=>{if(e.target.closest('.mt-theme'))stop();});media?.addEventListener?.('change',stop);win.addEventListener('pagehide',stop,{once:true});return {play,unfold,stop};
}
