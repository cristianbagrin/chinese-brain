"use strict";
(() => {
  // src/pages/common.ts
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const k of kids) if (k) el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);

  // src/pages/action.ts
  async function init() {
    const [s, statuses, tabs] = await Promise.all([
      browser.runtime.sendMessage({ type: "settings" }),
      browser.runtime.sendMessage({ type: "statuses" }),
      browser.tabs.query({ active: true, currentWindow: true })
    ]);
    const vals = Object.values(statuses);
    $("counts").replaceChildren(
      ...[
        ["fresh", "\u65B0"],
        ["difficult", "\u96E3"],
        ["known", "\u719F"]
      ].map(([k, zh]) => h("div", { class: k }, h("b", null, String(vals.filter((v) => v === k).length)), h("span", null, zh + " " + k)))
    );
    const mode = $("hoverMode");
    mode.value = s.hoverMode;
    mode.addEventListener("change", () => browser.runtime.sendMessage({ type: "saveSettings", settings: { hoverMode: mode.value } }));
    let host = "";
    try {
      host = new URL(tabs[0]?.url ?? "").hostname;
    } catch {
    }
    if (!host) {
      $("siteLine").hidden = true;
      return;
    }
    $("host").textContent = host;
    const box = $("siteOff");
    box.checked = s.disabledSites.includes(host);
    box.addEventListener("change", () => {
      const list = new Set(s.disabledSites);
      if (box.checked) list.add(host);
      else list.delete(host);
      browser.runtime.sendMessage({ type: "saveSettings", settings: { disabledSites: [...list] } });
    });
  }
  init();
})();
