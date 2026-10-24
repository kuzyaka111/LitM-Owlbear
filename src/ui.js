import { themes } from './demo.js';

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
  const note = element(doc, 'div', 'mt-prototype-note', 'Прототип · тестовые данные сохраняются только в этом браузере. Общая база ещё не подключена.');
  root.prepend(note);
  function save() {
    const saved = store.save(state);
    q('.mt-save-state').textContent = saved ? 'Сохранено в браузере' : 'Не сохранено';
    note.classList.toggle('mt-error', !saved);
    note.textContent = saved ? 'Прототип · тестовые данные сохраняются только в этом браузере. Общая база ещё не подключена.' : 'Браузер не разрешил сохранение. После закрытия окна изменения могут потеряться.';
  }
  function run(action) { Promise.resolve().then(action).catch(() => { note.textContent = 'Не удалось выполнить действие. Попробуй открыть окно снова.'; note.classList.add('mt-error'); }); }

  if (view === 'sheet') {
    const selected = new Set(state.selected);
    const valid = new Set([...themes.flatMap(t => t.tags), ...state.bag]);
    for (const name of selected) if (!valid.has(name)) selected.delete(name);
    function refreshSelection() {
      qa('[data-tag]').forEach(b => { const active = selected.has(b.dataset.tag); b.setAttribute('aria-pressed', String(active)); b.querySelector('.mt-diamond').textContent = active ? '◆' : '◇'; });
      q('.mt-selected-text').textContent = selected.size ? [...selected].join(' · ') : 'Выбери подходящие теги на карточках';
      q('.mt-clear').disabled = !selected.size;
      state.selected = [...selected];
    }
    function tag(name) {
      const b = element(doc, 'button', 'mt-tag'); b.type = 'button'; b.dataset.tag = name;
      b.setAttribute('aria-pressed', String(selected.has(name)));
      const diamond = element(doc, 'span', 'mt-diamond', selected.has(name) ? '◆' : '◇'); diamond.setAttribute('aria-hidden', 'true');
      b.append(diamond, element(doc, 'span', '', name));
      b.addEventListener('click', () => { selected.has(name) ? selected.delete(name) : selected.add(name); refreshSelection(); save(); });
      return b;
    }
    themes.forEach((t, i) => {
      const article = element(doc, 'article', 'mt-theme');
      // All interpolated content comes from the fixed, authored demo dataset.
      article.innerHTML = `<div class="mt-theme-head"><span>${t.type}</span><span>Тема</span></div><h3>${t.name}</h3><div class="mt-type">ТЕГИ СИЛЫ</div><div class="mt-tag-list"></div><div class="mt-weakness"><small>СЛАБОСТЬ</small>${t.weakness}</div><div class="mt-track"></div><div class="mt-theme-story"><strong>${t.motive}</strong><p>${t.story}</p></div>`;
      t.tags.forEach(n => article.querySelector('.mt-tag-list').append(tag(n)));
      ['Опыт', 'Угасание'].forEach((label, groupIndex) => {
        const group = element(doc, 'div', 'mt-track-group'); const pips = element(doc, 'div', 'mt-pips');
        for (let j = 0; j < 3; j++) {
          const key = i * 6 + groupIndex * 3 + j;
          const b = element(doc, 'button', 'mt-pip', state.marks.includes(key) ? '◆' : '◇'); b.type = 'button';
          b.setAttribute('aria-label', `${label}, отметка ${j + 1}, тема ${i + 1}`); b.setAttribute('aria-pressed', String(state.marks.includes(key)));
          b.addEventListener('click', () => {
            const active = !state.marks.includes(key); state.marks = active ? [...state.marks, key] : state.marks.filter(x => x !== key);
            b.setAttribute('aria-pressed', String(active)); b.textContent = active ? '◆' : '◇'; save();
          }); pips.append(b);
        }
        group.append(pips, element(doc, 'span', '', label)); article.querySelector('.mt-track').append(group);
      }); q('.mt-themes').append(article);
    });
    const renderBag = () => q('.mt-bag-items').replaceChildren(...state.bag.map(tag)); renderBag(); refreshSelection();
    q('.mt-add-item').addEventListener('submit', e => {
      e.preventDefault(); const input = q('#mt-item-name'); const value = input.value.trim().slice(0, 60);
      if (value && !state.bag.includes(value) && state.bag.length < 50) { state.bag.push(value); renderBag(); save(); input.value = ''; }
    });
    q('.mt-clear').addEventListener('click', () => { selected.clear(); refreshSelection(); save(); });
    qa('[data-sheet-tab]').forEach(b => b.addEventListener('click', () => { qa('[data-sheet-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); ['themes', 'bag', 'notes'].forEach(key => q('.mt-' + key).hidden = key !== b.dataset.sheetTab); }));
    q('.mt-editor-name').value = state.name;
    q('.mt-editor-name').addEventListener('input', e => { state.name = e.target.value; save(); });
    q('#mt-notes-text').value = state.notes; q('#mt-notes-text').maxLength = 5000;
    q('#mt-notes-text').addEventListener('input', e => { state.notes = e.target.value; save(); });
    q('.mt-close-sheet').addEventListener('click', () => run(actions.close));
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
