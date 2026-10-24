import test from 'node:test';
import assert from 'node:assert/strict';
import {themebooks,quintessences,cleanTheme,makeTheme} from '../src/theme-model.js';
import {clean,makeStore} from '../src/storage.js';
test('catalog contains all twenty core books plus Fellowship and their book questions',()=>{
 assert.equal(themebooks.length,21);assert.equal(new Set(themebooks.map(x=>x.id)).size,21);
 assert.deepEqual(themebooks.filter(x=>x.might==='variable').map(x=>x.id),['companion','magic','possessions','fellowship']);
 for(const b of themebooks){assert.equal(b.power.map(q=>q.letter).join(''),'ABCDEFGHIJ');assert.equal(b.weakness.map(q=>q.letter).join(''),'ABCD');assert.equal(b.improvements.length,5);assert(b.power.every(q=>q.text.length>10));
 for(const might of ['origin','adventure','greatness'])assert.equal(cleanTheme({...makeTheme(b.id),might}).might,might);}
 assert.equal(quintessences.length,18);assert(quintessences.every(q=>q.text.length>40));
});
test('legacy theme conversion keeps overflow tags, notes, marks and a backup',()=>{
 const raw={name:'Герой',notes:'Оставить',quintessences:'Старая запись',marks:[0,3],cards:[{id:'old',type:'theme',title:'Тема',typeLabel:'Авторский темник',items:Array.from({length:8},(_,i)=>({id:'i'+i,text:'Тег '+i})),quest:'Цель',weakness:'Страх',notes:'История'}]};
 const m=clean(raw,'sheet');assert.equal(m.cards[0].theme.power.length,7);assert.equal(m.cards[0].theme.weakness.length,3);assert(m.cards[0].theme.notes.includes('Авторский темник'));assert.deepEqual(m.cards[1].items.map(x=>x.text),['Тег 6','Тег 7']);assert.equal(m.heroThemes[0].improve,1);assert.equal(m.heroThemes[0].abandon,1);
 const key='legend-mist-prototype:v1:'+JSON.stringify(['r','p','sheet']),data=new Map([[key,JSON.stringify(raw)]]),store=makeStore({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},{room:'r',player:'p'},'sheet');assert(store.save(store.load()));assert.equal(data.get(key+':before-v4'),JSON.stringify(raw));assert.equal(store.load().notes,'Оставить');assert.equal(store.load().quintessences,'Старая запись');
});
