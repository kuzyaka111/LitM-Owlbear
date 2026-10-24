import test from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics,createDiceWorld,upperFace} from '../src/dice-physics.js';
import {describeRoll} from '../src/dice.js';
test('outcome boundaries and physical top face agree with model numbering',()=>{
 assert.equal(describeRoll(6),'Последствие');assert.equal(describeRoll(7),'Успех с последствием');assert.equal(describeRoll(9),'Успех с последствием');assert.equal(describeRoll(10),'Успех');
 assert.equal(upperFace({x:0,y:0,z:0,w:1}).value,1);assert.equal(upperFace({x:1,y:0,z:0,w:0}).value,6);
});
test('real physics settles varied throws in bounds without repositioning settled dice',async()=>{
 await initPhysics();let seed=123456;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const sim=createDiceWorld(random),ends=[];
 try{for(let n=0;n<15;n++){sim.throwDice();let values;for(let t=0;t<1800&&!values;t++)values=sim.step();assert(values,'throw must settle');assert(values.every(v=>v>=1&&v<=6));
 const positions=sim.bodies.map(b=>({...b.translation()}));assert(positions.every(p=>Math.abs(p.x)<5&&Math.abs(p.z)<3.5));
 for(let t=0;t<60;t++)sim.step();assert.deepEqual(sim.bodies.map(b=>({...b.translation()})),positions);ends.push(JSON.stringify(positions));}
 assert(new Set(ends).size>10);
 }finally{sim.free();}
});

test('contact sounds follow physical impacts and stop for settled dice',async()=>{
 await initPhysics();const impacts=[];const sim=createDiceWorld(Math.random,force=>impacts.push(force));
 try{sim.throwDice();let values;for(let i=0;i<1800&&!values;i++)values=sim.step();assert(values);assert(impacts.length>0);assert(impacts.every(f=>f>=45));const count=impacts.length;for(let i=0;i<120;i++)sim.step();assert.equal(impacts.length,count);}finally{sim.free();}
});
