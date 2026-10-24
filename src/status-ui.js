import {dressScroll} from './scroll-view.js';
import {newStatus,flipStatus} from './status-model.js';
import {renderedScale} from './sheet-scale.js';
export function mountStatuses(root,state,save,fit,tools){
 const {el,btn,scratchButton}=tools,host=root.querySelector('.mt-status-cards'),win=root.ownerDocument.defaultView;
 const reduced=()=>!state.settings.scrollAnimation||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function size(input){input.style.height='0px';input.style.height=Math.max(48,input.scrollHeight)+'px';}
 function card(item){
  const article=el('article','mt-theme mt-status-scroll');article.dataset.statusId=item.id;article.dataset.statusKind=item.kind;article.dataset.tear=String(item.tear);
  const head=el('div','mt-theme-head'),label=el('span','mt-status-kind',item.kind==='story'?'Сюжетный тег':'Статус');head.append(label,btn('×','mt-note-close',()=>{state.statusCards=state.statusCards.filter(s=>s!==item);article.remove();save();fit();},'Удалить '+(item.kind==='story'?'сюжетный тег':'статус')));article.append(head);
  const row=el('div','mt-status-title-row'+(item.scratched?' mt-status-scratched':'')),input=el('textarea','mt-status-name');input.rows=1;input.maxLength=160;input.value=item.name;input.placeholder='Название…';input.setAttribute('aria-label',item.kind==='story'?'Название сюжетного тега':'Название статуса');
  input.addEventListener('input',()=>{item.name=input.value;size(input);save();fit();});row.append(input);
  if(item.kind==='story'){const scratch=scratchButton(item.scratched,()=>{item.scratched=!item.scratched;row.classList.toggle('mt-status-scratched',item.scratched);row.classList.toggle('mt-status-scratch-reveal',item.scratched);scratch.setAttribute('aria-pressed',String(item.scratched));scratch.setAttribute('aria-label',item.scratched?'Восстановить сюжетный тег':'Зачеркнуть сюжетный тег');save();},item.scratched?'Восстановить сюжетный тег':'Зачеркнуть сюжетный тег');row.append(scratch);}
  article.append(row);
  if(item.kind==='numeric'){
   const marks=el('div','mt-status-marks');
   item.marks.forEach((marked,i)=>{const b=btn(String(i+1),'mt-status-mark'+(marked?' is-marked':''),()=>{item.marks[i]=!item.marks[i];b.classList.toggle('is-marked',item.marks[i]);b.classList.toggle('mt-status-mark-reveal',item.marks[i]);b.setAttribute('aria-pressed',String(item.marks[i]));save();},'Отметка '+(i+1));b.setAttribute('aria-pressed',String(marked));marks.append(b);});article.append(marks);
  }
  head.addEventListener('dblclick',async e=>{
   if(e.target.closest('button,select,input')||article.classList.contains('mt-status-flipping'))return;
   article.classList.add('mt-status-flipping');input.disabled=true;
   if(!reduced()&&typeof article.animate==='function')await article.animate([{transform:'perspective(700px) rotateY(0deg)'},{transform:'perspective(700px) rotateY(90deg)'}],{duration:160,easing:'ease-in'}).finished.catch(()=>{});
   if(!article.isConnected)return;flipStatus(item);save();const next=card(item);next.style.order=article.style.order;article.replaceWith(next);layout();fit();
   if(!reduced()&&typeof next.animate==='function')next.animate([{transform:'perspective(700px) rotateY(-90deg)'},{transform:'perspective(700px) rotateY(0deg)'}],{duration:160,easing:'ease-out'});
  });
  return dressScroll(article);
 }
 function layout(){host.querySelectorAll('.mt-status-name').forEach(input=>{if(input.offsetParent)size(input);});}
 layout.columns=()=>Math.max(1,new Set([...host.children].map(node=>node.offsetLeft)).size);
 if(win.ResizeObserver){let columns=1;const observer=new win.ResizeObserver(()=>{
  if(!host.offsetParent)return;layout();const next=layout.columns();if(next!==columns){columns=next;fit();}
 });observer.observe(host);win.addEventListener('pagehide',()=>observer.disconnect(),{once:true});}
 state.statusCards??=[];state.statusCards.forEach(item=>host.append(card(item)));
 root.querySelectorAll('[data-add-status]').forEach(button=>button.addEventListener('click',()=>{
  if(state.statusCards.length>=60)return;const item=newStatus(button.dataset.addStatus,state.statusCards.at(-1)?.tear);state.statusCards.push(item);const node=card(item);host.append(node);save();
  Promise.resolve(fit()).then(()=>{if(!node.isConnected)return;layout();const overflow=node.getBoundingClientRect().right-host.getBoundingClientRect().right;if(overflow>0)host.scrollLeft+=overflow/renderedScale(root);node.querySelector('textarea').focus({preventScroll:true});});
 }));
 return layout;
}
