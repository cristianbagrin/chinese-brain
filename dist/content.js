"use strict";
(() => {
  // src/shared/dict.ts
  var CJK = /[㐀-䶿一-鿿豈-﫿]/;

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
  var TRANS_LANG = "en";

  // src/content/lookup.ts
  var cache = /* @__PURE__ */ new Map();
  async function lookupText(text) {
    let key = text.slice(0, 8), hit = cache.get(key);
    if (hit) return hit;
    let res = await browser.runtime.sendMessage({ type: "lookup", text: key });
    return cache.size > 300 && cache.clear(), cache.set(key, res), res;
  }

  // src/content/keys.ts
  function isTyping(e) {
    if (e.isComposing) return !0;
    let t = e.composedPath?.()[0] ?? e.target;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ""));
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
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(location.hostname);
    }
  }, state = new State();

  // src/youtube/captions.ts
  function parseTimedText(body) {
    let t = body.trimStart();
    return /^<(!doctype|html)/i.test(t) ? [] : t.startsWith("{") ? parseJson3(t) : t.startsWith("WEBVTT") ? parseVtt(t) : t.startsWith("<") ? parseXml(t) : [];
  }
  function parseJson3(body) {
    let data = JSON.parse(body), cues = [];
    for (let ev of data.events ?? []) {
      if (!ev.segs || ev.aAppend) continue;
      let text = ev.segs.map((s) => s.utf8 ?? "").join("").replace(/\s*\n\s*/g, " ").trim();
      if (!text) continue;
      let start = (ev.tStartMs ?? 0) / 1e3;
      cues.push({ start, end: start + (ev.dDurationMs ?? 2e3) / 1e3, text });
    }
    return tidy(cues);
  }
  function decodeEntities(s) {
    return new DOMParser().parseFromString(s, "text/html").documentElement.textContent ?? s;
  }
  function parseXml(body) {
    let doc = new DOMParser().parseFromString(body, "text/xml"), cues = [];
    for (let p of doc.querySelectorAll("p")) {
      let text = (p.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      let start = Number(p.getAttribute("t")) / 1e3;
      cues.push({ start, end: start + Number(p.getAttribute("d") ?? 2e3) / 1e3, text });
    }
    for (let p of doc.querySelectorAll("text")) {
      let text = decodeEntities(p.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      let start = Number(p.getAttribute("start"));
      cues.push({ start, end: start + Number(p.getAttribute("dur") ?? 2), text });
    }
    return tidy(cues);
  }
  function parseVtt(body) {
    let cues = [], ts = (s) => s.trim().split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
    for (let block of body.split(/\n\n+/)) {
      let m = /([\d:.]+)\s+-->\s+([\d:.]+)[^\n]*\n([\s\S]+)/.exec(block);
      if (!m) continue;
      let text = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      text && cues.push({ start: ts(m[1]), end: ts(m[2]), text });
    }
    return tidy(cues);
  }
  var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  function cleanText(s) {
    return s.replace(/<\/?[a-zA-Z][^>]*>/g, "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        let n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 1114112 ? String.fromCodePoint(n) : "";
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    }).replace(/[\u200b-\u200f\u2028\u2029\ufeff\u00ad]/g, "").replace(/\s+/g, " ").trim();
  }
  var SOUND_ONLY = /^[\[(（【♪♫\s]*(音樂|音乐|掌聲|笑聲|music|applause|laughter|♪|♫)[\])）】♪♫\s]*$/i;
  function tidy(cues) {
    cues = cues.map((c) => ({ ...c, text: cleanText(c.text) })).filter((c) => c.text && !SOUND_ONLY.test(c.text) && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end >= c.start), cues.sort((a, b) => a.start - b.start);
    let out = [];
    for (let c of cues) {
      let prev = out[out.length - 1];
      if (prev && prev.text === c.text && c.start - prev.end < 0.5) {
        prev.end = Math.max(prev.end, c.end);
        continue;
      }
      prev && prev.end > c.start && (prev.end = Math.max(prev.start + 0.3, c.start)), out.push({ ...c });
    }
    return out;
  }
  function alignTranslation(src, tr) {
    let j = 0;
    return src.map((c) => {
      for (; j < tr.length && tr[j].end <= c.start; ) j++;
      let parts = [], best = "", bestOverlap = 0;
      for (let k = j; k < tr.length && tr[k].start < c.end; k++) {
        let t = tr[k], overlap = Math.min(c.end, t.end) - Math.max(c.start, t.start), mid = (t.start + t.end) / 2;
        mid >= c.start && mid < c.end && parts.push(t.text), overlap > bestOverlap && (bestOverlap = overlap, best = t.text);
      }
      return parts.length ? parts.join(" ") : best;
    });
  }
  function cueAt(cues, t) {
    let lo = 0, hi = cues.length - 1, ans = -1;
    for (; lo <= hi; ) {
      let mid = lo + hi >> 1;
      cues[mid].start <= t ? (ans = mid, lo = mid + 1) : hi = mid - 1;
    }
    return ans >= 0 && t < cues[ans].end ? ans : -1;
  }
  function cueBefore(cues, t) {
    let lo = 0, hi = cues.length - 1, ans = -1;
    for (; lo <= hi; ) {
      let mid = lo + hi >> 1;
      cues[mid].start <= t ? (ans = mid, lo = mid + 1) : hi = mid - 1;
    }
    return ans;
  }
  var ZH_ORDER = ["zh-TW", "zh-Hant", "zh-HK", "zh", "zh-Hans", "zh-CN", "zh-SG"];
  function pickChinese(tracks) {
    let zh = tracks.filter((t) => /^zh\b/i.test(t.languageCode)), score = (t) => {
      let i = ZH_ORDER.findIndex((c) => c.toLowerCase() === t.languageCode.toLowerCase());
      return (t.kind === "asr" ? 100 : 0) + (i < 0 ? 50 : i);
    };
    return zh.sort((a, b) => score(a) - score(b))[0];
  }
  function pickTranslation(tracks, lang) {
    return tracks.find((t) => t.languageCode.split("-")[0] === lang && t.kind !== "asr");
  }
  function urlInfo(url) {
    let u = new URL(url);
    return {
      lang: u.searchParams.get("lang") ?? "",
      tlang: u.searchParams.get("tlang") ?? "",
      kind: u.searchParams.get("kind") ?? "",
      v: u.searchParams.get("v") ?? ""
    };
  }
  var HAN = /[㐀-䶿一-鿿豈-﫿]/, latinWords = (s) => (s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []).length;
  function splitNote(line) {
    let notes = [], text = line.replace(/[(（[［【]([^()（）[\]［］【】]*)[)）\]］】]/g, (all, inner) => HAN.test(inner) || latinWords(inner) < 4 ? all : (notes.push(inner.trim()), " "));
    return text = text.replace(/(?<![A-Za-z])(?:note|n\.b\.|p\.?s\.?)\s*[:：][^㐀-䶿一-鿿豈-﫿]*$/i, (note2) => latinWords(note2) < 3 ? note2 : (notes.push(note2.trim()), "")), notes.length ? { text: text.replace(/\s+/g, " ").trim(), note: notes.join(" ") } : { text: line, note: "" };
  }
  function stripNote(tr, note2) {
    let words = note2.match(/[A-Za-z0-9]+/g);
    if (!tr || !words || words.length < 3) return tr;
    let re = new RegExp(`[(\uFF08[]?\\s*${words.join("[^A-Za-z0-9]+")}[^A-Za-z0-9()\uFF08\uFF09[\\]]*[)\uFF09\\]]?`, "i");
    return tr.replace(re, " ").replace(/\s+/g, " ").trim();
  }

  // src/youtube/controls.css
  var controls_default = `:host {
  all: initial;
  --bg: rgba(255, 255, 255, 0.97);
  --line: #e2e2ec;
  --text: #1b1d3a;
  --text2: #565a7e;
  --text3: #8a8eb0;
  --fresh: #ef2f42;
  --learning: #ffc81f;
  --known: #1fae4f;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
}
:host([hidden]) { display: none; }

/* The switch sits in YouTube's control bar. */
.switch {
  all: unset;
  cursor: pointer;
  height: 100%;
  min-height: 36px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: top;
  opacity: 0.9;
}
.switch:hover { opacity: 1; }
.switch .zh { font: 600 15px/1 var(--sans); color: #fff; }
.switch .track {
  position: relative;
  width: 28px;
  height: 14px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.3);
  transition: background 0.15s;
}
.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}
.switch.on .track { background: var(--known); }
.switch.on .knob { transform: translateX(14px); }

/* The panel and toast live inside the player. */
.panel {
  position: absolute;
  right: 12px;
  bottom: 60px;
  z-index: 71;
  width: 320px;
  box-sizing: border-box;
  padding: 12px 14px 12px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  font: 13px/1.45 var(--sans);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}
.panel[hidden], .toast[hidden] { display: none; }
.head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.title { font-weight: 600; font-size: 14px; }
.state { font-size: 12px; color: var(--text3); }
.big { font-size: 13px; color: var(--text2); }
.big b { font-size: 26px; font-weight: 600; color: var(--known); margin-right: 4px; }
.bar { display: flex; height: 6px; margin: 8px 0 6px; border-radius: 3px; overflow: hidden; background: var(--line); }
.seg { display: block; flex-basis: 0; }
.seg.known { background: var(--known); }
.seg.learning { background: var(--learning); }
.seg.fresh { background: var(--fresh); }
.seg.new { background: #c9cbe0; }
.legend { display: flex; gap: 12px; font-size: 12px; color: var(--text2); }
.legend .k { color: var(--known); }
.legend .l { color: #a37b00; }
.legend .f { color: var(--fresh); }
.track { margin-top: 8px; font-size: 12px; color: var(--text3); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.chip {
  all: unset;
  cursor: pointer;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text2);
  font-size: 12.5px;
}
.chip.on { color: #fff; border-color: var(--text); background: var(--text); }
.chip.on kbd { color: #c9cbe0; }
.chip kbd { font: 600 10px var(--sans); color: var(--text3); margin-left: 5px; }
.keys { margin-top: 10px; font-size: 11.5px; color: var(--text3); }

.toast {
  position: absolute;
  left: 50%;
  top: 14%;
  transform: translateX(-50%);
  z-index: 71;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  font: 500 14px/1.3 var(--sans);
  pointer-events: none;
}

.note { margin-top: 6px; font-size: 12px; color: var(--text3); }
.note.err { color: var(--fresh); }
.gem { margin-top: 8px; }
`;

  // src/youtube/controls.ts
  var MODES = ["show", "blur", "hide"], TOAST = {
    a: () => "\u25C0 previous line",
    s: () => "\u21BA replay line",
    d: () => "next line \u25B6",
    r: (s) => s.looping ? "\u21BB looping this line" : "loop off",
    q: (s) => s.shadowing ? "shadowing on: pause after each line" : "shadowing off",
    p: () => state.settings.pinyin ? "pinyin on" : "pinyin off",
    e: (s) => s.transcript.open ? "transcript open" : "transcript closed",
    x: () => `English: ${state.settings.translation === "show" ? "shown" : state.settings.translation === "blur" ? "blurred until hover" : "hidden"}`
  };
  function el(tag, cls, ...kids) {
    let e = document.createElement(tag);
    cls && (e.className = cls);
    for (let k of kids) k && e.append(k);
    return e;
  }
  var Controls = class {
    subs;
    switchHost;
    switchRoot;
    panelHost;
    panelRoot;
    panel;
    toast;
    hideTimer;
    toastTimer;
    lastKey = "";
    constructor(subs) {
      this.subs = subs;
      let mode = "closed";
      this.switchHost = document.createElement("span"), this.switchHost.dataset.cbOwn = "", this.switchRoot = this.switchHost.attachShadow({ mode });
      let s1 = document.createElement("style");
      s1.textContent = controls_default;
      let btn = el("button", "switch", el("span", "zh", "\u4E2D"), el("span", "track", el("span", "knob")));
      btn.setAttribute("aria-label", "Chinese Brain subtitles"), this.switchRoot.append(s1, btn), btn.addEventListener("click", (e) => {
        e.stopPropagation(), browser.runtime.sendMessage({ type: "saveSettings", settings: { ytEnabled: !state.settings.ytEnabled } });
      }), this.panelHost = document.createElement("div"), this.panelHost.dataset.cbOwn = "", this.panelRoot = this.panelHost.attachShadow({ mode });
      let s2 = document.createElement("style");
      s2.textContent = controls_default, this.panel = el("div", "panel"), this.panel.hidden = !0, this.toast = el("div", "toast"), this.toast.hidden = !0, this.panelRoot.append(s2, this.panel, this.toast);
      for (let t of ["click", "mousedown", "mouseup", "dblclick", "pointerdown", "pointerup"])
        this.switchHost.addEventListener(t, (e) => e.stopPropagation()), this.panelHost.addEventListener(t, (e) => e.stopPropagation());
      let enter = () => {
        clearTimeout(this.hideTimer), this.panel.hidden = !1, this.render();
      }, leave = () => {
        clearTimeout(this.hideTimer), this.hideTimer = setTimeout(() => {
          this.panel.hidden = !0, this.lastKey = "";
        }, 280);
      };
      this.switchHost.addEventListener("mouseenter", enter), this.switchHost.addEventListener("mouseleave", leave), this.panel.addEventListener("mouseenter", enter), this.panel.addEventListener("mouseleave", leave);
    }
    /** (Re)insert into the player; YouTube sometimes rebuilds its control bar. */
    mount() {
      let player = document.getElementById("movie_player"), right = player?.querySelector(".ytp-right-controls");
      right && this.switchHost.parentNode !== right && right.prepend(this.switchHost), player && this.panelHost.parentNode !== player && player.append(this.panelHost), this.render();
    }
    render() {
      let s = state.settings;
      if (this.switchHost.hidden = !this.subs.videoActive, this.switchRoot.querySelector(".switch")?.classList.toggle("on", s.ytEnabled), this.panel.hidden) return;
      let key = JSON.stringify([s, this.subs.counts, this.subs.looping, this.subs.shadowing, this.subs.trackName, this.subs.hasTranslation, this.subs.transcript.open, this.subs.gemini]);
      if (key === this.lastKey) return;
      this.lastKey = key;
      let c = this.subs.counts, total = c.known + c.learning + c.fresh + c.new, pct = (n) => total ? Math.round(n / total * 100) : 0, seg = (k, label) => {
        let b = el("i", `seg ${k}`);
        return b.style.flexGrow = String(c[k]), b.title = `${label}: ${pct(c[k])}%`, b;
      }, chip = (label, key2, on, act) => {
        let b = el("button", `chip${on ? " on" : ""}`, label, el("kbd", "", key2));
        return b.addEventListener("click", () => {
          act(), setTimeout(() => this.render(), 50);
        }), b;
      }, save = (settings) => browser.runtime.sendMessage({ type: "saveSettings", settings });
      this.panel.replaceChildren(
        el(
          "div",
          "head",
          el("span", "title", "\u4E2D\u6587\u8166"),
          el("span", "state", s.ytEnabled ? "subtitles on" : "subtitles off \xB7 click the switch")
        ),
        total ? el(
          "div",
          "cov",
          el("div", "big", el("b", "", `${pct(c.known)}%`), " of the words in this video are \u719F known"),
          el("div", "bar", seg("known", "\u719F known"), seg("learning", "\u5B78 learning"), seg("fresh", "\u65B0 fresh"), seg("new", "not in your list")),
          el(
            "div",
            "legend",
            el("span", "k", `\u719F ${pct(c.known)}%`),
            el("span", "l", `\u5B78 ${pct(c.learning)}%`),
            el("span", "f", `\u65B0 ${pct(c.fresh)}%`),
            el("span", "n", `new ${pct(c.new)}%`)
          )
        ) : this.noCaptions(),
        el("div", "track", this.subs.trackName, this.subs.hasTranslation ? " + English" : ""),
        el(
          "div",
          "chips",
          chip("Pinyin", "P", s.pinyin, () => save({ pinyin: !s.pinyin })),
          chip(`English: ${{ show: "shown", blur: "blurred", hide: "hidden" }[s.translation]}`, "X", s.translation !== "hide", () => save({ translation: MODES[(MODES.indexOf(s.translation) + 1) % 3] })),
          chip("Loop line", "R", this.subs.looping, () => this.subs.toggleLoop()),
          chip("Shadowing", "Q", this.subs.shadowing, () => this.subs.toggleShadow()),
          chip("Pause on hover", "", s.pauseOnHover, () => save({ pauseOnHover: !s.pauseOnHover })),
          chip("Transcript", "E", this.subs.transcript.open, () => this.subs.transcript.toggle())
        ),
        el("div", "keys", "A \u25C0 line \xB7 S replay \xB7 D line \u25B6 \xB7 E transcript \xB7 click a word = \u65B0 (again = undo) \xB7 1 2 3 in the card")
      );
    }
    /** No Chinese track: offer the opt-in Gemini transcript. */
    noCaptions() {
      let g = this.subs.gemini, box = el("div", "cov", el("div", "", "No Chinese captions for this video."));
      if (!state.settings.geminiKey)
        return box.append(el("div", "note", "Add a Gemini API key in Settings to transcribe videos like this one.")), box;
      if (g.state === "working")
        return box.append(el("div", "note", "Transcribing with Gemini\u2026 this can take a minute for long videos.")), box;
      let b = el("button", "chip on", "Transcribe with Gemini");
      return b.addEventListener("click", () => void this.subs.transcribeWithGemini()), box.append(
        el("div", "gem", b),
        el("div", "note", "Sends this video's link to Google. On the free tier Google may use the request to improve its models.")
      ), g.state === "error" && box.append(el("div", "note err", g.error ?? "Something went wrong.")), box;
    }
    flash(key) {
      TOAST[key]?.(this.subs) && setTimeout(() => {
        this.toast.textContent = TOAST[key](this.subs), this.toast.hidden = !1, clearTimeout(this.toastTimer), this.toastTimer = setTimeout(() => this.toast.hidden = !0, 1300), this.render();
      }, 60);
    }
  };

  // src/shared/time.ts
  function clock(secs) {
    let s = Math.max(0, Math.floor(secs)), h2 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
    return h2 ? `${h2}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  // src/youtube/transcript.css
  var transcript_default = `:host {
  all: initial;
  --bg: #ffffff;
  --bg2: #f5f5f9;
  --line: #e2e2ec;
  --text: #1b1d3a;
  --text2: #565a7e;
  --text3: #8a8eb0;
  --fresh: #ef2f42;
  --learning: #ffc81f;
  --known: #1fae4f;
  --fresh-mark: #ffd3d8;
  --learning-mark: #ffe680;
  --known-mark: #c9eed5;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
  display: block;
}
:host(.side) { margin-bottom: 16px; }
:host(.over) { position: absolute; top: 12px; right: 12px; bottom: 64px; width: min(380px, 40%); z-index: 60; }

.box {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  font: 14px/1.5 var(--sans);
}
:host(.over) .box { background: rgba(255, 255, 255, 0.96); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25); }
.top { display: flex; align-items: center; border-bottom: 1px solid var(--line); background: var(--bg2); }
.tabs { display: flex; flex: 1; }
.tabs button, .close { all: unset; cursor: pointer; padding: 9px 14px; color: var(--text2); font-size: 13px; }
.tabs button.on { color: var(--text); box-shadow: inset 0 -2px 0 var(--text); }
.close { font-size: 18px; padding: 4px 14px; }
.body { flex: 1; overflow-y: auto; padding: 6px 0 40px; scrollbar-width: thin; }

.line { display: grid; grid-template-columns: 46px 1fr; gap: 8px; padding: 5px 12px 5px 8px; cursor: pointer; border-left: 3px solid transparent; }
.line:hover { background: var(--bg2); }
.line.now { background: #eef0fb; border-left-color: var(--text); }
.time { all: unset; cursor: pointer; font-size: 11.5px; color: var(--text3); padding-top: 4px; text-align: right; }
.zh { font-size: 17px; line-height: 1.55; }
.tok { cursor: pointer; border-radius: 3px; }
.tok:hover, .tok.active { outline: 1.5px solid var(--text3); }
.tok.st-fresh { background: var(--fresh-mark); }
.tok.st-learning { background: var(--learning-mark); }
.tok.st-known { background: var(--known-mark); }
.en { font-size: 12.5px; color: var(--text2); }
.note { font-size: 12px; font-style: italic; color: var(--text3); }
.en.blur { filter: blur(4px); transition: filter 0.15s; }
.line:hover .en.blur { filter: none; }

.learnhead { padding: 8px 14px 10px; color: var(--text2); font-size: 13px; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
.learn { display: grid; grid-template-columns: auto auto 1fr auto auto; gap: 2px 10px; align-items: baseline; padding: 6px 12px 6px 14px; cursor: pointer; border-left: 3px solid transparent; }
.learn:hover { background: var(--bg2); }
.learn.st-fresh { border-left-color: var(--fresh); }
.learn.st-learning { border-left-color: var(--learning); }
.lw { font-size: 18px; }
.lpy { font-size: 12.5px; color: var(--text2); }
.lg { font-size: 12.5px; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc { font-size: 12px; color: var(--text3); }
.stamps { display: inline-flex; gap: 3px; }
.stamp { all: unset; cursor: pointer; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; color: var(--text3); border: 1px solid var(--line); }
.stamp.fresh.on { background: var(--fresh); border-color: var(--fresh); color: #fff; }
.stamp.learning.on { background: var(--learning); border-color: var(--learning); color: var(--text); }
.stamp.known.on { background: var(--known); border-color: var(--known); color: #fff; }
`;

  // src/youtube/transcript.ts
  function el2(tag, cls, ...kids) {
    let e = document.createElement(tag);
    cls && (e.className = cls);
    for (let k of kids) k && e.append(k);
    return e;
  }
  var Transcript = class {
    subs;
    host;
    root;
    box;
    body;
    tabs;
    open = !1;
    tab = "lines";
    lineEls = [];
    active = -1;
    userScrollAt = 0;
    glossCache = /* @__PURE__ */ new Map();
    constructor(subs) {
      this.subs = subs, this.host = document.createElement("div"), this.host.dataset.cbOwn = "", this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = transcript_default, this.tabs = el2("div", "tabs"), this.body = el2("div", "body");
      let close = el2("button", "close", "\xD7");
      close.title = "Close (E)", close.addEventListener("click", () => this.toggle(!1)), this.box = el2("div", "box", el2("div", "top", this.tabs, close), this.body), this.root.append(style, this.box);
      for (let t of ["click", "mousedown", "mouseup", "dblclick", "pointerdown", "pointerup", "wheel"])
        this.host.addEventListener(t, (e) => e.stopPropagation());
      this.body.addEventListener("wheel", () => this.userScrollAt = Date.now(), { passive: !0 }), this.body.addEventListener("mouseover", (e) => {
        e.target.closest(".tok") && !this.subs.popupPinned && this.subs.showFor(e, !1);
      }), this.body.addEventListener("mouseout", (e) => {
        e.target.closest(".tok") && this.subs.hideCardSoon();
      }), this.body.addEventListener("click", (e) => this.onClick(e)), document.addEventListener("fullscreenchange", () => this.place()), state.onChange(() => this.open && this.render());
    }
    toggle(force) {
      this.suspended && force !== !1 || (this.open = force ?? !this.open, this.open ? (this.place(), this.render()) : (this.host.remove(), this.subs.setRightInset(0)));
    }
    suspended = !1;
    /** The subtitles switch: when off, the panel goes too (and comes back when switched on). */
    setSuspended(off) {
      off !== this.suspended && (this.suspended = off, off ? (this.host.remove(), this.subs.setRightInset(0)) : this.open && (this.place(), this.render()));
    }
    /** Called when the cues, tokens or translation change. */
    refresh() {
      this.open && this.render();
    }
    /** Mount in YouTube's side column when it is visible, otherwise inside the player. */
    place() {
      if (!this.open || this.suspended) return;
      let flexy = document.querySelector("ytd-watch-flexy"), wide = !!document.fullscreenElement || flexy?.hasAttribute("theater") || flexy?.hasAttribute("fullscreen"), side = document.querySelector("#secondary-inner, #secondary"), player = document.getElementById("movie_player"), inSide = !wide && side && side.offsetWidth > 0, parent = inSide ? side : player;
      parent && (this.host.classList.toggle("side", !!inSide), this.host.classList.toggle("over", !inSide), inSide ? this.host.style.height = `${Math.max(360, player?.clientHeight ?? 480)}px` : this.host.style.height = "", this.host.parentNode !== parent && (inSide ? parent.prepend(this.host) : parent.append(this.host)), this.subs.setRightInset(inSide ? 0 : this.host.offsetWidth + 24));
    }
    /** Highlight the current line (and keep it in view unless the user is scrolling). */
    setActive(i) {
      if (!this.open || this.tab !== "lines" || i === this.active) return;
      this.lineEls[this.active]?.classList.remove("now"), this.active = i;
      let elx = this.lineEls[i];
      if (elx && (elx.classList.add("now"), Date.now() - this.userScrollAt > 4e3)) {
        let b = this.body, top = elx.offsetTop - b.clientHeight / 3;
        b.scrollTo({ top, behavior: "smooth" });
      }
    }
    render() {
      this.place();
      let tab = (id, label) => {
        let b = el2("button", id === this.tab ? "on" : "", label);
        return b.addEventListener("click", () => {
          this.tab = id, this.render();
        }), b;
      };
      this.tabs.replaceChildren(tab("lines", "Transcript"), tab("learn", "Learn first")), this.tab === "lines" ? this.renderLines() : this.renderLearn();
    }
    renderLines() {
      let { cues, tokens, trans, notes } = this.subs.data(), s = state.settings;
      this.lineEls = cues.map((c, i) => {
        let zh = el2("div", "zh");
        (tokens[i] ?? []).forEach((t, k) => {
          let text = t.trad ?? t.text;
          if (!t.word && !CJK.test(t.text)) return zh.append(text);
          let span = el2("span", "tok", text);
          span.dataset.k = String(k), span.dataset.line = String(i);
          let st = state.status(t.word);
          st && span.classList.add("st-" + st), zh.append(span);
        });
        let tr = stripNote(trans[i] ?? "", notes[i] ?? ""), en = s.translation !== "hide" && tr ? el2("div", `en${s.translation === "blur" ? " blur" : ""}`, tr) : null, note2 = notes[i] ? el2("div", "note", notes[i]) : null, line = el2("div", "line", el2("button", "time", clock(c.start)), el2("div", "txt", zh, note2, en));
        return line.dataset.i = String(i), line;
      }), this.body.replaceChildren(...this.lineEls);
      let cur = this.active;
      this.active = -1, this.setActive(cur >= 0 ? cur : this.subs.currentLine());
    }
    async renderLearn() {
      let { cues, tokens } = this.subs.data(), rows = /* @__PURE__ */ new Map(), total = 0, known = 0;
      tokens.forEach(
        (line, i) => line.forEach((t) => {
          if (!t.word || !CJK.test(t.text)) return;
          total++;
          let st = state.status(t.word);
          if (st === "known") return known++;
          let r = rows.get(t.word);
          r ? r.count++ : rows.set(t.word, { w: t.word, count: 1, first: i, status: st, py: t.py ?? "", g: "", zipf: 0 });
        })
      );
      let missing = [...rows.keys()].filter((w2) => !this.glossCache.has(w2));
      if (missing.length) {
        let res = await browser.runtime.sendMessage({ type: "glosses", words: missing });
        for (let [w2, v] of Object.entries(res)) this.glossCache.set(w2, v);
      }
      if (this.tab !== "learn" || this.subs.data().tokens !== tokens) return;
      for (let r of rows.values()) {
        let g = this.glossCache.get(r.w);
        g && Object.assign(r, { g: g.g, zipf: g.zipf, py: r.py || g.py });
      }
      let score = (r) => r.count * (1 + Math.max(0, r.zipf - 30) / 10), list = [...rows.values()].filter((r) => r.g).sort((a, b) => score(b) - score(a)).slice(0, 40), gained = known, top = list.slice(0, 15);
      for (let r of top) gained += r.count;
      let pct = (n) => total ? Math.round(n / total * 100) : 0, head = el2(
        "div",
        "learnhead",
        total ? `You know ${pct(known)}% of the words here. Learn the top ${top.length} below and that becomes ${pct(gained)}%.` : "No words yet."
      ), items = list.map((r) => {
        let stamps = el2("span", "stamps");
        for (let [s, zh] of [
          ["fresh", "\u65B0"],
          ["learning", "\u5B78"],
          ["known", "\u719F"]
        ]) {
          let b = el2("button", `stamp ${s}${r.status === s ? " on" : ""}`, zh);
          b.title = s, b.addEventListener("click", (e) => {
            e.stopPropagation(), browser.runtime.sendMessage({ type: "setStatus", word: r.w, status: r.status === s ? null : s });
          }), stamps.append(b);
        }
        let row = el2(
          "div",
          `learn${r.status ? " st-" + r.status : ""}`,
          el2("span", "lw", r.w),
          el2("span", "lpy", numberedToMarked(r.py)),
          el2("span", "lg", r.g),
          el2("span", "lc", `\xD7${r.count}`),
          stamps
        );
        return row.title = `First heard at ${clock(cues[r.first]?.start ?? 0)}: click to jump there`, row.dataset.seek = String(r.first), row;
      });
      this.body.replaceChildren(head, ...items);
    }
    onClick(e) {
      let t = e.target;
      if (t.closest(".tok")) {
        this.subs.showFor(e, !0);
        return;
      }
      let line = t.closest(".line");
      if (line) return this.subs.seekTo(Number(line.dataset.i));
      let learn = t.closest(".learn");
      learn && this.subs.seekTo(Number(learn.dataset.seek));
    }
  };

  // src/youtube/overlay.css
  var overlay_default = `:host {
  all: initial;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 72px;
  z-index: 45;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  transition: bottom 0.15s ease;
  /* Light band (default) */
  --band: rgba(255, 255, 255, 0.9);
  --text: #1b1d3a;
  --text2: #3d4166;
  --fresh: #ffccd2;
  --learning: #ffe066;
  --known: #c3ecd0;
  --hover: rgba(27, 29, 58, 0.1);
  --rt: #565a7e;
  --dots: rgba(27, 29, 58, 0.4);
  --serif: 'Songti TC', 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', serif;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
  --mono: ui-monospace, 'SF Mono', Menlo, monospace;
}
:host(.low) { bottom: 3%; }
/* Dark band (setting): status shown as text color. */
:host(.dark) {
  --band: rgba(22, 24, 50, 0.8);
  --text: #ffffff;
  --text2: #d4d8ff;
  --hover: rgba(255, 255, 255, 0.18);
  --rt: #c9cdf0;
  --dots: rgba(255, 255, 255, 0.45);
}
:host([hidden]) { display: none; }

.box {
  pointer-events: auto;
  max-width: 88%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15em;
  font-size: var(--fs, 30px);
}
.zh {
  background: var(--band);
  color: var(--text);
  padding: 0.12em 0.45em 0.16em;
  border-radius: 0.18em;
  font: 400 1em/1.45 var(--sans);
  letter-spacing: 0.03em;
  text-align: center;
}
.zh:empty, .tr:empty { display: none; }
.tok { cursor: pointer; border-radius: 0.12em; padding: 0 0.02em; }
.tok:hover, .tok.active { box-shadow: 0 0 0 2px var(--hover); }
.tok.st-fresh { background: var(--fresh); }
.tok.st-learning { background: var(--learning); }
.tok.st-known { background: var(--known); }
:host(.dark) .tok.st-fresh { background: none; color: #ff6b7a; }
:host(.dark) .tok.st-learning { background: none; color: #ffd84a; }
:host(.dark) .tok.st-known { background: none; color: #5fe08a; }
.tok.untracked { text-decoration: underline dotted var(--dots); text-underline-offset: 0.22em; text-decoration-thickness: 1.5px; }
ruby { ruby-position: over; }
rt { font: 400 0.34em/1 var(--sans); color: var(--rt); opacity: 0.7; letter-spacing: 0; }

.note {
  background: var(--band);
  color: var(--text2);
  padding: 0.08em 0.5em 0.12em;
  border-radius: 0.18em;
  font: italic 400 0.5em/1.4 var(--sans);
  text-align: center;
  max-width: 46em;
}
.note:empty { display: none; }
.tr {
  background: var(--band);
  color: var(--text2);
  padding: 0.1em 0.5em 0.14em;
  border-radius: 0.18em;
  font: 400 0.62em/1.4 var(--sans);
  text-align: center;
  transition: filter 0.15s;
}
.tr.blur { filter: blur(5px); }
.tr.blur:hover { filter: none; }
`;

  // src/youtube/index.ts
  var TRANSLATION_MODES = ["show", "blur", "hide"], YouTubeSubs = class {
    popup;
    videoId = "";
    tracks = [];
    src;
    cues = [];
    tokens = [];
    trans = [];
    /** English asides split off the Chinese lines ("(Note: …)"), shown on their own line. */
    notes = [];
    trCues;
    idx = -2;
    loop = !1;
    shadow = !1;
    shadowDone = -1;
    pausedByUs = !1;
    requestedTr = !1;
    watchSecs = 0;
    lastTick = 0;
    host;
    root;
    zh;
    note;
    tr;
    controls;
    transcript;
    /** Share of this video's words (running count) per status; 'new' = not in the list. */
    counts = { fresh: 0, learning: 0, known: 0, new: 0 };
    fallbackTimer;
    domObserver;
    /** True when mirroring YouTube's on-screen captions (no track was captured). */
    live = !1;
    wasOn = !1;
    hoverArmed = !1;
    cssDone = !1;
    pendingCues;
    shadowTimer;
    videoTitle = "";
    /** Gemini fallback for videos with no Chinese captions. */
    gemini = { state: "idle" };
    checkedGemini = !1;
    constructor(popup) {
      this.popup = popup, this.host = document.createElement("div"), this.host.dataset.cbOwn = "", this.host.hidden = !0, this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = overlay_default;
      let box = document.createElement("div");
      box.className = "box", this.zh = document.createElement("div"), this.zh.className = "zh", this.note = document.createElement("div"), this.note.className = "note", this.tr = document.createElement("div"), this.tr.className = "tr", box.append(this.zh, this.note, this.tr), this.root.append(style, box);
      for (let t of ["click", "mousedown", "mouseup", "dblclick", "pointerdown", "pointerup", "touchstart"])
        this.host.addEventListener(t, (e) => e.stopPropagation());
      box.addEventListener("mouseenter", () => this.hoverArmed = !0), box.addEventListener("mousemove", () => {
        this.hoverArmed && (this.hoverArmed = !1, this.hoverPause(!0));
      }), box.addEventListener("mouseleave", () => this.hoverPause(!1)), this.zh.addEventListener("mouseover", (e) => this.onTokenHover(e)), this.zh.addEventListener("mouseout", () => this.popup.hideSoon()), this.zh.addEventListener("click", (e) => this.onTokenClick(e)), this.popup.onHide(() => {
        this.clickStamped = "", this.maybeResume();
      }), browser.runtime.onMessage.addListener((msg) => {
        msg.type === "ytCaptions" && msg.url && msg.body && this.onBody(msg.url, msg.body);
      }), this.controls = new Controls(this), this.transcript = new Transcript(this), state.onChange(() => {
        this.applyEnabled(), this.renderLine(!0);
      }), window.addEventListener("keydown", (e) => this.onKey(e), !0), document.addEventListener("yt-navigate-finish", () => this.checkVideo()), window.addEventListener("pagehide", () => this.flushWatch()), setInterval(() => this.checkVideo(), 1e3), new ResizeObserver(() => this.resize()).observe(document.documentElement), this.checkVideo(), this.tick = this.tick.bind(this), requestAnimationFrame(this.tick);
    }
    player() {
      let el3 = document.getElementById("movie_player");
      return el3?.wrappedJSObject ?? el3 ?? void 0;
    }
    video() {
      return document.querySelector("#movie_player video");
    }
    currentId() {
      return location.pathname !== "/watch" ? "" : new URLSearchParams(location.search).get("v") ?? "";
    }
    checkVideo() {
      let id = this.currentId();
      if (id === this.videoId) {
        id && !this.src && this.findTracks(), id && this.cues.length && this.controls.mount();
        return;
      }
      this.flushWatch(), this.videoId = id, this.reset(), id && (state.loadStatuses(), this.findTracks(), browser.runtime.sendMessage({ type: "ytCached" }).then((list) => {
        for (let item of list) this.onBody(item.url, item.body);
      }));
    }
    reset() {
      clearTimeout(this.fallbackTimer), this.domObserver?.disconnect(), this.domObserver = void 0, this.live = !1, this.tracks = [], this.src = void 0, this.cues = [], this.tokens = [], this.trans = [], this.notes = [], this.trCues = void 0, this.idx = -2, this.requestedTr = !1, this.gemini = { state: "idle" }, this.checkedGemini = !1, this.counts = { fresh: 0, learning: 0, known: 0, new: 0 }, this.clickStamped = "", this.pendingCues = void 0, clearTimeout(this.shadowTimer), this.loop = !1, this.shadow = !1, this.host.hidden = !0, document.documentElement.classList.remove("cb-subs-on"), this.transcript?.refresh();
    }
    findTracks() {
      let p = this.player();
      if (!p?.getPlayerResponse) return;
      let resp;
      try {
        resp = p.getPlayerResponse();
      } catch {
        return;
      }
      if (!resp || resp.videoDetails?.videoId !== this.videoId) return;
      let list = resp.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      this.tracks = [...list].map((t) => ({
        languageCode: String(t.languageCode),
        kind: t.kind ? String(t.kind) : void 0,
        name: String(t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? t.languageCode),
        vssId: t.vssId ? String(t.vssId) : void 0,
        isTranslatable: !!t.isTranslatable
      }));
      let zh = pickChinese(this.tracks);
      if (!zh) {
        if (this.controls.mount(), !this.checkedGemini) {
          this.checkedGemini = !0;
          let id2 = this.videoId;
          browser.runtime.sendMessage({ type: "geminiCached", videoId: id2 }).then((lines) => {
            lines && this.videoId === id2 && !this.cues.length && this.applyGemini(lines);
          });
        }
        return;
      }
      this.src = zh, this.setTrack(zh);
      let id = this.videoId;
      clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(() => {
        !this.cues.length && this.videoId === id && this.startDomFallback();
      }, 6e3);
    }
    /** Ask the player to show a track; it downloads it and we capture the body. */
    setTrack(track, tlang) {
      let p = this.player();
      if (p)
        try {
          p.loadModule?.("captions");
          let native = [...p.getOption?.("captions", "tracklist") ?? []].find((t) => t.languageCode === track.languageCode && (t.kind ?? "") === (track.kind ?? "")), obj = native ? { ...native } : { languageCode: track.languageCode, kind: track.kind ?? "" };
          tlang && (obj.translationLanguage = { languageCode: tlang, languageName: tlang }), p.setOption("captions", "track", typeof cloneInto == "function" ? cloneInto(obj, window) : obj);
        } catch (e) {
          console.warn("[chinese-brain] setTrack", e);
        }
    }
    async onBody(url, body) {
      let info = urlInfo(url);
      if (info.v && info.v !== this.videoId) return;
      let cues;
      try {
        cues = parseTimedText(body);
      } catch {
        return;
      }
      if (!cues.length) return;
      let want = TRANS_LANG, isZh = /^zh/i.test(info.lang);
      if (info.tlang) {
        info.tlang.split("-")[0] === want && this.setTranslation(cues);
        return;
      }
      if (isZh) {
        if (this.src && this.src.languageCode !== info.lang && this.cues.length || sameCues(withoutNotes(cues), this.cues)) return;
        this.src || (this.src = { languageCode: info.lang, kind: info.kind || void 0, name: info.lang }), await this.setSource(cues);
        return;
      }
      info.lang.split("-")[0] === want && this.setTranslation(cues);
    }
    /**
     * Fallback when no caption download was captured: read the text YouTube
     * renders on screen and show it as a single live line (no timing, no
     * second line). Keeps lookup and coloring working.
     */
    startDomFallback() {
      let p = document.getElementById("movie_player");
      if (!p) return;
      this.live = !0;
      let last = "", read = async () => {
        let text = [...p.querySelectorAll(".ytp-caption-segment")].map((s) => s.textContent ?? "").join(" ").trim();
        if (text === last || !this.live || (last = text, !CJK.test(text))) return;
        let id = this.videoId, split = splitNote(text), [toks] = await browser.runtime.sendMessage({ type: "segment", lines: [split.text] });
        this.videoId !== id || !this.live || (this.cues = [{ start: 0, end: Number.MAX_SAFE_INTEGER, text: split.text }], this.tokens = [toks], this.notes = [split.note], this.trans = [], this.idx = -2, this.mount());
      };
      this.domObserver = new MutationObserver(() => void read()), this.domObserver.observe(p, { subtree: !0, childList: !0, characterData: !0 }), read();
    }
    async setSource(raw) {
      this.live && (this.live = !1, this.domObserver?.disconnect());
      let id = this.videoId, split = raw.map((c) => splitNote(c.text)), cues = raw.map((c, i) => ({ ...c, text: split[i].text }));
      this.pendingCues = cues;
      let tokens = await browser.runtime.sendMessage({ type: "segment", lines: cues.map((c) => c.text) });
      if (!(this.videoId !== id || this.pendingCues !== cues) && (this.cues = cues, this.tokens = tokens, this.notes = split.map((x) => x.note), this.idx = -2, this.videoTitle = document.title.replace(/ - YouTube$/, ""), this.trCues && (this.trans = alignTranslation(this.cues, this.trCues)), this.computeCoverage(), this.mount(), this.transcript.refresh(), !this.requestedTr && !this.trCues && this.src)) {
        this.requestedTr = !0;
        let want = TRANS_LANG, manual = pickTranslation(this.tracks, want);
        setTimeout(() => {
          manual ? this.setTrack(manual) : this.src?.isTranslatable !== !1 && this.setTrack(this.src, want), setTimeout(() => this.src && this.setTrack(this.src), 2500);
        }, 300);
        let id2 = this.videoId;
        setTimeout(() => {
          this.trCues || this.videoId !== id2 || !this.cues.length || this.live || this.translateFallback();
        }, 6e3);
      }
    }
    async translateFallback() {
      let id = this.videoId, cues = this.cues, lines = cues.map((c) => c.text), res = await browser.runtime.sendMessage({
        type: "translate",
        lines,
        sl: this.src?.languageCode ?? "zh-TW",
        tl: TRANS_LANG
      });
      !res || this.videoId !== id || this.trCues || this.cues !== cues || (this.trCues = this.cues.map((c, i) => ({ ...c, text: res[i] ?? "" })), this.trans = res, this.renderLine(!0), this.transcript.refresh());
    }
    setTranslation(cues) {
      this.trCues = cues, this.cues.length && (this.trans = alignTranslation(this.cues, cues)), this.renderLine(!0), this.transcript.refresh();
    }
    computeCoverage() {
      let c = { fresh: 0, learning: 0, known: 0, new: 0 };
      for (let line of this.tokens)
        for (let t of line)
          !t.word || !CJK.test(t.text) || c[state.status(t.word) ?? "new"]++;
      this.counts = c;
    }
    /** Known share of the running words, 0..1 (undefined without captions). */
    get coverage() {
      let c = this.counts, total = c.fresh + c.learning + c.known + c.new;
      return total ? c.known / total : void 0;
    }
    get videoActive() {
      return !!this.videoId;
    }
    /** Opt-in, per video: transcribe with the user's Gemini key. */
    async transcribeWithGemini() {
      let id = this.videoId;
      this.gemini = { state: "working" }, this.controls.render();
      let res = await browser.runtime.sendMessage({ type: "gemini", videoId: id });
      this.videoId === id && (res.lines ? (this.gemini = { state: "idle" }, this.applyGemini(res.lines)) : this.gemini = { state: "error", error: res.error }, this.controls.render());
    }
    applyGemini(lines) {
      this.src = { languageCode: "zh-TW", name: "Gemini transcript" }, this.requestedTr = !0, this.trCues = lines.map((l) => ({ start: l.start, end: l.end, text: l.en })), this.trans = lines.map((l) => l.en), this.setSource(lines.map((l) => ({ start: l.start, end: l.end, text: l.zh })));
    }
    get hasSubs() {
      return this.cues.length > 0;
    }
    get trackName() {
      return this.src ? this.src.name || this.src.languageCode : "";
    }
    get hasTranslation() {
      return !!this.trCues;
    }
    get looping() {
      return this.loop;
    }
    get shadowing() {
      return this.shadow;
    }
    setRightInset(px) {
      this.host.style.right = px ? `${px}px` : "";
    }
    data() {
      return { cues: this.cues, tokens: this.tokens, trans: this.trans, notes: this.notes };
    }
    currentLine() {
      return this.idx;
    }
    get popupPinned() {
      return this.popup.pinned;
    }
    hideCardSoon() {
      this.popup.hideSoon();
    }
    seekTo(i) {
      let v = this.video(), c = this.cues[i];
      !v || !c || (v.currentTime = c.start + 0.01, this.shadowDone = -1);
    }
    toggleLoop() {
      this.loop = !this.loop, this.controls.render();
    }
    toggleShadow() {
      this.shadow = !this.shadow, this.shadowDone = -1, this.controls.render();
    }
    /** The player switch: our subtitles on or off (YouTube's own come back when off). */
    applyEnabled() {
      let on = state.settings.ytEnabled && this.cues.length > 0;
      this.host.hidden = !on, this.host.classList.toggle("dark", state.settings.subStyle === "dark"), document.documentElement.classList.toggle("cb-subs-on", on), this.wasOn && !on && this.popup.src === "yt" && this.popup.hide(), this.wasOn = on, this.transcript?.setSuspended(!state.settings.ytEnabled);
    }
    mount() {
      let p = document.getElementById("movie_player");
      p && (this.host.parentNode !== p && p.append(this.host), this.applyEnabled(), this.controls.mount(), this.cssDone || (this.cssDone = !0, browser.runtime.sendMessage({
        type: "insertCSS",
        css: "html.cb-subs-on .ytp-caption-window-container{display:none!important}"
      })), this.resize());
    }
    resize() {
      let p = document.getElementById("movie_player");
      if (!p) return;
      let h2 = p.clientHeight || 480, fs = Math.max(14, Math.min(60, state.settings.subFontSize * h2 / 720));
      this.host.style.setProperty("--fs", `${fs}px`);
    }
    tick(now) {
      if (requestAnimationFrame(this.tick), !this.cues.length || this.host.hidden) return;
      let v = this.video();
      if (this.live && v) {
        this.idx !== 0 && (this.idx = 0, this.renderLine());
        return;
      }
      if (!v) return;
      let t = v.currentTime, dt = this.lastTick ? (now - this.lastTick) / 1e3 : 0;
      this.lastTick = now, !v.paused && dt < 1 && (this.watchSecs += dt);
      let p = this.host.parentElement;
      this.host.classList.toggle("low", !!p?.classList.contains("ytp-autohide"));
      let cur = this.idx >= 0 ? this.cues[this.idx] : void 0;
      if (cur && t >= cur.end - 0.05 && t < cur.end + 0.5) {
        if (this.loop) {
          v.currentTime = cur.start;
          return;
        }
        if (this.shadow && this.shadowDone !== this.idx && !v.paused) {
          this.shadowDone = this.idx, v.pause();
          let wait = Math.max(1.5, (cur.end - cur.start) * state.settings.shadowFactor);
          clearTimeout(this.shadowTimer), this.shadowTimer = setTimeout(() => {
            !this.shadow || !v.paused || (this.popup.visible || this.root.querySelector(".box:hover") ? this.pausedByUs = !0 : v.play());
          }, wait * 1e3);
          return;
        }
      }
      let i = cueAt(this.cues, t);
      i !== this.idx && !(i < 0 && v.paused && this.idx >= 0) && (this.idx = i, this.renderLine());
    }
    renderLine(force = !1) {
      force && this.computeCoverage();
      let i = this.idx, toks = i >= 0 ? this.tokens[i] : void 0, s = state.settings;
      this.zh.replaceChildren(), toks && toks.forEach((t, k) => {
        let text = t.trad ?? t.text;
        if (!t.word && !CJK.test(t.text)) {
          this.zh.append(text);
          return;
        }
        let span = document.createElement("span");
        span.className = "tok", span.dataset.k = String(k);
        let st = state.status(t.word);
        if (st ? span.classList.add("st-" + st) : s.markUntracked && t.word && span.classList.add("untracked"), s.pinyin && t.py) {
          let ruby = document.createElement("ruby");
          ruby.append(text);
          let rt = document.createElement("rt");
          rt.textContent = numberedToMarked(t.py), ruby.append(rt), span.append(ruby);
        } else span.textContent = text;
        this.zh.append(span);
      });
      let note2 = i >= 0 ? this.notes[i] ?? "" : "";
      this.note.textContent = note2;
      let tr = i >= 0 ? stripNote(this.trans[i] ?? "", note2) : "";
      this.tr.textContent = s.translation === "hide" ? "" : tr, this.tr.classList.toggle("blur", s.translation === "blur"), this.resize(), this.controls.render(), this.transcript.setActive(i);
    }
    tokenAt(e) {
      let span = e.target.closest?.(".tok");
      if (!span) return;
      let line = span.dataset.line != null ? Number(span.dataset.line) : this.idx;
      if (line < 0) return;
      let tok = this.tokens[line]?.[Number(span.dataset.k)];
      return tok ? { span, tok, line } : void 0;
    }
    showSeq = 0;
    /** Word just stamped Fresh by a click (a second click undoes only that). */
    clickStamped = "";
    /** Open the card for a word span (subtitles or transcript). */
    async showFor(e, pinned) {
      if (!pinned && e instanceof MouseEvent && this.popup.visible && this.popup.inBridge(e.clientX, e.clientY)) return;
      let seq = ++this.showSeq, hit = this.tokenAt(e);
      if (!hit) return;
      let { span, tok, line } = hit, rest = this.tokens[line].slice(Number(span.dataset.k)).map((t) => t.text).join(""), matches = await lookupText(rest);
      if (seq !== this.showSeq) return;
      let own = matches.findIndex((m) => m.text === tok.text);
      if (own > 0 && (matches = [matches[own], ...matches.filter((_, i) => i !== own)]), !matches.length) return;
      span.getRootNode().querySelectorAll(".tok.active").forEach((el3) => el3.classList.remove("active")), span.classList.add("active");
      let cue = this.cues[line], trLine = stripNote(this.trans[line] ?? "", this.notes[line] ?? ""), ctx2 = {
        text: cue.text + (trLine ? ` \u2014 ${trLine}` : ""),
        url: location.href.split("&")[0],
        title: document.title.replace(/ - YouTube$/, ""),
        t: Math.floor(cue.start),
        at: Date.now(),
        src: "yt"
      }, cursor = e instanceof MouseEvent ? { x: e.clientX, y: e.clientY } : void 0;
      if (await this.popup.show({
        matches,
        rect: span.getBoundingClientRect(),
        cursor,
        src: "yt",
        ctx: ctx2,
        pinned,
        related: (word) => this.linesWith(word, line),
        relatedLabel: "Elsewhere in this video",
        seek: (t) => {
          let v = this.video();
          v && (v.currentTime = t);
        }
      }), pinned && state.settings.autoFreshOnClick) {
        let w2 = matches[0].word, st = state.status(w2);
        st ? st === "fresh" && this.clickStamped === w2 && (this.popup.setStatus(null, !1), this.clickStamped = "") : (this.popup.setStatus("fresh", !1), this.clickStamped = w2);
      }
    }
    /** Other lines of this video with the word, nearest to the current one first. */
    linesWith(word, line) {
      let hits = [];
      this.tokens.forEach((toks, i) => {
        i !== line && toks.some((t) => t.word === word) && hits.push(i);
      }), hits.sort((a, b) => Math.abs(a - line) - Math.abs(b - line));
      let out = [];
      for (let i of hits) {
        let text = this.cues[i].text;
        if (text !== this.cues[line]?.text && !out.some((o) => o.text === text) && out.push({ text, t: this.cues[i].start }), out.length >= 3) break;
      }
      return out;
    }
    onTokenHover(e) {
      this.popup.pinned || this.showFor(e, !1);
    }
    onTokenClick(e) {
      this.showFor(e, !0);
    }
    hoverPause(enter) {
      let v = this.video();
      !v || !state.settings.pauseOnHover || (enter ? v.paused || (v.pause(), this.pausedByUs = !0) : setTimeout(() => this.maybeResume(), 250));
    }
    maybeResume() {
      let v = this.video();
      !v || !this.pausedByUs || this.popup.visible || this.root.querySelector(".box:hover") || (this.pausedByUs = !1, v.play());
    }
    seekLine(delta) {
      let v = this.video();
      if (!v || !this.cues.length) return;
      let base = this.idx >= 0 ? this.idx : cueBefore(this.cues, v.currentTime), j = Math.max(0, Math.min(this.cues.length - 1, base + delta));
      v.currentTime = this.cues[j].start + 0.01, this.shadowDone = -1, delta === 0 && v.paused && v.play();
    }
    onKey(e) {
      if (isTyping(e)) return;
      if (this.popup.visible && this.popup.handleKey(e)) {
        e.preventDefault(), e.stopImmediatePropagation();
        return;
      }
      if (!state.settings.ytEnabled || !this.cues.length || this.live || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      let s = state.settings, handled = !0;
      switch (e.key.toLowerCase()) {
        case "a":
          this.seekLine(-1);
          break;
        case "s":
          this.seekLine(0);
          break;
        case "d":
          this.seekLine(1);
          break;
        case "r":
          this.toggleLoop();
          break;
        case "q":
          this.toggleShadow();
          break;
        case "e":
          this.transcript.toggle();
          break;
        case "p":
          browser.runtime.sendMessage({ type: "saveSettings", settings: { pinyin: !s.pinyin } });
          break;
        case "x": {
          let next = TRANSLATION_MODES[(TRANSLATION_MODES.indexOf(s.translation) + 1) % 3];
          browser.runtime.sendMessage({ type: "saveSettings", settings: { translation: next } });
          break;
        }
        default:
          handled = !1;
      }
      handled && (e.preventDefault(), e.stopImmediatePropagation(), this.controls.flash(e.key.toLowerCase()));
    }
    flushWatch() {
      this.watchSecs > 30 && this.videoId && browser.runtime.sendMessage({
        type: "watch",
        url: `https://www.youtube.com/watch?v=${this.videoId}`,
        title: this.videoTitle,
        secs: Math.round(this.watchSecs),
        coverage: this.coverage,
        lang: this.src?.languageCode
      }), this.watchSecs = 0;
    }
  };
  function withoutNotes(cues) {
    return cues.map((c) => ({ ...c, text: splitNote(c.text).text }));
  }
  function sameCues(a, b) {
    return a.length === b.length && a[0]?.text === b[0]?.text && a[a.length - 1]?.text === b[b.length - 1]?.text;
  }

  // src/content/hover.ts
  var HIGHLIGHT = "chinese-brain-hit";
  function textFrom(node, offset, max = 10) {
    let text = "", ranges = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    let cur = node, start = offset;
    for (; cur && text.length < max; ) {
      let piece = cur.data.slice(start, start + (max - text.length));
      piece && (ranges.push([cur, start, start + piece.length]), text += piece);
      let next = walker.nextNode();
      if (!next || !sameBlock(cur, next)) break;
      cur = next, start = 0;
    }
    return { text, ranges };
  }
  function sameBlock(a, b) {
    let block = (n) => {
      let el3 = n.parentElement;
      for (; el3 && getComputedStyle(el3).display.startsWith("inline"); ) el3 = el3.parentElement;
      return el3;
    };
    return block(a) === block(b);
  }
  function sentenceAround(node, offset) {
    let block = node.parentElement?.closest("p,li,td,h1,h2,h3,h4,div,section,article,blockquote") ?? node.parentElement, full = block?.textContent ?? node.data, pos = offset;
    if (block) {
      let w2 = document.createTreeWalker(block, NodeFilter.SHOW_TEXT), acc = 0;
      for (let n = w2.nextNode(); n; n = w2.nextNode()) {
        if (n === node) {
          pos = acc + offset;
          break;
        }
        acc += n.data.length;
      }
    }
    let stops = /[。！？!?；\n]/, a = pos;
    for (; a > 0 && !stops.test(full[a - 1]) && pos - a < 120; ) a--;
    let b = pos;
    for (; b < full.length && !stops.test(full[b]) && b - pos < 160; ) b++;
    return full.slice(a, Math.min(full.length, b + 1)).trim();
  }
  var SKIP_TEXT = "script,style,noscript,textarea,code,pre,chinese-brain-popup,[data-cb-own]";
  function pageSentences(word) {
    let out = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), scanned = 0;
    for (let n = walker.nextNode(); n && out.length < 4 && scanned < 4e5; n = walker.nextNode()) {
      scanned += n.data.length;
      let i = n.data.indexOf(word);
      if (i < 0 || n.parentElement?.closest(SKIP_TEXT)) continue;
      let text = sentenceAround(n, i);
      text.length >= word.length + 2 && text.length <= 80 && !out.some((r) => r.text === text) && out.push({ text });
    }
    return out;
  }
  var HoverLookup = class {
    popup;
    raf = 0;
    lastX = 0;
    lastY = 0;
    shift = !1;
    currentKey = "";
    cssInjected = !1;
    seq = 0;
    constructor(popup) {
      this.popup = popup, document.addEventListener("mousemove", (e) => this.onMove(e), { passive: !0 }), document.addEventListener("mousedown", (e) => {
        this.popup.contains(e.target) || this.popup.hide();
      }), document.addEventListener(
        "scroll",
        () => {
          !this.popup.visible || this.popup.pinned || (this.popup.isHovered ? this.popup.detach() : this.popup.hide());
        },
        { capture: !0, passive: !0 }
      ), this.popup.onHide(() => {
        this.currentKey = "", CSS.highlights?.delete(HIGHLIGHT);
      }), document.addEventListener("mouseup", (e) => {
        this.popup.contains(e.target) || setTimeout(() => this.onSelect(e), 0);
      }), document.addEventListener("keyup", (e) => {
        e.shiftKey && e.key.startsWith("Arrow") && this.onSelect();
      });
    }
    /** Card for the selected text: the longest dictionary word it starts with. */
    async onSelect(e) {
      if (!state.siteEnabled()) return;
      let active = document.activeElement, text = "", rect, ctxText = "", field = active && (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement && /^(text|search|url|email|)$/.test(active.type));
      if (field && active.selectionStart != null && active.selectionEnd != null && active.selectionEnd > active.selectionStart) {
        text = active.value.slice(active.selectionStart, active.selectionEnd);
        let r = active.getBoundingClientRect();
        rect = new DOMRect(e?.clientX ?? r.left, r.top, 1, r.height);
      } else {
        let sel = document.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        text = sel.toString(), rect = sel.getRangeAt(0).getBoundingClientRect(), sel.anchorNode?.nodeType === Node.TEXT_NODE && (ctxText = sentenceAround(sel.anchorNode, sel.anchorOffset));
      }
      if (text = text.trim(), !text || text.length > 16 || !CJK.test(text[0])) return;
      let matches = await lookupText(text);
      if (!matches.length) return;
      let exact = matches.findIndex((m) => m.text === text), ordered = exact > 0 ? [matches[exact], ...matches.filter((_, i) => i !== exact)] : matches;
      CSS.highlights?.delete(HIGHLIGHT), this.currentKey = "", this.popup.show({
        matches: ordered,
        rect,
        cursor: e ? { x: e.clientX, y: e.clientY } : void 0,
        src: "web",
        pinned: !0,
        related: pageSentences,
        relatedLabel: "Also on this page",
        ctx: { text: ctxText || (field ? active.value.slice(0, 200) : text), url: location.href, title: document.title, at: Date.now(), src: "web" }
      });
    }
    onMove(e) {
      this.lastX = e.clientX, this.lastY = e.clientY, this.shift = e.shiftKey, !this.raf && (this.raf = requestAnimationFrame(() => {
        this.raf = 0, this.check(e.target);
      }));
    }
    async check(target) {
      let seq = ++this.seq;
      if (this.popup.pinned) return;
      if (this.popup.contains(target)) {
        if (this.popup.age() > 300) return;
        this.popup.hide();
      }
      if (this.popup.visible && this.popup.inBridge(this.lastX, this.lastY) || target?.closest?.("[data-cb-own]")) return;
      let s = state.settings;
      if (!state.siteEnabled() || s.hoverMode === "shift" && !this.shift) return this.scheduleHide();
      let pos = document.caretPositionFromPoint?.(this.lastX, this.lastY), node = pos?.offsetNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) return this.scheduleHide();
      let text = node, offset = pos.offset;
      if (offset = this.charUnderPointer(text, offset), offset < 0 || !CJK.test(text.data[offset] ?? "")) return this.scheduleHide();
      let { text: str, ranges } = textFrom(text, offset), key = `${str}@${Math.round(this.charRect(text, offset)?.left ?? 0)}`;
      if (key === this.currentKey) {
        this.popup.cancelHide();
        return;
      }
      let matches = await lookupText(str);
      if (seq !== this.seq) return;
      if (!matches.length) return this.scheduleHide();
      this.currentKey = key;
      let range = this.rangeFor(ranges, matches[0].text.length);
      this.highlight(range), this.popup.show({
        matches,
        rect: range.getBoundingClientRect(),
        cursor: { x: this.lastX, y: this.lastY },
        src: "web",
        ctx: { text: sentenceAround(text, offset), url: location.href, title: document.title, at: Date.now(), src: "web" },
        related: pageSentences,
        relatedLabel: "Also on this page"
      });
    }
    charRect(node, i) {
      if (i < 0 || i >= node.data.length) return;
      let r = document.createRange();
      return r.setStart(node, i), r.setEnd(node, i + 1), r.getBoundingClientRect();
    }
    charUnderPointer(node, offset) {
      for (let i of [offset, offset - 1]) {
        let r = this.charRect(node, i);
        if (r && this.lastX >= r.left - 1 && this.lastX <= r.right + 1 && this.lastY >= r.top - 2 && this.lastY <= r.bottom + 2) return i;
      }
      return -1;
    }
    rangeFor(ranges, len) {
      let r = document.createRange(), [n0, s0] = ranges[0];
      r.setStart(n0, s0);
      let left = len;
      for (let [n, s, e] of ranges) {
        let take = Math.min(left, e - s);
        if (r.setEnd(n, s + take), left -= take, left <= 0) break;
      }
      return r;
    }
    highlight(range) {
      if (!CSS.highlights) return;
      this.cssInjected || (this.cssInjected = !0, browser.runtime.sendMessage({ type: "insertCSS", css: `::highlight(${HIGHLIGHT}){background:#f3d27a;color:#31261a}` }));
      let hl = new Highlight(range);
      hl.priority = 10, CSS.highlights.set(HIGHLIGHT, hl);
    }
    scheduleHide() {
      this.currentKey && this.popup.hideSoon();
    }
  };

  // src/content/pagecolor.ts
  var NAMES = { fresh: "cb-fresh", learning: "cb-learning", known: "cb-known" }, CSS_TEXT = `
::highlight(cb-fresh){background-color:rgba(239,47,66,.24)}
::highlight(cb-learning){background-color:rgba(255,200,31,.42)}
::highlight(cb-known){background-color:rgba(31,174,79,.16)}`, SKIP = 'script,style,noscript,textarea,input,select,code,pre,[contenteditable=""],[contenteditable="true"],chinese-brain-popup,[data-cb-own]', MAX_CHARS = 3e5, PageColors = class {
    words = [];
    done = /* @__PURE__ */ new WeakSet();
    chars = 0;
    observer;
    pending = /* @__PURE__ */ new Set();
    timer;
    on = !1;
    cssInjected = !1;
    constructor() {
      state.onChange(() => this.sync()), this.sync(), browser.runtime.onMessage.addListener((msg) => {
        if (msg.type === "pageStats") return Promise.resolve(this.stats());
      });
    }
    sync() {
      let want = state.settings.pageColors && state.siteEnabled() && !!CSS.highlights;
      if (want === this.on) {
        want && this.paint();
        return;
      }
      this.on = want, want ? this.start() : this.stop();
    }
    async start() {
      this.cssInjected || (this.cssInjected = !0, browser.runtime.sendMessage({ type: "insertCSS", css: CSS_TEXT })), await state.loadStatuses(), await this.scan(document.body), this.observer = new MutationObserver((muts) => {
        for (let m of muts)
          if (m.type === "characterData") {
            let t = m.target;
            this.done.delete(t), this.words = this.words.filter((w2) => w2.range.startContainer !== t), this.pending.add(t);
          } else m.addedNodes.forEach((n) => this.pending.add(n));
        this.timer ??= setTimeout(() => {
          this.timer = void 0;
          let nodes = [...this.pending];
          this.pending.clear(), nodes.forEach((n) => n.isConnected && this.scan(n));
        }, 700);
      }), this.observer.observe(document.body, { childList: !0, subtree: !0, characterData: !0 });
    }
    stop() {
      this.observer?.disconnect(), clearTimeout(this.timer), this.timer = void 0, this.pending.clear();
      for (let name of Object.values(NAMES)) CSS.highlights?.delete(name);
      this.words = [], this.done = /* @__PURE__ */ new WeakSet(), this.chars = 0;
    }
    async scan(root) {
      if (!this.on || this.chars > MAX_CHARS) return;
      let nodes = [], accept = (t) => !this.done.has(t) && CJK.test(t.data) && !t.parentElement?.closest(SKIP);
      if (root.nodeType === Node.TEXT_NODE) {
        let t = root;
        accept(t) && (nodes.push(t), this.done.add(t), this.chars += t.data.length);
      }
      let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => accept(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      for (let n = walker.nextNode(); n && this.chars < MAX_CHARS; n = walker.nextNode())
        nodes.push(n), this.done.add(n), this.chars += n.data.length;
      for (let i = 0; i < nodes.length; i += 400) {
        let batch = nodes.slice(i, i + 400), tokens = await browser.runtime.sendMessage({ type: "segment", lines: batch.map((n) => n.data) });
        batch.forEach((node, k) => {
          let off = 0;
          for (let t of tokens[k]) {
            if (t.word && CJK.test(t.text)) {
              let r = document.createRange();
              r.setStart(node, off), r.setEnd(node, off + t.text.length), this.words.push({ range: r, word: t.word });
            }
            off += t.text.length;
          }
        });
      }
      this.paint();
    }
    paint() {
      if (!this.on || !CSS.highlights) return;
      let sets = { fresh: [], learning: [], known: [] };
      this.words = this.words.filter((w2) => w2.range.startContainer.isConnected);
      for (let w2 of this.words) {
        let st = state.status(w2.word);
        st && sets[st].push(w2.range);
      }
      for (let st of Object.keys(sets)) CSS.highlights.set(NAMES[st], new Highlight(...sets[st]));
    }
    /** Share of the words on this page per status, for the toolbar popup. */
    stats() {
      let c = { fresh: 0, learning: 0, known: 0, new: 0, total: this.words.length, on: this.on };
      for (let w2 of this.words) c[state.status(w2.word) ?? "new"]++;
      return c;
    }
  };

  // src/shared/export.ts
  function shortSource(url, t) {
    try {
      let u = new URL(url);
      return u.hostname.endsWith("youtube.com") && u.searchParams.get("v") ? `youtu.be/${u.searchParams.get("v")}${t != null ? `?t=${Math.floor(t)}` : ""}` : u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  // src/content/audio.ts
  var ctx;
  function audio() {
    return ctx ??= new AudioContext(), ctx.state === "suspended" && ctx.resume(), ctx;
  }
  function note(ac, freq, at, len, gain, type = "sine") {
    let o = ac.createOscillator(), g = ac.createGain();
    o.type = type, o.frequency.setValueAtTime(freq, at), g.gain.setValueAtTime(1e-4, at), g.gain.exponentialRampToValueAtTime(gain, at + 8e-3), g.gain.exponentialRampToValueAtTime(1e-4, at + len), o.connect(g).connect(ac.destination), o.start(at), o.stop(at + len + 0.02);
  }
  function stampSound(status) {
    if (state.settings.sounds)
      try {
        let ac = audio(), t = ac.currentTime + 5e-3;
        switch (status) {
          case "fresh":
            note(ac, 1046.5, t, 0.09, 0.05, "triangle"), note(ac, 1568, t + 0.055, 0.12, 0.04, "triangle");
            break;
          case "learning":
            note(ac, 523.25, t, 0.16, 0.07), note(ac, 1046.5, t, 0.08, 0.02);
            break;
          case "known":
            note(ac, 784, t, 0.1, 0.045), note(ac, 988, t + 0.05, 0.1, 0.045), note(ac, 1175, t + 0.1, 0.18, 0.05);
            break;
          default:
            note(ac, 440, t, 0.07, 0.035), note(ac, 330, t + 0.045, 0.1, 0.03);
        }
      } catch {
      }
  }
  var clipCache = /* @__PURE__ */ new Map(), playing;
  async function speak(text) {
    let s = state.settings, order = s.voice === "azure" ? ["azure", "google", "system"] : s.voice === "google" ? ["google", "system"] : ["system"], errors = [];
    for (let engine of order)
      try {
        if (engine === "system")
          return speakSystem(text), { engine, errors };
        if (engine === "azure" && !s.azureKey) {
          errors.push("No Azure key yet.");
          continue;
        }
        return await playClip(engine, text), { engine, errors };
      } catch (e) {
        let msg = String(e instanceof Error ? e.message : e);
        errors.push(msg), console.warn(`[chinese-brain] ${engine} voice failed, trying the next one:`, msg);
      }
    return { engine: "system", errors };
  }
  async function playClip(engine, text) {
    let s = state.settings, key = `${engine}|${engine === "azure" ? s.azureVoice : ""}|${s.speechRate}|${text}`, ac = audio(), buf = clipCache.get(key);
    if (!buf) {
      let res = await browser.runtime.sendMessage({ type: "tts", engine, text });
      if (!res?.audio) throw new Error(res?.error ?? "no audio");
      buf = await ac.decodeAudioData(res.audio.slice(0)), clipCache.size > 100 && clipCache.clear(), clipCache.set(key, buf);
    }
    stopPlaying(ac);
    let src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = buf;
    let t = ac.currentTime + 0.01, end = t + buf.duration, fade = Math.min(0.04, buf.duration / 4);
    gain.gain.setValueAtTime(0, t), gain.gain.linearRampToValueAtTime(1, t + 8e-3), gain.gain.setValueAtTime(1, end - fade), gain.gain.linearRampToValueAtTime(0, end), src.connect(gain).connect(ac.destination), src.start(t), src.stop(end + 0.02), playing = { src, gain }, src.onended = () => {
      playing?.src === src && (playing = void 0);
    };
  }
  function stopPlaying(ac) {
    if (!playing) return;
    let { src, gain } = playing, t = ac.currentTime;
    gain.gain.cancelScheduledValues(t), gain.gain.setValueAtTime(gain.gain.value, t), gain.gain.linearRampToValueAtTime(0, t + 0.02);
    try {
      src.stop(t + 0.03);
    } catch {
    }
    playing = void 0;
  }
  var voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ?? voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  function speakSystem(text) {
    if (!("speechSynthesis" in window)) return;
    voice || pickVoice(), speechSynthesis.speaking && speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(/[。！？.!?]$/.test(text) ? text : text + "\u3002");
    u.lang = "zh-TW", voice && (u.voice = voice), u.rate = state.settings.speechRate, speechSynthesis.speak(u);
  }

  // src/content/popup.css
  var popup_default = `:host {
  all: initial;
  --bg: #ffffff;
  --bg2: #f5f5f9;
  --line: #e2e2ec;
  --text: #1b1d3a;
  --text2: #565a7e;
  --text3: #8a8eb0;
  --fresh: #ef2f42;
  --learning: #ffc81f;
  --known: #1fae4f;
  --fresh-mark: #ffd3d8;
  --learning-mark: #ffe680;
  --known-mark: #c9eed5;
  --link: #3b48c4;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
}

/* Sizes are in em of the card's 14px (16px when large), so the whole card scales together. */
.card {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  width: max-content;
  min-width: 17em;
  max-width: min(30em, calc(100vw - 16px));
  max-height: min(72vh, 40em);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  font: 14px/1.45 var(--sans);
  box-shadow: 0 8px 28px rgba(27, 29, 58, 0.16), 0 1px 3px rgba(27, 29, 58, 0.08);
  text-align: left;
  pointer-events: auto;
  scrollbar-width: thin;
}
.card.large { font-size: 16px; }
.card[hidden] { display: none; }

.top { position: relative; padding: 0.86em 1.15em 0.7em; }
.headrow { display: flex; align-items: baseline; gap: 0.85em; flex-wrap: wrap; }
.head { font: 600 2.15em/1.15 var(--sans); letter-spacing: 0.02em; padding: 0 3px; margin: 0 -3px; border-radius: 4px; }
.head.st-fresh { background: var(--fresh-mark); }
.head.st-learning { background: var(--learning-mark); }
.head.st-known { background: var(--known-mark); }
.py { font-size: 1.07em; color: var(--text3); letter-spacing: 0.01em; }
.py.hidden { color: transparent; text-shadow: 0 0 9px var(--text2); cursor: pointer; }

/* How common the word is, in words (the tooltip says what that means for you). */
.freq { margin-left: auto; display: flex; align-items: center; gap: 0.45em; font-size: 0.86em; color: var(--text3); white-space: nowrap; cursor: default; }
.bars { display: inline-flex; gap: 2px; align-items: flex-end; height: 0.9em; }
.bars i { width: 3px; background: var(--line); border-radius: 1px; }
.bars i:nth-child(1) { height: 30%; }
.bars i:nth-child(2) { height: 47%; }
.bars i:nth-child(3) { height: 64%; }
.bars i:nth-child(4) { height: 82%; }
.bars i:nth-child(5) { height: 100%; }
.bars i.on { background: var(--link); }
.freq.f5, .freq.f4 { color: var(--link); }

.defs { margin-top: 0.43em; color: var(--text); }
.defs .sep { color: var(--text3); padding: 0 0.43em; }
.reading + .reading { margin-top: 0.43em; }
.reading .rpy { color: var(--text2); margin-right: 0.57em; }
.cl { margin-top: 0.3em; font-size: 0.93em; color: var(--text2); }

.sect { border-top: 1px solid var(--line); padding: 0.57em 1.15em; }
.chars { display: grid; grid-template-columns: auto auto 1fr; gap: 0.2em 0.7em; align-items: baseline; }
.chars .cpy { color: var(--text3); font-size: 0.86em; white-space: nowrap; }
.chars .cg { color: var(--text2); font-size: 0.93em; line-height: 1.4; }

.ex { margin: 0; padding: 0; list-style: none; }
.ex li + li { margin-top: 0.36em; }
.ex .zh { font-size: 1.07em; }
.ex .en { display: block; font-size: 0.89em; color: var(--text2); }
.label { font-size: 0.79em; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text3); margin-bottom: 0.3em; }
.seen .src { all: unset; cursor: pointer; font-size: 0.86em; color: var(--link); margin-left: 0.43em; text-decoration: none; }
.seen .src:hover { text-decoration: underline; }
.gem { all: unset; cursor: pointer; font-size: 0.89em; color: var(--link); }
.gem:hover { text-decoration: underline; }
.gem[disabled] { cursor: default; color: var(--text3); text-decoration: none; }
.gemrow .err { font-size: 0.86em; color: var(--fresh); margin-top: 0.2em; }

.foot { display: flex; align-items: center; gap: 0.7em; padding: 0.57em 0.85em 0.7em 1em; border-top: 1px solid var(--line); background: var(--bg2); }
.stamps { display: flex; gap: 0.57em; }
.stamp {
  all: unset;
  cursor: pointer;
  box-sizing: border-box;
  position: relative;
  width: 2.57em;
  height: 2.57em;
  border-radius: 50%;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--line);
  background: var(--bg);
  font: 600 1.15em/1 var(--sans);
  color: var(--text2);
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.12s, border-color 0.12s, color 0.12s;
}
.stamp small { position: absolute; right: -3px; bottom: -3px; font: 600 0.56em/1 var(--sans); color: var(--text3); background: var(--bg2); padding: 1px 2px; border-radius: 3px; }
.stamp:hover { border-color: var(--text3); color: var(--text); }
.stamp:active { transform: scale(0.88); }
.stamp.fresh { border-color: color-mix(in srgb, var(--fresh) 45%, var(--line)); }
.stamp.learning { border-color: color-mix(in srgb, var(--learning) 75%, var(--line)); }
.stamp.known { border-color: color-mix(in srgb, var(--known) 45%, var(--line)); }
.stamp.on { transform: rotate(-10deg); color: #fff; }
.stamp.fresh.on { background: var(--fresh); border-color: var(--fresh); }
.stamp.learning.on { background: var(--learning); border-color: var(--learning); color: var(--text); }
.stamp.known.on { background: var(--known); border-color: var(--known); }
.stamp.pop { animation: pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes pop {
  0% { transform: rotate(0) scale(0.85); }
  60% { transform: rotate(-14deg) scale(1.08); }
  100% { transform: rotate(-10deg) scale(1); }
}
.tools { margin-left: auto; display: flex; gap: 0.85em; font-size: 0.89em; }
.tools button { all: unset; cursor: pointer; color: var(--link); }
.tools kbd { font: inherit; color: var(--text3); margin-left: 3px; }

/* Every Chinese word in the card is clickable; a quiet underline on hover, plus a small hint. */
.w { cursor: pointer; border-radius: 3px; }
.w:hover { text-decoration: underline; text-decoration-color: var(--text3); text-underline-offset: 3px; }
.w.st-fresh { background: var(--fresh-mark); }
.w.st-learning { background: var(--learning-mark); }
.w.st-known { background: var(--known-mark); }
.ex .w.hw { box-shadow: inset 0 -2px 0 var(--learning); }
.chars .w.c { font-size: 1.36em; padding: 0 2px; }
.back { all: unset; cursor: pointer; position: absolute; left: 0.43em; top: 0.43em; font-size: 0.93em; color: var(--text3); padding: 2px 5px; border-radius: 4px; }
.back:hover { color: var(--text); background: var(--bg2); }
.top:has(.back) .headrow { padding-left: 1.15em; }

/* The word hint: read-only, never in the way (the pointer passes straight through it). */
.hint {
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
  max-width: 22em;
  padding: 0.25em 0.6em 0.3em;
  border-radius: 6px;
  background: var(--text);
  color: #fff;
  font: 13px/1.35 var(--sans);
  box-shadow: 0 3px 10px rgba(27, 29, 58, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hint.large { font-size: 15px; }
.hint[hidden] { display: none; }
.hint .hpy { color: #c9cdf0; margin-right: 0.5em; }
`;

  // src/content/popup.ts
  var STAMPS = [
    { s: "fresh", zh: "\u65B0", key: "1", label: "Fresh" },
    { s: "learning", zh: "\u5B78", key: "2", label: "Learning" },
    { s: "known", zh: "\u719F", key: "3", label: "Known" }
  ];
  function h(tag, attrs, ...kids) {
    let el3 = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el3.setAttribute(k, v);
    for (let k of kids) k && el3.append(k);
    return el3;
  }
  function prettyDef(d) {
    return d.replace(/([^\s\[|,;(]+)(?:\|([^\s\[,;]+))?\[([a-zA-Z0-9: ]+)\]/g, (_, t, _s, p) => `${t} ${numberedToMarked(p)}`);
  }
  var FREQ = [
    { min: 52, bars: 5, label: "essential", tip: "One of the words you'll meet every day. Learn it now." },
    { min: 45, bars: 4, label: "very common", tip: "Comes up all the time in speech and writing. Worth learning soon." },
    { min: 40, bars: 3, label: "common", tip: "You'll meet it regularly in shows, news and conversation." },
    { min: 33, bars: 2, label: "less common", tip: "Shows up now and then. Learn it if it keeps coming back." },
    { min: 1, bars: 1, label: "rare", tip: "Rarely used. Fine to skip for now." }
  ];
  function frequency(zipf) {
    return FREQ.find((f) => zipf >= f.min);
  }
  function mainSense(e) {
    let d = e.defs.find((x) => !x.startsWith("CL:") && !/^(old )?variant of|^see /i.test(x)) ?? e.defs[0] ?? "", first = prettyDef(d).split(/;\s*/)[0];
    return first.length > 60 ? first.slice(0, 58) + "\u2026" : first;
  }
  function inTrapezoid(p, p0, p1, lo0, hi0, lo1, hi1, q, pad) {
    if (p < Math.min(p0, p1) - pad || p > Math.max(p0, p1) + pad) return !1;
    let t = p1 === p0 ? 0 : Math.min(1, Math.max(0, (p - p0) / (p1 - p0)));
    return q >= lo0 + (lo1 - lo0) * t - pad && q <= hi0 + (hi1 - hi0) * t + pad;
  }
  var Popup = class {
    host;
    root;
    card;
    /** The small, non-interactive hint over words inside the card. */
    hint;
    hintSeq = 0;
    opts;
    info;
    extra = [];
    gemState;
    /** The word the card belongs to, for the corridor between them (gone after a scroll). */
    anchor;
    px = -1;
    py = -1;
    shownAt = 0;
    hovered = !1;
    revealPy = !1;
    /** Cards visited by clicking words inside the card (for the back arrow). */
    history = [];
    lookTimer;
    softTimer;
    hideListeners = /* @__PURE__ */ new Set();
    infoCache = /* @__PURE__ */ new Map();
    constructor() {
      this.host = document.createElement("chinese-brain-popup"), this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = popup_default, this.card = h("div", { class: "card", hidden: "" }), this.hint = h("div", { class: "hint", hidden: "" }), this.root.append(style, this.card, this.hint), document.addEventListener(
        "mousemove",
        (e) => {
          this.px = e.clientX, this.py = e.clientY;
        },
        { capture: !0, passive: !0 }
      ), this.card.addEventListener("mouseover", (e) => {
        let w2 = e.target.closest(".w");
        w2 && !w2.classList.contains("c") ? this.showHint(w2) : this.hideHint();
      }), this.card.addEventListener("mouseout", (e) => {
        let w2 = e.target.closest(".w");
        w2 && !w2.contains(e.relatedTarget) && this.hideHint();
      }), this.card.addEventListener("scroll", () => this.hideHint(), { passive: !0 });
      for (let t of ["mousedown", "mouseup", "dblclick", "pointerdown", "pointerup"]) this.card.addEventListener(t, (e) => e.stopPropagation());
      this.card.addEventListener("click", (e) => {
        e.stopPropagation(), this.onCardClick(e);
      }), this.card.addEventListener("mouseenter", () => {
        this.hovered = !0, clearTimeout(this.softTimer);
      }), this.card.addEventListener("mouseleave", () => {
        this.hovered = !1, this.hideHint(), this.pinned || this.hideSoon();
      }), state.onChange(() => {
        this.opts && (this.infoCache.clear(), this.render());
      }), document.addEventListener("fullscreenchange", () => this.mount());
    }
    get visible() {
      return !!this.opts;
    }
    /** Where the open card came from ('yt' subtitles or 'web'). */
    get src() {
      return this.opts?.src;
    }
    get pinned() {
      return !!this.opts?.pinned;
    }
    /** Milliseconds since the card was last shown. */
    age() {
      return Date.now() - this.shownAt;
    }
    get current() {
      return this.opts?.matches[0];
    }
    get isHovered() {
      return this.hovered;
    }
    contains(node) {
      return node === this.host;
    }
    mount() {
      let parent = document.fullscreenElement ?? document.documentElement;
      this.host.parentNode !== parent && parent.append(this.host);
    }
    onHide(fn) {
      this.hideListeners.add(fn);
    }
    /**
     * Hide after a short grace period, unless the pointer is on the card or on its
     * way there: while it is in the corridor between the word and the card, however
     * slowly it moves, the card waits.
     */
    hideSoon(ms = 300) {
      if (!this.opts || this.pinned) return;
      clearTimeout(this.softTimer);
      let check = () => {
        if (!(!this.opts || this.pinned || this.hovered)) {
          if (this.inBridge(this.px, this.py)) {
            this.softTimer = setTimeout(check, 100);
            return;
          }
          this.hide();
        }
      };
      this.softTimer = setTimeout(check, ms);
    }
    /** Is (x, y) in the corridor between the word and the card (whichever side the card is on)? */
    inBridge(x, y) {
      let a = this.anchor;
      if (!this.opts || !a || this.card.hidden || x < 0) return !1;
      let c = this.card.getBoundingClientRect(), pad = 8;
      return c.top >= a.bottom - 2 ? inTrapezoid(y, a.bottom, c.top, a.left, a.right, c.left, c.right, x, pad) : c.bottom <= a.top + 2 ? inTrapezoid(y, a.top, c.bottom, a.left, a.right, c.left, c.right, x, pad) : c.left >= a.right - 2 ? inTrapezoid(x, a.right, c.left, a.top, a.bottom, c.top, c.bottom, y, pad) : c.right <= a.left + 2 ? inTrapezoid(x, a.left, c.right, a.top, a.bottom, c.top, c.bottom, y, pad) : !1;
    }
    /** The page scrolled under a card the pointer rests on: keep it, but the word has moved away. */
    detach() {
      this.anchor = void 0, this.hideHint();
    }
    cancelHide() {
      clearTimeout(this.softTimer);
    }
    async show(opts, keepPlace = !1) {
      let sameWord = this.opts?.matches[0]?.word === opts.matches[0]?.word;
      this.opts = opts, clearTimeout(this.softTimer), sameWord || (this.revealPy = !1), keepPlace || (this.history = []), this.mount();
      let m = opts.matches[0], e0 = m.entries[0], [, info] = await Promise.all([state.loadStatuses(), this.wordInfo(m.word, e0.tw || e0.py)]);
      if (this.opts !== opts) return;
      let extra = await this.relatedFor(opts, m.word, info);
      this.opts === opts && (this.info = info, this.extra = extra, this.hideHint(), this.render(), keepPlace || (this.anchor = opts.rect, this.position(opts)), this.shownAt = Date.now(), clearTimeout(this.lookTimer), this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200));
    }
    /** Sentences from this video or page to fill in when the dictionary has fewer than two examples. */
    async relatedFor(opts, word, info) {
      let want = 2 - info.examples.length;
      if (want <= 0 || !opts.related) return [];
      let here = opts.ctx?.text.split(" \u2014 ")[0].trim(), seenTexts = new Set(info.seen.map((c) => c.zh)), list = opts.related(word).filter((r) => r.text !== here && !seenTexts.has(r.text)).slice(0, want);
      if (!list.length) return [];
      let toks = await browser.runtime.sendMessage({ type: "segment", lines: list.map((r) => r.text) });
      return list.map((r, i) => ({ ...r, zh: r.text, toks: toks[i] ?? [] }));
    }
    async wordInfo(word, py) {
      let hit = this.infoCache.get(word);
      if (hit) return hit;
      let info = await browser.runtime.sendMessage({ type: "wordInfo", word, py });
      return this.infoCache.size > 200 && this.infoCache.clear(), this.infoCache.set(word, info), info;
    }
    hide() {
      this.opts && (clearTimeout(this.lookTimer), clearTimeout(this.softTimer), this.opts = void 0, this.history = [], this.hovered = !1, this.anchor = void 0, this.card.hidden = !0, this.hideHint(), this.hideListeners.forEach((f) => f()));
    }
    recordLook() {
      let m = this.current;
      !m || !this.opts || browser.runtime.sendMessage({ type: "looked", word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.opts.ctx });
    }
    /** Set a status; pressing the active one again clears it. */
    setStatus(status, toggle = !0) {
      let m = this.current;
      if (!m || !this.opts) return;
      let cur = state.status(m.word), next = toggle && cur === status ? null : status;
      next !== cur && (next ? state.statuses.set(m.word, next) : state.statuses.delete(m.word), stampSound(next), this.infoCache.delete(m.word), this.render(next ?? void 0), browser.runtime.sendMessage({ type: "setStatus", word: m.word, status: next, entry: m.entries[0], ctx: this.opts.ctx }));
    }
    speak() {
      let m = this.current;
      m && speak(m.word);
    }
    images() {
      let m = this.current;
      m && window.open(`https://duckduckgo.com/?q=${encodeURIComponent(m.word)}&iax=images&ia=images&kl=tw-tzh`, "_blank");
    }
    /** Open a word clicked inside the card, in the same place, with a way back. */
    async openInside(q) {
      if (!this.opts) return;
      let matches = await lookupText(q);
      !matches.length || !this.opts || (this.history.push(this.opts), await this.show({ ...this.opts, matches, ctx: this.opts.ctx, pinned: !0 }, !0));
    }
    back() {
      let prev = this.history.pop();
      prev && this.show({ ...prev, pinned: !0 }, !0);
    }
    onCardClick(e) {
      let t = e.target.closest("[data-q]");
      t?.dataset.q && this.openInside(t.dataset.q);
    }
    /** Keyboard shortcuts while the card is open. Returns true when handled. */
    handleKey(e) {
      if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return !1;
      switch (e.key) {
        case "1":
          return this.setStatus("fresh"), !0;
        case "2":
          return this.setStatus("learning"), !0;
        case "3":
          return this.setStatus("known"), !0;
        case "0":
        case "Backspace":
          return this.setStatus(null, !1), !0;
        case "v":
          return this.speak(), !0;
        case "i":
          return this.images(), !0;
        case "p": {
          let pinyin = !state.settings.pinyin;
          return state.settings = { ...state.settings, pinyin }, this.revealPy = !1, this.render(), browser.runtime.sendMessage({ type: "saveSettings", settings: { pinyin } }), !0;
        }
        case "Escape":
          return this.history.length ? this.back() : this.hide(), !0;
      }
      return !1;
    }
    async showHint(el3) {
      let q = el3.dataset.q;
      if (!q) return;
      let seq = ++this.hintSeq, matches = await lookupText(q);
      if (seq !== this.hintSeq || !el3.isConnected || this.card.hidden) return;
      let m = matches.find((x) => x.text === q) ?? matches[0];
      if (!m) return this.hideHint();
      let e = m.entries[0], hint = this.hint;
      hint.classList.toggle("large", state.settings.cardSize === "large"), hint.replaceChildren(
        state.settings.pinyin ? h("span", { class: "hpy" }, numberedToMarked(e.tw || e.py)) : "",
        h("span", { class: "hg" }, mainSense(e))
      ), hint.hidden = !1;
      let r = el3.getBoundingClientRect(), w2 = hint.offsetWidth, ht = hint.offsetHeight, y = r.top - ht - 6;
      y < 4 && (y = r.bottom + 6), hint.style.left = `${Math.min(Math.max(4, r.left + r.width / 2 - w2 / 2), window.innerWidth - w2 - 4)}px`, hint.style.top = `${y}px`;
    }
    hideHint() {
      this.hintSeq++, this.hint.hidden = !0;
    }
    /** Ask Gemini for two sentences when the bundled list has none for this word. */
    async writeExamples(word) {
      this.gemState = { word, busy: !0 }, this.render();
      let res = await browser.runtime.sendMessage({ type: "geminiExamples", word });
      if (this.current?.word === word) {
        if (res.ok) {
          this.gemState = void 0, this.infoCache.delete(word);
          let e0 = this.current.entries[0];
          this.info = await this.wordInfo(word, e0.tw || e0.py), this.extra = [];
        } else this.gemState = { word, busy: !1, error: res.error };
        this.render();
      }
    }
    /** Just below the pointer (or the word), never on top of the line being read. */
    position(o) {
      let c = this.card, r = o.rect, vw = window.innerWidth, vh = window.innerHeight, w2 = c.offsetWidth, ht = c.offsetHeight, x0 = o.cursor ? o.cursor.x - 28 : r.left, x = Math.min(Math.max(8, x0), vw - w2 - 8), y = Math.max(r.bottom, o.cursor?.y ?? 0) + 12;
      y + ht > vh - 8 && (y = Math.max(8, r.top - ht - 10)), c.style.left = `${x}px`, c.style.top = `${y}px`;
    }
    /** A clickable, status-colored word. */
    word(text, q, word) {
      let el3 = h("span", { class: "w", "data-q": q }, text), st = state.settings.cardColors && word ? state.status(word) : void 0;
      return st && el3.classList.add("st-" + st), el3;
    }
    /** Sentence tokens as clickable words; the headword is underlined. */
    sentence(toks, head) {
      return toks.map((t) => {
        let text = t.trad ?? t.text;
        if (!t.word && !CJK.test(t.text)) return text;
        let el3 = this.word(text, t.text, t.word);
        return (t.word === head || text === head) && el3.classList.add("hw"), el3;
      });
    }
    /** Plain text with its Chinese runs made clickable (definitions, measure words). */
    richText(text) {
      let out = [];
      for (let m of text.matchAll(/[㐀-鿿豈-﫿]+|[^㐀-鿿豈-﫿]+/g))
        out.push(CJK.test(m[0][0]) ? this.word(m[0], m[0], m[0]) : m[0]);
      return out;
    }
    render(stamped) {
      let o = this.opts, m = o?.matches[0];
      if (!o || !m) return;
      let status = state.status(m.word), e0 = m.entries[0], s = state.settings, card = this.card;
      card.classList.toggle("pinned", !!o.pinned), card.classList.toggle("large", s.cardSize === "large"), card.replaceChildren();
      let freq = frequency(Math.max(...m.entries.map((e) => e.zipf))), pyHidden = !s.pinyin && !this.revealPy, pyEl = h("span", { class: `py${pyHidden ? " hidden" : ""}`, title: pyHidden ? "p: show pinyin" : "" }, numberedToMarked(e0.tw || e0.py, !1));
      pyEl.addEventListener("click", () => {
        this.revealPy = !0, this.render();
      });
      let groups = /* @__PURE__ */ new Map();
      for (let e of m.entries) {
        let k = (e.tw || e.py).toLowerCase();
        groups.has(k) || groups.set(k, []), groups.get(k).push(e);
      }
      let readings = [], first = !0;
      for (let [reading, list] of groups) {
        let defs = [...new Set(list.flatMap((e) => e.defs))], senses = defs.filter((d) => !d.startsWith("CL:")).slice(0, 10).map(prettyDef), cls = defs.filter((d) => d.startsWith("CL:")).flatMap((d) => d.slice(3).split(",")), line = h("div", { class: "defs" });
        first || line.append(h("span", { class: "rpy" }, numberedToMarked(reading, !1))), senses.forEach((d, i) => {
          i && line.append(h("span", { class: "sep" }, "\xB7")), line.append(...this.richText(d));
        });
        let block = h("div", { class: "reading" }, line);
        cls.length && block.append(
          h(
            "div",
            { class: "cl" },
            "measure word ",
            ...cls.flatMap((c, i) => {
              let mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
              return mm ? [i ? ", " : "", this.word(mm[1], mm[1], mm[1]), " " + numberedToMarked(mm[2])] : [];
            })
          )
        ), readings.push(block), first = !1;
      }
      let head = h("span", { class: `head${status ? " st-" + status : ""}` }, m.word), top = h("div", { class: "top" });
      if (this.history.length) {
        let backBtn = h("button", { class: "back", title: "Back (Esc)" }, "\u2190");
        backBtn.addEventListener("click", () => this.back()), top.append(backBtn);
      }
      top.append(
        h(
          "div",
          { class: "headrow" },
          head,
          pyEl,
          freq ? h(
            "span",
            { class: `freq f${freq.bars}`, title: freq.tip },
            h("span", { class: "bars" }, ...[1, 2, 3, 4, 5].map((i) => h("i", { class: i <= freq.bars ? "on" : "" }))),
            freq.label
          ) : null
        ),
        ...readings
      ), card.append(top);
      let info = this.info;
      if (info?.chars.length) {
        let grid = h("div", { class: "chars" });
        for (let c of info.chars) {
          let ch = this.word(c.ch, c.ch, c.ch);
          ch.classList.add("c"), grid.append(ch, h("span", { class: "cpy" }, pyHidden ? "" : numberedToMarked(c.py)), h("span", { class: "cg" }, c.gloss));
        }
        card.append(h("div", { class: "sect" }, grid));
      }
      let seen = (info?.seen ?? []).filter((c) => c.text !== o.ctx?.text).slice(0, 3), extra = this.extra, canWrite = !info?.examples.length && !!s.geminiKey;
      if (info?.examples.length || seen.length || extra.length || canWrite) {
        let sect = h("div", { class: "sect" });
        if (info?.examples.length && sect.append(
          h(
            "ul",
            { class: "ex" },
            ...info.examples.map((x) => h("li", null, h("span", { class: "zh" }, ...this.sentence(x.toks, m.word)), h("span", { class: "en" }, x.en)))
          )
        ), extra.length && sect.append(
          h("div", { class: "label", style: info?.examples.length ? "margin-top:8px" : "" }, o.relatedLabel ?? "Also here"),
          h(
            "ul",
            { class: "ex seen" },
            ...extra.map((x) => {
              let link = null;
              if (x.t != null && o.seek) {
                let t = x.t;
                link = h("button", { class: "src", title: "Play from here" }, `\u25B6 ${clock(t)}`), link.addEventListener("click", () => o.seek(t));
              }
              return h("li", null, h("span", { class: "zh" }, ...this.sentence(x.toks, m.word)), link);
            })
          )
        ), canWrite) {
          let g = this.gemState?.word === m.word ? this.gemState : void 0, b = h("button", { class: "gem" }, g?.busy ? "Writing example sentences\u2026" : "\u2726 Write example sentences with Gemini");
          g?.busy && b.setAttribute("disabled", ""), b.addEventListener("click", () => void this.writeExamples(m.word)), sect.append(h("div", { class: "gemrow", style: info?.examples.length || extra.length ? "margin-top:8px" : "" }, b, g?.error ? h("div", { class: "err" }, g.error) : null));
        }
        seen.length && sect.append(
          h("div", { class: "label", style: info?.examples.length || extra.length || canWrite ? "margin-top:8px" : "" }, "You met it in"),
          h(
            "ul",
            { class: "ex seen" },
            ...seen.map((c) => {
              let href = c.src === "yt" && c.t != null ? `${c.url}&t=${c.t}s` : c.url;
              return h(
                "li",
                null,
                h("span", { class: "zh" }, ...this.sentence(c.toks, m.word)),
                h("a", { class: "src", href, target: "_blank" }, c.src === "yt" && c.t != null ? `\u25B6 ${clock(c.t)}` : shortSource(c.url))
              );
            })
          )
        ), card.append(sect);
      }
      let stamps = STAMPS.map((st) => {
        let b = h(
          "button",
          { class: `stamp ${st.s}${status === st.s ? " on" : ""}${stamped === st.s ? " pop" : ""}`, title: `${st.label} (${st.key})` },
          st.zh,
          h("small", null, st.key)
        );
        return b.addEventListener("click", () => this.setStatus(st.s)), b;
      }), say = h("button", null, "say", h("kbd", null, "v"));
      say.addEventListener("click", () => this.speak());
      let img = h("button", null, "images", h("kbd", null, "i"));
      img.addEventListener("click", () => this.images()), card.append(h("div", { class: "foot" }, h("div", { class: "stamps" }, ...stamps), h("div", { class: "tools" }, say, img))), card.hidden = !1;
    }
  };

  // src/content/index.ts
  var w = window;
  w.__chineseBrain || (w.__chineseBrain = !0, state.ready().then(() => {
    let popup = new Popup();
    new HoverLookup(popup), new PageColors(), /(^|\.)youtube\.com$/.test(location.hostname) ? new YouTubeSubs(popup) : window.addEventListener(
      "keydown",
      (e) => {
        isTyping(e) || popup.visible && popup.handleKey(e) && (e.preventDefault(), e.stopImmediatePropagation());
      },
      !0
    );
  }));
})();
