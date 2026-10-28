// Runs at document_start, before the page's own scripts, so this is the first keydown
// listener on the page: the main content script (sharing this window) fills in `fn`.
const w = window as Window & { __cbKeys?: { fn?: (e: KeyboardEvent) => void } };
if (!w.__cbKeys) {
  const keys: { fn?: (e: KeyboardEvent) => void } = {};
  w.__cbKeys = keys;
  window.addEventListener('keydown', (e) => keys.fn?.(e), true);
}
