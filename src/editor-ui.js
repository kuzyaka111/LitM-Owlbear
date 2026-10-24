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
    build(form,close,msg=>{error.textContent=msg;});
    if(d.showModal)d.showModal();else d.setAttribute('open','');return d;
  }
  function editText(title,value,onSave,max=160) {
    return dialog(title,(form,close,fail)=>{
      const input=el('textarea');input.value=value;input.maxLength=max;input.rows=max>160?5:3;input.setAttribute('aria-label',title);
      const save=el('button','mt-primary','Сохранить');save.type='submit';form.append(input,save);
      form.addEventListener('submit',async()=>{save.disabled=true;try{await onSave(input.value);close();}catch(e){fail(e.message||'Не удалось сохранить');save.disabled=false;}});
      input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit();}});
      setTimeout(()=>{input.focus();input.select();},0);
    });
  }
  function catalogDialog(title, entries, selected, onSave) {
    return dialog(title,(form,close,fail)=>{
      const ids=new Set(selected),list=el('div','mt-catalog-list');
      form.append(el('p','mt-source-note','Тексты из оригинала книги. Выбранные варианты появятся строками на карточке.'));
      for(const item of entries){const label=el('label','mt-catalog-option'),input=el('input');input.type='checkbox';input.checked=ids.has(item.id);input.value=item.id;input.addEventListener('change',()=>input.checked?ids.add(item.id):ids.delete(item.id));const copy=el('span');copy.append(el('strong','',item.name),el('small','',item.text),el('small','mt-source-note','The Hero · стр. '+item.page));label.append(input,copy);list.append(label);}
      const save=el('button','mt-primary','Применить');save.type='submit';form.append(list,save);
      form.addEventListener('submit',async()=>{save.disabled=true;try{await onSave([...ids]);close();}catch(e){fail(e.message||'Не удалось сохранить');save.disabled=false;}});
    });
  }
  return {doc,el,btn,dialog,editText,catalogDialog};
}
export function renderTheme(theme, ctx, tools) {
  const {el,btn,dialog,editText,catalogDialog}=tools, book=getBook(theme.bookId);
  const card=el('article','mt-theme mt-theme-card');card.dataset.themeId=theme.id;
  if(ctx.core)card.classList.add('mt-hero-theme');
  const change = async patch => { await ctx.change(patch); };
  const safely = fn => ()=>Promise.resolve().then(fn).catch(ctx.report);
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
    const letter=btn('','mt-question',()=>question(kind,index),'Выбрать вопрос '+slot.q);letter.append(el('span','',slot.q));letter.title=q?.text||'Выбрать вопрос';
    const edit=()=>editText(isTitle?'Название темы':kind==='power'?'Тег силы':'Тег слабости',slot.text,value=>change({kind,index,field:'text',value}));
    let pending;const text=btn(slot.text||(isTitle?'Название темы':'Пустой тег'),'mt-tag-text',e=>{});text.dataset.key=key;text.title=slot.text+'\nДвойной клик — изменить. F2 — изменить.';text.classList.toggle('mt-empty-tag',!slot.text);
    text.setAttribute('aria-pressed',String(ctx.isSelected(key)));text.setAttribute('aria-label',(isTitle?'Название темы':kind==='power'?'Тег силы':'Тег слабости')+' '+index+': '+(slot.text||'пусто'));
    text.addEventListener('click',e=>{if(!slot.text){edit();return;}if(e.detail===0){if(!slot.scratched)ctx.select(key);return;}clearTimeout(pending);pending=setTimeout(()=>{if(text.isConnected&&!slot.scratched)ctx.select(key);},230);});
    text.addEventListener('dblclick',e=>{e.preventDefault();clearTimeout(pending);edit();});
    text.addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();edit();}});
    const scratch=btn(slot.scratched?'↶':'╱','mt-scratch',safely(()=>change({kind,index,field:'scratched',value:!slot.scratched})),(slot.scratched?'Восстановить':'Зачеркнуть')+' '+(slot.text||'тег'));scratch.disabled=!slot.text;
    const pencil=btn('✎','mt-edit-tag',edit,'Редактировать '+(slot.text||'пустой тег'));
    r.append(letter,text,scratch,pencil);return r;
  }
  const head=el('div','mt-theme-head');const bookButton=btn(book.name,'mt-book-picker',()=>{
    if(!ctx.replace)return;
    dialog('Темник',(form,close,fail)=>{
      const select=el('select');select.setAttribute('aria-label','Темник');
      for(const b of themebooks.filter(b=>b.id!=='fellowship')){const o=el('option','',b.name+' · '+b.originalName+(b.might==='variable'?' (переменное Могущество)':''));o.value=b.id;o.selected=b.id===theme.bookId;select.append(o);}
      const label=el('label','mt-reset-theme'),reset=el('input');reset.type='checkbox';label.append(reset,el('span','','Начать новую тему с пустыми тегами и стремлением'));
      const submit=el('button','mt-primary','Применить темник');submit.type='submit';form.append(select,label,el('p','mt-source-note','Без отметки сохраняются ваши записи. Последнюю замену можно отменить на карточке.'),submit);
      form.addEventListener('submit',async()=>{try{await ctx.replace(select.value,reset.checked);close();}catch(e){fail(e.message);}});
    });
  },'Выбрать темник');bookButton.disabled=!ctx.replace;
  const might=el('select','mt-might');might.setAttribute('aria-label','Могущество темы');for(const [v,label]of Object.entries(mightNames)){const o=el('option','',label);o.value=v;o.selected=v===theme.might;might.append(o);}might.addEventListener('change',safely(()=>change({field:'might',value:might.value})));
  head.append(bookButton,might);card.append(head,row('power',0,true));
  const powers=el('div','mt-power-slots');powers.append(el('span','mt-tag-label','СИЛА'));for(let i=1;i<7;i++)powers.append(row('power',i));
  const weaknesses=el('div','mt-weakness-slots');weaknesses.append(el('span','mt-tag-label','СЛАБОСТЬ'));for(let i=0;i<3;i++)weaknesses.append(row('weakness',i));card.append(powers,weaknesses);
  const quest=el('div','mt-quest');const questText=btn(theme.quest||'Задать стремление','mt-quest-text',()=>{});questText.title=theme.quest+'\nДвойной клик — изменить';const editQuest=()=>editText('Стремление',theme.quest,value=>change({field:'quest',value}),ctx.sharedStatus?400:1000);questText.addEventListener('dblclick',editQuest);questText.addEventListener('keydown',e=>{if(e.key==='F2')editQuest();});quest.append(el('span','mt-tag-label','СТРЕМЛЕНИЕ'),questText,btn('✎','mt-edit-quest',editQuest,'Редактировать стремление'));card.append(quest);
  const tracks=el('div','mt-track');for(const [field,label]of [['improve','Развитие'],['abandon','Отказ'],['milestone','Вехи']]){const g=el('div','mt-track-group'),p=el('div','mt-pips');for(let i=1;i<=3;i++){const b=btn(i<=theme[field]?'◆':'◇','mt-pip',safely(()=>change({field,value:i===theme[field]?i-1:i})),label+' '+i);b.setAttribute('aria-pressed',String(i<=theme[field]));p.append(b);}g.append(p,el('span','',label));tracks.append(g);}card.append(tracks);
  const details=el('details','mt-improvements');details.open=ctx.expanded||false;details.addEventListener('toggle',()=>ctx.onExpand?.(details.open));details.append(el('summary','','Особые улучшения · '+theme.improvements.length));
  for(const id of theme.improvements){const imp=improvementById(id);if(!imp)continue;const r=el('div','mt-improvement-row');const title=btn(imp.name,'',()=>dialog(imp.name,(form)=>form.append(el('p','',imp.text),el('small','mt-source-note','The Hero · стр. '+imp.page))));title.title=imp.text;r.append(title,btn('×','',safely(()=>change({field:'improvements',value:theme.improvements.filter(x=>x!==id)})),'Удалить улучшение '+imp.name));details.append(r);}
  const options=[...book.improvements,...theme.improvements.filter(id=>!book.improvements.some(x=>x.id===id)).map(improvementById).filter(Boolean)];
  details.append(btn('+ Выбрать из книги','mt-add-improvement',()=>catalogDialog('Особые улучшения — '+book.name,options,theme.improvements,value=>change({field:'improvements',value}))));
  if(theme.notes){const n=el('details','mt-legacy-notes');n.append(el('summary','','Записи темы'),el('p','',theme.notes));details.append(n);}card.append(details);
  if(ctx.undo)card.append(btn('↶ Вернуть прежнюю тему','mt-undo-theme',ctx.undo));
  if(ctx.remove)card.append(btn('Удалить карточку','mt-delete-card',ctx.remove));
  if(ctx.sharedStatus){const status=el('small','mt-fellowship-status',ctx.sharedStatus);status.setAttribute('role','status');card.append(status);}
  if(ctx.busy)card.querySelectorAll('button,select').forEach(x=>x.disabled=true);
  return card;
}
