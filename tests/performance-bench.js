// Run with node tests/performance-bench.js; synthetic data only, no network.
import {performance} from 'node:perf_hooks';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {makeStore,defaults} from '../src/storage.js';
import {mountUI} from '../src/ui.js';
const dom=new JSDOM('<main id="mist-table-design"></main>',{url:'https://benchmark.invalid'}),storage=dom.window.localStorage,scope={room:'benchmark',player:'benchmark'},key='legend-mist-prototype:v1:'+JSON.stringify([scope.room,scope.player,'sheet']);
const character=defaults('sheet');character.notes='Запись '.repeat(500);character.cards.push(...Array.from({length:19},(_,i)=>({id:'bag-'+i,type:'bag',title:'Хранилище '+i,items:Array.from({length:15},(_,j)=>({id:'item-'+j,text:'Тег '+j,scratched:false}))})));
const characters=Array.from({length:20},(_,i)=>({id:'hero-'+i,state:{...structuredClone(character),characterId:'hero-'+i,name:'Герой '+i}}));storage.setItem(key,JSON.stringify({...characters[0].state,rosterVersion:1,characters,activeCharacterId:'hero-0',characterReceipts:[]}));const store=makeStore(storage,scope,'sheet');
function measure(fn,n){const samples=[];for(let r=0;r<5;r++){const start=performance.now();for(let i=0;i<n;i++)fn(i);samples.push(performance.now()-start);}return Math.round(samples.sort((a,b)=>a-b)[2]*100)/100;}
const result={rosterBytes:storage.getItem(key).length,activeId200Ms:measure(()=>store.activeId(),200),loadCharacter50Ms:measure(()=>store.loadCharacter('hero-19'),50)};
const root=dom.window.document.querySelector('main');mountUI(root,'sheet',fs.readFileSync(new URL('../src/sheet.html',import.meta.url),'utf8'),store,{fitWindow:()=>{},close:()=>{}});
let created=0;const original=dom.window.document.createElement.bind(dom.window.document);dom.window.document.createElement=(...args)=>{created++;return original(...args);};const stable=root.querySelector('[data-card-id="bag-18"]');const start=performance.now();for(let i=0;i<20;i++)root.querySelector('[data-card-id="bag-0"] .mt-scratch').click();result.inventory20Ms=Math.round((performance.now()-start)*100)/100;result.inventoryCreatedElements=created;result.unrelatedInventoryRetained=stable===root.querySelector('[data-card-id="bag-18"]');
const docRoot=new URL(process.argv[2]||'../docs/',import.meta.url),entries=['index.html','background.html'];result.initialScripts={};
for(const entry of entries){const html=fs.readFileSync(new URL(entry,docRoot),'utf8'),seen=new Set();function visit(file){if(seen.has(file))return;seen.add(file);const js=fs.readFileSync(new URL(file,docRoot),'utf8');for(const match of js.matchAll(/(?:import|export)[^;\n]*?from\s*["'](\.\/?[^"']+\.js)["']|import\s*["'](\.\/?[^"']+\.js)["']/g)){const path=new URL(match[1]||match[2],new URL(file,docRoot));visit(path.pathname.slice(docRoot.pathname.length));}}for(const match of html.matchAll(/src="\.\/([^"']+\.js)"/g))visit(match[1]);const buffers=[...seen].map(p=>fs.readFileSync(new URL(p,docRoot)));result.initialScripts[entry]={files:seen.size,bytes:buffers.reduce((n,b)=>n+b.length,0),gzip:buffers.reduce((n,b)=>n+gzipSync(b).length,0)};}
console.log(JSON.stringify(result,null,2));dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();
