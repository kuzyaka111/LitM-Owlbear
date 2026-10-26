export function allowedDetachedKey(key,{room,player,view}){
 if(typeof key!=='string')return false;
 const local='legend-mist-prototype:v1:'+JSON.stringify([room,player,view]);
 if(key===local||key===local+':before-v4')return true;
 if(view!=='gm')return false;
 const roster='legend-mist-gm-sheets:v1:'+JSON.stringify([room,player]);
 if(key===roster||key===roster+':vault'||key==='legend-mist-cloud-auth:v1'||key.startsWith('legend-mist-cloud-auth:v1-'))return true;
 for(const prefix of ['legend-mist-gm-cloud:v1:','legend-mist-gm-cloud-legacy-owner:v1:']){
  if(!key.startsWith(prefix))continue;try{const parts=JSON.parse(key.slice(prefix.length).replace(/:backup$/,''));return Array.isArray(parts)&&(prefix.includes('legacy-owner')?parts[0]===room&&parts[1]===player:parts[1]===room);}catch{return false;}
 }return false;
}
export function storageSnapshot(storage,scope){
 const result={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(allowedDetachedKey(key,scope))result[key]=storage.getItem(key);}return result;
}
export function createDetachedStorage({initial,scope,request,cache,notify=()=>{},report=()=>{}}){
 const values=new Map(Object.entries(initial)),pending=new Map();let queue=Promise.resolve(),failed=false;
 const cacheKey='legend-mist-detached-draft:v1:'+JSON.stringify(scope);
 let draft;try{draft=JSON.parse(cache.getItem(cacheKey));}catch{}
 // Never silently replace room data with an earlier unsent draft.
 const recovery=draft&&typeof draft==='object'&&Object.keys(draft).length?draft:null;
 function persistDraft(){cache.setItem(cacheKey,JSON.stringify(Object.fromEntries(pending)));}
 function write(key,value){
  if(!allowedDetachedKey(key,scope))throw Error('Нет доступа к этой записи.');
  if(!failed&&(values.get(key)??null)===value)return;
  const hadPending=pending.has(key),previous=pending.get(key);pending.set(key,value);try{persistDraft();}catch(error){if(!hadPending)pending.delete(key);else pending.set(key,previous);throw error;}
  if(value===null)values.delete(key);else values.set(key,value);
  queue=queue.catch(()=>{}).then(async()=>{try{await request('storage',{key,value});if(pending.get(key)===value){pending.delete(key);persistDraft();}failed=false;}catch(error){failed=true;report(error);throw error;}});void queue.catch(()=>{});
 }
 return {
  getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>write(key,String(value)),removeItem:key=>write(key,null),
  key:index=>[...values.keys()][index]??null,get length(){return values.size;},get dirty(){return pending.size>0;},recovery,
  async flush(){await queue;if(failed||pending.size)throw Error('Не все изменения дошли до комнаты. Оставьте вкладку открытой и повторите сохранение.');},
  receive(key,value){if(!allowedDetachedKey(key,scope)||pending.has(key)||values.get(key)===value)return;if(value===null)values.delete(key);else values.set(key,value);notify(key);},
  async recover(){for(const [key,value]of Object.entries(recovery||{}))if(allowedDetachedKey(key,scope))write(key,value);await this.flush();},
 };
}
