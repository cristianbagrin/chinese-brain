"use strict";
(() => {
  // src/shared/types.ts
  function cardMode(s, host) {
    return s.hoverMode === "off" || s.disabledSites.includes(host) ? "off" : s.hoverMode === "hover" ? s.altSites.includes(host) ? "alt" : "hover" : s.hoverSites.includes(host) ? "hover" : "alt";
  }
  function setSiteMode(s, host, mode) {
    let without = (list) => list.filter((h2) => h2 !== host), out = { altSites: without(s.altSites), hoverSites: without(s.hoverSites), disabledSites: without(s.disabledSites) };
    return mode === "off" ? out.disabledSites.push(host) : s.hoverMode === "hover" && mode === "alt" ? out.altSites.push(host) : s.hoverMode === "alt" && mode === "hover" && out.hoverSites.push(host), out;
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/pages/common.ts
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
  var SUPPORT = "chris@cristianbagrin.com", DASHBOARD = "https://chinese.cristianbagrin.com/brain/dashboard", MAC = /Mac|iPhone|iPad/.test(navigator.platform), ALT = MAC ? "\u2325 Option" : "Alt", shortcutLabel = (key) => key ? MAC ? key.replace("Alt", "\u2325 Option").replace("Ctrl", "\u2303 Control").replace("Command", "\u2318") : key : "not set";
  function feedbackLink() {
    let body = `


(Reporting a bug? Say what happened and on which page or video. A screenshot helps a lot.)
--
Chinese Brain ${browser.runtime.getManifest().version} \xB7 ${navigator.userAgent}`;
    return `mailto:${SUPPORT}?subject=${encodeURIComponent("Chinese Brain feedback")}&body=${encodeURIComponent(body)}`;
  }

  // src/pages/help.css
  var help_default = `/*
 * The "?" next to a setting and the short note it opens, right there (help.ts). The note grows out
 * of its "?" (transform-origin follows the trigger), fades in fast and out faster, and can be
 * reversed mid-way: transitions, not keyframes. Pages tune it with --help-* custom properties.
 */
button.help {
  display: inline-grid; place-items: center; flex: none; vertical-align: middle;
  width: 22px; height: 22px; padding: 0; margin: 0 0 0 6px; border: 0; border-radius: 50%;
  background: var(--help-fill, rgba(30, 26, 24, 0.07)); color: var(--help-ink2, #6b635d);
  font: 600 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease;
  /* A bigger target than it looks (fingers). */
  position: relative;
}
button.help::before { content: ''; position: absolute; inset: -8px; }
button.help:active { transform: scale(0.92); }
button.help[aria-expanded='true'] { background: var(--help-accent, #c8202f); color: #fff; }
@media (hover: hover) and (pointer: fine) {
  button.help:hover:not([aria-expanded='true']) { background: var(--help-fill2, rgba(30, 26, 24, 0.12)); color: var(--help-ink, #1e1a18); }
}
button.help:focus-visible { outline: 2px solid var(--help-accent, #c8202f); outline-offset: 2px; }

.help-pop {
  position: fixed; inset: auto; margin: 0; box-sizing: border-box;
  width: max-content; max-width: min(300px, calc(100vw - 16px)); padding: 12px 14px;
  border: 0; border-radius: 12px; background: var(--help-bg, #fff); color: var(--help-ink, #1e1a18);
  box-shadow: 0 0 0 1px rgba(30, 26, 24, 0.08), 0 12px 32px -8px rgba(30, 26, 24, 0.28), 0 2px 6px rgba(30, 26, 24, 0.06);
  font: 400 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; text-align: left;
  letter-spacing: normal; text-transform: none; white-space: normal; overflow-wrap: break-word;
  opacity: 1; transform: none;
  transition: opacity 0.15s cubic-bezier(0.23, 1, 0.32, 1), transform 0.2s cubic-bezier(0.23, 1, 0.32, 1),
    overlay 0.2s allow-discrete, display 0.2s allow-discrete;
}
.help-pop:not(:popover-open) { opacity: 0; transform: scale(0.96); transition-duration: 0.1s, 0.12s, 0.12s, 0.12s; }
@starting-style { .help-pop:popover-open { opacity: 0; transform: scale(0.96); } }
.help-pop p { margin: 0; }
.help-pop p + p, .help-pop p + ul, .help-pop ul + p { margin-top: 8px; }
.help-pop ul { margin: 0; padding-left: 18px; }
.help-pop b, .help-pop strong { font-weight: 600; }
.help-pop a { color: var(--help-link, #a3192a); font-weight: 500; }
.help-pop code, .help-pop kbd { font: 500 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 4px; border-radius: 4px; background: var(--help-fill, rgba(30, 26, 24, 0.07)); }
.help-pop [lang='zh-Hant'] { font-size: 1.08em; }

@media (prefers-reduced-motion: reduce) {
  .help-pop, .help-pop:not(:popover-open) { transform: none; }
  @starting-style { .help-pop:popover-open { transform: none; } }
}
`;

  // src/pages/help.ts
  function helpPopovers(root = document) {
    document.adoptedStyleSheets.includes(sheet) || (sheet.replaceSync(help_default), document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]);
    for (let pop of root.querySelectorAll(".help-pop[popover]")) {
      if (pop.dataset.ready) continue;
      pop.dataset.ready = "1";
      let trigger = document.querySelector(`[popovertarget="${pop.id}"]`);
      if (!trigger) continue;
      pop.hasAttribute("aria-label") || pop.setAttribute("aria-label", trigger.getAttribute("aria-label") ?? "Help"), pop.setAttribute("role", "dialog");
      let raf = 0, place = () => {
        cancelAnimationFrame(raf), raf = requestAnimationFrame(() => position(pop, trigger));
      };
      pop.addEventListener("beforetoggle", (e) => {
        let open = e.newState === "open";
        trigger.setAttribute("aria-expanded", String(open)), open ? (place(), addEventListener("scroll", place, { capture: !0, passive: !0 }), addEventListener("resize", place)) : (removeEventListener("scroll", place, { capture: !0 }), removeEventListener("resize", place));
      }), trigger.setAttribute("aria-expanded", "false");
    }
  }
  var sheet = new CSSStyleSheet(), GAP = 8, EDGE = 8;
  function position(pop, trigger) {
    let t = trigger.getBoundingClientRect(), w = pop.offsetWidth, h2 = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = innerHeight, below = t.bottom + GAP + h2 <= vh - EDGE || t.top - GAP - h2 < EDGE, top = below ? t.bottom + GAP : t.top - GAP - h2, left = Math.max(EDGE, Math.min(t.left - 10, vw - EDGE - w));
    pop.style.top = `${Math.round(top)}px`, pop.style.left = `${Math.round(left)}px`, pop.style.transformOrigin = `${Math.round(t.left + t.width / 2 - left)}px ${below ? 0 : h2}px`;
  }

  // src/shared/sounds.ts
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

  // src/pages/action.ts
  var save = (settings) => browser.runtime.sendMessage({ type: "saveSettings", settings });
  async function init() {
    let [s, statuses, tabs] = await Promise.all([
      browser.runtime.sendMessage({ type: "settings" }),
      browser.runtime.sendMessage({ type: "statuses" }),
      browser.tabs.query({ active: !0, currentWindow: !0 })
    ]), vals = Object.values(statuses);
    $("counts").replaceChildren(
      ...[
        ["fresh", "\u65B0", "Fresh"],
        ["learning", "\u5B78", "Learning"],
        ["known", "\u719F", "Known"]
      ].map(([k, zh, label]) => {
        let n = vals.filter((v) => v === k).length;
        return h(
          "a",
          { class: k, href: `${DASHBOARD}#${k}`, target: "_blank", title: `Open your ${label.toLowerCase()} words`, "aria-label": `${n} ${label.toLowerCase()} words` },
          h("span", { class: "seal", lang: "zh-Hant" }, zh),
          h("b", null, n.toLocaleString("en-US"))
        );
      })
    ), $("feedback").href = feedbackLink(), helpPopovers(), $("words").href = DASHBOARD, $("altMode").textContent = ALT, $("altMode").title = `Only while holding ${ALT}`;
    for (let el of document.querySelectorAll(".altName"))
      el.textContent = ALT, el.title = `Only while holding ${ALT} on this website`;
    browser.runtime.sendMessage({ type: "account" }).then((a) => {
      a.signedIn && ($("acctLink").textContent = a.error ? "Sync problem" : "\u2713 Synced");
    });
    let dl = $("dlNew"), newCount = async () => {
      let n = await browser.runtime.sendMessage({ type: "newCount" });
      $("newN").textContent = n ? n.toLocaleString("en-US") : "", dl.disabled = !n, dl.title = n ? `Download the ${n} word${n === 1 ? "" : "s"} you changed since the last download (TSV)` : "Nothing new since your last download";
    };
    newCount(), dl.addEventListener("click", async () => {
      if (dl.disabled = !0, !await browser.runtime.sendMessage({ type: "downloadNew" })) return void newCount();
      $("newN").textContent = "\u2713", setTimeout(newCount, 1500);
    });
    for (let el of document.querySelectorAll("[data-setting]")) {
      let key = el.dataset.setting;
      if (el instanceof HTMLInputElement) {
        el.checked = !!s[key], el.addEventListener("change", () => {
          s[key] = el.checked, save({ [key]: el.checked }), key === "sounds" && el.checked && playStamp("fresh"), key === "pageColors" && (syncColors(), setTimeout(showStats, 1500));
        });
        continue;
      }
      let buttons = [...el.querySelectorAll("button")], mark = (v) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
      mark(String(s[key]));
      for (let b of buttons)
        b.addEventListener("click", () => {
          mark(b.dataset.v), s[key] = b.dataset.v, save({ [key]: b.dataset.v }), key === "hoverMode" && syncSite();
        });
    }
    let syncColors = () => {
    }, syncSite = () => {
    }, tab = tabs[0], showStats = async () => {
      try {
        let st = await browser.tabs.sendMessage(tab.id, { type: "pageStats" });
        if (!st?.on || !st.total) return $("pageStats").textContent = "";
        let pct = (n) => Math.round(n / st.total * 100);
        $("pageStats").textContent = `This page: \u719F ${pct(st.known)}% \xB7 \u5B78 ${pct(st.learning)}% \xB7 \u65B0 ${pct(st.fresh)}% \xB7 new ${pct(st.new)}%`;
      } catch {
      }
    };
    showStats();
    let host = "";
    try {
      let u = new URL(tab?.url ?? "");
      /^https?:$/.test(u.protocol) && (host = u.hostname);
    } catch {
    }
    if (!host) return;
    $("siteLine").hidden = !1;
    for (let el of document.querySelectorAll(".hostname")) el.textContent = host.replace(/^www\./, "");
    $("colorLine").hidden = !1;
    let colors = $("colorsOn");
    syncColors = () => colors.checked = colorsOn(s, host), syncColors(), colors.addEventListener("change", () => {
      let siteColors = { ...s.siteColors, [host]: colors.checked };
      s.siteColors = siteColors, save({ siteColors }), setTimeout(showStats, 1500);
    }), browser.commands.getAll().then((cmds) => {
      let key = cmds.find((c) => c.name === "toggle-colors")?.shortcut;
      key && ($("colorKey").textContent = shortcutLabel(key));
    }).catch(() => {
    });
    let siteButtons = [...$("siteMode").querySelectorAll("button")];
    syncSite = () => {
      let now = cardMode(s, host);
      for (let b of siteButtons) b.setAttribute("aria-pressed", String(b.dataset.v === now));
      $("siteLine").hidden = s.hoverMode === "off";
    }, syncSite();
    for (let b of siteButtons)
      b.addEventListener("click", () => {
        let lists = setSiteMode(s, host, b.dataset.v);
        Object.assign(s, lists), syncSite(), save(lists);
      });
  }
  init();
})();
