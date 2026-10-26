import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeStore} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
import {cleanGM,cleanGMStatus,gmStatusValue,toggleGMStatusKind,sceneEffectSource,newScene,newObstacle,newObstacleRow,moveScene,copyObstacle,publicObstacle,referenceParts,obstacleReference,safeImage} from '../src/gm-model.js';
import {createGMBoard,GM_BOARD_KEY,returnGMCard,watchGMBoardReturn} from '../src/gm-board.js';
import {collectActionSources,gmActionFeed,ACTION_FEED} from '../src/action-sources.js';
import {boardCardElement} from '../src/board-render.js';
const settle=()=>new Promise(r=>setTimeout(r,0));
test('GM migration preserves old tags and notes, remains stable and keeps scenes independent',()=>{
 const state=cleanGM({scene:['Туман'],notes:'Секрет'});assert.deepEqual(state.scenes[0].tags.map(t=>t.name),['Туман']);assert.equal(state.scenes[0].notes[0].sections[0].text,'Секрет');assert.deepEqual(cleanGM(state),state);
 state.scenes.push(newScene());state.activeSceneId=state.scenes[1].id;const next=cleanGM(state);assert.deepEqual(next.scene,[]);assert.equal(next.scenes[0].notes[0].sections[0].text,'Секрет');assert.deepEqual(cleanGM({scenes:[]}).scenes,[]);
});
test('scene moves preserve order and content across collapsed groups and reject invalid destinations',()=>{
 const state=cleanGM({scenes:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C',groupId:'g'}],groups:[{id:'g',collapsed:true},{id:'h'}]});
 assert(moveScene(state,'a','g','c'));assert.deepEqual(state.scenes.filter(s=>s.groupId==='g').map(s=>s.id),['a','c']);assert.equal(moveScene(state,'a','missing'),false);assert(moveScene(state,'a','h'));assert(moveScene(state,'a',null,'b'));assert.equal(state.scenes[0].id,'a');assert.equal(state.scenes[0].groupId,null);
});
test('template copies keep visibility settings and deeply isolate all fields and identifiers',()=>{
 const template=newObstacle();template.tags.push({...newObstacleRow(),name:'Секрет',hidden:true});const copy=copyObstacle(template);assert.notEqual(copy.id,template.id);assert.notEqual(copy.tags[0].id,template.tags[0].id);copy.tags[0].name='Другое';copy.hidden.push('name');assert.equal(template.tags[0].name,'Секрет');assert.deepEqual(template.hidden,[]);assert.equal(copy.tags[0].hidden,true);
});
test('public projection excludes private names, images, rows and hidden bookkeeping',()=>{
 const o=newObstacle();o.name='СЕКРЕТ';o.image={url:'https://example.org/private.png'};o.hidden=['name','image'];o.tags=[{...newObstacleRow(),name:'PRIVATE',hidden:true},{...newObstacleRow(),name:'Видимый',spent:true}];
 const p=publicObstacle(o),text=JSON.stringify(p);for(const forbidden of ['СЕКРЕТ','private.png','PRIVATE','hidden',o.id])assert(!text.includes(forbidden));assert.equal(p.tags[0].name,'Видимый');assert.equal(p.tags[0].spent,false);assert.equal(p.tags[0].direction,0);assert.equal(o.name,'СЕКРЕТ');
 assert.equal(safeImage({url:'javascript:alert(1)'}),null);assert.equal(safeImage({url:'data:image/png;base64,abc'}),null);
 const node=boardCardElement({character:'Препятствие',card:{type:'obstacle',data:p}},new JSDOM().window.document);assert(node.textContent.includes('Видимый'));assert(!node.textContent.includes('PRIVATE'));assert.equal(node.querySelectorAll('input,textarea,button').length,0);
});
function ui(){
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),data=new Map(),store=makeStore({getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},{room:'test',player:'test'},'gm'),placed=[];
 const state=mountUI(root,'gm',fs.readFileSync(new URL('../src/gm.html',import.meta.url),'utf8'),store,{close:async()=>{},placeObstacle:async o=>placed.push(publicObstacle(o))});
 const click=label=>{const n=[...root.querySelectorAll('button')].find(n=>(n.getAttribute('aria-label')||n.textContent)===label);assert(n,'Missing button '+label);n.click();};
 const fill=(label,value)=>{const n=root.querySelector('[aria-label="'+label+'"]');assert(n,'Missing field '+label);n.value=value;n.dispatchEvent(new dom.window.Event('input',{bubbles:true}));return n;};return {dom,root,store,state,placed,click,fill};
}
test('GM groups rename on double click, doors open scenes and notes retain nested headings and links',()=>{
 const f=ui();f.click('+ Добавить группу');f.fill('Название группы','Лес');f.root.querySelector('[aria-label="Название группы"]').dispatchEvent(new f.dom.window.FocusEvent('blur'));assert.equal(f.store.load().groups[0].name,'Лес');
 f.click('Открыть сцену У старого моста');f.click('+ Заметка');f.click('+ Заголовок');const sub=[...f.root.querySelectorAll('button')].filter(b=>b.textContent==='+ Подзаголовок').at(-1);sub.click();assert(f.root.querySelector('[aria-label=Подзаголовок]'));assert.equal(f.store.load().scenes[0].notes.length,2);
 const o=newObstacle();o.name='Страж';f.state.scenes[0].obstacles.push(o);const input=f.fill('Текст заметки','Идти к @');input.selectionStart=input.selectionEnd=input.value.length;input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));f.click('@Страж');assert(referenceParts(f.store.load().scenes[0].notes[0].sections[0].text).some(r=>r.id===o.id));assert(f.root.textContent.includes('@Страж'));
 f.dom.window.close();
});
test('obstacle visibility dims without disabling fields and placing never closes its editor',async()=>{
 const f=ui();f.click('Препятствия и Противники');f.click('+ Создать заготовку');f.fill('Название препятствия','Старый страж');f.click('Добавить: Теги');f.fill('Название тега','Невидимое оружие');f.click('Настроить видимость для стола');f.click('Скрыть или показать строку');assert(f.root.querySelector('.is-private input'));assert.equal(f.root.querySelector('.is-private input').disabled,false);
 f.click('Вынести на стол');await settle();assert.equal(f.placed.length,1);assert.equal(f.placed[0].tags.length,0);assert.equal(f.root.querySelector('.mt-gm-overlay').hidden,false);assert.equal(f.store.load().library[0].tags[0].name,'Невидимое оружие');
 f.click('Закрыть препятствие');f.click('Сцена');f.click('Препятствия');f.click('Вставить копию');f.click('@Старый страж');assert.equal(f.store.load().scenes[0].obstacles.length,1);assert.notEqual(f.store.load().scenes[0].obstacles[0].id,f.store.load().library[0].id);f.dom.window.close();
});
test('references retain stable obstacle IDs through renaming',()=>{const token=obstacleReference('example');assert.deepEqual(referenceParts('До '+token+' после'),[{start:3,end:3+token.length,id:'example'}]);});
function builder(type,props={}){const item={id:crypto.randomUUID(),type,...props},api={build:()=>structuredClone(item)};for(const key of ['id','commands','fillColor','fillOpacity','strokeColor','strokeOpacity','strokeWidth','fillRule','scale','position','rotation','layer','createdUserId','attachedTo','locked','disableHit','disableAutoZIndex','zIndex','metadata','name'])api[key]=v=>{item[key]=v;return api;};return api;}
function board(){
 let items=[],callback=()=>{},readyCallback=()=>{},role='GM',fail=false;const rendered=[],state=cleanGM({scenes:[],library:[]}),o=newObstacle();state.library.push(o);const api={getItems:async ids=>structuredClone(ids?items.filter(i=>ids.includes(i.id)):items),onChange:fn=>{callback=fn;return()=>{callback=()=>{};};},addItems:async next=>{if(fail)throw Error('Denied');items.push(...structuredClone(next));callback(structuredClone(items));},updateItems:async(ids,fn)=>{if(fail)throw Error('Denied');const names=ids.map(i=>typeof i==='string'?i:i.id),drafts=structuredClone(items);fn(drafts.filter(i=>names.includes(i.id)));items=drafts;callback(structuredClone(items));},deleteItems:async ids=>{if(fail)throw Error('Denied');const removed=new Set(ids);for(let changed=true;changed;){changed=false;for(const item of items)if(item.attachedTo&&removed.has(item.attachedTo)&&!removed.has(item.id)){removed.add(item.id);changed=true;}}items=items.filter(i=>!removed.has(i.id));callback(structuredClone(items));}};
 const obr={player:{id:'owner',getRole:async()=>role},scene:{isReady:async()=>true,onReadyChange:fn=>{readyCallback=fn;return()=>{};},items:api,grid:{getDpi:async()=>150}},viewport:{getWidth:async()=>1000,getHeight:async()=>700,inverseTransformPoint:async p=>p}};
 const service=createGMBoard(obr,{store:{load:()=>structuredClone(state)},build:(image,grid)=>builder('IMAGE',{image,grid}),buildPath:()=>builder('PATH'),render:async record=>{rendered.push(structuredClone(record));return {width:244,height:300,dpi:150,parts:[{key:'text',type:'path',commands:[[0,record.card.data.tags?.length||0,0],[1,1,1]],fill:'#333333'}]};},report:assert.fail});
 return {service,obr,o,state,rendered,get items(){return items;},set role(v){role=v;},set fail(v){fail=v;},ready:()=>readyCallback(true)};
}
test('board obstacles expose only the public projection, sync in place and preserve native movement',async()=>{
 const f=board();await f.service.start();f.o.tags.push({...newObstacleRow(),name:'PRIVATE',hidden:true});const root=await f.service.place(f.o);assert(!JSON.stringify(f.items).includes('PRIVATE'));assert(!JSON.stringify(f.rendered).includes('PRIVATE'));assert.equal(f.items.length,2);
 await f.obr.scene.items.updateItems([root.id],drafts=>{drafts[0].position={x:88,y:99};drafts[0].scale={x:2,y:2};});f.o.tags[0].hidden=false;await f.service.place(f.o);assert.equal(f.items.length,2);assert.equal(f.items[0].id,root.id);assert.deepEqual(f.items[0].position,{x:88,y:99});assert.deepEqual(f.items[0].scale,{x:2,y:2});assert.equal(f.items[0].metadata[GM_BOARD_KEY].card.data.tags[0].name,'PRIVATE');
 f.o.tags[0].hidden=true;await f.service.place(f.o);assert(!JSON.stringify(f.items).includes('PRIVATE'));assert.equal(f.state.library.length,1);f.service.dispose();
});
test('player placement and failed writes cannot hide or remove GM sources',async()=>{
 const f=board();await f.service.start();f.role='PLAYER';await assert.rejects(f.service.place(f.o),/ведущий/);assert.equal(f.items.length,0);f.role='GM';f.fail=true;await assert.rejects(f.service.place(f.o),/Denied/);assert.equal(f.state.library.length,1);assert.equal(f.items.length,0);f.service.dispose();
});

test('saving the panel updates placed cards through flush and private edits do not repaint the scene',async()=>{
 const f=board();await f.service.start();await f.service.place(f.o);const before=f.rendered.length;f.o.features.push({...newObstacleRow(),name:'Секретный ход',hidden:true});await f.service.flush();assert.equal(f.rendered.length,before);
 f.o.name='Новое название';f.service.changed();await f.service.flush();assert.equal(f.items[0].metadata[GM_BOARD_KEY].card.data.name,'Новое название');assert.equal(f.rendered.length,before+1);assert(!JSON.stringify(f.items).includes('Секретный ход'));f.service.dispose();
});

test('long obstacle data cannot be shared beyond the host metadata limit',async()=>{
 const f=board();await f.service.start();f.o.features=Array.from({length:30},()=>({...newObstacleRow(),text:'Т'.repeat(1200)}));await assert.rejects(f.service.place(f.o),/Слишком много данных/);assert.equal(f.items.length,0);assert.equal(f.state.library[0].features.length,30);f.service.dispose();
});

test('legacy scene tags migrate to stable neutral chips and scene status values and directions persist',()=>{
 const state=cleanGM({scenes:[{id:'scene-a',tags:['Туман',{id:'wind',name:'Ветер',direction:1}],statuses:[{id:'mud',name:'Вязкая грязь',value:'3',direction:-1}]}]});
 assert.equal(state.scenes[0].tags[0].name,'Туман');assert.equal(state.scenes[0].tags[0].direction,0);assert.equal(state.scenes[0].statuses[0].value,'3');assert.deepEqual(cleanGM(state),state);assert.deepEqual(state.scene,['Туман','Ветер']);
});

test('scene chips add, cycle and save tags and statuses independently without extra descriptions',()=>{
 const f=ui();f.click('+ Создать сцену');f.click('Добавить: Теги сцены');f.fill('Название тега сцены','Попутный ветер');f.root.querySelector('[data-scene-effect=tags] .mt-gm-row-direction').click();
 f.click('Добавить: Статусы сцены');f.fill('Название статуса сцены','Скользкая тропа');f.click('Переключить на числовой статус');f.click('Отметка статуса 3');f.root.querySelector('[data-scene-effect=statuses] .mt-gm-row-direction').click();f.root.querySelector('[data-scene-effect=statuses] .mt-gm-row-direction').click();
 let state=f.store.load(),scene=state.scenes.find(s=>s.id===state.activeSceneId);assert.equal(scene.tags[0].direction,1);assert.equal(scene.statuses[0].direction,-1);assert.equal(gmStatusValue(scene.statuses[0]),3);assert.equal(f.root.querySelector('[data-scene-effect=tags] textarea'),null);
 f.click('Удалить тег сцены Попутный ветер');state=f.store.load();scene=state.scenes.find(s=>s.id===state.activeSceneId);assert.equal(scene.tags.length,0);assert.equal(scene.statuses.length,1);f.dom.window.close();
});

test('GM status type preserves six independent marks and ordinary statuses always count as one',()=>{
 const row={...newObstacleRow(),name:'Бодрость',direction:1};assert.equal(gmStatusValue(row),1);toggleGMStatusKind(row);assert.equal(gmStatusValue(row),0);row.marks[1]=true;row.marks[4]=true;assert.equal(gmStatusValue(row),5);toggleGMStatusKind(row);assert.equal(gmStatusValue(row),1);toggleGMStatusKind(row);assert.equal(gmStatusValue(row),5);assert.equal(row.name,'Бодрость');assert.equal(row.direction,1);
 const legacy=cleanGMStatus({value:'3'});assert.equal(legacy.kind,'numeric');assert.deepEqual(legacy.marks,[false,false,true,false,false,false]);
});

test('obstacle and scene editors switch types without losing names, directions or marked digits',()=>{
 const f=ui();f.click('Препятствия и Противники');f.click('+ Создать заготовку');f.click('Добавить: Статусы');f.fill('Название статуса','Оглушён');f.click('Переключить на числовой статус');assert.equal(f.root.querySelectorAll('.mt-gm-status-mark').length,6);f.click('Отметка статуса 2');f.click('Отметка статуса 6');assert.equal(gmStatusValue(f.store.load().library[0].statuses[0]),6);
 f.click('Переключить на обычный статус');assert.equal(f.root.querySelectorAll('.mt-gm-status-mark').length,0);assert.equal(gmStatusValue(f.store.load().library[0].statuses[0]),1);f.click('Переключить на числовой статус');assert.equal(f.root.querySelectorAll('.mt-gm-status-mark.is-marked').length,2);f.click('Закрыть препятствие');f.click('Выбор Сцены');f.click('+ Создать сцену');f.click('Добавить: Статусы сцены');f.fill('Название статуса сцены','Вдохновение');f.click('Переключить на числовой статус');f.click('Отметка статуса 4');const state=f.store.load(),scene=state.scenes.find(s=>s.id===state.activeSceneId);assert.equal(gmStatusValue(scene.statuses[0]),4);f.dom.window.close();
});

test('scene tags and numeric statuses export in place, synchronize and are not counted twice',async()=>{
 const f=board(),scene=newScene(),tag={...newObstacleRow(),name:'Попутный ветер',direction:1},status={...newObstacleRow(),kind:'numeric',name:'Вдохновение',direction:1,marks:[false,true,false,false,false,false]};scene.tags.push(tag);scene.statuses.push(status);f.state.scenes.push(scene);f.state.activeSceneId=scene.id;await f.service.start();
 const item=await f.service.place(sceneEffectSource(scene,'statuses',status)),tagItem=await f.service.place(sceneEffectSource(scene,'tags',tag));assert.equal(f.state.scenes[0].tags.length,1);assert.equal(f.state.scenes[0].statuses.length,1);assert.equal(item.metadata[GM_BOARD_KEY].card.type,'scene-effect');
 status.marks[4]=true;await f.service.flush();const current=f.items.find(i=>i.id===item.id);assert.equal(current.metadata[GM_BOARD_KEY].card.data.value,5);assert.equal(current.metadata[GM_BOARD_KEY].card.data.marks[4],true);assert.equal((await f.service.place(sceneEffectSource(scene,'statuses',status))).id,item.id);
 const feed=gmActionFeed(f.state,'owner'),sources=collectActionSources(f.items,{[ACTION_FEED+'owner']:feed},'player');assert.equal(sources.tags.size,1);assert.equal(sources.statuses.size,1);assert.equal([...sources.statuses.values()][0].value,5);
 const node=boardCardElement(current.metadata[GM_BOARD_KEY],new JSDOM().window.document);assert.equal(node.querySelectorAll('.mt-status-mark').length,6);assert.equal(node.querySelectorAll('.mt-status-mark.is-marked').length,2);assert.equal(node.querySelectorAll('button,input,textarea').length,0);
 scene.statuses=[];await f.service.flush();assert(!f.items.some(i=>i.id===item.id));assert(f.items.some(i=>i.id===tagItem.id));f.service.dispose();
});

test('return removes only the public copy, preserves its source and can be placed again without resurrection',async()=>{
 const f=board(),scene=newScene(),row={...newObstacleRow(),name:'Ранен',kind:'numeric',direction:-1,marks:[false,true,false,false,true,false]};scene.statuses.push(row);f.state.scenes.push(scene);f.state.activeSceneId=scene.id;await f.service.start();
 const source=sceneEffectSource(scene,'statuses',row),item=await f.service.place(source),before=structuredClone(f.state);assert.equal(f.items.length,2);await f.service.returnToPanel(item.id);assert.equal(f.items.length,0);assert.deepEqual(f.state,before);await f.service.flush();assert.equal(f.items.length,0);
 const next=await f.service.place(sceneEffectSource(scene,'statuses',row));assert.notEqual(next.id,item.id);assert.equal(next.metadata[GM_BOARD_KEY].card.data.value,5);assert.equal(next.metadata[GM_BOARD_KEY].card.data.direction,-1);f.service.dispose();
});

test('another player cannot return a GM card and a failed return retains both source and graphics',async()=>{
 const f=board();await f.service.start();const item=await f.service.place(f.o),before=structuredClone(f.state);f.obr.player.id='other';f.role='PLAYER';await assert.rejects(returnGMCard(f.obr,item.id),/владелец/);assert.equal(f.items.length,2);
 f.obr.player.id='owner';f.fail=true;await assert.rejects(returnGMCard(f.obr,item.id),/Denied/);assert.equal(f.items.length,2);assert.deepEqual(f.state,before);f.fail=false;f.obr.player.id='other-gm';f.role='GM';await returnGMCard(f.obr,item.id);assert.equal(f.items.length,0);assert.deepEqual(f.state,before);f.service.dispose();
});

test('GM return menu is registered in the background and removed when its controller closes',async()=>{
 let menu,ready;const removed=[],errors=[],obr={scene:{isReady:async()=>true,onReadyChange:fn=>{ready=fn;return()=>{};}},contextMenu:{create:async m=>menu=m,remove:async id=>removed.push(id)},notification:{show:async e=>errors.push(e)}};
 const controller=watchGMBoardReturn(obr,'https://example.org/LitM-Owlbear/background.html');await controller.refresh();assert.equal(menu.icons[0].label,'Вернуть в панель');assert.deepEqual(menu.icons[0].filter.every,[{key:['metadata',GM_BOARD_KEY,'placed'],value:true}]);assert.equal(menu.icons[0].icon,'https://example.org/LitM-Owlbear/sheet.svg');await controller.dispose();assert(removed.includes(GM_BOARD_KEY+'/return'));assert.deepEqual(errors,[]);
});

test('individual scene effects use plain sheet status typography and retain marks without directional color fills',()=>{
 const scene=newScene(),doc=new JSDOM().window.document;for(const effectKind of ['tags','statuses']){const row={...newObstacleRow(),kind:'numeric',name:'Проверка',direction:-1,marks:[false,true,false,false,true,false]};const node=boardCardElement({character:scene.name,card:{type:'scene-effect',data:{...row,effectKind}}},doc);assert.equal(node.querySelectorAll('.mt-obstacle-tag,.mt-direction--1').length,0);assert.equal(node.querySelector('.mt-status-name').textContent,'Проверка');assert.equal(node.querySelector('.mt-scene-effect-direction').textContent,'↓');assert.equal(node.querySelectorAll('.mt-status-mark.is-marked').length,effectKind==='statuses'?2:0);}
});

test('limits always remain GM-only, including legacy field projections, without changing source data',()=>{
 const o=newObstacle();o.name='Страж';o.limits=[{...newObstacleRow(),name:'ТАЙНЫЙ ПРЕДЕЛ',value:'6',hidden:false},{...newObstacleRow(),name:'ДРУГОЙ ПРЕДЕЛ',value:'4',hidden:true}];o.tags=[{...newObstacleRow(),name:'Видимый тег'}];const before=structuredClone(o),p=publicObstacle(o);assert(!Object.hasOwn(p,'limits'));assert(!JSON.stringify(p).includes('ПРЕДЕЛ'));assert.deepEqual(o,before);
 const doc=new JSDOM().window.document;for(const data of [p,{...p,limits:o.limits}]){const card=boardCardElement({character:'Препятствие',card:{type:'obstacle',data}},doc);assert(!card.textContent.includes('Пределы'));assert(!card.textContent.includes('ПРЕДЕЛ'));assert(card.textContent.includes('Видимый тег'));}doc.defaultView.close();
});
