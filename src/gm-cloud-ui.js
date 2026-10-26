export function mountGMCloud(root,cloud){
 const doc=root.ownerDocument,win=doc.defaultView,nav=root.querySelector('.mt-gm-tabs');let dialog=null,working=false,notice='';
 const el=(tag,cls='',text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn,label=text)=>{const n=el('button','',text);n.type='button';n.setAttribute('aria-label',label);n.addEventListener('click',fn);return n;};
 const labels={local:'Войти в облако',connecting:'Подключение…',pending:'Ожидает отправки',saving:'Сохраняем…',saved:'Всё сохранено в облаке',offline:'Нет связи — местная копия сохранена',conflict:'Нужно выбрать версию',error:'Ошибка сохранения'};
 const trigger=button('☁',open,'Облачное сохранение');trigger.className='mt-cloud-toggle';nav.insertBefore(trigger,root.querySelector('.mt-close-gm'));
 const redirect=()=>new URL('./cloud-auth.html',win.location.href).href;
 function close(){dialog?.close?.();dialog?.remove();dialog=null;notice='';}
 async function run(fn){if(working)return;working=true;notice='';draw();try{await fn();}catch(error){notice=error.message||'Не удалось подключиться. Попробуйте ещё раз.';}finally{working=false;draw();}}
 function downloadBackup(){const backup=cloud.backup();if(!backup){notice='На этом устройстве пока нет резервной копии.';draw();return;}const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='LitM-панель-резервная-копия.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function draw(){
  const state=cloud.snapshot();trigger.dataset.cloudStatus=state.status;trigger.title=labels[state.status]||state.status;trigger.setAttribute('aria-label','Облачное сохранение: '+trigger.title);
  if(!dialog)return;
  // Status updates must not replace an email/password while the user is typing.
  if(dialog.querySelector('input')&&dialog.contains(doc.activeElement)&&!working)return;
  const email=dialog.querySelector('[name=email]')?.value||'',password=dialog.querySelector('[name=password]')?.value||'';
  dialog.replaceChildren();dialog.append(button('×',close,'Закрыть облачное сохранение'),el('h2','','Облачное сохранение'));
  dialog.firstElementChild.className='mt-dialog-close';
  if(state.user){
   dialog.append(el('p','mt-cloud-account',state.user.email||'Аккаунт ведущего'),el('p','mt-cloud-status',labels[state.status]||''));
   if(state.detail)dialog.append(el('p','mt-cloud-detail',state.detail));
   if(state.conflict){
    dialog.append(el('p','','Обе версии сохранены. Выберите, с какой продолжить. Перед заменой сохраняется резервная копия на этом устройстве.'),button('Открыть облачную версию',()=>run(()=>cloud.useCloud())),button('Оставить мою версию',()=>run(()=>cloud.keepLocal())));
   }else dialog.append(button('Синхронизировать сейчас',()=>run(async()=>{await cloud.refresh();await cloud.flush();})));
   dialog.append(button('Скачать резервную копию',downloadBackup),button('Выйти на этом устройстве',()=>run(()=>cloud.signOut())));
  }else{
   dialog.append(el('p','','Войдите под одним аккаунтом на всех устройствах. Сцены, заметки и препятствия этой комнаты будут доступны после входа. При первом подключении местные записи сохранятся в облаке.'),el('p','mt-cloud-detail','Используйте свою почту. Письмо может понадобиться для подтверждения аккаунта.'));
   const form=el('form'),mail=el('input'),pass=el('input');mail.type='email';mail.name='email';mail.required=true;mail.autocomplete='username';mail.placeholder='Электронная почта';mail.setAttribute('aria-label','Электронная почта');mail.value=email;
   pass.type='password';pass.name='password';pass.required=true;pass.minLength=8;pass.autocomplete='current-password';pass.placeholder='Пароль — не менее 8 символов';pass.setAttribute('aria-label','Пароль');pass.value=password;
   const enter=el('button','','Войти');enter.type='submit';form.append(mail,pass,enter,button('Создать аккаунт',()=>{if(!form.reportValidity())return;const e=mail.value.trim(),p=pass.value;void run(async()=>{const signed=await cloud.signUp(e,p,redirect());notice=signed?'Аккаунт подключён.':'Проверьте почту, подтвердите адрес и затем нажмите «Войти».';});}),button('Забыли пароль?',()=>{if(!mail.reportValidity())return;const e=mail.value.trim();void run(async()=>{await cloud.resetPassword(e,redirect());notice='Письмо для восстановления отправлено. После смены пароля вернитесь сюда и войдите.';});}));
   form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const e=mail.value.trim(),p=pass.value;void run(()=>cloud.signIn(e,p));});dialog.append(form);
  }
  if(notice){const n=el('p','mt-cloud-notice',notice);n.setAttribute('role','status');dialog.append(n);}
  if(working){dialog.append(el('p','mt-cloud-status','Подождите…'));dialog.querySelectorAll('button,input').forEach(n=>n.disabled=true);dialog.querySelector('.mt-dialog-close').disabled=false;}
 }
 function open(){if(dialog)return;dialog=el('dialog','mt-editor-dialog mt-cloud-dialog');dialog.setAttribute('aria-label','Облачное сохранение');root.append(dialog);draw();dialog.addEventListener('close',close,{once:true});dialog.showModal?.();if(!dialog.open)dialog.setAttribute('open','');}
 const off=cloud.subscribe(draw);
 return {dispose(){off();close();trigger.remove();}};
}
