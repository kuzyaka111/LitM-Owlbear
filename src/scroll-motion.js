// The paper is revealed by height/overflow; text is never scaled.
export function createScrollMotion(root){
 const win=root.ownerDocument.defaultView,media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 let running=[],rows=[];
 function stop(){running.forEach(a=>a.cancel());running=[];rows.forEach(r=>r.classList.remove('mt-scroll-entering'));rows=[];}
 function play(panel){
  stop();if(media?.matches)return;
   const cards=[...panel.querySelectorAll('.mt-scroll-frame')].filter(card=>{const r=card.getBoundingClientRect();return r.width&&r.right>0&&r.left<win.innerWidth;});
   rows=[...panel.querySelectorAll('.mt-card-row')];rows.forEach(r=>r.classList.add('mt-scroll-entering'));
   const animations=[];
   for(const [index,card] of cards.entries()){
    if(typeof card.animate!=='function')continue;
    const body=card.querySelector(':scope > .mt-scroll-body'),height=body.getBoundingClientRect().height;
    const x=win.innerWidth-card.getBoundingClientRect().left+32,options={duration:860,delay:Math.min(index*32,96),easing:'cubic-bezier(.22,.65,.3,1)',fill:'both'};
    animations.push(card.animate([
     {offset:0,transform:`translate3d(${x}px,-8px,0) rotate(3deg)`,opacity:0},
     {offset:.23,transform:'translate3d(14px,-3px,0) rotate(-1.3deg)',opacity:1},
     {offset:.48,transform:'translate3d(-3px,0,0) rotate(.9deg)',opacity:1},
     {offset:.7,transform:'translate3d(1px,-1px,0) rotate(-.5deg)',opacity:1},
     {offset:.86,transform:'translate3d(0,0,0) rotate(.2deg)',opacity:1},
     {offset:1,transform:'none',opacity:1}
    ],options));
    animations.push(body.animate([{offset:0,height:'0px'},{offset:.16,height:'2px'},{offset:.55,height:height*.82+'px'},{offset:.78,height:height+'px'},{offset:1,height:height+'px'}],{...options,easing:'linear'}));
   }
   running=animations;Promise.allSettled(animations.map(a=>a.finished)).then(()=>{if(running!==animations)return;animations.forEach(a=>a.cancel());running=[];rows.forEach(r=>r.classList.remove('mt-scroll-entering'));rows=[];});
 }
 root.addEventListener('pointerdown',e=>{if(e.target.closest('.mt-theme'))stop();});root.addEventListener('keydown',e=>{if(e.target.closest('.mt-theme'))stop();});media?.addEventListener?.('change',stop);win.addEventListener('pagehide',stop,{once:true});return {play,stop};
}
