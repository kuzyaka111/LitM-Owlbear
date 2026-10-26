export function mountDetachedButton(root,view,actions){
 if(!actions.openDetached)return;
 const doc=root.ownerDocument,button=doc.createElement('button'),detached=actions.detached;
 button.type='button';button.className=view==='gm'?'mt-detached-button':'mt-setting mt-detached-button';
 const ns='http://www.w3.org/2000/svg',icon=doc.createElementNS(ns,'svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');
 for(const d of detached?['M10 3H3v7M3 3l10 10','M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5']:['M14 3h7v7M21 3l-9 9','M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5']){const path=doc.createElementNS(ns,'path');path.setAttribute('d',d);icon.append(path);}button.append(icon);
 button.title=button.getAttribute('aria-label')||(detached?'Вернуть в Owlbear':'Открыть в отдельной вкладке');button.setAttribute('aria-label',button.title);
 button.addEventListener('click',()=>{try{Promise.resolve(actions.openDetached()).catch(report);}catch(error){report(error);}});
 function report(error){let node=root.querySelector(view==='gm'?'.mt-gm-message':'.mt-detached-error');if(!node&&view==='sheet'){node=doc.createElement('div');node.className='mt-detached-error';node.setAttribute('role','alert');button.after(node);}if(node){node.hidden=false;node.textContent=error?.message||'Не удалось открыть вкладку. Обновите комнату Owlbear и повторите.';}}
 const host=root.querySelector(view==='gm'?'.mt-gm-window-actions':'.mt-settings-list');host.insertBefore(button,view==='gm'?root.querySelector('.mt-close-gm'):null);
 if(detached){const bar=doc.createElement('div');bar.className='mt-detached-bar';bar.textContent='Связано с комнатой Owlbear';const back=doc.createElement('button');back.type='button';back.textContent='Вернуть в Owlbear';back.addEventListener('click',()=>button.click());bar.append(back);root.before(bar);doc.body.classList.add('mt-detached-page');}
}
