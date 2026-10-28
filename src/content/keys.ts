/** True while the user is typing (also inside shadow-DOM inputs, and during IME composition). */
export function isTyping(e: KeyboardEvent): boolean {
  if (e.isComposing) return true;
  const t = target(e);
  // Our card's text box sits in a closed shadow root: the card host says so while it has focus.
  return !!t && (t.isContentEditable || !!t.hasAttribute?.('data-typing') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''));
}

function target(e: KeyboardEvent): HTMLElement | null {
  return (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
}

/** When a key was last typed into a page's text box (Notion, a search field). */
let typedAt = 0;

/**
 * Should the open card take this key? Not while typing in a page's text box, except the
 * card's digits and Esc when nothing was typed there since the card appeared: pointing at
 * a word and pressing 2 means the card, not a "2" in the Notion page. Never inside the
 * card's own text box, nor while composing.
 */
export function cardTakes(e: KeyboardEvent, shownAgo: number): boolean {
  if (!isTyping(e)) return true;
  if (e.isComposing || target(e)?.hasAttribute?.('data-typing')) return false;
  if (/^([0-3]|Escape)$/.test(e.key) && shownAgo < Date.now() - typedAt) return true;
  if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) typedAt = Date.now();
  return false;
}

/**
 * Listen for key presses ahead of the page. The early script (run at document_start, before
 * any of the page's own scripts) holds the first keydown listener on the page and hands each
 * key to us: YouTube and Notion otherwise take keys like 1 2 3 before we see them. Without
 * it (the script injected into an already open tab), a listener of our own does.
 */
export function onKeydown(fn: (e: KeyboardEvent) => void) {
  const w = window as Window & { __cbKeys?: { fn?: (e: KeyboardEvent) => void } };
  if (w.__cbKeys) w.__cbKeys.fn = fn;
  else window.addEventListener('keydown', fn, true);
}
