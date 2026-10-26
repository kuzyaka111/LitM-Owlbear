import {CLOUD_URL,CLOUD_PUBLIC_KEY} from './cloud-config.js';
let pending;
export function getCloudClient(storage){
 pending??=import('@supabase/supabase-js').then(({createClient})=>createClient(CLOUD_URL,CLOUD_PUBLIC_KEY,{
  auth:{storageKey:'legend-mist-cloud-auth:v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,...(storage?{storage}:{})},
  global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([...(options.signal?[options.signal]:[]),AbortSignal.timeout(12000)])})},
 })).catch(error=>{pending=null;throw error;});
 return pending;
}
export function cloudRepository(client){
 return {
  async read(user,room,signal){const {data,error}=await client.from('gm_panels').select('document,revision,updated_at').eq('owner_id',user).eq('room_id',room).maybeSingle().abortSignal(signal);if(error)throw error;return data;},
  async write(room,revision,document,signal){const {data,error}=await client.rpc('save_gm_panel',{p_room_id:room,p_expected_revision:revision,p_document:document}).abortSignal(signal);if(error)throw error;return Array.isArray(data)?data[0]:data;},
 };
}
