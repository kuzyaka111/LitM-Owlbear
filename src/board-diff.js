import {BOARD_KEY} from './board-model.js';
export const BOARD_PART='io.github.kuzyaka111.legend-mist/card-part';
// A non-cryptographic geometry fingerprint; hashes are an optimization, never authority.
export function paintHash(part){const text=JSON.stringify(part);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}return (a>>>0).toString(36)+'.'+(b>>>0).toString(36);}
export function reconcileBoardObjects(previous,objects){
 const old=new Map(previous.filter(p=>p.metadata?.[BOARD_PART]?.key).map(p=>[p.metadata[BOARD_PART].key,p])),add=[],update=[],retained=new Set();
 for(const part of objects.parts){const mark=part.metadata[BOARD_PART],before=old.get(mark.key);if(!before||before.type!==part.type){add.push(part);continue;}part.id=before.id;part.zIndex=before.zIndex;retained.add(before.id);if(mark.hash!==before.metadata[BOARD_PART].hash)update.push({before,after:part});}
 objects.root.metadata[BOARD_KEY].parts=objects.parts.map(p=>p.id);
 return {add,update,remove:previous.filter(p=>!retained.has(p.id)).map(p=>p.id)};
}

export function applyPaint(target,before,after){for(const [key,value]of Object.entries(after))if(!['id','lastModified','lastModifiedUserId'].includes(key)&&JSON.stringify(before[key])!==JSON.stringify(value))target[key]=value;}
export function feedbackItems(changes,{parts=[],record}={}){
 const state=[],values=[],covered=new Set(),byId=new Map(changes.map(p=>[p.after.id,p.after]));
 function local(item,z){const copy={...item,id:crypto.randomUUID(),attachedTo:undefined,visible:false,zIndex:z,metadata:{}};state.push(copy);values.push({...copy,visible:item.visible!==false});}
 function cover(basis,rect,color,z){local({...basis,visible:true,commands:[[0,rect.x,rect.y],[1,rect.x+rect.width,rect.y],[1,rect.x+rect.width,rect.y+rect.height],[1,rect.x,rect.y+rect.height],[5]],style:{...basis.style,fillColor:color,fillOpacity:1,strokeOpacity:0,strokeWidth:0}},z);}
 for(const pair of changes){const mark=pair.after.metadata?.[BOARD_PART];if(!mark?.key.startsWith('tag-strike:'))continue;const fieldId=mark.key.slice('tag-strike:'.length),hit=record?.hits?.find(h=>h.id===fieldId&&h.kind==='text');if(!hit)continue;
  const glyphs=parts.filter(p=>p.metadata?.[BOARD_PART]?.key.startsWith('field:'+fieldId+':')),z=pair.before.zIndex+.5;cover(pair.after,hit,hit.style?.background||'#f5e8c6',z);
  glyphs.forEach((p,i)=>{local(byId.get(p.id)||p,z+(i+1)*.001);covered.add(p.id);});local(pair.after,z+(glyphs.length+1)*.001);covered.add(pair.after.id);
 }
 for(const pair of changes){if(covered.has(pair.after.id))continue;const before=pair.before,after=pair.after,mark=after.metadata?.[BOARD_PART];
  if(before.type==='PATH'&&mark?.background&&before.style){
   const points=after.commands.filter(c=>c.length>=3),xs=points.map(c=>c[1]),ys=points.map(c=>c[2]),x=Math.min(...xs)-1,y=Math.min(...ys)-1,width=Math.max(...xs)-x+1,height=Math.max(...ys)-y+1,z=before.zIndex+.5;
   cover(after,{x,y,width,height},mark.background,z);local(after,z+.001);
  }else{state.push(before);values.push(after);}
 }
 return {state,values};
}
export async function previewBoardChanges(obr,changes,context){
 if(!changes.length||!obr.interaction?.startItemInteraction)return ()=>{};
 const {state,values}=feedbackItems(changes,context),[update,stop]=await obr.interaction.startItemInteraction(state);
 update(drafts=>{for(let i=0;i<drafts.length;i++)applyPaint(drafts[i],state[i],values[i]);});return stop;
}
