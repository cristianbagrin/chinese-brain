import css from './help.css';

/**
 * A "?" that opens a short note right where the question comes up, instead of a link away.
 *
 *   <button type="button" class="help" popovertarget="helpGemini" aria-label="About Gemini">?</button>
 *   <div class="help-pop" id="helpGemini" popover>…</div>
 *
 * The browser does the hard parts (popover="auto"): one note open at a time, Esc or a click
 * elsewhere closes it, focus goes back to the "?", Tab moves from the "?" into the note. This adds
 * the placement: under the "?" (above it when there's no room), kept inside the window, growing
 * out of the "?" itself.
 */
export function helpPopovers(root: ParentNode = document) {
  if (!document.adoptedStyleSheets.includes(sheet)) {
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  for (const pop of root.querySelectorAll<HTMLElement>('.help-pop[popover]')) {
    if (pop.dataset.ready) continue;
    pop.dataset.ready = '1';
    const trigger = document.querySelector<HTMLElement>(`[popovertarget="${pop.id}"]`);
    if (!trigger) continue;
    if (!pop.hasAttribute('aria-label')) pop.setAttribute('aria-label', trigger.getAttribute('aria-label') ?? 'Help');
    pop.setAttribute('role', 'dialog');
    let raf = 0;
    const place = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => position(pop, trigger));
    };
    pop.addEventListener('beforetoggle', (e) => {
      const open = (e as ToggleEvent).newState === 'open';
      trigger.setAttribute('aria-expanded', String(open));
      if (open) {
        place();
        addEventListener('scroll', place, { capture: true, passive: true });
        addEventListener('resize', place);
      } else {
        removeEventListener('scroll', place, { capture: true });
        removeEventListener('resize', place);
      }
    });
    trigger.setAttribute('aria-expanded', 'false');
  }
}

const sheet = new CSSStyleSheet();
const GAP = 8;
const EDGE = 8;

function position(pop: HTMLElement, trigger: HTMLElement) {
  const t = trigger.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  // Below the "?", unless it only fits above.
  const below = t.bottom + GAP + h <= vh - EDGE || t.top - GAP - h < EDGE;
  const top = below ? t.bottom + GAP : t.top - GAP - h;
  // Starts at the "?" and runs right; moves left as far as it must to stay in the window.
  const left = Math.max(EDGE, Math.min(t.left - 10, vw - EDGE - w));
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.transformOrigin = `${Math.round(t.left + t.width / 2 - left)}px ${below ? 0 : h}px`;
}
