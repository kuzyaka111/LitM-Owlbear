import * as THREE from 'three';
export function trayMaterials(doc){
 function texture(kind){
  const canvas=doc.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  const data=ctx.createImageData(256,256);let seed=1729;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const grain=kind==='wood'?Math.sin(y*.45+Math.sin(x*.025)*2)*11+Math.sin(y*1.4+x*.012)*5:(random()-.5)*15;
   const base=kind==='wood'?[103,63,33]:[70,43,30],i=(y*256+x)*4;
   for(let c=0;c<3;c++)data.data[i+c]=base[c]+grain+(random()-.5)*5;data.data[i+3]=255;
  }ctx.putImageData(data,0,0);
  if(kind==='leather'){ctx.strokeStyle='#b0875860';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(8,8,240,240);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
 }
 const woodMap=texture('wood'),leatherMap=texture('leather');
 const wood=new THREE.MeshStandardMaterial({map:woodMap,roughness:.52,bumpMap:woodMap,bumpScale:.025});
 const leather=new THREE.MeshStandardMaterial({map:leatherMap,roughness:.85,bumpMap:leatherMap,bumpScale:.015});
 return {wood,leather,dispose(){woodMap.dispose();leatherMap.dispose();wood.dispose();leather.dispose();}};
}
