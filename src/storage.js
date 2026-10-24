import { cleanTheme, makeTheme, initialThemes, legacyTheme, quintessences } from './theme-model.js';
const text = (value, fallback = '', limit = 5000) => typeof value === 'string' ? value.slice(0, limit) : fallback;
const strings = (value, fallback, count = 50) => Array.isArray(value)
  ? [...new Set(value.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 160)).filter(Boolean))].slice(0, count)
  : [...fallback];
const count = (value, max) => Number.isInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
export const makeId = () => globalThis.crypto.randomUUID();
const id = (value, fallback) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fallback;
export function newCard(type) {
  if (type === 'theme') { const id = makeId(); return { id, type, theme: makeTheme('past', id) }; }
  return { id: makeId(), type, title: type === 'theme' ? 'Новая тема' : 'Новый рюкзак', typeLabel: '', items: [], weakness: '', quest: '', notes: '', improve: 0, abandon: 0, milestone: 0 };
}
export function defaults(view) {
  if (view === 'gm') return { scene: ['Густой туман', 'Старый каменный мост'], notes: 'Мельник прячет письмо под настилом. Он согласится поговорить, когда стража уйдёт.' };
  return {
    name: 'Эрин из Вересковой долины', playerName: '', concept: 'Следопыт, который однажды обещал вернуться',
    relationships: [], promise: 0, quintessences: '', quintessenceIds: [], selected: [], marks: [], heroThemes: initialThemes(), actionExtras: { power: [], weakness: [] }, schemaVersion: 4,
    notes: 'У старого моста нас должен ждать мельник. Он знает, кто видел пропавший караван последним.',
    cards: [{ id: 'original-backpack', type: 'bag', title: 'Дорожный рюкзак', typeLabel: '',
      items: ['Дорожный плащ', 'Верёвка', 'Кремень и огниво'].map((value, i) => ({ id: 'item-' + i, text: value, scratched: false })),
      weakness: '', quest: '', notes: '', improve: 0, abandon: 0, milestone: 0 }],
  };
}
function cleanCards(cards) {
  const seen = new Set();
  return cards.filter(c => c && typeof c === 'object' && ['bag', 'theme'].includes(c.type)).slice(0, 30).map((c, i) => {
    let cardId = id(c.id, 'card-' + i); while (seen.has(cardId)) cardId += '-copy'; seen.add(cardId);
    const itemIds = new Set();
    const items = Array.isArray(c.items) ? c.items.filter(x => x && typeof x.text === 'string' && x.text.trim()).slice(0, 50).map((x, j) => {
      let itemId = id(x.id, 'item-' + j); while (itemIds.has(itemId)) itemId += '-copy'; itemIds.add(itemId);
      return { id: itemId, text: text(x.text, '', 160), scratched: x.scratched === true };
    }) : [];
    if (c.type === 'theme') return { id: cardId, type: 'theme', theme: cleanTheme(c.theme || legacyTheme({ ...c, id: cardId, items }), cardId) };
    return { id: cardId, type: c.type, title: text(c.title, '', 80), typeLabel: text(c.typeLabel, '', 40), items,
      weakness: text(c.weakness, '', 200), quest: text(c.quest, '', 500), notes: text(c.notes, '', 2000),
      improve: count(c.improve, 3), abandon: count(c.abandon, 3), milestone: count(c.milestone, 3) };
  });
}
export function clean(value, view) {
  const d = defaults(view);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return d;
  if (view === 'gm') return { scene: strings(value.scene, d.scene, 30), notes: text(value.notes, d.notes) };
  // Retain the v1 storage key and migrate its flat inventory without touching notes.
  const cards = Array.isArray(value.cards) ? cleanCards(value.cards) : structuredClone(d.cards);
  if (!Array.isArray(value.cards) && Array.isArray(value.bag)) cards[0].items = strings(value.bag, [], 50).map((name, i) => ({ id: 'item-' + i, text: name.slice(0, 160), scratched: false }));
  // Preserve legacy theme inventory beyond six fixed slots in a separate backpack.
  if (value.schemaVersion !== 4 && Array.isArray(value.cards)) for (const c of value.cards) {
    if (c.type === 'theme' && Array.isArray(c.items) && c.items.length > 6) cards.push({ ...d.cards[0], id: 'overflow-' + c.id, title: 'Теги: ' + c.title, items: c.items.slice(6).map(x => ({ ...x })) });
  }
  const heroThemes = Array.from({ length: 4 }, (_, i) => value.heroThemes?.[i] ? cleanTheme({ ...value.heroThemes[i], id: 'hero-' + i }) : initialThemes(value.marks || [])[i]);
  let selected = strings(value.selected, [], 200);
  if (value.schemaVersion !== 4) selected = selected.map(key => {
    for (const t of heroThemes) for (let i=0;i<7;i++) if(t.power[i].text === key) return `theme:${t.id}:power:${i}`;
    for (const c of value.cards || []) if(c.type === 'theme') {
      if(key === `card:${c.id}:title`) return `theme:${c.id}:power:0`;
      const index = (c.items || []).findIndex(item => key === `card:${c.id}:${item.id}`);
      if(index >= 0 && index < 6) return `theme:${c.id}:power:${index+1}`;
    }
    return key;
  });
  if (!Array.isArray(value.cards)) selected = selected.map(name => {
    const item = cards[0].items.find(x => x.text === name);
    return item ? `card:${cards[0].id}:${item.id}` : name;
  });
  return {
    name: text(value.name, d.name, 80), playerName: text(value.playerName, '', 80), concept: text(value.concept, d.concept, 500),
    relationships: Array.isArray(value.relationships) ? value.relationships.filter(x => x && typeof x === 'object').slice(0, 20).map((x, i) => ({ id: id(x.id, 'relationship-' + i), companion: text(x.companion, '', 80), tag: text(x.tag, '', 80) })) : [],
    promise: count(value.promise, 5), quintessences: text(value.quintessences, '', 2000),
    schemaVersion: 4, heroThemes, quintessenceIds: Array.isArray(value.quintessenceIds) ? [...new Set(value.quintessenceIds.filter(id => quintessences.some(q => q.id === id)))] : [],
    actionExtras: Object.fromEntries(['power','weakness'].map(kind => [kind, Array.isArray(value.actionExtras?.[kind]) ? value.actionExtras[kind].filter(x => x && typeof x.text === 'string').slice(0,30).map((x,i) => ({ id: id(x.id, 'extra-'+i), text: text(x.text, '', 160) })) : []])),
    cards, selected, marks: Array.isArray(value.marks) ? [...new Set(value.marks.filter(x => Number.isInteger(x) && x >= 0 && x < 24))] : [],
    notes: text(value.notes, d.notes),
  };
}
export function makeStore(storage, scope, view) {
  const key = 'legend-mist-prototype:v1:' + JSON.stringify([scope.room, scope.player, view]);
  return {
    load() { try { return clean(JSON.parse(storage.getItem(key)), view); } catch { return defaults(view); } },
    save(state) { try { const before = storage.getItem(key); let oldSchema; try { oldSchema = JSON.parse(before)?.schemaVersion; } catch {} if (view === 'sheet' && before && oldSchema !== 4 && !storage.getItem(key + ':before-v4')) storage.setItem(key + ':before-v4', before); storage.setItem(key, JSON.stringify(clean(state, view))); return true; } catch { return false; } },
  };
}
