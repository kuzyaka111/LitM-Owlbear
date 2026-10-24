export const FELLOWSHIP_PREFIX = 'io.github.kuzyaka111.legend-mist/fellowship/';
export const fellowshipLimits = { name: 80, power1: 80, power2: 80, weakness: 160, quest: 400, improvements: 800 };
export const fellowshipDefaults = () => ({ name: '', power1: '', power2: '', weakness: '', quest: '', improvements: '', improve: 0, abandon: 0, milestone: 0, spent0: false, spent1: false, spent2: false });
function normalize(field, value) {
  if (field in fellowshipLimits) return typeof value === 'string' ? value.slice(0, fellowshipLimits[field]) : '';
  if (field.startsWith('spent')) return value === true;
  return Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;
}
function fromMetadata(metadata) {
  const result = fellowshipDefaults();
  for (const field of Object.keys(result)) result[field] = normalize(field, metadata[FELLOWSHIP_PREFIX + field]);
  return result;
}

/** Each editable field has its own key: concurrent edits to different fields do not overwrite one another. */
export function makeFellowshipStore(room) {
  let state = fellowshipDefaults(), ready = false, disposed = false, revision = 0, unlisten, queue = Promise.resolve();
  const listeners = new Set();
  const publish = () => listeners.forEach(fn => fn({ ...state }, ready));
  const receive = metadata => { if (disposed) return; ++revision; state = fromMetadata(metadata); ready = true; publish(); };
  return {
    async start() {
      if (!unlisten) unlisten = room.onMetadataChange(receive);
      const before = revision;
      const metadata = await room.getMetadata();
      if (!disposed && before === revision) receive(metadata);
    },
    subscribe(fn) { listeners.add(fn); fn({ ...state }, ready); return () => listeners.delete(fn); },
    update(patch) {
      const update = {};
      for (const field of Object.keys(fellowshipDefaults())) if (Object.hasOwn(patch, field)) update[FELLOWSHIP_PREFIX + field] = normalize(field, patch[field]);
      const write = async () => {
        if (!ready || disposed) throw new Error('Карточка ещё не подключена. Открой вкладку снова.');
        const latest = await room.getMetadata();
        const merged = { ...latest, ...update };
        if (new TextEncoder().encode(JSON.stringify(merged)).length >= 16000) throw new Error('В комнате недостаточно места для общей карточки. Сократи текст или попроси ведущего освободить место.');
        await room.setMetadata(update);
        // Read back the complete authoritative state after a successful write.
        const before = revision;
        const saved = await room.getMetadata();
        if (!disposed && before === revision) receive(saved);
      };
      const task = queue.then(write); queue = task.catch(() => {}); return task;
    },
    dispose() { disposed = true; unlisten?.(); listeners.clear(); },
  };
}

/** Preview is explicitly local; live rooms never fall back to a private copy. */
export function makePreviewFellowship(storage) {
  const key = 'legend-mist-fellowship-preview:v1';
  const listeners = new Set();
  const read = () => { try { return JSON.parse(storage.getItem(key)) || {}; } catch { return {}; } };
  const room = {
    async getMetadata() { return read(); },
    onMetadataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async setMetadata(update) { const next = { ...read(), ...update }; storage.setItem(key, JSON.stringify(next)); listeners.forEach(fn => fn(next)); },
  };
  return makeFellowshipStore(room);
}
