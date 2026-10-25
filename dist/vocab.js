"use strict";
(() => {
  // src/shared/types.ts
  var STATUS_CODE = { fresh: "F", learning: "L", known: "K" }, DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    ytEnabled: !0,
    pinyin: !0,
    translation: "blur",
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    subFontSize: 30,
    subStyle: "light",
    shadowFactor: 1.5,
    cardSize: "normal",
    cardColors: !0,
    sounds: !0,
    pageColors: !1,
    siteColors: {},
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
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), r.hoverMode === "shift" && (r.hoverMode = "alt"), delete r.subPinyin, delete r.cardPinyin, delete r.markUntracked, { ...DEFAULT_SETTINGS, ...r };
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/content/state.ts
  var State = class {
    settings = { ...DEFAULT_SETTINGS };
    statuses = /* @__PURE__ */ new Map();
    statusesLoaded;
    settingsLoaded;
    listeners = /* @__PURE__ */ new Set();
    constructor() {
      this.settingsLoaded = browser.storage.local.get("settings").then(({ settings }) => {
        this.settings = normalizeSettings(settings);
      }), browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = !1;
        for (let [k, ch] of Object.entries(changes))
          if (k === "settings")
            this.settings = normalizeSettings(ch.newValue), dirty = !0;
          else if (k.startsWith("w:") && this.statusesLoaded) {
            let rec = ch.newValue;
            rec ? this.statuses.set(k.slice(2), rec.s) : this.statuses.delete(k.slice(2)), dirty = !0;
          }
        dirty && this.listeners.forEach((l) => l());
      });
    }
    ready() {
      return this.settingsLoaded;
    }
    loadStatuses() {
      return this.statusesLoaded ??= browser.runtime.sendMessage({ type: "statuses" }).then((s) => {
        this.statuses = new Map(Object.entries(s)), this.listeners.forEach((l) => l());
      }), this.statusesLoaded;
    }
    status(word) {
      return word ? this.statuses.get(word) : void 0;
    }
    onChange(l) {
      return this.listeners.add(l), () => this.listeners.delete(l);
    }
    /** Color the words on this page? */
    colorsEnabled() {
      return this.siteEnabled() && colorsOn(this.settings, location.hostname);
    }
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(location.hostname);
    }
  }, state = new State();

  // src/content/audio.ts
  var ctx;
  function audio() {
    return ctx ??= new AudioContext(), ctx.state === "suspended" && ctx.resume(), ctx;
  }
  var sfx;
  function stampOut(ac) {
    if (!sfx) {
      let comp = ac.createDynamicsCompressor();
      comp.threshold.value = -12, comp.knee.value = 8, comp.ratio.value = 4, comp.attack.value = 2e-3, comp.release.value = 0.15;
      let out = ac.createGain();
      out.gain.value = 0.8, out.connect(comp).connect(ac.destination);
      let noise2 = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = noise2.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      sfx = { out, noise: noise2 };
    }
    return sfx;
  }
  function envelope(g, at, peak, attack, len) {
    g.gain.setValueAtTime(1e-4, at), g.gain.exponentialRampToValueAtTime(peak, at + attack), g.gain.exponentialRampToValueAtTime(1e-4, at + len);
  }
  function note(ac, freq, at, len, gain, type = "sine", to, drop = len / 2) {
    let o = ac.createOscillator(), g = ac.createGain();
    o.type = type, o.frequency.setValueAtTime(freq, at), to && o.frequency.exponentialRampToValueAtTime(to, at + drop), envelope(g, at, gain, 3e-3, len), o.connect(g).connect(stampOut(ac).out), o.start(at), o.stop(at + len + 0.03);
  }
  function noise(ac, at, len, gain, type, freq, q = 0.8) {
    let s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = stampOut(ac).noise, f.type = type, f.frequency.value = freq, f.Q.value = q, envelope(g, at, gain, 1e-3, len), s.connect(f).connect(g).connect(stampOut(ac).out), s.start(at, Math.random() * 0.5), s.stop(at + len + 0.03);
  }
  function thump(ac, at, freq, gain, len) {
    note(ac, freq, at, len, gain, "sine", freq * 0.42, len * 0.55), note(ac, freq * 2, at, len * 0.55, gain * 0.35, "sine", freq * 0.84, len * 0.4);
  }
  var STAMP = { fresh: [190, 1320], learning: [160, 880], known: [135, 660] };
  function stampSound(status) {
    if (state.settings.sounds)
      try {
        let ac = audio(), t = ac.currentTime + 5e-3;
        if (!status) {
          noise(ac, t, 0.03, 0.2, "bandpass", 1800, 0.9), thump(ac, t, 120, 0.25, 0.09);
          return;
        }
        let [thud, tick] = STAMP[status];
        noise(ac, t, 0.035, 0.5, "bandpass", 1100, 0.9), noise(ac, t, 0.07, 0.35, "lowpass", 420), thump(ac, t, thud, 0.75, 0.15), note(ac, tick, t + 0.03, 0.12, 0.07, "triangle"), status === "known" && note(ac, tick * 1.5, t + 0.03, 0.16, 0.05, "triangle");
      } catch {
      }
  }
  var voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ?? voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);

  // src/shared/context.ts
  var HAN = /[㐀-䶿一-鿿豈-﫿]/g, fold = (s) => s.replaceAll("\u81FA", "\u53F0");
  function findWord(text, word, alt) {
    let t = fold(text);
    for (let w of [word, alt]) {
      let i = w ? t.indexOf(fold(w)) : -1;
      if (w && i >= 0) return { i, len: w.length };
    }
  }
  function hasWord(text, word, alt) {
    return !!findWord(text, word, alt);
  }
  var CUES = /\[[^\]\n]{1,10}\]|［[^］\n]{1,10}］|【\d+】|\*[^*\n]{1,10}\*|[♪♫]/g;
  function cleanSentence(text, word, alt) {
    let uncue = (s) => s.replace(CUES, (cue) => hasWord(cue, word, alt) ? cue : " "), withWord = uncue(text).split(/\s*(?:[|｜]|\s[-–—]\s|(?<=[^\s\x00-\x7f])[-–—_](?=[^\s\x00-\x7f]))\s*/).map((p) => p.replace(/[ \t]+/g, " ").trim()).filter((p) => p && !/^(pdf|docx?|pptx?|xlsx?|html?|…|\.\.\.)$/i.test(p)).filter((p) => hasWord(p, word, alt));
    return withWord.length ? withWord.sort((a, b) => b.length - a.length)[0] : uncue(text).replace(/[ \t]+/g, " ").trim();
  }
  function usefulSentence(text, word) {
    let han = text.match(HAN)?.length ?? 0, latinWords = text.match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0;
    return han >= [...word].length + 2 && han * 2 >= latinWords * 3;
  }
  function quoted(s) {
    let inside = new Array(s.length).fill(!1), open = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (c === "\u300C" || c === "\u300E") open.push({ i, close: c === "\u300C" ? "\u300D" : "\u300F" });
      else if (c === "\u300D" || c === "\u300F") {
        let k = open.map((o) => o.close).lastIndexOf(c);
        if (k < 0) continue;
        let from = open[k].i;
        open.length = k;
        for (let j = from + 1; j < i; j++) inside[j] = !0;
      }
    }
    return inside;
  }
  function isStop(s, i, inside) {
    let c = s[i];
    return c === `
` || c === "\r" ? !0 : inside[i] ? !1 : "\u3002\uFF01\uFF1F".includes(c) ? !0 : ".!?".includes(c) && !/[0-9A-Za-z]/.test(s[i + 1] ?? "");
  }
  var CLOSER = /[」』"”’'）)】》〉\]]/;
  function sentenceBounds(s, pos) {
    let q = quoted(s), a = Math.min(Math.max(pos, 0), s.length);
    for (; a > 0 && !isStop(s, a - 1, q); ) a--;
    for (; a < pos && (CLOSER.test(s[a]) || /\s/.test(s[a])); ) a++;
    let b = Math.max(a, pos);
    for (; b < s.length && !isStop(s, b, q); ) b++;
    for (; b < s.length && isStop(s, b, q) && !/[\n\r]/.test(s[b]); ) b++;
    for (; b < s.length && CLOSER.test(s[b]); ) b++;
    return [a, b];
  }
  var segmenter = typeof Intl < "u" && "Segmenter" in Intl ? new Intl.Segmenter("zh-TW", { granularity: "word" }) : void 0;
  function trimAround(s, i, len, max) {
    if (s.length <= max) return s.trim();
    let cuts = segmenter ? [...segmenter.segment(s)].map((x) => x.index).concat(s.length) : [...s].map((_, k) => k).concat(s.length), a0 = Math.max(0, i - Math.floor((max - len) / 2)), b0 = Math.min(s.length, a0 + max);
    a0 = Math.max(0, b0 - max);
    let near = 12, clause = /[，、；：,;:\s（(「『]/, a = cuts.find((k) => k >= a0 && k <= i) ?? i;
    for (let k = a0; k <= Math.min(i, a0 + near); k++) if (k > 0 && clause.test(s[k - 1])) {
      a = k;
      break;
    }
    let b = [...cuts].reverse().find((k) => k <= b0 && k >= i + len) ?? i + len;
    for (let k = b0; k >= Math.max(i + len, b0 - near); k--) if (k < s.length && clause.test(s[k])) {
      b = k;
      break;
    }
    let mid = s.slice(a, b).trim().replace(/^[，、；：,;:]+|[，、；：,;:]+$/g, "");
    return `${a > 0 ? "\u2026" : ""}${mid}${b < s.length ? "\u2026" : ""}`;
  }
  function metSentence(c, word, max = 80) {
    let [zh, ...en] = c.text.split(" \u2014 "), hit = findWord(zh, word, c.q);
    if (!hit) return "";
    let [a, b] = sentenceBounds(zh, hit.i), one = cleanSentence(zh.slice(a, b), word, c.q), at = findWord(one, word, c.q);
    if (!at || !usefulSentence(one, word)) return "";
    let out = trimAround(one, at.i, at.len, max), english = en.join(" \u2014 ").replace(CUES, " ").replace(/\s+/g, " ").trim();
    return english && out === cleanSentence(zh, word, c.q) ? `${out} \u2014 ${english}` : out;
  }
  function shownSentence(ctx2, word, saved2 = [], max = 80) {
    let newest = [...saved2].sort((a, b) => b.at - a.at);
    for (let c of ctx2) {
      let inCard = metSentence(c, word, 120).split(" \u2014 ")[0], mine = inCard ? newest.find((s) => s.from === inCard || s.zh === inCard) : void 0;
      if (mine) return { c, text: mine.en ? `${mine.zh} \u2014 ${mine.en}` : mine.zh, edited: !0 };
    }
    for (let c of ctx2) {
      let text = metSentence(c, word, max);
      if (text) return { c, text };
    }
  }

  // src/shared/time.ts
  function dayKeyLocal(t) {
    let d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function clock(secs) {
    let s = Math.max(0, Math.floor(secs)), h2 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
    return h2 ? `${h2}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim(), stamp = (t) => {
    let d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, code = (s) => s ? STATUS_CODE[s] : "-";
  function shortSource(url, t) {
    try {
      let u = new URL(url);
      return u.hostname.endsWith("youtube.com") && u.searchParams.get("v") ? `youtu.be/${u.searchParams.get("v")}${t != null ? `?t=${Math.floor(t)}` : ""}` : u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  var SITES = [
    ["notion.so", "Notion"],
    ["notion.com", "Notion"],
    ["notion.site", "Notion"],
    ["youtube.com", "YouTube"],
    ["youtu.be", "YouTube"],
    ["gemini.google.com", "Gemini"],
    ["docs.google.com", "Google Docs"],
    ["fonts.google.com", "Google Fonts"],
    ["translate.google.com", "Google Translate"],
    ["chatgpt.com", "ChatGPT"],
    ["claude.ai", "Claude"],
    ["tally.so", "Tally"],
    ["wikipedia.org", "Wikipedia"],
    ["ptt.cc", "PTT"],
    ["dcard.tw", "Dcard"],
    ["facebook.com", "Facebook"],
    ["instagram.com", "Instagram"],
    ["threads.net", "Threads"],
    ["threads.com", "Threads"],
    ["reddit.com", "Reddit"],
    ["x.com", "X"],
    ["twitter.com", "X"],
    ["netflix.com", "Netflix"],
    ["line.me", "LINE"]
  ];
  function sourceName(url) {
    try {
      let host = new URL(url).hostname.replace(/^(www|m|app)\./, "");
      return SITES.find(([d]) => host === d || host.endsWith("." + d))?.[1] ?? host;
    } catch {
      return "";
    }
  }
  function duration(secs) {
    let m = Math.round(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }
  function buildClaudeExport(words2, logs2, since = 0, saved2 = {}) {
    let now = Date.now(), { rows, savedNow, watches } = exportRows(words2, logs2, since, saved2), lines = [
      `# Chinese Brain export \xB7 ${stamp(now)} \xB7 ${since ? `since ${stamp(since)}` : "everything so far"}`,
      "# Codes as in known-words.txt: K known, L learning, F fresh (met, not studied yet), - not in the list.",
      '# date = the day I set this status \xB7 sentence = where I met the word \xB7 saved = sentences I saved for a card, several joined with " \u2016 "',
      "# was = status before this period (- = new). Only status changes I made are listed.",
      `# ${rows.length} words \xB7 ${[...savedNow.values()].flat().length} saved sentences \xB7 ${watches.length} videos with subtitles (${duration(watches.reduce((n, e) => n + e.secs, 0))})`,
      ["word", "now", "was", "date", "pinyin", "meaning", "sentence", "source", "saved"].join("	")
    ];
    for (let r of rows) {
      let met = shownSentence(r.rec?.ctx ?? [], r.w, saved2[r.w]);
      lines.push(
        [
          r.w,
          code(r.now),
          code(r.was),
          dayKeyLocal(r.date),
          r.rec?.p?.toLowerCase(),
          r.rec?.g,
          met?.text,
          met ? shortSource(met.c.url, met.c.t) : "",
          (savedNow.get(r.w) ?? []).map((x) => x.en ? `${x.zh} \u2014 ${x.en}` : x.zh).join(" \u2016 ")
        ].map((x) => clean(x)).join("	")
      );
    }
    return lines.join(`
`) + `
`;
  }
  function exportCount(words2, logs2, since = 0, saved2 = {}) {
    return exportRows(words2, logs2, since, saved2).rows.length;
  }
  function exportRows(words2, logs2, since, saved2) {
    let now = Date.now(), evs = logs2.filter((e) => e.at > since), watches = evs.filter((e) => e.k === "watch"), byWord = new Map(words2.map((w) => [w.w, w])), before = /* @__PURE__ */ new Map();
    for (let e of evs) e.k === "status" && !before.has(e.w) && before.set(e.w, e.from ?? null);
    let rows = [];
    if (since)
      for (let [w, was] of before) {
        let rec = byWord.get(w), cur = rec?.s ?? null;
        was !== cur && rows.push({ w, now: cur, was, date: rec?.updated ?? now, rec });
      }
    else
      for (let w of words2) rows.push({ w: w.w, now: w.s, was: null, date: w.updated, rec: w });
    let savedNow = /* @__PURE__ */ new Map(), listed = new Set(rows.map((r) => r.w));
    for (let [w, list] of Object.entries(saved2)) {
      let fresh = list.filter((x) => x.at > since);
      if (fresh.length && (savedNow.set(w, fresh), !listed.has(w))) {
        let rec = byWord.get(w);
        rows.push({ w, now: rec?.s ?? null, was: rec?.s ?? null, date: rec?.updated ?? Math.max(...fresh.map((x) => x.at)), rec });
      }
    }
    let order = { K: 0, L: 1, F: 2, "-": 3 };
    return rows.sort((a, b) => order[code(a.now)] - order[code(b.now)] || a.date - b.date), { rows, savedNow, watches };
  }
  function parseWordList(text) {
    let out = [];
    for (let raw of text.split(/\r?\n/)) {
      let line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      let cols = line.split(/\t|,|;/).map((c) => c.trim()), m = /[㐀-鿿豈-﫿]+/.exec(cols[0]) ?? /[㐀-鿿豈-﫿]+/.exec(line);
      if (!m) continue;
      let codeCol = cols.find((c, i) => i > 0 && /^[KLF]$/i.test(c))?.toUpperCase(), s = codeCol === "L" ? "learning" : codeCol === "F" ? "fresh" : "known", dateCol = cols.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)), t = dateCol ? (/* @__PURE__ */ new Date(`${dateCol}T12:00:00`)).getTime() : 0;
      out.push({ w: m[0], s, t });
    }
    return out;
  }

  // src/pages/common.ts
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  async function saveAs(name, content, type = "text/plain;charset=utf-8") {
    if (!browser.downloads?.download)
      return download(name, content, type), !0;
    let url = URL.createObjectURL(new Blob([content], { type }));
    try {
      let id = await browser.downloads.download({ url, filename: name, saveAs: !0 }), done = (d) => {
        d.id !== id || !d.state || d.state.current === "in_progress" || (browser.downloads.onChanged.removeListener(done), URL.revokeObjectURL(url));
      };
      return browser.downloads.onChanged.addListener(done), !0;
    } catch (e) {
      return URL.revokeObjectURL(url), /cancel/i.test(String(e?.message ?? e)) ? !1 : (download(name, content, type), !0);
    }
  }
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    let d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...d.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear() ? {} : { year: "numeric" } });
  }

  // src/pages/vocab.ts
  var STAMPS = [
    ["fresh", "\u65B0", "Fresh"],
    ["learning", "\u5B78", "Learning"],
    ["known", "\u719F", "Known"]
  ], words = [], logs = [], filter = "fresh", PAGE = 120, shown = PAGE, kept = /* @__PURE__ */ new Map(), removed = /* @__PURE__ */ new Map(), removing = /* @__PURE__ */ new Map(), saved = {};
  async function load() {
    let data = await browser.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, saved = data.saved ?? {}, render(), renderExportInfo();
  }
  var LABEL = { fresh: "fresh", learning: "learning", known: "known", all: "" }, EMPTY = {
    fresh: "No fresh words. Stamp \u65B0 on a word in the card (press 1) and it lands here.",
    learning: "Nothing in learning yet. Stamp \u5B78 (press 2) on a word you want to study.",
    known: "No known words yet. Stamp \u719F (press 3), or import your known-words.txt below.",
    all: "No words yet. Stamp a word in the card (1 \u65B0, 2 \u5B78, 3 \u719F) and it shows up here."
  };
  function render() {
    let n = (s) => words.filter((w) => w.s === s).length, tab = (f, count, ...label) => h("button", { class: f, "data-f": f, "aria-pressed": String(filter === f) }, ...label, h("b", null, count.toLocaleString("en-US")));
    $("filter").replaceChildren(
      ...STAMPS.map(([s, zh, label]) => tab(s, n(s), h("span", { class: "seal", lang: "zh-Hant" }, zh), h("span", { class: "en" }, label))),
      tab("all", words.length, h("span", null, "All"))
    );
    let q = $("q").value.trim().toLowerCase(), sort = $("sort").value, byWord = new Map(words.map((w) => [w.w, w]));
    for (let [w, rec] of removed) byWord.has(w) || byWord.set(w, rec);
    let matches = (w) => !q || w.w.includes(q) || plain(w.p ?? "").includes(plain(q)) || (w.g ?? "").toLowerCase().includes(q), list = [...byWord.values()].filter((w) => filter === "all" || w.s === filter || kept.has(w.w) || removed.has(w.w)).filter(matches).sort((a, b) => key(b, sort) - key(a, sort));
    $("rows").replaceChildren(...list.slice(0, shown).map(row)), list.length || $("rows").append(emptyState(q, words.filter(matches).length));
    let total = list.filter((w) => words.includes(w) && (filter === "all" || w.s === filter)).length, what = `${q ? "match" : `${LABEL[filter] ? `${LABEL[filter]} ` : ""}word`}${total === 1 ? "" : q ? "es" : "s"}`;
    $("more").textContent = list.length > shown ? `${shown} of ${total.toLocaleString("en-US")} ${what}` : total ? `${total.toLocaleString("en-US")} ${what}` : "", $("showMore").hidden = list.length <= shown;
  }
  function emptyState(q, elsewhere) {
    if (!q) return h("p", { class: "empty" }, EMPTY[filter]);
    if (!elsewhere || filter === "all") return h("p", { class: "empty" }, `Nothing matches \u201C${q}\u201D.`);
    let all = h("button", { class: "link" }, elsewhere === 1 ? "Show it" : `Show all ${elsewhere}`);
    return all.addEventListener("click", () => setFilter("all")), h("p", { class: "empty" }, `No ${LABEL[filter]} words match \u201C${q}\u201D, but ${elsewhere === 1 ? "one word" : `${elsewhere} words`} in your other lists ${elsewhere === 1 ? "does" : "do"}. `, all);
  }
  var key = (w, sort) => sort === "updated" ? kept.get(w.w) ?? w.updated : w[sort], plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f\s']/g, "").toLowerCase();
  function marked(text, word, alt) {
    let esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[臺台]/g, "[\u81FA\u53F0]"), re = new RegExp([word, alt].filter(Boolean).map((x) => esc(x)).join("|"), "g"), out = [], at = 0;
    for (let m of text.matchAll(re))
      out.push(text.slice(at, m.index), h("u", null, m[0])), at = m.index + m[0].length;
    return out.push(text.slice(at)), out.filter((x) => x !== "");
  }
  function headword(w) {
    let chars = [...w.w], syl = w.syl?.length === chars.length ? w.syl : void 0;
    return h(
      "div",
      { class: "hw", lang: "zh-Hant" },
      syl ? null : h("div", { class: "pyline" }, w.p ?? ""),
      h("div", { class: `chars${syl ? "" : " nopy"}`, title: syl ? w.p ?? "" : "" }, ...chars.map((ch, i) => h("span", { class: "ch", "data-py": syl?.[i] ?? "" }, h("b", null, ch))))
    );
  }
  function row(w) {
    let gone = removed.has(w.w) && !words.some((x) => x.w === w.w), shown2 = shownSentence(w.ctx, w.w, saved[w.w], 36), met = shown2 && { c: shown2.c, text: shown2.text.split(" \u2014 ")[0] }, src = null;
    if (met) {
      let c = met.c, line = c.src === "yt" && c.t != null;
      src = h("a", { class: "src", href: line ? `${c.url}&t=${c.t}s` : c.url, target: "_blank", title: c.title || c.url }, line ? `\u25B6 ${clock(c.t)}` : sourceName(c.url));
    }
    let stamps = h(
      "div",
      { class: "stamps", role: "group", "aria-label": "Status" },
      ...STAMPS.map(([s, zh, label]) => {
        let b = h("button", { class: s, title: `${label} (${zh})`, "aria-pressed": String(w.s === s), lang: "zh-Hant" }, zh);
        return b.addEventListener("click", () => setStatus(w, s)), b;
      })
    ), corner;
    return gone ? (corner = h("button", { class: "undo" }, "Undo"), corner.addEventListener("click", () => restore(w))) : (corner = h("button", { class: "x", title: "Remove from the list", "aria-label": `Remove ${w.w} from the list` }, "\xD7"), corner.addEventListener("click", () => remove(w))), h(
      "article",
      { class: `word ${w.s}${gone ? " gone" : ""}`, "data-w": w.w },
      headword(w),
      h(
        "div",
        { class: "txt" },
        w.g ? h("p", { class: "gl" }, w.g) : h("p", { class: "gl none" }, "Not in the dictionary"),
        met ? h("p", { class: "ctx", lang: "zh-Hant" }, ...marked(met.text, w.w, met.c.q), src) : null
      ),
      h("div", { class: "act" }, gone ? corner : stamps, gone ? null : corner, h("span", { class: "when" }, gone ? "Removed" : ago(w.updated)))
    );
  }
  async function setStatus(w, s) {
    w.s !== s && (kept.has(w.w) || kept.set(w.w, w.updated), stampSound(s), w.s = s, w.updated = Date.now(), render(), document.querySelector(`.word[data-w="${CSS.escape(w.w)}"] .stamps .${s}`)?.classList.add("press"), await browser.runtime.sendMessage({ type: "setStatus", word: w.w, status: s }));
  }
  async function remove(w) {
    stampSound(null), removed.set(w.w, { ...w, ctx: [...w.ctx], hist: [...w.hist] }), words = words.filter((x) => x.w !== w.w), render();
    let done = (async () => {
      let stored = await browser.runtime.sendMessage({ type: "getWord", word: w.w });
      return await browser.runtime.sendMessage({ type: "setStatus", word: w.w, status: null }), stored;
    })();
    removing.set(w.w, done), await done;
  }
  async function restore(w) {
    let shown2 = removed.get(w.w) ?? w;
    removed.delete(w.w), words = [...words, shown2], render();
    let { syl: _, ...fallback } = shown2, stored = await removing.get(w.w) ?? fallback;
    removing.delete(w.w), await browser.runtime.sendMessage({ type: "importWords", words: [stored], mode: "merge" });
  }
  function setFilter(f) {
    filter = f, kept.clear(), removed.clear(), removing.clear(), shown = PAGE, render();
  }
  async function renderExportInfo() {
    let { lastExportAt } = await browser.storage.local.get("lastExportAt"), since = lastExportAt ?? 0, rows = exportCount(words, logs, since, saved), waiting = rows > 0 ? `${rows} word${rows === 1 ? "" : "s"} to send` : "Nothing new to send yet";
    $("lastExport").textContent = since ? `Last export ${ago(since)}. ${waiting}.` : `Nothing exported yet. ${waiting}.`;
  }
  $("q").addEventListener("input", () => {
    shown = PAGE, render();
  });
  $("sort").addEventListener("change", render);
  $("showMore").addEventListener("click", () => {
    shown += PAGE, render();
  });
  function filterFromHash() {
    let f = location.hash.slice(1);
    return ["all", "fresh", "learning", "known"].includes(f) ? (filter = f, !0) : !1;
  }
  filterFromHash();
  window.addEventListener("hashchange", () => {
    filterFromHash() && setFilter(filter);
  });
  $("filter").addEventListener("click", (e) => {
    let b = e.target.closest("button");
    b && setFilter(b.dataset.f);
  });
  async function exportNew(deliver) {
    let at = Date.now(), data = await browser.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, saved = data.saved ?? {};
    let { lastExportAt } = await browser.storage.local.get("lastExportAt"), text = buildClaudeExport(words, logs, lastExportAt ?? 0, saved);
    await deliver(text) && (await browser.storage.local.set({ lastExportAt: at }), render(), renderExportInfo());
  }
  var TSV = "text/tab-separated-values;charset=utf-8";
  $("exportNew").addEventListener("click", () => exportNew((text) => saveAs(`chinese-brain-${today()}.tsv`, text, TSV)));
  $("copyNew").addEventListener(
    "click",
    () => exportNew(async (text) => (await navigator.clipboard.writeText(text), $("copyOk").textContent = "Copied", !0))
  );
  $("exportAll").addEventListener("click", async () => {
    let data = await browser.runtime.sendMessage({ type: "allData" });
    await saveAs(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(data.words, data.logs, 0, data.saved), TSV);
  });
  $("backup").addEventListener("click", async () => {
    let all = await browser.storage.local.get(null);
    download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: "chinese-brain", v: 1, at: Date.now(), data: all }), "application/json");
  });
  $("restore").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    let json = JSON.parse(await f.text());
    if (json.app !== "chinese-brain") return alert("Not a Chinese Brain backup.");
    let recs = Object.entries(json.data).filter(([k]) => k.startsWith("w:")).map(([, v]) => v), n = await browser.runtime.sendMessage({ type: "importWords", words: recs, mode: "merge" }), existing = await browser.storage.local.get(null), extra = {};
    for (let [k, v] of Object.entries(json.data)) !k.startsWith("w:") && !(k in existing) && (extra[k] = v);
    await browser.storage.local.set(extra), alert(`Restored ${n} words.`), load();
  });
  $("knownFile").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    f && ($("knownText").value = await f.text());
  });
  $("knownGo").addEventListener("click", async () => {
    let items = parseWordList($("knownText").value);
    if (!items.length) return;
    let n = await browser.runtime.sendMessage({ type: "importList", items }), { lastExportAt } = await browser.storage.local.get("lastExportAt");
    lastExportAt || await browser.storage.local.set({ lastExportAt: Date.now() });
    let by = (s) => items.filter((i) => i.s === s).length;
    $("knownOk").textContent = `${n} words updated (file: ${by("known")} K, ${by("learning")} L${by("fresh") ? `, ${by("fresh")} F` : ""})`, load();
  });
  var reloadTimer;
  browser.storage.onChanged.addListener((ch) => {
    Object.keys(ch).some((k) => k.startsWith("w:") || k.startsWith("sav:")) && (clearTimeout(reloadTimer), reloadTimer = setTimeout(load, 500));
  });
  load();
})();
