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
        ["fresh", "\u65B0"],
        ["difficult", "\u96E3"],
        ["known", "\u719F"]
      ].map(([k, zh]) => h("div", { class: k }, h("b", null, String(vals.filter((v) => v === k).length)), h("span", null, zh + " " + k)))
    );
    let mode = $("hoverMode");
    mode.value = s.hoverMode, mode.addEventListener("change", () => browser.runtime.sendMessage({ type: "saveSettings", settings: { hoverMode: mode.value } }));
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
