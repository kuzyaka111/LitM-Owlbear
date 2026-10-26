import {mountGM} from './gm-ui.js';
import {openCharacterPicker} from './character-picker.js';
import { mountSheet } from './sheet-ui.js';

function element(doc, type, className, text) {
  const el = doc.createElement(type);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function mountUI(root, view, template, store, actions) {
  const doc = root.ownerDocument;
  root.innerHTML = template;
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const state = store.load();
  if(view==='sheet'&&store.exists&&!store.exists())store.save(state);
  if(view==='sheet'&&store.activeId&&!store.activeId()){
    root.replaceChildren();const panel=element(doc,'section','mt-empty-characters'),title=element(doc,'h2','','Персонаж не выбран'),choose=element(doc,'button','','Выбрать'),close=element(doc,'button','','Закрыть лист');
    choose.addEventListener('click',()=>openCharacterPicker(root,store,actions.reloadSheet));close.addEventListener('click',actions.close);panel.append(title,element(doc,'p','','Создайте персонажа или дождитесь, пока ведущий выдаст его вам.'),choose,close);root.append(panel);return state;
  }
  function save() {
    const saved = store.save(state);
    if(view==='sheet'){if(!saved){const error=q('.mt-ui-message');error.hidden=false;error.textContent='Не удалось сохранить изменения на этом устройстве.';}return;}
    q('.mt-save-state').textContent = saved ? 'Сохранено' : 'Не сохранено';
    const error=q('.mt-gm-message');
    if(!saved){error.hidden=false;error.dataset.storageError='true';error.textContent='Не удалось сохранить изменения. После закрытия окна они могут потеряться.';}
    else if(error.dataset.storageError==='true'){error.hidden=true;error.textContent='';delete error.dataset.storageError;}
    return saved;
  }

  if (view === 'sheet') {
    mountSheet(root, state, save, actions);
  } else {
    const gm=mountGM(root,state,save,actions);
    if(actions.cloud){const off=actions.cloud.subscribeDocument(next=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,next);gm.refreshDocument();actions.obstaclesChanged?.();});actions.registerDispose?.(off);doc.defaultView.addEventListener('pagehide',off,{once:true});}
  }
  return state;
}
