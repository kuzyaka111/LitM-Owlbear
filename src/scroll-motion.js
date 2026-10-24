// Move cards as one spaced row. Only the paper reveal is staggered.
export function createScrollMotion(root){
 const win=root.ownerDocument.defaultView,media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 let running=[],rows=[];
 function stop(){running.forEach(a=>a.cancel());running=[];rows.forEach(({row,height})=>{row.classList.remove('mt-scroll-entering');row.style.minHeight=height;});rows=[];}
 function play(panel){
  stop();if(media?.matches||root.querySelector('[data-scroll-animation=off]'))return;
  // Measure the entire layout before applying any animation.
  const cards=[...panel.querySelectorAll('.mt-scroll-frame')].map(card=>({card,rect:card.getBoundingClientRect(),body:card.querySelector(':scope > .mt-scroll-body')})).filter(x=>x.rect.width);
  const measured=cards.map(x=>({...x,height:x.body.getBoundingClientRect().height}));
  rows=[...panel.querySelectorAll('.mt-card-row')].map(row=>({row,height:row.style.minHeight}));
  rows.forEach(({row})=>{row.style.minHeight=row.getBoundingClientRect().height+'px';row.classList.add('mt-scroll-entering');});
  const x=-(Math.max(win.innerWidth,...measured.map(x=>x.rect.right))+32),animations=[];
  for(const [index,{card,body,height}] of measured.entries()){
   if(typeof card.animate!=='function')continue;
   // Identical displacement and timing preserve the gaps, even for long inventories.
   animations.push(card.animate([
    {offset:0,transform:`translate3d(${x}px,0,0)`,opacity:0,easing:'cubic-bezier(.22,.65,.3,1)'},
    {offset:.4,transform:'translate3d(0,0,0) rotate(0deg)',opacity:1},
    {offset:.55,transform:'translate3d(0,0,0) rotate(.35deg)',opacity:1},
    {offset:.7,transform:'translate3d(0,0,0) rotate(-.22deg)',opacity:1},
    {offset:.85,transform:'translate3d(0,0,0) rotate(.1deg)',opacity:1},
    {offset:1,transform:'translate3d(0,0,0)',opacity:1}
   ],{duration:860,easing:'linear',fill:'both'}));
   animations.push(body.animate([
    {offset:0,height:'0px'},{offset:.4,height:'0px'},
    {offset:.95,height:height+'px'},{offset:1,height:height+'px'}
   ],{duration:860,delay:Math.min(index*24,96),easing:'linear',fill:'both'}));
  }
  running=animations;Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(running===animations)stop();});
 }
 root.addEventListener('pointerdown',e=>{if(e.target.closest('.mt-theme'))stop();});root.addEventListener('keydown',e=>{if(e.target.closest('.mt-theme'))stop();});media?.addEventListener?.('change',stop);win.addEventListener('pagehide',stop,{once:true});return {play,stop};
}
