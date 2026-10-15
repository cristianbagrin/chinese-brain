/** True while the user is typing (also inside shadow-DOM inputs, and during IME composition). */
export function isTyping(e: KeyboardEvent): boolean {
  if (e.isComposing) return true;
  const t = (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
  // Our card's text box sits in a closed shadow root: the card host says so while it has focus.
  return !!t && (t.isContentEditable || !!t.hasAttribute?.('data-typing') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''));
}
