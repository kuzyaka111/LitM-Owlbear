import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse,Path} from 'opentype.js';
import {JSDOM} from 'jsdom';
import {questionLetterCommands,questionLetterPath,QUESTION_LETTER_SHIFT_X,questionLetterViewBox} from '../src/question-letters.js';
import {Resvg} from '@resvg/resvg-js';
import {makeTheme} from '../src/theme-model.js';
import {editorTools,renderTheme} from '../src/editor-ui.js';

const loadFont=key=>{const bytes=fs.readFileSync(new URL('../public/board-assets/'+key+'.woff',import.meta.url));return parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};

test('both bundled font faces cover Russian text, question letters and rule numbers',()=>{
 const css=fs.readFileSync(new URL('../src/fonts/fonts.css',import.meta.url),'utf8');
 for(const [key,family]of [['writing','Bad Script'],['heading','Alegreya SC']]){
  const font=loadFont(key),characters='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJ0123456789−–—«»';
  assert([...characters].every(char=>font.charToGlyph(char).index),family+' is missing glyphs');
  const face=[...css.matchAll(/@font-face\{([^}]+)\}/g)].find(m=>m[1].includes('font-family:"'+family+'"'));
  assert(face);assert.equal(Buffer.compare(Buffer.from(face[1].match(/base64,([^)]*)/)[1],'base64'),fs.readFileSync(new URL('../public/board-assets/'+key+'.woff',import.meta.url))),0,'sheet and board must use the same face');
 }
});

test('every A–J outline retains the restored optical centre without a manual horizontal shift',()=>{
 for(const char of 'ABCDEFGHIJ')for(const size of [20,30]){
  const rect={x:7,y:11,width:size,height:size},commands=questionLetterCommands(char,rect),path=new Path();
  for(const c of commands){if(c[0]===0)path.moveTo(c[1],c[2]);else if(c[0]===1)path.lineTo(c[1],c[2]);else if(c[0]===2)path.quadraticCurveTo(...c.slice(1));else if(c[0]===4)path.curveTo(...c.slice(1));else path.close();}
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="7 11 '+size+' '+size+'" width="400" height="400"><path d="'+path.toPathData(6)+'"/></svg>',pixels=new Resvg(svg).render().pixels;
  let weight=0,xMoment=0,yMoment=0;for(let y=0;y<400;y++)for(let x=0;x<400;x++){const a=pixels[(y*400+x)*4+3];weight+=a;xMoment+=(x+.5)*a;yMoment+=(y+.5)*a;}
  assert(weight>0,char+' must be visible');assert(Math.abs((xMoment/weight-200)*size/400-QUESTION_LETTER_SHIFT_X*size/20)<.025,char+' horizontal optical centre');assert(Math.abs(yMoment/weight-200)*size/400<.025,char+' vertical optical centre');
  assert(questionLetterPath(char).startsWith('M'));
 }
});

test('shared question letters retain their individual alignment after room updates',()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),theme=makeTheme('fellowship');
 const card=renderTheme(theme,{isSelected:()=>false,select:()=>{},change:async()=>{},report:assert.fail,shared:true},editorTools(root));root.append(card);
 const next=structuredClone(theme);next.power[0].q='J';next.power[1].q='F';card.updateTheme(next);
 for(const [index,char]of [[0,'J'],[1,'F']]){const button=card.querySelector(`[data-kind="power"][data-index="${index}"] .mt-question`);assert.equal(button.querySelector('svg path').getAttribute('d'),questionLetterPath(char));assert.equal(button.querySelector('svg').getAttribute('viewBox'),questionLetterViewBox);assert.equal(button.dataset.letter,char);assert.equal(button.querySelector('span').textContent,char);assert.equal(button.getAttribute('aria-label'),'Выбрать вопрос '+char);}
 dom.window.close();
});
