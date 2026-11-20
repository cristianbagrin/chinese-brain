// Chinese Brain Plus: what the board expects from claude.ai (window.claude.use('db')), served from the CBP database.
// Read-only while the Mac is still the source: a write fails, and the board keeps its copy on this device.
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
  const readOnly = async () => {
    throw Object.assign(new Error('Read-only for now.'), { code: 'read_only' });
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
      set: readOnly, update: readOnly, delete: readOnly,
    };
  }
  const collection = (name) => ({ path: name, doc: (id) => doc(`${name}/${id}`), onSnapshot: (cb, err) => watch({ col: name }, cb, err) });
  const db = Object.freeze({ doc, collection });
  window.claude = { use: async (n) => (n === 'db' ? db : null) };
})();
