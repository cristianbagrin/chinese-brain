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
     * maximizing the summed log-frequency (a unigram model, like jieba).
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
  }, LOW_VALUE = /^(old )?variant of|^see |^surname |^used in |^\(old\)|^archaic /i, PREFERRED = {
    \u8981: "yao4",
    \u8457: "zhe5",
    \u7740: "zhe5",
    \u770B: "kan4",
    \u884C: "xing2",
    \u91CD: "zhong4",
    \u80CC: "bei4",
    \u6559: "jiao4",
    \u7A7A: "kong1"
  };
  function rankEntries(entries, query) {
    let rank = (e) => {
      let r = 0;
      return e.trad !== query && (r += 1), PREFERRED[query] === (e.tw || e.py) && (r -= 1), /^[A-Z]/.test(e.py) && (r += 4), LOW_VALUE.test(e.defs[0] ?? "") && (r += 8), e.defs.every((d) => /^(old )?variant of|^see /i.test(d)) && (r += 8), r;
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
    if (!m) return syl.toLowerCase();
    let [, raw, toneStr] = m, tone = Number(toneStr) - 1, base = raw.toLowerCase().replace(/u:/g, "\xFC").replace(/v/g, "\xFC"), idx = base.search(/[ae]/);
    if (idx < 0 && (idx = base.indexOf("ou")), idx < 0) {
      for (let i = base.length - 1; i >= 0; i--)
        if ("aeiou\xFC".includes(base[i])) {
          idx = i;
          break;
        }
    }
    if (idx < 0) return base;
    let marked = MARKS[base[idx]][tone];
    return base.slice(0, idx) + marked + base.slice(idx + 1);
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
    pinyin: !0,
    translation: "blur",
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    markUntracked: !0,
    subFontSize: 30,
    subStyle: "light",
    shadowFactor: 1.5,
    cardSize: "normal",
    cardColors: !0,
    sounds: !0,
    pageColors: !1,
    speechRate: 0.9,
    voice: "google",
    azureKey: "",
    azureRegion: "eastasia",
    azureVoice: "zh-TW-HsiaoChenNeural",
    geminiKey: "",
    geminiModel: "gemini-3.8-flash"
  };
  function normalizeSettings(raw) {
    let r = { ...raw ?? {} };
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), delete r.subPinyin, delete r.cardPinyin, { ...DEFAULT_SETTINGS, ...r };
  }

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
  var API = "https://generativelanguage.googleapis.com/v1beta", TRANSCRIBE = `Transcribe all spoken Mandarin Chinese in this video, verbatim, in Traditional Chinese characters as used in Taiwan (\u53F0\u7063\u6B63\u9AD4\u5B57).
Split it into subtitle lines at natural pauses, about 1 to 4 seconds and at most about 20 characters each.
For each line give start and end times in seconds from the start of the video (numbers, e.g. 83.5), the Chinese text, and a natural American English translation.
If someone speaks Taiwanese Hokkien or another language, transcribe what you can and translate it.
Do not summarize, do not skip lines, do not add commentary. If nobody speaks Chinese, return an empty list.`, LINES_SCHEMA = {
    type: "OBJECT",
    properties: {
      lines: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            start: { type: "NUMBER" },
            end: { type: "NUMBER" },
            zh: { type: "STRING" },
            en: { type: "STRING" }
          },
          required: ["start", "end", "zh", "en"]
        }
      }
    },
    required: ["lines"]
  };
  async function errorMessage(res) {
    let raw = await res.text(), msg = raw.slice(0, 200);
    try {
      let j = JSON.parse(raw);
      msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
    } catch {
    }
    return res.status === 400 && /API key/i.test(msg) ? "Gemini rejected the API key. Copy it again from aistudio.google.com/apikey." : res.status === 403 ? `Gemini refused the request (403): ${msg}` : res.status === 404 ? "This Gemini model is not available for your key. Pick another one in Settings." : res.status === 429 ? "Gemini rate limit or free quota reached (429). Try again later or pick a lighter model." : `Gemini (HTTP ${res.status}): ${msg}`;
  }
  async function generate(key, model, parts, generationConfig) {
    let res = await fetch(`${API}/models/${encodeURIComponent(model.replace(/^models\//, ""))}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig })
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    let data = await res.json();
    if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason}).`);
    let cand = data.candidates?.[0];
    return { text: (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join(""), finish: cand?.finishReason ?? "" };
  }
  function seconds(v) {
    if (typeof v == "number") return v;
    let parts = String(v ?? "").trim().split(":").map(Number);
    return parts.some((n) => !Number.isFinite(n)) ? NaN : parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  function parseLines(text) {
    let body = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""), raw = [];
    try {
      let json = JSON.parse(body);
      raw = Array.isArray(json) ? json : json.lines ?? [];
    } catch {
      for (let m of body.matchAll(/\{[^{}]*\}/g))
        try {
          raw.push(JSON.parse(m[0]));
        } catch {
        }
    }
    return raw.filter((l) => l && typeof l.zh == "string" && l.zh.trim()).map((l) => {
      let start = seconds(l.start), end = seconds(l.end);
      return { start, end: Number.isFinite(end) && end > start ? end : start + 2, zh: String(l.zh).trim(), en: String(l.en ?? "").trim() };
    }).filter((l) => Number.isFinite(l.start)).sort((a, b) => a.start - b.start);
  }
  async function geminiTranscribe(videoId, key, model) {
    let cacheKey = "gem:" + videoId, cached = (await browser.storage.local.get(cacheKey))[cacheKey];
    if (cached?.length) return cached;
    let parts = [{ file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } }, { text: TRANSCRIBE }], config = {
      responseMimeType: "application/json",
      responseSchema: LINES_SCHEMA,
      maxOutputTokens: 65536,
      temperature: 0.2,
      // Fewer tokens per second of video, so long videos fit the free tier.
      mediaResolution: "MEDIA_RESOLUTION_LOW"
    }, out;
    try {
      out = await generate(key, model, parts, config);
    } catch (e) {
      if (!/HTTP 400/.test(String(e))) throw e;
      out = await generate(key, model, parts, { responseMimeType: "application/json" });
    }
    let lines = parseLines(out.text);
    if (!lines.length)
      throw out.finish === "SAFETY" || out.finish === "RECITATION" || out.finish === "PROHIBITED_CONTENT" ? new Error(`Gemini stopped (${out.finish}).`) : out.text.trim() ? new Error("Gemini heard no Mandarin in this video.") : new Error(`Gemini sent an empty reply${out.finish ? ` (${out.finish})` : ""}. Try again, or pick another model in Settings.`);
    return await browser.storage.local.set({ [cacheKey]: lines }), lines;
  }
  async function geminiModels(key) {
    let out = [], page = "";
    do {
      let res = await fetch(`${API}/models?pageSize=200${page ? `&pageToken=${page}` : ""}`, { headers: { "x-goog-api-key": key.trim() } });
      if (!res.ok) throw new Error(await errorMessage(res));
      let data = await res.json();
      for (let m of data.models ?? []) {
        let id = m.name.replace(/^models\//, "");
        m.supportedGenerationMethods?.includes("generateContent") && (!/^gemini-/.test(id) || /embedding|image|tts|audio|live|robotics|computer-use|aqa/.test(id) || out.push({ id, name: m.displayName || id }));
      }
      page = data.nextPageToken ?? "";
    } while (page);
    let ver = (id) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0), tier = (id) => /flash-lite/.test(id) ? 1 : /flash/.test(id) ? 0 : 2, preview = (id) => /preview|exp/.test(id) ? 1 : 0;
    return out.sort((a, b) => ver(b.id) - ver(a.id) || preview(a.id) - preview(b.id) || tier(a.id) - tier(b.id) || a.id.localeCompare(b.id));
  }
  async function geminiExamples(word, gloss, key, model) {
    let cacheKey = "gex:" + word, cached = (await browser.storage.local.get(cacheKey))[cacheKey];
    if (cached?.length) return cached;
    let prompt = `Write two natural example sentences that a Taiwanese person would really say or write, using the word \u300C${word}\u300D (${gloss}).
Use Traditional Chinese characters as used in Taiwan and Taiwan vocabulary (not Mainland forms, no \u5152\u5316).
The first sentence: 12 to 25 characters, showing typical everyday usage. The second: short and simple, under 12 characters.
Give each with a natural American English translation.`, schema = {
      type: "OBJECT",
      properties: { examples: { type: "ARRAY", items: { type: "OBJECT", properties: { zh: { type: "STRING" }, en: { type: "STRING" } }, required: ["zh", "en"] } } },
      required: ["examples"]
    }, { text } = await generate(key, model, [{ text: prompt }], { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7 }), list = (JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")).examples ?? []).filter((x) => x.zh?.includes(word)).slice(0, 2).map((x) => [x.zh.trim(), (x.en ?? "").trim()]);
    if (!list.length) throw new Error("Gemini wrote no usable sentences.");
    return await browser.storage.local.set({ [cacheKey]: list }), list;
  }

  // src/background/speech.ts
  var AZURE_REGIONS = [
    "eastasia",
    "southeastasia",
    "japaneast",
    "koreacentral",
    "westeurope",
    "northeurope",
    "uksouth",
    "francecentral",
    "germanywestcentral",
    "swedencentral",
    "switzerlandnorth",
    "norwayeast",
    "italynorth",
    "eastus",
    "eastus2",
    "westus",
    "westus2",
    "westus3",
    "centralus",
    "northcentralus",
    "southcentralus",
    "westcentralus",
    "canadacentral",
    "brazilsouth",
    "australiaeast",
    "centralindia",
    "japanwest",
    "southafricanorth",
    "uaenorth",
    "qatarcentral"
  ], xml = (s) => s.replace(/[<&>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  async function ttsAudio(engine, text, st) {
    if (engine === "google") {
      let url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-TW&ttsspeed=${st.speechRate < 0.75 ? "0.24" : "1"}&q=${encodeURIComponent(text.slice(0, 200))}`, res2 = await fetch(url);
      if (!res2.ok) throw new Error(`Google voice: HTTP ${res2.status}`);
      return res2.arrayBuffer();
    }
    if (!st.azureKey) throw new Error("No Azure key");
    let pct = Math.round((st.speechRate - 1) * 100), ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW"><voice name="${xml(st.azureVoice)}"><prosody rate="${pct}%">${xml(text)}</prosody></voice></speak>`, res = await fetch(`https://${st.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": st.azureKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3"
      },
      body: ssml
    });
    if (!res.ok) throw new Error(azureError(res.status));
    return res.arrayBuffer();
  }
  function azureError(status) {
    return status === 401 ? 'Azure rejected the key for this region (401). Press "Check key" to find the right region.' : status === 429 ? "Azure: too many requests or the free monthly quota is used up (429)." : status === 400 ? "Azure: bad request (400). Try another voice." : `Azure: HTTP ${status}`;
  }
  async function azureKeyWorks(key, region) {
    try {
      return (await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
        headers: { "Ocp-Apim-Subscription-Key": key }
      })).status;
    } catch {
      return 0;
    }
  }
  async function checkAzure(key, region) {
    if (key = key.trim(), !key) return { ok: !1, error: "Paste your Azure Speech key first." };
    let first = await azureKeyWorks(key, region);
    if (first === 200) return { ok: !0, region };
    if (first === 0) return { ok: !1, error: "Could not reach Azure. Check your connection." };
    if (first !== 401 && first !== 403) return { ok: !1, error: azureError(first) };
    let others = AZURE_REGIONS.filter((r) => r !== region), hit = (await Promise.all(others.map(async (r) => [r, await azureKeyWorks(key, r)]))).find(([, st]) => st === 200);
    return hit ? { ok: !0, region: hit[0] } : { ok: !1, error: 'Azure did not accept this key in any region. Copy "KEY 1" from your Speech resource in the Azure portal.' };
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
      size + lines[i].length > 3e3 && await flush().catch(() => {
      }), batch.push(i), size += lines[i].length + 1;
    if (await flush().catch(() => {
    }), out.every((x) => !x)) throw new Error("translate: no batch succeeded");
    return out;
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
    return normalizeSettings(settings);
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
            prev && item.t && prev.updated > item.t || recs.push({
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
      case "tts":
        return getSettings().then(
          (st) => ttsAudio(any.engine, String(any.text), st).then(
            (audio) => ({ audio }),
            (e) => ({ error: String(e instanceof Error ? e.message : e) })
          )
        );
      case "azureCheck":
        return checkAzure(String(any.key ?? ""), String(any.region ?? "eastasia"));
      case "geminiModels":
        return geminiModels(String(any.key ?? "")).then(
          (models) => ({ models }),
          (e) => ({ error: String(e instanceof Error ? e.message : e) })
        );
      case "geminiExamples":
        return Promise.all([getSettings(), dictReady]).then(async ([st, d]) => {
          if (!st.geminiKey) return { error: "Add a Gemini API key in Settings first." };
          let word = String(any.word), e = d.get(word)[0];
          try {
            return await geminiExamples(word, e ? shortGloss(e) : "", st.geminiKey, st.geminiModel), { ok: !0 };
          } catch (err) {
            return { error: String(err instanceof Error ? err.message : err) };
          }
        });
      case "wordInfo":
        return Promise.all([dictReady, storeReady, examplesReady]).then(async ([d]) => {
          let word = any.word, sylls = String(any.py ?? "").split(/\s+/), chars = [...word].length > 1 ? [...word].map((ch, i) => {
            let e = d.charEntry(ch, sylls[i]);
            return { ch, py: sylls[i] ?? e?.tw ?? e?.py ?? "", gloss: e ? shortGloss(e) : "" };
          }) : [], record = store.words.get(word) ?? null, gex = (await browser.storage.local.get("gex:" + word))["gex:" + word] ?? [], ex = (examples.get(word)?.length ? examples.get(word) : gex).slice(0, 2).map(([zh, en]) => ({ zh, en, toks: d.segment(zh) })), seen = (record?.ctx ?? []).slice(0, 4).map((c) => {
            let zh = c.text.split(" \u2014 ")[0];
            return { ...c, zh, toks: d.segment(zh) };
          });
          return { chars, examples: ex, seen, record };
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
            return { lines: await geminiTranscribe(String(any.videoId), st.geminiKey, st.geminiModel || DEFAULT_SETTINGS.geminiModel) };
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
