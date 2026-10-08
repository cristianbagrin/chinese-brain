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
      return d.computeRanks(), d;
    }
    /** Frequency rank per headword (1 = most common), from the Zipf scores. */
    computeRanks() {
      let best = /* @__PURE__ */ new Map();
      for (let e of this.entries) e.zipf > (best.get(e.trad) ?? 0) && best.set(e.trad, e.zipf);
      let order = [...best].sort((a, b) => b[1] - a[1]), rank = /* @__PURE__ */ new Map();
      order.forEach(([w], i) => rank.set(w, i + 1));
      for (let e of this.entries) e.rank = rank.get(e.trad) ?? 0;
    }
    /** The best entry for a single character read as `syllable` (numbered, e.g. "dian4"). */
    charEntry(ch, syllable) {
      let all = this.get(ch), list = all.filter((e) => e.trad === ch).length ? all.filter((e) => e.trad === ch) : all, v = /variant of ([^|\[\s]+)\|/.exec(list.map((e) => e.defs.join("/")).join("/"));
      if (v && list.every((e) => /^\(classical\)|variant of/.test(e.defs[0] ?? "") || e.defs.length <= 2)) {
        let main = this.get(v[1]).filter((e) => e.trad === v[1]);
        main.length && (list = main);
      }
      if (!syllable) return list[0];
      let read = (e) => (e.tw || e.py).toLowerCase(), want = syllable.toLowerCase(), bare = (x) => x.replace(/[1-5]$/, "");
      return list.find((e) => read(e) === want) ?? list.find((e) => bare(read(e)) === bare(want)) ?? list[0];
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
    ytEnabled: !0,
    subPinyin: !1,
    translation: "blur",
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    markUntracked: !0,
    subFontSize: 30,
    shadowFactor: 1.5,
    cardPinyin: "show",
    sounds: !0,
    pageColors: !1,
    speechRate: 0.9,
    azureKey: "",
    azureRegion: "eastasia",
    azureVoice: "zh-TW-HsiaoChenNeural",
    geminiKey: "",
    geminiModel: "gemini-3.8-flash"
  };

  // src/shared/time.ts
  function dayKeyLocal(t) {
    let d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/background/store.ts
  var Store = class {
    words = /* @__PURE__ */ new Map();
    pendingLog = [];
    logTimer;
    recentLooks = /* @__PURE__ */ new Map();
    async load() {
      let all = await browser.storage.local.get(null), migrate = {};
      for (let [k, v] of Object.entries(all)) {
        if (!k.startsWith("w:")) continue;
        let rec = v;
        (rec.s === "difficult" || rec.hist.some((h) => h.s === "difficult")) && (rec.s === "difficult" && (rec.s = "learning"), rec.hist = rec.hist.map((h) => h.s === "difficult" ? { ...h, s: "learning" } : h), migrate[k] = rec), this.words.set(k.slice(2), rec);
      }
      Object.keys(migrate).length && await browser.storage.local.set(migrate);
    }
    statuses() {
      let out = {};
      for (let [w, r] of this.words) out[w] = r.s;
      return out;
    }
    async setStatus(word, status, entry, ctx) {
      let now = Date.now(), prev = this.words.get(word);
      if (this.log({ at: now, k: "status", w: word, s: status, from: prev?.s ?? null }), !status) {
        this.words.delete(word), await browser.storage.local.remove("w:" + word);
        return;
      }
      let rec = prev ?? { w: word, s: status, added: now, updated: now, hist: [], looks: 0, ctx: [] };
      prev?.s !== status && rec.hist.push({ t: now, s: status }), rec.s = status, rec.updated = now, entry && (rec.p = numberedToMarked(entry.tw || entry.py), rec.g = shortGloss(entry)), ctx && addContext(rec, ctx), this.words.set(word, rec), await browser.storage.local.set({ ["w:" + word]: rec });
    }
    /** A deliberate lookup (click, or a popup that stayed open). */
    async looked(word, src, url, ctx) {
      let now = Date.now(), last = this.recentLooks.get(word) ?? 0;
      if (now - last < 10 * 6e4) return;
      this.recentLooks.set(word, now), this.log({ at: now, k: "look", w: word, src, url });
      let rec = this.words.get(word);
      rec && (rec.looks++, ctx && addContext(rec, ctx), await browser.storage.local.set({ ["w:" + word]: rec }));
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
      await browser.storage.local.set(update);
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
      return Object.keys(update).length && await browser.storage.local.set(update), Object.keys(update).length;
    }
  };
  function addContext(rec, ctx) {
    let text = ctx.text.trim().slice(0, 300);
    text && (rec.ctx.some((c) => c.text === text) || (rec.ctx.unshift({ ...ctx, text }), rec.ctx = rec.ctx.slice(0, 5)));
  }
  function shortGloss(e) {
    return e.defs.filter((d) => !d.startsWith("CL:")).slice(0, 3).join("; ").slice(0, 120);
  }

  // src/background/gemini.ts
  var PROMPT = `Transcribe all spoken Mandarin Chinese in this video, verbatim, in Traditional Chinese characters as used in Taiwan (\u53F0\u7063\u6B63\u9AD4\u5B57).
Split it into subtitle lines at natural pauses, about 1 to 4 seconds and at most about 20 characters each.
For each line give start and end times in seconds from the start of the video, the Chinese text, and a natural English translation.
If someone speaks Taiwanese Hokkien or another language, transcribe what you can and translate it.
Do not summarise, do not skip lines, do not add commentary.`, SCHEMA = {
    type: "object",
    properties: {
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            start: { type: "number" },
            end: { type: "number" },
            zh: { type: "string" },
            en: { type: "string" }
          },
          required: ["start", "end", "zh", "en"]
        }
      }
    },
    required: ["lines"]
  };
  async function geminiTranscribe(videoId, key, model) {
    let cacheKey = "gem:" + videoId, cached = (await browser.storage.local.get(cacheKey))[cacheKey];
    if (cached?.length) return cached;
    let call = async (structured) => {
      let body = {
        model,
        input: [
          { type: "text", text: PROMPT },
          { type: "video", uri: `https://www.youtube.com/watch?v=${videoId}` }
        ]
      };
      structured && (body.response_format = { type: "text", mime_type: "application/json", schema: SCHEMA });
      let res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        let raw = await res.text(), msg = raw.slice(0, 200);
        try {
          let j = JSON.parse(raw);
          msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
        } catch {
        }
        throw new Error(`Gemini (HTTP ${res.status}): ${msg}`);
      }
      return ((await res.json()).steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
    }, text;
    try {
      text = await call(!0);
    } catch (e) {
      if (!/HTTP 400/.test(String(e)) || /API key/i.test(String(e))) throw e;
      text = await call(!1);
    }
    let json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")), lines = (Array.isArray(json) ? json : json.lines ?? []).filter((l) => l && typeof l.zh == "string" && l.zh.trim()).map((l) => ({ start: Number(l.start) || 0, end: Number(l.end) || Number(l.start) + 2, zh: l.zh.trim(), en: (l.en ?? "").trim() })).sort((a, b) => a.start - b.start);
    if (!lines.length) throw new Error("Gemini returned no lines");
    return await browser.storage.local.set({ [cacheKey]: lines }), lines;
  }

  // src/background/translate.ts
  var ENDPOINT = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t";
  async function translateLines(lines, sl, tl) {
    let out = new Array(lines.length).fill(""), batch = [], size = 0, flush = async () => {
      if (!batch.length) return;
      let ids = batch;
      batch = [], size = 0;
      let q = ids.map((i) => lines[i].replace(/\n/g, " ")).join(`
`), res = await fetch(`${ENDPOINT}&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "q=" + encodeURIComponent(q)
      });
      if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
      let parts = (await res.json())[0].map((seg) => seg[0]).join("").split(`
`);
      parts.length === ids.length && ids.forEach((i, k) => out[i] = parts[k].trim());
    };
    for (let i = 0; i < lines.length; i++)
      size + lines[i].length > 3e3 && await flush(), batch.push(i), size += lines[i].length + 1;
    return await flush(), out;
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
  var examples = /* @__PURE__ */ new Map(), examplesReady = loadExamples();
  async function loadExamples() {
    try {
      let res = await fetch(browser.runtime.getURL("data/examples.tsv.gz"));
      if (!res.ok) return;
      let text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
      for (let line of text.split(`
`)) {
        let [w, zh, en] = line.split("	");
        if (!w || !zh) continue;
        let list = examples.get(w);
        list ? list.push([zh, en ?? ""]) : examples.set(w, [[zh, en ?? ""]]);
      }
    } catch {
    }
  }
  async function loadDictionary() {
    let t0 = performance.now(), stream = (await fetch(browser.runtime.getURL("data/dict.tsv.gz"))).body.pipeThrough(new DecompressionStream("gzip")), text = await new Response(stream).text();
    return dict = Dictionary.fromTsv(text), console.log(`[chinese-brain] dictionary: ${dict.entries.length} entries in ${Math.round(performance.now() - t0)} ms`), dict;
  }
  async function getSettings() {
    let { settings } = await browser.storage.local.get("settings");
    return { ...DEFAULT_SETTINGS, ...settings };
  }
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
      case "insertCSS":
        return sender.tab?.id != null ? browser.tabs.insertCSS(sender.tab.id, { code: any.css, frameId: sender.frameId ?? 0 }).then(() => !0) : void 0;
      case "importList":
        return Promise.all([dictReady, storeReady]).then(async ([d]) => {
          let recs = [], seen = /* @__PURE__ */ new Set();
          for (let item of any.items) {
            let e = d.get(item.w)[0], w = e && e.trad.length === item.w.length ? e.trad : item.w;
            if (seen.has(w)) continue;
            seen.add(w);
            let prev = store.words.get(w);
            if (prev?.s === item.s) continue;
            let t = item.t || Date.now();
            recs.push({
              ...prev ?? { w, added: t, hist: [], looks: 0, ctx: [] },
              s: item.s,
              updated: Math.max(t, prev?.updated ?? 0),
              hist: [...prev?.hist ?? [], { t, s: item.s }],
              p: e ? numberedToMarked(e.tw || e.py) : prev?.p,
              g: e ? shortGloss(e) : prev?.g
            });
          }
          for (let r of recs) store.log({ at: Date.now(), k: "status", w: r.w, s: r.s, from: store.words.get(r.w)?.s ?? null });
          return store.importWords(recs, "replace");
        });
      case "testSet":
        return;
      case "openPage":
        return;
      case "translate":
        return translateLines(any.lines, String(any.sl ?? "zh-TW"), String(any.tl ?? "en")).catch((e) => (console.warn("[chinese-brain] translate fallback failed", e), null));
      case "azureTTS":
        return getSettings().then(async (st) => {
          let res = await fetch(`https://${st.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": st.azureKey,
              "Content-Type": "application/ssml+xml",
              "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
            },
            body: any.ssml
          });
          if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
          return res.arrayBuffer();
        });
      case "wordInfo":
        return Promise.all([dictReady, storeReady, examplesReady]).then(([d]) => {
          let word = any.word, sylls = String(any.py ?? "").split(/\s+/);
          return { chars: [...word].length > 1 ? [...word].map((ch, i) => {
            let e = d.charEntry(ch, sylls[i]);
            return { ch, py: sylls[i] ?? e?.tw ?? e?.py ?? "", gloss: e ? shortGloss(e) : "" };
          }) : [], examples: examples.get(word) ?? [], record: store.words.get(word) ?? null };
        });
      case "glosses":
        return dictReady.then((d) => {
          let out = {};
          for (let w of any.words) {
            let e = d.get(w)[0];
            e && (out[w] = { py: e.tw || e.py, g: shortGloss(e), zipf: e.zipf });
          }
          return out;
        });
      case "gemini":
        return getSettings().then(async (st) => {
          if (!st.geminiKey) return { error: "Add your Gemini API key in Settings first." };
          try {
            return { lines: await geminiTranscribe(String(any.videoId), st.geminiKey, st.geminiModel || "gemini-3.8-flash") };
          } catch (e) {
            return { error: String(e instanceof Error ? e.message : e) };
          }
        });
      case "geminiCached":
        return browser.storage.local.get("gem:" + any.videoId).then((r) => r["gem:" + any.videoId] ?? null);
      case "entries":
        return dictReady.then((d) => d.get(any.word));
    }
  });
})();
