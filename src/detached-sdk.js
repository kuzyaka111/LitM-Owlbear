// Compatibility boundary for the pinned Owlbear SDK 3.1.0. The SDK performs
// callback-to-patch conversion locally; only its serializable packets cross
// the private MessagePort. No code or updater function is evaluated remotely.
export const subscriptions={
 OBR_PLAYER_SUBSCRIBE:['OBR_PLAYER_UNSUBSCRIBE','OBR_PLAYER_EVENT_CHANGE'],
 OBR_PARTY_SUBSCRIBE:['OBR_PARTY_UNSUBSCRIBE','OBR_PARTY_EVENT_CHANGE'],
 OBR_ROOM_METADATA_SUBSCRIBE:['OBR_METADATA_ROOM_UNSUBSCRIBE','OBR_ROOM_METADATA_EVENT_CHANGE'],
 OBR_SCENE_READY_SUBSCRIBE:['OBR_SCENE_READY_UNSUBSCRIBE','OBR_SCENE_EVENT_READY_CHANGE'],
 OBR_SCENE_METADATA_SUBSCRIBE:['OBR_SCENE_METADATA_UNSUBSCRIBE','OBR_SCENE_METADATA_EVENT_CHANGE'],
 OBR_SCENE_GRID_SUBSCRIBE:['OBR_SCENE_GRID_UNSUBSCRIBE','OBR_SCENE_GRID_EVENT_CHANGE'],
 OBR_SCENE_ITEMS_SUBSCRIBE:['OBR_SCENE_ITEMS_UNSUBSCRIBE','OBR_SCENE_ITEMS_EVENT_CHANGE'],
 OBR_BROADCAST_SUBSCRIBE:['OBR_BROADCAST_UNSUBSCRIBE',null],
};
export const requests=new Set(`OBR_PLAYER_GET_ROLE OBR_PLAYER_GET_NAME OBR_PLAYER_GET_CONNECTION_ID OBR_PLAYER_GET_ID
 OBR_PARTY_GET_PLAYERS OBR_ROOM_GET_METADATA OBR_ROOM_SET_METADATA OBR_ROOM_GET_PERMISSIONS
 OBR_SCENE_IS_READY OBR_SCENE_GET_METADATA OBR_SCENE_SET_METADATA OBR_SCENE_GRID_GET_DPI
 OBR_SCENE_ITEMS_GET_ITEMS OBR_SCENE_ITEMS_GET_ALL_ITEMS OBR_SCENE_ITEMS_ADD_ITEMS OBR_SCENE_ITEMS_UPDATE_ITEMS OBR_SCENE_ITEMS_DELETE_ITEMS
 OBR_SCENE_LOCAL_GET_ITEMS OBR_SCENE_LOCAL_GET_ALL_ITEMS OBR_SCENE_LOCAL_ADD_ITEMS OBR_SCENE_LOCAL_UPDATE_ITEMS OBR_SCENE_LOCAL_DELETE_ITEMS
 OBR_VIEWPORT_GET_WIDTH OBR_VIEWPORT_GET_HEIGHT OBR_VIEWPORT_TRANSFORM_POINT OBR_VIEWPORT_INVERSE_TRANSFORM_POINT
 OBR_BROADCAST_SEND_MESSAGE OBR_ASSETS_DOWNLOAD_IMAGES OBR_NOTIFICATION_SHOW OBR_NOTIFICATION_CLOSE
 OBR_INTERACTION_START_ITEM_INTERACTION OBR_INTERACTION_UPDATE_ITEM_INTERACTION OBR_INTERACTION_STOP_ITEM_INTERACTION
 OBR_TOOL_ACTIVATE OBR_TOOL_MODE_ACTIVATE OBR_TOOL_GET_ACTIVE`.split(/\s+/));
export function subscriptionFor(id,data={}){
 const subscribe=Object.hasOwn(subscriptions,id)?id:Object.keys(subscriptions).find(key=>subscriptions[key][0]===id);
 if(!subscribe)return null;
 const [unsubscribe,event]=subscriptions[subscribe],channel=subscribe==='OBR_BROADCAST_SUBSCRIBE'?data.channel:'';
 if(channel&&!channel.startsWith('io.github.kuzyaka111.legend-mist/'))throw Error('Недопустимый канал связи.');
 if(subscribe==='OBR_BROADCAST_SUBSCRIBE'&&typeof channel!=='string')throw Error('Недопустимый канал связи.');
 return {subscribe,unsubscribe,event:event||'OBR_BROADCAST_MESSAGE_'+channel,key:subscribe+':'+channel,adding:id===subscribe,data:channel?{channel}: {}};
}
export function sharedSDKSubscriptions(bus){
 if(!bus||typeof bus.send!=='function'||typeof bus.sendAsync!=='function'||typeof bus.on!=='function')throw Error('Эта версия Owlbear не поддерживает отдельную вкладку.');
 const original=bus.send,counts=new Map();
 const send=(id,data,nonce)=>{const sub=subscriptionFor(id,data);if(sub){const before=counts.get(sub.key)||0,next=Math.max(0,before+(sub.adding?1:-1));counts.set(sub.key,next);if(sub.adding?before>0:next>0||before===0)return;}return original(id,data,nonce);};
 bus.send=send;return()=>{if(bus.send===send)bus.send=original;};
}
