"use strict";
(() => {
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
  function playSave() {
    try {
      let ac = audio(), t = ac.currentTime + 5e-3;
      noise(ac, t, 0.02, 0.18, "bandpass", 2400, 1), note(ac, 1320, t, 0.1, 0.06, "triangle"), note(ac, 1980, t + 0.045, 0.12, 0.04, "triangle");
    } catch {
    }
  }

  // site/src/demo-words.ts
  var WORDS = {
    \u4ECA\u5929: ["j\u012Bnti\u0101n", "today", 5, [["\u4ECA", "j\u012Bn", "now"], ["\u5929", "ti\u0101n", "day; sky"]]],
    \u5929\u6C23: ["ti\u0101nq\xEC", "weather", 4, [["\u5929", "ti\u0101n", "sky; day"], ["\u6C23", "q\xEC", "air"]]],
    \u5F88: ["h\u011Bn", "very", 5],
    \u597D: ["h\u01CEo", "good; well", 5],
    \u6211\u5011: ["w\u01D2men", "we; us", 5, [["\u6211", "w\u01D2", "I; me"], ["\u5011", "men", "(plural)"]]],
    \u4E00\u8D77: ["y\xECq\u01D0", "together", 4, [["\u4E00", "y\u012B", "one"], ["\u8D77", "q\u01D0", "to rise; to start"]]],
    \u53BB: ["q\xF9", "to go", 5],
    \u591C\u5E02: ["y\xE8sh\xEC", "night market", 3, [["\u591C", "y\xE8", "night"], ["\u5E02", "sh\xEC", "market; city"]]],
    \u5403: ["ch\u012B", "to eat", 5],
    \u665A\u9910: ["w\u01CEnc\u0101n", "dinner", 3, [["\u665A", "w\u01CEn", "evening; late"], ["\u9910", "c\u0101n", "meal"]]],
    \u5427: ["ba", "(suggests: let's\u2026)", 5],
    \u81FA\u5317: ["T\xE1ib\u011Bi", "Taipei", 4, [["\u81FA", "t\xE1i", "platform; Taiwan"], ["\u5317", "b\u011Bi", "north"]]],
    \u7684: ["de", "(of; 's)", 5],
    \u6377\u904B: ["ji\xE9y\xF9n", "MRT; metro", 3, [["\u6377", "ji\xE9", "quick"], ["\u904B", "y\xF9n", "to transport"]]],
    \u65B9\u4FBF: ["f\u0101ngbi\xE0n", "convenient", 4, [["\u65B9", "f\u0101ng", "side; way"], ["\u4FBF", "bi\xE0n", "handy"]]],
    \u5F9E: ["c\xF3ng", "from", 5],
    \u8ECA\u7AD9: ["ch\u0113zh\xE0n", "station", 3, [["\u8ECA", "ch\u0113", "vehicle"], ["\u7AD9", "zh\xE0n", "station; to stand"]]],
    \u8D70\u8DEF: ["z\u01D2ul\xF9", "to walk", 4, [["\u8D70", "z\u01D2u", "to walk; to go"], ["\u8DEF", "l\xF9", "road"]]],
    \u4E94: ["w\u01D4", "five", 5],
    \u5206\u9418: ["f\u0113nzh\u014Dng", "minute", 4, [["\u5206", "f\u0113n", "minute; to divide"], ["\u9418", "zh\u014Dng", "clock"]]],
    \u5C31: ["ji\xF9", "just; right away", 5],
    \u5230: ["d\xE0o", "to arrive", 5],
    \u4E86: ["le", "(done; changed)", 5],
    \u4F60\u597D: ["n\u01D0h\u01CEo", "hello", 5, [["\u4F60", "n\u01D0", "you"], ["\u597D", "h\u01CEo", "good"]]],
    \u6B61\u8FCE: ["hu\u0101ny\xEDng", "welcome", 4, [["\u6B61", "hu\u0101n", "joyful"], ["\u8FCE", "y\xEDng", "to greet"]]],
    \u4F86: ["l\xE1i", "to come", 5],
    \u9019\u500B: ["zh\xE8ge", "this", 5, [["\u9019", "zh\xE8", "this"], ["\u500B", "ge", "(measure word)"]]],
    \u597D\u5403: ["h\u01CEoch\u012B", "delicious", 4, [["\u597D", "h\u01CEo", "good"], ["\u5403", "ch\u012B", "to eat"]]],
    \u660E\u5929: ["m\xEDngti\u0101n", "tomorrow", 5, [["\u660E", "m\xEDng", "bright; next"], ["\u5929", "ti\u0101n", "day"]]],
    \u898B: ["ji\xE0n", "to see; to meet", 5],
    \u627E\u4E0D\u5230: ["zh\u01CEob\xFAd\xE0o", "can't find", 4, [["\u627E", "zh\u01CEo", "to look for"], ["\u4E0D", "b\xF9", "not"], ["\u5230", "d\xE0o", "to arrive; to reach"]]],
    \u9019: ["zh\xE8", "this", 5],
    \u9801: ["y\xE8", "page", 3]
  }, PHRASES = {
    \u4ECA\u5929\u5929\u6C23\u5F88\u597D: "The weather is great today.",
    \u6211\u5011\u4E00\u8D77\u53BB\u591C\u5E02\u5403\u665A\u9910\u5427: "Let's go to the night market for dinner together.",
    \u4E00\u8D77\u53BB\u591C\u5E02\u5403\u665A\u9910: "go to the night market for dinner together",
    \u53BB\u591C\u5E02\u5403\u665A\u9910: "go to the night market for dinner",
    \u591C\u5E02\u5403\u665A\u9910: "dinner at the night market",
    \u4ECA\u5929\u5929\u6C23\u5F88\u597D\u6211\u5011\u4E00\u8D77\u53BB\u591C\u5E02\u5403\u665A\u9910\u5427: "The weather is great today. Let's go to the night market for dinner together.",
    \u81FA\u5317\u7684\u6377\u904B\u5F88\u65B9\u4FBF: "Taipei's MRT is really convenient.",
    \u81FA\u5317\u7684\u6377\u904B: "Taipei's MRT",
    \u6377\u904B\u5F88\u65B9\u4FBF: "the MRT is convenient",
    \u5F9E\u8ECA\u7AD9\u8D70\u8DEF\u4E94\u5206\u9418\u5C31\u5230\u4E86: "It's a five-minute walk from the station.",
    \u5F9E\u8ECA\u7AD9\u8D70\u8DEF\u4E94\u5206\u9418: "a five-minute walk from the station",
    \u8D70\u8DEF\u4E94\u5206\u9418: "a five-minute walk",
    \u4E94\u5206\u9418: "five minutes",
    \u5C31\u5230\u4E86: "and you're there",
    \u81FA\u5317\u7684\u6377\u904B\u5F88\u65B9\u4FBF\u5F9E\u8ECA\u7AD9\u8D70\u8DEF\u4E94\u5206\u9418\u5C31\u5230\u4E86: "Taipei's MRT is really convenient: it's a five-minute walk from the station.",
    \u4F60\u597D\u6B61\u8FCE\u4F86\u81FA\u5317: "Hi, welcome to Taipei!",
    \u6B61\u8FCE\u4F86\u81FA\u5317: "Welcome to Taipei!",
    \u6211\u5011\u53BB\u591C\u5E02\u5427: "Let's go to the night market.",
    \u9019\u500B\u5F88\u597D\u5403: "This is delicious!",
    \u660E\u5929\u898B: "See you tomorrow!",
    \u627E\u4E0D\u5230\u9019\u9801: "Can't find this page."
  };

  // site/src/site.ts
  var root = document.documentElement, ext = () => !!root.dataset.cbExt, mac = /Mac|iPhone|iPad/.test(navigator.platform), $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  function h(tag, cls, ...kids) {
    let el = document.createElement(tag);
    cls && (el.className = cls);
    for (let k of kids) k && el.append(k);
    return el;
  }
  if (mac) for (let el of $$("kbd.alt")) el.textContent = "\u2325 Option";
  for (let b of $$("button.video[data-video]"))
    b.addEventListener(
      "click",
      () => {
        let f = document.createElement("iframe");
        f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.video}?autoplay=1&rel=0`, f.title = b.getAttribute("aria-label") || "Video", f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen", f.allowFullscreen = !0;
        let box = h("div", "video on", f);
        b.replaceWith(box);
      },
      { once: !0 }
    );
  if (location.hash === "#welcome") {
    root.classList.add("welcome");
    for (let el of $$("[data-welcome]")) el.textContent = el.dataset.welcome;
  }
  function did(what) {
    for (let box of $$("[data-quests]")) {
      let step = box.querySelector(`[data-q="${what}"]`);
      !step || step.classList.contains("done") || (step.classList.add("done"), $$("[data-q]", box).every((s) => s.classList.contains("done") || !s.offsetParent) && setTimeout(() => {
        box.classList.add("all"), ext() || playSave();
      }, 500));
    }
  }
  window.addEventListener("message", (e) => {
    e.source === window && e.data?.cb === "did" && did(e.data.did);
  });
  var STAMPS = [
    ["fresh", "\u65B0", "1"],
    ["learning", "\u5B78", "2"],
    ["known", "\u719F", "3"]
  ], stamps = /* @__PURE__ */ new Map(), LONGEST = Math.max(...Object.keys(WORDS).map((w) => w.length));
  function segment(el) {
    let walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), texts = [];
    for (; walk.nextNode(); ) texts.push(walk.currentNode);
    for (let t of texts) {
      if (t.parentElement?.closest(".w")) continue;
      let s = t.data, out = [], plain = "";
      for (let i = 0; i < s.length; ) {
        let hit = "";
        for (let n = LONGEST; n > 0 && !hit; n--) WORDS[s.slice(i, i + n)] && (hit = s.slice(i, i + n));
        if (!hit) {
          plain += s[i++];
          continue;
        }
        plain && out.push(plain), plain = "";
        let w = h("span", `w${stamps.has(hit) ? ` st-${stamps.get(hit)}` : ""}`, hit);
        w.dataset.w = hit, out.push(w), i += hit.length;
      }
      plain && out.push(plain), (out.length > 1 || typeof out[0] != "string") && t.replaceWith(...out);
    }
  }
  var card = h("div", "dcard");
  card.setAttribute("role", "dialog");
  card.hidden = !0;
  var current, hideTimer = 0;
  function say(text) {
    try {
      let u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-TW", speechSynthesis.cancel(), speechSynthesis.speak(u);
    } catch {
    }
  }
  function bars(n) {
    let b = h("span", "bars");
    for (let i = 1; i <= 5; i++) b.append(h("i", i <= n ? "on" : ""));
    return h("span", "freq", b, ["", "rare", "uncommon", "useful", "common", "essential"][n]);
  }
  function render() {
    if (!current) return;
    let { word, phrase } = current, st = stamps.get(word), sayBtn = h("button", "say", "\u{1F50A}");
    if (sayBtn.title = "Say it", sayBtn.addEventListener("click", () => say(word)), phrase) {
      let clean = word.replace(/[，。！？、：；「」\s]/g, ""), parts = segmentWords(clean), en = PHRASES[clean] ?? parts.map((p) => WORDS[p]?.[1].replace(/^\((.*)\)$/, "$1") ?? p).join(" \xB7 ");
      card.replaceChildren(
        h("div", "top", h("div", "headrow", h("span", "head long", word), sayBtn), h("div", "py", parts.map((p) => WORDS[p]?.[0] ?? p).join(" ")), h("div", "en", en))
      );
    } else {
      let [py, en, freq, parts] = WORDS[word], head = h("span", `head${st ? ` st-${st}` : ""}`, word);
      card.replaceChildren(
        h("div", "top", h("div", "headrow", head, h("span", "py", py), sayBtn, bars(freq)), h("div", "en", en)),
        parts ? h("div", "parts", ...parts.map(([c, p, e]) => h("div", null, h("b", null, c), h("span", "ppy", p), e))) : "",
        h(
          "div",
          "stamps",
          ...STAMPS.map(([s, zh, key]) => {
            let b = h("button", `seal ${s}${st === s ? " on" : ""}`, zh, h("small", null, key));
            return b.title = `${s[0].toUpperCase()}${s.slice(1)} (${key})`, b.addEventListener("click", () => stamp(s)), b;
          })
        )
      );
    }
    card.lang = "zh-Hant";
    for (let el of $$(".en, .parts, .freq", card)) el.lang = "en";
  }
  function segmentWords(s) {
    let out = [];
    for (let i = 0; i < s.length; ) {
      let n = LONGEST;
      for (; n > 1 && !WORDS[s.slice(i, i + n)]; ) n--;
      out.push(s.slice(i, i + n)), i += n;
    }
    return out;
  }
  function place() {
    if (!current) return;
    let r = current.at instanceof HTMLElement ? current.at.getBoundingClientRect() : current.at, w = card.offsetWidth, left = Math.max(8, Math.min(r.left + scrollX, scrollX + root.clientWidth - w - 8)), top = r.bottom + scrollY + 8;
    r.bottom + card.offsetHeight + 16 > innerHeight && r.top > card.offsetHeight + 16 && (top = r.top + scrollY - card.offsetHeight - 8), card.style.left = `${left}px`, card.style.top = `${top}px`;
  }
  function show(word, at, phrase = !1) {
    if (clearTimeout(hideTimer), !(current?.word === word && current.at === at && !card.hidden)) {
      current = { word, phrase, at }, render(), card.hidden = !1, card.classList.remove("in"), card.offsetWidth, card.classList.add("in"), place();
      for (let el of $$(".w.on")) el.classList.remove("on");
      at instanceof HTMLElement && at.classList.add("on"), did(phrase ? "select" : "card");
    }
  }
  function hide() {
    card.hidden = !0, current = void 0;
    for (let el of $$(".w.on")) el.classList.remove("on");
  }
  var hideSoon = (ms = 220) => {
    clearTimeout(hideTimer), hideTimer = window.setTimeout(hide, ms);
  };
  function stamp(s) {
    if (!current || current.phrase) return;
    let { word } = current, next = s && stamps.get(word) === s ? null : s;
    if (next !== (stamps.get(word) ?? null)) {
      next ? stamps.set(word, next) : stamps.delete(word), playStamp(next);
      for (let el of $$(`.w[data-w="${word}"]`))
        el.classList.remove("st-fresh", "st-learning", "st-known"), next && el.classList.add(`st-${next}`);
      render(), card.querySelector(`.seal.${next}`)?.classList.add("press"), next && did("stamp");
    }
  }
  var demos = $$("[data-demo]");
  if (demos.length) {
    document.body.append(card);
    for (let d of demos) segment(d);
    let touch = matchMedia("(hover: none)").matches;
    document.addEventListener("mouseover", (e) => {
      if (ext() || touch) return;
      let w = e.target.closest?.("[data-demo] .w");
      w ? show(w.dataset.w, w) : card.contains(e.target) ? clearTimeout(hideTimer) : current && !current.phrase && hideSoon();
    }), document.addEventListener("click", (e) => {
      if (ext()) return;
      let w = e.target.closest?.("[data-demo] .w");
      w && touch ? show(w.dataset.w, w) : !card.contains(e.target) && current && (touch || current.phrase) && hide();
    }), document.addEventListener("keydown", (e) => {
      if (ext() || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") return hide();
      if (e.key === "Alt" && !e.repeat) {
        let sel = getSelection(), text = sel?.toString().trim() ?? "", node = sel?.anchorNode?.parentElement;
        if (!text || !/[一-鿿]/.test(text) || !node?.closest("[data-demo]")) return;
        e.preventDefault();
        let r = sel.getRangeAt(0).getBoundingClientRect();
        return show(text, r, !WORDS[text]), did("select");
      }
      if (!current || e.altKey || e.shiftKey) return;
      let s = STAMPS.find(([, , k]) => k === e.key);
      if (s) stamp(s[0]);
      else if (e.key === "0") stamp(null);
      else if (e.key === "v") say(current.word);
      else return;
      e.preventDefault();
    }), addEventListener("resize", place);
  }
  for (let b of $$("[data-sound]"))
    b.addEventListener("click", () => {
      playStamp(b.dataset.sound), b.classList.add("press"), setTimeout(() => b.classList.remove("press"), 160);
    });
  for (let sim of $$(".ytsim")) {
    let lines = $$(".script li", sim), zh = sim.querySelector(".band .zh"), en = sim.querySelector(".band .en"), bar = sim.querySelector(".bar"), at = 0, loop = !1, go = (i, flash) => {
      if (at = (i + lines.length) % lines.length, zh.textContent = lines[at].dataset.zh, en.textContent = lines[at].dataset.en, segment(zh), lines.forEach((l, j) => l.classList.toggle("now", j === at)), bar.classList.remove("run"), bar.offsetWidth, bar.classList.add("run"), flash) {
        let k = sim.querySelector(`[data-k="${flash}"]`);
        k?.classList.remove("hit"), k?.offsetWidth, k?.classList.add("hit");
      }
    };
    bar.addEventListener("animationend", () => go(loop ? at : at + 1));
    let band = sim.querySelector(".band");
    band.addEventListener("mouseenter", () => sim.classList.add("paused")), band.addEventListener("mouseleave", () => sim.classList.remove("paused"));
    let act = (k) => {
      if (k === "a") go(at - 1, k);
      else if (k === "s") go(at, k);
      else if (k === "d") go(at + 1, k);
      else if (k === "r")
        loop = !loop, sim.classList.toggle("loop", loop), go(at, k);
      else if (k === "e")
        sim.classList.toggle("script-on"), go(at, k);
      else return !1;
      return !0;
    };
    for (let b of $$("[data-k]", sim)) b.addEventListener("click", () => act(b.dataset.k));
    lines.forEach((l, i) => l.addEventListener("click", () => go(i))), document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select")) return;
      let r = sim.getBoundingClientRect();
      r.bottom < 0 || r.top > innerHeight || act(e.key.toLowerCase()) && e.preventDefault();
    }), go(0);
  }
})();
