import {emptyCharacter} from './character-store.js';
export function createCharacterManagement({storage,key,guard,command,entries,emit,onTaken,defaults}){
 let vault=[];try{const saved=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(saved))vault=saved;}catch{}
 let busy=false;
 const persist=()=>{storage.setItem(key,JSON.stringify(vault));emit();};
 async function exclusive(fn){await guard();if(busy)throw Error('Дождитесь завершения передачи.');busy=true;try{return await fn();}finally{busy=false;}}
 async function finish(item){
  await guard();if(item.phase==='revoke'){
   const result=await command(item.from,item.operation+':revoke',{type:'revoke',id:item.id});
   item.state=result.character.state;item.phase='return-cards';persist();
  }
  if(item.phase==='return-cards'){await onTaken(item);item.phase='held';persist();}
  if(item.phase==='grant'){
   await command(item.target,item.operation+':grant',{type:'grant',character:{id:item.id,state:item.state}});
   const index=vault.indexOf(item);vault.splice(index,1);try{persist();}catch(e){vault.splice(index,0,item);throw e;}
  }
 }
 async function take(player,id){
  if(vault.some(c=>c.id===id))throw Error('Этот персонаж уже находится у ведущего или передаётся.');
  const c=entries.get(player)?.characters?.find(c=>c.id===id);if(!c)throw Error('Дождитесь актуального списка персонажей игрока.');
  const item={id,state:structuredClone(c.state),from:player,phase:'revoke',operation:crypto.randomUUID()};vault.push(item);try{persist();}catch(e){vault.pop();throw e;}await finish(item);return item;
 }
 async function assign(item,target){if(item.phase!=='held')throw Error('Сначала завершите предыдущее действие.');const before=structuredClone(item);item.target=target;item.phase='grant';item.operation=crypto.randomUUID();try{persist();}catch(e){Object.assign(item,before);delete item.target;throw e;}await finish(item);}
 return {
  list:()=>structuredClone(vault),
  take:(player,id)=>exclusive(()=>take(player,id)),
  assign:(id,target)=>exclusive(async()=>{const item=vault.find(c=>c.id===id);if(!item)throw Error('Персонаж не найден у ведущего.');await assign(item,target);}),
  transfer:(player,id,target)=>exclusive(async()=>{const item=await take(player,id);await assign(item,target);}),
  create:target=>exclusive(async()=>{const id=crypto.randomUUID(),item={id,state:{...emptyCharacter(defaults),characterId:id},phase:'held',operation:crypto.randomUUID()};vault.push(item);try{persist();}catch(e){vault.pop();throw e;}if(target)await assign(item,target);return id;}),
  resume:id=>exclusive(async()=>{const item=vault.find(c=>c.id===id);if(!item)throw Error('Персонаж не найден.');await finish(item);}),
 };
}
