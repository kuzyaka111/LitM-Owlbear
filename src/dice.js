export function rollD6(crypto=globalThis.crypto){
 const a=new Uint32Array(1),limit=4294967292;
 do{crypto.getRandomValues(a);}while(a[0]>=limit);
 return a[0]%6+1;
}
const rotations={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
const dots={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
export async function animateDice(doc,values){
 const win=doc.defaultView,overlay=doc.createElement('div');overlay.className='mt-dice-overlay';overlay.setAttribute('aria-hidden','true');doc.body.append(overlay);
 const cubes=values.map((value,i)=>{
  const holder=doc.createElement('div');holder.className='mt-die-holder';holder.dataset.value=String(value);const cube=doc.createElement('div');cube.className='mt-die';holder.append(cube);overlay.append(holder);
  for(let n=1;n<=6;n++){const face=doc.createElement('div');face.className='mt-die-face face-'+n;for(let cell=1;cell<=9;cell++){const dot=doc.createElement('i');if(dots[n].includes(cell))dot.className='pip';face.append(dot);}cube.append(face);}
  return {holder,cube,value,x:win.innerWidth*(i?.65:.25),y:70+i*50,vx:(i?-1:1)*(450+Math.random()*150),vy:200+Math.random()*150,rx:0,ry:0};
 });
 await new Promise(resolve=>{
  let start,last,frame;const end=()=>{win.cancelAnimationFrame(frame);win.removeEventListener('pagehide',end);overlay.remove();resolve();};win.addEventListener('pagehide',end,{once:true});
  function step(now){start??=now;last??=now;const t=(now-start)/1000,dt=Math.min((now-last)/1000,.04);last=now;
   for(const d of cubes){const w=Math.max(60,win.innerWidth-60),h=Math.max(60,win.innerHeight-60);
    if(t<1.65){d.vy+=240*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
     if(d.x<35||d.x>w){d.x=Math.max(35,Math.min(w,d.x));d.vx*=-.78;}
     if(d.y<35||d.y>h){d.y=Math.max(35,Math.min(h,d.y));d.vy*=-.72;}
     d.vx*=Math.pow(.65,dt);d.rx+=d.vy*dt*1.6;d.ry+=d.vx*dt*1.8;
    }else{d.settle??={x:d.x,y:d.y,rx:d.rx,ry:d.ry};const p=Math.min(1,(t-1.65)/.9),ease=1-Math.pow(1-p,3),[rx,ry]=rotations[d.value];
     d.rx=d.settle.rx+(rx+360*Math.round(d.settle.rx/360)-d.settle.rx)*ease;d.ry=d.settle.ry+(ry+360*Math.round(d.settle.ry/360)-d.settle.ry)*ease;
     d.x=d.settle.x+(win.innerWidth/2+(d===cubes[0]?-42:42)-d.settle.x)*ease;d.y=d.settle.y+(win.innerHeight/2-d.settle.y)*ease;
    }
    d.holder.style.transform=`translate(${d.x-24}px,${d.y-24}px)`;d.cube.style.transform=`rotateX(${d.rx}deg) rotateY(${d.ry}deg)`;
   }
   if(t>=2.9)end();else frame=win.requestAnimationFrame(step);
  }frame=win.requestAnimationFrame(step);
 });
}
