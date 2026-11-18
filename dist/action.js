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
    ), $("feedback").href = feedbackLink(), $("words").href = DASHBOARD, $("altMode").textContent = ALT, $("altMode").title = `Only while holding ${ALT}`;
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
      dl.disabled = !0, await browser.runtime.sendMessage({ type: "downloadNew" }), $("newN").textContent = "\u2713", setTimeout(newCount, 1500);
    });
    for (let el of document.querySelectorAll("[data-setting]")) {
      let key = el.dataset.setting;
      if (el instanceof HTMLInputElement) {
        el.checked = !!s[key], el.addEventListener("change", () => {
          s[key] = el.checked, save({ [key]: el.checked }), key === "pageColors" && (syncColors(), setTimeout(showStats, 1500));
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
