import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createCardReorder} from '../src/card-reorder.js';
import {clean} from '../src/storage.js';

function fixture(order=[],columns=false,scale=1){
 const dom=new JSDOM('<main><section id="panel-party" role="tabpanel"><div class="mt-card-row">'+['a','b','c'].map(id=>`<div class="mt-card-slot" data-card-id="${id}"><article class="mt-scroll-frame"><header class="mt-scroll-top">${id}<button class="mt-delete-card">×</button><select><option>Истоки</option></select></header></article></div>`).join('')+'</div></section></main>');
 const root=dom.window.document.querySelector('main'),row=root.querySelector('.mt-card-row'),cards=[...root.querySelectorAll('.mt-card-slot')],state={party:order},moves=[];
 dom.window.getComputedStyle=()=>({zoom:String(scale)});if(columns)row.classList.add('mt-status-cards');
 row.getBoundingClientRect=()=>({left:0,right:708,width:708});
 cards.forEach(card=>{card.getBoundingClientRect=()=>{const i=Number(card.style.order||0),left=(columns?Math.floor(i/2):i)*236*scale,top=columns?i%2*130*scale:0;return {left,right:left+224*scale,width:224*scale,top,height:110*scale};};card.animate=(frames,options)=>{moves.push({frames,options});return {cancel(){},finished:Promise.resolve()};};});
 createCardReorder(root,{getOrder:key=>state[key],setOrder:(key,value)=>state[key]=value});
 function pointer(target,type,x,y=0){const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);}
 return {dom,root,row,cards,state,moves,pointer};
}

test('dragging the header reorders existing cards and persists the new order',()=>{
 const f=fixture();f.pointer(f.cards[0].querySelector('header'),'pointerdown',20);f.pointer(f.dom.window.document,'pointermove',650);
 assert.equal(f.cards[0].style.order,'2');assert(f.moves.length>0);assert(f.moves.every(move=>move.options.duration===180));
 f.pointer(f.dom.window.document,'pointerup',650);assert.deepEqual(f.state.party,['card:b','card:c','card:a']);assert(f.cards.every(card=>card.isConnected));
 const stored=clean({cardOrder:f.state},'sheet');const reopened=fixture(stored.cardOrder.party);assert.equal(reopened.cards[0].style.order,'2');
});

test('cancelled dragging restores order and header controls do not start dragging',()=>{
 const f=fixture();f.pointer(f.cards[0].querySelector('header'),'pointerdown',20);f.pointer(f.dom.window.document,'pointermove',650);f.pointer(f.dom.window.document,'pointercancel',650);
 assert.deepEqual(f.cards.map(card=>card.style.order),['0','1','2']);assert.deepEqual(f.state.party,[]);
 for(const selector of ['select','.mt-delete-card']){f.pointer(f.cards[0].querySelector(selector),'pointerdown',20);f.pointer(f.dom.window.document,'pointermove',650);f.pointer(f.dom.window.document,'pointerup',650);assert.equal(f.cards[0].style.order,'0');}
});

test('Alt and arrow keys provide a keyboard alternative to header dragging',()=>{
 const f=fixture();f.cards[0].querySelector('header').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true,cancelable:true}));
 assert.deepEqual(f.state.party,['card:b','card:a','card:c']);assert.equal(f.cards[0].dataset.cardId,'a');
});

test('a themebook click stays on its button; pointer capture starts only when the header actually moves',()=>{
 const f=fixture(),head=f.cards[0].querySelector('header'),button=f.dom.window.document.createElement('button');button.className='mt-book-picker';head.append(button);const captures=[];let opened=0;head.setPointerCapture=id=>captures.push(id);button.addEventListener('click',()=>opened++);
 f.pointer(button,'pointerdown',20);assert.deepEqual(captures,[]);f.pointer(f.dom.window.document,'pointerup',20);button.click();assert.equal(opened,1);assert.deepEqual(f.state.party,[]);
 f.pointer(button,'pointerdown',20);f.pointer(f.dom.window.document,'pointermove',22);assert.deepEqual(captures,[]);f.pointer(f.dom.window.document,'pointermove',650);assert.deepEqual(captures,[1]);f.pointer(f.dom.window.document,'pointerup',650);button.click();assert.equal(opened,1);assert.deepEqual(f.state.party,['card:b','card:c','card:a']);f.dom.window.close();
});

test('stacked cards move vertically and across columns at 125 percent scale',()=>{
 const f=fixture([],true,1.25),head=f.cards[0].querySelector('header');
 f.pointer(head,'pointerdown',25,20);f.pointer(f.dom.window.document,'pointermove',25,270);f.pointer(f.dom.window.document,'pointerup',25,270);
 assert.deepEqual(f.state.party,['card:b','card:a','card:c']);
 assert(f.moves.some(move=>move.frames[0].transform==='translate(0px,130px)'));
 const g=fixture([],true,1.25);g.pointer(g.cards[0].querySelector('header'),'pointerdown',25,20);g.pointer(g.dom.window.document,'pointermove',400,250);g.pointer(g.dom.window.document,'pointerup',400,250);
 assert.deepEqual(g.state.party,['card:b','card:c','card:a']);
 assert.equal(g.cards[0].style.transform,'');
});
