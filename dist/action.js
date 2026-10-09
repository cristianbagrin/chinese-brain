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
  var save = (settings) => browser.runtime.sendMessage({ type: "saveSettings", settings });
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
      ].map(
        ([k, label]) => h("a", { class: `count ${k}`, href: `vocab.html#${k}`, target: "_blank", title: `Open the ${label.split(" ")[1]} words` }, h("b", null, String(vals.filter((v) => v === k).length)), h("span", null, label))
      )
    );
    for (let el of document.querySelectorAll("[data-setting]")) {
      let key = el.dataset.setting;
      if (el instanceof HTMLInputElement) {
        el.checked = !!s[key], el.addEventListener("change", () => {
          save({ [key]: el.checked }), key === "pageColors" && setTimeout(showStats, 1500);
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
    let tab = tabs[0], showStats = async () => {
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
    $("siteLine").hidden = !1, $("host").textContent = host.replace(/^www\./, "");
    let box = $("siteOn");
    box.checked = !s.disabledSites.includes(host), box.addEventListener("change", () => {
      let list = new Set(s.disabledSites);
      box.checked ? list.delete(host) : list.add(host), s.disabledSites = [...list], save({ disabledSites: s.disabledSites });
    });
  }
  init();
})();
