import {mountGM} from './gm-ui.js';
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
  const normalNote = view === 'sheet' && actions.preview ? 'Предпросмотр · все данные здесь сохраняются только на этом устройстве.' : view === 'sheet' ? 'Личный лист сохраняется на этом устройстве. Братство — общее для комнаты.' : 'Панель ведущего · заметки сохраняются только на этом устройстве.';
  const note = element(doc, 'div', 'mt-prototype-note', normalNote);
  const info = root.querySelector('.mt-storage-info');
  if(view!=='sheet'){if (info) info.append(note); else root.prepend(note);}
  function save() {
    const saved = store.save(state);
    if(view==='sheet'){if(!saved){const error=q('.mt-ui-message');error.hidden=false;error.textContent='Не удалось сохранить изменения на этом устройстве.';}return;}
    q('.mt-save-state').textContent = saved ? 'Сохранено' : 'Не сохранено';
    note.classList.toggle('mt-error', !saved);
    note.textContent = saved ? normalNote : 'Браузер не разрешил сохранение. После закрытия окна изменения могут потеряться.';
    return saved;
  }
  function run(action) { Promise.resolve().then(action).catch(() => { note.textContent = 'Не удалось выполнить действие. Попробуй открыть окно снова.'; note.classList.add('mt-error'); }); }

  if (view === 'sheet') {
    mountSheet(root, state, save, actions);
  } else {
    mountGM(root,state,save,actions);
  }
  return state;
}
