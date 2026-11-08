/**
 * Chrome build, background: the caption bodies the page hook copied (src/platform/yt-hook.ts
 * via yt-relay.ts) go back to the tab as the same `ytCaptions` message Firefox's
 * webRequest capture (src/background/youtube.ts) sends, and are kept for `ytCached`.
 * The cache is mirrored in storage.session, so it outlives the service worker being stopped.
 */
import { isTimedText } from './yt-bridge.ts';

type Item = { url: string; body: string; at: number };
const PREFIX = 'ytc:';
const cache = new Map<number, Item[]>();
const fresh = (list: Item[]) => list.filter((x) => Date.now() - x.at < 30 * 60_000);

/** What an earlier run of the service worker kept (read once, on first use). */
let restoring: Promise<void> | undefined;
const restored = () =>
  (restoring ??= browser.storage.session
    .get(null)
    .then((all) => {
      for (const [k, v] of Object.entries(all)) if (k.startsWith(PREFIX)) cache.set(Number(k.slice(PREFIX.length)), v as Item[]);
    })
    .catch(() => {}));

export function startHookCapture() {
  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    const m = msg as { type?: string; url?: unknown; body?: unknown };
    if (m?.type !== 'ytHook') return undefined;
    const tabId = sender.tab?.id;
    if (tabId == null || typeof m.url !== 'string' || typeof m.body !== 'string' || !isTimedText(m.url)) return undefined;
    const item = { url: m.url, body: m.body, at: Date.now() };
    void restored().then(() => {
      const list = [...fresh(cache.get(tabId) ?? []), item].slice(-12);
      cache.set(tabId, list);
      return browser.storage.session.set({ [PREFIX + tabId]: list }).catch(() => {});
    });
    browser.tabs
      .sendMessage(tabId, { type: 'ytCaptions', url: m.url, body: m.body }, { frameId: sender.frameId ?? 0 })
      .catch(() => {});
    return Promise.resolve(true);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    cache.delete(tabId);
    void browser.storage.session.remove(PREFIX + tabId).catch(() => {});
  });
}

/** Tracks captured for this tab before its content script was listening. */
export async function cachedHookCaptions(tabId: number): Promise<Item[]> {
  await restored();
  return fresh(cache.get(tabId) ?? []);
}
