import {cardWorldPoint} from './board-model.js';
export async function inlineEditorOptions(obr,item,hit,base){
 const dpi=item.type==='PATH'?150:await obr.scene.grid.getDpi(),corners=await Promise.all([[hit.x,hit.y],[hit.x+hit.width,hit.y],[hit.x,hit.y+hit.height],[hit.x+hit.width,hit.y+hit.height]].map(([x,y])=>obr.viewport.transformPoint(cardWorldPoint(item,{x,y},dpi))));
 const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),width=Math.max(60,Math.max(...corners.map(p=>p.x))-left),height=Math.max(32,Math.max(...corners.map(p=>p.y))-top),scale=Math.hypot(corners[1].x-corners[0].x,corners[1].y-corners[0].y)/Math.max(1,hit.width);
 const url=new URL('./card-editor.html',base);url.searchParams.set('item',item.id);url.searchParams.set('field',hit.id);url.searchParams.set('style',JSON.stringify({...hit.style,fontSize:(hit.style?.fontSize||15)*scale,lineHeight:(hit.style?.lineHeight||24)*scale}));
 return {url:url.href,width:Math.ceil(width),height:Math.ceil(height),anchorPosition:{left,top},anchorReference:'POSITION',anchorOrigin:{horizontal:'LEFT',vertical:'TOP'},transformOrigin:{horizontal:'LEFT',vertical:'TOP'},hidePaper:true,disableClickAway:true,marginThreshold:0};
}
export function bindInlineInput(input,{save,close,report}){
 let finishing=false,canceled=false;
 async function commit(){if(finishing||canceled)return;finishing=true;input.readOnly=true;try{await save(input.value);await close();}catch(error){finishing=false;input.readOnly=false;report(error);input.focus();}}
 const key=e=>{if(e.key==='Escape'){e.preventDefault();canceled=true;void close();}else if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void commit();}};
 input.addEventListener('keydown',key);input.addEventListener('blur',commit);
 return ()=>{input.removeEventListener('keydown',key);input.removeEventListener('blur',commit);};
}
