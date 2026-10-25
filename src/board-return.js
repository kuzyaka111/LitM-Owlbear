export function mountBoardReturn(root,scene,{fit=()=>{},report=console.error}={}){
 const doc=root.ownerDocument,nav=root.querySelector('.mt-tabs'),button=doc.createElement('button');button.type='button';button.className='mt-board-return';button.textContent='Вернуть с поля';button.hidden=true;nav.insertBefore(button,nav.querySelector('.mt-close-sheet'));
 let dialog=null;
 const mine=()=>scene.items().filter(i=>{const r=scene.record(i);return r.owner===scene.owner&&r.placed;});
 function draw(){if(!dialog)return;const list=dialog.querySelector('.mt-board-return-list');list.replaceChildren();for(const item of mine()){
  const r=scene.record(item),b=doc.createElement('button');b.type='button';b.textContent=r.card.data.title||r.card.data.name||({character:'Персонаж',theme:r.source==='fellowship'?'Тема Братства':'Тема',bag:'Рюкзак',status:'Статус',note:'Заметка'}[r.card.type]);
  b.onclick=async()=>{b.disabled=true;try{await scene.returnToSheet(item.id);draw();if(!mine().length)close();}catch(e){b.disabled=false;report(e);}};list.append(b);
 }}
 function close(){dialog?.close?.();dialog?.remove();dialog=null;}
 button.onclick=()=>{if(dialog)return;dialog=doc.createElement('dialog');dialog.className='mt-editor-dialog mt-board-return-dialog';const current=dialog;current.addEventListener('close',()=>{current.remove();if(dialog===current)dialog=null;},{once:true});const title=doc.createElement('h2');title.textContent='Вернуть карточку в лист';const list=doc.createElement('div');list.className='mt-board-return-list';const cancel=doc.createElement('button');cancel.type='button';cancel.textContent='Закрыть';cancel.onclick=close;dialog.append(title,list,cancel);root.append(dialog);draw();if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');};
 const off=scene.subscribe(()=>{const hidden=mine().length===0;if(button.hidden!==hidden){button.hidden=hidden;void fit();}draw();});
 return ()=>{off();close();button.remove();};
}
