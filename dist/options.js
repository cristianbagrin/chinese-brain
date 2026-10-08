"use strict";
(() => {
  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    subPinyin: false,
    translation: "blur",
    toTraditional: true,
    pauseOnHover: true,
    autoFreshOnClick: true,
    markUntracked: true,
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
    const s = await browser.runtime.sendMessage({ type: "settings" });
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const el = $(key);
      if (!el) continue;
      const v = s[key];
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = !!v;
      else if (Array.isArray(v)) el.value = v.join("\n");
      else el.value = String(v);
      el.addEventListener("change", () => save(key, el));
    }
  }
  function save(key, el) {
    const def = DEFAULT_SETTINGS[key];
    let value;
    if (el instanceof HTMLInputElement && el.type === "checkbox") value = el.checked;
    else if (typeof def === "number") value = Number(el.value) || def;
    else if (Array.isArray(def))
      value = el.value.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    else value = el.value.trim();
    browser.runtime.sendMessage({ type: "saveSettings", settings: { [key]: value } });
  }
  init();
})();
