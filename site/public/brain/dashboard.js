// Your word list on the web: the same data the extension syncs (cb.js has the API).
const STAMPS = [['fresh', '新', 'Fresh'], ['learning', '學', 'Learning'], ['known', '熟', 'Known']];
const el = (tag, cls, ...kids) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k != null && k !== false) e.append(k);
  return e;
};

let words = new Map(); // word -> record
let saved = new Map(); // word -> saved sentences
let seq = 0;
let filter = 'fresh';
let shown = 200;

/** Read everything this account holds (in pages), then keep `seq` for later changes. */
async function load() {
  for (let more = true; more; ) {
    const res = await api('sync', { since: seq, changes: [] });
    take(res.changes);
    seq = res.seq;
    more = res.more;
  }
}

function take(changes) {
  for (const c of changes) {
    const [kind, key] = [c.k.slice(0, c.k.indexOf(':')), c.k.slice(c.k.indexOf(':') + 1)];
    const map = kind === 'w' ? words : kind === 'sav' ? saved : null;
    if (!map) continue;
    if (c.v == null) map.delete(key);
    else map.set(key, c.v);
  }
}

/** Stamp or remove a word here; the extension picks it up at its next sync. */
async function change(w, status) {
  const now = Date.now();
  const old = words.get(w);
  const v = status ? { ...old, s: status, updated: now, hist: [...(old.hist ?? []), { t: now, s: status }] } : null;
  if (v) words.set(w, v);
  else words.delete(w);
  render();
  try {
    const res = await api('sync', { since: seq, changes: [{ k: `w:${w}`, v, t: now }] });
    take(res.changes);
    seq = res.seq;
    say('msg', '');
  } catch (e) {
    if (old) words.set(w, old);
    say('msg', e.message);
  }
  render();
}

/** The sentence a word was met in: your saved edit of it, else the first that has the word. */
function sentence(r) {
  const mine = (saved.get(r.w) ?? [])[0];
  if (mine) return { text: mine.zh, en: mine.en };
  const c = (r.ctx ?? []).find((x) => x.text?.includes(r.w) || (x.q && x.text?.includes(x.q)));
  return c ? { text: c.text.split(' — ')[0].slice(0, 120), url: c.url, t: c.t } : null;
}

function source(url, t) {
  try {
    const u = new URL(url);
    const yt = /youtube\.com$/.test(u.hostname);
    const a = el('a', 'src', yt ? 'YouTube' : u.hostname.replace(/^www\./, ''));
    a.href = yt && t ? `${url}&t=${Math.floor(t)}s` : url;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  } catch {
    return null;
  }
}

function render() {
  const all = [...words.values()];
  const n = (s) => all.filter((w) => w.s === s).length;
  $('app').hidden = !all.length;
  $('empty').hidden = !!all.length;
  $('loading').hidden = true;
  if (!all.length) return;

  // Tiles: your three piles and this week's work.
  const week = Date.now() - 7 * 86_400_000;
  const stamped = all.filter((w) => w.updated > week).length;
  $('tiles').replaceChildren(
    ...STAMPS.map(([s, zh, label]) => el('div', `tile ${s}`, el('span', 'seal', zh), el('b', '', n(s).toLocaleString('en-US')), label)),
    el('div', 'tile', el('b', '', stamped.toLocaleString('en-US')), 'stamped this week'),
  );

  // Words stamped per week (every status change counts once, in the week it happened).
  const weeks = Array.from({ length: 12 }, () => 0);
  const start = Date.now() - 12 * 7 * 86_400_000;
  for (const w of all) for (const h of w.hist ?? []) if (h.t > start) weeks[Math.min(11, Math.floor((h.t - start) / (7 * 86_400_000)))]++;
  const top = Math.max(1, ...weeks);
  $('chart').replaceChildren(
    ...weeks.map((v, i) => {
      const bar = el('i');
      bar.style.height = `${Math.max(2, (v / top) * 100)}%`;
      const col = el('div', v ? 'col' : 'col none', el('span', '', v ? String(v) : ''), bar);
      col.title = `${v} ${v === 1 ? 'stamp' : 'stamps'}, ${11 - i ? `${11 - i} ${11 - i === 1 ? 'week' : 'weeks'} ago` : 'this week'}`;
      return col;
    }),
  );

  $('tabs').replaceChildren(
    ...[...STAMPS, ['all', '', 'All']].map(([s, , label]) => {
      const b = el('button', filter === s ? 'on' : '', label, el('b', '', (s === 'all' ? all.length : n(s)).toLocaleString('en-US')));
      b.addEventListener('click', () => {
        filter = s;
        shown = 200;
        render();
      });
      return b;
    }),
  );

  const q = $('q').value.trim().toLowerCase();
  const plain = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const rows = all
    .filter((w) => filter === 'all' || w.s === filter)
    .filter((w) => !q || w.w.includes(q) || plain(w.p).replace(/\s/g, '').includes(q.replace(/\s/g, '')) || (w.g ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.updated - a.updated);
  $('list').replaceChildren(
    ...rows.slice(0, shown).map((w) => {
      const met = sentence(w);
      const stamps = el('div', 'stamps', ...STAMPS.map(([s, zh, label]) => {
        const b = el('button', `${s}${w.s === s ? ' on' : ''}`, zh);
        b.title = label;
        b.lang = 'zh-Hant';
        if (w.s !== s) b.addEventListener('click', () => change(w.w, s));
        return b;
      }));
      const x = el('button', 'x', '×');
      x.title = 'Remove from your list';
      x.addEventListener('click', () => confirm(`Remove ${w.w} from your list?`) && change(w.w, null));
      const zh = el('div', 'zh', w.w);
      zh.lang = 'zh-Hant';
      const sent = met && el('div', 'met', met.text, met.en ? el('small', '', met.en) : null, met.url ? source(met.url, met.t) : null);
      if (sent) sent.lang = 'zh-Hant';
      return el('div', 'row', el('div', 'hw', zh, el('div', 'py', w.p ?? '')), el('div', 'body', el('div', 'gloss', w.g ?? ''), sent), stamps, x);
    }),
  );
  $('more').textContent = rows.length > shown ? '' : rows.length ? '' : q ? 'Nothing matches.' : 'Nothing here yet.';
  if (rows.length > shown) {
    const b = el('button', 'btn secondary small', `Show ${Math.min(200, rows.length - shown)} more`);
    b.addEventListener('click', () => {
      shown += 200;
      render();
    });
    $('more').replaceChildren(b);
  }
}

/** The same prompt the extension's word list copies: your newest unlearned words for an AI tutor. */
function practicePrompt() {
  const all = [...words.values()];
  const mine = all.filter((w) => w.s !== 'known').sort((a, b) => b.updated - a.updated).slice(0, 40);
  const known = all.filter((w) => w.s === 'known').length;
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  return [
    'I am learning Taiwan Mandarin. Please be my tutor for a short practice session.',
    '',
    `Below are ${mine.length} words I am studying right now (word · pinyin · meaning · the sentence I met it in). I already know about ${known.toLocaleString('en-US')} other words, so keep everything else simple.`,
    '',
    'Rules: Traditional characters and Taiwan usage only (no 兒化, Taiwan vocabulary and readings). Add pinyin only when I ask.',
    '',
    '1. Write a short story or dialogue (about 150 characters) that uses as many of these words as fit naturally. Mark each of my words in **bold**.',
    '2. Then quiz me on 8 of the words, one question at a time: a new sentence with a blank, and wait for my answer. Tell me if I was right, explain briefly in English, and move on.',
    '3. At the end, list the words I got wrong.',
    '',
    'My words:',
    ...mine.map((w) => [w.w, (w.p ?? '').toLowerCase(), w.g, sentence(w)?.text].map(clean).filter(Boolean).join(' · ')),
    '',
  ].join('\n');
}

$('q').addEventListener('input', () => {
  shown = 200;
  render();
});
$('practice').addEventListener('click', async () => {
  if (![...words.values()].some((w) => w.s !== 'known')) return say('msg', 'Stamp some words 新 or 學 first.');
  await navigator.clipboard.writeText(practicePrompt());
  say('msg', 'Copied. Paste it into Claude, ChatGPT or Gemini.', true);
});

if (!token()) location.replace('/account?next=/brain/dashboard');
else
  load().then(
    () => {
      if (![...words.values()].some((w) => w.s === 'fresh')) filter = 'all';
      render();
    },
    (e) => {
      if (e.code === 'signed_out') {
        localStorage.removeItem('cb-token');
        return location.replace('/account?next=/brain/dashboard');
      }
      $('loading').textContent = e.message;
    },
  );
