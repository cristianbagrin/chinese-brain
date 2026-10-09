/** True while the user is typing (also inside shadow-DOM inputs, and during IME composition). */
export function isTyping(e: KeyboardEvent): boolean {
  if (e.isComposing) return true;
  const t = (e.composedPath?.()[0] ?? e.target) as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''));
}
