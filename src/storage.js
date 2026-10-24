const text = (value, fallback, limit = 5000) => typeof value === 'string' ? value.slice(0, limit) : fallback;
const strings = (value, fallback, count = 50) => Array.isArray(value)
  ? [...new Set(value.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 80)).filter(Boolean))].slice(0, count)
  : [...fallback];

export function defaults(view) {
  return view === 'gm'
    ? { scene: ['Густой туман', 'Старый каменный мост'], notes: 'Мельник прячет письмо под настилом. Он согласится поговорить, когда стража уйдёт.' }
    : { name: 'Эрин из Вересковой долины', bag: ['Дорожный плащ', 'Верёвка', 'Кремень и огниво'], selected: [], marks: [], notes: 'У старого моста нас должен ждать мельник. Он знает, кто видел пропавший караван последним.' };
}

export function clean(value, view) {
  const d = defaults(view);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return d;
  if (view === 'gm') return { scene: strings(value.scene, d.scene, 30), notes: text(value.notes, d.notes) };
  return {
    name: text(value.name, d.name, 80),
    bag: strings(value.bag, d.bag),
    selected: strings(value.selected, []),
    marks: Array.isArray(value.marks) ? [...new Set(value.marks.filter(x => Number.isInteger(x) && x >= 0 && x < 24))] : [],
    notes: text(value.notes, d.notes),
  };
}

export function makeStore(storage, scope, view) {
  const key = 'legend-mist-prototype:v1:' + JSON.stringify([scope.room, scope.player, view]);
  return {
    load() {
      try { return clean(JSON.parse(storage.getItem(key)), view); }
      catch { return defaults(view); }
    },
    save(state) {
      try { storage.setItem(key, JSON.stringify(clean(state, view))); return true; }
      catch { return false; }
    },
  };
}
