import {BOARD_KEY} from './board-model.js';
import {gmStatusValue} from './gm-model.js';
export const ACTION_FEED='io.github.kuzyaka111.legend-mist/action-feed/';
const GM_KEY='io.github.kuzyaka111.legend-mist/gm-obstacle';
export const direction=value=>value===-1?-1:value===1?1:0;
export function statusValue(status){return gmStatusValue(status);}
export function strongestStatuses(statuses){return {positive:Math.max(0,...statuses.filter(s=>s.sign>0).map(s=>s.value)),negative:Math.max(0,...statuses.filter(s=>s.sign<0).map(s=>s.value))};}
export const gmSourceKey=(owner,obstacle,kind,row)=>'gm:'+owner+':'+obstacle+':'+kind+':'+row;
export function gmActionFeed(state,owner){
 const feed={v:1,tags:[],statuses:[]},active=state.scenes.find(s=>s.id===state.activeSceneId);
 const scene=active?{id:'scene:'+active.id,tags:active.tags,statuses:active.statuses}:null;
 for(const obstacle of [...(scene?[scene]:[]),...state.library,...(active?.obstacles||[])])for(const kind of ['tags','statuses'])for(const row of obstacle[kind]||[]){if(row.hidden||!row.name.trim()||!direction(row.direction))continue;feed[kind].push({key:gmSourceKey(owner,obstacle.id,kind,row.id),text:row.name.slice(0,160),direction:direction(row.direction),value:kind==='statuses'?gmStatusValue(row):1,source:obstacle===scene?'Сцена':'Препятствие'});}
 return feed;
}
export function collectActionSources(items=[],metadata={},owner,characterId){
 const tags=new Map(),statuses=new Map();
 const put=(list,entry)=>{if(entry.text?.trim())list.set(entry.key,{...entry,kind:entry.direction===-1?'weakness':'power',forced:entry.forced??entry.direction!==0});};
 for(const item of items){if(item.visible===false)continue;const gm=item.metadata?.[GM_KEY],r=item.metadata?.[BOARD_KEY];
  if(gm?.placed&&['obstacle','scene-effect'].includes(gm.card?.type)){const d=gm.card.data,effect=gm.card.type==='scene-effect';for(const kind of ['tags','statuses'])for(const [i,row]of (effect?(d.effectKind===kind?[d]:[]):d[kind]||[]).entries())put(kind==='tags'?tags:statuses,{key:gmSourceKey(gm.owner,gm.actionSource||gm.source,kind,row.id||i),text:row.name,direction:direction(row.direction),forced:!Object.hasOwn(metadata,ACTION_FEED+gm.owner)&&direction(row.direction)!==0,value:kind==='statuses'?gmStatusValue(row):1,source:effect?gm.character:gm.card.data.name||'Препятствие'});}
  if(!r?.placed||!r.card?.data)continue;const d=r.card.data,own=r.owner===owner&&(characterId===undefined||r.source==='fellowship'||r.characterId===characterId||!r.characterId&&characterId?.startsWith('legacy-')),source=r.character||'На поле';
  const tag=(key,text,kind='power')=>put(tags,{key,text,kind,direction:kind==='weakness'?-1:0,value:1,source,forced:false});
  if(r.card.type==='theme')for(const kind of ['power','weakness'])for(const [i,t]of d[kind].entries())if(!t.scratched){const key=(own||r.source==='fellowship')?'theme:'+d.id+':'+kind+':'+i:'field:'+item.id+':'+kind+':'+i;tag(key,t.text,kind);}
  if(r.card.type==='bag')for(const t of d.items)if(!t.scratched)tag(own?'card:'+d.id+':'+t.id:'field:'+item.id+':'+t.id,t.text);
  if(r.card.type==='character')for(const [i,t]of d.relationships.entries())tag(own?'relationship:'+t.id:'field:'+item.id+':relationship:'+i,t.tag);
  if(r.card.type==='status'){if(d.kind==='story'){if(!d.scratched)tag('field:'+item.id+':story',d.name);}else put(statuses,{key:own?'status:'+d.id:'field:'+item.id+':status',text:d.name,value:statusValue(d),direction:0,source,forced:false});}
 }
 for(const [key,feed]of Object.entries(metadata))if(key.startsWith(ACTION_FEED)&&feed?.v===1)for(const kind of ['tags','statuses'])for(const row of (Array.isArray(feed[kind])?feed[kind]:[]).slice(0,200)){if(typeof row.key!=='string'||typeof row.text!=='string')continue;put(kind==='tags'?tags:statuses,{key:row.key.slice(0,300),text:row.text.slice(0,160),direction:direction(row.direction),value:kind==='statuses'?Math.min(99,Math.max(0,Number(row.value)||0)):1,source:'Ведущий'});}
 return {tags,statuses};
}
export function createActionSources(obr,report=console.error,characterId=()=>undefined){
 let items=[],metadata={},value=collectActionSources(),signature='',inputSignature='',epoch=0,alive=true,offItems=()=>{},offMeta=()=>{},offReady=()=>{};const listeners=new Set();
 function publish(){
  const character=characterId(),roots=[];for(const item of items){const record=item.metadata?.[BOARD_KEY]||item.metadata?.[GM_KEY];if(record?.placed)roots.push([item.id,item.visible,record.rev||JSON.stringify(record)]);}
  const input=JSON.stringify([character,roots,Object.entries(metadata).filter(([key])=>key.startsWith(ACTION_FEED))]);if(input===inputSignature)return;inputSignature=input;
  const next=collectActionSources(items,metadata,obr.player.id,character),stamp=JSON.stringify([[...next.tags],[...next.statuses]]);if(stamp===signature)return;signature=stamp;value=next;listeners.forEach(fn=>fn(value));
 }
 async function refresh(ready){const current=++epoch;offItems();offMeta();items=[];metadata={};publish();if(!ready||!alive)return;let itemRev=0,metaRev=0;offItems=obr.scene.items.onChange(next=>{if(current===epoch){itemRev++;items=next;publish();}});offMeta=obr.scene.onMetadataChange(next=>{if(current===epoch){metaRev++;metadata=next;publish();}});const a=itemRev,b=metaRev,[next,meta]=await Promise.all([obr.scene.items.getItems(),obr.scene.getMetadata()]);if(current!==epoch||!alive)return;if(a===itemRev)items=next;if(b===metaRev)metadata=meta;publish();}
 return {async start(){offReady=obr.scene.onReadyChange(ready=>void refresh(ready).catch(report));await refresh(await obr.scene.isReady());},get:()=>value,subscribe(fn){listeners.add(fn);fn(value);return()=>listeners.delete(fn);},dispose(){alive=false;++epoch;offReady();offItems();offMeta();listeners.clear();}};
}
