import {dressScroll} from './scroll-view.js';
import {renderedScale} from './sheet-scale.js';
import { clawIcon } from './icons.js';
import { themebooks, getBook, mightNames, improvementById, tagKey } from './theme-model.js';
export function editorTools(root) {
  const doc = root.ownerDocument;
  const el = (tag, cls, text) => { const n=doc.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; };
  const btn = (text, cls, fn, label) => { const b=el('button',cls,text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',fn);return b; };
  function dialog(title, build) {
    const d=el('dialog','mt-editor-dialog'), heading=el('h2','',title), form=el('form'), error=el('p','mt-dialog-error');
    error.setAttribute('role','alert'); const close=()=>{ d.close?.();d.remove(); };
    const x=btn('×','mt-dialog-close',close,'Закрыть редактор');d.append(x,heading,form,error);root.append(d);
    form.addEventListener('submit',e=>e.preventDefault());d.addEventListener('close',()=>d.remove(),{once:true});
    const outside=e=>{const r=d.getBoundingClientRect();return e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    let backdropPress=false;d.addEventListener('pointerdown',e=>{backdropPress=outside(e);});d.addEventListener('click',e=>{if(backdropPress&&outside(e))close();backdropPress=false;});
    build(form,close,msg=>{error.textContent=msg;});
    if(d.showModal)d.showModal();else d.setAttribute('open','');return d;
  }
  function inlineText(button,value,onSave,max=160,label='Тег') {
    if(!button.isConnected)return;
    const input=el('textarea','mt-inline-editor');input.value=value;input.maxLength=max;input.rows=1;input.setAttribute('aria-label',label);input.title='Нажмите вне поля, чтобы сохранить';
    const host=button.closest('.mt-card-slot');let saving=false;
    // Keep the original field's box and typography, including small companion labels.
    const rect=button.getBoundingClientRect(),style=doc.defaultView.getComputedStyle(button),scale=renderedScale(root);
    for(const property of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','color','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','alignSelf','order'])input.style[property]=style[property];
    Object.assign(input.style,{boxSizing:'border-box',flex:'0 0 auto',width:rect.width?rect.width/scale+'px':style.width,height:rect.height?rect.height/scale+'px':style.height,minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none',border:'0',outline:'none',boxShadow:'none',overflow:'auto'});
    button.replaceWith(input);
    input.addEventListener('blur',async()=>{
      if(saving)return;saving=true;input.disabled=true;
      try{await onSave(input.value);
        if(host?._pendingCard){const node=host._pendingCard;delete host._pendingCard;const scroll=host.querySelector('.mt-theme')?.scrollTop||0,flowScroll=host.querySelector('.mt-scroll-flow')?.scrollTop||0;host.replaceChildren(node);node.scrollTop=scroll;const flow=node.querySelector('.mt-scroll-flow');if(flow)flow.scrollTop=flowScroll;}
        else if(input.isConnected){button.textContent=input.value||'Пустой тег';input.replaceWith(button);}
      }catch(e){input.disabled=false;input.setAttribute('aria-invalid','true');input.title='Не сохранено: '+(e.message||e);const message=root.querySelector('.mt-ui-message');if(message){message.hidden=false;message.textContent=input.title;}input.focus();}
      finally{saving=false;}
    });
    input.focus();input.select();return input;
  }
  const scratchButton=(scratched,fn,label)=>{const b=btn('','mt-scratch',fn,label);b.append(clawIcon(doc));b.setAttribute('aria-pressed',String(scratched));return b;};
  return {doc,el,btn,dialog,inlineText,scratchButton};
}
export function renderTheme(theme, ctx, tools) {
  const {el,btn,dialog,inlineText,scratchButton}=tools, book=getBook(theme.bookId),story=theme.bookId==='story',fellowship=theme.bookId==='fellowship';
  const card=el('article','mt-theme mt-theme-card');card.dataset.themeId=theme.id;card.dataset.might=theme.might;
  if(ctx.core)card.classList.add('mt-hero-theme');
  if(fellowship){card.classList.add('mt-fellowship-theme');card.setAttribute('aria-label','Тема Братства');}
  const change = async patch => { await ctx.change(patch); };
  const safely = fn => ()=>Promise.resolve().then(fn).catch(ctx.report);
  const tagTexts=new Map();
  function question(kind,index) {
    const slot=theme[kind][index];
    dialog(kind==='power'?'Вопросы тегов силы':'Вопросы тегов слабости',(form,close,fail)=>{
      form.append(el('p','mt-source-note',book.name+' · '+book.originalName+' · стр. '+book.page));
      for(const q of book[kind]) {const b=btn('', 'mt-question-option', async()=>{try{await change({kind,index,field:'q',value:q.letter});close();}catch(e){fail(e.message);}});b.append(el('strong','',q.letter),el('span','',q.text));b.setAttribute('aria-pressed',String(q.letter===slot.q));form.append(b);}
    });
  }
  function row(kind,index,isTitle=false) {
    const slot=theme[kind][index], key=tagKey(theme,kind,index), q=book[kind].find(x=>x.letter===slot.q);
    const r=el('div','mt-tag-row'+(isTitle?' mt-title-row':'')+(slot.scratched?' mt-scratched':''));r.dataset.kind=kind;r.dataset.index=String(index);
    const letter=story?el('span','mt-story-diamond','◇'):btn('','mt-question',()=>question(kind,index),'Выбрать вопрос '+slot.q);if(!story){letter.append(el('span','',slot.q));letter.title=q?.text||'Выбрать вопрос';}
    const edit=()=>inlineText(text,slot.text,value=>change({kind,index,field:'text',value}),160,isTitle?'Название темы':kind==='power'?'Тег силы':'Тег слабости');
    let pending;const text=btn(slot.text||(isTitle?'Название темы':'Пустой тег'),'mt-tag-text',e=>{});text.dataset.key=key;text.title=slot.text+'\nДвойное нажатие — изменить.';text.classList.toggle('mt-empty-tag',!slot.text);
    tagTexts.set(r,text);
    text.setAttribute('aria-pressed',String(ctx.isSelected(key)));text.setAttribute('aria-label',(isTitle?'Название темы':kind==='power'?'Тег силы':'Тег слабости')+' '+index+': '+(slot.text||'пусто'));
    text.addEventListener('click',e=>{if(!slot.text)return;if(e.detail===0){if(!slot.scratched)ctx.select(key);return;}clearTimeout(pending);pending=setTimeout(()=>{if(text.isConnected&&!slot.scratched)ctx.select(key);},230);});
    text.addEventListener('dblclick',e=>{e.preventDefault();clearTimeout(pending);edit();});
    const scratch=scratchButton(slot.scratched,safely(()=>change({kind,index,field:'scratched',value:!slot.scratched})),(slot.scratched?'Восстановить':'Зачеркнуть')+' '+(slot.text||'тег'));scratch.disabled=!slot.text;
    r.append(letter,text,scratch);return r;
  }
  const head=el('div','mt-theme-head');const bookButton=btn(book.name,'mt-book-picker',()=>{
    if(!ctx.replace)return;
    dialog('Темник',(form,close,fail)=>{
      const select=el('select');select.setAttribute('aria-label','Темник');
      for(const b of themebooks.filter(b=>b.id!=='fellowship')){const o=el('option','',b.name+' · '+b.originalName+(b.might==='variable'?' (переменное Могущество)':''));o.value=b.id;o.selected=b.id===theme.bookId;select.append(o);}
      const label=el('label','mt-reset-theme'),reset=el('input');reset.type='checkbox';label.append(reset,el('span','','Начать новую тему с пустыми тегами и стремлением'));
      const submit=el('button','mt-primary','Применить темник');submit.type='submit';form.append(select,label,el('p','mt-source-note','Без отметки сохраняются ваши записи.'),submit);
      form.addEventListener('submit',async()=>{try{await ctx.replace(select.value,reset.checked);close();}catch(e){fail(e.message);}});
    });
  },'Выбрать темник');bookButton.disabled=!ctx.replace;
  const might=el('select','mt-might');might.setAttribute('aria-label','Могущество темы');for(const [v,label]of Object.entries(mightNames)){const o=el('option','',label);o.value=v;o.selected=v===theme.might;might.append(o);}might.addEventListener('change',safely(()=>change({field:'might',value:might.value})));
  head.append(fellowship?el('span','mt-fellowship-title',book.name):story?el('span','mt-story-type','Сюжетная тема'):bookButton,might);card.append(head,row('power',0,true));
  const powers=el('div','mt-power-slots');powers.append(el('span','mt-tag-label','Теги Силы'));for(let i=1;i<7;i++)powers.append(row('power',i));
  const weaknesses=el('div','mt-weakness-slots');weaknesses.append(el('span','mt-tag-label','Теги Слабости'));for(let i=0;i<3;i++)weaknesses.append(row('weakness',i));card.append(powers,weaknesses);
  const quest=el('div','mt-quest');const questText=btn(theme.quest||'Задать стремление','mt-quest-text',()=>{});questText.title=theme.quest+'\nДвойной клик — изменить';const editQuest=()=>inlineText(questText,theme.quest,value=>change({field:'quest',value}),ctx.shared?400:1000,'Стремление');questText.addEventListener('dblclick',editQuest);quest.append(el('span','mt-tag-label','СТРЕМЛЕНИЕ'),questText);card.append(quest);
  const tracks=el('div','mt-track');for(const [field,label]of [['improve','Развитие'],['abandon','Угасание'],['milestone','Вехи']]){const g=el('div','mt-track-group'),p=el('div','mt-pips');g.dataset.track=field;for(let i=1;i<=3;i++){const b=btn(i<=theme[field]?'◆':'◇','mt-pip',safely(()=>change({field,value:i===theme[field]?i-1:i})),label+' '+i);b.setAttribute('aria-pressed',String(i<=theme[field]));p.append(b);}g.append(p,el('span','',label));tracks.append(g);}card.append(tracks);
  const details=el('div','mt-improvements');details.setAttribute('aria-label','Особые улучшения');
  if(story){
    theme.storyImprovements.forEach((item,index)=>{
      const r=el('div','mt-improvement-row'+(!item.active?' mt-inactive-improvement':''));
      const toggle=btn(item.active?'◆':'◇','mt-improvement-toggle',safely(()=>change({field:'storyImprovements',value:theme.storyImprovements.map((x,i)=>i===index?{...x,active:!x.active}:x)})),'Активировать улучшение '+(index+1));toggle.setAttribute('aria-pressed',String(item.active));
      const title=btn(item.text||'Пустой тег','mt-improvement-title',()=>{});title.title='Двойное нажатие — изменить';title.addEventListener('dblclick',()=>inlineText(title,item.text,value=>change({field:'storyImprovements',value:theme.storyImprovements.map((x,i)=>i===index?{...x,text:value}:x)}),160,'Особое улучшение'));
      r.append(toggle,title);details.append(r);
    });
  }else{
    const options=[...book.improvements,...theme.improvements.filter(id=>!book.improvements.some(x=>x.id===id)).map(improvementById).filter(Boolean)];
    for(const imp of options){const active=theme.improvements.includes(imp.id),r=el('div','mt-improvement-row'+(!active?' mt-inactive-improvement':''));
      r.dataset.improvementId=imp.id;
      const toggle=btn(active?'◆':'◇','mt-improvement-toggle',safely(()=>change({field:'improvements',value:theme.improvements.includes(imp.id)?theme.improvements.filter(x=>x!==imp.id):[...theme.improvements,imp.id]})),'Активировать '+imp.name);toggle.setAttribute('aria-pressed',String(active));
      const title=btn(imp.name,'mt-improvement-title',()=>dialog(imp.name,form=>form.append(el('p','',imp.text),el('small','mt-source-note','The Hero · стр. '+imp.page))));title.title=imp.text;r.append(toggle,title);details.append(r);
    }
  }
  card.append(details);
  if(ctx.remove)head.append(btn('×','mt-delete-card',ctx.remove,'Удалить карточку'));
  if(ctx.busy)card.querySelectorAll('button,select').forEach(x=>x.disabled=true);
  // Shared themes keep their live controls and running animations during room updates.
  if(fellowship)card.updateTheme=(next,{disabled=false}={})=>{
    for(const kind of ['power','weakness'])theme[kind].forEach((slot,i)=>Object.assign(slot,next[kind][i]));
    for(const key of Object.keys(next))if(!['power','weakness'].includes(key))theme[key]=next[key];
    const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
    card.dataset.might=theme.might;might.value=theme.might;
    card.querySelectorAll('.mt-theme-head select,.mt-scroll-main button,.mt-scroll-main select,.mt-improvements button').forEach(node=>{node.disabled=disabled;});
    card.querySelectorAll('.mt-tag-row[data-kind]').forEach(row=>{
      const kind=row.dataset.kind,index=Number(row.dataset.index),slot=theme[kind][index],title=row.classList.contains('mt-title-row'),text=tagTexts.get(row),scratch=row.querySelector('.mt-scratch'),letter=row.querySelector('.mt-question');
      row.classList.toggle('mt-scratched',slot.scratched);
      if(text){setText(text,slot.text||(title?'Название темы':'Пустой тег'));text.classList.toggle('mt-empty-tag',!slot.text);text.title=slot.text+'\nДвойное нажатие — изменить.';text.setAttribute('aria-label',(title?'Название темы':kind==='power'?'Тег силы':'Тег слабости')+' '+index+': '+(slot.text||'пусто'));}
      scratch.disabled=disabled||!slot.text;scratch.setAttribute('aria-pressed',String(slot.scratched));scratch.setAttribute('aria-label',(slot.scratched?'Восстановить':'Зачеркнуть')+' '+(slot.text||'тег'));
      if(letter){setText(letter.querySelector('span'),slot.q);letter.setAttribute('aria-label','Выбрать вопрос '+slot.q);letter.title=book[kind].find(q=>q.letter===slot.q)?.text||'Выбрать вопрос';}
    });
    setText(questText,theme.quest||'Задать стремление');questText.title=theme.quest+'\nДвойной клик — изменить';
    card.querySelectorAll('[data-track]').forEach(group=>group.querySelectorAll('.mt-pip').forEach((button,i)=>{const active=i<theme[group.dataset.track];setText(button,active?'◆':'◇');button.setAttribute('aria-pressed',String(active));}));
    details.querySelectorAll('[data-improvement-id]').forEach(row=>{const active=theme.improvements.includes(row.dataset.improvementId),button=row.querySelector('.mt-improvement-toggle');row.classList.toggle('mt-inactive-improvement',!active);setText(button,active?'◆':'◇');button.setAttribute('aria-pressed',String(active));});
  };
  return dressScroll(card,{expanded:ctx.expanded||false,onExpand:ctx.onExpand,flowingFooter:true});
}
