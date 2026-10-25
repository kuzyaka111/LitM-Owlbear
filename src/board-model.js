import {clean} from './storage.js';
import {getBook,improvementById,quintessences,cleanTheme} from './theme-model.js';
import {fellowshipTheme} from './fellowship-model.js';
export const BOARD_KEY='io.github.kuzyaka111.legend-mist/board-card';
export const BOARD_TOOL='io.github.kuzyaka111.legend-mist/cards';
export const BOARD_EDITOR='io.github.kuzyaka111.legend-mist/card-editor';
export function sourceCard(state,key,shared){
 if(typeof key!=='string')return null;
 if(key==='character')return {type:'character',data:Object.fromEntries(['name','playerName','relationships','promise','quintessences','quintessenceIds'].map(k=>[k,structuredClone(state[k])]))};
 if(key==='fellowship')return shared?{type:'theme',data:fellowshipTheme(shared)}:null;
 const [kind,id]=key.split(':');const array={theme:state.heroThemes,card:state.cards,status:state.statusCards,note:state.noteCards}[kind],data=array?.find(c=>c.id===id);
 return data?{type:kind==='theme'?'theme':kind==='card'?data.type:kind,data:structuredClone(data.type==='theme'?data.theme:data)}:null;
}
export function cleanCard(card){
 if(!card||!['character','theme','bag','status','note'].includes(card.type))throw Error('Неизвестная карточка');
 if(card.type==='theme')return {type:card.type,data:cleanTheme(card.data)};
 const field={character:null,bag:'cards',status:'statusCards',note:'noteCards'}[card.type];
 const state=clean(field?{[field]:[card.data],schemaVersion:4}:card.data,'sheet');
 const data=field?state[field].find(x=>x.id===card.data?.id):Object.fromEntries(['name','playerName','relationships','promise','quintessences','quintessenceIds'].map(k=>[k,state[k]]));
 if(!data)throw Error('Повреждены данные карточки');return {type:card.type,data};
}
export function applySource(state,key,card){
 const safe=cleanCard(card),data=safe.data;
 if(key==='fellowship')return false;
 if(key==='character'){Object.assign(state,data);return true;}
 const [kind,id]=key.split(':'),array={theme:state.heroThemes,card:state.cards,status:state.statusCards,note:state.noteCards}[kind];
 if(!array||!id||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return false;
 const expected={theme:'theme',status:'status',note:'note'}[kind];if(expected&&safe.type!==expected||kind==='card'&&!['theme','bag'].includes(safe.type))return false;
 const target=array.find(c=>c.id===id);
 if(!target){const limit={theme:4,card:31,status:60,note:30}[kind];if(array.length>=limit)return false;
  array.push(kind==='card'&&safe.type==='theme'?{id,type:'theme',theme:{...data,id}}:{...data,id});
 }else if(kind==='card'&&target.type==='theme')target.theme={...data,id};else Object.assign(target,data,{id});
 return true;
}
export function canDeleteBoardCard(record){return !!record&&(record.source?.startsWith('status:')&&record.card?.type==='status'||record.source?.startsWith('card:')&&record.card?.type==='theme'&&record.card.data.bookId==='story');}
export function deleteSource(state,record){
 if(!canDeleteBoardCard(record))return false;
 const [kind,id]=record.source.split(':'),key=kind==='status'?'statusCards':'cards';
 state[key]=state[key].filter(card=>card.id!==id);return true;
}
export function cardFields(card){
 const fields=[],add=(path,label,max=160,kind='text')=>fields.push({id:path.join('.'),path,label,max,kind}),d=card.data;
 if(card.type==='theme'){
  for(const kind of ['power','weakness'])d[kind].forEach((_,i)=>{add([kind,i,'text'],i===0&&kind==='power'?'Название темы':kind==='power'?'Тег силы':'Тег слабости');add([kind,i,'scratched'],'Зачеркнуть тег',0,'toggle');});
  for(const [key,label] of [['improve','Развитие'],['abandon','Угасание'],['milestone','Вехи']])add([key],label,3,'count');
  for(const item of [...getBook(d.bookId).improvements,...d.improvements.filter(id=>!getBook(d.bookId).improvements.some(x=>x.id===id)).map(improvementById).filter(Boolean)])fields.push({id:'improvements:'+item.id,path:['improvements'],option:item.id,label:item.name,kind:'toggle',max:0});
  add(['quest'],'Стремление',d.bookId==='fellowship'?400:1000);d.storyImprovements?.forEach((_,i)=>{if(d.bookId==='story'){add(['storyImprovements',i,'text'],'Особое улучшение');add(['storyImprovements',i,'active'],'Отметить улучшение',0,'toggle');}});
 }else if(card.type==='bag'){
  add(['title'],'Название хранилища',80);d.items.forEach((_,i)=>{add(['items',i,'text'],'Тег рюкзака');add(['items',i,'scratched'],'Зачеркнуть тег',0,'toggle');});
 }else if(card.type==='status'){
  add(['name'],d.kind==='story'?'Сюжетный тег':'Статус');if(d.kind==='story')add(['scratched'],'Зачеркнуть тег',0,'toggle');if(d.kind==='numeric')d.marks.forEach((_,i)=>add(['marks',i],'Отметка '+(i+1),0,'toggle'));
 }else if(card.type==='character'){
  add(['promise'],'Потенциал',5,'count');for(const item of quintessences)fields.push({id:'quintessenceIds:'+item.id,path:['quintessenceIds'],option:item.id,label:item.name,kind:'toggle',max:0});add(['name'],'Имя героя',80);add(['playerName'],'Имя игрока',80);d.relationships.forEach((_,i)=>{add(['relationships',i,'companion'],'Спутник',80);add(['relationships',i,'tag'],'Тег отношения',80);});if(d.quintessences)add(['quintessences'],'Прежние записи',2000);
 }else if(card.type==='note'){
  add(['title'],'Название заметки',120);d.sections.forEach((s,i)=>{for(const f of ['title','text'])add(['sections',i,f],f==='title'?'Заголовок':'Текст заметки',f==='title'?120:5000);s.children.forEach((_,j)=>{for(const f of ['title','text'])add(['sections',i,'children',j,f],f==='title'?'Подзаголовок':'Текст заметки',f==='title'?120:5000);});});
 }return fields;
}
export const fieldValue=(card,field)=>{const value=field.path.reduce((v,k)=>v?.[k],card.data);return field.option?value.includes(field.option):value;};
export function activationValue(card,field,hit={}){const current=fieldValue(card,field);return field.kind==='count'?(current===hit.value?hit.value-1:hit.value):!current;}
export function textToggle(card,id){const toggle=id.endsWith('.text')?id.slice(0,-5)+'.scratched':card.type==='status'&&id==='name'?'scratched':null;return cardFields(card).find(f=>f.id===toggle&&f.kind==='toggle');}
export function editCard(card,id,value){
 const safe=cleanCard(card),field=cardFields(safe).find(f=>f.id===id);if(!field)throw Error('Это поле нельзя менять на поле');
 if(field.kind==='toggle'&&typeof value!=='boolean'||field.kind==='text'&&typeof value!=='string'||field.kind==='count'&&(!Number.isInteger(value)||value<0||value>field.max))throw Error('Неверное значение');
 if(field.option){const key=field.path[0];safe.data[key]=value?[...new Set([...safe.data[key],field.option])]:safe.data[key].filter(x=>x!==field.option);return safe;}
 let target=safe.data;for(const key of field.path.slice(0,-1))target=target[key];target[field.path.at(-1)]=field.kind==='text'?value.slice(0,field.max):value;return safe;
}
export function cardPoint(item,world,gridDpi){
 const radians=-item.rotation*Math.PI/180,dx=world.x-item.position.x,dy=world.y-item.position.y,ratio=item.type==='PATH'?1:item.grid.dpi/gridDpi;
 return {x:(dx*Math.cos(radians)-dy*Math.sin(radians))/item.scale.x*ratio+(item.grid?.offset.x||0),y:(dx*Math.sin(radians)+dy*Math.cos(radians))/item.scale.y*ratio+(item.grid?.offset.y||0)};
}
export function cardWorldPoint(item,point,gridDpi){const ratio=item.type==='PATH'?1:gridDpi/item.grid.dpi,x=(point.x-(item.grid?.offset.x||0))*item.scale.x*ratio,y=(point.y-(item.grid?.offset.y||0))*item.scale.y*ratio,radians=item.rotation*Math.PI/180;return {x:item.position.x+x*Math.cos(radians)-y*Math.sin(radians),y:item.position.y+x*Math.sin(radians)+y*Math.cos(radians)};}
export function hitField(record,point,kind){
 return record.hits?.find(h=>(kind==='control'?h.kind!=='text':h.kind===kind)&&point.x>=h.x&&point.x<=h.x+h.width&&point.y>=h.y&&point.y<=h.y+h.height);
}
export function validRecord(record){
 try{return record?.v===1&&typeof record.owner==='string'&&typeof record.source==='string'&&record.source.length<100&&record.card&&!!cleanCard(record.card);}catch{return false;}
}
