"use strict";
(() => {
  // src/shared/dict.ts
  var CJK = /[㐀-䶿一-鿿豈-﫿]/;
  var Dictionary = class _Dictionary {
    entries = [];
    index = /* @__PURE__ */ new Map();
    static fromTsv(text) {
      let d = new _Dictionary(), start = 0;
      for (; start < text.length; ) {
        let end = text.indexOf(`
`, start);
        if (end < 0 && (end = text.length), text.charCodeAt(start) !== 35 && end > start) {
          let f = text.slice(start, end).split("	"), e = {
            trad: f[0],
            simp: f[1],
            py: f[2],
            tw: f[3],
            defs: f[4].split("/"),
            zipf: Number(f[5]) || 0,
            tocfl: Number(f[6]) || 0
          }, i = d.entries.push(e) - 1;
          d.add(e.trad, i), e.simp !== e.trad && d.add(e.simp, i);
        }
        start = end + 1;
      }
      return d;
    }
    add(key, i) {
      let list = this.index.get(key);
      list ? list.push(i) : this.index.set(key, [i]);
    }
    has(word) {
      return this.index.has(word);
    }
    /** All entries for a headword (either script), best first. */
    get(word) {
      let ids = this.index.get(word);
      return ids ? rankEntries(
        ids.map((i) => this.entries[i]),
        word
      ) : [];
    }
    /** Longest-prefix matches for text starting at the cursor, longest first. */
    lookup(text, max = 4) {
      if (!text || !CJK.test(text[0])) return [];
      let out = [];
      for (let len = Math.min(8, text.length); len >= 1 && out.length < max; len--) {
        let s = text.slice(0, len), entries = this.get(s);
        entries.length && out.push({ text: s, word: entries[0].trad, entries });
      }
      return out;
    }
    /** log10 probability-ish score for a dictionary word. */
    score(word) {
      let entries = this.get(word);
      if (!entries.length) return word.length === 1 ? -14 : -1 / 0;
      let zipf = Math.max(...entries.map((e) => e.zipf));
      return zipf > 0 ? zipf / 10 - 9 : word.length === 1 ? -9 : -8.6;
    }
    /**
     * Split a line into words: dynamic programming over dictionary words,
     * maximising the summed log-frequency (a unigram model, like jieba).
     */
    segment(line) {
      let tokens = [], re = /[㐀-䶿一-鿿豈-﫿]+|[^㐀-䶿一-鿿豈-﫿]+/g;
      for (let m of line.matchAll(re)) {
        let run = m[0];
        if (!CJK.test(run[0])) {
          tokens.push({ text: run });
          continue;
        }
        let n = run.length, best = new Array(n + 1).fill(-1 / 0), back = new Array(n + 1).fill(0);
        best[0] = 0;
        for (let i = 0; i < n; i++)
          if (best[i] !== -1 / 0)
            for (let len = 1; len <= 8 && i + len <= n; len++) {
              let s = run.slice(i, i + len), sc = len === 1 || this.index.has(s) ? this.score(s) : -1 / 0;
              if (sc === -1 / 0) continue;
              let v = best[i] + sc;
              v > best[i + len] && (best[i + len] = v, back[i + len] = i);
            }
        let parts = [];
        for (let j = n; j > 0; j = back[j]) parts.push(run.slice(back[j], j));
        parts.reverse();
        for (let p of parts) tokens.push(this.token(p));
      }
      return tokens;
    }
    token(text) {
      let entries = this.get(text);
      if (!entries.length) return { text, trad: text };
      let e = entries[0];
      return { text, word: e.trad, py: e.tw || e.py, trad: e.trad };
    }
  }, LOW_VALUE = /^(old )?variant of|^see |^surname |^used in |^\(old\)|^archaic /i;
  function rankEntries(entries, query) {
    let rank = (e) => {
      let r = 0;
      return e.trad !== query && (r += 1), /^[A-Z]/.test(e.py) && (r += 4), LOW_VALUE.test(e.defs[0] ?? "") && (r += 8), e.defs.every((d) => /^(old )?variant of|^see /i.test(d)) && (r += 8), r;
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
    let m = /^([a-zA-Z:üÜ]+)([1-5])$/.exec(syl);
    if (!m) return syl;
    let [, base, toneStr] = m, tone = Number(toneStr) - 1;
    base = base.replace(/u:/g, "\xFC").replace(/U:/g, "\xDC").replace(/v/g, "\xFC");
    let lower = base.toLowerCase(), idx = lower.search(/[ae]/);
    if (idx < 0 && (idx = lower.indexOf("ou")), idx < 0) {
      for (let i = lower.length - 1; i >= 0; i--)
        if ("aeiou\xFC".includes(lower[i])) {
          idx = i;
          break;
        }
    }
    if (idx < 0) return base;
    let v = lower[idx], marked = MARKS[v][tone];
    return base[idx] !== lower[idx] && (marked = marked.toUpperCase()), base.slice(0, idx) + marked + base.slice(idx + 1);
  }
  function numberedToMarked(py, joined = !0) {
    let sylls = py.split(/\s+/).filter(Boolean).map(syllableToMarked);
    return joined ? sylls.reduce((acc, s, i) => i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? acc + "'" + s : acc + s, "") : sylls.join(" ");
  }

  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    subPinyin: !1,
    translation: "blur",
    toTraditional: !0,
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    markUntracked: !0,
    subFontSize: 30,
    shadowFactor: 1.5,
    transLang: "en",
    feedFolder: "chinese-brain",
    speechRate: 0.9
  };

  // src/shared/time.ts
  function dayKeyLocal(t) {
    let d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim(), iso = (t) => {
    let d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  function videoLink(url, t) {
    if (t == null) return url;
    try {
      let u = new URL(url);
      if (u.hostname.endsWith("youtube.com") && u.searchParams.get("v"))
        return `https://youtu.be/${u.searchParams.get("v")}?t=${Math.floor(t)}`;
    } catch {
    }
    return url;
  }
  function buildWordsTsv(words, since = 0) {
    let head = ["word", "status", "pinyin", "gloss", "added", "updated", "lookups", "history", "sentence", "source"], rows = words.filter((w) => w.updated > since).sort((a, b) => a.added - b.added).map((w) => {
      let c = w.ctx[0], hist = w.hist.map((h) => `${h.s}@${dayKeyLocal(h.t)}`).join(">");
      return [w.w, w.s, w.p, w.g, iso(w.added), iso(w.updated), String(w.looks), hist, c?.text, c ? videoLink(c.url, c.t) : ""].map(clean).join("	");
    });
    return [head.join("	"), ...rows].join(`
`) + `
`;
  }
  function buildEventsTsv(logs, since = 0) {
    let head = ["time", "event", "word", "detail", "url"], rows = logs.filter((e) => e.at > since).map((e) => {
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
    return [head.join("	"), ...rows].join(`
`) + `
`;
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
    clearTimeout(timer), timer = setTimeout(() => writeFeed(store2, folder).catch((e) => console.warn("[chinese-brain] feed", e)), 2 * 6e4);
  }
  async function writeFeed(store2, folder) {
    let logs = await store2.allLogs(), words = [...store2.words.values()], files = {
      "words.tsv": buildWordsTsv(words),
      "events.tsv": buildEventsTsv(logs),
      "README.md": FEED_README
    };
    for (let [name, content] of Object.entries(files)) {
      let url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
      try {
        let id = await browser.downloads.download({
          url,
          filename: `${folder}/${name}`,
          conflictAction: "overwrite",
          saveAs: !1
        });
        await waitForDownload(id), await browser.downloads.erase({ id });
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 3e4);
      }
    }
    return await browser.storage.local.set({ feedWrittenAt: Date.now() }), !0;
  }
  function waitForDownload(id) {
    return new Promise((resolve) => {
      let done = () => {
        browser.downloads.onChanged.removeListener(listener), resolve();
      }, listener = (d) => {
        d.id === id && d.state && d.state.current !== "in_progress" && done();
      };
      browser.downloads.onChanged.addListener(listener), setTimeout(done, 1e4);
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
      let all = await browser.storage.local.get(null);
      for (let [k, v] of Object.entries(all))
        k.startsWith("w:") && this.words.set(k.slice(2), v);
    }
    statuses() {
      let out = {};
      for (let [w, r] of this.words) out[w] = r.s;
      return out;
    }
    async setStatus(word, status, entry, ctx) {
      let now = Date.now(), prev = this.words.get(word);
      if (this.log({ at: now, k: "status", w: word, s: status, from: prev?.s ?? null }), !status) {
        this.words.delete(word), await browser.storage.local.remove("w:" + word), this.onChange?.();
        return;
      }
      let rec = prev ?? { w: word, s: status, added: now, updated: now, hist: [], looks: 0, ctx: [] };
      prev?.s !== status && rec.hist.push({ t: now, s: status }), rec.s = status, rec.updated = now, entry && (rec.p = numberedToMarked(entry.tw || entry.py), rec.g = shortGloss(entry)), ctx && addContext(rec, ctx), this.words.set(word, rec), await browser.storage.local.set({ ["w:" + word]: rec }), this.onChange?.();
    }
    /** A deliberate lookup (click, or a popup that stayed open). */
    async looked(word, src, url, ctx) {
      let now = Date.now(), last = this.recentLooks.get(word) ?? 0;
      if (now - last < 10 * 6e4) return;
      this.recentLooks.set(word, now), this.log({ at: now, k: "look", w: word, src, url });
      let rec = this.words.get(word);
      rec && (rec.looks++, ctx && addContext(rec, ctx), await browser.storage.local.set({ ["w:" + word]: rec }), this.onChange?.());
    }
    log(ev) {
      this.pendingLog.push(ev), clearTimeout(this.logTimer), this.logTimer = setTimeout(() => this.flushLog(), 3e3);
    }
    async flushLog() {
      if (!this.pendingLog.length) return;
      let byDay = /* @__PURE__ */ new Map();
      for (let ev of this.pendingLog) {
        let k = "log:" + dayKeyLocal(ev.at);
        byDay.has(k) || byDay.set(k, []), byDay.get(k).push(ev);
      }
      this.pendingLog = [];
      let existing = await browser.storage.local.get([...byDay.keys()]), update = {};
      for (let [k, evs] of byDay) update[k] = [...existing[k] ?? [], ...evs];
      await browser.storage.local.set(update), this.onChange?.();
    }
    async allLogs() {
      await this.flushLog();
      let all = await browser.storage.local.get(null);
      return Object.keys(all).filter((k) => k.startsWith("log:")).sort().flatMap((k) => all[k]);
    }
    /** Bulk import (known-words file, backups). Existing records keep their history. */
    async importWords(recs, mode = "merge") {
      let update = {};
      for (let r of recs) {
        let prev = this.words.get(r.w);
        prev && mode === "merge" && (prev.s === r.s || r.updated <= prev.updated) || (this.words.set(r.w, r), update["w:" + r.w] = r);
      }
      return Object.keys(update).length && await browser.storage.local.set(update), this.onChange?.(), Object.keys(update).length;
    }
  };
  function addContext(rec, ctx) {
    let text = ctx.text.trim().slice(0, 300);
    text && (rec.ctx.some((c) => c.text === text) || (rec.ctx.unshift({ ...ctx, text }), rec.ctx = rec.ctx.slice(0, 5)));
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
        let filter = browser.webRequest.filterResponseData(details.requestId), chunks = [];
        return filter.ondata = (e) => {
          chunks.push(e.data), filter.write(e.data);
        }, filter.onstop = () => {
          filter.close();
          let body = new TextDecoder("utf-8").decode(concat(chunks)), item = { url: details.url, body, at: Date.now() }, list = (cache.get(details.tabId) ?? []).filter((x) => Date.now() - x.at < 30 * 6e4);
          list.push(item), cache.set(details.tabId, list.slice(-12)), browser.tabs.sendMessage(details.tabId, { type: "ytCaptions", url: details.url, body }, { frameId: details.frameId }).catch(() => {
          });
        }, filter.onerror = () => {
          try {
            filter.disconnect();
          } catch {
          }
        }, {};
      },
      { urls: ["*://*.youtube.com/api/timedtext*"] },
      ["blocking"]
    ), browser.tabs.onRemoved.addListener((tabId) => cache.delete(tabId));
  }
  function cachedCaptions(tabId) {
    return cache.get(tabId) ?? [];
  }
  function concat(chunks) {
    let total = chunks.reduce((n, c) => n + c.byteLength, 0), out = new Uint8Array(total), off = 0;
    for (let c of chunks)
      out.set(new Uint8Array(c), off), off += c.byteLength;
    return out;
  }

  // src/background/index.ts
  var dict, dictReady = loadDictionary(), store = new Store(), storeReady = store.load();
  startCaptionCapture();
  async function loadDictionary() {
    let t0 = performance.now(), stream = (await fetch(browser.runtime.getURL("data/dict.tsv.gz"))).body.pipeThrough(new DecompressionStream("gzip")), text = await new Response(stream).text();
    return dict = Dictionary.fromTsv(text), console.log(`[chinese-brain] dictionary: ${dict.entries.length} entries in ${Math.round(performance.now() - t0)} ms`), dict;
  }
  async function getSettings() {
    let { settings } = await browser.storage.local.get("settings");
    return { ...DEFAULT_SETTINGS, ...settings };
  }
  store.onChange = () => {
    getSettings().then((s) => s.feedFolder && scheduleFeed(store, s.feedFolder));
  };
  browser.runtime.onMessage.addListener((msg, sender) => {
    let m = msg;
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
        return storeReady.then(() => store.setStatus(m.word, m.status, m.entry, m.ctx)).then(() => !0);
      case "looked":
        return storeReady.then(() => store.looked(m.word, m.src, m.url, m.ctx)).then(() => !0);
      case "watch":
        return store.log({ at: Date.now(), k: "watch", url: m.url, title: m.title, secs: m.secs, coverage: m.coverage, lang: m.lang }), Promise.resolve(!0);
      case "settings":
        return getSettings();
      case "saveSettings":
        return getSettings().then((s) => browser.storage.local.set({ settings: { ...s, ...m.settings } }).then(() => !0));
    }
    let any = msg;
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
        return sender.tab?.id != null ? browser.tabs.insertCSS(sender.tab.id, { code: any.css, frameId: sender.frameId ?? 0 }).then(() => !0) : void 0;
      case "bulkStatus":
        return Promise.all([dictReady, storeReady]).then(async ([d]) => {
          let status = any.status, now = Date.now(), recs = [], seen = /* @__PURE__ */ new Set();
          for (let raw of any.words) {
            let e = d.get(raw)[0], w = e?.trad ?? raw;
            if (seen.has(w) || any.onlyNew && store.words.has(w)) continue;
            seen.add(w);
            let prev = store.words.get(w);
            recs.push({
              ...prev ?? { w, added: now, hist: [], looks: 0, ctx: [] },
              s: status,
              updated: now,
              hist: [...prev?.hist ?? [], { t: now, s: status }],
              p: e ? numberedToMarked(e.tw || e.py) : prev?.p,
              g: e ? shortGloss(e) : prev?.g
            });
          }
          for (let r of recs) store.log({ at: now, k: "status", w: r.w, s: status, from: store.words.get(r.w)?.s ?? null });
          return store.importWords(recs, "replace");
        });
      case "tocflWords":
        return dictReady.then((d) => [...new Set(d.entries.filter((e) => e.tocfl && e.tocfl <= any.level).map((e) => e.trad))]);
      case "openPage":
        return;
      case "entries":
        return dictReady.then((d) => d.get(any.word));
    }
  });
  browser.commands.onCommand.addListener(async (cmd) => {
    if (cmd === "toggle-lookup") {
      let s = await getSettings(), hoverMode = s.hoverMode === "off" ? "hover" : "off";
      await browser.storage.local.set({ settings: { ...s, hoverMode } });
    }
  });
})();
