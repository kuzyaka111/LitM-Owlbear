import {editorTools,renderTheme} from './editor-ui.js';
import {dressScroll} from './scroll-view.js';
import {quintessences} from './theme-model.js';
import {cardFields,fieldValue} from './board-model.js';
import {gmStatusValue} from './gm-model.js';
export function boardCardElement(record,doc=document){
 const host=doc.createElement('div');host.id='mist-table-design';host.className='mt-board-stage';
 const shell=doc.createElement('div');shell.className='mt-v4 mt-board-render';host.append(shell);
 const {el,btn,scratchButton,...rest}=editorTools(host),tools={el,btn,scratchButton,...rest},fields=cardFields(record.card),d=record.card.data;
 const mapped=(node,id)=>{const f=fields.find(f=>f.id===id);if(f){node.dataset.boardField=f.id;node.dataset.boardKind=f.kind;}return node;};
 const gmMarks=row=>{const marks=el('div','mt-status-marks mt-gm-export-marks');for(let i=0;i<6;i++){const mark=el('span','mt-status-mark'+(row.marks?.[i]?' is-marked':''),String(i+1));mark.dataset.boardField='gm-marks:'+row.id+':'+i;mark.dataset.boardKind='toggle';marks.append(mark);}return marks;};
 const text=(cls,id,placeholder='')=>mapped(el('div',cls,fieldValue(record.card,fields.find(f=>f.id===id))||placeholder),id);
 const caption=el('div','mt-board-owner',record.character||'Без имени');shell.append(caption);let article;
 if(record.card.type==='theme'){
  article=renderTheme(d,{isSelected:()=>false,select:()=>{},change:async()=>{},report:()=>{},expanded:true,shared:record.source==='fellowship'},tools);
  article.querySelectorAll('.mt-tag-row[data-kind]').forEach(row=>{const prefix=row.dataset.kind+'.'+row.dataset.index;mapped(row.querySelector('.mt-tag-text'),prefix+'.text');mapped(row.querySelector('.mt-scratch'),prefix+'.scratched');});
  mapped(article.querySelector('.mt-quest-text'),'quest');
  for(const group of article.querySelectorAll('[data-track]'))group.querySelectorAll('.mt-pip').forEach((n,i)=>{mapped(n,group.dataset.track);n.dataset.boardValue=i+1;});
  article.querySelectorAll('.mt-improvement-toggle').forEach((n,i)=>mapped(n,d.bookId==='story'?'storyImprovements.'+i+'.active':'improvements:'+n.closest('[data-improvement-id]')?.dataset.improvementId));
  article.querySelectorAll('.mt-improvement-title').forEach((n,i)=>mapped(n,'storyImprovements.'+i+'.text'));
  const select=article.querySelector('.mt-might');const label=el('span','mt-board-might',select.selectedOptions[0].textContent);select.replaceWith(label);
 }else{
  const kind=record.card.type,cls=kind==='status'||kind==='scene-effect'?'mt-status-scroll':kind==='bag'?'mt-backpack-card':kind==='note'?'mt-notes-card':'mt-character-card';
  article=el('article','mt-theme '+cls);const head=el('div','mt-theme-head');article.append(head);
  if(kind==='scene-effect'){
   article.dataset.statusKind=d.effectKind==='tags'?'story':d.kind;article.dataset.tear=[...d.id].reduce((n,c)=>n+c.charCodeAt(0),0)%5;
   head.append(el('span','',d.effectKind==='tags'?'Тег сцены':'Статус сцены'));const line=el('div','mt-status-title-row mt-scene-effect-title');line.append(el('span','mt-scene-effect-direction',d.direction===1?'↑':d.direction===-1?'↓':'◇'),el('div','mt-status-name',d.name));article.append(line);
   if(d.effectKind==='statuses'&&d.kind==='numeric')article.append(gmMarks(d));
  }else if(kind==='status'){
   article.dataset.statusKind=d.kind;article.dataset.tear=d.tear;head.append(el('span','mt-status-kind',d.kind==='story'?'Сюжетный тег':'Статус'));
   const row=el('div','mt-status-title-row'+(d.scratched?' mt-status-scratched':''));row.append(text('mt-status-name','name','Название…'));
   if(d.kind==='story')row.append(mapped(scratchButton(d.scratched,()=>{},'Зачеркнуть'),'scratched'));article.append(row);
   if(d.kind==='numeric'){const marks=el('div','mt-status-marks');d.marks.forEach((mark,i)=>marks.append(mapped(btn(String(i+1),'mt-status-mark'+(mark?' is-marked':''),()=>{}),'marks.'+i)));article.append(marks);}
  }else if(kind==='bag'){
   head.append(text('mt-storage-title','title','Рюкзак'));const items=el('div','mt-backpack-items');
   d.items.forEach((item,i)=>{const row=el('div','mt-item-row mt-tag-row'+(item.scratched?' mt-scratched':''));row.append(text('mt-tag-text','items.'+i+'.text'),mapped(scratchButton(item.scratched,()=>{},'Зачеркнуть'),'items.'+i+'.scratched'));items.append(row);});article.append(items);
  }else if(kind==='obstacle'){
   article.classList.add('mt-obstacle-export');head.append(el('span','','Препятствие'));
   if(d.image){const picture=el('img','mt-board-picture');picture.src=d.image.url;picture.alt='';picture.style.aspectRatio=d.image.width+'/'+d.image.height;picture.dataset.mime=d.image.mime;article.append(picture);}
   article.append(el('h2','mt-obstacle-export-name',d.name||'Препятствие'));
   for(const [key,title]of [['tags','Теги'],['statuses','Статусы'],['features','Особые свойства'],['threats','Угрозы и последствия']]){
    if(!d[key]?.length)continue;const section=el('section','mt-obstacle-export-section');section.append(el('h4','',title));
    const rows=el('div',key==='limits'?'mt-obstacle-limits':(key==='tags'||key==='statuses')?'mt-obstacle-tags':'');
    for(const row of d[key]){const line=el('div','mt-obstacle-export-row'+(key==='limits'?' mt-obstacle-limit':(key==='tags'||key==='statuses')?' mt-obstacle-tag mt-direction-'+(row.direction||0):''));if(key==='limits')line.append(el('div','mt-obstacle-limit-value',row.value||'X'),el('div','mt-obstacle-limit-name',row.name));else{if(key==='tags'||key==='statuses')line.append(el('span','mt-obstacle-direction',row.direction===1?'↑ ':row.direction===-1?'↓ ':'◇ '));line.append(el('strong','',row.name));if(key==='statuses'&&row.kind==='numeric')line.append(gmMarks(row));else if(key==='statuses')line.append(el('span','', ' '+gmStatusValue(row)));else if(key!=='tags')line.append(el('span','',row.text?' — '+row.text:''));}if(row.spent)line.classList.add('is-spent');rows.append(line);}section.append(rows);article.append(section);
   }
  }else if(kind==='character'){
   head.append(el('span','','Персонаж'));const body=el('div','mt-character-body');
   for(const [id,label]of [['name','Имя героя'],['playerName','Имя игрока']]){const field=el('div','mt-field');field.append(el('span','',label),text('mt-editor-name',id,'…'));body.append(field);}
   const relations=el('section','mt-relationships');relations.append(el('h4','mt-relationships-heading','Отношения в братстве'));
   d.relationships.forEach((_,i)=>{const row=el('div','mt-relationship');row.append(text('','relationships.'+i+'.companion','Спутник'),text('','relationships.'+i+'.tag','Тег отношения'));relations.append(row);});body.append(relations);article.append(body);
   const growth=el('div','mt-hero-growth'),pips=el('div','mt-promise');for(let i=1;i<=5;i++){const pip=mapped(btn(i<=d.promise?'◆':'◇','mt-pip',()=>{}),'promise');pip.dataset.boardValue=i;pips.append(pip);}growth.append(el('span','mt-tag-label','ПОТЕНЦИАЛ'),pips);article.append(growth);
   const quint=el('div','mt-improvements mt-quintessences');for(const q of quintessences){const row=el('div','mt-improvement-row'+(d.quintessenceIds.includes(q.id)?'':' mt-inactive-improvement'));row.append(mapped(el('span','mt-improvement-toggle',d.quintessenceIds.includes(q.id)?'◆':'◇'),'quintessenceIds:'+q.id),el('span','mt-improvement-title',q.name));quint.append(row);}if(d.quintessences)quint.append(text('','quintessences'));article.append(quint);
  }else if(kind==='note'){
   head.append(text('mt-note-title','title','Заметка'));const body=el('div','mt-note-body');
   d.sections.forEach((s,i)=>{body.append(text('mt-note-section-heading','sections.'+i+'.title','Заголовок'),text('mt-note-text','sections.'+i+'.text','…'));s.children.forEach((_,j)=>body.append(text('mt-note-subheading','sections.'+i+'.children.'+j+'.title','Подзаголовок'),text('mt-note-text','sections.'+i+'.children.'+j+'.text','…')));});article.append(body);
  }
  dressScroll(article,{expanded:true,flowingFooter:kind==='character',extensionLabel:'Квинтэссенции'});
 }
 article.querySelectorAll('.mt-scroll-toggle,.mt-delete-card,.mt-remove-card,.mt-note-close').forEach(n=>n.remove());
 article.querySelectorAll('.mt-scroll-extension').forEach(n=>{n.classList.add('is-open');n.inert=false;n.removeAttribute('aria-hidden');});
 article.querySelectorAll('button').forEach(n=>{n.disabled=false;n.removeAttribute('aria-pressed');});
 shell.append(article);return host;
}
