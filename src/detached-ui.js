export function mountDetachedButton(root,view,actions){
 if(!actions.openDetached)return;
 const doc=root.ownerDocument,button=doc.createElement('button'),detached=actions.detached;
 button.type='button';button.className=view==='gm'?'mt-detached-button':'mt-setting mt-detached-button';
 button.textContent=view==='gm'?(detached?'↙ Вернуть':'↗ В отдельную вкладку'):(detached?'Вернуть в Owlbear':'Открыть в отдельной вкладке');
 button.title=button.getAttribute('aria-label')||(detached?'Вернуть в Owlbear':'Открыть в отдельной вкладке');button.setAttribute('aria-label',button.title);
 button.addEventListener('click',()=>{try{Promise.resolve(actions.openDetached()).catch(report);}catch(error){report(error);}});
 function report(error){let node=root.querySelector(view==='gm'?'.mt-gm-message':'.mt-detached-error');if(!node&&view==='sheet'){node=doc.createElement('div');node.className='mt-detached-error';node.setAttribute('role','alert');button.after(node);}if(node){node.hidden=false;node.textContent=error?.message||'Не удалось открыть вкладку. Обновите комнату Owlbear и повторите.';}}
 const host=root.querySelector(view==='gm'?'.mt-gm-window-actions':'.mt-settings-list');host.insertBefore(button,view==='gm'?root.querySelector('.mt-close-gm'):null);
 if(detached){const bar=doc.createElement('div');bar.className='mt-detached-bar';bar.textContent='Связано с комнатой Owlbear';const back=doc.createElement('button');back.type='button';back.textContent='Вернуть в Owlbear';back.addEventListener('click',()=>button.click());bar.append(back);root.before(bar);doc.body.classList.add('mt-detached-page');}
}
