export const newStatus=kind=>({id:crypto.randomUUID(),kind,returnKind:kind==='numeric'?'numeric':'status',name:'',marks:Array(6).fill(false),scratched:false});
export function cleanStatuses(value){
 if(!Array.isArray(value))return [];const ids=new Set();
 return value.filter(v=>v&&typeof v==='object').slice(0,60).map((v,i)=>{
  let id=typeof v.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v.id)?v.id:'status-'+i;while(ids.has(id))id+='-copy';ids.add(id);
  const kind=['numeric','status','story'].includes(v.kind)?v.kind:'status';
  return {id,kind,returnKind:kind==='numeric'||v.returnKind==='numeric'?'numeric':'status',name:typeof v.name==='string'?v.name.slice(0,160):'',marks:Array.from({length:6},(_,j)=>kind==='numeric'&&v.marks?.[j]===true),scratched:kind==='story'&&v.scratched===true};
 });
}
export function flipStatus(item){
 if(item.kind==='story')item.kind=item.returnKind;
 else{item.returnKind=item.kind;item.kind='story';}
 item.name='';item.marks=Array(6).fill(false);item.scratched=false;
}
