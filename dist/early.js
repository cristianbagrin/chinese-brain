"use strict";
(() => {
  // src/shared/types.ts
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    ytEnabled: !0,
    pinyin: !0,
    pron: "zhuyin",
    translation: "blur",
    pauseOnHover: !0,
    autoFreshOnClick: !0,
    subFontSize: 30,
    subStyle: "light",
    shadowFactor: 1.5,
    cardSize: "normal",
    cardColors: !0,
    sounds: !0,
    pageColors: !1,
    siteColors: {},
    speechRate: 0.9,
    voice: "google",
    azureKey: "",
    azureRegion: "eastasia",
    azureVoice: "zh-TW-HsiaoChenNeural",
    geminiKey: "",
    geminiModel: "gemini-3.8-flash",
    keys: {}
  };
  function normalizeSettings(raw) {
    let r = { ...raw ?? {} };
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), r.hoverMode === "shift" && (r.hoverMode = "alt"), delete r.subPinyin, delete r.cardPinyin, delete r.markUntracked, r.pron !== "pinyin" && r.pron !== "zhuyin" && delete r.pron, { ...DEFAULT_SETTINGS, ...r };
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/content/state.ts
  var State = class {
    settings = { ...DEFAULT_SETTINGS };
    statuses = /* @__PURE__ */ new Map();
    statusesLoaded;
    settingsLoaded;
    listeners = /* @__PURE__ */ new Set();
    constructor() {
      this.settingsLoaded = browser.storage.local.get("settings").then(({ settings }) => {
        this.settings = normalizeSettings(settings);
      }), browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        let dirty = !1;
        for (let [k, ch] of Object.entries(changes))
          if (k === "settings")
            this.settings = normalizeSettings(ch.newValue), dirty = !0;
          else if (k.startsWith("w:") && this.statusesLoaded) {
            let rec = ch.newValue;
            rec ? this.statuses.set(k.slice(2), rec.s) : this.statuses.delete(k.slice(2)), dirty = !0;
          }
        dirty && this.listeners.forEach((l) => l());
      });
    }
    ready() {
      return this.settingsLoaded;
    }
    loadStatuses() {
      return this.statusesLoaded ??= browser.runtime.sendMessage({ type: "statuses" }).then((s) => {
        this.statuses = new Map(Object.entries(s)), this.listeners.forEach((l) => l());
      }), this.statusesLoaded;
    }
    status(word) {
      return word ? this.statuses.get(word) : void 0;
    }
    onChange(l) {
      return this.listeners.add(l), () => this.listeners.delete(l);
    }
    /** Color the words on this page? */
    colorsEnabled() {
      return this.siteEnabled() && colorsOn(this.settings, location.hostname);
    }
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(location.hostname);
    }
  }, state = new State();

  // src/content/keys.ts
  function target(e) {
    return e.composedPath?.()[0] ?? e.target;
  }
  function inOwnBox(e) {
    return !!target(e)?.hasAttribute?.("data-typing");
  }
  function guardKeys(w2, keys) {
    w2.addEventListener(
      "keydown",
      (e) => {
        let own = inOwnBox(e);
        keys.fn?.(e), own && e.stopImmediatePropagation();
      },
      !0
    );
    for (let t of ["keyup", "keypress"])
      w2.addEventListener(t, (e) => inOwnBox(e) && e.stopImmediatePropagation(), !0);
  }

  // src/content/early.ts
  var w = window;
  w.__cbKeys || (w.__cbKeys = {}, guardKeys(window, w.__cbKeys));
})();
