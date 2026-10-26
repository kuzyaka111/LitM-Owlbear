export function memoryStorage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
export function fakeCloudDatabase(){
 const rows=new Map();let offline=false,writeGate=null,readGate=null,writes=0;
 const key=(owner,room)=>JSON.stringify([owner,room]);
 function clientFor(initial='owner'){
  let current=initial;const listeners=new Set(),user=()=>current?{id:current,email:current+'@example.invalid'}:null;
  const result=async fn=>{try{return {data:await fn(),error:null};}catch(error){return {data:null,error};}};
  const emit=()=>{for(const fn of listeners)fn(current?'SIGNED_IN':'SIGNED_OUT',current?{user:user()}:null);};
  const client={
   setUser(id){current=id;emit();},
   auth:{getSession:async()=>({data:{session:current?{user:user()}:null},error:null}),onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
    async signInWithPassword({email}){current=email.split('@')[0];emit();return {data:{user:user(),session:{user:user()}},error:null};},
    async signUp(){return {data:{user:{id:'new'},session:null},error:null};},
    async resetPasswordForEmail(){return {error:null};},
    async signOut(){current=null;emit();return {error:null};},
   },
   from(){const filters={};const query={select(){return query;},eq(field,value){filters[field]=value;return query;},maybeSingle(){return query;},abortSignal:signal=>result(async()=>{if(readGate)await readGate;if(signal?.aborted)throw Error('aborted');if(offline)throw Error('offline');if(filters.owner_id!==current)return null;return structuredClone(rows.get(key(current,filters.room_id))||null);})};return query;},
   rpc(_name,args){const owner=current;return {abortSignal:signal=>result(async()=>{if(writeGate)await writeGate;if(signal?.aborted)throw Error('aborted');if(offline)throw Error('offline');if(!owner)throw Error('no auth');const k=key(owner,args.p_room_id),old=rows.get(k),revision=old?.revision||0;if(revision!==args.p_expected_revision)throw Object.assign(Error('conflict'),{code:'40001'});const row={document:structuredClone(args.p_document),revision:revision+1,updated_at:new Date().toISOString()};rows.set(k,row);writes++;return structuredClone(row);})};},
  };return client;
 }
 return {rows,key,clientFor,get writes(){return writes;},set offline(value){offline=value;},set writeGate(value){writeGate=value;},set readGate(value){readGate=value;}};
}
