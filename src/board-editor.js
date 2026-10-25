import OBR,{buildImage,buildPath} from '@owlbear-rodeo/sdk';
import './board-styles.js';
import {createBoardScene} from './board-scene.js';
import {BOARD_EDITOR,cardFields,fieldValue} from './board-model.js';
import {bindInlineInput} from './board-inline.js';
import {makeFellowshipStore} from './fellowship.js';
const root=document.getElementById('editor');root.className='mt-board-inline-editor';document.body.classList.add('mt-inline-editor-page');
OBR.onReady(async()=>{
 const params=new URLSearchParams(location.search),id=params.get('item'),fieldId=params.get('field');
 const fellowship=makeFellowshipStore(OBR.room),scene=createBoardScene(OBR,{build:buildImage,buildPath,fellowship});let unbind=()=>{};
 try{
  const item=(await OBR.scene.items.getItems([id]))[0],r=scene.record(item),field=r&&cardFields(r.card).find(f=>f.id===fieldId&&f.kind==='text');if(!field)throw Error('Поле недоступно.');if(r.source==='fellowship')await fellowship.start();
  const input=document.createElement('textarea');input.maxLength=field.max;input.value=fieldValue(r.card,field);input.setAttribute('aria-label',field.label);input.title='Enter — сохранить · Shift+Enter — новая строка · Esc — отменить';
  let style={};try{style=JSON.parse(params.get('style')||'{}');}catch{}
  for(const key of ['fontFamily','color','textAlign'])if(typeof style[key]==='string')input.style[key]=style[key];
  for(const key of ['fontSize','lineHeight'])if(Number.isFinite(style[key]))input.style[key]=Math.max(8,Math.min(160,style[key]))+'px';
  if(typeof style.background==='string'&&style.background!=='rgba(0, 0, 0, 0)')input.style.backgroundColor=style.background;
  const error=document.createElement('p');error.className='mt-inline-error';error.setAttribute('role','alert');error.hidden=true;
  unbind=bindInlineInput(input,{save:value=>scene.edit(id,fieldId,value),close:()=>OBR.popover.close(BOARD_EDITOR),report:e=>{error.hidden=false;error.textContent=e.message;void OBR.popover.setHeight(BOARD_EDITOR,input.scrollHeight+60);}});
  root.append(input,error);let lastHeight=window.innerHeight;const grow=()=>{input.style.height='auto';input.style.height=Math.max(30,input.scrollHeight)+'px';const height=Math.max(32,input.scrollHeight+2);if(height!==lastHeight){lastHeight=height;void OBR.popover.setHeight(BOARD_EDITOR,height);}};input.addEventListener('input',grow);await document.fonts.ready;grow();input.focus();input.select();
 }catch(e){root.textContent=e.message;}window.addEventListener('pagehide',()=>{unbind();scene.dispose();fellowship.dispose();},{once:true});
});
