"use strict";
(() => {
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

  // src/pages/common.ts
  var $ = (id) => document.getElementById(id);

  // src/pages/options.ts
  async function init() {
    let s = await browser.runtime.sendMessage({ type: "settings" });
    for (let key of Object.keys(DEFAULT_SETTINGS)) {
      let el = $(key);
      if (!el) continue;
      let v = s[key];
      el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked = !!v : Array.isArray(v) ? el.value = v.join(`
`) : el.value = String(v), el.addEventListener("change", () => save(key, el));
    }
  }
  function save(key, el) {
    let def = DEFAULT_SETTINGS[key], value;
    el instanceof HTMLInputElement && el.type === "checkbox" ? value = el.checked : typeof def == "number" ? value = Number(el.value) || def : Array.isArray(def) ? value = el.value.split(/\s+/).map((x) => x.trim()).filter(Boolean) : value = el.value.trim(), browser.runtime.sendMessage({ type: "saveSettings", settings: { [key]: value } });
  }
  init();
})();
