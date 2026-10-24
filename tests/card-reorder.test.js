import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createCardReorder} from '../src/card-reorder.js';
import {clean} from '../src/storage.js';

function fixture(order=[]){
 const dom=new JSDOM('<main><section id="panel-party" role="tabpanel"><div class="mt-card-row">'+['a','b','c'].map(id=>`<div class="mt-card-slot" data-card-id="${id}"><article class="mt-scroll-frame"><header class="mt-scroll-top">${id}<button class="mt-delete-card">×</button><select><option>Истоки</option></select></header></article></div>`).join('')+'</div></section></main>');
 const root=dom.window.document.querySelector('main'),row=root.querySelector('.mt-card-row'),cards=[...root.querySelectorAll('.mt-card-slot')],state={party:order},moves=[];
 row.getBoundingClientRect=()=>({left:0,right:708,width:708});
 cards.forEach(card=>{card.getBoundingClientRect=()=>({left:Number(card.style.order||0)*236,right:Number(card.style.order||0)*236+224,width:224});card.animate=(frames,options)=>{moves.push({frames,options});return {cancel(){},finished:Promise.resolve()};};});
 createCardReorder(root,{getOrder:key=>state[key],setOrder:(key,value)=>state[key]=value});
 function pointer(target,type,x){const event=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x});Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);}
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
