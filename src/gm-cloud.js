import {cleanGM} from './gm-model.js';
import {cloudRepository} from './cloud-client.js';
const empty=()=>cleanGM({scenes:[],groups:[],library:[]});
const clone=value=>structuredClone(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createGMCloud({client:getClient,localStore,storage,roomId,localScope='default',allowed=async()=>true,deferRemote=()=>false,delay=700,poll=15000}){
 let client,repo,user=null,alive=true,epoch=0,abort=new AbortController(),timer,interval,offAuth,queue=Promise.resolve(),busy=false;
 let document=localStore.load(),revision=null,dirty=false,sequence=0,conflict=null,status='local',detail='',ready=false;
 const statuses=new Set(),documents=new Set();
 const cacheKey=id=>'legend-mist-gm-cloud:v1:'+JSON.stringify([id,roomId]);
 const backupKey=id=>cacheKey(id)+':backup';
 const legacyOwnerKey='legend-mist-gm-cloud-legacy-owner:v1:'+JSON.stringify([roomId,localScope]);
 const snapshot=()=>({user:user?{id:user.id,email:user.email}:null,status,detail,dirty,conflict:!!conflict,ready});
 const emit=()=>{if(alive)for(const fn of statuses)fn(snapshot());};
 const publish=()=>{if(alive)for(const fn of documents)fn(clone(document));};
 const setStatus=(next,message='')=>{if(status===next&&detail===message)return;status=next;detail=message;emit();};
 function cache(){storage.setItem(cacheKey(user.id),JSON.stringify({document,revision,dirty}));}
 function backup(value){storage.setItem(backupKey(user.id),JSON.stringify({document:cleanGM(value),savedAt:new Date().toISOString()}));}
 async function guard(){if(!alive||!await allowed())throw Error('Облачная панель доступна только ведущему.');}
 function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;}
 async function ensureClient(){if(!client)await service.start();if(!client)throw Error('Не удалось подключить облако. Проверьте соединение и повторите вход.');}
 function schedule(){clearTimeout(timer);if(alive&&user&&!conflict)timer=setTimeout(()=>void flush().catch(()=>{}),delay);}
 async function adopt(row){
  backup(document);document=cleanGM(row.document);revision=Number(row.revision);dirty=false;conflict=null;++sequence;cache();publish();setStatus('saved');
 }
 async function readRemote({force=false}={}){
  await guard();if(!user||!repo)return;const current=epoch,id=user.id;
  try{
   let row,version;
   if(!force&&revision!==null){version=await repo.version(id,roomId,abort.signal);if(!alive||epoch!==current)return;await guard();if(epoch!==current)return;
    if(version&&Number(version.revision)===(conflict?.revision??revision)){if(conflict)setStatus('conflict',detail);else if(dirty){setStatus('pending');schedule();}else setStatus('saved');return;}
   }
   row=version===null?null:await repo.read(id,roomId,abort.signal);if(!alive||epoch!==current)return;
   await guard();if(epoch!==current)return;
   if(!row){if(revision!==null&&revision!==0){conflict={document:empty(),revision:0};setStatus('conflict','Облачная запись была изменена или удалена.');return;}revision=0;dirty=true;cache();schedule();setStatus('pending');return;}
   if(dirty){
    if(revision===Number(row.revision)){setStatus('pending');schedule();return;}
    if(same(document,cleanGM(row.document))){revision=Number(row.revision);dirty=false;conflict=null;cache();setStatus('saved');return;}
    conflict={document:cleanGM(row.document),revision:Number(row.revision)};setStatus('conflict','Записи изменились на другом устройстве. Выберите версию.');return;
   }
   if(revision===null||Number(row.revision)!==revision){if(!force&&deferRemote())return;await adopt(row);}else setStatus('saved');
  }catch(error){if(!alive||epoch!==current)return;setStatus('offline','Нет связи с облаком. Местная копия сохранена.');}
 }
 function refresh(options){return enqueue(()=>readRemote(options));}
 function flush(){clearTimeout(timer);return enqueue(async()=>{
  await guard();if(!user||!repo||!dirty||conflict)return;
  if(revision===null){await readRemote();if(revision===null||conflict||!dirty)return;}
  const current=epoch,id=user.id,version=sequence,copy=clone(document),expected=revision;busy=true;setStatus('saving');
  try{
   const row=await repo.write(roomId,expected,copy,abort.signal);if(!alive||current!==epoch||user?.id!==id)return;await guard();if(epoch!==current)return;
   revision=Number(row.revision);dirty=version!==sequence;cache();setStatus(dirty?'pending':'saved');if(dirty)schedule();
  }catch(error){
   if(!alive||current!==epoch)return;
   if(error.code==='40001'||error.code==='23505')await readRemote();
   else{setStatus('offline','Не удалось отправить изменения. Они сохранены на этом устройстве.');throw error;}
  }finally{busy=false;}
 });}
 async function activate(next){
  if(!alive)return;if(user?.id===next?.id&&ready){user=next;emit();return;}
  const current=++epoch;abort.abort();abort=new AbortController();clearTimeout(timer);conflict=null;user=next;revision=null;dirty=false;++sequence;
  if(!user){document=localStore.load();ready=true;publish();setStatus('local');return;}
  const raw=storage.getItem(cacheKey(user.id));let saved;try{saved=JSON.parse(raw);}catch{}
  if(saved?.document){document=cleanGM(saved.document);revision=Number.isInteger(saved.revision)?saved.revision:null;dirty=saved.dirty===true;}
  else{const owner=storage.getItem(legacyOwnerKey),migrate=!!localStore.exists?.()&&(!owner||owner===user.id);document=migrate?cleanGM(localStore.load()):empty();revision=null;dirty=migrate;if(migrate)storage.setItem(legacyOwnerKey,user.id);}
  ready=true;publish();setStatus('connecting');await refresh({force:true});if(current!==epoch)return;
 }
 const service={
  store:{
   load:()=>clone(document),exists:()=>user?true:localStore.exists?.(),
   save(value){if(!alive)return false;const next=cleanGM(value);if(user&&status!=='error'&&same(document,next)){if(dirty)schedule();return true;}document=next;++sequence;
    if(!user)return localStore.save(document);
    dirty=true;try{cache();}catch{setStatus('error','Не удалось сохранить местную копию. Освободите место в браузере.');return false;}
    if(conflict)setStatus('conflict',detail);else{setStatus('pending');schedule();}return true;
   },
  },
  async start(){await guard();try{client=await getClient();}catch{ready=true;setStatus('error','Не удалось подключить облако. Местные записи доступны; повторите вход после восстановления связи.');return;}if(!alive)return;repo=cloudRepository(client);
   const result=await client.auth.getSession();if(result.error){ready=true;setStatus('offline','Не удалось проверить вход. Местные записи доступны.');}else await activate(result.data.session?.user||null);
   if(!alive)return;const response=client.auth.onAuthStateChange((_event,session)=>queueMicrotask(()=>void activate(session?.user||null).catch(error=>setStatus('error',error.message))));offAuth=()=>response.data.subscription.unsubscribe();
   interval=setInterval(()=>{if(user&&!busy)void refresh().catch(()=>{});},poll);
  },
  snapshot,refresh,flush,
  subscribe(fn){statuses.add(fn);fn(snapshot());return()=>statuses.delete(fn);},
  subscribeDocument(fn){documents.add(fn);return()=>documents.delete(fn);},
  async signIn(email,password){await guard();await ensureClient();const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw Error('Не удалось войти. Проверьте почту, пароль и подтверждение адреса.');await activate(data.user);},
  async signUp(email,password,redirect){await guard();await ensureClient();const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:redirect}});if(error)throw Error('Не удалось создать аккаунт: '+error.message);if(data.session)await activate(data.user);return !!data.session;},
  async resetPassword(email,redirect){await guard();await ensureClient();const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(error)throw Error('Не удалось отправить письмо для восстановления.');},
  async signOut(){await guard();if(user&&dirty)cache();await flush().catch(()=>{});const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error('Не удалось выйти из аккаунта. Проверьте соединение.');await activate(null);},
  async useCloud(){return enqueue(async()=>{await guard();if(!conflict)return;await adopt(conflict);});},
  async keepLocal(){await enqueue(async()=>{await guard();if(!conflict)return;backup(conflict.document);revision=conflict.revision;conflict=null;dirty=true;cache();setStatus('pending');});return flush();},
  backup(){if(!user)return null;try{return JSON.parse(storage.getItem(backupKey(user.id)));}catch{return null;}},
  dispose(){alive=false;++epoch;abort.abort();clearTimeout(timer);clearInterval(interval);offAuth?.();statuses.clear();documents.clear();},
 };
 return service;
}
