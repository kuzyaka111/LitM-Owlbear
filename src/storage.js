const text = (value, fallback = '', limit = 5000) => typeof value === 'string' ? value.slice(0, limit) : fallback;
const strings = (value, fallback, count = 50) => Array.isArray(value)
  ? [...new Set(value.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 160)).filter(Boolean))].slice(0, count)
  : [...fallback];
const count = (value, max) => Number.isInteger(value) ? Math.max(0, Math.min(max, value)) : 0;
export const makeId = () => globalThis.crypto.randomUUID();
const id = (value, fallback) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : fallback;
export function newCard(type) {
  return { id: makeId(), type, title: type === 'theme' ? 'Новая тема' : 'Новый рюкзак', typeLabel: '', items: [], weakness: '', quest: '', notes: '', improve: 0, abandon: 0, milestone: 0 };
}
export function defaults(view) {
  if (view === 'gm') return { scene: ['Густой туман', 'Старый каменный мост'], notes: 'Мельник прячет письмо под настилом. Он согласится поговорить, когда стража уйдёт.' };
  return {
    name: 'Эрин из Вересковой долины', playerName: '', concept: 'Следопыт, который однажды обещал вернуться',
    relationships: [], promise: 0, quintessences: '', selected: [], marks: [],
    notes: 'У старого моста нас должен ждать мельник. Он знает, кто видел пропавший караван последним.',
    cards: [{ id: 'original-backpack', type: 'bag', title: 'Дорожный рюкзак', typeLabel: '',
      items: ['Дорожный плащ', 'Верёвка', 'Кремень и огниво'].map((value, i) => ({ id: 'item-' + i, text: value })),
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
      return { id: itemId, text: text(x.text, '', 80) };
    }) : [];
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
  if (!Array.isArray(value.cards) && Array.isArray(value.bag)) cards[0].items = strings(value.bag, [], 50).map((name, i) => ({ id: 'item-' + i, text: name.slice(0, 80) }));
  let selected = strings(value.selected, [], 200);
  if (!Array.isArray(value.cards)) selected = selected.map(name => {
    const item = cards[0].items.find(x => x.text === name);
    return item ? `card:${cards[0].id}:${item.id}` : name;
  });
  return {
    name: text(value.name, d.name, 80), playerName: text(value.playerName, '', 80), concept: text(value.concept, d.concept, 500),
    relationships: Array.isArray(value.relationships) ? value.relationships.filter(x => x && typeof x === 'object').slice(0, 20).map((x, i) => ({ id: id(x.id, 'relationship-' + i), companion: text(x.companion, '', 80), tag: text(x.tag, '', 80) })) : [],
    promise: count(value.promise, 5), quintessences: text(value.quintessences, '', 2000),
    cards, selected, marks: Array.isArray(value.marks) ? [...new Set(value.marks.filter(x => Number.isInteger(x) && x >= 0 && x < 24))] : [],
    notes: text(value.notes, d.notes),
  };
}
export function makeStore(storage, scope, view) {
  const key = 'legend-mist-prototype:v1:' + JSON.stringify([scope.room, scope.player, view]);
  return {
    load() { try { return clean(JSON.parse(storage.getItem(key)), view); } catch { return defaults(view); } },
    save(state) { try { storage.setItem(key, JSON.stringify(clean(state, view))); return true; } catch { return false; } },
  };
}
