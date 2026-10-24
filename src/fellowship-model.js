import { makeTheme } from './theme-model.js';
export function fellowshipTheme(data) {
  const t = makeTheme('fellowship', 'fellowship'); t.might = data.might || 'origin';
  for (let i=0;i<7;i++) t.power[i] = { text: data[i===0?'name':'power'+i] || '', q: data['question'+i] || String.fromCharCode(65+i), scratched: data['spent'+i] || false };
  for (let i=0;i<3;i++) t.weakness[i] = { text: data[i===0?'weakness':'weakness'+i] || '', q: data['weakQuestion'+i] || String.fromCharCode(65+i), scratched: data['weakSpent'+i] || false };
  for (const key of ['quest','improve','abandon','milestone']) t[key] = data[key];
  t.improvements = data.improvementIds || []; t.notes = data.improvements || ''; return t;
}
export function fellowshipPatch(change) {
  if (change.kind) {
    const { kind, index, field, value } = change;
    const key = kind === 'power' ? (field === 'text' ? (index===0?'name':'power'+index) : field==='q'?'question'+index:'spent'+index)
      : field === 'text' ? (index===0?'weakness':'weakness'+index) : field==='q'?'weakQuestion'+index:'weakSpent'+index;
    return { [key]: value };
  }
  return { [change.field === 'improvements' ? 'improvementIds' : change.field === 'notes' ? 'improvements' : change.field]: change.value };
}
