// Browser fixture only. Never connects to a real room or creates cloud accounts.
import {createDetachedHost} from '../src/detached-host.js';
import {makeStore} from '../src/storage.js';
const listeners=new Map(),roles=new Set();let role='GM',items=[],metadata={},roomMetadata={};
const emit=(id,data)=>{for(const fn of listeners.get(id)||[])fn(data);};
const bus={on(id,fn){if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(fn);},off(id,fn){listeners.get(id)?.delete(fn);},send(id,data){if(id==='OBR_INTERACTION_UPDATE_ITEM_INTERACTION'||id==='OBR_INTERACTION_STOP_ITEM_INTERACTION')return;},async sendAsync(id,data){
 switch(id){
 case 'OBR_PLAYER_GET_ROLE':return {role};case 'OBR_PLAYER_GET_NAME':return {name:'Проверка вкладки'};case 'OBR_PLAYER_GET_CONNECTION_ID':return {connectionId:'preview-connection'};case 'OBR_PLAYER_GET_ID':return {id:'detached-player'};case 'OBR_PARTY_GET_PLAYERS':return {players:[]};
 case 'OBR_SCENE_IS_READY':return {ready:true};case 'OBR_ROOM_GET_PERMISSIONS':return {permissions:[]};case 'OBR_ROOM_GET_METADATA':return {metadata:roomMetadata};case 'OBR_SCENE_GET_METADATA':return {metadata};
 case 'OBR_ROOM_SET_METADATA':Object.assign(roomMetadata,data.update);emit('OBR_ROOM_METADATA_EVENT_CHANGE',{metadata:roomMetadata});return {};
 case 'OBR_SCENE_SET_METADATA':Object.assign(metadata,data.update);emit('OBR_SCENE_METADATA_EVENT_CHANGE',{metadata});return {};
 case 'OBR_SCENE_ITEMS_GET_ALL_ITEMS':return {items};case 'OBR_SCENE_ITEMS_GET_ITEMS':return {items:items.filter(i=>data.ids.includes(i.id))};
 case 'OBR_SCENE_ITEMS_ADD_ITEMS':items.push(...data.items);emit('OBR_SCENE_ITEMS_EVENT_CHANGE',{items});return {};
 case 'OBR_SCENE_ITEMS_UPDATE_ITEMS':for(const update of data.updates)Object.assign(items.find(i=>i.id===update.id)||{},update);emit('OBR_SCENE_ITEMS_EVENT_CHANGE',{items});return {};
 case 'OBR_SCENE_ITEMS_DELETE_ITEMS':items=items.filter(i=>!data.ids.includes(i.id));emit('OBR_SCENE_ITEMS_EVENT_CHANGE',{items});return {};
 case 'OBR_SCENE_GRID_GET_DPI':return {dpi:150};case 'OBR_VIEWPORT_GET_WIDTH':return {width:1280};case 'OBR_VIEWPORT_GET_HEIGHT':return {height:900};case 'OBR_VIEWPORT_INVERSE_TRANSFORM_POINT':case 'OBR_VIEWPORT_TRANSFORM_POINT':return {point:data.point};
 case 'OBR_BROADCAST_SEND_MESSAGE':emit('OBR_BROADCAST_MESSAGE_'+data.channel,{data:data.data,connectionId:'preview-connection'});return {};
 case 'OBR_NOTIFICATION_SHOW':return {id:'notification'};case 'OBR_ASSETS_DOWNLOAD_IMAGES':return {images:[]};case 'OBR_INTERACTION_START_ITEM_INTERACTION':return {id:crypto.randomUUID()};case 'OBR_TOOL_GET_ACTIVE':return {id:'move'};
 default:if(id.startsWith('OBR_SCENE_LOCAL_')||id.startsWith('OBR_TOOL_'))return {};throw Error('Unimplemented fixture request: '+id);
 }
}};
const obr={room:{id:'detached-room',messageBus:bus},player:{id:'detached-player',getRole:async()=>role,onChange:fn=>{roles.add(fn);return()=>roles.delete(fn);}},scene:{isReady:async()=>true},viewport:{getWidth:async()=>1280,getHeight:async()=>900},modal:{open:async()=>window.parent.postMessage({testReturned:'gm'},location.origin)},popover:{open:async()=>window.parent.postMessage({testReturned:'sheet'},location.origin)}};
const store=makeStore(localStorage,{room:'detached-room',player:'detached-player'},'gm');if(!store.exists())store.save({gmSchema:1,groups:[],scenes:[{id:'forest',name:'Туманный лес',notes:[{id:'note',title:'Запись из комнаты',sections:[]}]}],library:[]});
const host=createDetachedHost(obr,window,{base:new URL('../background.html',location.href).href});window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.testRole){role=e.data.testRole;for(const fn of roles)fn({role});emit('OBR_PLAYER_EVENT_CHANGE',{player:{id:obr.player.id,role}});}});window.addEventListener('pagehide',()=>host.dispose(),{once:true});
