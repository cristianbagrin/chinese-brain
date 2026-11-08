/** True while the user is typing (also inside shadow-DOM inputs, and during IME composition). */
export function isTyping(e: KeyboardEvent): boolean {
  if (e.isComposing) return true;
  const t = target(e);
  // Our card's text box sits in a closed shadow root: the card host says so while it has focus.
  return !!t && (t.isContentEditable || !!t.hasAttribute?.('data-typing') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''));
}

function target(e: Event): HTMLElement | null {
  return (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
}

/** Typing into one of our own text boxes (the card's sentence editor). */
export function inOwnBox(e: Event): boolean {
  return !!target(e)?.hasAttribute?.('data-typing');
}

/** When a key was last typed into a page's text box (Notion, a search field). */
let typedAt = 0;

/**
 * Should the open card take this key? Not while typing in a page's text box, except the
 * card's digits and Esc when nothing was typed there since the card appeared, or while the
 * pointer is on the card: pointing at a word and pressing 2 means the card, not a "2" in
 * the Notion page or the YouTube description. Never inside the card's own text box, nor
 * while composing.
 */
export function cardTakes(e: KeyboardEvent, shownAgo: number, onCard = false): boolean {
  if (!isTyping(e)) return true;
  if (e.isComposing || inOwnBox(e)) return false;
  if (onCard && /^([0-3]|[vi]|Escape)$/.test(e.key)) return true;
  if (/^([0-3]|Escape)$/.test(e.key) && shownAgo < Date.now() - typedAt) return true;
  if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) typedAt = Date.now();
  return false;
}

type Keys = { fn?: (e: KeyboardEvent) => void };

/**
 * The page's first key listeners (window, capture phase): every keydown goes to `keys.fn`
 * first, and keys typed into our own text box never reach the page at all. Pages listen
 * on document in the capture phase too (YouTube Studio's dialogs close on Esc, editors
 * take shortcuts), and they would otherwise see those keys before the box does.
 */
export function guardKeys(w: Window, keys: Keys) {
  w.addEventListener(
    'keydown',
    (e) => {
      keys.fn?.(e);
      if (inOwnBox(e)) e.stopImmediatePropagation();
    },
    true,
  );
  for (const t of ['keyup', 'keypress']) {
    w.addEventListener(t, (e) => inOwnBox(e) && e.stopImmediatePropagation(), true);
  }
}

/**
 * Listen for key presses ahead of the page. The early script (run at document_start, before
 * any of the page's own scripts) holds the first keydown listener on the page and hands each
 * key to us: YouTube and Notion otherwise take keys like 1 2 3 before we see them. Without
 * it (the script injected into an already open tab), a guard of our own does.
 */
export function onKeydown(fn: (e: KeyboardEvent) => void) {
  const w = window as Window & { __cbKeys?: Keys };
  if (!w.__cbKeys) {
    w.__cbKeys = {};
    guardKeys(window, w.__cbKeys);
  }
  w.__cbKeys.fn = fn;
}
