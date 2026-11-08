/**
 * The few background calls that differ between Firefox (MV2 background page) and Chrome
 * (MV3 service worker). `__CHROME__` is a build-time constant, so each bundle keeps one branch.
 */

type MenuProps = browser.menus._CreateCreateProperties;

/** The selection menu item. Chrome keeps items across service-worker restarts, so it's recreated cleanly. */
export function createMenu(props: MenuProps) {
  if (__CHROME__) {
    void browser.contextMenus
      .removeAll()
      .then(() => browser.contextMenus.create(props as browser.contextMenus._CreateCreateProperties, () => void browser.runtime.lastError));
    return;
  }
  browser.menus.create(props);
}

export function onMenuClicked(fn: (info: browser.menus.OnClickData, tab?: browser.tabs.Tab) => void) {
  if (__CHROME__) browser.contextMenus.onClicked.addListener(fn as never);
  else browser.menus.onClicked.addListener(fn);
}

/** Start the content script in a frame it doesn't run in on its own. */
export async function injectContent(tabId: number, frameId: number) {
  if (__CHROME__) {
    await chromeScripting().executeScript({ target: { tabId, frameIds: [frameId] }, files: ['content.js'] });
    return;
  }
  await browser.tabs.executeScript(tabId, { file: '/content.js', frameId });
}

/** Page CSS no page CSP can block (the ::highlight rules). */
export async function insertCSS(tabId: number, frameId: number, css: string) {
  if (__CHROME__) {
    await chromeScripting().insertCSS({ target: { tabId, frameIds: [frameId] }, css });
    return;
  }
  await browser.tabs.insertCSS(tabId, { code: css, frameId });
}

/**
 * Keep the service worker running while a long job (a Gemini transcript: minutes) is in
 * flight; Chrome stops one that makes no extension call for 30 seconds. Nothing on Firefox.
 */
export function keepAlive<T>(job: Promise<T>): Promise<T> {
  if (!__CHROME__) return job;
  const timer = setInterval(() => void browser.runtime.getPlatformInfo().catch(() => {}), 20_000);
  return job.finally(() => clearInterval(timer));
}

/** Chrome's messages are JSON: audio travels as base64. */
export function audioOut(buf: ArrayBuffer): ArrayBuffer | string {
  if (!__CHROME__) return buf;
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The other end of audioOut, in the content script. */
export function audioIn(data: ArrayBuffer | string): ArrayBuffer {
  if (typeof data !== 'string') return data.slice(0);
  const s = atob(data);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

interface ChromeScripting {
  executeScript(o: { target: { tabId: number; frameIds?: number[] }; files: string[] }): Promise<unknown>;
  insertCSS(o: { target: { tabId: number; frameIds?: number[] }; css: string }): Promise<void>;
}
const chromeScripting = () => (browser as unknown as { scripting: ChromeScripting }).scripting;
