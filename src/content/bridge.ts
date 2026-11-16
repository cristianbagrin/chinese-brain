import { state } from './state.ts';

/**
 * The website's dashboard is the word list. On our own site (and nowhere else) the page can ask
 * the extension for the words in this browser and change them, so the list works without an
 * account and nothing is uploaded for it. Only the requests below are passed on; settings and
 * API keys are not among them.
 */
const PASSED = new Set(['allData', 'setStatus', 'getWord', 'importWords', 'importList', 'account', 'syncNow']);

export function startBridge() {
  if (location.origin !== __SITE__ || window !== window.top) return;
  window.addEventListener('message', async (e) => {
    const d = e.data as { cb?: string; id?: number; msg?: { type?: string; at?: number } } | undefined;
    if (e.source !== window || e.origin !== location.origin || d?.cb !== 'req' || typeof d.id !== 'number') return;
    const reply = (result: unknown, error?: string) => window.postMessage({ cb: 'res', id: d.id, result, error }, location.origin);
    try {
      const m = d.msg;
      if (m?.type === 'prefs') reply({ sounds: state.settings.sounds, version: browser.runtime.getManifest().version });
      // When "Download new" last ran: the export picks up from there.
      else if (m?.type === 'mark') {
        if (typeof m.at === 'number') await browser.storage.local.set({ lastExportAt: m.at });
        reply(((await browser.storage.local.get('lastExportAt')).lastExportAt as number | undefined) ?? 0);
      } else if (m?.type && PASSED.has(m.type)) reply(await browser.runtime.sendMessage(m));
      else reply(undefined, 'Not something the page can ask for.');
    } catch (err) {
      reply(undefined, String(err instanceof Error ? err.message : err));
    }
  });
  // The page waits for this before it decides where the list comes from.
  document.documentElement.dataset.cbExt = browser.runtime.getManifest().version;
  window.postMessage({ cb: 'ready' }, location.origin);
}
