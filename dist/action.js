"use strict";
(() => {
  // src/shared/types.ts
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
          { class: k, href: `vocab.html#${k}`, target: "_blank", title: `Open your ${label.toLowerCase()} words`, "aria-label": `${n} ${label.toLowerCase()} words` },
          h("span", { class: "seal", lang: "zh-Hant" }, zh),
          h("b", null, n.toLocaleString("en-US"))
        );
      })
    );
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
          mark(b.dataset.v), save({ [key]: b.dataset.v });
        });
    }
    let syncColors = () => {
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
      let siteColors = { ...s.siteColors };
      colors.checked === s.pageColors ? delete siteColors[host] : siteColors[host] = colors.checked, s.siteColors = siteColors, save({ siteColors }), setTimeout(showStats, 1500);
    }), browser.commands.getAll().then((cmds) => {
      let key = cmds.find((c) => c.name === "toggle-colors")?.shortcut, mac = navigator.platform.startsWith("Mac");
      key && ($("colorKey").textContent = `Shortcut ${mac ? key.replace("Alt", "Option") : key}`);
    }).catch(() => {
    });
    let box = $("siteOn");
    box.checked = !s.disabledSites.includes(host), box.addEventListener("change", () => {
      let list = new Set(s.disabledSites);
      box.checked ? list.delete(host) : list.add(host), s.disabledSites = [...list], save({ disabledSites: s.disabledSites });
    });
  }
  init();
})();
