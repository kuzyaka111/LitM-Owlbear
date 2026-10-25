export function emptyCharacter(defaults){
 const s=defaults('sheet');s.name='Новый персонаж';s.playerName='';s.concept='';s.relationships=[];s.promise=0;s.selected=[];s.marks=[];s.notes='';s.noteCards=[];s.statusCards=[];
 for(const t of s.heroThemes){for(const kind of ['power','weakness'])for(const tag of t[kind])tag.text='';t.quest='';t.notes='';t.improve=t.abandon=t.milestone=0;}
 s.cards[0].items=[];return s;
}
export function makeCharacterStore(storage,scope,{clean,defaults}){
 const key='legend-mist-prototype:v1:'+JSON.stringify([scope.room,scope.player,'sheet']);
 let hash=2166136261,hash2=2246822519;for(const c of key){hash=Math.imul(hash^c.charCodeAt(0),16777619);hash2=Math.imul(hash2^c.charCodeAt(0),3266489917);}const legacyId='legacy-'+(hash>>>0).toString(16)+(hash2>>>0).toString(16);
 const safe=(state,id)=>({...clean(state,'sheet'),characterId:id});
 function read(){
  let raw;try{raw=JSON.parse(storage.getItem(key));}catch{}
  if(raw?.rosterVersion===1&&Array.isArray(raw.characters)){
   const seen=new Set(),characters=raw.characters.filter(c=>c&&typeof c.id==='string'&&/^[\w-]{1,100}$/.test(c.id)&&!seen.has(c.id)&&seen.add(c.id)).slice(0,50).map(c=>({id:c.id,state:safe(c.state,c.id)}));
   return {characters,activeCharacterId:characters.some(c=>c.id===raw.activeCharacterId)?raw.activeCharacterId:characters[0]?.id||null,receipts:Array.isArray(raw.characterReceipts)?raw.characterReceipts.slice(-30):[]};
  }
  return {characters:[{id:legacyId,state:safe(raw||defaults('sheet'),legacyId)}],activeCharacterId:legacyId,receipts:[]};
 }
 function write(roster){
  const active=roster.characters.find(c=>c.id===roster.activeCharacterId),before=storage.getItem(key);let previous;try{previous=JSON.parse(before);}catch{}
  if(before&&previous?.schemaVersion!==4&&!storage.getItem(key+':before-v4'))storage.setItem(key+':before-v4',before);
  storage.setItem(key,JSON.stringify({...safe(active?.state||emptyCharacter(defaults),active?.id||null),rosterVersion:1,activeCharacterId:active?.id||null,characters:roster.characters,characterReceipts:roster.receipts}));
  if(globalThis.dispatchEvent&&globalThis.CustomEvent){const event=new CustomEvent('legend-mist-store');Object.defineProperty(event,'key',{value:key});globalThis.dispatchEvent(event);}
 }
 function mutate(fn){const roster=read(),result=fn(roster);write(roster);return result;}
 const api={
  legacyId,
  exists(){try{return storage.getItem(key)!=null;}catch{return false;}},
  load(){const r=read();return r.characters.find(c=>c.id===r.activeCharacterId)?.state||safe(emptyCharacter(defaults),null);},
  loadCharacter(id){return read().characters.find(c=>c.id===id)?.state||null;},
  listCharacters(){return read().characters;},
  activeId(){return read().activeCharacterId;},
  save(state){try{return mutate(r=>{const id=state.characterId||r.activeCharacterId,c=r.characters.find(c=>c.id===id);if(!c)throw Error('Персонаж больше не закреплён за вами.');c.state=safe(state,id);return true;});}catch{return false;}},
  saveCharacter(id,state){return api.save({...state,characterId:id});},
  createCharacter(){return mutate(r=>{if(r.characters.length>=50)throw Error('Можно хранить не более 50 персонажей.');const id=crypto.randomUUID();r.characters.push({id,state:safe(emptyCharacter(defaults),id)});r.activeCharacterId=id;return id;});},
  selectCharacter(id){return mutate(r=>{if(!r.characters.some(c=>c.id===id))throw Error('Этот персонаж больше не закреплён за вами.');r.activeCharacterId=id;});},
  deleteCharacter(id){return mutate(r=>{r.characters=r.characters.filter(c=>c.id!==id);if(r.activeCharacterId===id)r.activeCharacterId=r.characters[0]?.id||null;});},
  applyCharacterCommand(operation,command){return mutate(r=>{
   const previous=r.receipts.find(e=>e.operation===operation);if(previous)return previous.result;
   if(command.type==='grant'&&!api.exists()){r.characters=[];r.activeCharacterId=null;}
   let result;if(command.type==='revoke'){
    const character=r.characters.find(c=>c.id===command.id);if(!character)throw Error('Персонаж уже отсутствует у игрока.');result={character:structuredClone(character)};
    r.characters=r.characters.filter(c=>c.id!==command.id);if(r.activeCharacterId===command.id)r.activeCharacterId=r.characters[0]?.id||null;
   }else if(command.type==='grant'){
    if(r.characters.some(c=>c.id===command.character?.id))throw Error('Этот персонаж уже есть у игрока.');
    if(r.characters.length>=50)throw Error('У игрока уже 50 персонажей.');const id=command.character?.id;if(typeof id!=='string'||!/^[\w-]{1,100}$/.test(id))throw Error('Некорректный персонаж.');
    r.characters.push({id,state:safe(command.character.state,id)});if(!r.activeCharacterId)r.activeCharacterId=id;result={id};
   }else throw Error('Неизвестное действие с персонажем.');
   r.receipts.push({operation,result});r.receipts=r.receipts.slice(-30);return result;
  });},
  subscribe(fn){const receive=e=>{if(e.key===key&&(!e.storageArea||e.storageArea===storage))fn();};globalThis.addEventListener?.('storage',receive);globalThis.addEventListener?.('legend-mist-store',receive);return()=>{globalThis.removeEventListener?.('storage',receive);globalThis.removeEventListener?.('legend-mist-store',receive);};},
 };
 return api;
}
