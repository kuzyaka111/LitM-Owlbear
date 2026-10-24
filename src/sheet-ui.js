import { themes } from './demo.js';
import { newCard, makeId } from './storage.js';
import { fellowshipDefaults, fellowshipLimits } from './fellowship.js';

export function mountSheet(root, state, save, actions) {
  const doc = root.ownerDocument, q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const el = (type, cls, text) => { const n = doc.createElement(type); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const fitFields = () => qa('.mt-auto-size').forEach(input => { if (input.clientWidth) { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; } });
  const button = (label, cls, action, aria) => { const n = el('button', cls, label); n.type = 'button'; if (aria) n.setAttribute('aria-label', aria); n.addEventListener('click', action); return n; };
  function field(label, value, limit, onInput, multiline = false, cls = '') {
    const wrap = el('label', 'mt-field ' + cls); wrap.append(el('span', '', label));
    const input = el(multiline ? 'textarea' : 'input'); input.value = value; input.maxLength = limit;
    if (multiline) input.rows = 2;
    if (cls === 'mt-card-title') input.classList.add('mt-auto-size');
    input.addEventListener('input', () => { onInput(input.value); if (input.classList.contains('mt-auto-size')) fitFields(); }); wrap.append(input); return { wrap, input };
  }
  function pips(label, current, max, change) {
    const group = el('div', 'mt-track-group'), row = el('div', 'mt-pips');
    for (let i = 1; i <= max; i++) {
      const b = button(i <= current ? '◆' : '◇', 'mt-pip', () => change(i === current ? i - 1 : i), `${label}, отметка ${i}`);
      b.setAttribute('aria-pressed', String(i <= current)); row.append(b);
    }
    group.append(row, el('span', '', label)); return group;
  }
  let shared = fellowshipDefaults();
  const selected = new Set(state.selected);
  function availableTags() {
    const tags = new Map(themes.flatMap(t => t.tags.map(name => [name, name])));
    state.cards.forEach(c => {
      if (c.type === 'theme' && c.title.trim()) tags.set(`card:${c.id}:title`, c.title);
      c.items.forEach(item => tags.set(`card:${c.id}:${item.id}`, item.text));
    });
    ['name', 'power1', 'power2'].forEach((key, i) => { if (shared[key] && !shared['spent' + i]) tags.set('fellowship:' + key, shared[key]); });
    return tags;
  }
  function refreshSelection() {
    const tags = availableTags();
    for (const key of selected) if (!tags.has(key)) selected.delete(key);
    qa('[data-tag-key]').forEach(b => {
      const active = selected.has(b.dataset.tagKey); b.setAttribute('aria-pressed', String(active));
      b.querySelector('.mt-diamond').textContent = active ? '◆' : '◇';
    });
    q('.mt-selected-text').textContent = selected.size ? [...selected].map(k => tags.get(k)).join(' · ') : 'Выбери подходящие теги на карточках';
    q('.mt-clear').disabled = !selected.size; state.selected = [...selected];
    q('.mt-selection').hidden = !selected.size; q('.mt-selected-count').textContent = String(selected.size);
  }
  function tag(name, key = name) {
    const b = button('', 'mt-tag', () => { selected.has(key) ? selected.delete(key) : selected.add(key); refreshSelection(); save(); });
    b.dataset.tagKey = key; b.dataset.tag = name; b.setAttribute('aria-pressed', String(selected.has(key)));
    const diamond = el('span', 'mt-diamond', selected.has(key) ? '◆' : '◇'); diamond.setAttribute('aria-hidden', 'true');
    b.append(diamond, el('span', 'mt-tag-text', name)); return b;
  }
  function bind(selector, key) { const input = q(selector); input.value = state[key]; input.addEventListener('input', () => { state[key] = input.value; fitFields(); save(); }); }
  bind('.mt-editor-name', 'name'); bind('#mt-player-name', 'playerName'); bind('#mt-concept', 'concept'); bind('#mt-quintessences', 'quintessences'); bind('#mt-notes-text', 'notes');
  function renderPromise() {
    q('.mt-promise').replaceChildren(pips('Потенциал', state.promise, 5, value => { state.promise = value; renderPromise(); save(); }));
  }
  renderPromise();
  function renderRelationships() {
    const container = q('.mt-relationship-list'); container.replaceChildren();
    if (!state.relationships.length) container.append(el('p', 'mt-card-hint', 'Кем тебе приходятся твои спутники?'));
    state.relationships.forEach((r, i) => {
      const row = el('div', 'mt-relationship');
      row.append(field('Спутник', r.companion, 80, value => { r.companion = value; save(); }).wrap,
        field('Тег отношения', r.tag, 80, value => { r.tag = value; save(); }).wrap,
        button('×', 'mt-remove', () => { state.relationships.splice(i, 1); renderRelationships(); save(); }, 'Удалить отношение ' + (r.companion || i + 1)));
      container.append(row);
    });
    q('.mt-add-relationship').disabled = state.relationships.length >= 20;
  }
  q('.mt-add-relationship').addEventListener('click', () => {
    state.relationships.push({ id: makeId(), companion: '', tag: '' }); renderRelationships(); save();
    q('.mt-relationship-list').lastElementChild.querySelector('input').focus();
  });
  renderRelationships();

  themes.forEach((t, i) => {
    const article = el('article', 'mt-theme mt-hero-theme');
    const head = el('div', 'mt-theme-head'); head.append(el('span', '', t.type), el('span', '', 'Тема'));
    article.append(head, el('h3', '', t.name.replaceAll('<br>', ' ')), el('div', 'mt-type', 'ТЕГИ СИЛЫ'));
    const tags = el('div', 'mt-tag-list'); t.tags.forEach(name => tags.append(tag(name))); article.append(tags);
    const weakness = el('div', 'mt-weakness'); weakness.append(el('small', '', 'СЛАБОСТЬ'), el('span', '', t.weakness)); article.append(weakness);
    const track = el('div', 'mt-track');
    ['Опыт', 'Угасание'].forEach((label, g) => {
      const group = el('div', 'mt-track-group'), row = el('div', 'mt-pips');
      for (let j = 0; j < 3; j++) {
        const key = i * 6 + g * 3 + j;
        const b = button(state.marks.includes(key) ? '◆' : '◇', 'mt-pip', () => {
          const active = !state.marks.includes(key); state.marks = active ? [...state.marks, key] : state.marks.filter(x => x !== key);
          b.setAttribute('aria-pressed', String(active)); b.textContent = active ? '◆' : '◇'; save();
        }, `${label}, отметка ${j + 1}, тема ${i + 1}`);
        b.setAttribute('aria-pressed', String(state.marks.includes(key))); row.append(b);
      }
      group.append(row, el('span', '', label)); track.append(group);
    });
    const story = el('div', 'mt-theme-story'); story.append(el('strong', '', t.motive), el('p', '', t.story)); article.append(track, story); q('.mt-themes').append(article);
  });

  let deletedCard = null;
  function renderBag() {
    const host = q('.mt-bag-cards'); host.replaceChildren(); q('.mt-bag-empty').hidden = state.cards.length > 0;
    q('.mt-add-backpack').disabled = q('.mt-add-theme').disabled = state.cards.length >= 30;
    if (deletedCard) q('.mt-undo button').disabled = state.cards.length >= 30;
    state.cards.forEach(card => {
      const article = el('article', 'mt-theme mt-inventory-card'); article.dataset.cardId = card.id;
      const head = el('div', 'mt-theme-head');
      head.append(el('span', '', card.type === 'theme' ? 'Тема' : 'Рюкзак'), button('×', 'mt-remove', () => {
        deletedCard = { card: structuredClone(card), index: state.cards.indexOf(card), selected: [...selected].filter(k => k.startsWith('card:' + card.id + ':')) };
        state.cards = state.cards.filter(c => c.id !== card.id); q('.mt-undo').hidden = false; q('.mt-undo span').textContent = `Удалена карточка «${card.title || 'Без названия'}».`;
        renderBag(); refreshSelection(); save();
      }, 'Удалить карточку ' + (card.title || 'Без названия')));
      article.append(head);
      const body = el('div', 'mt-card-body');
      const titleField = field('Название карточки', card.title, 80, value => {
        card.title = value; if (titleTag) { titleTag.querySelector('.mt-tag-text').textContent = value || 'Без названия'; titleTag.dataset.tag = value; }
        refreshSelection(); save();
      }, true, 'mt-card-title'); body.append(titleField.wrap);
      let titleTag;
      if (card.type === 'theme') {
        body.append(field('Тип темы', card.typeLabel, 40, value => { card.typeLabel = value; save(); }).wrap);
        titleTag = tag(card.title || 'Без названия', `card:${card.id}:title`); body.append(titleTag);
      }
      body.append(el('span', 'mt-eyebrow', card.type === 'theme' ? 'ТЕГИ СИЛЫ' : 'ВЕЩИ И ТЕГИ'));
      const list = el('div', 'mt-inventory-items'); body.append(list);
      const form = el('form', 'mt-add-card-item'); const input = el('input'); input.maxLength = 80; input.required = true; input.placeholder = card.type === 'theme' ? 'Новый тег силы' : 'Новая вещь или тег';
      input.setAttribute('aria-label', 'Новый тег в карточке ' + card.title);
      const add = el('button', '', '+'); add.type = 'submit'; add.setAttribute('aria-label', 'Добавить тег в карточку ' + card.title); form.append(input, add);
      const renderItems = () => {
        list.replaceChildren();
        card.items.forEach(item => {
          const row = el('div', 'mt-item-row'); row.append(tag(item.text, `card:${card.id}:${item.id}`), button('×', 'mt-remove', () => {
            card.items = card.items.filter(x => x.id !== item.id); renderItems(); refreshSelection(); save();
          }, 'Удалить тег ' + item.text)); list.append(row);
        });
        if (!card.items.length) list.append(el('p', 'mt-card-hint', 'Добавь первый тег ниже.'));
        add.disabled = input.disabled = card.items.length >= 50;
      };
      form.addEventListener('submit', e => {
        e.preventDefault(); const value = input.value.trim(); if (!value || card.items.length >= 50) return;
        card.items.push({ id: makeId(), text: value }); input.value = ''; renderItems(); refreshSelection(); save(); input.focus();
      });
      renderItems(); body.append(form);
      if (card.type === 'theme') body.append(field('Слабость', card.weakness, 200, value => { card.weakness = value; save(); }, false, 'mt-weakness-field').wrap,
        field('Стремление', card.quest, 500, value => { card.quest = value; save(); }, true).wrap);
      article.append(body);
      if (card.type === 'theme') {
        const tracks = el('div', 'mt-track mt-three-tracks');
        function renderTracks() { tracks.replaceChildren(...[['improve', 'Развитие'], ['abandon', 'Отказ'], ['milestone', 'Вехи']].map(([key, label]) => pips(label, card[key], 3, value => { card[key] = value; renderTracks(); save(); }))); }
        renderTracks(); article.append(tracks);
      }
      const details = el('details', 'mt-card-details'); details.append(el('summary', '', card.type === 'theme' ? 'Особые улучшения и записи' : 'Записи о содержимом'));
      details.append(field('Записи карточки', card.notes, 2000, value => { card.notes = value; save(); }, true).wrap); article.append(details); host.append(article);
    });
    fitFields();
  }
  function addCard(type) {
    if (state.cards.length >= 30) return;
    const card = newCard(type); state.cards.push(card); renderBag(); refreshSelection(); save();
    const title = q('.mt-bag-cards').lastElementChild.querySelector('.mt-card-title textarea'); title.focus(); title.select();
  }
  q('.mt-add-backpack').addEventListener('click', () => addCard('bag'));
  q('.mt-add-theme').addEventListener('click', () => addCard('theme'));
  q('.mt-undo button').addEventListener('click', () => {
    if (!deletedCard || state.cards.length >= 30) return;
    state.cards.splice(deletedCard.index, 0, deletedCard.card); deletedCard.selected.forEach(k => selected.add(k)); deletedCard = null;
    q('.mt-undo').hidden = true; renderBag(); refreshSelection(); save();
  });
  renderBag();

  const service = actions.fellowship;
  const status = q('.mt-fellowship-status');
  if (!service) status.textContent = 'Общая карточка доступна при подключении к комнате.';
  else {
    let ready = false, busy = false;
    const dirty = new Set(), versions = new Map(), inputs = {};
    const card = el('article', 'mt-theme mt-fellowship-card');
    const head = el('div', 'mt-theme-head'); head.append(el('span', '', 'Братство'), el('span', '', 'Общее')); 
    const title = el('h3'), tagList = el('div', 'mt-tag-list'), weakness = el('div', 'mt-weakness');
    const quest = el('div', 'mt-theme-story'), tracks = el('div', 'mt-track mt-three-tracks');
    const improvements = el('p', 'mt-fellowship-improvements');
    const details = el('details', 'mt-card-details mt-fellowship-editor'); details.append(el('summary', '', 'Редактировать карточку'));
    const form = el('form', 'mt-fellowship-form'), fields = el('fieldset'); fields.disabled = true;
    for (const [key, label] of Object.entries({ name: 'Название братства', power1: 'Тег силы 1', power2: 'Тег силы 2', weakness: 'Слабость', quest: 'Общее стремление', improvements: 'Особые улучшения' })) {
      const f = field(label, '', fellowshipLimits[key], () => { dirty.add(key); versions.set(key, (versions.get(key) || 0) + 1); updateSaveButton(); }, ['quest', 'improvements'].includes(key));
      inputs[key] = f.input; fields.append(f.wrap);
    }
    const submit = el('button', 'mt-primary', 'Сохранить для всех'); submit.type = 'submit'; fields.append(submit); form.append(fields); details.append(form);
    const editState = el('p', 'mt-edit-state'); editState.setAttribute('role', 'status'); details.append(editState);
    function updateSaveButton() {
      submit.disabled = !ready || busy || !dirty.size;
      editState.textContent = dirty.size ? 'Есть несохранённые изменения.' : '';
    }
    const setStatus = (text, error = false) => { status.textContent = text; status.classList.toggle('mt-error', error); };
    async function updateField(patch) {
      if (!ready || busy) return;
      busy = true; renderShared(); setStatus('Сохраняем общую карточку…');
      try { await service.update(patch); setStatus(actions.preview ? 'Сохранено в предпросмотре на этом устройстве.' : 'Сохранено для всех участников комнаты.'); }
      catch (error) { setStatus(error.message || 'Не удалось сохранить. Попробуй ещё раз.', true); }
      finally { busy = false; renderShared(); }
    }
    function renderShared() {
      title.textContent = shared.name || 'Ваше братство';
      tagList.replaceChildren();
      ['name', 'power1', 'power2'].forEach((key, i) => {
        if (!shared[key]) return;
        const row = el('div', 'mt-item-row'), b = tag(shared[key], 'fellowship:' + key);
        b.disabled = !ready || shared['spent' + i]; b.classList.toggle('mt-scratched', shared['spent' + i]);
        const scratch = button(shared['spent' + i] ? '↶' : '−', 'mt-scratch', () => void updateField({ ['spent' + i]: !shared['spent' + i] }), (shared['spent' + i] ? 'Восстановить тег ' : 'Истратить тег ') + shared[key]);
        scratch.disabled = !ready || busy; row.append(b, scratch); tagList.append(row);
      });
      if (!shared.name && !shared.power1 && !shared.power2) tagList.append(el('p', 'mt-card-hint', 'Назовите своё братство и добавьте общие теги.'));
      weakness.replaceChildren(el('small', '', 'СЛАБОСТЬ'), el('span', '', shared.weakness || 'Пока не определена'));
      quest.replaceChildren(el('span', 'mt-eyebrow', 'ОБЩЕЕ СТРЕМЛЕНИЕ'), el('p', '', shared.quest || 'Ради чего вы идёте вместе?'));
      tracks.replaceChildren(...[['improve', 'Развитие'], ['abandon', 'Отказ'], ['milestone', 'Вехи']].map(([key, label]) => pips(label, shared[key], 3, value => void updateField({ [key]: value }))));
      tracks.querySelectorAll('button').forEach(b => b.disabled = !ready || busy);
      improvements.textContent = shared.improvements; improvements.hidden = !shared.improvements;
      fields.disabled = !ready || busy;
      for (const key of Object.keys(inputs)) if (!dirty.has(key)) inputs[key].value = shared[key];
      updateSaveButton(); refreshSelection();
    }
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (!ready || busy || !dirty.size) return;
      const patch = Object.fromEntries([...dirty].map(key => [key, inputs[key].value]));
      const sentVersions = new Map(versions);
      busy = true; renderShared(); setStatus('Сохраняем общую карточку…');
      try {
        await service.update(patch);
        for (const key of Object.keys(patch)) if (versions.get(key) === sentVersions.get(key)) dirty.delete(key);
        setStatus(actions.preview ? 'Сохранено в предпросмотре на этом устройстве.' : 'Сохранено для всех участников комнаты.');
      } catch (error) { setStatus(error.message || 'Не удалось сохранить. Попробуй ещё раз.', true); }
      finally { busy = false; renderShared(); }
    });
    const retry = button('Повторить подключение', 'mt-secondary', () => void connect()); retry.hidden = true;
    const editDock = el('div', 'mt-attached-actions mt-fellowship-actions');
    const editButton = button('Редактировать карточку', 'mt-secondary', () => {
      details.open = !details.open;
      if (details.open) details.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      else card.scrollTop = 0;
    });
    editButton.setAttribute('aria-expanded', 'false');
    details.addEventListener('toggle', () => {
      editButton.setAttribute('aria-expanded', String(details.open));
      editButton.textContent = details.open ? 'Вернуться к карточке' : 'Редактировать карточку';
    });
    editDock.append(editButton);
    q('.mt-fellowship').append(editDock);
    card.append(head, title, el('div', 'mt-type', 'ТЕГИ СИЛЫ'), tagList, weakness, tracks, quest, improvements, details, status, retry); q('.mt-fellowship-card-host').append(card);
    service.subscribe((value, isReady) => {
      shared = value; ready = isReady; renderShared();
      if (ready && !busy) setStatus(actions.preview ? 'Предпросмотр: братство сохраняется только на этом устройстве.' : 'Общая карточка · изменения видны всем в комнате.');
    });
    async function connect() {
      retry.hidden = true;
      try { await service.start(); }
      catch { setStatus('Не удалось загрузить общую карточку. Проверь соединение и повтори попытку.', true); retry.hidden = false; }
    }
    void connect();
  }
  const tabs = qa('[data-sheet-tab]');
  function switchTab(b) {
    tabs.forEach(x => { const active = x === b; x.setAttribute('aria-pressed', String(active)); x.setAttribute('aria-selected', String(active)); x.tabIndex = active ? 0 : -1; q('#' + x.getAttribute('aria-controls')).hidden = !active; }); fitFields();
  }
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => switchTab(b));
    b.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0; if (e.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { e.preventDefault(); switchTab(tabs[next]); tabs[next].focus(); }
    });
  });
  q('.mt-clear').addEventListener('click', () => { selected.clear(); refreshSelection(); save(); });
  q('.mt-close-sheet').addEventListener('click', () => Promise.resolve().then(actions.close).catch(() => { q('.mt-save-state').textContent = 'Не удалось закрыть окно'; }));
  refreshSelection(); fitFields();
  if (doc.defaultView.ResizeObserver) {
    const observer = new doc.defaultView.ResizeObserver(fitFields); observer.observe(root);
    doc.defaultView.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }
}
