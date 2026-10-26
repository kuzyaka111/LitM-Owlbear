import {parse} from 'opentype.js';
import {boardCardElement} from './board-render.js';
import {boardDebug} from './board-debug.js';
const FONT_NAMES={writing:'Bad Script',heading:'Alegreya SC'};
export const BOARD_GRAPHICS_VERSION=9;
let fontsPromise;
export const boardAsset=(file,base=globalThis.location?.href)=>new URL('./board-assets/'+file,base).href;
async function fonts(){
 fontsPromise??=Promise.all(Object.keys(FONT_NAMES).map(async key=>{
  const response=await fetch(boardAsset(key+'.woff'));if(!response.ok)throw Error('Не удалось загрузить шрифт карточки.');
  return [key,parse(await response.arrayBuffer())];
 })).then(entries=>Object.fromEntries(entries));return fontsPromise;
}
export function fontCommands(path){
 return path.commands.map(c=>c.type==='M'?[0,c.x,c.y]:c.type==='L'?[1,c.x,c.y]:c.type==='Q'?[2,c.x1,c.y1,c.x,c.y]:c.type==='C'?[4,c.x1,c.y1,c.x2,c.y2,c.x,c.y]:[5]).map(c=>c.map((v,i)=>i?Math.round(v*100)/100:v));
}
export const rectCommands=(x,y,w,h)=>[[0,x,y],[1,x+w,y],[1,x+w,y+h],[1,x,y+h],[5]];
function diamond(x,y,size,filled){
 const points=[[0,x,y-size/2],[1,x+size/2,y],[1,x,y+size/2],[1,x-size/2,y],[5]];
 return {commands:points,filled};
}
export async function renderBoardGraphics(record){
 const typefaces=await fonts();await Promise.all(Object.values(FONT_NAMES).map(name=>document.fonts.load('400 15px "'+name+'"')));await document.fonts.ready;
 const host=boardCardElement(record);host.setAttribute('aria-hidden','true');document.body.append(host);
 try{
  for(const image of host.querySelectorAll('.mt-board-picture')){try{await image.decode();image.style.aspectRatio=image.naturalWidth+'/'+image.naturalHeight;}catch{throw Error('Не удалось загрузить изображение препятствия. Проверьте ссылку.');}}
  // Background extension frames may never receive animation frames. Reading bounds forces layout synchronously.
  const shell=host.firstElementChild,bounds=shell.getBoundingClientRect();
  if(bounds.height>6000)throw Error('Карточка слишком длинная. Разделите заметку.');
  const width=Math.ceil(bounds.width),height=Math.ceil(bounds.height),paints=[],overlays=[],ink=new Map(),lines=new Map(),doc=shell.ownerDocument;
  const relative=node=>{const r=node.getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};};
  const style=node=>getComputedStyle(node);
  const groupFor=node=>{const field=node.closest('[data-board-field]');if(field)return 'field:'+field.dataset.boardField+(field.dataset.boardValue?':'+field.dataset.boardValue:'');const improvement=node.closest('.mt-improvement-row');if(improvement)return 'improvement:'+(improvement.dataset.improvementId||[...shell.querySelectorAll('.mt-improvement-row')].indexOf(improvement));return node.closest('.mt-board-owner')?'owner':'static';};
  const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d'),colors=new Map();canvas.width=1;canvas.height=1;
  const rgba=value=>{if(!colors.has(value)){ctx.clearRect(0,0,1,1);ctx.fillStyle='#000000';ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const [r,g,b,a]=ctx.getImageData(0,0,1,1).data;colors.set(value,{color:'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join(''),alpha:a/255});}return colors.get(value);};
  const color=value=>rgba(value).color;
  const opacity=node=>{let value=1;for(let n=node;n&&n!==host;n=n.parentElement)value*=Number(style(n).opacity||1);return value;};
  function path(commands,fill,alpha=1,stroke=null,strokeWidth=0,group='static',visible=true){
   if(!commands.length)return;const paint=JSON.stringify([fill,alpha,stroke,strokeWidth]),key=group+'|'+paint,map=stroke?lines:ink;
   if(!map.has(key))map.set(key,{key:group==='static'?'static:'+paint:group,visible:true,type:'path',commands:[],fill,alpha:visible?alpha:0,strokeAlpha:visible?1:0,stroke,strokeWidth});map.get(key).commands.push(...commands);
  }
  const image=(file,r,front=false,key=file,visible=true)=>(front?overlays:paints).push({key:'image:'+key,visible,type:'image',url:boardAsset(file.replace('.svg','.png')),...r});
  const paintRect=(r,fill,alpha=1)=>paints.push({key:'paint:'+paints.length,type:'path',commands:rectCommands(r.x,r.y,r.width,r.height),fill:color(fill),alpha:alpha*rgba(fill).alpha});
  const body=shell.querySelector('.mt-scroll-body'),bodyRect=relative(body),status=['status','scene-effect'].includes(record.card.type),aged=status&&(record.card.type==='scene-effect'?record.card.data.effectKind==='statuses':record.card.data.kind!=='story'),skin=aged?'aged':'paper';
  if(status){const tear=Number.isInteger(record.card.data.tear)?record.card.data.tear:Number(shell.querySelector('[data-tear]')?.dataset.tear)||0;image(skin+'.svg',{...bodyRect,height:Math.max(1,bodyRect.height-20)});image(skin+'-tear-'+tear+'.svg',{...bodyRect,y:bodyRect.y+bodyRect.height-21.333,height:21.333});}
  else image(skin+'.svg',bodyRect);
  for(const node of shell.querySelectorAll('.mt-board-picture'))paints.push({key:'image:illustration',type:'image',url:node.src,intrinsic:{width:node.naturalWidth,height:node.naturalHeight},mime:node.dataset.mime||'image/png',...relative(node)});
  const might=record.card.type==='theme'&&record.card.data.bookId==='story'?null:record.card.data.might;
  const dark={origin:'#263c32',adventure:'#451b16',greatness:'#19283f'}[might]||'#3c291f';
  for(const node of shell.querySelectorAll('.mt-board-owner,.mt-quest,.mt-hero-growth,.mt-improvements,.mt-track,.mt-note-section-heading,.mt-note-subheading,.mt-status-mark,.mt-obstacle-limit-name,.mt-obstacle-limit-value,.mt-obstacle-tag')){
   const r=relative(node),css=style(node);if(!r.width||!r.height)continue;
   if(node.matches('.mt-board-owner'))paintRect(r,css.backgroundColor,opacity(node));
   else if(node.matches('.mt-quest,.mt-hero-growth,.mt-improvements'))paintRect(r,dark);
   else if(css.backgroundColor!=='rgba(0, 0, 0, 0)'){if(node.matches('.mt-obstacle-limit-value'))paints.push({key:'paint:'+paints.length,type:'path',commands:[[0,r.x+r.width/2,r.y],[1,r.x+r.width,r.y+r.height],[1,r.x,r.y+r.height],[5]],fill:color(css.backgroundColor),alpha:opacity(node)});else paintRect(r,css.backgroundColor,opacity(node));}
  }
  const roll={origin:'scroll-roll.svg',adventure:'scroll-roll-adventure.svg',greatness:'scroll-roll-greatness.svg'}[might]||'scroll-roll-brown.svg';
  for(const node of shell.querySelectorAll('.mt-scroll-top,.mt-scroll-bottom')){const r=relative(node);if(r.width&&r.height&&style(node).display!=='none')image(roll,{...r,height:36},false,node.classList.contains('mt-scroll-top')?'roll-top':'roll-bottom');}
  // Borders and question diamonds keep the layout's exact measured spacing.
  for(const node of shell.querySelectorAll('.mt-tag-row,.mt-improvement-row,.mt-status-mark,.mt-question')){
   const r=relative(node),css=style(node);if(!r.width||!r.height)continue;
   if(node.matches('.mt-question')){path(diamond(r.x+r.width/2,r.y+r.height/2,14,false).commands,'#000000',0,'#a49167',.8);continue;}
   if(node.matches('.mt-status-mark'))path(rectCommands(r.x,r.y,r.width,r.height),'#000000',0,'#795d3a',.6);
   else if(parseFloat(css.borderBottomWidth)>0)path([[0,r.x,r.y+r.height],[1,r.x+r.width,r.y+r.height]],'#000000',0,'#ac916f',.25);
  }
  const walk=doc.createTreeWalker(shell,NodeFilter.SHOW_TEXT);let textNode;
  while((textNode=walk.nextNode())){
   const node=textNode.parentElement;if(!node||node.closest('svg,script,style'))continue;
   const css=style(node);if(css.display==='none'||css.visibility==='hidden')continue;
   const alpha=opacity(node),fill=color(css.color),size=parseFloat(css.fontSize),family=css.fontFamily.includes('Bad Script')?'writing':'heading',font=typefaces[family];
   ctx.font=(css.fontWeight||'400')+' '+size+'px "'+FONT_NAMES[family]+'"';const ascent=ctx.measureText('Hg').fontBoundingBoxAscent||font.ascender/font.unitsPerEm*size;
   let offset=0;for(let char of textNode.textContent){
    const start=offset;offset+=char.length;if(/\s/.test(char))continue;
    const range=doc.createRange();range.setStart(textNode,start);range.setEnd(textNode,offset);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
    const x=r.left-bounds.left,y=r.top-bounds.top;
    if(char==='◇'||char==='◆'){const d=diamond(x+r.width/2,y+r.height/2,size*.7,char==='◆');path(d.commands,fill,d.filled?alpha:0,d.filled?null:fill,d.filled?0:1.1,groupFor(node));continue;}
    if(!font.charToGlyph(char).index)continue;
    path(fontCommands(font.getPath(char,x,y+ascent,size)),fill,alpha,null,0,groupFor(node));
   }
  }
  // Claw buttons and all strike marks remain separate hit targets in the metadata.
  for(const node of shell.querySelectorAll('.mt-scratch svg')){
   const r=relative(node),fill=color(style(node).color),alpha=opacity(node);
   for(const points of [[[12,2],[8,13],[2,21],[7,10]],[[18,1],[13,15],[7,23],[12,11]],[[23,3],[19,15],[13,23],[17,12]]]){
    const commands=points.map(([x,y],i)=>[i?1:0,r.x+x*r.width/24,r.y+y*r.height/24]);commands.push([5]);path(commands,fill,alpha,null,0,groupFor(node));
   }
  }
  const tear=[[0,6],[24,4],[40,5],[57,2],[71,4],[91,3],[108,5],[127,2],[144,4],[160,1],[177,4],[196,2],[216,4],[240,3],[219,6],[198,5],[180,8],[161,5],[145,7],[128,5],[109,8],[92,6],[73,8],[57,5],[41,8],[25,6]];
  for(const node of shell.querySelectorAll('.mt-tag-text[data-board-field]')){const r=relative(node),y=r.y+r.height/2-3,commands=tear.map(([x,t],i)=>[i?1:0,r.x+x*r.width/240,y+t*6/10]);commands.push([5]);overlays.push({key:'tag-strike:'+node.dataset.boardField,type:'path',commands,fill:'#55412d',alpha:node.closest('.mt-scratched') ? .62 : 0});}
  for(const node of shell.querySelectorAll('.mt-status-mark')){const r=relative(node),x=r.x+2,y=r.y+3,w=r.width-4,h=r.height-6,translate=commands=>commands.map(c=>c.map((v,i)=>i?i%2?x+v*w/32:y+v*h/24:v)),active=node.classList.contains('is-marked');
   overlays.push({key:'number-strike:'+node.dataset.boardField,type:'path',commands:translate([[0,4,21],[4,6,20,7,17,10,16],[1,13,14],[1,15,11],[1,18,10],[4,20,8,21,6,24,5],[1,28,3]]),fill:'#000000',alpha:0,stroke:'#655039',strokeWidth:2.1*w/32,strokeAlpha:active?1:0});
   overlays.push({key:'number-fiber:'+node.dataset.boardField,type:'path',commands:translate([[0,7,20],[1,12,15],[1,15,14],[1,20,8],[1,24,7],[1,27,4]]),fill:'#000000',alpha:0,stroke:'#655039',strokeWidth:.65*w/32,strokeAlpha:active ? .65 : 0});
  }
  for(const node of shell.querySelectorAll('[data-status-kind=story] .mt-status-name')){const r=relative(node);path([[0,r.x,r.y+15],[1,r.x+r.width,r.y+15]],'#000000',0,'#786b53',1.5,'status-strike',!!node.closest('.mt-status-scratched'));}
  const parts=[...paints];
  for(const entry of [...lines.values(),...ink.values()]){
   // Keep native path payloads bounded while preserving contour closure.
   let batch=[],chunk=0;for(const command of entry.commands){if(command[0]===0&&batch.length>2200){parts.push({...entry,key:entry.key+':'+chunk++,commands:batch});batch=[];}batch.push(command);}if(batch.length)parts.push({...entry,key:entry.key+':'+chunk,commands:batch});
  }
  parts.push(...overlays);for(const node of shell.querySelectorAll('[data-board-field]:not([data-board-kind=text])')){const group=groupFor(node),band=node.closest('.mt-hero-growth,.mt-improvements,.mt-quest'),background=band?dark:'#f5e8c6';for(const part of parts)if(part.key.startsWith(group+':'))part.feedbackBackground=background;}const keys=new Map();for(const part of parts){const base=part.key,n=keys.get(base)||0;keys.set(base,n+1);if(n)part.key=base+':variant:'+n;}
  const hits=[...shell.querySelectorAll('[data-board-field]')].map(node=>({id:node.dataset.boardField,kind:node.dataset.boardKind,...(node.dataset.boardValue?{value:Number(node.dataset.boardValue)}:{}),...relative(node),...(node.dataset.boardKind==='text'?{style:{fontSize:parseFloat(style(node).fontSize),fontFamily:style(node).fontFamily,color:color(style(node).color),lineHeight:parseFloat(style(node).lineHeight)||parseFloat(style(node).fontSize)*1.5,textAlign:style(node).textAlign,background:node.closest('.mt-quest,.mt-hero-growth,.mt-improvements,.mt-theme-head')?style(node.closest('.mt-quest,.mt-hero-growth,.mt-improvements,.mt-theme-head')).backgroundColor:'#f5e8c6'}}:{})}));
  boardDebug('native-plan',{width,height,parts:parts.length,commands:parts.filter(p=>p.type==='path').reduce((n,p)=>n+p.commands.length,0)});
  return {width,height,parts,hits,dpi:150,interactionVersion:BOARD_GRAPHICS_VERSION};
 }finally{host.remove();}
}
