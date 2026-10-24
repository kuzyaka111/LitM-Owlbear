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
  root.prepend(note);
  function save() {
    const saved = store.save(state);
    q('.mt-save-state').textContent = saved ? 'Сохранено в браузере' : 'Не сохранено';
    note.classList.toggle('mt-error', !saved);
    note.textContent = saved ? normalNote : 'Браузер не разрешил сохранение. После закрытия окна изменения могут потеряться.';
  }
  function run(action) { Promise.resolve().then(action).catch(() => { note.textContent = 'Не удалось выполнить действие. Попробуй открыть окно снова.'; note.classList.add('mt-error'); }); }

  if (view === 'sheet') {
    mountSheet(root, state, save, actions);
  } else {
    function renderScene() {
      q('.mt-edit-scene').replaceChildren();
      state.scene.forEach(name => {
        const chip = element(doc, 'span', 'mt-edit-chip'); const b = element(doc, 'button', '', '×'); b.type = 'button'; b.setAttribute('aria-label', 'Удалить тег ' + name);
        b.addEventListener('click', () => { state.scene = state.scene.filter(x => x !== name); renderScene(); save(); });
        chip.append(element(doc, 'span', '', name), b); q('.mt-edit-scene').append(chip);
      });
    }
    renderScene();
    q('.mt-add-scene').addEventListener('submit', e => { e.preventDefault(); const input = q('#mt-scene-name'); const value = input.value.trim().slice(0, 60); if (value && !state.scene.includes(value) && state.scene.length < 30) { state.scene.push(value); renderScene(); save(); input.value = ''; } });
    qa('[data-gm-tab]').forEach(b => b.addEventListener('click', () => { qa('[data-gm-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); q('.mt-gm-scene').hidden = b.dataset.gmTab !== 'scene'; q('.mt-gm-party').hidden = b.dataset.gmTab !== 'party'; }));
    q('#mt-gm-note-text').value = state.notes; q('#mt-gm-note-text').maxLength = 5000;
    q('#mt-gm-note-text').addEventListener('input', e => { state.notes = e.target.value; save(); });
    q('.mt-close-gm').addEventListener('click', () => run(actions.close));
    q('.mt-party-card').addEventListener('click', () => run(actions.openSheet));
  }
  return state;
}
