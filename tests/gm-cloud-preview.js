// Isolated browser fixture: no Supabase network calls or real account data.
import '../src/style.css';
import '../src/fog.css';
import '../src/fonts/fonts.css';
import '../src/typography.css';
import '../src/gm.css';
import {mountUI} from '../src/ui.js';
import template from '../src/gm.html?raw';
import {makeStore} from '../src/storage.js';
import {createGMCloud} from '../src/gm-cloud.js';
import {fakeCloudDatabase,memoryStorage} from './gm-cloud-fakes.js';
const db=fakeCloudDatabase(),storage=memoryStorage(),localStore=makeStore(storage,{room:'cloud-preview',player:'preview'},'gm');
localStore.save({gmSchema:1,scenes:[{id:'forest',name:'Туманный лес',notes:[{id:'letter',title:'Письмо у старого моста',sections:[{id:'section',title:'Тайна',text:'Запись доступна на всех устройствах ведущего.'}]}]}],groups:[],library:[]});
const cloud=createGMCloud({client:async()=>db.clientFor(null),localStore,storage,roomId:'cloud-preview'});
await cloud.start();
mountUI(document.querySelector('main'),'gm',template,cloud.store,{cloud,close:async()=>{}});
window.addEventListener('pagehide',()=>cloud.dispose(),{once:true});
