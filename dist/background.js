"use strict";
(() => {
  // src/shared/dict.ts
  var CJK = /[㐀-䶿一-鿿豈-﫿]/;
  var MAX_WORD = 8;
  var Dictionary = class _Dictionary {
    entries = [];
    index = /* @__PURE__ */ new Map();
    static fromTsv(text) {
      const d = new _Dictionary();
      let start = 0;
      while (start < text.length) {
        let end = text.indexOf("\n", start);
        if (end < 0) end = text.length;
        if (text.charCodeAt(start) !== 35 && end > start) {
          const f = text.slice(start, end).split("	");
          const e = {
            trad: f[0],
            simp: f[1],
            py: f[2],
            tw: f[3],
            defs: f[4].split("/"),
            zipf: Number(f[5]) || 0,
            tocfl: Number(f[6]) || 0
          };
          const i = d.entries.push(e) - 1;
          d.add(e.trad, i);
          if (e.simp !== e.trad) d.add(e.simp, i);
        }
        start = end + 1;
      }
      return d;
    }
    add(key, i) {
      const list = this.index.get(key);
      if (list) list.push(i);
      else this.index.set(key, [i]);
    }
    has(word) {
      return this.index.has(word);
    }
    /** All entries for a headword (either script), best first. */
    get(word) {
      const ids = this.index.get(word);
      if (!ids) return [];
      return rankEntries(
        ids.map((i) => this.entries[i]),
        word
      );
    }
    /** Longest-prefix matches for text starting at the cursor, longest first. */
    lookup(text, max = 4) {
      if (!text || !CJK.test(text[0])) return [];
      const out = [];
      for (let len = Math.min(MAX_WORD, text.length); len >= 1 && out.length < max; len--) {
        const s = text.slice(0, len);
        const entries = this.get(s);
        if (entries.length) out.push({ text: s, word: entries[0].trad, entries });
      }
      return out;
    }
    /** log10 probability-ish score for a dictionary word. */
    score(word) {
      const entries = this.get(word);
      if (!entries.length) return word.length === 1 ? -14 : -Infinity;
      const zipf = Math.max(...entries.map((e) => e.zipf));
      if (zipf > 0) return zipf / 10 - 9;
      return word.length === 1 ? -9 : -8.6;
    }
    /**
     * Split a line into words: dynamic programming over dictionary words,
     * maximising the summed log-frequency (a unigram model, like jieba).
     */
    segment(line) {
      const tokens = [];
      const re = /[㐀-䶿一-鿿豈-﫿]+|[^㐀-䶿一-鿿豈-﫿]+/g;
      for (const m of line.matchAll(re)) {
        const run = m[0];
        if (!CJK.test(run[0])) {
          tokens.push({ text: run });
          continue;
        }
        const n = run.length;
        const best = new Array(n + 1).fill(-Infinity);
        const back = new Array(n + 1).fill(0);
        best[0] = 0;
        for (let i = 0; i < n; i++) {
          if (best[i] === -Infinity) continue;
          for (let len = 1; len <= MAX_WORD && i + len <= n; len++) {
            const s = run.slice(i, i + len);
            const sc = len === 1 || this.index.has(s) ? this.score(s) : -Infinity;
            if (sc === -Infinity) continue;
            const v = best[i] + sc;
            if (v > best[i + len]) {
              best[i + len] = v;
              back[i + len] = i;
            }
          }
        }
        const parts = [];
        for (let j = n; j > 0; j = back[j]) parts.push(run.slice(back[j], j));
        parts.reverse();
        for (const p of parts) tokens.push(this.token(p));
      }
      return tokens;
    }
    token(text) {
      const entries = this.get(text);
      if (!entries.length) return { text, trad: text };
      const e = entries[0];
      return { text, word: e.trad, py: e.tw || e.py, trad: e.trad };
    }
  };
  var LOW_VALUE = /^(old )?variant of|^see |^surname |^used in |^\(old\)|^archaic /i;
  function rankEntries(entries, query) {
    const rank = (e) => {
      let r = 0;
      if (e.trad !== query) r += 1;
      if (/^[A-Z]/.test(e.py)) r += 4;
      if (LOW_VALUE.test(e.defs[0] ?? "")) r += 8;
      if (e.defs.every((d) => /^(old )?variant of|^see /i.test(d))) r += 8;
      return r;
    };
    return entries.map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => a.r - b.r || b.e.zipf - a.e.zipf || a.i - b.i).map((x) => x.e);
  }

  // src/shared/pinyin.ts
  var MARKS = {
    a: ["\u0101", "\xE1", "\u01CE", "\xE0", "a"],
    e: ["\u0113", "\xE9", "\u011B", "\xE8", "e"],
    i: ["\u012B", "\xED", "\u01D0", "\xEC", "i"],
    o: ["\u014D", "\xF3", "\u01D2", "\xF2", "o"],
    u: ["\u016B", "\xFA", "\u01D4", "\xF9", "u"],
    \u00FC: ["\u01D6", "\u01D8", "\u01DA", "\u01DC", "\xFC"]
  };
  function syllableToMarked(syl) {
    const m = /^([a-zA-Z:üÜ]+)([1-5])$/.exec(syl);
    if (!m) return syl;
    let [, base, toneStr] = m;
    const tone = Number(toneStr) - 1;
    base = base.replace(/u:/g, "\xFC").replace(/U:/g, "\xDC").replace(/v/g, "\xFC");
    const lower = base.toLowerCase();
    let idx = lower.search(/[ae]/);
    if (idx < 0) idx = lower.indexOf("ou");
    if (idx < 0) {
      for (let i = lower.length - 1; i >= 0; i--) {
        if ("aeiou\xFC".includes(lower[i])) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) return base;
    const v = lower[idx];
    let marked = MARKS[v][tone];
    if (base[idx] !== lower[idx]) marked = marked.toUpperCase();
    return base.slice(0, idx) + marked + base.slice(idx + 1);
  }
  function numberedToMarked(py, joined = true) {
    const sylls = py.split(/\s+/).filter(Boolean).map(syllableToMarked);
    if (!joined) return sylls.join(" ");
    return sylls.reduce((acc, s, i) => i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? acc + "'" + s : acc + s, "");
  }

  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    subPinyin: false,
    translation: "blur",
    toTraditional: true,
    pauseOnHover: true,
    autoFreshOnClick: true,
    markUntracked: true,
    subFontSize: 30,
    shadowFactor: 1.5,
    transLang: "en",
    feedFolder: "chinese-brain",
    speechRate: 0.9
  };

  // src/shared/time.ts
  function dayKeyLocal(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim();
  var iso = (t) => {
    const d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function videoLink(url, t) {
    if (t == null) return url;
    try {
      const u = new URL(url);
      if (u.hostname.endsWith("youtube.com") && u.searchParams.get("v")) {
        return `https://youtu.be/${u.searchParams.get("v")}?t=${Math.floor(t)}`;
      }
    } catch {
    }
    return url;
  }
  function buildWordsTsv(words, since = 0) {
    const head = ["word", "status", "pinyin", "gloss", "added", "updated", "lookups", "history", "sentence", "source"];
    const rows = words.filter((w) => w.updated > since).sort((a, b) => a.added - b.added).map((w) => {
      const c = w.ctx[0];
      const hist = w.hist.map((h) => `${h.s}@${dayKeyLocal(h.t)}`).join(">");
      return [w.w, w.s, w.p, w.g, iso(w.added), iso(w.updated), String(w.looks), hist, c?.text, c ? videoLink(c.url, c.t) : ""].map(clean).join("	");
    });
    return [head.join("	"), ...rows].join("\n") + "\n";
  }
  function buildEventsTsv(logs, since = 0) {
    const head = ["time", "event", "word", "detail", "url"];
    const rows = logs.filter((e) => e.at > since).map((e) => {
      switch (e.k) {
        case "look":
          return [iso(e.at), "lookup", e.w, e.src, e.url ?? ""];
        case "status":
          return [iso(e.at), "status", e.w, `${e.from ?? "untracked"}>${e.s ?? "untracked"}`, ""];
        case "watch":
          return [
            iso(e.at),
            "watch",
            "",
            `${Math.round(e.secs / 60)} min${e.coverage != null ? `, knew ${Math.round(e.coverage * 100)}% of words` : ""}${e.title ? ` | ${e.title}` : ""}`,
            e.url
          ];
      }
    }).map((r) => r.map((x) => clean(x)).join("	"));
    return [head.join("	"), ...rows].join("\n") + "\n";
  }
  var FEED_README = `# Chinese Brain feed

Written by the Chinese Brain browser extension. Rewritten in place a few
minutes after any change; nothing here needs exporting by hand.

## words.tsv
One row per word in the list (Traditional headword).
- status: fresh (first met, being learned) | difficult (should know, keeps slipping) | known
- pinyin: Taiwan standard reading (MOE dictionary when it differs from CC-CEDICT)
- added / updated: local time, YYYY-MM-DD HH:MM
- lookups: deliberate lookups (clicks, or a popup left open), max once per 10 minutes
- history: every status change, oldest first, e.g. fresh@2026-10-01>difficult@2026-10-05>known@2026-10-20
- sentence / source: the most recent sentence the word was met in, and where (YouTube links jump to the second)

## events.tsv
Append-only log, oldest first: lookups, status changes, and videos watched
(minutes with subtitles on, share of words already known).

## Reading only what is new
Every row has a time. Remember the newest time you processed and next time
read only later rows. Nothing is ever deleted from events.tsv, so this is safe.
`;

  // src/background/feed.ts
  var timer;
  function scheduleFeed(store2, folder) {
    clearTimeout(timer);
    timer = setTimeout(() => writeFeed(store2, folder).catch((e) => console.warn("[chinese-brain] feed", e)), 2 * 6e4);
  }
  async function writeFeed(store2, folder) {
    const logs = await store2.allLogs();
    const words = [...store2.words.values()];
    const files = {
      "words.tsv": buildWordsTsv(words),
      "events.tsv": buildEventsTsv(logs),
      "README.md": FEED_README
    };
    for (const [name, content] of Object.entries(files)) {
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      try {
        const id = await browser.downloads.download({
          url,
          filename: `${folder}/${name}`,
          conflictAction: "overwrite",
          saveAs: false
        });
        await waitForDownload(id);
        await browser.downloads.erase({ id });
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 3e4);
      }
    }
    await browser.storage.local.set({ feedWrittenAt: Date.now() });
    return true;
  }
  function waitForDownload(id) {
    return new Promise((resolve) => {
      const done = () => {
        browser.downloads.onChanged.removeListener(listener);
        resolve();
      };
      const listener = (d) => {
        if (d.id === id && d.state && d.state.current !== "in_progress") done();
      };
      browser.downloads.onChanged.addListener(listener);
      setTimeout(done, 1e4);
    });
  }

  // src/background/store.ts
  var Store = class {
    words = /* @__PURE__ */ new Map();
    pendingLog = [];
    logTimer;
    recentLooks = /* @__PURE__ */ new Map();
    onChange;
    async load() {
      const all = await browser.storage.local.get(null);
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith("w:")) this.words.set(k.slice(2), v);
      }
    }
    statuses() {
      const out = {};
      for (const [w, r] of this.words) out[w] = r.s;
      return out;
    }
    async setStatus(word, status, entry, ctx) {
      const now = Date.now();
      const prev = this.words.get(word);
      this.log({ at: now, k: "status", w: word, s: status, from: prev?.s ?? null });
      if (!status) {
        this.words.delete(word);
        await browser.storage.local.remove("w:" + word);
        this.onChange?.();
        return;
      }
      const rec = prev ?? { w: word, s: status, added: now, updated: now, hist: [], looks: 0, ctx: [] };
      if (prev?.s !== status) rec.hist.push({ t: now, s: status });
      rec.s = status;
      rec.updated = now;
      if (entry) {
        rec.p = numberedToMarked(entry.tw || entry.py);
        rec.g = shortGloss(entry);
      }
      if (ctx) addContext(rec, ctx);
      this.words.set(word, rec);
      await browser.storage.local.set({ ["w:" + word]: rec });
      this.onChange?.();
    }
    /** A deliberate lookup (click, or a popup that stayed open). */
    async looked(word, src, url, ctx) {
      const now = Date.now();
      const last = this.recentLooks.get(word) ?? 0;
      if (now - last < 10 * 6e4) return;
      this.recentLooks.set(word, now);
      this.log({ at: now, k: "look", w: word, src, url });
      const rec = this.words.get(word);
      if (rec) {
        rec.looks++;
        if (ctx) addContext(rec, ctx);
        await browser.storage.local.set({ ["w:" + word]: rec });
        this.onChange?.();
      }
    }
    log(ev) {
      this.pendingLog.push(ev);
      clearTimeout(this.logTimer);
      this.logTimer = setTimeout(() => this.flushLog(), 3e3);
    }
    async flushLog() {
      if (!this.pendingLog.length) return;
      const byDay = /* @__PURE__ */ new Map();
      for (const ev of this.pendingLog) {
        const k = "log:" + dayKeyLocal(ev.at);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(ev);
      }
      this.pendingLog = [];
      const existing = await browser.storage.local.get([...byDay.keys()]);
      const update = {};
      for (const [k, evs] of byDay) update[k] = [...existing[k] ?? [], ...evs];
      await browser.storage.local.set(update);
      this.onChange?.();
    }
    async allLogs() {
      await this.flushLog();
      const all = await browser.storage.local.get(null);
      return Object.keys(all).filter((k) => k.startsWith("log:")).sort().flatMap((k) => all[k]);
    }
    /** Bulk import (known-words file, backups). Existing records keep their history. */
    async importWords(recs, mode = "merge") {
      const update = {};
      for (const r of recs) {
        const prev = this.words.get(r.w);
        if (prev && mode === "merge") {
          if (prev.s === r.s) continue;
          if (r.updated <= prev.updated) continue;
        }
        this.words.set(r.w, r);
        update["w:" + r.w] = r;
      }
      if (Object.keys(update).length) await browser.storage.local.set(update);
      this.onChange?.();
      return Object.keys(update).length;
    }
  };
  function addContext(rec, ctx) {
    const text = ctx.text.trim().slice(0, 300);
    if (!text) return;
    if (rec.ctx.some((c) => c.text === text)) return;
    rec.ctx.unshift({ ...ctx, text });
    rec.ctx = rec.ctx.slice(0, 5);
  }
  function shortGloss(e) {
    return e.defs.filter((d) => !d.startsWith("CL:")).slice(0, 3).join("; ").slice(0, 120);
  }

  // src/background/youtube.ts
  var cache = /* @__PURE__ */ new Map();
  function startCaptionCapture() {
    browser.webRequest.onBeforeRequest.addListener(
      (details) => {
        if (details.tabId < 0) return {};
        const filter = browser.webRequest.filterResponseData(details.requestId);
        const chunks = [];
        filter.ondata = (e) => {
          chunks.push(e.data);
          filter.write(e.data);
        };
        filter.onstop = () => {
          filter.close();
          const body = new TextDecoder("utf-8").decode(concat(chunks));
          const item = { url: details.url, body, at: Date.now() };
          const list = (cache.get(details.tabId) ?? []).filter((x) => Date.now() - x.at < 30 * 6e4);
          list.push(item);
          cache.set(details.tabId, list.slice(-12));
          browser.tabs.sendMessage(details.tabId, { type: "ytCaptions", url: details.url, body }, { frameId: details.frameId }).catch(() => {
          });
        };
        filter.onerror = () => {
          try {
            filter.disconnect();
          } catch {
          }
        };
        return {};
      },
      { urls: ["*://*.youtube.com/api/timedtext*"] },
      ["blocking"]
    );
    browser.tabs.onRemoved.addListener((tabId) => cache.delete(tabId));
  }
  function cachedCaptions(tabId) {
    return cache.get(tabId) ?? [];
  }
  function concat(chunks) {
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(new Uint8Array(c), off);
      off += c.byteLength;
    }
    return out;
  }

  // src/background/index.ts
  var dict;
  var dictReady = loadDictionary();
  var store = new Store();
  var storeReady = store.load();
  startCaptionCapture();
  async function loadDictionary() {
    const t0 = performance.now();
    const res = await fetch(browser.runtime.getURL("data/dict.tsv.gz"));
    const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    dict = Dictionary.fromTsv(text);
    console.log(`[chinese-brain] dictionary: ${dict.entries.length} entries in ${Math.round(performance.now() - t0)} ms`);
    return dict;
  }
  async function getSettings() {
    const { settings } = await browser.storage.local.get("settings");
    return { ...DEFAULT_SETTINGS, ...settings };
  }
  store.onChange = () => {
    getSettings().then((s) => s.feedFolder && scheduleFeed(store, s.feedFolder));
  };
  browser.runtime.onMessage.addListener((msg, sender) => {
    const m = msg;
    switch (m.type) {
      case "lookup":
        return dictReady.then((d) => d.lookup(m.text));
      case "segment":
        return dictReady.then((d) => m.lines.map((l) => d.segment(l)));
      case "statuses":
        return storeReady.then(() => store.statuses());
      case "getWord":
        return storeReady.then(() => store.words.get(m.word) ?? null);
      case "setStatus":
        return storeReady.then(() => store.setStatus(m.word, m.status, m.entry, m.ctx)).then(() => true);
      case "looked":
        return storeReady.then(() => store.looked(m.word, m.src, m.url, m.ctx)).then(() => true);
      case "watch":
        store.log({ at: Date.now(), k: "watch", url: m.url, title: m.title, secs: m.secs, coverage: m.coverage, lang: m.lang });
        return Promise.resolve(true);
      case "settings":
        return getSettings();
      case "saveSettings":
        return getSettings().then((s) => browser.storage.local.set({ settings: { ...s, ...m.settings } }).then(() => true));
    }
    const any = msg;
    switch (any.type) {
      case "ytCached":
        return Promise.resolve(sender.tab?.id != null ? cachedCaptions(sender.tab.id) : []);
      case "allData":
        return storeReady.then(async () => ({ words: [...store.words.values()], logs: await store.allLogs() }));
      case "importWords":
        return storeReady.then(() => store.importWords(any.words, any.mode ?? "merge"));
      case "writeFeed":
        return storeReady.then(async () => writeFeed(store, (await getSettings()).feedFolder || "chinese-brain"));
      case "insertCSS":
        if (sender.tab?.id != null)
          return browser.tabs.insertCSS(sender.tab.id, { code: any.css, frameId: sender.frameId ?? 0 }).then(() => true);
        return void 0;
      case "bulkStatus":
        return Promise.all([dictReady, storeReady]).then(async ([d]) => {
          const status = any.status;
          const now = Date.now();
          const recs = [];
          const seen = /* @__PURE__ */ new Set();
          for (const raw of any.words) {
            const e = d.get(raw)[0];
            const w = e?.trad ?? raw;
            if (seen.has(w) || any.onlyNew && store.words.has(w)) continue;
            seen.add(w);
            const prev = store.words.get(w);
            recs.push({
              ...prev ?? { w, added: now, hist: [], looks: 0, ctx: [] },
              s: status,
              updated: now,
              hist: [...prev?.hist ?? [], { t: now, s: status }],
              p: e ? numberedToMarked(e.tw || e.py) : prev?.p,
              g: e ? shortGloss(e) : prev?.g
            });
          }
          for (const r of recs) store.log({ at: now, k: "status", w: r.w, s: status, from: store.words.get(r.w)?.s ?? null });
          return store.importWords(recs, "replace");
        });
      case "tocflWords":
        return dictReady.then((d) => [...new Set(d.entries.filter((e) => e.tocfl && e.tocfl <= any.level).map((e) => e.trad))]);
      case "entries":
        return dictReady.then((d) => d.get(any.word));
    }
    return void 0;
  });
  browser.commands.onCommand.addListener(async (cmd) => {
    if (cmd === "toggle-lookup") {
      const s = await getSettings();
      const hoverMode = s.hoverMode === "off" ? "hover" : "off";
      await browser.storage.local.set({ settings: { ...s, hoverMode } });
    }
  });
})();
