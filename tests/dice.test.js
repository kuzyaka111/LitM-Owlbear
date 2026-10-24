import test from 'node:test';
import assert from 'node:assert/strict';
import {rollD6} from '../src/dice.js';
import {clean,defaults} from '../src/storage.js';
test('d6 rejects the incomplete modulo bucket and includes both endpoints',()=>{
 let values=[4294967295,0,5];const crypto={getRandomValues(a){a[0]=values.shift();}};
 assert.equal(rollD6(crypto),1);assert.equal(rollD6(crypto),6);
});
test('animation preferences survive normalization and old sheets default to enabled',()=>{
 assert.deepEqual(defaults('sheet').settings,{scrollAnimation:true,diceAnimation:true});
 assert.deepEqual(clean({settings:{scrollAnimation:false,diceAnimation:false}},'sheet').settings,{scrollAnimation:false,diceAnimation:false});
 assert.deepEqual(clean({},'sheet').settings,{scrollAnimation:true,diceAnimation:true});
});
