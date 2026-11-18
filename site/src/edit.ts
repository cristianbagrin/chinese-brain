export {};

// The page editor, bundled to site/public/edit.js. Only /edit loads it (the Worker adds it there,
// in place of the page's own scripts); the public pages never do. It works like
// cristianbagrin.com/edit:
// - Click any text to change it. Enter or clicking away keeps the change; Esc undoes it.
// - Point at anything and a small "Remove" button appears: for the text, and for the block around
//   it (an item, a section). A removed thing stays here, faded, so it can be put back.
// - Save sends every change at once. The password is asked once and remembered in this browser.
// Saved changes are on the site within a minute.

interface Conf {
  edits: Record<string, { to?: string; gone?: true }>;
  texts: Record<string, string>;
  blocks: string[];
  pages: [string, string][];
}

const PRE = '/edit';
const KEY = 'edit-key';
const root = document.documentElement;
const page = location.pathname.replace(/\/$/, '').slice(PRE.length) || (location.hostname.startsWith('account.') ? '/account' : '/brain');
let conf: Conf | null = null;
const raw: Record<string, string> = {};
const start: Record<string, string> = {};
let changed: Record<string, string | boolean | null> = {};
let editing: HTMLElement | null = null;
const savedGone: Record<string, boolean> = {};

const css = `
[data-edit] [data-copy]{cursor:text;border-radius:.2em;outline:1px dashed rgb(11 127 163/.45);outline-offset:2px}
[data-edit] [data-copy]:hover{background:rgb(11 127 163/.08)}
[data-edit] .now-editing{outline:2px solid #0b7fa3!important;background:#fff;color:#051230;white-space:pre-wrap}
[data-edit] .was-edited{outline:2px solid #b58500}
[data-edit] [data-gone]{opacity:.32;outline:2px dashed #c0392b!important;outline-offset:3px}
[data-edit] main :is(section,form,div,p)[hidden]{display:block!important}
[data-edit] main :is(a,span)[hidden]{display:inline!important}
.edit-hover{outline:2px solid #c0392b!important;outline-offset:3px}
.edit-tool{position:absolute;z-index:2147483600;display:flex;gap:.3rem;font:600 .78rem/1 system-ui,sans-serif}
.edit-tool button{padding:.42rem .6rem;border:0;border-radius:.4rem;background:#c0392b;color:#fff;cursor:pointer;white-space:nowrap;box-shadow:0 .3rem .8rem -.2rem rgb(0 0 0/.35)}
.edit-tool button.back{background:#1a6e4b}
.edit-bar{position:fixed;left:50%;bottom:1rem;z-index:2147483601;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem;
width:min(50rem,calc(100% - 2rem));padding:.75rem .8rem .75rem 1.1rem;border-radius:.9rem;background:#051230;color:#faf5df;
font:500 .92rem/1.35 system-ui,sans-serif;box-shadow:0 1rem 2rem -.6rem rgb(0 0 0/.4)}
.edit-bar .msg{flex:1 1 16rem}
.edit-bar button,.edit-bar select{font:600 .92rem/1 system-ui,sans-serif;padding:.65rem .95rem;border-radius:.55rem;border:0;cursor:pointer}
.edit-bar .save{background:#fff;color:#051230}.edit-bar .save:disabled{opacity:.45;cursor:default}
.edit-bar .undo-all,.edit-bar select{background:transparent;color:#faf5df;box-shadow:inset 0 0 0 1px rgb(255 255 255/.4)}
.edit-bar select option{color:#051230}
[data-edit] body{padding-bottom:6rem}`;
const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {}
  return null;
}
const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const byKey = (k: string) => all(`[data-copy="${k}"]`);

// ---------- the bar at the bottom ----------
const bar = document.createElement('div');
bar.className = 'edit-bar';
bar.innerHTML =
  '<span class="msg">Click any text to change it. Point at anything to remove it.</span>' +
  '<select class="pages" aria-label="Page to edit" hidden></select>' +
  '<button type="button" class="undo-all" hidden>Undo all</button><button type="button" class="save" disabled>Save</button>';
document.body.append(bar);
const msg = bar.querySelector<HTMLElement>('.msg')!;
const save = bar.querySelector<HTMLButtonElement>('.save')!;
const undoAll = bar.querySelector<HTMLButtonElement>('.undo-all')!;
const pages = bar.querySelector<HTMLSelectElement>('.pages')!;
function count() {
  const n = Object.keys(changed).length;
  save.disabled = !n;
  undoAll.hidden = !n;
  save.textContent = n ? `Save ${n} ${n === 1 ? 'change' : 'changes'}` : 'Save';
  if (n) msg.textContent = 'Not saved yet.';
}

// ---------- changing words ----------
function begin(node: HTMLElement) {
  if (editing === node) return;
  if (editing) finish(editing, true);
  hideTool();
  editing = node;
  node.contentEditable = 'true';
  node.classList.add('now-editing');
  node.focus();
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  const sel = getSelection()!;
  sel.removeAllRanges();
  sel.addRange(r);
  msg.textContent = 'Enter keeps it, Esc undoes it.';
}
function finish(node: HTMLElement, keep: boolean) {
  const k = node.dataset.copy!;
  const v = node.innerHTML.replace(/<br\s*\/?>\s*$/i, '').replace(/&nbsp;/g, ' ').trim();
  if (keep && v && v !== raw[k]) {
    raw[k] = v;
    if (v === start[k]) delete changed[k];
    else changed[k] = v;
  }
  node.removeAttribute('contenteditable');
  node.classList.remove('now-editing');
  for (const n of byKey(k)) {
    n.innerHTML = raw[k];
    n.classList.toggle('was-edited', k in changed);
  }
  editing = null;
  count();
}

// ---------- removing things ----------
const tool = document.createElement('div');
tool.className = 'edit-tool';
tool.hidden = true;
document.body.append(tool);
let target: HTMLElement | null = null;
let hideTimer = 0;
function kind(el: HTMLElement) {
  if (el.hasAttribute('data-copy') && !el.hasAttribute('data-block')) return 'text';
  const t = el.tagName.toLowerCase();
  return ({ section: 'section', figure: 'picture', li: 'item', blockquote: 'quote', article: 'article' } as Record<string, string>)[t] ?? 'block';
}
const keyOf = (el: HTMLElement) => el.getAttribute('data-block') ?? el.getAttribute('data-copy')!;
function setGone(el: HTMLElement, on: boolean) {
  const k = keyOf(el);
  for (const n of all(`[data-block="${k}"],[data-copy="${k}"]`)) n.toggleAttribute('data-gone', on);
  if (!!savedGone[k] === on) delete changed[`-${k}`];
  else changed[`-${k}`] = on ? true : null;
  count();
}
function showTool(el: HTMLElement) {
  clearTimeout(hideTimer);
  target?.classList.remove('edit-hover');
  target = el;
  tool.replaceChildren();
  const list: HTMLElement[] = [];
  for (let n: HTMLElement | null = el; n && list.length < 3; n = n.parentElement) if (n.matches('[data-copy],[data-block]')) list.push(n);
  for (const x of list) {
    const gone = x.hasAttribute('data-gone');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = gone ? 'Put back' : `Remove ${kind(x)}`;
    if (gone) b.className = 'back';
    b.addEventListener('mouseenter', () => {
      for (const h of all('.edit-hover')) h.classList.remove('edit-hover');
      x.classList.add('edit-hover');
    });
    b.addEventListener('mouseleave', () => x.classList.remove('edit-hover'));
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      x.classList.remove('edit-hover');
      setGone(x, !gone);
      showTool(el);
    });
    tool.append(b);
    if (gone) break; // nothing inside a removed thing needs its own button
  }
  const r = el.getBoundingClientRect();
  tool.hidden = false;
  tool.style.top = `${Math.max(0, r.top + scrollY - tool.offsetHeight - 4)}px`;
  tool.style.left = `${Math.max(4, Math.min(r.right + scrollX - tool.offsetWidth, root.clientWidth - tool.offsetWidth - 4))}px`;
}
function hideTool() {
  tool.hidden = true;
  target = null;
  for (const h of all('.edit-hover')) h.classList.remove('edit-hover');
}
document.addEventListener('mouseover', (e) => {
  if (!conf || editing) return;
  const t = e.target as HTMLElement;
  if (tool.contains(t)) return clearTimeout(hideTimer);
  if (bar.contains(t)) return;
  const el = t.closest<HTMLElement>('[data-copy],[data-block]');
  if (el && el !== target) showTool(el);
  else if (!el) {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideTool, 700);
  }
});

// ---------- loading ----------
fetch(`/api/copy?page=${encodeURIComponent(page)}`, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then((c: Conf) => {
    conf = c;
    for (const [k, e] of Object.entries(c.edits)) if (e.gone) savedGone[k] = true;
    for (const node of all('[data-copy]')) {
      const k = node.dataset.copy!;
      if (!(k in raw)) raw[k] = c.edits[k]?.to ?? c.texts[k] ?? node.innerHTML;
      start[k] = raw[k];
      node.tabIndex = 0;
      node.addEventListener('keydown', (e) => {
        if (editing !== node) {
          if (e.key === 'Enter' && e.target === node) {
            e.preventDefault();
            begin(node);
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          node.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(node, false);
        }
      });
      node.addEventListener('blur', () => {
        if (editing === node) finish(node, true);
      });
      node.addEventListener('paste', (e) => {
        if (editing !== node) return;
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*\n\s*/g, ' '));
      });
    }
    root.classList.add('editing');
    for (const [label, path] of c.pages) {
      const o = document.createElement('option');
      o.value = path;
      o.textContent = label;
      o.selected = path === page;
      pages.append(o);
    }
    pages.hidden = c.pages.length < 2;
    pages.addEventListener('change', () => {
      location.href = PRE + pages.value;
    });
  })
  .catch(() => {
    msg.textContent = 'Could not load the page’s words. Reload the page.';
  });

// In edit mode a click on text edits it instead of following a link or pressing a button.
document.addEventListener(
  'click',
  (e) => {
    const t = e.target as HTMLElement;
    if (!conf || bar.contains(t) || tool.contains(t)) return;
    if (t.closest('a,button,label,summary,[role=button]')) e.preventDefault();
    const node = t.closest<HTMLElement>('[data-copy]');
    if (node && editing !== node) begin(node);
  },
  true,
);
// Forms on the page (the account's) never send from here.
document.addEventListener('submit', (e) => e.preventDefault(), true);

undoAll.addEventListener('click', () => {
  if (editing) finish(editing, false);
  for (const k of Object.keys(changed)) {
    if (k.startsWith('-')) {
      const key = k.slice(1);
      for (const n of all(`[data-block="${key}"],[data-copy="${key}"]`)) n.toggleAttribute('data-gone', !!savedGone[key]);
      continue;
    }
    raw[k] = start[k];
    for (const n of byKey(k)) {
      n.innerHTML = raw[k];
      n.classList.remove('was-edited');
    }
  }
  changed = {};
  count();
  hideTool();
  msg.textContent = 'Back to the saved page.';
});

save.addEventListener('click', () => {
  if (editing) finish(editing, true);
  const key = store(KEY) || prompt('Password for editing this site:');
  if (!key) return;
  save.disabled = true;
  msg.textContent = 'Saving…';
  fetch('/api/copy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Edit-Key': key }, body: JSON.stringify({ page, changes: changed }) })
    .then((r) => {
      if (r.status === 401) {
        store(KEY, '');
        msg.textContent = 'Wrong password. Try Save again.';
        return count();
      }
      if (!r.ok) throw new Error(String(r.status));
      store(KEY, key);
      for (const k of Object.keys(changed)) {
        if (k.startsWith('-')) {
          if (changed[k]) savedGone[k.slice(1)] = true;
          else delete savedGone[k.slice(1)];
        } else start[k] = raw[k];
      }
      changed = {};
      count();
      for (const n of all('.was-edited')) n.classList.remove('was-edited');
      msg.textContent = 'Saved. The site shows it within a minute.';
    })
    .catch(() => {
      msg.textContent = 'Not saved: no connection. Try again.';
      count();
    });
});
addEventListener('beforeunload', (e) => {
  if (Object.keys(changed).length) e.preventDefault();
});
