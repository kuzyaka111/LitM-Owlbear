import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse,Path} from 'opentype.js';
import {JSDOM} from 'jsdom';
import {centeredGlyphCommands} from '../src/board-graphics.js';
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

test('native question glyph ink is centred for every A–J, including J descender',()=>{
 const font=loadFont('heading'),rect={x:7,y:11,width:20,height:20};
 for(const char of 'ABCDEFGHIJ')for(const size of [10,12,15]){
  const commands=centeredGlyphCommands(font,char,rect,size),path=new Path();
  for(const c of commands){if(c[0]===0)path.moveTo(c[1],c[2]);else if(c[0]===1)path.lineTo(c[1],c[2]);else if(c[0]===2)path.quadraticCurveTo(...c.slice(1));else if(c[0]===4)path.curveTo(...c.slice(1));else path.close();}
  const box=path.getBoundingBox();assert(Math.abs((box.x1+box.x2)/2-17)<.02,char+' horizontal');assert(Math.abs((box.y1+box.y2)/2-21)<.02,char+' vertical');
 }
});

test('shared question letters retain their individual alignment after room updates',()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),theme=makeTheme('fellowship');
 const card=renderTheme(theme,{isSelected:()=>false,select:()=>{},change:async()=>{},report:assert.fail,shared:true},editorTools(root));root.append(card);
 const next=structuredClone(theme);next.power[0].q='J';next.power[1].q='F';card.updateTheme(next);
 for(const [index,char]of [[0,'J'],[1,'F']]){const button=card.querySelector(`[data-kind="power"][data-index="${index}"] .mt-question`);assert.equal(button.dataset.letter,char);assert.equal(button.querySelector('span').textContent,char);assert.equal(button.getAttribute('aria-label'),'Выбрать вопрос '+char);}
 dom.window.close();
});
