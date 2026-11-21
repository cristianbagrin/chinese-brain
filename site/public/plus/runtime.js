// Chinese Brain Plus: what the board expects from claude.ai (window.claude.use('db') and use('sample')), served from
// the CBP database and the server's Claude (Sonnet 5.5). Writes need the website to be the source and the account's
// `plus.write` switch; until then a write fails with code read_only and the board keeps its copy on this device.
(() => {
  const token = () => {
    try {
      return localStorage.getItem('cb-token') ?? '';
    } catch {
      return '';
    }
  };
  const get = async (q) => {
    const r = await fetch('/api/plus/db?' + new URLSearchParams(q), { headers: { Authorization: `Bearer ${token()}` }, cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error('Couldn’t load.'), { code: 'unavailable' });
    return r.json();
  };
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  // claude.ai hands out frozen snapshots; the board is written for that
  const freeze = (o) => {
    if (o && typeof o === 'object') {
      Object.values(o).forEach(freeze);
      Object.freeze(o);
    }
    return o;
  };
  const docSnap = (id, data) => ({ id, exists: data != null, data: () => freeze(clone(data)), metadata: { hasPendingWrites: false } });
  const colSnap = (list) => {
    const docs = list.map((x) => docSnap(x.id, x.data));
    return { docs, size: docs.length, empty: !docs.length };
  };
  const post = async (path, body) => {
    const r = await fetch('/api/plus/' + path, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'It didn’t come through.'), { code: j.code || (r.status === 429 ? 'rate_limited' : 'unavailable') });
    return j;
  };
  // a write, then everything watching that collection hears about it at once
  const write = async (col, id, op, data) => {
    const out = await post('db', { col, id, op, data: data === undefined ? null : clone(data) });
    subs.forEach((s) => s.q.col === col && (!s.q.id || s.q.id === id) && pull(s));
    return out;
  };

  // onSnapshot: the first answer now, then again whenever it changed (checked each minute and on coming back)
  const subs = new Set();
  async function pull(s) {
    try {
      const v = await get(s.q);
      const seen = JSON.stringify(v);
      if (seen === s.seen) return;
      s.seen = seen;
      s.cb(s.q.id ? docSnap(s.q.id, v) : colSnap(v));
    } catch (e) {
      s.err?.(e);
    }
  }
  const watch = (q, cb, err) => {
    const s = { q, cb, err };
    subs.add(s);
    pull(s);
    return () => subs.delete(s);
  };
  const refresh = () => !document.hidden && subs.forEach(pull);
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);

  function doc(path) {
    const i = path.indexOf('/'), col = path.slice(0, i), id = path.slice(i + 1);
    return {
      id, path,
      onSnapshot: (cb, err) => watch({ col, id }, cb, err),
      get: async () => docSnap(id, await get({ col, id })),
      set: (data) => write(col, id, 'set', data),
      update: (data) => write(col, id, 'update', data),
      delete: () => write(col, id, 'delete'),
    };
  }
  const collection = (name) => ({ path: name, doc: (id) => doc(`${name}/${id}`), onSnapshot: (cb, err) => watch({ col: name }, cb, err) });
  const db = Object.freeze({ doc, collection });

  // sample: Claude on the server. The answer comes whole (onText hears it once, at the end).
  const sample = async (input, opts = {}) => {
    const { text, model } = await post('sample', { input, effort: opts.effort });
    opts.onText?.({ text });
    return { text, modelApplied: model };
  };
  sample.limits = async () => ({ images: false });
  window.claude = { use: async (n) => (n === 'db' ? db : n === 'sample' ? sample : null) };
})();
