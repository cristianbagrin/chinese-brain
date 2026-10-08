/**
 * Captures the caption tracks the YouTube player itself downloads
 * (Firefox-only webRequest.filterResponseData). The body passes through
 * untouched; a copy goes to the tab's content script. We never call the
 * timedtext endpoint ourselves, so the player's own tokens keep working.
 */
const cache = new Map<number, { url: string; body: string; at: number }[]>();

export function startCaptionCapture() {
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return {};
      const filter = browser.webRequest.filterResponseData(details.requestId);
      const chunks: ArrayBuffer[] = [];
      filter.ondata = (e) => {
        chunks.push(e.data);
        filter.write(e.data);
      };
      filter.onstop = () => {
        filter.close();
        const body = new TextDecoder('utf-8').decode(concat(chunks));
        const item = { url: details.url, body, at: Date.now() };
        const list = (cache.get(details.tabId) ?? []).filter((x) => Date.now() - x.at < 30 * 60_000);
        list.push(item);
        cache.set(details.tabId, list.slice(-12));
        browser.tabs
          .sendMessage(details.tabId, { type: 'ytCaptions', url: details.url, body }, { frameId: details.frameId })
          .catch(() => {});
      };
      filter.onerror = () => {
        try {
          filter.disconnect();
        } catch {
          /* already gone */
        }
      };
      return {};
    },
    { urls: ['*://*.youtube.com/api/timedtext*'] },
    ['blocking'],
  );
  browser.tabs.onRemoved.addListener((tabId) => cache.delete(tabId));
}

/** Tracks captured for this tab before its content script was listening. */
export function cachedCaptions(tabId: number) {
  return cache.get(tabId) ?? [];
}

function concat(chunks: ArrayBuffer[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), off);
    off += c.byteLength;
  }
  return out;
}
