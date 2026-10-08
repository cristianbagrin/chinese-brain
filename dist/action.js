"use strict";
(() => {
  // src/pages/common.ts
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);

  // src/pages/action.ts
  async function init() {
    let [s, statuses, tabs] = await Promise.all([
      browser.runtime.sendMessage({ type: "settings" }),
      browser.runtime.sendMessage({ type: "statuses" }),
      browser.tabs.query({ active: !0, currentWindow: !0 })
    ]), vals = Object.values(statuses);
    $("counts").replaceChildren(
      ...[
        ["fresh", "\u65B0 Fresh"],
        ["learning", "\u5B78 Learning"],
        ["known", "\u719F Known"]
      ].map(([k, label]) => h("div", { class: `count ${k}` }, h("b", null, String(vals.filter((v) => v === k).length)), h("span", null, label)))
    );
    let mode = $("hoverMode");
    mode.value = s.hoverMode, mode.addEventListener("change", () => browser.runtime.sendMessage({ type: "saveSettings", settings: { hoverMode: mode.value } }));
    let pc = $("pageColors");
    pc.checked = s.pageColors, pc.addEventListener("change", () => browser.runtime.sendMessage({ type: "saveSettings", settings: { pageColors: pc.checked } }).then(() => setTimeout(showStats, 1500)));
    let showStats = async () => {
      try {
        let st = await browser.tabs.sendMessage(tabs[0].id, { type: "pageStats" });
        if (!st?.on || !st.total) return $("pageStats").textContent = "";
        let pct = (n) => Math.round(n / st.total * 100);
        $("pageStats").textContent = `This page: \u719F ${pct(st.known)}% \xB7 \u5B78 ${pct(st.learning)}% \xB7 \u65B0 ${pct(st.fresh)}% \xB7 new ${pct(st.new)}%`;
      } catch {
      }
    };
    showStats();
    let host = "";
    try {
      host = new URL(tabs[0]?.url ?? "").hostname;
    } catch {
    }
    if (!host) {
      $("siteLine").hidden = !0;
      return;
    }
    $("host").textContent = host;
    let box = $("siteOff");
    box.checked = s.disabledSites.includes(host), box.addEventListener("change", () => {
      let list = new Set(s.disabledSites);
      box.checked ? list.add(host) : list.delete(host), browser.runtime.sendMessage({ type: "saveSettings", settings: { disabledSites: [...list] } });
    });
  }
  init();
})();
