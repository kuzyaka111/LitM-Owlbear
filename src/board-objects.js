import sizes from './board-asset-sizes.js';
import {BOARD_KEY} from './board-model.js';
import {rectCommands} from './board-graphics.js';
import {BOARD_PART,paintHash} from './board-diff.js';
export {BOARD_PART} from './board-diff.js';
export function makeBoardObjects({id=crypto.randomUUID(),record,plan,point,build,buildPath,gridDpi=150,existing}){
 const scale=existing?.scale||{x:gridDpi/plan.dpi,y:gridDpi/plan.dpi},rotation=existing?.rotation||0,z=existing?.zIndex||Date.now();
 const image=plan.image;
 if(image?.url.length>2048)throw Error('Адрес изображения превышает ограничение Owlbear.');
 const parts=(plan.parts||[]).map((part,index)=>{
  let builder;
  if(part.type==='image'){
   if(part.url.length>2048)throw Error('Адрес элемента карточки слишком длинный.');
   const file=new URL(part.url).pathname.split('/').at(-1),size=part.intrinsic||sizes[file];if(!size||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)throw Error('Неизвестное оформление карточки.');
   builder=build({url:part.url,mime:part.mime||'image/png',width:size.width,height:size.height},{dpi:gridDpi,offset:{x:0,y:0}}).scale({x:scale.x*part.width/size.width,y:scale.y*part.height/size.height});
  }else{
   if(!buildPath)throw Error('Векторный вывод недоступен.');
   builder=buildPath().commands(part.commands).fillColor(part.fill||'#000000').fillOpacity(part.alpha??1).strokeColor(part.stroke||'#000000').strokeOpacity(part.stroke?(part.strokeAlpha??1):0).strokeWidth(part.strokeWidth||0).fillRule('nonzero').scale(scale);
  }
  const radians=rotation*Math.PI/180,dx=part.type==='image'?part.x*scale.x:0,dy=part.type==='image'?part.y*scale.y:0,position={x:point.x+dx*Math.cos(radians)-dy*Math.sin(radians),y:point.y+dx*Math.sin(radians)+dy*Math.cos(radians)};
  const object=builder.position(position).rotation(rotation).layer('PROP').createdUserId(record.owner).attachedTo(id).locked(true).disableHit(true).disableAutoZIndex(true).zIndex(z+(index+1)/1000).metadata({[BOARD_PART]:{root:id,rev:record.rev,key:part.key||'part:'+index,hash:paintHash(part),...(part.feedbackBackground?{background:part.feedbackBackground}:{})}}).name('Элемент карточки').build();object.visible=part.visible!==false;return object;
 });
 record.parts=parts.map(p=>p.id);record.width=plan.width||image.width;record.height=plan.height||image.height;
 if(new TextEncoder().encode(JSON.stringify(record)).length>16000)throw Error('Слишком много данных для одной карточки. Разделите заметку.');
 const rootBuilder=image?build(image,{dpi:plan.dpi,offset:{x:0,y:0}}):buildPath().commands(rectCommands(0,0,plan.width,plan.height)).fillColor('#eee1c0').fillOpacity(.001).strokeWidth(0).strokeOpacity(0);
 const root=rootBuilder.id(id).createdUserId(record.owner).layer('PROP').position(point).rotation(rotation).scale(scale).zIndex(z).name(record.character+' · '+(record.card.data.title||record.card.data.name||'Карточка')).metadata({[BOARD_KEY]:record}).build();
 return {root,parts};
}
