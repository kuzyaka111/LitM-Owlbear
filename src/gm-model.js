import {cleanNoteCards} from './notes-model.js';
const text=(v,max=5000)=>typeof v==='string'?v.slice(0,max):'';
const list=v=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];
const identifier=(v,f)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)?v:f;
export const gmId=()=>crypto.randomUUID();
export const newScene=()=>({id:gmId(),name:'Новая сцена',groupId:null,tags:[],statuses:[],notes:[],obstacles:[]});
export const newObstacle=()=>({id:gmId(),name:'Новое препятствие',image:null,hidden:[],limits:[],tags:[],statuses:[],features:[],threats:[]});
export const newObstacleRow=()=>({id:gmId(),name:'',text:'',value:'',hidden:false,spent:false,direction:0,kind:'status',marks:Array(6).fill(false)});
export function cleanGMStatus(value){
 const v=value||{},legacy=Number(v.value),kind=v.kind==='numeric'?'numeric':v.kind==='status'?'status':Number.isFinite(legacy)&&legacy>1?'numeric':'status';
 const marks=Array.from({length:6},(_,i)=>Array.isArray(v.marks)?v.marks[i]===true:kind==='numeric'&&i===Math.min(6,Math.max(1,Math.trunc(legacy)))-1);return {kind,marks};
}
export function gmStatusValue(value){const status=cleanGMStatus(value);return status.kind==='numeric'?Math.max(0,...status.marks.flatMap((marked,i)=>marked?[i+1]:[])):1;}
export function toggleGMStatusKind(row){const current=cleanGMStatus(row);row.kind=current.kind==='numeric'?'status':'numeric';row.marks=current.marks;}
function sceneRows(value,prefix,statuses=false){
 const seen=new Set();return (Array.isArray(value)?value:[]).filter(v=>typeof v==='string'||v&&typeof v==='object').slice(0,50).map((value,i)=>{const r=typeof value==='string'?{name:value}:value;let id=identifier(r.id,prefix+'-'+i);while(seen.has(id))id+='-copy';seen.add(id);return {id,name:text(r.name,160),value:text(r.value,60),hidden:r.hidden===true,direction:r.direction===1?1:r.direction===-1?-1:0,...(statuses?cleanGMStatus(r):{})};});
}
export function safeImage(value){
 try{const u=new URL(value?.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)return null;return {url:u.href,width:Math.max(1,Math.min(20000,Number(value.width)||600)),height:Math.max(1,Math.min(20000,Number(value.height)||400)),mime:['image/png','image/jpeg','image/webp','image/gif'].includes(value.mime)?value.mime:'image/png'};}catch{return null;}
}
export function cleanObstacle(value,fallback='obstacle'){
 const v=value||{};return {id:identifier(v.id,fallback),name:text(v.name,160),image:safeImage(v.image),hidden:['name','image'].filter(k=>Array.isArray(v.hidden)&&v.hidden.includes(k)),...Object.fromEntries(['limits','tags','statuses','features','threats'].map(kind=>[kind,list(v[kind]).slice(0,30).map((r,i)=>({id:identifier(r.id,kind+'-'+i),name:text(r.name,120),text:text(r.text,1200),value:text(r.value,60),hidden:r.hidden===true,spent:r.spent===true,direction:r.direction===1?1:r.direction===-1?-1:0,...(kind==='statuses'?cleanGMStatus(r):{})}))]))};
}
export function gmDefaults(){return cleanGM({scene:['Густой туман','Старый каменный мост'],notes:'Мельник прячет письмо под настилом. Он согласится поговорить, когда стража уйдёт.'});}
export function cleanGM(value){
 const v=value||{},seen=new Set(),unique=(id,f)=>{let key=identifier(id,f);while(seen.has(key))key+='-copy';seen.add(key);return key;};
 const groups=list(v.groups).slice(0,60).map((g,i)=>({id:unique(g.id,'group-'+i),name:text(g.name,120)||'Группа',collapsed:g.collapsed===true}));
 const old={id:'original-scene',name:'У старого моста',tags:Array.isArray(v.scene)?v.scene:[],notes:[{id:'original-gm-notes',title:'Заметки',open:true,sections:[{id:'original-gm-body',title:'',text:text(v.notes),collapsed:false,children:[]}]}]};
 const scenes=list(Array.isArray(v.scenes)?v.scenes:[old]).slice(0,100).map((s,i)=>({id:unique(s.id,'scene-'+i),name:text(s.name,160)||'Без названия',groupId:groups.some(g=>g.id===s.groupId)?s.groupId:null,tags:sceneRows(s.tags,'scene-'+i+'-tag'),statuses:sceneRows(s.statuses,'scene-'+i+'-status',true),notes:cleanNoteCards(s.notes,''),obstacles:list(s.obstacles).slice(0,60).map((o,j)=>({...cleanObstacle(o),id:unique(o.id,`obstacle-${i}-${j}`)}))}));
 const library=list(v.library).slice(0,100).map((o,i)=>({...cleanObstacle(o),id:unique(o.id,'template-'+i)}));
 const activeSceneId=scenes.some(s=>s.id===v.activeSceneId)?v.activeSceneId:scenes[0]?.id||null,active=scenes.find(s=>s.id===activeSceneId);
 return {gmSchema:1,groups,scenes,library,activeSceneId,scene:active?.tags.map(t=>t.name)||[],notes:active?.notes[0]?.sections[0]?.text||''};
}
export function moveScene(state,id,groupId=null,beforeId=null){
 const scene=state.scenes.find(s=>s.id===id);if(!scene||groupId!==null&&!state.groups.some(g=>g.id===groupId)||beforeId===id)return false;
 state.scenes=state.scenes.filter(s=>s!==scene);scene.groupId=groupId;const index=state.scenes.findIndex(s=>s.id===beforeId&&s.groupId===groupId);if(index<0)state.scenes.push(scene);else state.scenes.splice(index,0,scene);return true;
}
export function copyObstacle(source){const copy=cleanObstacle(structuredClone(source));copy.id=gmId();for(const kind of ['limits','tags','statuses','features','threats'])copy[kind].forEach(r=>r.id=gmId());return copy;}
export function findObstacle(state,id){return state.library.find(o=>o.id===id)||state.scenes.flatMap(s=>s.obstacles).find(o=>o.id===id);}
export function sceneEffectSource(scene,kind,row){return {id:'scene-effect:'+scene.id+':'+kind+':'+row.id,name:row.name,sceneName:scene.name,actionSource:'scene:'+scene.id,effectKind:kind,...(kind==='statuses'?{status:row}:{tag:row})};}
export function findSceneEffect(state,source){const [prefix,sceneId,kind,rowId]=source.split(':');if(prefix!=='scene-effect'||!['tags','statuses'].includes(kind))return null;const scene=state.scenes.find(s=>s.id===sceneId),row=scene?.[kind].find(r=>r.id===rowId);return row?sceneEffectSource(scene,kind,row):null;}
export function publicSceneEffect(source){const row=source.status||source.tag;if(row.hidden)throw Error('Скрытый элемент нельзя вынести на поле.');return {name:row.name,id:row.id,effectKind:source.effectKind,direction:row.direction,...(source.status?{...cleanGMStatus(row),value:gmStatusValue(row)}:{})};}
export function publicObstacle(obstacle){
 const o=cleanObstacle(obstacle);return {name:o.hidden.includes('name')?'Препятствие':o.name,image:o.hidden.includes('image')?null:o.image,...Object.fromEntries(['tags','statuses','features','threats'].map(kind=>[kind,o[kind].filter(r=>!r.hidden).map(row=>{const {id,name,text,value,spent,direction}=row;return kind==='tags'||kind==='statuses'?{id,name,spent:false,direction,...(kind==='statuses'?{...cleanGMStatus(row),value:String(gmStatusValue(row))}: {})}:{id,name,text,value,spent};})]))};
}
export const obstacleReference=id=>'@[Препятствие]('+id+')';
export function referenceParts(text){return [...text.matchAll(/@\[([^\]]*)\]\(([a-zA-Z0-9_-]{1,80})\)/g)].map(m=>({start:m.index,end:m.index+m[0].length,id:m[2]}));}
