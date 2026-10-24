let scrollId=0;
export function dressScroll(card,{expanded=false,onExpand,extensionLabel='Особые улучшения'}={}){
 if(card.classList.contains('mt-scroll-frame'))return card;
 const doc=card.ownerDocument,make=(tag,cls)=>{const n=doc.createElement(tag);n.className=cls;return n;};
 const head=card.querySelector(':scope > .mt-theme-head')||make('div','mt-theme-head');head.classList.add('mt-scroll-top');
 const improvements=card.querySelector(':scope > .mt-improvements');
 const body=make('div','mt-scroll-body'),main=make('div','mt-scroll-main');
 [...card.children].filter(n=>n!==head&&n!==improvements).forEach(n=>main.append(n));body.append(main);
 const foot=make('div','mt-scroll-bottom');
 if(improvements){
  const extension=make('div','mt-scroll-extension'),inner=make('div','mt-scroll-extension-inner');extension.id='scroll-extension-'+(++scrollId);extension.classList.toggle('is-open',expanded);extension.inert=!expanded;extension.setAttribute('aria-hidden',String(!expanded));inner.append(improvements);extension.append(inner);body.append(extension);
  const label=make('span','mt-scroll-bottom-label');label.textContent=extensionLabel;
  const toggle=make('button','mt-scroll-toggle');toggle.type='button';toggle.setAttribute('aria-controls',extension.id);
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','m6 8 6 6 6-6M6 13l6 6 6-6');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.2');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);toggle.append(svg);
  function sync(){toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',(expanded?'Свернуть ':'Развернуть ')+extensionLabel.toLowerCase());foot.classList.toggle('is-open',expanded);}
  let unfolding,scrollBeforeExpand=0,revision=0;
  toggle.addEventListener('click',()=>{
   const current=++revision,from=extension.getBoundingClientRect().height;unfolding?.cancel();if(!expanded)scrollBeforeExpand=body.scrollTop;expanded=!expanded;
   extension.classList.toggle('is-open',expanded);extension.inert=!expanded;extension.setAttribute('aria-hidden',String(!expanded));sync();const resized=onExpand?.(expanded);
   const reduced=card.closest('[data-scroll-animation=off]')||doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   if(!reduced&&typeof extension.animate==='function')unfolding=extension.animate([{height:from+'px'},{height:(expanded?inner.scrollHeight:0)+'px'}],{duration:360,easing:'cubic-bezier(.22,.7,.25,1)'});
   Promise.allSettled([resized,unfolding?.finished]).then(()=>{
    if(current!==revision||!card.isConnected)return;
    body.scrollTop=expanded?Math.min(extension.offsetTop,Math.max(0,body.scrollHeight-body.clientHeight)):scrollBeforeExpand;
   });
  });sync();foot.append(label,toggle);
 }else{foot.classList.add('mt-scroll-bottom-plain');foot.setAttribute('aria-hidden','true');}
 card.classList.add('mt-scroll-frame');card.replaceChildren(head,body,foot);return card;
}
