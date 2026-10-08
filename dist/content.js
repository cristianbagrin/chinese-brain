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

  // src/content/state.ts
  var State = class {
    settings = { ...DEFAULT_SETTINGS };
    statuses = /* @__PURE__ */ new Map();
    statusesLoaded;
    settingsLoaded;
    listeners = /* @__PURE__ */ new Set();
    constructor() {
      this.settingsLoaded = browser.storage.local.get("settings").then(({ settings }) => {
        this.settings = { ...DEFAULT_SETTINGS, ...settings };
      });
      browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = false;
        for (const [k, ch] of Object.entries(changes)) {
          if (k === "settings") {
            this.settings = { ...DEFAULT_SETTINGS, ...ch.newValue };
            dirty = true;
          } else if (k.startsWith("w:") && this.statusesLoaded) {
            const rec = ch.newValue;
            if (rec) this.statuses.set(k.slice(2), rec.s);
            else this.statuses.delete(k.slice(2));
            dirty = true;
          }
        }
        if (dirty) this.listeners.forEach((l) => l());
      });
    }
    ready() {
      return this.settingsLoaded;
    }
    loadStatuses() {
      this.statusesLoaded ??= browser.runtime.sendMessage({ type: "statuses" }).then((s) => {
        this.statuses = new Map(Object.entries(s));
        this.listeners.forEach((l) => l());
      });
      return this.statusesLoaded;
    }
    status(word) {
      return word ? this.statuses.get(word) : void 0;
    }
    onChange(l) {
      this.listeners.add(l);
      return () => this.listeners.delete(l);
    }
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(location.hostname);
    }
  };
  var state = new State();

  // src/content/hover.ts
  var HIGHLIGHT = "chinese-brain-hit";
  var cache = /* @__PURE__ */ new Map();
  async function lookupText(text) {
    const key = text.slice(0, 8);
    const hit = cache.get(key);
    if (hit) return hit;
    const res = await browser.runtime.sendMessage({ type: "lookup", text: key });
    if (cache.size > 300) cache.clear();
    cache.set(key, res);
    return res;
  }
  function textFrom(node, offset, max = 10) {
    let text = "";
    const ranges = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    let cur = node;
    let start = offset;
    while (cur && text.length < max) {
      const piece = cur.data.slice(start, start + (max - text.length));
      if (piece) {
        ranges.push([cur, start, start + piece.length]);
        text += piece;
      }
      const next = walker.nextNode();
      if (!next || !sameBlock(cur, next)) break;
      cur = next;
      start = 0;
    }
    return { text, ranges };
  }
  function sameBlock(a, b) {
    const block = (n) => {
      let el = n.parentElement;
      while (el && getComputedStyle(el).display.startsWith("inline")) el = el.parentElement;
      return el;
    };
    return block(a) === block(b);
  }
  function sentenceAround(node, offset) {
    const block = node.parentElement?.closest("p,li,td,h1,h2,h3,h4,div,section,article,blockquote") ?? node.parentElement;
    const full = block?.textContent ?? node.data;
    let pos = offset;
    if (block) {
      const w2 = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let acc = 0;
      for (let n = w2.nextNode(); n; n = w2.nextNode()) {
        if (n === node) {
          pos = acc + offset;
          break;
        }
        acc += n.data.length;
      }
    }
    const stops = /[。！？!?；\n]/;
    let a = pos;
    while (a > 0 && !stops.test(full[a - 1]) && pos - a < 120) a--;
    let b = pos;
    while (b < full.length && !stops.test(full[b]) && b - pos < 160) b++;
    return full.slice(a, Math.min(full.length, b + 1)).trim();
  }
  var HoverLookup = class {
    popup;
    raf = 0;
    lastX = 0;
    lastY = 0;
    shift = false;
    currentKey = "";
    cssInjected = false;
    constructor(popup) {
      this.popup = popup;
      document.addEventListener("mousemove", (e) => this.onMove(e), { passive: true });
      document.addEventListener("mousedown", (e) => {
        if (!this.popup.contains(e.target)) this.popup.hide();
      });
      window.addEventListener("scroll", () => !this.popup.pinned && this.popup.hide(), { passive: true });
      this.popup.onHide(() => {
        this.currentKey = "";
        CSS.highlights?.delete(HIGHLIGHT);
      });
    }
    onMove(e) {
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.shift = e.shiftKey;
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.check(e.target);
      });
    }
    async check(target) {
      if (this.popup.contains(target)) return;
      if (target?.closest?.("[data-cb-own]")) return;
      const s = state.settings;
      if (!state.siteEnabled() || s.hoverMode === "shift" && !this.shift) return this.scheduleHide();
      const pos = document.caretPositionFromPoint?.(this.lastX, this.lastY);
      const node = pos?.offsetNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) return this.scheduleHide();
      const text = node;
      let offset = pos.offset;
      offset = this.charUnderPointer(text, offset);
      if (offset < 0 || !CJK.test(text.data[offset] ?? "")) return this.scheduleHide();
      const { text: str, ranges } = textFrom(text, offset);
      const key = `${str}@${Math.round(this.charRect(text, offset)?.left ?? 0)}`;
      if (key === this.currentKey) {
        this.popup.cancelHide();
        return;
      }
      const matches = await lookupText(str);
      if (!matches.length) return this.scheduleHide();
      this.currentKey = key;
      const range = this.rangeFor(ranges, matches[0].text.length);
      this.highlight(range);
      this.popup.show({
        matches,
        rect: range.getBoundingClientRect(),
        src: "web",
        ctx: { text: sentenceAround(text, offset), url: location.href, title: document.title, at: Date.now(), src: "web" }
      });
    }
    charRect(node, i) {
      if (i < 0 || i >= node.data.length) return void 0;
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + 1);
      return r.getBoundingClientRect();
    }
    charUnderPointer(node, offset) {
      for (const i of [offset, offset - 1]) {
        const r = this.charRect(node, i);
        if (r && this.lastX >= r.left - 1 && this.lastX <= r.right + 1 && this.lastY >= r.top - 2 && this.lastY <= r.bottom + 2) return i;
      }
      return -1;
    }
    rangeFor(ranges, len) {
      const r = document.createRange();
      const [n0, s0] = ranges[0];
      r.setStart(n0, s0);
      let left = len;
      for (const [n, s, e] of ranges) {
        const take = Math.min(left, e - s);
        r.setEnd(n, s + take);
        left -= take;
        if (left <= 0) break;
      }
      return r;
    }
    highlight(range) {
      if (!CSS.highlights) return;
      if (!this.cssInjected) {
        this.cssInjected = true;
        browser.runtime.sendMessage({ type: "insertCSS", css: `::highlight(${HIGHLIGHT}){background:#f3d27a;color:#31261a}` });
      }
      CSS.highlights.set(HIGHLIGHT, new Highlight(range));
    }
    scheduleHide() {
      if (this.currentKey) this.popup.hideSoon();
    }
  };

  // src/youtube/captions.ts
  function parseTimedText(body) {
    const t = body.trimStart();
    if (t.startsWith("{")) return parseJson3(t);
    if (t.startsWith("WEBVTT")) return parseVtt(t);
    if (t.startsWith("<")) return parseXml(t);
    return [];
  }
  function parseJson3(body) {
    const data = JSON.parse(body);
    const cues = [];
    for (const ev of data.events ?? []) {
      if (!ev.segs || ev.aAppend) continue;
      const text = ev.segs.map((s) => s.utf8 ?? "").join("").replace(/\s*\n\s*/g, " ").trim();
      if (!text) continue;
      const start = (ev.tStartMs ?? 0) / 1e3;
      cues.push({ start, end: start + (ev.dDurationMs ?? 2e3) / 1e3, text });
    }
    return tidy(cues);
  }
  function decodeEntities(s) {
    return new DOMParser().parseFromString(s, "text/html").documentElement.textContent ?? s;
  }
  function parseXml(body) {
    const doc = new DOMParser().parseFromString(body, "text/xml");
    const cues = [];
    for (const p of doc.querySelectorAll("p")) {
      const text = (p.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const start = Number(p.getAttribute("t")) / 1e3;
      cues.push({ start, end: start + Number(p.getAttribute("d") ?? 2e3) / 1e3, text });
    }
    for (const p of doc.querySelectorAll("text")) {
      const text = decodeEntities(p.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const start = Number(p.getAttribute("start"));
      cues.push({ start, end: start + Number(p.getAttribute("dur") ?? 2), text });
    }
    return tidy(cues);
  }
  function parseVtt(body) {
    const cues = [];
    const ts = (s) => {
      const parts = s.trim().split(":").map(Number);
      return parts.reduce((acc, n) => acc * 60 + n, 0);
    };
    for (const block of body.split(/\n\n+/)) {
      const m = /([\d:.]+)\s+-->\s+([\d:.]+)[^\n]*\n([\s\S]+)/.exec(block);
      if (!m) continue;
      const text = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (text) cues.push({ start: ts(m[1]), end: ts(m[2]), text });
    }
    return tidy(cues);
  }
  function tidy(cues) {
    cues.sort((a, b) => a.start - b.start);
    const out = [];
    for (const c of cues) {
      const prev = out[out.length - 1];
      if (prev && prev.text === c.text && c.start - prev.end < 0.5) {
        prev.end = Math.max(prev.end, c.end);
        continue;
      }
      if (prev && prev.end > c.start) prev.end = Math.max(prev.start + 0.3, c.start);
      out.push({ ...c });
    }
    return out;
  }
  function alignTranslation(src, tr) {
    let j = 0;
    return src.map((c) => {
      while (j < tr.length && tr[j].end <= c.start) j++;
      const parts = [];
      let best = "";
      let bestOverlap = 0;
      for (let k = j; k < tr.length && tr[k].start < c.end; k++) {
        const t = tr[k];
        const overlap = Math.min(c.end, t.end) - Math.max(c.start, t.start);
        const mid = (t.start + t.end) / 2;
        if (mid >= c.start && mid < c.end) parts.push(t.text);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          best = t.text;
        }
      }
      return parts.length ? parts.join(" ") : best;
    });
  }
  function cueAt(cues, t) {
    let lo = 0;
    let hi = cues.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      if (cues[mid].start <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (ans >= 0 && t < cues[ans].end) return ans;
    return -1;
  }
  function cueBefore(cues, t) {
    let lo = 0;
    let hi = cues.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
      if (cues[mid].start <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }
  var ZH_ORDER = ["zh-TW", "zh-Hant", "zh-HK", "zh", "zh-Hans", "zh-CN", "zh-SG"];
  function pickChinese(tracks) {
    const zh = tracks.filter((t) => /^zh\b/i.test(t.languageCode));
    const score = (t) => {
      const i = ZH_ORDER.findIndex((c) => c.toLowerCase() === t.languageCode.toLowerCase());
      return (t.kind === "asr" ? 100 : 0) + (i < 0 ? 50 : i);
    };
    return zh.sort((a, b) => score(a) - score(b))[0];
  }
  function pickTranslation(tracks, lang) {
    return tracks.find((t) => t.languageCode.split("-")[0] === lang && t.kind !== "asr");
  }
  function urlInfo(url) {
    const u = new URL(url);
    return {
      lang: u.searchParams.get("lang") ?? "",
      tlang: u.searchParams.get("tlang") ?? "",
      kind: u.searchParams.get("kind") ?? "",
      v: u.searchParams.get("v") ?? ""
    };
  }

  // src/youtube/overlay.css
  var overlay_default = ":host {\n  all: initial;\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 72px;\n  z-index: 45;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  pointer-events: none;\n  transition: bottom 0.15s ease;\n  --fresh: #9cc2ff;\n  --difficult: #ff8f9a;\n  --known: #ffffff;\n  --ink-band: rgba(36, 28, 19, 0.78);\n  --mint: #c9efc0;\n  --serif: 'Songti TC', 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', serif;\n  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;\n  --mono: ui-monospace, 'SF Mono', Menlo, monospace;\n}\n:host(.low) { bottom: 3%; }\n:host([hidden]) { display: none; }\n\n.box {\n  pointer-events: auto;\n  max-width: 88%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 0.15em;\n  font-size: var(--fs, 30px);\n}\n.bar {\n  font: 11px/1.6 var(--mono);\n  color: #e8e2d4;\n  background: var(--ink-band);\n  padding: 1px 8px;\n  border-radius: 3px;\n  opacity: 0;\n  transition: opacity 0.15s;\n  white-space: nowrap;\n  user-select: none;\n}\n.box:hover .bar, .bar.flash { opacity: 1; }\n.bar b { color: var(--mint); font-weight: 600; }\n.bar .on { color: #ffd479; }\n\n.zh {\n  background: var(--ink-band);\n  color: #fff;\n  padding: 0.12em 0.45em 0.16em;\n  border-radius: 0.18em;\n  font: 500 1em/1.45 var(--sans);\n  letter-spacing: 0.03em;\n  text-align: center;\n}\n.zh:empty, .tr:empty { display: none; }\n.tok { cursor: pointer; border-radius: 0.12em; padding: 0 0.02em; }\n.tok:hover, .tok.active { background: rgba(255, 255, 255, 0.18); }\n.tok.st-fresh { color: var(--fresh); }\n.tok.st-difficult { color: var(--difficult); }\n.tok.st-known { color: var(--known); }\n.tok.untracked { text-decoration: underline dotted rgba(255, 255, 255, 0.45); text-underline-offset: 0.22em; text-decoration-thickness: 1.5px; }\nruby { ruby-position: over; }\nrt { font: 0.42em/1 var(--mono); color: #e8e2d4; letter-spacing: 0; }\n\n.tr {\n  background: var(--ink-band);\n  color: var(--mint);\n  padding: 0.1em 0.5em 0.14em;\n  border-radius: 0.18em;\n  font: 0.62em/1.4 var(--sans);\n  text-align: center;\n  transition: filter 0.15s;\n}\n.tr.blur { filter: blur(5px); }\n.tr.blur:hover { filter: none; }\n";

  // src/youtube/index.ts
  var TRANSLATION_MODES = ["show", "blur", "hide"];
  var YouTubeSubs = class {
    popup;
    videoId = "";
    tracks = [];
    src;
    cues = [];
    tokens = [];
    trans = [];
    trCues;
    idx = -2;
    loop = false;
    shadow = false;
    shadowDone = -1;
    pausedByUs = false;
    requestedTr = false;
    watchSecs = 0;
    lastTick = 0;
    host;
    root;
    zh;
    tr;
    bar;
    coverage;
    flashTimer;
    constructor(popup) {
      this.popup = popup;
      this.host = document.createElement("div");
      this.host.dataset.cbOwn = "";
      this.host.hidden = true;
      this.root = this.host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = overlay_default;
      const box = document.createElement("div");
      box.className = "box";
      this.bar = document.createElement("div");
      this.bar.className = "bar";
      this.zh = document.createElement("div");
      this.zh.className = "zh";
      this.tr = document.createElement("div");
      this.tr.className = "tr";
      box.append(this.bar, this.zh, this.tr);
      this.root.append(style, box);
      for (const t of ["click", "mousedown", "mouseup", "dblclick", "pointerdown", "pointerup", "touchstart"]) {
        this.host.addEventListener(t, (e) => e.stopPropagation());
      }
      box.addEventListener("mouseenter", () => this.hoverPause(true));
      box.addEventListener("mouseleave", () => this.hoverPause(false));
      this.zh.addEventListener("mouseover", (e) => this.onTokenHover(e));
      this.zh.addEventListener("mouseout", () => this.popup.hideSoon());
      this.zh.addEventListener("click", (e) => this.onTokenClick(e));
      this.popup.onHide(() => this.maybeResume());
      browser.runtime.onMessage.addListener((msg) => {
        if (msg.type === "ytCaptions" && msg.url && msg.body) this.onBody(msg.url, msg.body);
      });
      state.onChange(() => this.renderLine(true));
      window.addEventListener("keydown", (e) => this.onKey(e), true);
      document.addEventListener("yt-navigate-finish", () => this.checkVideo());
      window.addEventListener("pagehide", () => this.flushWatch());
      setInterval(() => this.checkVideo(), 1e3);
      new ResizeObserver(() => this.resize()).observe(document.documentElement);
      this.checkVideo();
      this.tick = this.tick.bind(this);
      requestAnimationFrame(this.tick);
    }
    player() {
      const el = document.getElementById("movie_player");
      return el?.wrappedJSObject ?? el ?? void 0;
    }
    video() {
      return document.querySelector("#movie_player video");
    }
    currentId() {
      if (location.pathname !== "/watch") return "";
      return new URLSearchParams(location.search).get("v") ?? "";
    }
    checkVideo() {
      const id = this.currentId();
      if (id === this.videoId) {
        if (id && !this.src) this.findTracks();
        return;
      }
      this.flushWatch();
      this.videoId = id;
      this.reset();
      if (id) {
        state.loadStatuses();
        this.findTracks();
        browser.runtime.sendMessage({ type: "ytCached" }).then((list) => {
          for (const item of list) this.onBody(item.url, item.body);
        });
      }
    }
    reset() {
      this.tracks = [];
      this.src = void 0;
      this.cues = [];
      this.tokens = [];
      this.trans = [];
      this.trCues = void 0;
      this.idx = -2;
      this.requestedTr = false;
      this.coverage = void 0;
      this.loop = false;
      this.host.hidden = true;
      document.documentElement.classList.remove("cb-subs-on");
    }
    findTracks() {
      const p = this.player();
      if (!p?.getPlayerResponse) return;
      let resp;
      try {
        resp = p.getPlayerResponse();
      } catch {
        return;
      }
      if (!resp || resp.videoDetails?.videoId !== this.videoId) return;
      const list = resp.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      this.tracks = [...list].map((t) => ({
        languageCode: String(t.languageCode),
        kind: t.kind ? String(t.kind) : void 0,
        name: String(t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? t.languageCode),
        vssId: t.vssId ? String(t.vssId) : void 0,
        isTranslatable: !!t.isTranslatable
      }));
      const zh = pickChinese(this.tracks);
      if (!zh) return;
      this.src = zh;
      this.setTrack(zh);
    }
    /** Ask the player to show a track; it downloads it and we capture the body. */
    setTrack(track, tlang) {
      const p = this.player();
      if (!p) return;
      try {
        p.loadModule?.("captions");
        const list = p.getOption?.("captions", "tracklist") ?? [];
        const native = [...list].find((t) => t.languageCode === track.languageCode && (t.kind ?? "") === (track.kind ?? ""));
        const obj = native ? { ...native } : { languageCode: track.languageCode, kind: track.kind ?? "" };
        if (tlang) obj.translationLanguage = { languageCode: tlang, languageName: tlang };
        p.setOption("captions", "track", typeof cloneInto === "function" ? cloneInto(obj, window) : obj);
      } catch (e) {
        console.warn("[chinese-brain] setTrack", e);
      }
    }
    async onBody(url, body) {
      const info = urlInfo(url);
      if (info.v && info.v !== this.videoId) return;
      let cues;
      try {
        cues = parseTimedText(body);
      } catch {
        return;
      }
      if (!cues.length) return;
      const want = state.settings.transLang;
      const isZh = /^zh/i.test(info.lang);
      if (info.tlang) {
        if (info.tlang.split("-")[0] === want) this.setTranslation(cues);
        return;
      }
      if (isZh) {
        if (this.src && this.src.languageCode !== info.lang && this.cues.length) return;
        if (sameCues(cues, this.cues)) return;
        if (!this.src) this.src = { languageCode: info.lang, kind: info.kind || void 0, name: info.lang };
        await this.setSource(cues);
        return;
      }
      if (info.lang.split("-")[0] === want) this.setTranslation(cues);
    }
    async setSource(cues) {
      this.cues = cues;
      this.idx = -2;
      const lines = cues.map((c) => c.text);
      this.tokens = await browser.runtime.sendMessage({ type: "segment", lines });
      if (this.trCues) this.trans = alignTranslation(this.cues, this.trCues);
      this.computeCoverage();
      this.mount();
      if (!this.requestedTr && !this.trCues && this.src) {
        this.requestedTr = true;
        const want = state.settings.transLang;
        const manual = pickTranslation(this.tracks, want);
        setTimeout(() => {
          if (manual) this.setTrack(manual);
          else if (this.src?.isTranslatable !== false) this.setTrack(this.src, want);
          setTimeout(() => this.src && this.setTrack(this.src), 2500);
        }, 300);
      }
    }
    setTranslation(cues) {
      this.trCues = cues;
      if (this.cues.length) this.trans = alignTranslation(this.cues, cues);
      this.renderLine(true);
    }
    computeCoverage() {
      let total = 0;
      let known = 0;
      for (const line of this.tokens)
        for (const t of line) {
          if (!t.word || !CJK.test(t.text)) continue;
          total++;
          if (state.status(t.word) === "known") known++;
        }
      this.coverage = total ? known / total : void 0;
    }
    mount() {
      const p = document.getElementById("movie_player");
      if (!p) return;
      if (this.host.parentNode !== p) p.append(this.host);
      this.host.hidden = false;
      document.documentElement.classList.add("cb-subs-on");
      browser.runtime.sendMessage({
        type: "insertCSS",
        css: "html.cb-subs-on .ytp-caption-window-container{display:none!important}"
      });
      this.resize();
      this.renderBar();
    }
    resize() {
      const p = document.getElementById("movie_player");
      if (!p) return;
      const h2 = p.clientHeight || 480;
      const fs = Math.max(14, Math.min(60, state.settings.subFontSize * h2 / 720));
      this.host.style.setProperty("--fs", `${fs}px`);
    }
    tick(now) {
      requestAnimationFrame(this.tick);
      if (!this.cues.length || this.host.hidden) return;
      const v = this.video();
      if (!v) return;
      const t = v.currentTime;
      const dt = this.lastTick ? (now - this.lastTick) / 1e3 : 0;
      this.lastTick = now;
      if (!v.paused && dt < 1) this.watchSecs += dt;
      const p = this.host.parentElement;
      this.host.classList.toggle("low", !!p?.classList.contains("ytp-autohide"));
      const cur = this.idx >= 0 ? this.cues[this.idx] : void 0;
      if (cur && t >= cur.end - 0.05 && t < cur.end + 0.5) {
        if (this.loop) {
          v.currentTime = cur.start;
          return;
        }
        if (this.shadow && this.shadowDone !== this.idx && !v.paused) {
          this.shadowDone = this.idx;
          v.pause();
          const wait = Math.max(1.5, (cur.end - cur.start) * state.settings.shadowFactor);
          setTimeout(() => {
            if (this.shadow && v.paused) v.play();
          }, wait * 1e3);
          return;
        }
      }
      const i = cueAt(this.cues, t);
      if (i !== this.idx && !(i < 0 && v.paused && this.idx >= 0)) {
        this.idx = i;
        this.renderLine();
      }
    }
    renderLine(force = false) {
      if (force) this.computeCoverage();
      const i = this.idx;
      const toks = i >= 0 ? this.tokens[i] : void 0;
      const s = state.settings;
      this.zh.replaceChildren();
      if (toks) {
        toks.forEach((t, k) => {
          const text = s.toTraditional && t.trad ? t.trad : t.text;
          if (!t.word && !CJK.test(t.text)) {
            this.zh.append(text);
            return;
          }
          const span = document.createElement("span");
          span.className = "tok";
          span.dataset.k = String(k);
          const st = state.status(t.word);
          if (st) span.classList.add("st-" + st);
          else if (s.markUntracked && t.word) span.classList.add("untracked");
          if (s.subPinyin && t.py) {
            const ruby = document.createElement("ruby");
            ruby.append(text);
            const rt = document.createElement("rt");
            rt.textContent = numberedToMarked(t.py);
            ruby.append(rt);
            span.append(ruby);
          } else span.textContent = text;
          this.zh.append(span);
        });
      }
      const tr = i >= 0 ? this.trans[i] ?? "" : "";
      this.tr.textContent = s.translation === "hide" ? "" : tr;
      this.tr.classList.toggle("blur", s.translation === "blur");
      this.resize();
      this.renderBar();
    }
    renderBar() {
      const s = state.settings;
      const src = this.src ? this.src.name || this.src.languageCode : "zh";
      const item = (text, cls = "") => {
        const el = document.createElement(cls === "b" ? "b" : "span");
        if (cls && cls !== "b") el.className = cls;
        el.textContent = text;
        return el;
      };
      const parts = [item(`${src}${this.trCues ? " + " + s.transLang : ""}`)];
      if (this.coverage != null) parts.push(item(`\u719F ${Math.round(this.coverage * 100)}%`, "b"));
      parts.push(item("A \u25C0 \xB7 S \u21BA \xB7 D \u25B6"));
      parts.push(item("R loop", this.loop ? "on" : ""));
      parts.push(item("Q shadow", this.shadow ? "on" : ""));
      parts.push(item("P pinyin", s.subPinyin ? "on" : ""));
      parts.push(item(`X ${s.translation}`));
      this.bar.replaceChildren(...parts.flatMap((p, i) => i ? [" \xB7 ", p] : [p]));
      this.bar.title = "Chinese Brain: \u719F = share of words in this video you marked Known";
    }
    flash() {
      this.bar.classList.add("flash");
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => this.bar.classList.remove("flash"), 1500);
    }
    tokenAt(e) {
      const span = e.target.closest?.(".tok");
      if (!span || this.idx < 0) return void 0;
      const tok = this.tokens[this.idx]?.[Number(span.dataset.k)];
      return tok ? { span, tok, line: this.idx } : void 0;
    }
    async showFor(e, pinned) {
      const hit = this.tokenAt(e);
      if (!hit) return;
      const { span, tok, line } = hit;
      const rest = this.tokens[line].slice(Number(span.dataset.k)).map((t) => t.text).join("");
      let matches = await lookupText(rest);
      const own = matches.findIndex((m) => m.text === tok.text);
      if (own > 0) matches = [matches[own], ...matches.filter((_, i) => i !== own)];
      if (!matches.length) return;
      this.zh.querySelectorAll(".tok.active").forEach((el) => el.classList.remove("active"));
      span.classList.add("active");
      const cue = this.cues[line];
      const ctx = {
        text: cue.text + (this.trans[line] ? ` \u2014 ${this.trans[line]}` : ""),
        url: location.href.split("&")[0],
        title: document.title.replace(/ - YouTube$/, ""),
        t: Math.floor(cue.start),
        at: Date.now(),
        src: "yt"
      };
      await this.popup.show({ matches, rect: span.getBoundingClientRect(), src: "yt", ctx, pinned });
      if (pinned && state.settings.autoFreshOnClick && !state.status(matches[0].word)) this.popup.setStatus("fresh");
    }
    onTokenHover(e) {
      if (this.popup.pinned) return;
      this.showFor(e, false);
    }
    onTokenClick(e) {
      this.showFor(e, true);
    }
    hoverPause(enter) {
      const v = this.video();
      if (!v || !state.settings.pauseOnHover) return;
      if (enter) {
        if (!v.paused) {
          v.pause();
          this.pausedByUs = true;
        }
      } else {
        setTimeout(() => this.maybeResume(), 250);
      }
    }
    maybeResume() {
      const v = this.video();
      if (!v || !this.pausedByUs) return;
      if (this.popup.visible) return;
      const overBox = this.root.querySelector(".box:hover");
      if (overBox) return;
      this.pausedByUs = false;
      v.play();
    }
    seekLine(delta) {
      const v = this.video();
      if (!v || !this.cues.length) return;
      const base = this.idx >= 0 ? this.idx : cueBefore(this.cues, v.currentTime);
      const j = Math.max(0, Math.min(this.cues.length - 1, base + delta));
      v.currentTime = this.cues[j].start + 0.01;
      this.shadowDone = -1;
      if (delta === 0 && v.paused) v.play();
    }
    onKey(e) {
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (this.popup.visible && this.popup.handleKey(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (this.host.hidden || !this.cues.length || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = state.settings;
      let handled = true;
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
          this.loop = !this.loop;
          break;
        case "q":
          this.shadow = !this.shadow;
          this.shadowDone = -1;
          break;
        case "p":
          browser.runtime.sendMessage({ type: "saveSettings", settings: { subPinyin: !s.subPinyin } });
          break;
        case "x": {
          const next = TRANSLATION_MODES[(TRANSLATION_MODES.indexOf(s.translation) + 1) % 3];
          browser.runtime.sendMessage({ type: "saveSettings", settings: { translation: next } });
          break;
        }
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.renderBar();
        this.flash();
      }
    }
    flushWatch() {
      if (this.watchSecs > 30 && this.videoId) {
        browser.runtime.sendMessage({
          type: "watch",
          url: `https://www.youtube.com/watch?v=${this.videoId}`,
          title: document.title.replace(/ - YouTube$/, ""),
          secs: Math.round(this.watchSecs),
          coverage: this.coverage,
          lang: this.src?.languageCode
        });
      }
      this.watchSecs = 0;
    }
  };
  function sameCues(a, b) {
    return a.length === b.length && a[0]?.text === b[0]?.text && a[a.length - 1]?.text === b[b.length - 1]?.text;
  }

  // src/content/popup.css
  var popup_default = ":host {\n  all: initial;\n  --paper: #f6f4ea;\n  --card: #edf5e6;\n  --ink: #31261a;\n  --ink2: #6b5d4b;\n  --rule: #c9c2ae;\n  --fresh: #2f6fc4;\n  --difficult: #b22f3d;\n  --known: #1d7023;\n  --accent: #0a818b;\n  --serif: 'Songti TC', 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', 'MingLiU', serif;\n  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;\n  --mono: ui-monospace, 'SF Mono', Menlo, 'Cascadia Mono', monospace;\n}\n\n.card {\n  position: fixed;\n  z-index: 2147483647;\n  width: max-content;\n  max-width: min(380px, calc(100vw - 16px));\n  max-height: min(70vh, 520px);\n  overflow: auto;\n  background: var(--card);\n  color: var(--ink);\n  border: 1.5px solid var(--ink);\n  border-radius: 7px;\n  font: 14px/1.45 var(--sans);\n  box-shadow: 3px 4px 0 rgba(49, 38, 26, 0.18);\n  text-align: left;\n  pointer-events: auto;\n}\n.card[hidden] { display: none; }\n\n.tabs {\n  display: flex;\n  gap: 2px;\n  padding: 6px 10px 0;\n  font: 12px var(--mono);\n}\n.tabs button {\n  all: unset;\n  cursor: pointer;\n  padding: 2px 7px;\n  color: var(--ink2);\n  border-bottom: 2px solid transparent;\n  font-family: var(--serif);\n  font-size: 14px;\n}\n.tabs button[aria-selected='true'] { color: var(--ink); border-bottom-color: var(--ink); }\n\n.stub {\n  display: grid;\n  grid-template-columns: 1fr auto;\n  align-items: end;\n  gap: 4px 14px;\n  padding: 10px 14px 12px;\n  border-bottom: 2px dotted var(--rule);\n}\n.head { font: 700 34px/1.1 var(--serif); letter-spacing: 0.02em; }\n.head .simp { font-size: 15px; font-weight: 400; color: var(--ink2); margin-left: 8px; letter-spacing: 0; }\n.head.st-fresh { color: var(--fresh); }\n.head.st-difficult { color: var(--difficult); }\n.head.st-known { color: var(--known); }\n\n.stamps { display: flex; gap: 6px; grid-row: span 2; align-self: center; }\n.stamp {\n  all: unset;\n  cursor: pointer;\n  box-sizing: border-box;\n  width: 38px;\n  height: 38px;\n  border: 1.5px solid var(--rule);\n  border-radius: 50%;\n  display: grid;\n  place-items: center;\n  font: 700 17px/1 var(--serif);\n  color: var(--ink2);\n  position: relative;\n}\n.stamp small { position: absolute; bottom: -2px; right: -3px; font: 600 9px/1 var(--mono); color: var(--ink2); background: var(--card); padding: 1px; }\n.stamp:hover { border-color: var(--ink2); color: var(--ink); }\n.stamp.on { transform: rotate(-9deg); border-width: 2.5px; }\n.stamp.fresh.on { color: var(--fresh); border-color: var(--fresh); }\n.stamp.difficult.on { color: var(--difficult); border-color: var(--difficult); }\n.stamp.known.on { color: var(--known); border-color: var(--known); }\n\n.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font: 12px var(--mono); color: var(--ink2); }\n.py { font: 600 16px var(--mono); color: var(--ink); letter-spacing: 0.01em; }\n.tag { border: 1px solid var(--ink2); border-radius: 3px; padding: 0 4px; font-size: 11px; line-height: 16px; }\n.alt { font-size: 11px; }\n\n.body { padding: 8px 14px 10px; }\n.reading + .reading { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--rule); }\n.reading .py { font-size: 14px; }\nol { margin: 4px 0 0; padding-left: 20px; }\nli { margin: 1px 0; }\nli::marker { color: var(--ink2); font: 11px var(--mono); }\n.cl { margin-top: 4px; color: var(--ink2); font-size: 12.5px; }\n.cl b { font: 600 14px var(--serif); color: var(--ink); }\n\n.actions {\n  display: flex;\n  gap: 14px;\n  padding: 6px 14px 8px;\n  border-top: 1px solid var(--rule);\n  font: 12px var(--mono);\n  color: var(--ink2);\n}\n.actions button { all: unset; cursor: pointer; color: var(--accent); }\n.actions button:hover { text-decoration: underline; }\n.actions kbd { font: inherit; color: var(--ink2); }\n.actions .ctx { margin-left: auto; color: var(--ink2); }\n";

  // src/content/popup.ts
  var TOCFL_LABEL = ["", "Novice 1", "Novice 2", "A1", "A2", "B1", "B2", "C1"];
  var STAMPS = [
    { s: "fresh", zh: "\u65B0", key: "1", label: "Fresh" },
    { s: "difficult", zh: "\u96E3", key: "2", label: "Difficult" },
    { s: "known", zh: "\u719F", key: "3", label: "Known" }
  ];
  function freqLabel(zipf) {
    if (zipf >= 55) return "very common";
    if (zipf >= 45) return "common";
    if (zipf >= 35) return "uncommon";
    if (zipf > 0) return "rare";
    return "";
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const k of kids) if (k) el.append(k);
    return el;
  }
  function prettyDef(d) {
    return d.replace(/([^\s\[|,;(]+)(?:\|([^\s\[,;]+))?\[([a-zA-Z0-9: ]+)\]/g, (_, t, _s, p) => `${t} ${numberedToMarked(p)}`);
  }
  var Popup = class {
    host;
    root;
    card;
    opts;
    sel = 0;
    shownAt = 0;
    lookTimer;
    softTimer;
    hovered = false;
    hideListeners = /* @__PURE__ */ new Set();
    constructor() {
      this.host = document.createElement("chinese-brain-popup");
      this.root = this.host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = popup_default;
      this.card = h("div", { class: "card", hidden: "" });
      this.root.append(style, this.card);
      this.card.addEventListener("mousedown", (e) => e.stopPropagation());
      this.card.addEventListener("mouseenter", () => {
        this.hovered = true;
        clearTimeout(this.softTimer);
      });
      this.card.addEventListener("mouseleave", () => {
        this.hovered = false;
        if (!this.pinned) this.hideSoon();
      });
      state.onChange(() => this.opts && this.render());
      document.addEventListener("fullscreenchange", () => this.mount());
    }
    get visible() {
      return !!this.opts;
    }
    get pinned() {
      return !!this.opts?.pinned;
    }
    get current() {
      return this.opts?.matches[this.sel];
    }
    contains(node) {
      return node === this.host;
    }
    mount() {
      const parent = document.fullscreenElement ?? document.documentElement;
      if (this.host.parentNode !== parent) parent.append(this.host);
    }
    async show(opts) {
      const same = this.opts?.matches[0]?.text === opts.matches[0]?.text && this.opts?.rect.x === opts.rect.x;
      this.opts = opts;
      clearTimeout(this.softTimer);
      if (!same) this.sel = 0;
      this.mount();
      await state.loadStatuses();
      this.render();
      this.position(opts.rect);
      this.shownAt = Date.now();
      clearTimeout(this.lookTimer);
      this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200);
    }
    onHide(fn) {
      this.hideListeners.add(fn);
    }
    /** Hide after a short grace period, unless the pointer is on the card. */
    hideSoon(ms = 350) {
      if (!this.opts || this.pinned) return;
      clearTimeout(this.softTimer);
      this.softTimer = setTimeout(() => {
        if (!this.hovered && !this.pinned) this.hide();
      }, ms);
    }
    cancelHide() {
      clearTimeout(this.softTimer);
    }
    hide() {
      if (!this.opts) return;
      clearTimeout(this.lookTimer);
      clearTimeout(this.softTimer);
      this.opts = void 0;
      this.hovered = false;
      this.card.hidden = true;
      this.hideListeners.forEach((f) => f());
    }
    recordLook() {
      const m = this.current;
      if (!m || !this.opts) return;
      browser.runtime.sendMessage({ type: "looked", word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.opts.ctx });
    }
    setStatus(status) {
      const m = this.current;
      if (!m || !this.opts) return;
      const cur = state.status(m.word);
      const next = cur === status ? null : status;
      if (next) state.statuses.set(m.word, next);
      else state.statuses.delete(m.word);
      this.render();
      browser.runtime.sendMessage({ type: "setStatus", word: m.word, status: next, entry: m.entries[0], ctx: this.opts.ctx });
    }
    speak() {
      const m = this.current;
      if (m) speak(m.word);
    }
    images() {
      const m = this.current;
      if (m) window.open(`https://duckduckgo.com/?q=${encodeURIComponent(m.word)}&iax=images&ia=images&kl=tw-tzh`, "_blank");
    }
    cycle(dir = 1) {
      if (!this.opts) return;
      const n = this.opts.matches.length;
      this.sel = (this.sel + dir + n) % n;
      this.render();
    }
    /** Keyboard shortcuts while the card is open. Returns true when handled. */
    handleKey(e) {
      if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return false;
      switch (e.key) {
        case "1":
          this.setStatus("fresh");
          return true;
        case "2":
          this.setStatus("difficult");
          return true;
        case "3":
          this.setStatus("known");
          return true;
        case "0":
        case "Backspace":
          this.setStatus(null);
          return true;
        case "v":
          this.speak();
          return true;
        case "i":
          this.images();
          return true;
        case "n":
          this.cycle(1);
          return true;
        case "Escape":
          this.hide();
          return true;
      }
      return false;
    }
    position(r) {
      const c = this.card;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w2 = c.offsetWidth;
      const ht = c.offsetHeight;
      let x = Math.min(Math.max(8, r.left), vw - w2 - 8);
      let y = r.bottom + 8;
      if (y + ht > vh - 8) y = Math.max(8, r.top - ht - 8);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    }
    render() {
      const o = this.opts;
      if (!o) return;
      const m = o.matches[this.sel];
      if (!m) return;
      const status = state.status(m.word);
      const e0 = m.entries[0];
      const card = this.card;
      card.replaceChildren();
      if (o.matches.length > 1) {
        card.append(
          h(
            "div",
            { class: "tabs", role: "tablist" },
            ...o.matches.map((mm, i) => {
              const b = h("button", { role: "tab", "aria-selected": String(i === this.sel), title: "n: next" }, mm.word);
              b.addEventListener("click", () => {
                this.sel = i;
                this.render();
              });
              return b;
            })
          )
        );
      }
      const zipf = Math.max(...m.entries.map((e) => e.zipf));
      const tocfl = m.entries.find((e) => e.tocfl)?.tocfl ?? 0;
      const twPy = numberedToMarked(e0.tw || e0.py);
      const stamps = h(
        "div",
        { class: "stamps" },
        ...STAMPS.map((st) => {
          const b = h("button", { class: `stamp ${st.s}${status === st.s ? " on" : ""}`, title: `${st.label} (${st.key})` }, st.zh, h("small", null, st.key));
          b.addEventListener("click", () => this.setStatus(st.s));
          return b;
        })
      );
      card.append(
        h(
          "div",
          { class: "stub" },
          h("div", { class: `head${status ? " st-" + status : ""}` }, m.word, e0.simp !== e0.trad ? h("span", { class: "simp" }, e0.simp) : null),
          stamps,
          h(
            "div",
            { class: "meta" },
            h("span", { class: "py" }, twPy),
            e0.tw ? h("span", { class: "alt", title: "Mainland reading (CC-CEDICT)" }, "mainland " + numberedToMarked(e0.py)) : null,
            tocfl ? h("span", { class: "tag" }, "TOCFL " + TOCFL_LABEL[tocfl]) : null,
            freqLabel(zipf) ? h("span", null, freqLabel(zipf)) : null
          )
        )
      );
      const groups = /* @__PURE__ */ new Map();
      for (const e of m.entries) {
        const k = (e.tw || e.py).toLowerCase();
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(e);
      }
      const body = h("div", { class: "body" });
      const many = groups.size > 1;
      for (const [reading, list] of groups) {
        const defs = list.flatMap((e) => e.defs);
        const senses = defs.filter((d) => !d.startsWith("CL:"));
        const cls = defs.filter((d) => d.startsWith("CL:")).flatMap((d) => d.slice(3).split(","));
        body.append(
          h(
            "div",
            { class: "reading" },
            many ? h("span", { class: "py" }, numberedToMarked(reading)) : null,
            h("ol", null, ...senses.slice(0, 8).map((d) => h("li", null, prettyDef(d)))),
            cls.length ? h(
              "div",
              { class: "cl" },
              "measure word ",
              ...cls.flatMap((c, i) => {
                const mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
                return mm ? [i ? ", " : "", h("b", null, mm[1]), " " + numberedToMarked(mm[2])] : [];
              })
            ) : null
          )
        );
      }
      card.append(body);
      const speakBtn = h("button", null, "say ", h("kbd", null, "v"));
      speakBtn.addEventListener("click", () => this.speak());
      const imgBtn = h("button", null, "images ", h("kbd", null, "i"));
      imgBtn.addEventListener("click", () => this.images());
      card.append(h("div", { class: "actions" }, speakBtn, imgBtn, h("span", { class: "ctx" }, status ? "0 clears" : "1 2 3 to save")));
      card.hidden = false;
    }
  };
  var voice;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    voice = voices.find((v) => v.lang === "zh-TW" || v.lang === "zh_TW") ?? voices.find((v) => /taiwan|台灣|臺灣|meijia/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) return;
    if (!voice) pickVoice();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW";
    if (voice) u.voice = voice;
    u.rate = rate ?? state.settings.speechRate;
    speechSynthesis.speak(u);
  }
  if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", pickVoice);

  // src/content/index.ts
  var w = window;
  if (!w.__chineseBrain) {
    w.__chineseBrain = true;
    state.ready().then(() => {
      const popup = new Popup();
      new HoverLookup(popup);
      const onYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
      if (onYouTube) new YouTubeSubs(popup);
      else {
        window.addEventListener(
          "keydown",
          (e) => {
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (popup.visible && popup.handleKey(e)) {
              e.preventDefault();
              e.stopImmediatePropagation();
            }
          },
          true
        );
      }
    });
  }
})();
