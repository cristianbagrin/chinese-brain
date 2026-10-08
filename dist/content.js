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
      }), browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = !1;
        for (let [k, ch] of Object.entries(changes))
          if (k === "settings")
            this.settings = { ...DEFAULT_SETTINGS, ...ch.newValue }, dirty = !0;
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

  // src/content/hover.ts
  var HIGHLIGHT = "chinese-brain-hit", cache = /* @__PURE__ */ new Map();
  async function lookupText(text) {
    let key = text.slice(0, 8), hit = cache.get(key);
    if (hit) return hit;
    let res = await browser.runtime.sendMessage({ type: "lookup", text: key });
    return cache.size > 300 && cache.clear(), cache.set(key, res), res;
  }
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
      let el = n.parentElement;
      for (; el && getComputedStyle(el).display.startsWith("inline"); ) el = el.parentElement;
      return el;
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
      }), window.addEventListener("scroll", () => !this.popup.pinned && this.popup.hide(), { passive: !0 }), this.popup.onHide(() => {
        this.currentKey = "", CSS.highlights?.delete(HIGHLIGHT);
      });
    }
    onMove(e) {
      this.lastX = e.clientX, this.lastY = e.clientY, this.shift = e.shiftKey, !this.raf && (this.raf = requestAnimationFrame(() => {
        this.raf = 0, this.check(e.target);
      }));
    }
    async check(target) {
      let seq = ++this.seq;
      if (this.popup.contains(target)) {
        if (this.popup.pinned || this.popup.age() > 500) return;
        this.popup.hide();
      }
      if (target?.closest?.("[data-cb-own]")) return;
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
        src: "web",
        ctx: { text: sentenceAround(text, offset), url: location.href, title: document.title, at: Date.now(), src: "web" }
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
      CSS.highlights && (this.cssInjected || (this.cssInjected = !0, browser.runtime.sendMessage({ type: "insertCSS", css: `::highlight(${HIGHLIGHT}){background:#f3d27a;color:#31261a}` })), CSS.highlights.set(HIGHLIGHT, new Highlight(range)));
    }
    scheduleHide() {
      this.currentKey && this.popup.hideSoon();
    }
  };

  // src/youtube/captions.ts
  function parseTimedText(body) {
    let t = body.trimStart();
    return t.startsWith("{") ? parseJson3(t) : t.startsWith("WEBVTT") ? parseVtt(t) : t.startsWith("<") ? parseXml(t) : [];
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
  function tidy(cues) {
    cues.sort((a, b) => a.start - b.start);
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
  --fresh: #9cc2ff;
  --difficult: #ff8f9a;
  --known: #ffffff;
  --ink-band: rgba(36, 28, 19, 0.78);
  --mint: #c9efc0;
  --serif: 'Songti TC', 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', serif;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
  --mono: ui-monospace, 'SF Mono', Menlo, monospace;
}
:host(.low) { bottom: 3%; }
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
.bar {
  font: 11px/1.6 var(--mono);
  color: #e8e2d4;
  background: var(--ink-band);
  padding: 1px 8px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s;
  white-space: nowrap;
  user-select: none;
}
.box:hover .bar, .bar.flash { opacity: 1; }
.bar b { color: var(--mint); font-weight: 600; }
.bar .on { color: #ffd479; }

.zh {
  background: var(--ink-band);
  color: #fff;
  padding: 0.12em 0.45em 0.16em;
  border-radius: 0.18em;
  font: 500 1em/1.45 var(--sans);
  letter-spacing: 0.03em;
  text-align: center;
}
.zh:empty, .tr:empty { display: none; }
.tok { cursor: pointer; border-radius: 0.12em; padding: 0 0.02em; }
.tok:hover, .tok.active { background: rgba(255, 255, 255, 0.18); }
.tok.st-fresh { color: var(--fresh); }
.tok.st-difficult { color: var(--difficult); }
.tok.st-known { color: var(--known); }
.tok.untracked { text-decoration: underline dotted rgba(255, 255, 255, 0.45); text-underline-offset: 0.22em; text-decoration-thickness: 1.5px; }
ruby { ruby-position: over; }
rt { font: 0.42em/1 var(--mono); color: #e8e2d4; letter-spacing: 0; }

.tr {
  background: var(--ink-band);
  color: var(--mint);
  padding: 0.1em 0.5em 0.14em;
  border-radius: 0.18em;
  font: 0.62em/1.4 var(--sans);
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
    tr;
    bar;
    coverage;
    flashTimer;
    constructor(popup) {
      this.popup = popup, this.host = document.createElement("div"), this.host.dataset.cbOwn = "", this.host.hidden = !0, this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = overlay_default;
      let box = document.createElement("div");
      box.className = "box", this.bar = document.createElement("div"), this.bar.className = "bar", this.zh = document.createElement("div"), this.zh.className = "zh", this.tr = document.createElement("div"), this.tr.className = "tr", box.append(this.bar, this.zh, this.tr), this.root.append(style, box);
      for (let t of ["click", "mousedown", "mouseup", "dblclick", "pointerdown", "pointerup", "touchstart"])
        this.host.addEventListener(t, (e) => e.stopPropagation());
      box.addEventListener("mouseenter", () => this.hoverPause(!0)), box.addEventListener("mouseleave", () => this.hoverPause(!1)), this.zh.addEventListener("mouseover", (e) => this.onTokenHover(e)), this.zh.addEventListener("mouseout", () => this.popup.hideSoon()), this.zh.addEventListener("click", (e) => this.onTokenClick(e)), this.popup.onHide(() => this.maybeResume()), browser.runtime.onMessage.addListener((msg) => {
        msg.type === "ytCaptions" && msg.url && msg.body && this.onBody(msg.url, msg.body);
      }), state.onChange(() => this.renderLine(!0)), window.addEventListener("keydown", (e) => this.onKey(e), !0), document.addEventListener("yt-navigate-finish", () => this.checkVideo()), window.addEventListener("pagehide", () => this.flushWatch()), setInterval(() => this.checkVideo(), 1e3), new ResizeObserver(() => this.resize()).observe(document.documentElement), this.checkVideo(), this.tick = this.tick.bind(this), requestAnimationFrame(this.tick);
    }
    player() {
      let el = document.getElementById("movie_player");
      return el?.wrappedJSObject ?? el ?? void 0;
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
        id && !this.src && this.findTracks();
        return;
      }
      this.flushWatch(), this.videoId = id, this.reset(), id && (state.loadStatuses(), this.findTracks(), browser.runtime.sendMessage({ type: "ytCached" }).then((list) => {
        for (let item of list) this.onBody(item.url, item.body);
      }));
    }
    reset() {
      this.tracks = [], this.src = void 0, this.cues = [], this.tokens = [], this.trans = [], this.trCues = void 0, this.idx = -2, this.requestedTr = !1, this.coverage = void 0, this.loop = !1, this.host.hidden = !0, document.documentElement.classList.remove("cb-subs-on");
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
      zh && (this.src = zh, this.setTrack(zh));
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
      let want = state.settings.transLang, isZh = /^zh/i.test(info.lang);
      if (info.tlang) {
        info.tlang.split("-")[0] === want && this.setTranslation(cues);
        return;
      }
      if (isZh) {
        if (this.src && this.src.languageCode !== info.lang && this.cues.length || sameCues(cues, this.cues)) return;
        this.src || (this.src = { languageCode: info.lang, kind: info.kind || void 0, name: info.lang }), await this.setSource(cues);
        return;
      }
      info.lang.split("-")[0] === want && this.setTranslation(cues);
    }
    async setSource(cues) {
      this.cues = cues, this.idx = -2;
      let lines = cues.map((c) => c.text);
      if (this.tokens = await browser.runtime.sendMessage({ type: "segment", lines }), this.trCues && (this.trans = alignTranslation(this.cues, this.trCues)), this.computeCoverage(), this.mount(), !this.requestedTr && !this.trCues && this.src) {
        this.requestedTr = !0;
        let want = state.settings.transLang, manual = pickTranslation(this.tracks, want);
        setTimeout(() => {
          manual ? this.setTrack(manual) : this.src?.isTranslatable !== !1 && this.setTrack(this.src, want), setTimeout(() => this.src && this.setTrack(this.src), 2500);
        }, 300);
      }
    }
    setTranslation(cues) {
      this.trCues = cues, this.cues.length && (this.trans = alignTranslation(this.cues, cues)), this.renderLine(!0);
    }
    computeCoverage() {
      let total = 0, known = 0;
      for (let line of this.tokens)
        for (let t of line)
          !t.word || !CJK.test(t.text) || (total++, state.status(t.word) === "known" && known++);
      this.coverage = total ? known / total : void 0;
    }
    mount() {
      let p = document.getElementById("movie_player");
      p && (this.host.parentNode !== p && p.append(this.host), this.host.hidden = !1, document.documentElement.classList.add("cb-subs-on"), browser.runtime.sendMessage({
        type: "insertCSS",
        css: "html.cb-subs-on .ytp-caption-window-container{display:none!important}"
      }), this.resize(), this.renderBar());
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
          setTimeout(() => {
            this.shadow && v.paused && v.play();
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
        let text = s.toTraditional && t.trad ? t.trad : t.text;
        if (!t.word && !CJK.test(t.text)) {
          this.zh.append(text);
          return;
        }
        let span = document.createElement("span");
        span.className = "tok", span.dataset.k = String(k);
        let st = state.status(t.word);
        if (st ? span.classList.add("st-" + st) : s.markUntracked && t.word && span.classList.add("untracked"), s.subPinyin && t.py) {
          let ruby = document.createElement("ruby");
          ruby.append(text);
          let rt = document.createElement("rt");
          rt.textContent = numberedToMarked(t.py), ruby.append(rt), span.append(ruby);
        } else span.textContent = text;
        this.zh.append(span);
      });
      let tr = i >= 0 ? this.trans[i] ?? "" : "";
      this.tr.textContent = s.translation === "hide" ? "" : tr, this.tr.classList.toggle("blur", s.translation === "blur"), this.resize(), this.renderBar();
    }
    renderBar() {
      let s = state.settings, src = this.src ? this.src.name || this.src.languageCode : "zh", item = (text, cls = "") => {
        let el = document.createElement(cls === "b" ? "b" : "span");
        return cls && cls !== "b" && (el.className = cls), el.textContent = text, el;
      }, parts = [item(`${src}${this.trCues ? " + " + s.transLang : ""}`)];
      this.coverage != null && parts.push(item(`\u719F ${Math.round(this.coverage * 100)}%`, "b")), parts.push(item("A \u25C0 \xB7 S \u21BA \xB7 D \u25B6")), parts.push(item("R loop", this.loop ? "on" : "")), parts.push(item("Q shadow", this.shadow ? "on" : "")), parts.push(item("P pinyin", s.subPinyin ? "on" : "")), parts.push(item(`X ${s.translation}`)), this.bar.replaceChildren(...parts.flatMap((p, i) => i ? [" \xB7 ", p] : [p])), this.bar.title = "Chinese Brain: \u719F = share of words in this video you marked Known";
    }
    flash() {
      this.bar.classList.add("flash"), clearTimeout(this.flashTimer), this.flashTimer = setTimeout(() => this.bar.classList.remove("flash"), 1500);
    }
    tokenAt(e) {
      let span = e.target.closest?.(".tok");
      if (!span || this.idx < 0) return;
      let tok = this.tokens[this.idx]?.[Number(span.dataset.k)];
      return tok ? { span, tok, line: this.idx } : void 0;
    }
    showSeq = 0;
    async showFor(e, pinned) {
      let seq = ++this.showSeq, hit = this.tokenAt(e);
      if (!hit) return;
      let { span, tok, line } = hit, rest = this.tokens[line].slice(Number(span.dataset.k)).map((t) => t.text).join(""), matches = await lookupText(rest);
      if (seq !== this.showSeq) return;
      let own = matches.findIndex((m) => m.text === tok.text);
      if (own > 0 && (matches = [matches[own], ...matches.filter((_, i) => i !== own)]), !matches.length) return;
      this.zh.querySelectorAll(".tok.active").forEach((el) => el.classList.remove("active")), span.classList.add("active");
      let cue = this.cues[line], ctx = {
        text: cue.text + (this.trans[line] ? ` \u2014 ${this.trans[line]}` : ""),
        url: location.href.split("&")[0],
        title: document.title.replace(/ - YouTube$/, ""),
        t: Math.floor(cue.start),
        at: Date.now(),
        src: "yt"
      };
      await this.popup.show({ matches, rect: span.getBoundingClientRect(), src: "yt", ctx, pinned }), pinned && state.settings.autoFreshOnClick && !state.status(matches[0].word) && this.popup.setStatus("fresh");
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
      let t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (this.popup.visible && this.popup.handleKey(e)) {
        e.preventDefault(), e.stopImmediatePropagation();
        return;
      }
      if (this.host.hidden || !this.cues.length || e.ctrlKey || e.metaKey || e.altKey) return;
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
          this.loop = !this.loop;
          break;
        case "q":
          this.shadow = !this.shadow, this.shadowDone = -1;
          break;
        case "p":
          browser.runtime.sendMessage({ type: "saveSettings", settings: { subPinyin: !s.subPinyin } });
          break;
        case "x": {
          let next = TRANSLATION_MODES[(TRANSLATION_MODES.indexOf(s.translation) + 1) % 3];
          browser.runtime.sendMessage({ type: "saveSettings", settings: { translation: next } });
          break;
        }
        default:
          handled = !1;
      }
      handled && (e.preventDefault(), e.stopImmediatePropagation(), this.renderBar(), this.flash());
    }
    flushWatch() {
      this.watchSecs > 30 && this.videoId && browser.runtime.sendMessage({
        type: "watch",
        url: `https://www.youtube.com/watch?v=${this.videoId}`,
        title: document.title.replace(/ - YouTube$/, ""),
        secs: Math.round(this.watchSecs),
        coverage: this.coverage,
        lang: this.src?.languageCode
      }), this.watchSecs = 0;
    }
  };
  function sameCues(a, b) {
    return a.length === b.length && a[0]?.text === b[0]?.text && a[a.length - 1]?.text === b[b.length - 1]?.text;
  }

  // src/content/popup.css
  var popup_default = `:host {
  all: initial;
  --paper: #f6f4ea;
  --card: #edf5e6;
  --ink: #31261a;
  --ink2: #6b5d4b;
  --rule: #c9c2ae;
  --fresh: #2f6fc4;
  --difficult: #b22f3d;
  --known: #1d7023;
  --accent: #0a818b;
  --serif: 'Songti TC', 'Noto Serif TC', 'Noto Serif CJK TC', 'PMingLiU', 'MingLiU', serif;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
  --mono: ui-monospace, 'SF Mono', Menlo, 'Cascadia Mono', monospace;
}

.card {
  position: fixed;
  z-index: 2147483647;
  width: max-content;
  max-width: min(380px, calc(100vw - 16px));
  max-height: min(70vh, 520px);
  overflow: auto;
  background: var(--card);
  color: var(--ink);
  border: 1.5px solid var(--ink);
  border-radius: 7px;
  font: 14px/1.45 var(--sans);
  box-shadow: 3px 4px 0 rgba(49, 38, 26, 0.18);
  text-align: left;
  pointer-events: auto;
}
.card[hidden] { display: none; }

.tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  font: 12px var(--mono);
}
.tabs button {
  all: unset;
  cursor: pointer;
  padding: 2px 7px;
  color: var(--ink2);
  border-bottom: 2px solid transparent;
  font-family: var(--serif);
  font-size: 14px;
}
.tabs button[aria-selected='true'] { color: var(--ink); border-bottom-color: var(--ink); }

.stub {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 4px 14px;
  padding: 10px 14px 12px;
  border-bottom: 2px dotted var(--rule);
}
.head { font: 700 34px/1.1 var(--serif); letter-spacing: 0.02em; }
.head .simp { font-size: 15px; font-weight: 400; color: var(--ink2); margin-left: 8px; letter-spacing: 0; }
.head.st-fresh { color: var(--fresh); }
.head.st-difficult { color: var(--difficult); }
.head.st-known { color: var(--known); }

.stamps { display: flex; gap: 6px; grid-row: span 2; align-self: center; }
.stamp {
  all: unset;
  cursor: pointer;
  box-sizing: border-box;
  width: 38px;
  height: 38px;
  border: 1.5px solid var(--rule);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font: 700 17px/1 var(--serif);
  color: var(--ink2);
  position: relative;
}
.stamp small { position: absolute; bottom: -2px; right: -3px; font: 600 9px/1 var(--mono); color: var(--ink2); background: var(--card); padding: 1px; }
.stamp:hover { border-color: var(--ink2); color: var(--ink); }
.stamp.on { transform: rotate(-9deg); border-width: 2.5px; }
.stamp.fresh.on { color: var(--fresh); border-color: var(--fresh); }
.stamp.difficult.on { color: var(--difficult); border-color: var(--difficult); }
.stamp.known.on { color: var(--known); border-color: var(--known); }

.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font: 12px var(--mono); color: var(--ink2); }
.py { font: 600 16px var(--mono); color: var(--ink); letter-spacing: 0.01em; }
.tag { border: 1px solid var(--ink2); border-radius: 3px; padding: 0 4px; font-size: 11px; line-height: 16px; }
.alt { font-size: 11px; }

.body { padding: 8px 14px 10px; }
.reading + .reading { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--rule); }
.reading .py { font-size: 14px; }
ol { margin: 4px 0 0; padding-left: 20px; }
li { margin: 1px 0; }
li::marker { color: var(--ink2); font: 11px var(--mono); }
.cl { margin-top: 4px; color: var(--ink2); font-size: 12.5px; }
.cl b { font: 600 14px var(--serif); color: var(--ink); }

.actions {
  display: flex;
  gap: 14px;
  padding: 6px 14px 8px;
  border-top: 1px solid var(--rule);
  font: 12px var(--mono);
  color: var(--ink2);
}
.actions button { all: unset; cursor: pointer; color: var(--accent); }
.actions button:hover { text-decoration: underline; }
.actions kbd { font: inherit; color: var(--ink2); }
.actions .ctx { margin-left: auto; color: var(--ink2); }
`;

  // src/content/popup.ts
  var TOCFL_LABEL = ["", "Novice 1", "Novice 2", "A1", "A2", "B1", "B2", "C1"], STAMPS = [
    { s: "fresh", zh: "\u65B0", key: "1", label: "Fresh" },
    { s: "difficult", zh: "\u96E3", key: "2", label: "Difficult" },
    { s: "known", zh: "\u719F", key: "3", label: "Known" }
  ];
  function freqLabel(zipf) {
    return zipf >= 55 ? "very common" : zipf >= 45 ? "common" : zipf >= 35 ? "uncommon" : zipf > 0 ? "rare" : "";
  }
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
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
    hovered = !1;
    hideListeners = /* @__PURE__ */ new Set();
    constructor() {
      this.host = document.createElement("chinese-brain-popup"), this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = popup_default, this.card = h("div", { class: "card", hidden: "" }), this.root.append(style, this.card), this.card.addEventListener("mousedown", (e) => e.stopPropagation()), this.card.addEventListener("mouseenter", () => {
        this.hovered = !0, clearTimeout(this.softTimer);
      }), this.card.addEventListener("mouseleave", () => {
        this.hovered = !1, this.pinned || this.hideSoon();
      }), state.onChange(() => this.opts && this.render()), document.addEventListener("fullscreenchange", () => this.mount());
    }
    get visible() {
      return !!this.opts;
    }
    get pinned() {
      return !!this.opts?.pinned;
    }
    /** Milliseconds since the card was last shown. */
    age() {
      return Date.now() - this.shownAt;
    }
    get current() {
      return this.opts?.matches[this.sel];
    }
    contains(node) {
      return node === this.host;
    }
    mount() {
      let parent = document.fullscreenElement ?? document.documentElement;
      this.host.parentNode !== parent && parent.append(this.host);
    }
    async show(opts) {
      let same = this.opts?.matches[0]?.text === opts.matches[0]?.text && this.opts?.rect.x === opts.rect.x;
      this.opts = opts, clearTimeout(this.softTimer), same || (this.sel = 0), this.mount(), await state.loadStatuses(), this.opts === opts && (this.render(), this.position(opts.rect), this.shownAt = Date.now(), clearTimeout(this.lookTimer), this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200));
    }
    onHide(fn) {
      this.hideListeners.add(fn);
    }
    /** Hide after a short grace period, unless the pointer is on the card. */
    hideSoon(ms = 350) {
      !this.opts || this.pinned || (clearTimeout(this.softTimer), this.softTimer = setTimeout(() => {
        !this.hovered && !this.pinned && this.hide();
      }, ms));
    }
    cancelHide() {
      clearTimeout(this.softTimer);
    }
    hide() {
      this.opts && (clearTimeout(this.lookTimer), clearTimeout(this.softTimer), this.opts = void 0, this.hovered = !1, this.card.hidden = !0, this.hideListeners.forEach((f) => f()));
    }
    recordLook() {
      let m = this.current;
      !m || !this.opts || browser.runtime.sendMessage({ type: "looked", word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.opts.ctx });
    }
    setStatus(status) {
      let m = this.current;
      if (!m || !this.opts) return;
      let next = state.status(m.word) === status ? null : status;
      next ? state.statuses.set(m.word, next) : state.statuses.delete(m.word), this.render(), browser.runtime.sendMessage({ type: "setStatus", word: m.word, status: next, entry: m.entries[0], ctx: this.opts.ctx });
    }
    speak() {
      let m = this.current;
      m && speak(m.word);
    }
    images() {
      let m = this.current;
      m && window.open(`https://duckduckgo.com/?q=${encodeURIComponent(m.word)}&iax=images&ia=images&kl=tw-tzh`, "_blank");
    }
    cycle(dir = 1) {
      if (!this.opts) return;
      let n = this.opts.matches.length;
      this.sel = (this.sel + dir + n) % n, this.render();
    }
    /** Keyboard shortcuts while the card is open. Returns true when handled. */
    handleKey(e) {
      if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return !1;
      switch (e.key) {
        case "1":
          return this.setStatus("fresh"), !0;
        case "2":
          return this.setStatus("difficult"), !0;
        case "3":
          return this.setStatus("known"), !0;
        case "0":
        case "Backspace":
          return this.setStatus(null), !0;
        case "v":
          return this.speak(), !0;
        case "i":
          return this.images(), !0;
        case "n":
          return this.cycle(1), !0;
        case "Escape":
          return this.hide(), !0;
      }
      return !1;
    }
    position(r) {
      let c = this.card, vw = window.innerWidth, vh = window.innerHeight, w2 = c.offsetWidth, ht = c.offsetHeight, x = Math.min(Math.max(8, r.left), vw - w2 - 8), y = r.bottom + 8;
      y + ht > vh - 8 && (y = Math.max(8, r.top - ht - 8)), c.style.left = `${x}px`, c.style.top = `${y}px`;
    }
    render() {
      let o = this.opts;
      if (!o) return;
      let m = o.matches[this.sel];
      if (!m) return;
      let status = state.status(m.word), e0 = m.entries[0], card = this.card;
      card.replaceChildren(), o.matches.length > 1 && card.append(
        h(
          "div",
          { class: "tabs", role: "tablist" },
          ...o.matches.map((mm, i) => {
            let b = h("button", { role: "tab", "aria-selected": String(i === this.sel), title: "n: next" }, mm.word);
            return b.addEventListener("click", () => {
              this.sel = i, this.render();
            }), b;
          })
        )
      );
      let zipf = Math.max(...m.entries.map((e) => e.zipf)), tocfl = m.entries.find((e) => e.tocfl)?.tocfl ?? 0, twPy = numberedToMarked(e0.tw || e0.py), stamps = h(
        "div",
        { class: "stamps" },
        ...STAMPS.map((st) => {
          let b = h("button", { class: `stamp ${st.s}${status === st.s ? " on" : ""}`, title: `${st.label} (${st.key})` }, st.zh, h("small", null, st.key));
          return b.addEventListener("click", () => this.setStatus(st.s)), b;
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
      let groups = /* @__PURE__ */ new Map();
      for (let e of m.entries) {
        let k = (e.tw || e.py).toLowerCase();
        groups.has(k) || groups.set(k, []), groups.get(k).push(e);
      }
      let body = h("div", { class: "body" }), many = groups.size > 1;
      for (let [reading, list] of groups) {
        let defs = [...new Set(list.flatMap((e) => e.defs))], senses = defs.filter((d) => !d.startsWith("CL:")), cls = defs.filter((d) => d.startsWith("CL:")).flatMap((d) => d.slice(3).split(","));
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
                let mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
                return mm ? [i ? ", " : "", h("b", null, mm[1]), " " + numberedToMarked(mm[2])] : [];
              })
            ) : null
          )
        );
      }
      card.append(body);
      let speakBtn = h("button", null, "say ", h("kbd", null, "v"));
      speakBtn.addEventListener("click", () => this.speak());
      let imgBtn = h("button", null, "images ", h("kbd", null, "i"));
      imgBtn.addEventListener("click", () => this.images()), card.append(h("div", { class: "actions" }, speakBtn, imgBtn, h("span", { class: "ctx" }, status ? "0 clears" : "1 2 3 to save"))), card.hidden = !1;
    }
  }, voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => v.lang === "zh-TW" || v.lang === "zh_TW") ?? voices.find((v) => /taiwan|台灣|臺灣|meijia/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) return;
    voice || pickVoice(), speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-TW", voice && (u.voice = voice), u.rate = rate ?? state.settings.speechRate, speechSynthesis.speak(u);
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);

  // src/content/index.ts
  var w = window;
  w.__chineseBrain || (w.__chineseBrain = !0, state.ready().then(() => {
    let popup = new Popup();
    new HoverLookup(popup), /(^|\.)youtube\.com$/.test(location.hostname) ? new YouTubeSubs(popup) : window.addEventListener(
      "keydown",
      (e) => {
        let t = e.target;
        t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) || popup.visible && popup.handleKey(e) && (e.preventDefault(), e.stopImmediatePropagation());
      },
      !0
    );
  }));
})();
