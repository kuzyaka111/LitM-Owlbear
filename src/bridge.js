export const TOOL_ID = 'io.github.kuzyaka111.legend-mist/gm-tool';
export const MODAL_ID = 'io.github.kuzyaka111.legend-mist/gm-window';

/** Uses the document URL so this also works under a GitHub Pages project path. */
export function pageUrl(file, base) {
  return new URL(file, base).href;
}

export function createGMTool(obr, base) {
  return {
    id: TOOL_ID,
    icons: [{
      icon: pageUrl('./gm.svg', base),
      label: 'Панель ведущего',
      filter: { roles: ['GM'] },
    }],
    onClick() {
      // Do not return true: opening this window must not activate a map tool.
      void openGM(obr, base).catch(console.error);
    },
  };
}

export async function openGM(obr, base) {
  if (await obr.player.getRole() !== 'GM') return false;
  if (!await obr.scene.isReady()) return false;
  await obr.modal.open({
    id: MODAL_ID,
    url: pageUrl('./gm.html', base),
    width: 620,
    height: 730,
  });
  return true;
}

/** Serialized lifecycle prevents a stale registration after role/scene changes. */
export function watchGMTool(obr, base) {
  let installed = false;
  let alive = true;
  let queue = Promise.resolve();
  const refresh = () => {
    queue = queue.then(async () => {
      if (!alive) return;
      const [role, ready] = await Promise.all([obr.player.getRole(), obr.scene.isReady()]);
      const needed = role === 'GM' && ready;
      if (needed && !installed) {
        await obr.tool.create(createGMTool(obr, base));
        installed = true;
      } else if (!needed && installed) {
        await obr.tool.remove(TOOL_ID);
        installed = false;
        await obr.modal.close(MODAL_ID);
      }
    }).catch(console.error);
    return queue;
  };
  const unsubscribePlayer = obr.player.onChange(refresh);
  const unsubscribeScene = obr.scene.onReadyChange(refresh);
  void refresh();
  return {
    refresh,
    async dispose() {
      alive = false;
      unsubscribePlayer(); unsubscribeScene();
      await queue;
      if (installed) { await obr.tool.remove(TOOL_ID); installed = false; }
    },
  };
}

export const SHEET_MODAL_ID = 'io.github.kuzyaka111.legend-mist/sheet-window';

export const SHEET_POPOVER_ID = SHEET_MODAL_ID;
export async function sheetBounds(obr, count = 4, hasSelection = false, requestedHeight = 650, minimumWidth = 480) {
  const [width, height] = await Promise.all([obr.viewport.getWidth(), obr.viewport.getHeight()]);
  const cards = count + (hasSelection ? 1 : 0);
  return { width: Math.max(240, Math.min(Math.max(minimumWidth, cards * 224 + (cards - 1) * 12 + 32), width - 32)), height: Math.max(160, Math.min(requestedHeight, height - 116)) };
}
export async function openSheet(obr, base) {
  const url = new URL('./index.html', base); url.searchParams.set('surface', 'sheet');
  // Fetch a fresh HTML entry point; hashed JS/CSS remain cacheable.
  url.searchParams.set('opened', String(Date.now()));
  const size = await sheetBounds(obr, 3);
  await obr.popover.open({ id: SHEET_POPOVER_ID, url: url.href, ...size,
    anchorReference: 'POSITION', anchorPosition: { left: 16, top: 96 },
    anchorOrigin: { horizontal: 'LEFT', vertical: 'TOP' }, transformOrigin: { horizontal: 'LEFT', vertical: 'TOP' },
    marginThreshold: 0, hidePaper: true, disableClickAway: true });
}

/** The normal extension action remains the entry point; the visible sheet has no host paper. */
export function watchSheetAction(obr, base, onError = console.error) {
  let pending = null, alive = true, revision = 0;
  const launch = () => {
    if (pending || !alive) return pending;
    pending = openSheet(obr, base).then(() => obr.action.close()).catch(onError).finally(() => { pending = null; });
    return pending;
  };
  const off = obr.action.onOpenChange(open => { ++revision; if (open) void launch(); });
  const before = revision;
  void obr.action.isOpen().then(open => { if (alive && before === revision && open) return launch(); }).catch(onError);
  return { dispose() { alive = false; off(); } };
}
