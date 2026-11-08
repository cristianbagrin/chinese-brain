/**
 * Chrome build, YouTube top frame, document_start (isolated world): passes caption
 * bodies from the page hook (src/platform/yt-hook.ts) to the background, which caches
 * them for the tab and sends them back as the same `ytCaptions` message Firefox's
 * webRequest capture sends.
 */
import { CAPTION_TAG, isTimedText } from './yt-bridge.ts';

window.addEventListener('message', (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || d[CAPTION_TAG] !== 1) return;
  if (typeof d.url !== 'string' || typeof d.body !== 'string' || !isTimedText(d.url)) return;
  browser.runtime.sendMessage({ type: 'ytHook', url: d.url, body: d.body }).catch(() => {});
});
