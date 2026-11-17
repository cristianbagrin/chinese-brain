"use strict";
(() => {
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
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/shared/types.ts
  var STATUS_CODE = { fresh: "F", learning: "L", known: "K" };

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
  function buildPracticePrompt(words2, saved2 = {}, max = 40) {
    let mine = words2.filter((w) => w.s !== "known").sort((a, b) => b.updated - a.updated).slice(0, max), known = words2.filter((w) => w.s === "known").length, rows = mine.map((w) => {
      let met = shownSentence(w.ctx ?? [], w.w, saved2[w.w]);
      return [w.w, w.p?.toLowerCase(), w.g, met?.text].map((x) => clean(x)).filter(Boolean).join(" \xB7 ");
    });
    return [
      "I am learning Taiwanese Chinese. Please be my tutor for a short practice session.",
      "",
      `Below are ${mine.length} words I am studying right now (word \xB7 pinyin \xB7 meaning \xB7 the sentence I met it in). I already know about ${known.toLocaleString("en-US")} other words, so keep everything else simple.`,
      "",
      "Rules: Traditional characters and Taiwan usage only (no \u5152\u5316, Taiwan vocabulary and readings). Add pinyin only when I ask.",
      "",
      "1. Write a short story or dialogue (about 150 characters) that uses as many of these words as fit naturally. Mark each of my words in **bold**.",
      "2. Then quiz me on 8 of the words, one question at a time: a new sentence with a blank, and wait for my answer. Tell me if I was right, explain briefly in English, and move on.",
      "3. At the end, list the words I got wrong.",
      "",
      "My words:",
      ...rows,
      ""
    ].join(`
`);
  }

  // src/shared/sounds.ts
  var ctx;
  function audio() {
    return ctx ?? (ctx = new AudioContext()), ctx.state === "suspended" && ctx.resume(), ctx;
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
  function playStamp(status) {
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

  // src/pages/common.ts
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    let d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...d.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear() ? {} : { year: "numeric" } });
  }
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform);

  // site/src/dashboard.ts
  var nextId = 1, waiting = /* @__PURE__ */ new Map();
  window.addEventListener("message", (e) => {
    let d = e.data;
    if (e.source !== window || d?.cb !== "res" || d.id == null) return;
    let w = waiting.get(d.id);
    waiting.delete(d.id), d.error ? w?.fail(new Error(d.error)) : w?.ok(d.result);
  });
  function ask(msg) {
    return new Promise((ok, fail) => {
      let id = nextId++;
      waiting.set(id, { ok, fail }), window.postMessage({ cb: "req", id, msg }, location.origin);
    });
  }
  function extensionHere(ms = 900) {
    let there = () => !!document.documentElement.dataset.cbExt;
    return there() ? Promise.resolve(!0) : new Promise((ok) => {
      let done = (v) => {
        window.removeEventListener("message", on), clearTimeout(t), ok(v);
      }, on = (e) => e.source === window && e.data?.cb === "ready" && done(!0), t = setTimeout(() => done(there()), ms);
      window.addEventListener("message", on);
    });
  }
  async function extensionSource() {
    let prefs = await ask({ type: "prefs" }), acct = await ask({ type: "account" }).catch(() => ({ signedIn: !1, email: "" }));
    return {
      kind: "extension",
      label: acct.signedIn ? `This browser \xB7 synced to ${acct.email}` : "This browser",
      sounds: prefs.sounds,
      load: () => ask({ type: "allData" }).then((d) => ({ words: d.words, logs: d.logs ?? [], saved: d.saved ?? {} })),
      setStatus: (w, status) => ask({ type: "setStatus", word: w.w, status }).then(() => {
      }),
      stored: (word) => ask({ type: "getWord", word }),
      restore: (rec) => ask({ type: "importWords", words: [rec], mode: "merge" }).then(() => {
      }),
      mark: (at) => ask({ type: "mark", at }),
      importList: (items) => ask({ type: "importList", items })
    };
  }
  async function accountSource() {
    let me = await api("me"), words2 = /* @__PURE__ */ new Map(), saved2 = /* @__PURE__ */ new Map(), seq = 0, take = (changes) => {
      for (let c of changes) {
        let i = c.k.indexOf(":"), map = c.k.startsWith("w:") ? words2 : c.k.startsWith("sav:") ? saved2 : null;
        map && (c.v == null ? map.delete(c.k.slice(i + 1)) : map.set(c.k.slice(i + 1), c.v));
      }
    }, push = async (changes) => {
      for (let more = !0; more; changes = []) {
        let res = await api("sync", { since: seq, changes });
        take(res.changes), seq = res.seq, more = res.more;
      }
    }, put = (rec, word) => (rec ? words2.set(word, rec) : words2.delete(word), push([{ k: `w:${word}`, v: rec, t: Date.now() }]));
    return {
      kind: "account",
      label: `Account \xB7 ${me.email}`,
      sounds: !0,
      load: async () => (await push([]), { words: [...words2.values()].map((w) => ({ ...w, ctx: w.ctx ?? [], hist: w.hist ?? [] })), logs: [], saved: Object.fromEntries(saved2) }),
      setStatus: (w, status) => {
        let old = words2.get(w.w), now = Date.now();
        return put(status && old ? { ...old, s: status, updated: now, hist: [...old.hist ?? [], { t: now, s: status }] } : null, w.w);
      },
      stored: async (word) => words2.get(word) ?? null,
      restore: (rec) => put({ ...rec, updated: Date.now() }, rec.w),
      mark: async (at) => (at != null && localStorage.setItem("cb-exported", String(at)), Number(localStorage.getItem("cb-exported")) || 0)
    };
  }
  var STAMPS = [
    ["fresh", "\u65B0", "Fresh"],
    ["learning", "\u5B78", "Learning"],
    ["known", "\u719F", "Known"]
  ], src, words = [], logs = [], saved = {}, filter = "fresh", PAGE = 120, shown = PAGE, kept = /* @__PURE__ */ new Map(), removed = /* @__PURE__ */ new Map(), removing = /* @__PURE__ */ new Map();
  async function load() {
    ({ words, logs, saved } = await src.load()), render(), renderExportInfo();
  }
  var LABEL = { fresh: "fresh", learning: "learning", known: "known", all: "" }, EMPTY = {
    fresh: "No fresh words. Stamp \u65B0 on a word in the card and it lands here.",
    learning: "Nothing in learning yet. Stamp \u5B78 on a word you want to study.",
    known: "No known words yet. Stamp \u719F, or import a list below.",
    all: "No words yet. Stamp a word in the card (\u65B0, \u5B78 or \u719F) and it shows up here."
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
    $("more").textContent = list.length > shown ? `${shown} of ${total.toLocaleString("en-US")} ${what}` : total ? `${total.toLocaleString("en-US")} ${what}` : "", $("showMore").hidden = list.length <= shown, renderWeeks();
  }
  function renderWeeks() {
    let weeks = Array.from({ length: 12 }, () => 0), start2 = Date.now() - 12 * 6048e5;
    for (let w of words) for (let x of w.hist ?? []) x.t > start2 && weeks[Math.min(11, Math.floor((x.t - start2) / 6048e5))]++;
    let top = Math.max(1, ...weeks);
    $("weeks").replaceChildren(
      ...weeks.map((v, i) => {
        let bar = h("i", null);
        bar.style.height = `${Math.max(12, v / top * 100)}%`;
        let back = 11 - i;
        return h("span", { class: v ? "" : "none", title: `${v} ${v === 1 ? "stamp" : "stamps"} ${back ? `${back} ${back === 1 ? "week" : "weeks"} ago` : "this week"}` }, bar);
      })
    ), $("weeks").parentElement.hidden = !words.length;
  }
  function emptyState(q, elsewhere) {
    if (!q) return h("p", { class: "empty" }, EMPTY[filter]);
    if (!elsewhere || filter === "all") return h("p", { class: "empty" }, `Nothing matches \u201C${q}\u201D.`);
    let all = h("button", { class: "link" }, elsewhere === 1 ? "Show it" : `Show all ${elsewhere}`);
    return all.addEventListener("click", () => setFilter("all")), h("p", { class: "empty" }, `No ${LABEL[filter]} words match \u201C${q}\u201D, but ${elsewhere === 1 ? "one word" : `${elsewhere} words`} in your other lists ${elsewhere === 1 ? "does" : "do"}. `, all);
  }
  var key = (w, sort) => sort === "updated" ? kept.get(w.w) ?? w.updated : w[sort] ?? 0, plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f\s']/g, "").toLowerCase();
  function marked(text, word, alt) {
    let esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[臺台]/g, "[\u81FA\u53F0]"), re = new RegExp([word, alt].filter(Boolean).map((x) => esc(x)).join("|"), "g"), out = [], at = 0;
    for (let m of text.matchAll(re))
      out.push(text.slice(at, m.index), h("u", null, m[0])), at = m.index + m[0].length;
    return out.push(text.slice(at)), out.filter((x) => x !== "");
  }
  function headword(w) {
    let chars = [...w.w], split = (w.p ?? "").split(/\s+/).filter(Boolean), syl = w.syl?.length === chars.length ? w.syl : split.length === chars.length ? split : void 0;
    return h(
      "div",
      { class: "hw", lang: "zh-Hant" },
      syl ? null : h("div", { class: "pyline" }, w.p ?? ""),
      h("div", { class: `chars${syl ? "" : " nopy"}`, title: syl ? w.p ?? "" : "" }, ...chars.map((ch, i) => h("span", { class: "ch", "data-py": syl?.[i] ?? "" }, h("b", null, ch))))
    );
  }
  function row(w) {
    let gone = removed.has(w.w) && !words.some((x) => x.w === w.w), sentence = shownSentence(w.ctx ?? [], w.w, saved[w.w], 36), met = sentence && { c: sentence.c, text: sentence.text.split(" \u2014 ")[0] }, from = null;
    if (met) {
      let c = met.c, line = c.src === "yt" && c.t != null;
      from = h("a", { class: "src", href: line ? `${c.url}&t=${c.t}s` : c.url, target: "_blank", rel: "noopener", title: c.title || c.url }, line ? `\u25B6 ${clock(c.t)}` : sourceName(c.url));
    }
    let stamps = h(
      "div",
      { class: "stamps", role: "group", "aria-label": "Status" },
      ...STAMPS.map(([s, zh, label]) => {
        let b = h("button", { class: s, title: label, "aria-pressed": String(w.s === s), lang: "zh-Hant" }, zh);
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
        met ? h("p", { class: "ctx", lang: "zh-Hant" }, ...marked(met.text, w.w, met.c.q), from) : null
      ),
      h("div", { class: "act" }, gone ? corner : stamps, gone ? null : corner, h("span", { class: "when" }, gone ? "Removed" : ago(w.updated)))
    );
  }
  function failed(e) {
    $("note").textContent = e instanceof Error ? e.message : "That didn\u2019t save. Try again.", load();
  }
  async function setStatus(w, s) {
    w.s !== s && (kept.has(w.w) || kept.set(w.w, w.updated), src.sounds && playStamp(s), w.s = s, w.updated = Date.now(), render(), document.querySelector(`.word[data-w="${CSS.escape(w.w)}"] .stamps .${s}`)?.classList.add("press"), await src.setStatus(w, s).catch(failed));
  }
  async function remove(w) {
    src.sounds && playStamp(null), removed.set(w.w, { ...w, ctx: [...w.ctx ?? []], hist: [...w.hist ?? []] }), words = words.filter((x) => x.w !== w.w), render();
    let done = (async () => {
      let stored = await src.stored(w.w);
      return await src.setStatus(w, null), stored;
    })();
    removing.set(w.w, done), await done.catch(failed);
  }
  async function restore(w) {
    let was = removed.get(w.w) ?? w;
    removed.delete(w.w), words = [...words, was], render();
    let { syl: _, ...fallback } = was, stored = await removing.get(w.w)?.catch(() => null) ?? fallback;
    removing.delete(w.w), await src.restore(stored).catch(failed);
  }
  function setFilter(f) {
    filter = f, kept.clear(), removed.clear(), removing.clear(), shown = PAGE, history.replaceState(null, "", `#${f}`), render();
  }
  async function renderExportInfo() {
    let whole = src.kind === "account";
    if ($("exportNew").textContent = whole ? "Download" : "Download new", $("exportAll").hidden = whole, whole) return void ($("lastExport").textContent = "Your whole list as a small file (TSV), for a spreadsheet, Anki or an AI tutor.");
    let since = await src.mark(), rows = exportCount(words, logs, since, saved), waiting2 = rows > 0 ? `${rows} word${rows === 1 ? "" : "s"} to send` : "Nothing new to send yet";
    $("lastExport").textContent = since ? `Last export ${ago(since)}. ${waiting2}.` : `Nothing exported yet. ${waiting2}.`;
  }
  async function exportNew(deliver) {
    let at = Date.now();
    ({ words, logs, saved } = await src.load());
    let since = src.kind === "account" ? 0 : await src.mark();
    await deliver(buildClaudeExport(words, logs, since, saved)), await src.mark(at), render(), renderExportInfo();
  }
  var TSV = "text/tab-separated-values;charset=utf-8";
  function wire() {
    $("q").addEventListener("input", () => {
      shown = PAGE, render();
    }), $("sort").addEventListener("change", render), $("showMore").addEventListener("click", () => {
      shown += PAGE, render();
    }), $("filter").addEventListener("click", (e) => {
      let b = e.target.closest("button");
      b && setFilter(b.dataset.f);
    }), $("practice").addEventListener("click", async () => {
      let learning = words.some((w) => w.s !== "known");
      learning && await navigator.clipboard.writeText(buildPracticePrompt(words, saved)), $("practiceOk").textContent = learning ? "Copied. Paste it into your AI chat." : "Stamp some words \u65B0 or \u5B78 first.";
    }), $("exportNew").addEventListener("click", () => exportNew((text) => download(`chinese-brain-${today()}.tsv`, text, TSV))), $("copyNew").addEventListener(
      "click",
      () => exportNew(async (text) => {
        await navigator.clipboard.writeText(text), $("copyOk").textContent = "Copied";
      })
    ), $("exportAll").addEventListener("click", async () => {
      ({ words, logs, saved } = await src.load()), download(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(words, logs, 0, saved), TSV);
    }), $("importTool").hidden = !src.importList, $("knownFile").addEventListener("change", async (e) => {
      let f = e.target.files?.[0];
      f && ($("knownText").value = await f.text());
    }), $("knownGo").addEventListener("click", async () => {
      let items = parseWordList($("knownText").value);
      if (!items.length) return void ($("knownOk").textContent = "Nothing to import: one word per line.");
      let n = await src.importList(items);
      await src.mark() || await src.mark(Date.now()), $("knownOk").textContent = `${n} word${n === 1 ? "" : "s"} added or updated.`, $("knownText").value = "", await load();
    }), document.addEventListener("visibilitychange", () => {
      document.visibilityState === "visible" && !removed.size && !kept.size && load();
    });
  }
  async function start() {
    try {
      if (await extensionHere()) src = await extensionSource();
      else if (token()) src = await accountSource();
      else
        return $("loading").hidden = !0, void ($("welcome").hidden = !1);
    } catch (e) {
      return e.code === "signed_out" ? (localStorage.removeItem("cb-token"), location.replace("/account?next=/brain/dashboard")) : ($("loading").hidden = !0, $("troubleMsg").textContent = e instanceof Error ? e.message : "Something went wrong. Try again in a moment.", void ($("trouble").hidden = !1));
    }
    let f = location.hash.slice(1);
    ["all", "fresh", "learning", "known"].includes(f) && (filter = f), wire(), await load(), !location.hash && !words.some((w) => w.s === "fresh") && words.length && setFilter("all"), $("source").textContent = src.label, $("loading").hidden = !0, $("app").hidden = !1;
  }
  start();
})();
