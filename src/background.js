import OBR from '@owlbear-rodeo/sdk';
import { watchGMTool } from './bridge.js';

if (OBR.isAvailable) {
  OBR.onReady(() => {
    const controller = watchGMTool(OBR, window.location.href);
    window.addEventListener('pagehide', () => { void controller.dispose(); }, { once: true });
  });
}
