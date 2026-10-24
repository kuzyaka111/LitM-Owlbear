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
