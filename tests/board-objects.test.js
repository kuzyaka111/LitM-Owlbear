import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBoardObjects,BOARD_PART} from '../src/board-objects.js';
import {fontCommands,rectCommands} from '../src/board-graphics.js';
import {cardPoint,sourceCard,BOARD_KEY} from '../src/board-model.js';
import {defaults} from '../src/storage.js';
function builder(type,props={}){
 const item={id:crypto.randomUUID(),type,...props},api={build:()=>structuredClone(item)};
 for(const key of ['id','commands','fillColor','fillOpacity','strokeColor','strokeOpacity','strokeWidth','fillRule','scale','position','rotation','layer','createdUserId','attachedTo','locked','disableHit','disableAutoZIndex','zIndex','metadata','name'])api[key]=value=>{item[key]=value;return api;};return api;
}
const build=(image,grid)=>builder('IMAGE',{image,grid}),buildPath=()=>builder('PATH');
const record=()=>({v:1,rev:'r1',owner:'owner',source:'card:original-backpack',character:'Эрин',card:sourceCard(defaults('sheet'),'card:original-backpack'),placed:true});
const plan={width:244,height:212,dpi:150,hits:[],parts:[{type:'image',url:'https://example.org/board-assets/paper.png',x:14,y:70,width:216,height:100},{type:'path',commands:rectCommands(10,20,30,40),fill:'#333333',alpha:1}]};
test('native card has one selectable root and attached noninteractive graphics with bounded image URLs',()=>{
 const objects=makeBoardObjects({record:record(),plan,point:{x:100,y:200},build,buildPath});
 assert.equal(objects.root.type,'PATH');assert.equal(objects.root.metadata[BOARD_KEY].parts.length,2);
 for(const part of objects.parts){assert.equal(part.attachedTo,objects.root.id);assert.equal(part.locked,true);assert.equal(part.disableHit,true);assert.equal(part.metadata[BOARD_PART].root,objects.root.id);if(part.image)assert(part.image.url.length<=2048);}
 assert.equal(objects.parts[0].image.width,216);assert.equal(objects.parts[0].image.height,520);assert.equal(objects.parts[0].scale.y,100/520);
 assert.deepEqual(objects.parts[0].position,{x:114,y:270});
});
test('native graphics preserve the root transform and scale paints using their real intrinsic dimensions',()=>{
 const objects=makeBoardObjects({record:record(),plan,point:{x:100,y:200},existing:{scale:{x:1.25,y:1.25},rotation:90,zIndex:40},build,buildPath,gridDpi:100});
 assert.deepEqual(objects.root.scale,{x:1.25,y:1.25});assert.equal(objects.root.rotation,90);
 assert(Math.abs(objects.parts[0].position.x-12.5)<1e-8);assert(Math.abs(objects.parts[0].position.y-217.5)<1e-8);
 assert.deepEqual(objects.parts[1].position,{x:100,y:200});assert.deepEqual(objects.parts[1].scale,objects.root.scale);
 const point=cardPoint(objects.root,{x:12.5,y:217.5},100);assert(Math.abs(point.x-14)<1e-8);assert(Math.abs(point.y-70)<1e-8);
});
test('long data images are rejected before the host can hide the source card',()=>{
 assert.throws(()=>makeBoardObjects({record:record(),plan:{image:{url:'data:image/png;base64,'+'x'.repeat(2100),width:10,height:10},dpi:150},point:{x:0,y:0},build,buildPath}),/ограничение/);
});
test('font outlines retain Bezier control points and close their contours',()=>{
 assert.deepEqual(fontCommands({commands:[{type:'M',x:1,y:2},{type:'Q',x1:3,y1:4,x:5,y:6},{type:'C',x1:7,y1:8,x2:9,y2:10,x:11,y:12},{type:'Z'}]}),[[0,1,2],[2,3,4,5,6],[4,7,8,9,10,11,12],[5]]);
});

test('preallocated strike contours stay transparent independently of parent visibility',()=>{const objects=makeBoardObjects({record:record(),plan:{width:244,height:212,dpi:150,hits:[],parts:[{key:'strike',type:'path',commands:rectCommands(10,20,30,2),fill:'#55412d',alpha:0,stroke:'#655039',strokeAlpha:0,strokeWidth:1}]},point:{x:0,y:0},build,buildPath});assert.equal(objects.parts[0].visible,true);assert.equal(objects.parts[0].fillOpacity,0);assert.equal(objects.parts[0].strokeOpacity,0);});
