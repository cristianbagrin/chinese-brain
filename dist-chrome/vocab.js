"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key2 of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key2) && key2 !== except && __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
    mod
  ));

  // node_modules/webextension-polyfill/dist/browser-polyfill.min.js
  var require_browser_polyfill_min = __commonJS({
    "node_modules/webextension-polyfill/dist/browser-polyfill.min.js"(exports, module) {
      init_browser_shim();
      (function(a, b) {
        if (typeof define == "function" && define.amd) define("webextension-polyfill", ["module"], b);
        else if (typeof exports < "u") b(module);
        else {
          var c = { exports: {} };
          b(c), a.browser = c.exports;
        }
      })(typeof globalThis > "u" ? typeof self > "u" ? exports : self : globalThis, function(a) {
        "use strict";
        if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) throw new Error("This script should only be loaded in a browser extension.");
        globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id ? a.exports = globalThis.browser : a.exports = ((a2) => {
          let b = { alarms: { clear: { minArgs: 0, maxArgs: 1 }, clearAll: { minArgs: 0, maxArgs: 0 }, get: { minArgs: 0, maxArgs: 1 }, getAll: { minArgs: 0, maxArgs: 0 } }, bookmarks: { create: { minArgs: 1, maxArgs: 1 }, get: { minArgs: 1, maxArgs: 1 }, getChildren: { minArgs: 1, maxArgs: 1 }, getRecent: { minArgs: 1, maxArgs: 1 }, getSubTree: { minArgs: 1, maxArgs: 1 }, getTree: { minArgs: 0, maxArgs: 0 }, move: { minArgs: 2, maxArgs: 2 }, remove: { minArgs: 1, maxArgs: 1 }, removeTree: { minArgs: 1, maxArgs: 1 }, search: { minArgs: 1, maxArgs: 1 }, update: { minArgs: 2, maxArgs: 2 } }, browserAction: { disable: { minArgs: 0, maxArgs: 1, fallbackToNoCallback: !0 }, enable: { minArgs: 0, maxArgs: 1, fallbackToNoCallback: !0 }, getBadgeBackgroundColor: { minArgs: 1, maxArgs: 1 }, getBadgeText: { minArgs: 1, maxArgs: 1 }, getPopup: { minArgs: 1, maxArgs: 1 }, getTitle: { minArgs: 1, maxArgs: 1 }, openPopup: { minArgs: 0, maxArgs: 0 }, setBadgeBackgroundColor: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, setBadgeText: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, setIcon: { minArgs: 1, maxArgs: 1 }, setPopup: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, setTitle: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 } }, browsingData: { remove: { minArgs: 2, maxArgs: 2 }, removeCache: { minArgs: 1, maxArgs: 1 }, removeCookies: { minArgs: 1, maxArgs: 1 }, removeDownloads: { minArgs: 1, maxArgs: 1 }, removeFormData: { minArgs: 1, maxArgs: 1 }, removeHistory: { minArgs: 1, maxArgs: 1 }, removeLocalStorage: { minArgs: 1, maxArgs: 1 }, removePasswords: { minArgs: 1, maxArgs: 1 }, removePluginData: { minArgs: 1, maxArgs: 1 }, settings: { minArgs: 0, maxArgs: 0 } }, commands: { getAll: { minArgs: 0, maxArgs: 0 } }, contextMenus: { remove: { minArgs: 1, maxArgs: 1 }, removeAll: { minArgs: 0, maxArgs: 0 }, update: { minArgs: 2, maxArgs: 2 } }, cookies: { get: { minArgs: 1, maxArgs: 1 }, getAll: { minArgs: 1, maxArgs: 1 }, getAllCookieStores: { minArgs: 0, maxArgs: 0 }, remove: { minArgs: 1, maxArgs: 1 }, set: { minArgs: 1, maxArgs: 1 } }, devtools: { inspectedWindow: { eval: { minArgs: 1, maxArgs: 2, singleCallbackArg: !1 } }, panels: { create: { minArgs: 3, maxArgs: 3, singleCallbackArg: !0 }, elements: { createSidebarPane: { minArgs: 1, maxArgs: 1 } } } }, downloads: { cancel: { minArgs: 1, maxArgs: 1 }, download: { minArgs: 1, maxArgs: 1 }, erase: { minArgs: 1, maxArgs: 1 }, getFileIcon: { minArgs: 1, maxArgs: 2 }, open: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, pause: { minArgs: 1, maxArgs: 1 }, removeFile: { minArgs: 1, maxArgs: 1 }, resume: { minArgs: 1, maxArgs: 1 }, search: { minArgs: 1, maxArgs: 1 }, show: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 } }, extension: { isAllowedFileSchemeAccess: { minArgs: 0, maxArgs: 0 }, isAllowedIncognitoAccess: { minArgs: 0, maxArgs: 0 } }, history: { addUrl: { minArgs: 1, maxArgs: 1 }, deleteAll: { minArgs: 0, maxArgs: 0 }, deleteRange: { minArgs: 1, maxArgs: 1 }, deleteUrl: { minArgs: 1, maxArgs: 1 }, getVisits: { minArgs: 1, maxArgs: 1 }, search: { minArgs: 1, maxArgs: 1 } }, i18n: { detectLanguage: { minArgs: 1, maxArgs: 1 }, getAcceptLanguages: { minArgs: 0, maxArgs: 0 } }, identity: { launchWebAuthFlow: { minArgs: 1, maxArgs: 1 } }, idle: { queryState: { minArgs: 1, maxArgs: 1 } }, management: { get: { minArgs: 1, maxArgs: 1 }, getAll: { minArgs: 0, maxArgs: 0 }, getSelf: { minArgs: 0, maxArgs: 0 }, setEnabled: { minArgs: 2, maxArgs: 2 }, uninstallSelf: { minArgs: 0, maxArgs: 1 } }, notifications: { clear: { minArgs: 1, maxArgs: 1 }, create: { minArgs: 1, maxArgs: 2 }, getAll: { minArgs: 0, maxArgs: 0 }, getPermissionLevel: { minArgs: 0, maxArgs: 0 }, update: { minArgs: 2, maxArgs: 2 } }, pageAction: { getPopup: { minArgs: 1, maxArgs: 1 }, getTitle: { minArgs: 1, maxArgs: 1 }, hide: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, setIcon: { minArgs: 1, maxArgs: 1 }, setPopup: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, setTitle: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 }, show: { minArgs: 1, maxArgs: 1, fallbackToNoCallback: !0 } }, permissions: { contains: { minArgs: 1, maxArgs: 1 }, getAll: { minArgs: 0, maxArgs: 0 }, remove: { minArgs: 1, maxArgs: 1 }, request: { minArgs: 1, maxArgs: 1 } }, runtime: { getBackgroundPage: { minArgs: 0, maxArgs: 0 }, getPlatformInfo: { minArgs: 0, maxArgs: 0 }, openOptionsPage: { minArgs: 0, maxArgs: 0 }, requestUpdateCheck: { minArgs: 0, maxArgs: 0 }, sendMessage: { minArgs: 1, maxArgs: 3 }, sendNativeMessage: { minArgs: 2, maxArgs: 2 }, setUninstallURL: { minArgs: 1, maxArgs: 1 } }, sessions: { getDevices: { minArgs: 0, maxArgs: 1 }, getRecentlyClosed: { minArgs: 0, maxArgs: 1 }, restore: { minArgs: 0, maxArgs: 1 } }, storage: { local: { clear: { minArgs: 0, maxArgs: 0 }, get: { minArgs: 0, maxArgs: 1 }, getBytesInUse: { minArgs: 0, maxArgs: 1 }, remove: { minArgs: 1, maxArgs: 1 }, set: { minArgs: 1, maxArgs: 1 } }, managed: { get: { minArgs: 0, maxArgs: 1 }, getBytesInUse: { minArgs: 0, maxArgs: 1 } }, sync: { clear: { minArgs: 0, maxArgs: 0 }, get: { minArgs: 0, maxArgs: 1 }, getBytesInUse: { minArgs: 0, maxArgs: 1 }, remove: { minArgs: 1, maxArgs: 1 }, set: { minArgs: 1, maxArgs: 1 } } }, tabs: { captureVisibleTab: { minArgs: 0, maxArgs: 2 }, create: { minArgs: 1, maxArgs: 1 }, detectLanguage: { minArgs: 0, maxArgs: 1 }, discard: { minArgs: 0, maxArgs: 1 }, duplicate: { minArgs: 1, maxArgs: 1 }, executeScript: { minArgs: 1, maxArgs: 2 }, get: { minArgs: 1, maxArgs: 1 }, getCurrent: { minArgs: 0, maxArgs: 0 }, getZoom: { minArgs: 0, maxArgs: 1 }, getZoomSettings: { minArgs: 0, maxArgs: 1 }, goBack: { minArgs: 0, maxArgs: 1 }, goForward: { minArgs: 0, maxArgs: 1 }, highlight: { minArgs: 1, maxArgs: 1 }, insertCSS: { minArgs: 1, maxArgs: 2 }, move: { minArgs: 2, maxArgs: 2 }, query: { minArgs: 1, maxArgs: 1 }, reload: { minArgs: 0, maxArgs: 2 }, remove: { minArgs: 1, maxArgs: 1 }, removeCSS: { minArgs: 1, maxArgs: 2 }, sendMessage: { minArgs: 2, maxArgs: 3 }, setZoom: { minArgs: 1, maxArgs: 2 }, setZoomSettings: { minArgs: 1, maxArgs: 2 }, update: { minArgs: 1, maxArgs: 2 } }, topSites: { get: { minArgs: 0, maxArgs: 0 } }, webNavigation: { getAllFrames: { minArgs: 1, maxArgs: 1 }, getFrame: { minArgs: 1, maxArgs: 1 } }, webRequest: { handlerBehaviorChanged: { minArgs: 0, maxArgs: 0 } }, windows: { create: { minArgs: 0, maxArgs: 1 }, get: { minArgs: 1, maxArgs: 2 }, getAll: { minArgs: 0, maxArgs: 1 }, getCurrent: { minArgs: 0, maxArgs: 1 }, getLastFocused: { minArgs: 0, maxArgs: 1 }, remove: { minArgs: 1, maxArgs: 1 }, update: { minArgs: 2, maxArgs: 2 } } };
          if (Object.keys(b).length === 0) throw new Error("api-metadata.json has not been included in browser-polyfill");
          class c extends WeakMap {
            constructor(a3, b2 = void 0) {
              super(b2), this.createItem = a3;
            }
            get(a3) {
              return this.has(a3) || this.set(a3, this.createItem(a3)), super.get(a3);
            }
          }
          let d = (a3) => a3 && typeof a3 == "object" && typeof a3.then == "function", e = (b2, c2) => (...d2) => {
            a2.runtime.lastError ? b2.reject(new Error(a2.runtime.lastError.message)) : c2.singleCallbackArg || 1 >= d2.length && c2.singleCallbackArg !== !1 ? b2.resolve(d2[0]) : b2.resolve(d2);
          }, f = (a3) => a3 == 1 ? "argument" : "arguments", g = (a3, b2) => function(c2, ...d2) {
            if (d2.length < b2.minArgs) throw new Error(`Expected at least ${b2.minArgs} ${f(b2.minArgs)} for ${a3}(), got ${d2.length}`);
            if (d2.length > b2.maxArgs) throw new Error(`Expected at most ${b2.maxArgs} ${f(b2.maxArgs)} for ${a3}(), got ${d2.length}`);
            return new Promise((f2, g2) => {
              if (b2.fallbackToNoCallback) try {
                c2[a3](...d2, e({ resolve: f2, reject: g2 }, b2));
              } catch (e2) {
                console.warn(`${a3} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `, e2), c2[a3](...d2), b2.fallbackToNoCallback = !1, b2.noCallback = !0, f2();
              }
              else b2.noCallback ? (c2[a3](...d2), f2()) : c2[a3](...d2, e({ resolve: f2, reject: g2 }, b2));
            });
          }, h2 = (a3, b2, c2) => new Proxy(b2, { apply(b3, d2, e2) {
            return c2.call(d2, a3, ...e2);
          } }), i = Function.call.bind(Object.prototype.hasOwnProperty), j = (a3, b2 = {}, c2 = {}) => {
            let d2 = /* @__PURE__ */ Object.create(null), e2 = Object.create(a3);
            return new Proxy(e2, { has(b3, c3) {
              return c3 in a3 || c3 in d2;
            }, get(e3, f2) {
              if (f2 in d2) return d2[f2];
              if (!(f2 in a3)) return;
              let k2 = a3[f2];
              if (typeof k2 == "function")
                if (typeof b2[f2] == "function") k2 = h2(a3, a3[f2], b2[f2]);
                else if (i(c2, f2)) {
                  let b3 = g(f2, c2[f2]);
                  k2 = h2(a3, a3[f2], b3);
                } else k2 = k2.bind(a3);
              else if (typeof k2 == "object" && k2 !== null && (i(b2, f2) || i(c2, f2))) k2 = j(k2, b2[f2], c2[f2]);
              else if (i(c2, "*")) k2 = j(k2, b2[f2], c2["*"]);
              else return Object.defineProperty(d2, f2, { configurable: !0, enumerable: !0, get() {
                return a3[f2];
              }, set(b3) {
                a3[f2] = b3;
              } }), k2;
              return d2[f2] = k2, k2;
            }, set(b3, c3, e3) {
              return c3 in d2 ? d2[c3] = e3 : a3[c3] = e3, !0;
            }, defineProperty(a4, b3, c3) {
              return Reflect.defineProperty(d2, b3, c3);
            }, deleteProperty(a4, b3) {
              return Reflect.deleteProperty(d2, b3);
            } });
          }, k = (a3) => ({ addListener(b2, c2, ...d2) {
            b2.addListener(a3.get(c2), ...d2);
          }, hasListener(b2, c2) {
            return b2.hasListener(a3.get(c2));
          }, removeListener(b2, c2) {
            b2.removeListener(a3.get(c2));
          } }), l = new c((a3) => typeof a3 == "function" ? function(b2) {
            let c2 = j(b2, {}, { getContent: { minArgs: 0, maxArgs: 0 } });
            a3(c2);
          } : a3), m = new c((a3) => typeof a3 == "function" ? function(b2, c2, e2) {
            let f2, g2, h3 = !1, i2 = new Promise((a4) => {
              f2 = function(b3) {
                h3 = !0, a4(b3);
              };
            });
            try {
              g2 = a3(b2, c2, f2);
            } catch (a4) {
              g2 = Promise.reject(a4);
            }
            let j2 = g2 !== !0 && d(g2);
            if (g2 !== !0 && !j2 && !h3) return !1;
            let k2 = (a4) => {
              a4.then((a5) => {
                e2(a5);
              }, (a5) => {
                let b3;
                b3 = a5 && (a5 instanceof Error || typeof a5.message == "string") ? a5.message : "An unexpected error occurred", e2({ __mozWebExtensionPolyfillReject__: !0, message: b3 });
              }).catch((a5) => {
                console.error("Failed to send onMessage rejected reply", a5);
              });
            };
            return k2(j2 ? g2 : i2), !0;
          } : a3), n = ({ reject: b2, resolve: c2 }, d2) => {
            a2.runtime.lastError ? a2.runtime.lastError.message === "The message port closed before a response was received." ? c2() : b2(new Error(a2.runtime.lastError.message)) : d2 && d2.__mozWebExtensionPolyfillReject__ ? b2(new Error(d2.message)) : c2(d2);
          }, o = (a3, b2, c2, ...d2) => {
            if (d2.length < b2.minArgs) throw new Error(`Expected at least ${b2.minArgs} ${f(b2.minArgs)} for ${a3}(), got ${d2.length}`);
            if (d2.length > b2.maxArgs) throw new Error(`Expected at most ${b2.maxArgs} ${f(b2.maxArgs)} for ${a3}(), got ${d2.length}`);
            return new Promise((a4, b3) => {
              let e2 = n.bind(null, { resolve: a4, reject: b3 });
              d2.push(e2), c2.sendMessage(...d2);
            });
          }, p = { devtools: { network: { onRequestFinished: k(l) } }, runtime: { onMessage: k(m), onMessageExternal: k(m), sendMessage: o.bind(null, "sendMessage", { minArgs: 1, maxArgs: 3 }) }, tabs: { sendMessage: o.bind(null, "sendMessage", { minArgs: 2, maxArgs: 3 }) } }, q = { clear: { minArgs: 1, maxArgs: 1 }, get: { minArgs: 1, maxArgs: 1 }, set: { minArgs: 1, maxArgs: 1 } };
          return b.privacy = { network: { "*": q }, services: { "*": q }, websites: { "*": q } }, j(a2, p, b);
        })(chrome);
      });
    }
  });

  // src/platform/browser-shim.ts
  var import_browser_polyfill_min, init_browser_shim = __esm({
    "src/platform/browser-shim.ts"() {
      "use strict";
      import_browser_polyfill_min = __toESM(require_browser_polyfill_min(), 1);
    }
  });

  // src/pages/vocab.ts
  init_browser_shim();

  // src/content/audio.ts
  init_browser_shim();

  // src/platform/compat.ts
  init_browser_shim();

  // src/content/state.ts
  init_browser_shim();

  // src/shared/types.ts
  init_browser_shim();
  var STATUS_CODE = { fresh: "F", learning: "L", known: "K" }, DEFAULT_SETTINGS = {
    hoverMode: "hover",
    disabledSites: [],
    ytEnabled: !0,
    pinyin: !0,
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
    geminiModel: "gemini-3.8-flash"
  };
  function normalizeSettings(raw) {
    let r = { ...raw ?? {} };
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), r.hoverMode === "shift" && (r.hoverMode = "alt"), delete r.subPinyin, delete r.cardPinyin, delete r.markUntracked, { ...DEFAULT_SETTINGS, ...r };
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
      this.settingsLoaded = import_browser_polyfill_min.default.storage.local.get("settings").then(({ settings }) => {
        this.settings = normalizeSettings(settings);
      }), import_browser_polyfill_min.default.storage.onChanged.addListener((changes, area) => {
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
      return this.statusesLoaded ??= import_browser_polyfill_min.default.runtime.sendMessage({ type: "statuses" }).then((s) => {
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

  // src/content/audio.ts
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
  function stampSound(status) {
    if (state.settings.sounds)
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
  var voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ?? voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);

  // src/shared/context.ts
  init_browser_shim();
  var HAN = /[㐀-䶿一-鿿豈-﫿]/g, fold = (s) => s.replaceAll("\u81FA", "\u53F0");
  function findWord(text, word, alt) {
    let t = fold(text);
    for (let w of [word, alt]) {
      let i = w ? t.indexOf(fold(w)) : -1;
      if (w && i >= 0) return { i, len: w.length };
    }
  }
  function hasWord(text, word, alt) {
    return !!findWord(text, word, alt);
  }
  var CUES = /\[[^\]\n]{1,10}\]|［[^］\n]{1,10}］|【\d+】|\*[^*\n]{1,10}\*|[♪♫]/g;
  function cleanSentence(text, word, alt) {
    let uncue = (s) => s.replace(CUES, (cue) => hasWord(cue, word, alt) ? cue : " "), withWord = uncue(text).split(/\s*(?:[|｜]|\s[-–—]\s|(?<=[^\s\x00-\x7f])[-–—_](?=[^\s\x00-\x7f]))\s*/).map((p) => p.replace(/[ \t]+/g, " ").trim()).filter((p) => p && !/^(pdf|docx?|pptx?|xlsx?|html?|…|\.\.\.)$/i.test(p)).filter((p) => hasWord(p, word, alt));
    return withWord.length ? withWord.sort((a, b) => b.length - a.length)[0] : uncue(text).replace(/[ \t]+/g, " ").trim();
  }
  function usefulSentence(text, word) {
    let han = text.match(HAN)?.length ?? 0, latinWords = text.match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0;
    return han >= [...word].length + 2 && han * 2 >= latinWords * 3;
  }
  function quoted(s) {
    let inside = new Array(s.length).fill(!1), open = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (c === "\u300C" || c === "\u300E") open.push({ i, close: c === "\u300C" ? "\u300D" : "\u300F" });
      else if (c === "\u300D" || c === "\u300F") {
        let k = open.map((o) => o.close).lastIndexOf(c);
        if (k < 0) continue;
        let from = open[k].i;
        open.length = k;
        for (let j = from + 1; j < i; j++) inside[j] = !0;
      }
    }
    return inside;
  }
  function isStop(s, i, inside) {
    let c = s[i];
    return c === `
` || c === "\r" ? !0 : inside[i] ? !1 : "\u3002\uFF01\uFF1F".includes(c) ? !0 : ".!?".includes(c) && !/[0-9A-Za-z]/.test(s[i + 1] ?? "");
  }
  var CLOSER = /[」』"”’'）)】》〉\]]/;
  function sentenceBounds(s, pos) {
    let q = quoted(s), a = Math.min(Math.max(pos, 0), s.length);
    for (; a > 0 && !isStop(s, a - 1, q); ) a--;
    for (; a < pos && (CLOSER.test(s[a]) || /\s/.test(s[a])); ) a++;
    let b = Math.max(a, pos);
    for (; b < s.length && !isStop(s, b, q); ) b++;
    for (; b < s.length && isStop(s, b, q) && !/[\n\r]/.test(s[b]); ) b++;
    for (; b < s.length && CLOSER.test(s[b]); ) b++;
    return [a, b];
  }
  var segmenter = typeof Intl < "u" && "Segmenter" in Intl ? new Intl.Segmenter("zh-TW", { granularity: "word" }) : void 0;
  function trimAround(s, i, len, max) {
    if (s.length <= max) return s.trim();
    let cuts = segmenter ? [...segmenter.segment(s)].map((x) => x.index).concat(s.length) : [...s].map((_, k) => k).concat(s.length), a0 = Math.max(0, i - Math.floor((max - len) / 2)), b0 = Math.min(s.length, a0 + max);
    a0 = Math.max(0, b0 - max);
    let near = 12, clause = /[，、；：,;:\s（(「『]/, a = cuts.find((k) => k >= a0 && k <= i) ?? i;
    for (let k = a0; k <= Math.min(i, a0 + near); k++) if (k > 0 && clause.test(s[k - 1])) {
      a = k;
      break;
    }
    let b = [...cuts].reverse().find((k) => k <= b0 && k >= i + len) ?? i + len;
    for (let k = b0; k >= Math.max(i + len, b0 - near); k--) if (k < s.length && clause.test(s[k])) {
      b = k;
      break;
    }
    let mid = s.slice(a, b).trim().replace(/^[，、；：,;:]+|[，、；：,;:]+$/g, "");
    return `${a > 0 ? "\u2026" : ""}${mid}${b < s.length ? "\u2026" : ""}`;
  }
  function metSentence(c, word, max = 80) {
    let [zh, ...en] = c.text.split(" \u2014 "), hit = findWord(zh, word, c.q);
    if (!hit) return "";
    let [a, b] = sentenceBounds(zh, hit.i), one = cleanSentence(zh.slice(a, b), word, c.q), at = findWord(one, word, c.q);
    if (!at || !usefulSentence(one, word)) return "";
    let out = trimAround(one, at.i, at.len, max), english = en.join(" \u2014 ").replace(CUES, " ").replace(/\s+/g, " ").trim();
    return english && out === cleanSentence(zh, word, c.q) ? `${out} \u2014 ${english}` : out;
  }
  function shownSentence(ctx2, word, saved2 = [], max = 80) {
    let newest = [...saved2].sort((a, b) => b.at - a.at);
    for (let c of ctx2) {
      let inCard = metSentence(c, word, 120).split(" \u2014 ")[0], mine = inCard ? newest.find((s) => s.from === inCard || s.zh === inCard) : void 0;
      if (mine) return { c, text: mine.en ? `${mine.zh} \u2014 ${mine.en}` : mine.zh, edited: !0 };
    }
    for (let c of ctx2) {
      let text = metSentence(c, word, max);
      if (text) return { c, text };
    }
  }

  // src/shared/export.ts
  init_browser_shim();

  // src/shared/time.ts
  init_browser_shim();
  function dayKeyLocal(t) {
    let d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function clock(secs) {
    let s = Math.max(0, Math.floor(secs)), h2 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
    return h2 ? `${h2}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  // src/shared/export.ts
  var clean = (s) => (s ?? "").replace(/[\t\r\n]+/g, " ").trim(), stamp = (t) => {
    let d = new Date(t);
    return `${dayKeyLocal(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, code = (s) => s ? STATUS_CODE[s] : "-";
  function shortSource(url, t) {
    try {
      let u = new URL(url);
      return u.hostname.endsWith("youtube.com") && u.searchParams.get("v") ? `youtu.be/${u.searchParams.get("v")}${t != null ? `?t=${Math.floor(t)}` : ""}` : u.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
  var SITES = [
    ["notion.so", "Notion"],
    ["notion.com", "Notion"],
    ["notion.site", "Notion"],
    ["youtube.com", "YouTube"],
    ["youtu.be", "YouTube"],
    ["gemini.google.com", "Gemini"],
    ["docs.google.com", "Google Docs"],
    ["fonts.google.com", "Google Fonts"],
    ["translate.google.com", "Google Translate"],
    ["chatgpt.com", "ChatGPT"],
    ["claude.ai", "Claude"],
    ["tally.so", "Tally"],
    ["wikipedia.org", "Wikipedia"],
    ["ptt.cc", "PTT"],
    ["dcard.tw", "Dcard"],
    ["facebook.com", "Facebook"],
    ["instagram.com", "Instagram"],
    ["threads.net", "Threads"],
    ["threads.com", "Threads"],
    ["reddit.com", "Reddit"],
    ["x.com", "X"],
    ["twitter.com", "X"],
    ["netflix.com", "Netflix"],
    ["line.me", "LINE"]
  ];
  function sourceName(url) {
    try {
      let host = new URL(url).hostname.replace(/^(www|m|app)\./, "");
      return SITES.find(([d]) => host === d || host.endsWith("." + d))?.[1] ?? host;
    } catch {
      return "";
    }
  }
  function duration(secs) {
    let m = Math.round(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }
  function buildClaudeExport(words2, logs2, since = 0, saved2 = {}) {
    let now = Date.now(), { rows, savedNow, watches } = exportRows(words2, logs2, since, saved2), lines = [
      `# Chinese Brain export \xB7 ${stamp(now)} \xB7 ${since ? `since ${stamp(since)}` : "everything so far"}`,
      "# Codes as in known-words.txt: K known, L learning, F fresh (met, not studied yet), - not in the list.",
      '# date = the day I set this status \xB7 sentence = where I met the word \xB7 saved = sentences I saved for a card, several joined with " \u2016 "',
      "# was = status before this period (- = new). Only status changes I made are listed.",
      `# ${rows.length} words \xB7 ${[...savedNow.values()].flat().length} saved sentences \xB7 ${watches.length} videos with subtitles (${duration(watches.reduce((n, e) => n + e.secs, 0))})`,
      ["word", "now", "was", "date", "pinyin", "meaning", "sentence", "source", "saved"].join("	")
    ];
    for (let r of rows) {
      let met = shownSentence(r.rec?.ctx ?? [], r.w, saved2[r.w]);
      lines.push(
        [
          r.w,
          code(r.now),
          code(r.was),
          dayKeyLocal(r.date),
          r.rec?.p?.toLowerCase(),
          r.rec?.g,
          met?.text,
          met ? shortSource(met.c.url, met.c.t) : "",
          (savedNow.get(r.w) ?? []).map((x) => x.en ? `${x.zh} \u2014 ${x.en}` : x.zh).join(" \u2016 ")
        ].map((x) => clean(x)).join("	")
      );
    }
    return lines.join(`
`) + `
`;
  }
  function exportCount(words2, logs2, since = 0, saved2 = {}) {
    return exportRows(words2, logs2, since, saved2).rows.length;
  }
  function exportRows(words2, logs2, since, saved2) {
    let now = Date.now(), evs = logs2.filter((e) => e.at > since), watches = evs.filter((e) => e.k === "watch"), byWord = new Map(words2.map((w) => [w.w, w])), before = /* @__PURE__ */ new Map();
    for (let e of evs) e.k === "status" && !before.has(e.w) && before.set(e.w, e.from ?? null);
    let rows = [];
    if (since)
      for (let [w, was] of before) {
        let rec = byWord.get(w), cur = rec?.s ?? null;
        was !== cur && rows.push({ w, now: cur, was, date: rec?.updated ?? now, rec });
      }
    else
      for (let w of words2) rows.push({ w: w.w, now: w.s, was: null, date: w.updated, rec: w });
    let savedNow = /* @__PURE__ */ new Map(), listed = new Set(rows.map((r) => r.w));
    for (let [w, list] of Object.entries(saved2)) {
      let fresh = list.filter((x) => x.at > since);
      if (fresh.length && (savedNow.set(w, fresh), !listed.has(w))) {
        let rec = byWord.get(w);
        rows.push({ w, now: rec?.s ?? null, was: rec?.s ?? null, date: rec?.updated ?? Math.max(...fresh.map((x) => x.at)), rec });
      }
    }
    let order = { K: 0, L: 1, F: 2, "-": 3 };
    return rows.sort((a, b) => order[code(a.now)] - order[code(b.now)] || a.date - b.date), { rows, savedNow, watches };
  }
  function parseWordList(text) {
    let out = [];
    for (let raw of text.split(/\r?\n/)) {
      let line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      let cols = line.split(/\t|,|;/).map((c) => c.trim()), m = /[㐀-鿿豈-﫿]+/.exec(cols[0]) ?? /[㐀-鿿豈-﫿]+/.exec(line);
      if (!m) continue;
      let codeCol = cols.find((c, i) => i > 0 && /^[KLF]$/i.test(c))?.toUpperCase(), s = codeCol === "L" ? "learning" : codeCol === "F" ? "fresh" : "known", dateCol = cols.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)), t = dateCol ? (/* @__PURE__ */ new Date(`${dateCol}T12:00:00`)).getTime() : 0;
      out.push({ w: m[0], s, t });
    }
    return out;
  }

  // src/pages/common.ts
  init_browser_shim();
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  async function saveAs(name, content, type = "text/plain;charset=utf-8") {
    if (!import_browser_polyfill_min.default.downloads?.download)
      return download(name, content, type), !0;
    let url = URL.createObjectURL(new Blob([content], { type }));
    try {
      let id = await import_browser_polyfill_min.default.downloads.download({ url, filename: name, saveAs: !0 });
      return chromeSaved(id, url);
    } catch (e) {
      return URL.revokeObjectURL(url), /cancel/i.test(String(e?.message ?? e)) ? !1 : (download(name, content, type), !0);
    }
  }
  function chromeSaved(id, url) {
    return new Promise((ok) => {
      let done = (d) => {
        d.id !== id || !d.state || d.state.current === "in_progress" || (import_browser_polyfill_min.default.downloads.onChanged.removeListener(done), URL.revokeObjectURL(url), ok(d.state.current === "complete"));
      };
      import_browser_polyfill_min.default.downloads.onChanged.addListener(done);
    });
  }
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    let d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...d.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear() ? {} : { year: "numeric" } });
  }

  // src/pages/vocab.ts
  var STAMPS = [
    ["fresh", "\u65B0", "Fresh"],
    ["learning", "\u5B78", "Learning"],
    ["known", "\u719F", "Known"]
  ], words = [], logs = [], filter = "fresh", PAGE = 120, shown = PAGE, kept = /* @__PURE__ */ new Map(), removed = /* @__PURE__ */ new Map(), removing = /* @__PURE__ */ new Map(), saved = {};
  async function load() {
    let data = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, saved = data.saved ?? {}, render(), renderExportInfo();
  }
  var LABEL = { fresh: "fresh", learning: "learning", known: "known", all: "" }, EMPTY = {
    fresh: "No fresh words. Stamp \u65B0 on a word in the card (press 1) and it lands here.",
    learning: "Nothing in learning yet. Stamp \u5B78 (press 2) on a word you want to study.",
    known: "No known words yet. Stamp \u719F (press 3), or import your known-words.txt below.",
    all: "No words yet. Stamp a word in the card (1 \u65B0, 2 \u5B78, 3 \u719F) and it shows up here."
  };
  function render() {
    let n = (s) => words.filter((w) => w.s === s).length, tab = (f, count, ...label) => h("button", { class: f, "data-f": f, "aria-pressed": String(filter === f) }, ...label, h("b", null, count.toLocaleString("en-US")));
    $("filter").replaceChildren(
      ...STAMPS.map(([s, zh, label]) => tab(s, n(s), h("span", { class: "seal", lang: "zh-Hant" }, zh), h("span", { class: "en" }, label))),
      tab("all", words.length, h("span", null, "All"))
    );
    let q = $("q").value.trim().toLowerCase(), sort = $("sort").value, byWord = new Map(words.map((w) => [w.w, w]));
    for (let [w, rec] of removed) byWord.has(w) || byWord.set(w, rec);
    let matches = (w) => !q || w.w.includes(q) || plain(w.p ?? "").includes(plain(q)) || (w.g ?? "").toLowerCase().includes(q), list = [...byWord.values()].filter((w) => filter === "all" || w.s === filter || kept.has(w.w) || removed.has(w.w)).filter(matches).sort((a, b) => key(b, sort) - key(a, sort));
    $("rows").replaceChildren(...list.slice(0, shown).map(row)), list.length || $("rows").append(emptyState(q, words.filter(matches).length));
    let total = list.filter((w) => words.includes(w) && (filter === "all" || w.s === filter)).length, what = `${q ? "match" : `${LABEL[filter] ? `${LABEL[filter]} ` : ""}word`}${total === 1 ? "" : q ? "es" : "s"}`;
    $("more").textContent = list.length > shown ? `${shown} of ${total.toLocaleString("en-US")} ${what}` : total ? `${total.toLocaleString("en-US")} ${what}` : "", $("showMore").hidden = list.length <= shown;
  }
  function emptyState(q, elsewhere) {
    if (!q) return h("p", { class: "empty" }, EMPTY[filter]);
    if (!elsewhere || filter === "all") return h("p", { class: "empty" }, `Nothing matches \u201C${q}\u201D.`);
    let all = h("button", { class: "link" }, elsewhere === 1 ? "Show it" : `Show all ${elsewhere}`);
    return all.addEventListener("click", () => setFilter("all")), h("p", { class: "empty" }, `No ${LABEL[filter]} words match \u201C${q}\u201D, but ${elsewhere === 1 ? "one word" : `${elsewhere} words`} in your other lists ${elsewhere === 1 ? "does" : "do"}. `, all);
  }
  var key = (w, sort) => sort === "updated" ? kept.get(w.w) ?? w.updated : w[sort], plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f\s']/g, "").toLowerCase();
  function marked(text, word, alt) {
    let esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[臺台]/g, "[\u81FA\u53F0]"), re = new RegExp([word, alt].filter(Boolean).map((x) => esc(x)).join("|"), "g"), out = [], at = 0;
    for (let m of text.matchAll(re))
      out.push(text.slice(at, m.index), h("u", null, m[0])), at = m.index + m[0].length;
    return out.push(text.slice(at)), out.filter((x) => x !== "");
  }
  function headword(w) {
    let chars = [...w.w], syl = w.syl?.length === chars.length ? w.syl : void 0;
    return h(
      "div",
      { class: "hw", lang: "zh-Hant" },
      syl ? null : h("div", { class: "pyline" }, w.p ?? ""),
      h("div", { class: `chars${syl ? "" : " nopy"}`, title: syl ? w.p ?? "" : "" }, ...chars.map((ch, i) => h("span", { class: "ch", "data-py": syl?.[i] ?? "" }, h("b", null, ch))))
    );
  }
  function row(w) {
    let gone = removed.has(w.w) && !words.some((x) => x.w === w.w), shown2 = shownSentence(w.ctx, w.w, saved[w.w], 36), met = shown2 && { c: shown2.c, text: shown2.text.split(" \u2014 ")[0] }, src = null;
    if (met) {
      let c = met.c, line = c.src === "yt" && c.t != null;
      src = h("a", { class: "src", href: line ? `${c.url}&t=${c.t}s` : c.url, target: "_blank", title: c.title || c.url }, line ? `\u25B6 ${clock(c.t)}` : sourceName(c.url));
    }
    let stamps = h(
      "div",
      { class: "stamps", role: "group", "aria-label": "Status" },
      ...STAMPS.map(([s, zh, label]) => {
        let b = h("button", { class: s, title: `${label} (${zh})`, "aria-pressed": String(w.s === s), lang: "zh-Hant" }, zh);
        return b.addEventListener("click", () => setStatus(w, s)), b;
      })
    ), corner;
    return gone ? (corner = h("button", { class: "undo" }, "Undo"), corner.addEventListener("click", () => restore(w))) : (corner = h("button", { class: "x", title: "Remove from the list", "aria-label": `Remove ${w.w} from the list` }, "\xD7"), corner.addEventListener("click", () => remove(w))), h(
      "article",
      { class: `word ${w.s}${gone ? " gone" : ""}`, "data-w": w.w },
      headword(w),
      h(
        "div",
        { class: "txt" },
        w.g ? h("p", { class: "gl" }, w.g) : h("p", { class: "gl none" }, "Not in the dictionary"),
        met ? h("p", { class: "ctx", lang: "zh-Hant" }, ...marked(met.text, w.w, met.c.q), src) : null
      ),
      h("div", { class: "act" }, gone ? corner : stamps, gone ? null : corner, h("span", { class: "when" }, gone ? "Removed" : ago(w.updated)))
    );
  }
  async function setStatus(w, s) {
    w.s !== s && (kept.has(w.w) || kept.set(w.w, w.updated), stampSound(s), w.s = s, w.updated = Date.now(), render(), document.querySelector(`.word[data-w="${CSS.escape(w.w)}"] .stamps .${s}`)?.classList.add("press"), await import_browser_polyfill_min.default.runtime.sendMessage({ type: "setStatus", word: w.w, status: s }));
  }
  async function remove(w) {
    stampSound(null), removed.set(w.w, { ...w, ctx: [...w.ctx], hist: [...w.hist] }), words = words.filter((x) => x.w !== w.w), render();
    let done = (async () => {
      let stored = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "getWord", word: w.w });
      return await import_browser_polyfill_min.default.runtime.sendMessage({ type: "setStatus", word: w.w, status: null }), stored;
    })();
    removing.set(w.w, done), await done;
  }
  async function restore(w) {
    let shown2 = removed.get(w.w) ?? w;
    removed.delete(w.w), words = [...words, shown2], render();
    let { syl: _, ...fallback } = shown2, stored = await removing.get(w.w) ?? fallback;
    removing.delete(w.w), await import_browser_polyfill_min.default.runtime.sendMessage({ type: "importWords", words: [stored], mode: "merge" });
  }
  function setFilter(f) {
    filter = f, kept.clear(), removed.clear(), removing.clear(), shown = PAGE, render();
  }
  async function renderExportInfo() {
    let { lastExportAt } = await import_browser_polyfill_min.default.storage.local.get("lastExportAt"), since = lastExportAt ?? 0, rows = exportCount(words, logs, since, saved), waiting = rows > 0 ? `${rows} word${rows === 1 ? "" : "s"} to send` : "Nothing new to send yet";
    $("lastExport").textContent = since ? `Last export ${ago(since)}. ${waiting}.` : `Nothing exported yet. ${waiting}.`;
  }
  $("q").addEventListener("input", () => {
    shown = PAGE, render();
  });
  $("sort").addEventListener("change", render);
  $("showMore").addEventListener("click", () => {
    shown += PAGE, render();
  });
  function filterFromHash() {
    let f = location.hash.slice(1);
    return ["all", "fresh", "learning", "known"].includes(f) ? (filter = f, !0) : !1;
  }
  filterFromHash();
  window.addEventListener("hashchange", () => {
    filterFromHash() && setFilter(filter);
  });
  $("filter").addEventListener("click", (e) => {
    let b = e.target.closest("button");
    b && setFilter(b.dataset.f);
  });
  async function exportNew(deliver) {
    let at = Date.now(), data = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "allData" });
    words = data.words, logs = data.logs, saved = data.saved ?? {};
    let { lastExportAt } = await import_browser_polyfill_min.default.storage.local.get("lastExportAt"), text = buildClaudeExport(words, logs, lastExportAt ?? 0, saved);
    await deliver(text) && (await import_browser_polyfill_min.default.storage.local.set({ lastExportAt: at }), render(), renderExportInfo());
  }
  var TSV = "text/tab-separated-values;charset=utf-8";
  $("exportNew").addEventListener("click", () => exportNew((text) => saveAs(`chinese-brain-${today()}.tsv`, text, TSV)));
  $("copyNew").addEventListener(
    "click",
    () => exportNew(async (text) => (await navigator.clipboard.writeText(text), $("copyOk").textContent = "Copied", !0))
  );
  $("exportAll").addEventListener("click", async () => {
    let data = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "allData" });
    await saveAs(`chinese-brain-all-${today()}.tsv`, buildClaudeExport(data.words, data.logs, 0, data.saved), TSV);
  });
  $("backup").addEventListener("click", async () => {
    let all = await import_browser_polyfill_min.default.storage.local.get(null);
    download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: "chinese-brain", v: 1, at: Date.now(), data: all }), "application/json");
  });
  $("restore").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    let json = JSON.parse(await f.text());
    if (json.app !== "chinese-brain") return alert("Not a Chinese Brain backup.");
    let recs = Object.entries(json.data).filter(([k]) => k.startsWith("w:")).map(([, v]) => v), n = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "importWords", words: recs, mode: "merge" }), existing = await import_browser_polyfill_min.default.storage.local.get(null), extra = {};
    for (let [k, v] of Object.entries(json.data)) !k.startsWith("w:") && !(k in existing) && (extra[k] = v);
    await import_browser_polyfill_min.default.storage.local.set(extra), alert(`Restored ${n} words.`), load();
  });
  $("knownFile").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    f && ($("knownText").value = await f.text());
  });
  $("knownGo").addEventListener("click", async () => {
    let items = parseWordList($("knownText").value);
    if (!items.length) return;
    let n = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "importList", items }), { lastExportAt } = await import_browser_polyfill_min.default.storage.local.get("lastExportAt");
    lastExportAt || await import_browser_polyfill_min.default.storage.local.set({ lastExportAt: Date.now() });
    let by = (s) => items.filter((i) => i.s === s).length;
    $("knownOk").textContent = `${n} words updated (file: ${by("known")} K, ${by("learning")} L${by("fresh") ? `, ${by("fresh")} F` : ""})`, load();
  });
  var reloadTimer;
  import_browser_polyfill_min.default.storage.onChanged.addListener((ch) => {
    Object.keys(ch).some((k) => k.startsWith("w:") || k.startsWith("sav:")) && (clearTimeout(reloadTimer), reloadTimer = setTimeout(load, 500));
  });
  load();
})();
