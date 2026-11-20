// The taste test (Chinese Brain Plus): one sample at a time, every model's answer under a letter only. Pick the best.
// Keys: 1–4 pick, 0 none good enough, ← → move. After a pick, the box under it takes his reason; Enter goes on. Data: /api/plus/taste (src/cbp/taste.ts).
(async () => {
  const JOBS = { card: 'Cards', grade: 'Grades', essay: 'Essays', image: 'Pictures' };
  const L = 'ABCDEFG';
  let token = '';
  try {
    token = localStorage.getItem('cb-token') ?? '';
  } catch {}
  const api = (path, body) =>
    fetch('/api/plus/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
  const me = token ? await api('plus/me').catch(() => null) : null;
  if (!me?.ok) return location.replace('/404');

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let S = { items: [], waiting: 0, total: 0 }, job = 'card', at = 0, view = 'items';
  try {
    job = sessionStorage.getItem('taste-job') || job;
  } catch {}

  // what he changed here wins over a load that started before the change
  const mine = {};
  async function load() {
    const t0 = Date.now(), old = new Map(S.items.map((x) => [x.id, x]));
    const r = await api('taste');
    if (!r.ok) return;
    S = await r.json();
    for (const x of S.items) {
      const o = old.get(x.id);
      if (o && (mine[x.id] ?? 0) >= t0) Object.assign(x, { pick: o.pick, note: o.note });
    }
  }
  const of = (j) => S.items.filter((x) => x.job === j);
  const json = (s) => {
    try {
      return JSON.parse(String(s).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
    } catch {
      return null;
    }
  };

  // ---------- one answer, laid out the same way whoever wrote it ----------
  function card(text) {
    const rows = String(text).split('\n').map((l) => /^(word|pinyin|meaning|mine|ex|char|part|sub|logic|story|hook|know|second|card)\s*[:：]\s*(.*)$/i.exec(l.trim())).filter(Boolean);
    if (!rows.length) return `<div class="raw">${esc(text)}</div>`;
    return `<div class="card">${rows.map(([, t, v]) => `<div class="l ${t.toLowerCase()}"><span class="t">${esc(t)}</span><span class="v" lang="zh-Hant">${esc(v).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\s*\|\s*/g, ' · ')}</span></div>`).join('')}</div>`;
  }
  function grade(out) {
    const g = json(out);
    if (!g) return `<div class="raw">${esc(out)}</div>`;
    const r = String(g.result || '').toLowerCase();
    return `<div class="verdict"><span class="res ${esc(r)}">${esc(r)}</span>${g.natural ? `<div class="nat" lang="zh-Hant">${esc(g.natural)}</div>` : ''}${g.why ? `<div class="why">${esc(g.why)}</div>` : ''}${g.followup ? `<div class="fu">${esc(g.followup)}</div>` : ''}</div>`;
  }
  function essay(out) {
    const m = json(out)?.marks;
    if (!Array.isArray(m)) return `<div class="raw">${esc(out)}</div>`;
    return `<div class="marks">${m.map((x) => `<div class="mark ${esc(x.t)}"><span class="mt">${esc(x.t)}</span><span class="mine" lang="zh-Hant">${esc(x.mine)}</span>${x.nat ? `<span class="nat" lang="zh-Hant">${esc(x.nat)}</span>` : ''}${x.note ? `<span class="note">${esc(x.note)}</span>` : ''}</div>`).join('')}</div>`;
  }
  const body = (it, a) => (a.failed ? '<p class="failed">No answer: the model failed on this one.</p>' : it.job === 'card' ? card(a.out) : it.job === 'grade' ? grade(a.out) : it.job === 'essay' ? essay(a.out) : `<img alt="" data-img="${a.n}">`);

  function context(it) {
    const s = it.show;
    if (it.job === 'grade')
      return `<div class="ctx"><div class="row"><span class="k">Target</span><span>${esc(s.target)}</span></div><div class="row"><span class="k">Situation</span><span>${esc(s.ask)}</span></div>${s.hear ? `<div class="row"><span class="k">Heard</span><span class="heard" lang="zh-Hant">${esc(s.hear)}</span></div>` : ''}${s.read ? `<div class="row"><span class="k">Read</span><span class="heard" lang="zh-Hant">${esc(s.read)}</span></div>` : ''}<div class="row"><span class="k">He said</span><span class="ans" lang="zh-Hant">${esc(s.answer)}</span></div><div class="row"><span class="k">The rule</span><span class="rule">${esc(s.check)}</span></div></div>`;
    if (it.job === 'essay') return `<div class="ctx"><div class="essay" lang="zh-Hant">${esc(s.text)}</div></div>`;
    return '';
  }

  // ---------- the page ----------
  function render() {
    const list = of(job);
    const picked = S.items.filter((x) => x.pick != null).length;
    $('jobs').innerHTML =
      Object.entries(JOBS).map(([j, name]) => {
        const l = of(j), d = l.filter((x) => x.pick != null).length;
        return `<button type="button" data-job="${j}" aria-current="${view === 'items' && j === job}" class="${l.length && d === l.length ? 'done' : ''}">${name}<small>${d}/${l.length}</small></button>`;
      }).join('') + `<button type="button" data-view="results" aria-current="${view === 'results'}">Results</button>`;
    $('left').textContent = S.waiting ? `${S.waiting} of ${S.total} still being answered` : `${picked} of ${S.total} picked`;
    if (view === 'results') return results();
    if (!list.length) {
      $('sheet').innerHTML = `<p class="empty">${S.waiting ? 'The models are still answering these. They write a few every hour; come back later.' : 'Nothing here.'}</p>`;
      return;
    }
    at = Math.max(0, Math.min(at, list.length - 1));
    const it = list[at];
    $('sheet').innerHTML = `<div class="head"><h1>${it.job === 'grade' || it.job === 'essay' ? esc(it.title) : `<span class="zh" lang="zh-Hant">${esc(it.title)}</span>`}</h1>${it.show.gloss ? `<span class="gloss">${esc(it.show.gloss)}</span>` : ''}
      <span class="nav"><button type="button" data-go="-1" ${at ? '' : 'disabled'} aria-label="Previous">←</button><button type="button" data-go="1" ${at < list.length - 1 ? '' : 'disabled'} aria-label="Next">→</button></span></div>
      ${context(it)}
      <div class="glasses">${it.answers.map((a) => `<section class="glass${it.pick === a.n ? ' picked' : ''}"><div class="tag"><span class="letter">${L[a.n]}</span><button class="take" type="button" data-pick="${a.n}">${it.pick === a.n ? 'Picked' : 'Pick'}</button></div>${body(it, a)}</section>`).join('')}</div>
      <button class="nogood" type="button" data-pick="none" aria-pressed="${it.pick === 'none'}">None good enough</button>
      ${it.pick != null ? `<textarea class="why" id="why" rows="2" placeholder="Why?" data-item="${esc(it.id)}">${esc(it.note)}</textarea>` : ''}`;
    if (it.job === 'image')
      document.querySelectorAll('[data-img]').forEach(async (img) => {
        const r = await api(`taste/img?item=${encodeURIComponent(it.id)}&n=${img.dataset.img}`);
        if (r.ok) img.src = URL.createObjectURL(await r.blob());
      });
    scrollTo({ top: 0 });
  }

  async function results() {
    $('sheet').innerHTML = '';
    const r = await api('taste/results');
    const R = r.ok ? await r.json() : {};
    $('sheet').innerHTML = `<div class="results">${Object.entries(JOBS).map(([j, name]) => {
      const x = R[j];
      if (!x) return '';
      const t = Object.entries(x.tally).sort((a, b) => b[1] - a[1]);
      return `<section><h2>${name}</h2>${t.length ? t.map(([who, n]) => `<div class="bar-row"><span>${esc(who)}</span><span class="track"><span class="fill${who === 'Claude' ? ' claude' : ''}" style="width:${(100 * n) / x.items}%"></span></span><span>${n}</span></div>`).join('') : `<p>${x.picked} of ${x.items} picked. The names show once all are.</p>`}</section>`;
    }).join('')}</div>`;
  }

  async function choose(v) {
    await saveNote();
    const list = of(job), it = list[at];
    if (!it) return;
    mine[it.id] = Date.now();
    it.pick = v === 'none' ? 'none' : Number(v);
    render();
    const r = await api('taste/pick', { item: it.id, n: v === 'none' ? 'none' : Number(v) });
    if (!r.ok) return alert('That pick didn’t save. Try again.');
    $('why')?.focus();
  }

  // the reason: saved as he types; Enter moves on to the next sample still waiting for a pick
  let noteT = 0;
  async function saveNote() {
    clearTimeout(noteT);
    const el = $('why'), it = el && S.items.find((x) => x.id === el.dataset.item);
    if (!el || !it || el.value === it.note) return;
    it.note = el.value;
    mine[it.id] = Date.now();
    const r = await api('taste/note', { item: it.id, note: it.note });
    el.classList.toggle('err', !r.ok);
  }
  function next() {
    const list = of(job);
    const i = list.findIndex((x, k) => k > at && x.pick == null);
    if (i >= 0) at = i;
    else if (at < list.length - 1) at++;
    else return;
    render();
  }
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'why') return;
    clearTimeout(noteT);
    noteT = setTimeout(saveNote, 700);
  });
  document.addEventListener('focusout', (e) => e.target.id === 'why' && saveNote());

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.job) {
      job = b.dataset.job;
      view = 'items';
      try {
        sessionStorage.setItem('taste-job', job);
      } catch {}
      const l = of(job);
      at = Math.max(0, l.findIndex((x) => x.pick == null));
      render();
    } else if (b.dataset.view) {
      view = 'results';
      render();
    } else if (b.dataset.go) {
      at += Number(b.dataset.go);
      render();
    } else if (b.dataset.pick != null) choose(b.dataset.pick);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'why') {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        saveNote().then(next);
      } else if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (view !== 'items' || e.metaKey || e.ctrlKey || e.altKey) return;
    const it = of(job)[at];
    if (e.key === 'ArrowRight' && at < of(job).length - 1) (at++, render());
    else if (e.key === 'ArrowLeft' && at > 0) (at--, render());
    else if (e.key === '0') choose('none');
    else if (it && /^[1-9]$/.test(e.key) && Number(e.key) <= it.answers.length) choose(Number(e.key) - 1);
  });

  await load();
  at = Math.max(0, of(job).findIndex((x) => x.pick == null));
  render();
  document.documentElement.classList.remove('locked');
  // new answers arrive every hour: look again when he comes back to the tab
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    await load();
    if (document.activeElement?.id !== 'why') render();
  });
})();
