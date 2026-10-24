import catalog from './themebooks.json' with { type: 'json' };
import { themes as demos } from './demo.js';
export const themebooks = catalog.themebooks;
export const quintessences = catalog.quintessences;
export const mightNames = { origin: 'Истоки', adventure: 'Приключение', greatness: 'Величие' };
const storyBook = {id:'story',name:'Сюжетная тема',might:'variable',power:[],weakness:[],improvements:[]};
export const getBook = id => id==='story'?storyBook:themebooks.find(b => b.id === id) || themebooks[0];
export const allImprovements = [...themebooks.flatMap(b => b.improvements), ...quintessences];
export const improvementById = id => allImprovements.find(x => x.id === id);
const text = (v, limit, fallback = '') => typeof v === 'string' ? v.slice(0, limit) : fallback;
const count = v => Number.isInteger(v) ? Math.max(0, Math.min(3, v)) : 0;
export function makeTheme(bookId = 'past', id = crypto.randomUUID()) {
  const book = getBook(bookId);
  return { id, bookId: book.id, might: book.might === 'variable' ? 'origin' : book.might,
    power: Array.from({ length: 7 }, (_, i) => ({ text: '', q: String.fromCharCode(65 + i), scratched: false })),
    weakness: Array.from({ length: 3 }, (_, i) => ({ text: '', q: String.fromCharCode(65 + i), scratched: false })),
    quest: '', improve: 0, abandon: 0, milestone: 0, improvements: [], storyImprovements: Array.from({length:5},()=>({text:'',active:false})), notes: '' };
}
export function cleanTheme(value, fallbackId = 'theme') {
  const v = value && typeof value === 'object' ? value : {};
  const t = makeTheme(v.bookId, typeof v.id === 'string' ? v.id.slice(0, 80) : fallbackId);
  t.might = Object.hasOwn(mightNames, v.might) ? v.might : t.might;
  for (const kind of ['power', 'weakness']) t[kind] = t[kind].map((slot, i) => {
    const source = v[kind]?.[i]; const valid = getBook(t.bookId)[kind].some(q => q.letter === source?.q);
    return { text: text(source?.text, 160), q: valid ? source.q : slot.q, scratched: source?.scratched === true };
  });
  t.quest = text(v.quest, 1000); t.notes = text(v.notes, 5000);
  for (const k of ['improve', 'abandon', 'milestone']) t[k] = count(v[k]);
  t.improvements = Array.isArray(v.improvements) ? [...new Set(v.improvements.filter(x => themebooks.some(b => b.improvements.some(i => i.id === x))))] : [];
  t.storyImprovements = Array.from({length:Math.max(5,Math.min(30,v.storyImprovements?.length||0))},(_,i)=>({text:text(v.storyImprovements?.[i]?.text,160),active:v.storyImprovements?.[i]?.active===true}));
  return t;
}
export function asStoryTheme(value) {
  const t=cleanTheme(value);
  if(t.bookId!=='story') {
    const previous=t.improvements.map(improvementById).filter(Boolean).map(x=>({text:x.name,active:true}));
    t.storyImprovements=[...previous,...t.storyImprovements.filter(x=>x.text)];
    while(t.storyImprovements.length<5)t.storyImprovements.push({text:'',active:false});
  }
  t.bookId='story';t.improvements=[];return t;
}
export function initialThemes(marks = []) {
  return demos.map((d, i) => {
    const t = makeTheme(['past', 'skill', 'people', 'personality'][i], 'hero-' + i);
    t.power[0].text = d.name.replaceAll('<br>', ' '); d.tags.forEach((tag, j) => { t.power[j + 1].text = tag; });
    t.weakness[0].text = d.weakness; t.quest = d.motive; t.notes = d.story;
    t.improve = marks.filter(x => x >= i * 6 && x < i * 6 + 3).length;
    t.abandon = marks.filter(x => x >= i * 6 + 3 && x < i * 6 + 6).length;
    return t;
  });
}
export function legacyTheme(card) {
  const book = themebooks.find(b => b.name.toLowerCase() === (card.typeLabel || '').toLowerCase() || b.originalName.toLowerCase() === (card.typeLabel || '').toLowerCase());
  const t = makeTheme(book?.id || 'possessions', card.id); t.power[0].text = card.title || '';
  (card.items || []).slice(0, 6).forEach((item, i) => { t.power[i + 1].text = item.text; });
  t.weakness[0].text = card.weakness || ''; t.quest = card.quest || ''; t.notes = (card.typeLabel && !book ? 'Прежний тип темы: ' + card.typeLabel + '\n' : '') + (card.notes || '');
  for (const k of ['improve','abandon','milestone']) t[k] = count(card[k]);
  return t;
}
export const tagKey = (theme, kind, index) => `theme:${theme.id}:${kind}:${index}`;
