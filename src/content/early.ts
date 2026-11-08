// Runs at document_start, before the page's own scripts, so these are the first key
// listeners on the page: the main content script (sharing this window) fills in `fn`.
import { guardKeys } from './keys.ts';

const w = window as Window & { __cbKeys?: { fn?: (e: KeyboardEvent) => void } };
if (!w.__cbKeys) {
  w.__cbKeys = {};
  guardKeys(window, w.__cbKeys);
}
