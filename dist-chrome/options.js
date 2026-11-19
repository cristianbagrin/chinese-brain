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
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toESM = (mod, isNodeMode, target2) => (target2 = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: !0 }) : target2,
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

  // src/pages/options.ts
  init_browser_shim();

  // src/content/audio.ts
  init_browser_shim();

  // src/platform/compat.ts
  init_browser_shim();
  function audioIn(data) {
    if (typeof data != "string") return data.slice(0);
    let s = atob(data), bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  // src/shared/sounds.ts
  init_browser_shim();
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
  function playStamp(status) {
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
  function playSave() {
    try {
      let ac = audio(), t = ac.currentTime + 5e-3;
      noise(ac, t, 0.02, 0.18, "bandpass", 2400, 1), note(ac, 1320, t, 0.1, 0.06, "triangle"), note(ac, 1980, t + 0.045, 0.12, 0.04, "triangle");
    } catch {
    }
  }

  // src/content/state.ts
  init_browser_shim();

  // src/shared/types.ts
  init_browser_shim();
  var DEFAULT_SETTINGS = {
    hoverMode: "hover",
    altSites: [],
    hoverSites: [],
    disabledSites: [],
    ytEnabled: !0,
    pinyin: !0,
    pron: "zhuyin",
    translation: "blur",
    pauseOnHover: !0,
    clickStamp: "fresh",
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
    return r.pinyin === void 0 && (r.subPinyin !== void 0 || r.cardPinyin !== void 0) && (r.pinyin = r.subPinyin === !0 || r.cardPinyin !== "hover"), r.voice === void 0 && typeof r.azureKey == "string" && r.azureKey && (r.voice = "azure"), r.hoverMode === "shift" && (r.hoverMode = "alt"), r.clickStamp === void 0 && r.autoFreshOnClick === !1 && (r.clickStamp = "off"), delete r.autoFreshOnClick, ["fresh", "learning", "known", "off"].includes(r.clickStamp) || delete r.clickStamp, delete r.subPinyin, delete r.cardPinyin, delete r.markUntracked, r.pron !== "pinyin" && r.pron !== "zhuyin" && delete r.pron, { ...DEFAULT_SETTINGS, ...r };
  }
  function cardMode(s, host) {
    return s.hoverMode === "off" || s.disabledSites.includes(host) ? "off" : s.hoverMode === "hover" ? s.altSites.includes(host) ? "alt" : "hover" : s.hoverSites.includes(host) ? "hover" : "alt";
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/content/state.ts
  var State = class {
    settings = { ...DEFAULT_SETTINGS };
    statuses = /* @__PURE__ */ new Map();
    /** The website this frame is part of (a frame follows its page's switches, as the toolbar menu shows them). */
    host = location.hostname;
    statusesLoaded;
    settingsLoaded;
    listeners = /* @__PURE__ */ new Set();
    constructor() {
      let settings2 = import_browser_polyfill_min.default.storage.local.get("settings").then(({ settings: settings3 }) => {
        this.settings = normalizeSettings(settings3);
      }), host = window === window.top ? void 0 : import_browser_polyfill_min.default.runtime.sendMessage({ type: "siteHost" }).then((h2) => {
        h2 && (this.host = h2);
      }).catch(() => {
      });
      this.settingsLoaded = Promise.all([settings2, host]).then(() => {
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
      return this.siteEnabled() && colorsOn(this.settings, this.host);
    }
    /** How the card opens here: on hover, while holding Option (Alt), or not at all. */
    cardMode() {
      return cardMode(this.settings, this.host);
    }
    siteEnabled() {
      return this.settings.hoverMode !== "off" && !this.settings.disabledSites.includes(this.host);
    }
  }, state = new State();

  // src/content/audio.ts
  function stampSound(status) {
    state.settings.sounds && playStamp(status);
  }
  function saveSound() {
    state.settings.sounds && playSave();
  }
  var clipCache = /* @__PURE__ */ new Map(), playing;
  async function speak(text) {
    let s = state.settings, order = s.voice === "azure" ? ["azure", "google", "system"] : s.voice === "google" ? ["google", "system"] : ["system"], errors = [];
    for (let engine of order)
      try {
        if (engine === "system")
          return speakSystem(text), { engine, errors };
        if (engine === "azure" && !s.azureKey) {
          errors.push("No Azure key yet.");
          continue;
        }
        return await playClip(engine, text), { engine, errors };
      } catch (e) {
        let msg = String(e instanceof Error ? e.message : e);
        errors.push(msg), console.warn(`[chinese-brain] ${engine} voice failed, trying the next one:`, msg);
      }
    return { engine: "system", errors };
  }
  async function playClip(engine, text) {
    let s = state.settings, key = `${engine}|${engine === "azure" ? s.azureVoice : ""}|${s.speechRate}|${text}`, ac = audio(), buf = clipCache.get(key);
    if (!buf) {
      let res = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "tts", engine, text });
      if (!res?.audio) throw new Error(res?.error ?? "no audio");
      buf = await ac.decodeAudioData(audioIn(res.audio)), clipCache.size > 100 && clipCache.clear(), clipCache.set(key, buf);
    }
    stopPlaying(ac);
    let src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = buf;
    let t = ac.currentTime + 0.01, end = t + buf.duration, fade = Math.min(0.04, buf.duration / 4);
    gain.gain.setValueAtTime(0, t), gain.gain.linearRampToValueAtTime(1, t + 8e-3), gain.gain.setValueAtTime(1, end - fade), gain.gain.linearRampToValueAtTime(0, end), src.connect(gain).connect(ac.destination), src.start(t), src.stop(end + 0.02), playing = { src, gain }, src.onended = () => {
      playing?.src === src && (playing = void 0);
    };
  }
  function stopPlaying(ac) {
    if (!playing) return;
    let { src, gain } = playing, t = ac.currentTime;
    gain.gain.cancelScheduledValues(t), gain.gain.setValueAtTime(gain.gain.value, t), gain.gain.linearRampToValueAtTime(0, t + 0.02);
    try {
      src.stop(t + 0.03);
    } catch {
    }
    playing = void 0;
  }
  var voice;
  function pickVoice() {
    let voices = speechSynthesis.getVoices();
    voice = voices.find((v) => /zh[-_]TW/i.test(v.lang) && /meijia|美佳/i.test(v.name)) ?? voices.find((v) => /zh[-_]TW/i.test(v.lang)) ?? voices.find((v) => /taiwan|台灣|臺灣/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("zh"));
  }
  "speechSynthesis" in window && speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
  function speakSystem(text) {
    if (!("speechSynthesis" in window)) return;
    voice || pickVoice(), speechSynthesis.speaking && speechSynthesis.cancel();
    let u = new SpeechSynthesisUtterance(/[。！？.!?]$/.test(text) ? text : text + "\u3002");
    u.lang = "zh-TW", voice && (u.voice = voice), u.rate = state.settings.speechRate, speechSynthesis.speak(u);
  }

  // src/shared/keys.ts
  init_browser_shim();
  var KEY_ACTIONS = {
    fresh: { label: "\u65B0 Fresh", group: "card", key: "1" },
    learning: { label: "\u5B78 Learning", group: "card", key: "2" },
    known: { label: "\u719F Known", group: "card", key: "3" },
    remove: { label: "Remove from your list", group: "card", key: "0" },
    say: { label: "Say it", group: "card", key: "v" },
    images: { label: "Images", group: "card", key: "i" },
    prev: { label: "Previous line", group: "yt", key: "a" },
    replay: { label: "Replay line", group: "yt", key: "s" },
    next: { label: "Next line", group: "yt", key: "d" },
    loop: { label: "Loop line", group: "yt", key: "r" },
    shadow: { label: "Shadowing", group: "yt", key: "q" },
    pinyin: { label: "Pronunciation", group: "yt", key: "p" },
    english: { label: "English line", group: "yt", key: "x" },
    transcript: { label: "Transcript", group: "yt", key: "e" }
  };
  function keyOf(s, action) {
    return s.keys?.[action] ?? KEY_ACTIONS[action].key;
  }
  function keyLabel(key) {
    return key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key.replace(/^Arrow/, "");
  }
  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  function actionFor(s, e, group) {
    let k = keyName(e);
    for (let a of Object.keys(KEY_ACTIONS))
      if (KEY_ACTIONS[a].group === group && keyOf(s, a) === k) return a;
  }

  // src/pages/common.ts
  init_browser_shim();

  // src/shared/time.ts
  init_browser_shim();
  function today() {
    let d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // src/pages/common.ts
  function download(name, content, type = "text/plain;charset=utf-8") {
    let url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement("a");
    a.href = url, a.download = name, document.body.append(a), a.click(), a.remove(), setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  var $ = (id) => document.getElementById(id);
  function ago(t) {
    let s = (Date.now() - t) / 1e3;
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
    let d = new Date(t);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...d.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear() ? {} : { year: "numeric" } });
  }
  var SUPPORT = "chris@cristianbagrin.com", DASHBOARD = "https://chinese.cristianbagrin.com/brain/dashboard", MAC = /Mac|iPhone|iPad/.test(navigator.platform), ALT = MAC ? "\u2325 Option" : "Alt", shortcutLabel = (key) => key ? MAC ? key.replace("Alt", "\u2325 Option").replace("Ctrl", "\u2303 Control").replace("Command", "\u2318") : key : "not set";
  function feedbackLink() {
    let body = `


(Reporting a bug? Say what happened and on which page or video. A screenshot helps a lot.)
--
Chinese Brain ${import_browser_polyfill_min.default.runtime.getManifest().version} \xB7 ${navigator.userAgent}`;
    return `mailto:${SUPPORT}?subject=${encodeURIComponent("Chinese Brain feedback")}&body=${encodeURIComponent(body)}`;
  }

  // src/pages/help.ts
  init_browser_shim();

  // src/pages/help.css
  var help_default = `/*
 * The "?" next to a setting and the short note it opens, right there (help.ts). The note grows out
 * of its "?" (transform-origin follows the trigger), fades in fast and out faster, and can be
 * reversed mid-way: transitions, not keyframes. Pages tune it with --help-* custom properties.
 */
button.help {
  display: inline-grid; place-items: center; flex: none; vertical-align: middle;
  width: 22px; height: 22px; padding: 0; margin: 0 0 0 6px; border: 0; border-radius: 50%;
  background: var(--help-fill, rgba(30, 26, 24, 0.07)); color: var(--help-ink2, #6b635d);
  font: 600 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.12s ease;
  /* A bigger target than it looks (fingers). */
  position: relative;
}
button.help::before { content: ''; position: absolute; inset: -8px; }
button.help:active { transform: scale(0.92); }
button.help[aria-expanded='true'] { background: var(--help-accent, #c8202f); color: #fff; }
@media (hover: hover) and (pointer: fine) {
  button.help:hover:not([aria-expanded='true']) { background: var(--help-fill2, rgba(30, 26, 24, 0.12)); color: var(--help-ink, #1e1a18); }
}
button.help:focus-visible { outline: 2px solid var(--help-accent, #c8202f); outline-offset: 2px; }

.help-pop {
  position: fixed; inset: auto; margin: 0; box-sizing: border-box;
  width: max-content; max-width: min(300px, calc(100vw - 16px)); padding: 12px 14px;
  border: 0; border-radius: 12px; background: var(--help-bg, #fff); color: var(--help-ink, #1e1a18);
  box-shadow: 0 0 0 1px rgba(30, 26, 24, 0.08), 0 12px 32px -8px rgba(30, 26, 24, 0.28), 0 2px 6px rgba(30, 26, 24, 0.06);
  font: 400 14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; text-align: left;
  letter-spacing: normal; text-transform: none; white-space: normal; overflow-wrap: break-word;
  opacity: 1; transform: none;
  transition: opacity 0.15s cubic-bezier(0.23, 1, 0.32, 1), transform 0.2s cubic-bezier(0.23, 1, 0.32, 1),
    overlay 0.2s allow-discrete, display 0.2s allow-discrete;
}
.help-pop:not(:popover-open) { opacity: 0; transform: scale(0.96); transition-duration: 0.1s, 0.12s, 0.12s, 0.12s; }
@starting-style { .help-pop:popover-open { opacity: 0; transform: scale(0.96); } }
.help-pop p { margin: 0; }
.help-pop p + p, .help-pop p + ul, .help-pop ul + p { margin-top: 8px; }
.help-pop ul { margin: 0; padding-left: 18px; }
.help-pop b, .help-pop strong { font-weight: 600; }
.help-pop a { color: var(--help-link, #a3192a); font-weight: 500; }
.help-pop code, .help-pop kbd { font: 500 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 1px 4px; border-radius: 4px; background: var(--help-fill, rgba(30, 26, 24, 0.07)); }
.help-pop [lang='zh-Hant'] { font-size: 1.08em; }

@media (prefers-reduced-motion: reduce) {
  .help-pop, .help-pop:not(:popover-open) { transform: none; }
  @starting-style { .help-pop:popover-open { transform: none; } }
}
`;

  // src/pages/help.ts
  function helpPopovers(root = document) {
    document.adoptedStyleSheets.includes(sheet) || (sheet.replaceSync(help_default), document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]);
    for (let pop of root.querySelectorAll(".help-pop[popover]")) {
      if (pop.dataset.ready) continue;
      pop.dataset.ready = "1";
      let trigger = document.querySelector(`[popovertarget="${pop.id}"]`);
      if (!trigger) continue;
      pop.hasAttribute("aria-label") || pop.setAttribute("aria-label", trigger.getAttribute("aria-label") ?? "Help"), pop.setAttribute("role", "dialog");
      let raf = 0, place2 = () => {
        cancelAnimationFrame(raf), raf = requestAnimationFrame(() => position(pop, trigger));
      };
      pop.addEventListener("beforetoggle", (e) => {
        let open = e.newState === "open";
        trigger.setAttribute("aria-expanded", String(open)), open ? (place2(), addEventListener("scroll", place2, { capture: !0, passive: !0 }), addEventListener("resize", place2)) : (removeEventListener("scroll", place2, { capture: !0 }), removeEventListener("resize", place2));
      }), trigger.setAttribute("aria-expanded", "false");
    }
  }
  var sheet = new CSSStyleSheet(), GAP = 8, EDGE = 8;
  function position(pop, trigger) {
    let t = trigger.getBoundingClientRect(), w = pop.offsetWidth, h2 = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = innerHeight, below = t.bottom + GAP + h2 <= vh - EDGE || t.top - GAP - h2 < EDGE, top = below ? t.bottom + GAP : t.top - GAP - h2, left = Math.max(EDGE, Math.min(t.left - 10, vw - EDGE - w));
    pop.style.top = `${Math.round(top)}px`, pop.style.left = `${Math.round(left)}px`, pop.style.transformOrigin = `${Math.round(t.left + t.width / 2 - left)}px ${below ? 0 : h2}px`;
  }

  // src/content/popup.ts
  init_browser_shim();

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

  // src/shared/dict.ts
  init_browser_shim();
  var CJK = /[㐀-䶿一-鿿豈-﫿]/;

  // src/shared/zhuyin.ts
  init_browser_shim();

  // src/shared/pinyin.ts
  init_browser_shim();
  var MARKS = {
    a: ["\u0101", "\xE1", "\u01CE", "\xE0", "a"],
    e: ["\u0113", "\xE9", "\u011B", "\xE8", "e"],
    i: ["\u012B", "\xED", "\u01D0", "\xEC", "i"],
    o: ["\u014D", "\xF3", "\u01D2", "\xF2", "o"],
    u: ["\u016B", "\xFA", "\u01D4", "\xF9", "u"],
    \u00FC: ["\u01D6", "\u01D8", "\u01DA", "\u01DC", "\xFC"]
  };
  function syllableToMarked(syl) {
    let m = /^([a-zA-Z:üÜ]+)([1-5])$/.exec(syl);
    if (!m) return syl.toLowerCase();
    let [, raw, toneStr] = m, tone = Number(toneStr) - 1, base = raw.toLowerCase().replace(/u:/g, "\xFC").replace(/v/g, "\xFC"), idx = base.search(/[ae]/);
    if (idx < 0 && (idx = base.indexOf("ou")), idx < 0) {
      for (let i = base.length - 1; i >= 0; i--)
        if ("aeiou\xFC".includes(base[i])) {
          idx = i;
          break;
        }
    }
    if (idx < 0) return base;
    let marked = MARKS[base[idx]][tone];
    return base.slice(0, idx) + marked + base.slice(idx + 1);
  }
  function numberedToMarked(py, joined = !0) {
    let sylls = py.split(/\s+/).filter(Boolean).map(syllableToMarked);
    return joined ? sylls.reduce((acc, s, i) => i > 0 && /^[aeoāáǎàēéěèōóǒò]/i.test(s) ? acc + "'" + s : acc + s, "") : sylls.join(" ");
  }

  // src/shared/zhuyin.ts
  var INITIALS = {
    b: "\u3105",
    p: "\u3106",
    m: "\u3107",
    f: "\u3108",
    d: "\u3109",
    t: "\u310A",
    n: "\u310B",
    l: "\u310C",
    g: "\u310D",
    k: "\u310E",
    h: "\u310F",
    j: "\u3110",
    q: "\u3111",
    x: "\u3112",
    zh: "\u3113",
    ch: "\u3114",
    sh: "\u3115",
    r: "\u3116",
    z: "\u3117",
    c: "\u3118",
    s: "\u3119"
  }, FINALS = {
    a: "\u311A",
    o: "\u311B",
    e: "\u311C",
    \u00EA: "\u311D",
    ai: "\u311E",
    ei: "\u311F",
    ao: "\u3120",
    ou: "\u3121",
    an: "\u3122",
    en: "\u3123",
    ang: "\u3124",
    eng: "\u3125",
    ong: "\u3128\u3125",
    er: "\u3126",
    i: "\u3127",
    ia: "\u3127\u311A",
    io: "\u3127\u311B",
    ie: "\u3127\u311D",
    iai: "\u3127\u311E",
    iao: "\u3127\u3120",
    iou: "\u3127\u3121",
    ian: "\u3127\u3122",
    in: "\u3127\u3123",
    iang: "\u3127\u3124",
    ing: "\u3127\u3125",
    iong: "\u3129\u3125",
    u: "\u3128",
    ua: "\u3128\u311A",
    uo: "\u3128\u311B",
    uai: "\u3128\u311E",
    uei: "\u3128\u311F",
    uan: "\u3128\u3122",
    uen: "\u3128\u3123",
    uang: "\u3128\u3124",
    ueng: "\u3128\u3125",
    \u00FC: "\u3129",
    \u00FCe: "\u3129\u311D",
    \u00FCan: "\u3129\u3122",
    \u00FCn: "\u3129\u3123"
  }, WHOLE = { er: "\u3126", m: "\u3107", n: "\u3123", ng: "\u312B", hm: "\u310F\u3107", hng: "\u310F\u312B", \u00EA: "\u311D", eh: "\u311D" }, BUZZ = /* @__PURE__ */ new Set(["zh", "ch", "sh", "r", "z", "c", "s"]), PALATAL = /* @__PURE__ */ new Set(["j", "q", "x"]), TONE_MARK = ["", "", "\u02CA", "\u02C7", "\u02CB", "\u02D9"];
  function zhuyinLetters(raw) {
    let s = raw.toLowerCase().replace(/u:|v/g, "\xFC");
    if (WHOLE[s]) return WHOLE[s];
    let yw = s[0] === "y" || s[0] === "w";
    s[0] === "y" ? s = s.startsWith("yu") ? `\xFC${s.slice(2)}` : s.startsWith("yi") ? s.slice(1) : `i${s.slice(1)}` : s[0] === "w" && (s = s.startsWith("wu") ? s.slice(1) : `u${s.slice(1)}`);
    let m = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])?([a-zü]*)$/.exec(s);
    if (!m) return null;
    let ini = m[1] ?? "", fin = m[2];
    if (!fin) return null;
    if (BUZZ.has(ini) && fin === "i") return INITIALS[ini];
    PALATAL.has(ini) && fin[0] === "u" && (fin = `\xFC${fin.slice(1)}`), ini && (fin = fin === "iu" ? "iou" : fin === "ui" ? "uei" : fin === "un" ? "uen" : fin === "ue" ? "\xFCe" : fin);
    let z = FINALS[fin];
    return z ? ini ? allowed(ini, fin) ? INITIALS[ini] + z : null : /^[iuü]/.test(fin) === yw && fin !== "ong" ? z : null : null;
  }
  function allowed(ini, fin) {
    let iFinal = fin[0] === "i", uFinal = fin[0] === "u", \u00FCFinal = fin[0] === "\xFC";
    return fin === "er" || fin === "\xEA" || fin === "iai" || fin === "io" ? !1 : PALATAL.has(ini) ? iFinal || \u00FCFinal : \u00FCFinal ? (ini === "n" || ini === "l") && (fin === "\xFC" || fin === "\xFCe") : fin === "ia" ? /^[bpdl]$/.test(ini) : iFinal ? /^[bpmdtnl]$/.test(ini) && fin !== "iong" : fin === "o" ? /^[bpmfl]$/.test(ini) : fin === "ueng" ? !1 : uFinal && /^[bpmf]$/.test(ini) ? fin === "u" : !0;
  }
  function parseNumbered(syl) {
    let m = /^([a-zA-Z:üÜêÊ]+)([1-5])$/.exec(syl.trim());
    if (!m) return null;
    let base = m[1].toLowerCase(), tone = Number(m[2]);
    if (base === "r") return { letters: "", tone, er: !0 };
    let z = zhuyinLetters(base);
    if (z) return { letters: z, tone, er: !1 };
    if (base.length > 2 && base.endsWith("r")) {
      let b = zhuyinLetters(base.slice(0, -1));
      if (b) return { letters: b, tone, er: !0 };
    }
    return null;
  }
  function syllableToZhuyin(syl) {
    let p = parseNumbered(syl);
    if (!p) return syl;
    if (!p.letters) return "\u3126";
    let body = p.tone === 5 ? `\u02D9${p.letters}` : p.letters + TONE_MARK[p.tone];
    return p.er ? `${body}\u3126` : body;
  }
  function numberedToZhuyin(py) {
    let out = [];
    for (let s of py.split(/\s+/).filter(Boolean))
      /^r[1-5]$/i.test(s) && out.length ? out[out.length - 1] += "\u3126" : out.push(syllableToZhuyin(s));
    return out.join(" ");
  }
  function zhuyinParts(syl) {
    let p = parseNumbered(syl);
    return p ? p.letters ? { letters: p.tone === 5 ? `\u02D9${p.letters}` : p.letters, tone: p.tone === 5 ? "" : TONE_MARK[p.tone], er: p.er ? "\u3126" : "" } : { letters: "\u3126", tone: "", er: "" } : null;
  }
  function pron(numbered, mode, joined = !0) {
    return mode === "zhuyin" ? numberedToZhuyin(numbered) : numberedToMarked(numbered, joined);
  }
  function zhuyinWord(word, numbered, doc = document) {
    let chars = [...word], sylls = numbered.split(/\s+/).filter(Boolean);
    if (chars.length !== sylls.length) return null;
    let parts = sylls.map(zhuyinParts);
    if (parts.some((p) => !p)) return null;
    let box = doc.createElement("span");
    return box.className = "zyw over", chars.forEach((ch, i) => box.append(zhuyinChar(ch, parts[i], doc))), box;
  }
  function zhuyinChar(ch, p, doc = document) {
    let c = doc.createElement("span");
    return c.className = "zy", c.dataset.over = p.letters + p.tone + p.er, c.textContent = ch, c;
  }

  // src/content/bridge.ts
  init_browser_shim();
  function signal(did) {
    location.origin === "https://chinese.cristianbagrin.com" && window === window.top && window.postMessage({ cb: "did", did }, location.origin);
  }

  // src/content/keys.ts
  init_browser_shim();
  function target(e) {
    return e.composedPath?.()[0] ?? e.target;
  }
  function inOwnBox(e) {
    return !!target(e)?.hasAttribute?.("data-typing");
  }

  // src/content/lookup.ts
  init_browser_shim();
  var cache = /* @__PURE__ */ new Map();
  async function lookupText(text) {
    let key = text.slice(0, 8), hit = cache.get(key);
    if (hit) return hit;
    let res = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "lookup", text: key });
    return cache.size > 300 && cache.clear(), cache.set(key, res), res;
  }

  // src/content/popup.css
  var popup_default = `:host {
  all: initial;
  --bg: #fffdf9;
  --bg2: #f6f2ed;
  --line: #e9e1d7;
  --text: #1e1a18;
  --text2: #5e5650;
  --text3: #958c85;
  --fresh: #ef2f42;
  --learning: #ffc81f;
  --known: #1fae4f;
  --fresh-mark: #ffd3d8;
  --learning-mark: #ffe680;
  --known-mark: #c9eed5;
  --link: #a3192a;
  --sans: -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif;
}

/* Sizes are in em of the card's 14px (16px when large), so the whole card scales together. */
.card {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  width: max-content;
  min-width: 17em;
  max-width: min(30em, calc(100vw - 16px));
  max-height: min(72vh, 40em);
  overflow-x: hidden;
  overflow-y: auto;
  overflow-wrap: anywhere;
  overscroll-behavior: contain;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 10px;
  font: 14px/1.45 var(--sans);
  box-shadow: 0 8px 28px rgba(30, 26, 24, 0.16), 0 1px 3px rgba(30, 26, 24, 0.08);
  text-align: left;
  pointer-events: auto;
  scrollbar-width: thin;
}
.card.large { font-size: 16px; }
.card[hidden] { display: none; }

.top { position: relative; padding: 0.86em 1.15em 0.7em; }
.headrow { display: flex; align-items: baseline; gap: 0.85em; flex-wrap: wrap; }
.head { font: 600 2.15em/1.15 var(--sans); letter-spacing: 0.02em; padding: 0 3px; margin: 0 -3px; border-radius: 4px; }
.head.long { font-size: 1.35em; line-height: 1.35; letter-spacing: 0.01em; }
.headrow .copy, .headrow .say { align-self: center; }
.mt { color: var(--text3); font-size: 0.8em; margin-left: 0.5em; }
.head.st-fresh { background: var(--fresh-mark); }
.head.st-learning { background: var(--learning-mark); }
.head.st-known { background: var(--known-mark); }
.py { font-size: 1.07em; color: var(--text3); letter-spacing: 0.01em; }
/* Zhuyin over each character: the headword, a long phrase (it wraps), the parts and measure words. */
.head.zyhead { display: inline-block; padding-top: 0.12em; --zy: 0.42em; --zy-ink: var(--text2); }
.head.long.zyhead { --zy: 0.7em; }
.chars .w .zyw, .cl .w .zyw { --zy: 0.66em; --zy-ink: var(--text2); }
.cl .w:has(.zyw) { font-size: 1.3em; }
.chars:has(.zyw) { row-gap: 0.5em; }

/* How common the word is, in words (the tooltip says what that means for you). */
.freq { margin-left: auto; display: flex; align-items: center; gap: 0.45em; font-size: 0.86em; color: var(--text3); white-space: nowrap; cursor: default; }
.bars { display: inline-flex; gap: 2px; align-items: flex-end; height: 0.9em; }
.bars i { width: 3px; background: var(--line); border-radius: 1px; }
.bars i:nth-child(1) { height: 30%; }
.bars i:nth-child(2) { height: 47%; }
.bars i:nth-child(3) { height: 64%; }
.bars i:nth-child(4) { height: 82%; }
.bars i:nth-child(5) { height: 100%; }
.bars i.on { background: var(--link); }
.freq.f5, .freq.f4 { color: var(--link); }

.defs { margin-top: 0.43em; color: var(--text); }
.defs .sep { color: var(--text3); padding: 0 0.43em; }
.reading + .reading { margin-top: 0.43em; }
.reading .rpy { color: var(--text2); margin-right: 0.57em; }
.cl { margin-top: 0.3em; font-size: 0.93em; color: var(--text2); }

.sect { border-top: 1px solid var(--line); padding: 0.57em 1.15em; }
.chars { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 0.2em 0.7em; align-items: baseline; }
.chars .cw { white-space: nowrap; }
.chars .cw.d2 { padding-left: 0.85em; }
.chars .cw.d3 { padding-left: 1.7em; }
.chars .cw.d1::before, .chars .cw.d2::before, .chars .cw.d3::before { content: '\u2514'; color: var(--text3); opacity: 0.5; margin-right: 0.15em; font-size: 0.85em; }
.chars .cpy { color: var(--text3); font-size: 0.86em; white-space: nowrap; }
.chars .cg { color: var(--text2); font-size: 0.93em; line-height: 1.4; }

.ex { margin: 0; padding: 0; list-style: none; }
.ex li + li { margin-top: 0.36em; }
.ex .zh { font-size: 1.07em; }
.say { all: unset; cursor: pointer; display: inline-grid; place-items: center; width: 1.3em; height: 1.3em; margin-left: 0.25em; vertical-align: middle; border-radius: 50%; color: var(--text3); }
.say:hover { color: var(--link); background: var(--bg2); }
.say svg { width: 0.95em; height: 0.95em; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linejoin: round; stroke-linecap: round; }
.say svg path { fill: none; }
.copy { all: unset; cursor: pointer; display: inline-grid; place-items: center; width: 1.3em; height: 1.3em; vertical-align: middle; border-radius: 50%; color: var(--text3); }
.copy:hover { color: var(--link); background: var(--bg2); }
.copy svg { width: 0.85em; height: 0.85em; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.copy.done { color: var(--known); }
.save { all: unset; cursor: pointer; display: inline-grid; place-items: center; width: 1.3em; height: 1.3em; vertical-align: middle; border-radius: 50%; color: var(--text3); }
.save:hover { color: var(--link); background: var(--bg2); }
.save svg { width: 0.9em; height: 0.9em; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; }
.save.on { color: var(--link); }
.save.on svg { fill: currentColor; }
.edit { all: unset; cursor: pointer; display: inline-grid; place-items: center; width: 1.3em; height: 1.3em; vertical-align: middle; border-radius: 50%; color: var(--text3); }
.edit:hover { color: var(--link); background: var(--bg2); }
.edit svg { width: 0.85em; height: 0.85em; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linejoin: round; stroke-linecap: round; }
.editbox { all: unset; box-sizing: border-box; display: block; width: 100%; min-width: 15em; padding: 0.3em 0.45em; border: 1px solid var(--link); border-radius: 6px; background: var(--bg); color: var(--text); font: inherit; font-size: 1.07em; line-height: 1.5; white-space: pre-wrap; resize: vertical; }
.editbox.editen { margin-top: 0.3em; font-size: 0.89em; color: var(--text2); }
.editbox.editen::placeholder { color: var(--text3); }
.editbar { display: flex; align-items: center; gap: 0.6em; margin-top: 0.3em; }
.editsave, .editcancel { all: unset; cursor: pointer; font-size: 0.89em; padding: 0.1em 0.6em; border-radius: 5px; }
.editsave { background: var(--link); color: #fff; }
.editcancel { color: var(--text2); }
.editcancel:hover { background: var(--bg2); }
.edithint { margin-left: auto; font-size: 0.79em; color: var(--text3); }
.del { all: unset; cursor: pointer; display: inline-grid; place-items: center; width: 1.2em; height: 1.2em; margin-left: 0.1em; vertical-align: middle; border-radius: 50%; color: var(--text3); font-size: 0.95em; line-height: 1; opacity: 0; transition: opacity 0.12s; }
/* The sentence buttons share one line: centered on the Chinese, whatever the icon's size. */
.ex li > :is(.say, .copy, .save, .edit, .del) { position: relative; top: -0.12em; }
.ex li:hover .del { opacity: 1; }
.del:hover { color: var(--fresh); background: var(--bg2); }
.ex li.gone { opacity: 0.35; pointer-events: none; }
.ex .en { display: block; font-size: 0.89em; color: var(--text2); }
.label { font-size: 0.86em; font-weight: 600; color: var(--text2); margin-bottom: 0.3em; }
.gem { all: unset; cursor: pointer; font-size: 0.89em; color: var(--link); }
.gem:hover { text-decoration: underline; }
.gem[disabled] { cursor: default; color: var(--text3); text-decoration: none; }
.gemrow .err { font-size: 0.86em; color: var(--fresh); margin-top: 0.2em; }

/* The footer keeps one compact size, also on the large card. */
.foot { font-size: 12px; display: flex; align-items: center; gap: 0.7em; padding: 0.55em 0.85em 0.85em 1em; border-top: 1px solid var(--line); background: var(--bg2); overflow: clip; }
.stamps { display: flex; gap: 0.57em; }
.stamp {
  all: unset;
  cursor: pointer;
  box-sizing: border-box;
  position: relative;
  width: 2.57em;
  height: 2.57em;
  border-radius: 0.5em;
  display: grid;
  place-items: center;
  border: 1.5px dashed var(--line);
  background: var(--bg);
  font: 600 1.15em/1 var(--sans);
  color: var(--text2);
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.12s, border-color 0.12s, color 0.12s;
}
.stamp small { position: absolute; right: -3px; bottom: -3px; font: 600 8.5px/1 var(--sans); color: var(--text3); background: var(--bg2); padding: 1px 2px; border-radius: 3px; }
.stamp:hover { border-style: solid; color: var(--text); }
/* Pressing answers at once; the springy curve is only for letting go. */
.stamp:active { transform: scale(0.9); transition-duration: 0.05s; }
.stamp.on:active { transform: rotate(-6deg) scale(0.9); }
.stamp.fresh { border-color: color-mix(in srgb, var(--fresh) 45%, var(--line)); }
.stamp.learning { border-color: color-mix(in srgb, var(--learning) 75%, var(--line)); }
.stamp.known { border-color: color-mix(in srgb, var(--known) 45%, var(--line)); }
/* A stamp that's set looks like a seal: filled, a thin inner frame, a little crooked. */
.stamp.on { transform: rotate(-6deg); color: #fff; border-style: solid; }
.stamp.fresh.on { background: var(--fresh); border-color: var(--fresh); box-shadow: inset 0 0 0 2px var(--fresh), inset 0 0 0 3px rgba(255, 255, 255, 0.6); }
.stamp.learning.on { background: var(--learning); border-color: var(--learning); color: var(--text); box-shadow: inset 0 0 0 2px var(--learning), inset 0 0 0 3px rgba(255, 255, 255, 0.6); }
.stamp.known.on { background: var(--known); border-color: var(--known); box-shadow: inset 0 0 0 2px var(--known), inset 0 0 0 3px rgba(255, 255, 255, 0.6); }
/*
 * Stamping lands on the first frame, with the thud: pressed flat, then the rubber springs back
 * while a ring of ink spreads from under it.
 */
.stamp.pop { animation: pop 0.34s cubic-bezier(0.2, 0.8, 0.3, 1); }
.stamp.pop::after { content: ''; position: absolute; inset: -1.5px; border-radius: inherit; border: 2px solid var(--ink, currentColor); pointer-events: none; animation: ink 0.4s cubic-bezier(0.2, 0.7, 0.3, 1) forwards; }
.stamp.fresh { --ink: var(--fresh); }
.stamp.learning { --ink: var(--learning); }
.stamp.known { --ink: var(--known); }
@keyframes pop {
  0% { transform: rotate(-9deg) scale(0.86); }
  40% { transform: rotate(-5deg) scale(1.05); }
  100% { transform: rotate(-6deg) scale(1); }
}
@keyframes ink {
  from { opacity: 0.6; transform: scale(1); }
  to { opacity: 0; transform: scale(1.4); }
}
@media (prefers-reduced-motion: reduce) {
  .stamp { transition: background 0.12s, border-color 0.12s, color 0.12s; }
  .stamp.pop, .stamp.pop::after { animation: none; }
  .stamp.pop::after { display: none; }
}
.tools { margin-left: auto; display: flex; gap: 0.85em; font-size: 12.5px; }
.tools button { all: unset; cursor: pointer; color: var(--link); }
.tools kbd { font: inherit; color: var(--text3); margin-left: 3px; }

/* Every Chinese word in the card is clickable; a quiet underline on hover, plus a small hint. */
.w { cursor: pointer; border-radius: 3px; }
.w:hover { text-decoration: underline; text-decoration-color: var(--text3); text-underline-offset: 3px; }
.w.st-fresh { background: var(--fresh-mark); }
.w.st-learning { background: var(--learning-mark); }
.w.st-known { background: var(--known-mark); }
.ex .w.hw, .ex .w .hwp { box-shadow: inset 0 -2px 0 var(--learning); }
.chars .w.c { font-size: 1.36em; padding: 0 2px; }
.nav { display: flex; gap: 2px; margin: -0.3em 0 0.2em -0.4em; }
.nav button { all: unset; cursor: pointer; font-size: 0.93em; line-height: 1; color: var(--text2); padding: 3px 6px; border-radius: 4px; }
.nav button:hover { color: var(--text); background: var(--bg2); }
.nav button[disabled] { color: var(--line); cursor: default; background: none; }

/* The word hint: read-only, never in the way (the pointer passes straight through it). */
.hint {
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
  max-width: 22em;
  padding: 0.25em 0.6em 0.3em;
  border-radius: 6px;
  background: var(--text);
  color: #fff;
  font: 12px/1.3 var(--sans);
  box-shadow: 0 3px 10px rgba(30, 26, 24, 0.25);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hint.large { font-size: 13px; }
.hint[hidden] { display: none; }
.hint .hg, .hint .hpy { overflow: hidden; text-overflow: ellipsis; }
.hint .hpy { color: #e3d8cc; font-size: 0.82em; }
`;

  // src/shared/zhuyin.css
  var zhuyin_default = `/*
 * Zhuyin over each character (.zyw.over), on one line, centered, like ruby: the card's headword
 * and parts, the website's demo and Dashboard lists. Drawn from data attributes (src/shared/zhuyin.ts,
 * zhuyinChar), so the element's text stays the character. Size it with --zy (the letters' size, in
 * em of the character); color with --zy-ink. Each character is an inline block whose baseline is the
 * character's, so it sits in a line of text like any word, and a long phrase wraps.
 */
.zyw .zy { display: inline-block; text-align: center; text-indent: 0; }
/* A little air between characters, so each syllable reads as its own (zhuyin runs wider than a character). */
.zyw .zy + .zy { margin-left: 0.14em; }
.zyw .zy::before {
  content: attr(data-over);
  display: block;
  margin-bottom: 0.3em;
  font-size: var(--zy, 0.42em);
  font-weight: 500;
  font-style: normal;
  color: var(--zy-ink, currentColor);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: -0.06em;
}
`;

  // src/content/popup.ts
  var STAMPS = [
    { s: "fresh", zh: "\u65B0", label: "Fresh" },
    { s: "learning", zh: "\u5B78", label: "Learning" },
    { s: "known", zh: "\u719F", label: "Known" }
  ];
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var readAs = (numbered, joined = !0) => pron(numbered, state.settings.pron, joined), zyOver = (word, numbered) => state.settings.pron === "zhuyin" ? zhuyinWord(word, numbered) : null;
  function prettyDef(d) {
    return d.replace(/([^\s\[|,;(]+)(?:\|([^\s\[,;]+))?\[([a-zA-Z0-9: ]+)\]/g, (_, t, _s, p) => `${t} ${readAs(p)}`);
  }
  var FREQ = [
    { min: 52, bars: 5, label: "essential", tip: "One of the words you'll meet every day. Learn it now." },
    { min: 45, bars: 4, label: "very common", tip: "Comes up all the time in speech and writing. Worth learning soon." },
    { min: 40, bars: 3, label: "common", tip: "You'll meet it regularly in shows, news and conversation." },
    { min: 33, bars: 2, label: "less common", tip: "Shows up now and then. Learn it if it keeps coming back." },
    { min: 1, bars: 1, label: "rare", tip: "Rarely used. Fine to skip for now." }
  ];
  function frequency(zipf) {
    return FREQ.find((f) => zipf >= f.min);
  }
  function mainSense(e) {
    let d = e.defs.find((x) => !x.startsWith("CL:") && !/^(old )?variant of|^see /i.test(x)) ?? e.defs[0] ?? "", first = prettyDef(d).split(/;\s*/)[0];
    return first.length > 60 ? first.slice(0, 58) + "\u2026" : first;
  }
  var OWN_WORD = /^[㐀-䶿一-鿿豈-﫿]{2,8}$/;
  function stampable(m) {
    return !m.phrase || OWN_WORD.test(m.word);
  }
  async function copyText(text) {
    try {
      return await navigator.clipboard.writeText(text), !0;
    } catch {
      let ta = document.createElement("textarea");
      ta.value = text, ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0", document.documentElement.append(ta), ta.select();
      let ok = document.execCommand("copy");
      return ta.remove(), ok;
    }
  }
  function place(el, x, y) {
    el.style.left = `${x}px`, el.style.top = `${y}px`;
    let b = el.getBoundingClientRect();
    Math.abs(b.left - x) > 0.5 && (el.style.left = `${2 * x - b.left}px`), Math.abs(b.top - y) > 0.5 && (el.style.top = `${2 * y - b.top}px`);
  }
  var MODAL = 'dialog:modal, [aria-modal="true"], tp-yt-paper-dialog, paper-dialog';
  function modalAt(rect) {
    let starts = [];
    if (rect) {
      let el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      for (; el?.shadowRoot; ) {
        let inner = el.shadowRoot.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!inner || inner === el) break;
        el = inner;
      }
      starts.push(el);
    }
    let a = document.activeElement;
    for (; a?.shadowRoot?.activeElement; ) a = a.shadowRoot.activeElement;
    starts.push(a);
    for (let start of starts)
      for (let n = start; n; n = n instanceof ShadowRoot ? n.host : n.parentNode)
        if (n instanceof Element && n.localName !== "chinese-brain-popup" && safeMatches(n, MODAL)) return n;
    return null;
  }
  function safeMatches(el, sel) {
    try {
      return el.matches(sel);
    } catch {
      return el.matches(sel.replace("dialog:modal, ", "dialog[open], "));
    }
  }
  function fitBox(box) {
    if (!box.isConnected || !box.offsetHeight) return;
    box.style.height = "auto";
    let border = box.offsetHeight - box.clientHeight;
    box.style.height = `${box.scrollHeight + border}px`;
  }
  function inTriangle(p, a, b, c, pad) {
    let side = (u, v, w, q) => {
      let len = Math.hypot(v.x - u.x, v.y - u.y) || 1, sq = (v.x - u.x) * (q.y - u.y) - (v.y - u.y) * (q.x - u.x), sw = (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
      return sq * Math.sign(sw || 1) >= -pad * len;
    };
    return side(a, b, c, p) && side(b, c, a, p) && side(c, a, b, p);
  }
  function inTrapezoid(p, from, to, lo0, hi0, lo1, hi1, q, pad) {
    let len = Math.abs(to - from), t = (p - from) * (to >= from ? 1 : -1);
    if (t <= 0 || t > len + pad) return !1;
    let f = len ? Math.min(1, t / len) : 0;
    return q >= lo0 + (lo1 - lo0) * f - pad && q <= hi0 + (hi1 - hi0) * f + pad;
  }
  var Popup = class {
    host;
    root;
    card;
    /** The small, non-interactive hint over words inside the card. */
    hint;
    hintSeq = 0;
    opts;
    info;
    gemState;
    editing;
    /** The word the card belongs to, for the corridor between them (gone after a scroll). */
    anchor;
    px = -1;
    py = -1;
    /** The last point where the pointer was on the word: the tip of the "safe triangle" to the card. */
    exit;
    shownAt = 0;
    hovered = !1;
    /** Cards visited by clicking words inside the card, and where we are in them (← →). */
    trail = [];
    pos = 0;
    /** The word inside the card under the pointer: shortcuts act on it while it is hovered. */
    hoverWord;
    lookTimer;
    softTimer;
    /** A hide is counting down (moving on doesn't restart it, so leaving is quick). */
    hiding = !1;
    hideListeners = /* @__PURE__ */ new Set();
    infoCache = /* @__PURE__ */ new Map();
    constructor() {
      this.host = document.createElement("chinese-brain-popup"), this.root = this.host.attachShadow({ mode: "closed" });
      let style = document.createElement("style");
      style.textContent = zhuyin_default + popup_default, this.card = h("div", { class: "card", hidden: "" }), this.hint = h("div", { class: "hint", hidden: "" }), this.root.append(style, this.card, this.hint), document.addEventListener(
        "mousemove",
        (e) => {
          this.px = e.clientX, this.py = e.clientY;
          let a = this.anchor;
          a && e.clientX >= a.left - 2 && e.clientX <= a.right + 2 && e.clientY >= a.top - 2 && e.clientY <= a.bottom + 2 && (this.exit = { x: e.clientX, y: e.clientY });
        },
        { capture: !0, passive: !0 }
      ), this.card.addEventListener("mouseover", (e) => {
        let w = e.target.closest(".w");
        this.hoverWord = w?.dataset.q ? { q: w.dataset.q, sentence: w.closest("li")?.querySelector(".zh")?.textContent ?? "" } : void 0, w && !w.classList.contains("c") ? this.showHint(w) : this.hideHint();
      }), this.card.addEventListener("mouseout", (e) => {
        let w = e.target.closest(".w");
        w && !w.contains(e.relatedTarget) && this.hideHint();
      }), this.card.addEventListener("scroll", () => this.hideHint(), { passive: !0 });
      for (let t of ["mousedown", "mouseup", "dblclick", "pointerdown", "pointerup"]) this.card.addEventListener(t, (e) => e.stopPropagation());
      this.card.addEventListener("click", (e) => {
        e.stopPropagation(), this.onCardClick(e);
      }), this.card.addEventListener("mouseenter", () => {
        this.hovered = !0, this.cancelHide();
      }), this.card.addEventListener("mouseleave", () => {
        this.hovered = !1, this.hoverWord = void 0, this.hideHint(), this.pinned || this.hideSoon();
      }), state.onChange(() => {
        this.opts && (this.infoCache.clear(), this.render());
      }), document.addEventListener("fullscreenchange", () => this.mount());
    }
    get visible() {
      return !!this.opts;
    }
    /** Where the open card came from ('yt' subtitles or 'web'). */
    get src() {
      return this.opts?.src;
    }
    get pinned() {
      return !!this.opts?.pinned;
    }
    /** Milliseconds since the card was last shown. */
    age() {
      return Date.now() - this.shownAt;
    }
    get current() {
      return this.opts?.matches[0];
    }
    get isHovered() {
      return this.hovered;
    }
    contains(node) {
      return node === this.host;
    }
    /**
     * The card lives at the end of the page, or inside the modal dialog the word is in (or the
     * fullscreen element). A modal (YouTube Studio's upload dialog, a <dialog>, an aria-modal
     * box) takes focus back from anything outside it and makes the rest of the page inert:
     * outside it, the card's text box couldn't be typed in.
     */
    mount(rect) {
      let parent = document.fullscreenElement ?? modalAt(rect) ?? document.documentElement;
      this.host.parentNode !== parent && parent.append(this.host);
    }
    onHide(fn) {
      this.hideListeners.add(fn);
    }
    /**
     * Hide after a short grace period, unless the pointer is on the card or on its
     * way there: while it is in the corridor between the word and the card, however
     * slowly it moves, the card waits.
     */
    hideSoon(ms = 140) {
      if (!this.opts || this.pinned || this.hiding) return;
      this.hiding = !0;
      let check = () => {
        if (!this.opts || this.pinned || this.hovered) {
          this.hiding = !1;
          return;
        }
        if (this.inBridge(this.px, this.py)) {
          this.softTimer = setTimeout(check, 50);
          return;
        }
        this.hide();
      };
      this.softTimer = setTimeout(check, ms);
    }
    /**
     * Is (x, y) on the way from the word to the card (whichever side the card is on)? Two
     * shapes count: the corridor between the word's edge and the card's facing edge, and the
     * "safe triangle" from the last point on the word to the card's two near corners, so a
     * diagonal path that leaves the word by another edge still counts.
     */
    inBridge(x, y) {
      let a = this.anchor;
      if (!this.opts || !a || this.card.hidden || x < 0 || x >= a.left && x <= a.right && y >= a.top && y <= a.bottom) return !1;
      let c = this.card.getBoundingClientRect(), pad = 8, p = { x, y }, e = this.exit, near, lane = !1;
      c.top >= a.bottom - 2 ? (lane = inTrapezoid(y, a.bottom, c.top, a.left, a.right, c.left, c.right, x, pad), near = [{ x: c.left, y: c.top }, { x: c.right, y: c.top }]) : c.bottom <= a.top + 2 ? (lane = inTrapezoid(y, a.top, c.bottom, a.left, a.right, c.left, c.right, x, pad), near = [{ x: c.left, y: c.bottom }, { x: c.right, y: c.bottom }]) : c.left >= a.right - 2 ? (lane = inTrapezoid(x, a.right, c.left, a.top, a.bottom, c.top, c.bottom, y, pad), near = [{ x: c.left, y: c.top }, { x: c.left, y: c.bottom }]) : c.right <= a.left + 2 && (lane = inTrapezoid(x, a.left, c.right, a.top, a.bottom, c.top, c.bottom, y, pad), near = [{ x: c.right, y: c.top }, { x: c.right, y: c.bottom }]);
      let past = c.top >= a.bottom - 2 ? y > a.bottom : c.bottom <= a.top + 2 ? y < a.top : !0;
      return lane || past && !!near && !!e && inTriangle(p, e, near[0], near[1], pad);
    }
    /** The page scrolled under a card the pointer rests on: keep it, but the word has moved away. */
    detach() {
      this.anchor = void 0, this.exit = void 0, this.hideHint();
    }
    cancelHide() {
      clearTimeout(this.softTimer), this.hiding = !1;
    }
    async show(opts, keepPlace = !1) {
      let sameWord = this.opts?.matches[0]?.word === opts.matches[0]?.word;
      this.editing?.word !== opts.matches[0]?.word && this.endEdit(), this.opts = opts, this.cancelHide(), keepPlace || (this.trail = [opts], this.pos = 0), (!keepPlace || !this.host.isConnected) && this.mount(opts.rect);
      let appearing = this.card.hidden, m = opts.matches[0], e0 = m.entries[0], [, info] = await Promise.all([state.loadStatuses(), this.wordInfo(m.word, e0.tw || e0.py)]);
      this.opts === opts && (this.info = info, this.hoverWord = void 0, this.hideHint(), this.render(), keepPlace ? this.keepOnScreen() : (this.anchor = opts.rect, this.exit = this.px >= 0 ? { x: this.px, y: this.py } : void 0, this.position(opts)), appearing && this.appear(), this.shownAt = Date.now(), clearTimeout(this.lookTimer), this.lookTimer = setTimeout(() => this.recordLook(), opts.pinned ? 0 : 1200));
    }
    /**
     * A card that wasn't showing settles in from the word's side: a quick fade and a few pixels of
     * travel, so it reads as coming from the word. Moving between words doesn't replay it.
     */
    appear() {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches || !this.card.animate) return;
      let below = this.anchor ? this.card.getBoundingClientRect().top >= this.anchor.top : !0;
      this.card.animate([{ opacity: 0, transform: `translateY(${below ? -3 : 3}px)` }, { opacity: 1, transform: "none" }], {
        duration: 130,
        easing: "cubic-bezier(0.2, 0.8, 0.3, 1)"
      });
    }
    async wordInfo(word, py) {
      let hit = this.infoCache.get(word);
      if (hit) return hit;
      let info = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "wordInfo", word, py });
      return this.infoCache.size > 200 && this.infoCache.clear(), this.infoCache.set(word, info), info;
    }
    hide() {
      this.opts && (clearTimeout(this.lookTimer), this.cancelHide(), this.opts = void 0, this.endEdit(), this.trail = [], this.pos = 0, this.hoverWord = void 0, this.hovered = !1, this.anchor = void 0, this.exit = void 0, this.card.hidden = !0, this.hideHint(), this.hideListeners.forEach((f) => f()));
    }
    recordLook() {
      let m = this.current;
      !m || !this.opts || !stampable(m) || import_browser_polyfill_min.default.runtime.sendMessage({ type: "looked", word: m.word, src: this.opts.src, url: this.opts.ctx?.url, ctx: this.ctxFor(m) });
    }
    /**
     * The sentence this word was met in: the page's, but only when the word is in it. A word opened
     * inside the card (from an example or the breakdown) wasn't met there, and neither is one met
     * on the extension's own pages. Carries the word as written there when that differs.
     */
    ctxFor(m, ctx2 = this.opts?.ctx) {
      if (!(!ctx2 || /^(moz|chrome)-extension:/.test(ctx2.url) || !hasWord(ctx2.text.split(" \u2014 ")[0], m.word, m.text)))
        return m.text !== m.word ? { ...ctx2, q: m.text } : ctx2;
    }
    /** Set a status; pressing the active one again clears it. */
    setStatus(status, toggle = !0) {
      let m = this.current;
      if (!m || !this.opts || !stampable(m)) return;
      let cur = state.status(m.word), next = toggle && cur === status ? null : status;
      next !== cur && (next ? state.statuses.set(m.word, next) : state.statuses.delete(m.word), stampSound(next), next && signal("stamp"), this.infoCache.delete(m.word), this.render(next ?? void 0), import_browser_polyfill_min.default.runtime.sendMessage({ type: "setStatus", word: m.word, status: next, entry: m.entries[0], ctx: this.ctxFor(m) }));
    }
    speak() {
      let m = this.current;
      m && speak(m.word);
    }
    images(word = this.current?.word) {
      word && window.open(`https://duckduckgo.com/?q=${encodeURIComponent(word)}&iax=images&ia=images&kl=tw-tzh`, "_blank");
    }
    /** Open a word clicked inside the card, in the same place, with a way back (← and →). */
    async openInside(q) {
      if (!this.opts) return;
      let matches = await lookupText(q);
      if (!matches.length || !this.opts) return;
      let exact = matches.findIndex((m) => m.text === q), ordered = exact > 0 ? [matches[exact], ...matches.filter((_, i) => i !== exact)] : matches;
      if (ordered[0].word === this.current?.word) return;
      let next = { ...this.opts, matches: ordered, pinned: !0 };
      this.trail = [...this.trail.slice(0, this.pos + 1).map((o) => ({ ...o, pinned: !0 })), next], this.pos = this.trail.length - 1, await this.show(next, !0);
    }
    /** ← the word before (true when there was one). */
    back() {
      return this.pos <= 0 ? !1 : (this.pos--, this.show(this.trail[this.pos], !0), !0);
    }
    /** → the word you came back from. */
    forward() {
      return this.pos >= this.trail.length - 1 ? !1 : (this.pos++, this.show(this.trail[this.pos], !0), !0);
    }
    onCardClick(e) {
      let t = e.target.closest("[data-q]");
      t?.dataset.q && this.openInside(t.dataset.q);
    }
    /** Keyboard shortcuts while the card is open. Returns true when handled. */
    /**
     * A key typed into the card's own text box (the page never sees it): Enter saves, Esc
     * cancels, anything else is typing. True when the key belonged to the box.
     */
    editKey(e) {
      return !this.editing || !inOwnBox(e) ? !1 : (e.isComposing || (e.key === "Enter" && !e.shiftKey ? (e.preventDefault(), this.commitEdit()) : e.key === "Escape" && (e.preventDefault(), this.endEdit(), this.render())), !0);
    }
    handleKey(e) {
      if (!this.opts || e.ctrlKey || e.metaKey || e.altKey) return !1;
      let action = e.shiftKey && e.key.toLowerCase() !== e.key.toUpperCase() ? void 0 : actionFor(state.settings, e, "card");
      if (this.hoverWord && this.hovered && action)
        return this.actOnHovered(action, this.hoverWord), !0;
      if (e.key === "Backspace" && !keyOf(state.settings, "remove")) return !1;
      switch (action ?? e.key) {
        case "fresh":
        case "learning":
        case "known":
          return this.setStatus(action), !0;
        case "remove":
        case "Backspace":
          return this.setStatus(null, !1), !0;
        case "say":
          return this.speak(), !0;
        case "images":
          return this.images(), !0;
        case "ArrowLeft":
          return this.back();
        case "ArrowRight":
          return this.forward();
        case "Escape":
          return this.hide(), !0;
      }
      return !1;
    }
    /** A shortcut for the word under the pointer inside the card. */
    async actOnHovered(key, target2) {
      let matches = await lookupText(target2.q), m = matches.find((x) => x.text === target2.q) ?? matches[0];
      if (!m || !this.opts) return;
      if (key === "say") return void speak(m.word);
      if (key === "images") return this.images(m.word);
      let want = key === "fresh" || key === "learning" || key === "known" ? key : null, cur = state.status(m.word), next = want && cur === want ? null : want;
      if (next === cur) return;
      next ? state.statuses.set(m.word, next) : state.statuses.delete(m.word), stampSound(next), next && signal("stamp");
      let ctx2 = target2.sentence ? this.ctxFor(m, { text: target2.sentence, url: location.href, title: document.title, at: Date.now(), src: this.opts.src }) : void 0;
      import_browser_polyfill_min.default.runtime.sendMessage({ type: "setStatus", word: m.word, status: next, entry: m.entries[0], ctx: ctx2 });
    }
    async showHint(el) {
      let q = el.dataset.q;
      if (!q) return;
      let seq = ++this.hintSeq, matches = await lookupText(q);
      if (seq !== this.hintSeq || !el.isConnected || this.card.hidden) return;
      let m = matches.find((x) => x.text === q) ?? matches[0];
      if (!m) return this.hideHint();
      let e = m.entries[0], hint = this.hint;
      hint.classList.toggle("large", state.settings.cardSize === "large"), hint.replaceChildren(
        h("div", { class: "hg" }, mainSense(e)),
        h("div", { class: "hpy" }, readAs(e.tw || e.py, !1))
      ), hint.hidden = !1;
      let r = el.getBoundingClientRect(), w = hint.offsetWidth, ht = hint.offsetHeight, y = r.top - ht - 6;
      y < 4 && (y = r.bottom + 6), place(hint, Math.min(Math.max(4, r.left + r.width / 2 - w / 2), window.innerWidth - w - 4), y);
    }
    hideHint() {
      this.hintSeq++, this.hint.hidden = !0;
    }
    /** Ask Gemini for sentences when this word has fewer than two. */
    async writeExamples(word, want) {
      this.gemState = { word, busy: !0 }, this.render();
      let res = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "geminiExamples", word, want });
      this.infoCache.delete(word), this.gemState = res.ok ? void 0 : { word, busy: !1, error: res.error };
      let cur = this.current;
      if (cur?.word === word) {
        if (res.ok) {
          let e0 = cur.entries[0];
          if (this.info = await this.wordInfo(word, e0.tw || e0.py), this.current?.word !== word) return;
        }
        this.render();
      }
    }
    /**
     * Never over the word or the pointer: below the word if the card fits there, else above;
     * if it fits in neither, beside the word (right, then left); failing that, in the taller
     * of the two gaps, scrolling inside.
     */
    position(o) {
      let c = this.card;
      c.style.maxHeight = "";
      let r = o.rect, vw = window.innerWidth, vh = window.innerHeight, m = 8, gap = 10, w = c.offsetWidth, ht = c.offsetHeight, clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi)), near = clamp((o.cursor?.x ?? r.left) - 28, m, vw - w - m), belowTop = Math.max(r.bottom, o.cursor?.y ?? 0) + gap, spaceBelow = vh - m - belowTop, spaceAbove = r.top - gap - m, x, y;
      if (ht <= spaceBelow) [x, y] = [near, belowTop];
      else if (ht <= spaceAbove) [x, y] = [near, r.top - gap - ht];
      else if (vw - m - (r.right + gap) >= w || r.left - gap - m >= w)
        x = vw - m - (r.right + gap) >= w ? r.right + gap : r.left - gap - w, ht > vh - 2 * m && (ht = vh - 2 * m, c.style.maxHeight = `${ht}px`), y = clamp(r.top - 40, m, vh - m - ht);
      else {
        let roomy = spaceBelow >= spaceAbove;
        ht = Math.max(120, roomy ? spaceBelow : spaceAbove), c.style.maxHeight = `${ht}px`, [x, y] = [near, roomy ? belowTop : r.top - gap - ht];
      }
      place(c, x, y);
    }
    /** After the content changed in place (← →, a clicked word), keep the card inside the window. */
    keepOnScreen() {
      let c = this.card, b = c.getBoundingClientRect(), vh = window.innerHeight;
      b.bottom > vh - 8 && place(c, b.left, Math.max(8, vh - 8 - b.height));
    }
    /** Save an example sentence to learn it: it goes into the export for Claude. */
    saveButton(word, zh, en) {
      let on = !!this.info?.saved?.includes(zh), b = h("button", { class: `save${on ? " on" : ""}`, title: on ? "Saved for your export (click to unsave)" : "Save this sentence to learn it", "aria-label": "Save this sentence" }), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      let path = document.createElementNS(NS, "path");
      return path.setAttribute("d", "M4 2.5h8v11l-4-3-4 3z"), svg.append(path), b.append(svg), b.addEventListener("click", (e) => {
        e.stopPropagation(), e.preventDefault(), this.saveSentence(word, { zh, en, on: !this.info?.saved?.includes(zh) });
      }), b;
    }
    /** Save or unsave a sentence: the card changes at once, the stored list follows (and the card refills from it). */
    saveSentence(word, o) {
      if (this.info) {
        let drop = (x) => x === o.zh || x === o.replace, mine = (this.info.mine ?? []).filter((x) => !drop(x.zh)), old = this.info.mine?.find((x) => x.zh === o.replace);
        o.on && !this.info.examples.some((x) => x.zh === o.zh) && mine.push({ zh: o.zh, en: o.en, from: o.from ?? old?.from, toks: [] });
        let examples = o.on && o.en ? this.info.examples.map((x) => x.zh === o.zh ? { ...x, en: o.en } : x) : this.info.examples;
        this.info = { ...this.info, examples, saved: [...this.info.saved.filter((x) => !drop(x)), ...o.on ? [o.zh] : []], mine };
      }
      o.on && saveSound(), this.infoCache.delete(word), this.render(), import_browser_polyfill_min.default.runtime.sendMessage({ type: "saveSentence", word, ...o }).then(async () => {
        this.infoCache.delete(word);
        let cur = this.current;
        if (cur?.word !== word) return;
        let e0 = cur.entries[0];
        this.info = await this.wordInfo(word, e0.tw || e0.py), this.current?.word === word && this.render();
      });
    }
    /** A small pencil that opens a sentence (Chinese and English) for editing before it is saved. */
    editButton(word, zh, en, from) {
      let b = h("button", { class: "edit", title: "Edit, then save", "aria-label": "Edit this sentence" }), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      let path = document.createElementNS(NS, "path");
      return path.setAttribute("d", "M3 13l.8-3.2 7-7 2.4 2.4-7 7zM9.6 4l2.4 2.4"), svg.append(path), b.append(svg), b.addEventListener("click", (e) => {
        e.stopPropagation(), e.preventDefault();
        let replace = this.info?.saved.includes(zh) ? zh : void 0;
        this.editing = { word, orig: zh, draft: zh, en, origEn: en, replace, from: from ?? zh }, this.opts && (this.opts.pinned = !0), this.render();
      }), b;
    }
    /** The row being edited: the Chinese and its English in text boxes (Enter saves, Esc cancels). */
    editRow(ed) {
      let field = (cls, value, label, set, placeholder) => {
        let box2 = h("textarea", { class: cls, rows: "1", spellcheck: "false", "aria-label": label, ...placeholder ? { placeholder } : {} });
        return box2.value = value, box2.addEventListener("input", () => {
          set(box2.value), fitBox(box2);
        }), box2.addEventListener("focus", () => this.host.setAttribute("data-typing", "")), box2.addEventListener("blur", () => this.host.removeAttribute("data-typing")), box2;
      }, box = field("editbox", ed.draft, "Edit the sentence", (v) => ed.draft = v), enBox = field("editbox editen", ed.en, "Edit the English", (v) => ed.en = v, "English (optional)"), save2 = h("button", { class: "editsave" }, "Save");
      save2.addEventListener("click", (e) => {
        e.stopPropagation(), this.commitEdit();
      });
      let cancel = h("button", { class: "editcancel" }, "Cancel");
      return cancel.addEventListener("click", (e) => {
        e.stopPropagation(), this.endEdit(), this.render();
      }), h("li", { class: "editing" }, box, enBox, h("div", { class: "editbar" }, save2, cancel, this.copyButton(() => box.value), h("span", { class: "edithint" }, "Enter saves \xB7 Esc cancels")));
    }
    commitEdit() {
      let ed = this.editing;
      if (!ed) return;
      let zh = ed.draft.replace(/\s+/g, " ").trim(), en = ed.en.replace(/\s+/g, " ").trim();
      if (this.endEdit(), !zh || zh === ed.orig && en === ed.origEn.trim() && ed.replace) return this.render();
      this.saveSentence(ed.word, { zh, en, on: !0, replace: ed.replace, from: ed.from });
    }
    endEdit() {
      this.editing = void 0, this.host.removeAttribute("data-typing");
    }
    /** A sentence you met or saved, with its buttons (or its text box while being edited). */
    sentenceRow(word, r) {
      let ed = this.editing;
      return ed?.word === word && ed.orig === r.zh ? this.editRow(ed) : h(
        "li",
        null,
        h("span", { class: "zh" }, ...r.toks?.length ? this.sentence(r.toks, word) : this.plainSentence(r.zh, word)),
        this.sayButton(r.zh),
        this.copyButton(r.zh),
        this.editButton(word, r.zh, r.en, r.from),
        this.saveButton(word, r.zh, r.en),
        r.met ? this.deleteButton(word, { type: "forgetContext", text: r.met }) : null,
        r.showEn && r.en ? h("span", { class: "en" }, r.en) : null
      );
    }
    /** A sentence not split into words yet: the headword underlined, the rest plain. */
    plainSentence(zh, head) {
      let out = [];
      return zh.split(head).forEach((part, i) => {
        i && out.push(h("span", { class: "w hw", "data-q": head }, head)), part && out.push(part);
      }), out;
    }
    /** A small × that deletes a sentence from this word's card for good. */
    deleteButton(word, msg) {
      let b = h("button", { class: "del", title: "Delete this sentence", "aria-label": "Delete this sentence" }, "\xD7");
      return b.addEventListener("click", (e) => {
        e.stopPropagation(), e.preventDefault(), this.info && this.current?.word === word && (this.info = {
          ...this.info,
          examples: msg.type === "hideExample" ? this.info.examples.filter((x) => x.zh !== msg.zh) : this.info.examples,
          seen: msg.type === "forgetContext" ? this.info.seen.filter((c) => c.text !== msg.text) : this.info.seen
        }, this.render()), this.infoCache.delete(word), import_browser_polyfill_min.default.runtime.sendMessage({ ...msg, word }).then(async () => {
          this.infoCache.delete(word);
          let cur = this.current;
          if (cur?.word !== word) return;
          let e0 = cur.entries[0];
          this.info = await this.wordInfo(word, e0.tw || e0.py), this.current?.word === word && this.render();
        });
      }), b;
    }
    /** A small button that copies a sentence. */
    copyButton(text, what = "sentence") {
      let b = h("button", { class: "copy", title: `Copy the ${what}`, "aria-label": `Copy the ${what}` }), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      let path = document.createElementNS(NS, "path");
      return path.setAttribute("d", "M5.5 5.5h7.5v8h-7.5zM3 10.5V2.5h7.5"), svg.append(path), b.append(svg), b.addEventListener("click", async (e) => {
        e.stopPropagation(), e.preventDefault(), await copyText(typeof text == "string" ? text : text()) && (b.classList.add("done"), b.title = "Copied", setTimeout(() => {
          b.classList.remove("done"), b.title = `Copy the ${what}`;
        }, 1200));
      }), b;
    }
    /** A small speaker button that reads a sentence aloud. */
    sayButton(text) {
      let b = h("button", { class: "say", title: "Play the sentence", "aria-label": "Play the sentence" }), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 16 16");
      let path = document.createElementNS(NS, "path");
      return path.setAttribute("d", "M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9"), svg.append(path), b.append(svg), b.addEventListener("click", (e) => {
        e.stopPropagation(), speak(text);
      }), b;
    }
    /** A clickable, status-colored word. */
    word(text, q, word) {
      let el = h("span", { class: "w", "data-q": q }, text), st = state.settings.cardColors && word ? state.status(word) : void 0;
      return st && el.classList.add("st-" + st), el;
    }
    /** Sentence tokens as clickable words; the headword is underlined. */
    sentence(toks, head) {
      return toks.map((t) => {
        let text = t.trad ?? t.text;
        if (!t.word && !CJK.test(t.text)) return text;
        let el = this.word(text, t.text, t.word);
        if (t.word === head || text === head) el.classList.add("hw");
        else if (head && text.includes(head)) {
          let i = text.indexOf(head);
          el.replaceChildren(text.slice(0, i), h("span", { class: "hwp" }, head), text.slice(i + head.length));
        }
        return el;
      });
    }
    /** Plain text with its Chinese runs made clickable (definitions, measure words). */
    richText(text) {
      let out = [];
      for (let m of text.matchAll(/[㐀-鿿豈-﫿]+|[^㐀-鿿豈-﫿]+/g))
        out.push(CJK.test(m[0][0]) ? this.word(m[0], m[0], m[0]) : m[0]);
      return out;
    }
    render(stamped) {
      let o = this.opts, m = o?.matches[0];
      if (!o || !m) return;
      let status = state.status(m.word), e0 = m.entries[0], s = state.settings, card2 = this.card;
      card2.classList.toggle("pinned", !!o.pinned), card2.classList.toggle("large", s.cardSize === "large"), card2.replaceChildren();
      let freq = frequency(Math.max(...m.entries.map((e) => e.zipf))), reading0 = e0.tw || e0.py, long = [...m.word].length > 8, zyHead = zyOver(m.word, reading0), pyEl = zyHead ? null : h("span", { class: `py${s.pron === "zhuyin" ? " zyline" : ""}` }, readAs(reading0, !1)), groups = /* @__PURE__ */ new Map();
      for (let e of m.entries) {
        let k = (e.tw || e.py).toLowerCase();
        groups.has(k) || groups.set(k, []), groups.get(k).push(e);
      }
      let readings = [], first = !0;
      for (let [reading, list] of groups) {
        let defs = [...new Set(list.flatMap((e) => e.defs))], senses = defs.filter((d) => !d.startsWith("CL:")).slice(0, 10).map(prettyDef), cls = defs.filter((d) => d.startsWith("CL:")).flatMap((d) => d.slice(3).split(",")), line = h("div", { class: "defs" });
        first || line.append(h("span", { class: "rpy" }, readAs(reading, !1))), senses.forEach((d, i) => {
          i && line.append(h("span", { class: "sep" }, "\xB7")), line.append(...this.richText(d));
        });
        let block = h("div", { class: "reading" }, line);
        cls.length && block.append(
          h(
            "div",
            { class: "cl" },
            "measure word ",
            ...cls.flatMap((c, i) => {
              let mm = /^([^|\[]+)(?:\|[^\[]+)?\[([^\]]+)\]/.exec(c);
              if (!mm) return [];
              let z = zyOver(mm[1], mm[2]), w = this.word(mm[1], mm[1], mm[1]);
              return z && w.replaceChildren(z), [i ? ", " : "", w, z ? "" : " " + readAs(mm[2])];
            })
          )
        ), readings.push(block), first = !1;
      }
      let head = h("span", { class: `head${status ? " st-" + status : ""}${long ? " long" : ""}${zyHead ? " zyhead" : ""}` }, zyHead ?? m.word);
      m.phrase && !e0.defs[0]?.startsWith("(") && readings[0]?.querySelector(".defs")?.append(h("span", { class: "mt" }, "machine translation"));
      let top = h("div", { class: "top" });
      if (this.trail.length > 1) {
        let nav = h("div", { class: "nav" }), backBtn = h("button", { title: "Back (\u2190)" }, "\u2190"), fwdBtn = h("button", { title: "Forward (\u2192)" }, "\u2192");
        this.pos <= 0 && backBtn.setAttribute("disabled", ""), this.pos >= this.trail.length - 1 && fwdBtn.setAttribute("disabled", ""), backBtn.addEventListener("click", () => this.back()), fwdBtn.addEventListener("click", () => this.forward()), nav.append(backBtn, fwdBtn), top.append(nav);
      }
      top.append(
        h(
          "div",
          { class: "headrow" },
          head,
          m.phrase ? this.copyButton(m.word, long ? "sentence" : "text") : null,
          pyEl,
          freq ? h(
            "span",
            { class: `freq f${freq.bars}`, title: freq.tip },
            h("span", { class: "bars" }, ...[1, 2, 3, 4, 5].map((i) => h("i", { class: i <= freq.bars ? "on" : "" }))),
            freq.label
          ) : null
        ),
        ...readings
      ), card2.append(top);
      let info = this.info;
      if (info?.chars.length) {
        let grid = h("div", { class: "chars" });
        for (let c of info.chars) {
          let ch = this.word(c.ch, c.ch, c.ch);
          ch.classList.add("c");
          let z = zyOver(c.ch, c.py);
          z && ch.replaceChildren(z);
          let cell = h("span", { class: `cw d${Math.min(c.depth, 3)}` }, ch);
          grid.append(cell, h("span", { class: "cpy" }, z ? "" : readAs(c.py, !1)), h("span", { class: "cg" }, c.gloss));
        }
        card2.append(h("div", { class: "sect" }, grid));
      }
      let mine = info?.mine ?? [], cutFrom = new Set(mine.map((x) => x.from).filter((x) => !!x)), hereCtx = m.phrase ? void 0 : this.ctxFor(m), [here = "", ...hereEn] = hereCtx ? metSentence(hereCtx, m.word, 120).split(" \u2014 ") : [], showHere = !!here && !cutFrom.has(here), seen = (info?.seen ?? []).filter((c) => c.zh !== here && !cutFrom.has(c.zh)).slice(0, 2), savedRows = mine.filter((x) => x.zh !== here && !seen.some((c) => c.zh === x.zh)), examples = (info?.examples ?? []).filter((x) => !cutFrom.has(x.zh)), canWrite = examples.length < 2 && !!s.geminiKey && !m.phrase;
      if (examples.length || seen.length || canWrite || showHere || savedRows.length) {
        let sect = h("div", { class: "sect" });
        if (examples.length && sect.append(
          h(
            "ul",
            { class: "ex" },
            ...examples.map(
              (x) => this.editing?.word === m.word && this.editing.orig === x.zh ? this.editRow(this.editing) : h(
                "li",
                null,
                h("span", { class: "zh" }, ...this.sentence(x.toks, m.word)),
                this.sayButton(x.zh),
                this.copyButton(x.zh),
                this.editButton(m.word, x.zh, x.en),
                this.saveButton(m.word, x.zh, x.en),
                this.deleteButton(m.word, { type: "hideExample", zh: x.zh }),
                h("span", { class: "en" }, x.en)
              )
            )
          )
        ), canWrite) {
          let g = this.gemState?.word === m.word ? this.gemState : void 0, label = g?.busy ? "Writing\u2026" : examples.length ? "\u2726 Write another example with Gemini" : "\u2726 Write example sentences with Gemini", b = h("button", { class: "gem" }, label);
          g?.busy && b.setAttribute("disabled", ""), b.addEventListener("click", () => void this.writeExamples(m.word, 2 - examples.length)), sect.append(h("div", { class: "gemrow", style: examples.length ? "margin-top:6px" : "" }, b, g?.error ? h("div", { class: "err" }, g.error) : null));
        }
        let lists = [
          ["This sentence", showHere ? [this.sentenceRow(m.word, { zh: here, en: hereEn.join(" \u2014 ").trim() })] : []],
          ["You met it in", seen.map((c) => this.sentenceRow(m.word, { zh: c.zh, en: c.en ?? "", toks: c.toks, met: c.text }))],
          ["Saved", savedRows.map((x) => this.sentenceRow(m.word, { ...x, showEn: !0 }))]
        ], above = examples.length > 0 || canWrite;
        for (let [label, rows] of lists)
          rows.length && (sect.append(h("div", { class: "label", style: above ? "margin-top:8px" : "" }, label), h("ul", { class: "ex seen" }, ...rows)), above = !0);
        card2.append(sect);
      }
      let stamps = STAMPS.map((st) => {
        let b = h(
          "button",
          { class: `stamp ${st.s}${status === st.s ? " on" : ""}${stamped === st.s ? " pop" : ""}`, title: st.label },
          st.zh,
          h("small", null, keyLabel(keyOf(state.settings, st.s)))
        );
        return b.addEventListener("click", () => this.setStatus(st.s)), b;
      }), say = h("button", null, "say", h("kbd", null, keyLabel(keyOf(state.settings, "say")).toLowerCase()));
      say.addEventListener("click", () => this.speak());
      let img = h("button", null, "images", h("kbd", null, keyLabel(keyOf(state.settings, "images")).toLowerCase()));
      img.addEventListener("click", () => this.images()), card2.append(h("div", { class: "foot" }, stampable(m) ? h("div", { class: "stamps" }, ...stamps) : null, h("div", { class: "tools" }, say, long ? null : img))), card2.hidden = !1;
      for (let b of card2.querySelectorAll(".editbox")) fitBox(b);
      let box = card2.querySelector(".editbox");
      box && this.root.activeElement !== box && (box.focus(), box.setSelectionRange(box.value.length, box.value.length));
    }
  };

  // src/pages/options.ts
  var AZURE_REGIONS = [
    "eastasia",
    "southeastasia",
    "japaneast",
    "japanwest",
    "koreacentral",
    "centralindia",
    "australiaeast",
    "westeurope",
    "northeurope",
    "uksouth",
    "francecentral",
    "germanywestcentral",
    "swedencentral",
    "switzerlandnorth",
    "norwayeast",
    "italynorth",
    "eastus",
    "eastus2",
    "westus",
    "westus2",
    "westus3",
    "centralus",
    "northcentralus",
    "southcentralus",
    "westcentralus",
    "canadacentral",
    "brazilsouth",
    "southafricanorth",
    "uaenorth",
    "qatarcentral"
  ], settings, savedTimer;
  function setStatus(id, text, kind = "") {
    let el = $(id);
    el.textContent = text, el.className = `status ${kind}`;
  }
  function ensureOption(el, value, label = value) {
    value && ![...el.options].some((o) => o.value === value) && el.append(new Option(label, value));
  }
  function fill(el, key) {
    let v = settings[key];
    el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked = !!v : Array.isArray(v) ? el.value = v.join(`
`) : (el instanceof HTMLSelectElement && ensureOption(el, String(v)), el.value = String(v));
  }
  async function save(key, el) {
    let def = DEFAULT_SETTINGS[key], value;
    if (el instanceof HTMLInputElement && el.type === "checkbox" ? value = el.checked : typeof def == "number" ? value = Number(el.value) || def : Array.isArray(def) ? value = el.value.split(/\s+/).map((x) => x.trim()).filter(Boolean) : value = el.value.trim(), JSON.stringify(settings[key]) === JSON.stringify(value)) return;
    settings = { ...settings, [key]: value }, state.settings = settings, await import_browser_polyfill_min.default.runtime.sendMessage({ type: "saveSettings", settings: { [key]: value } });
    let tag = $("saved");
    tag.classList.add("show"), clearTimeout(savedTimer), savedTimer = setTimeout(() => tag.classList.remove("show"), 1400), showWhen(), key === "sounds" && value && playStamp("fresh"), key === "clickStamp" && value !== "off" && settings.sounds && playStamp(value), (key === "cardSize" || key === "pron") && preview(el), key === "azureKey" && setStatus("azureStatus", ""), key === "geminiKey" && setStatus("geminiStatus", "");
  }
  var card;
  async function preview(near) {
    let matches = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "lookup", text: "\u81FA\u5317" });
    if (!matches?.length) return;
    if (!card) {
      card = new Popup();
      let close = (e) => {
        !card?.visible || card.contains(e.target) || e instanceof KeyboardEvent && e.key !== "Escape" || card.hide();
      };
      document.addEventListener("pointerdown", close, !0), document.addEventListener("keydown", close, !0), addEventListener("scroll", () => card?.visible && card.hide(), { passive: !0 });
    }
    let row = (near.closest(".row") ?? near).getBoundingClientRect();
    card.show({ matches: matches.slice(0, 1), rect: new DOMRect(row.right - 220, row.top, 200, row.height), src: "web", pinned: !0 });
  }
  function showSites() {
    let sites = Object.entries(settings.siteColors).sort(([a], [b]) => a.localeCompare(b));
    $("siteColorsRow").hidden = !sites.length, $("siteColors").replaceChildren(
      ...sites.map(([host, on]) => {
        let b = document.createElement("button");
        b.type = "button", b.className = on ? "on" : "off", b.title = "Forget this website\u2019s own setting";
        let flag = document.createElement("b");
        flag.textContent = on ? "on" : "off";
        let x = document.createElement("i");
        return x.textContent = "\xD7", b.append(host.replace(/^www\./, ""), flag, x), b.addEventListener("click", async () => {
          let siteColors = { ...settings.siteColors };
          delete siteColors[host], settings = { ...settings, siteColors }, state.settings = settings, await import_browser_polyfill_min.default.runtime.sendMessage({ type: "saveSettings", settings: { siteColors } }), showSites();
        }), b;
      })
    );
  }
  function segmented(sel) {
    let seg = document.createElement("div");
    seg.className = "seg still", seg.setAttribute("role", "radiogroup");
    let label = document.querySelector(`label[for="${sel.id}"]`)?.textContent?.trim();
    label && seg.setAttribute("aria-label", label);
    let thumb = document.createElement("i");
    thumb.className = "thumb";
    let buttons = [...sel.options].map((o) => {
      let b = document.createElement("button");
      return b.type = "button", b.setAttribute("role", "radio"), b.dataset.v = o.value, b.textContent = o.dataset.short ?? o.textContent, o.title && (b.title = o.title), o.lang && (b.lang = o.lang), b.addEventListener("click", () => pick(o.value)), b;
    }), sync = () => {
      for (let b of buttons) {
        let on = b.dataset.v === sel.value;
        b.setAttribute("aria-checked", String(on)), b.tabIndex = on ? 0 : -1, on && b.offsetWidth && (thumb.style.width = `${b.offsetWidth}px`, thumb.style.transform = `translateX(${b.offsetLeft}px)`);
      }
    }, pick = (v) => {
      sel.value !== v && (seg.classList.remove("still"), sel.value = v, sel.dispatchEvent(new Event("change")), sync());
    };
    seg.addEventListener("keydown", (e) => {
      let step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      let i = Math.min(buttons.length - 1, Math.max(0, sel.selectedIndex + step));
      pick(sel.options[i].value), buttons[i].focus();
    }), seg.append(thumb, ...buttons), sel.hidden = !0, sel.after(seg), sync(), new ResizeObserver(() => {
      seg.classList.add("still"), sync();
    }).observe(seg);
  }
  function stepper(input) {
    let wrap = document.createElement("span");
    wrap.className = "stepper";
    let btn = (text, label, dir) => {
      let b = document.createElement("button");
      return b.type = "button", b.textContent = text, b.setAttribute("aria-label", label), b.addEventListener("click", () => {
        dir > 0 ? input.stepUp() : input.stepDown(), input.dispatchEvent(new Event("change")), sync();
      }), b;
    }, minus = btn("\u2212", "Less", -1), plus = btn("+", "More", 1), sync = () => {
      minus.disabled = Number(input.value) <= Number(input.min), plus.disabled = Number(input.value) >= Number(input.max);
    }, val = document.createElement("span");
    if (val.className = "val", input.replaceWith(wrap), val.append(input), input.dataset.unit) {
      let u = document.createElement("span");
      u.className = "unit", u.textContent = input.dataset.unit, val.append(u);
    }
    wrap.append(minus, val, plus), input.addEventListener("input", sync), sync();
  }
  function followSections() {
    let links = [...document.querySelectorAll(".toc a")], mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${id}`))), secs = [...document.querySelectorAll("main .sec")], update = () => {
      let line = Math.min(window.innerHeight * 0.3, 240), current = secs[0];
      for (let s of secs) s.getBoundingClientRect().top <= line && (current = s);
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 && (current = secs[secs.length - 1]), mark(current.id), links.find((a) => a.hash === `#${current.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, raf = 0;
    window.addEventListener("scroll", () => {
      cancelAnimationFrame(raf), raf = requestAnimationFrame(update);
    }, { passive: !0 }), new ResizeObserver(update).observe(document.querySelector("main"));
  }
  function showWhen() {
    for (let el of document.querySelectorAll("[data-when]")) {
      let m = /^(\w+)(?:(!?=)(.+))?$/.exec(el.dataset.when);
      if (!m) continue;
      let v = settings[m[1]];
      el.hidden = !(m[2] === "=" ? String(v) === m[3] : m[2] === "!=" ? String(v) !== m[3] : Array.isArray(v) ? v.length > 0 : v);
    }
  }
  async function init() {
    settings = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "settings" }), state.settings = settings;
    let region = $("azureRegion");
    for (let r of AZURE_REGIONS) region.append(new Option(r, r));
    let model = $("geminiModel");
    ensureOption(model, settings.geminiModel);
    for (let key of Object.keys(DEFAULT_SETTINGS)) {
      let el = $(key);
      if (el && (fill(el, key), el.addEventListener("change", () => void save(key, el)), el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement && /^(text|password|number)$/.test(el.type))) {
        let t;
        el.addEventListener("input", () => {
          clearTimeout(t), t = setTimeout(() => void save(key, el), 500);
        });
      }
    }
    for (let sel of document.querySelectorAll("select[data-seg]")) segmented(sel);
    for (let input of document.querySelectorAll('input[type="number"]')) stepper(input);
    showWhen(), showSites(), showKeys(), followSections(), settings.geminiKey && loadModels(!1), showAccount().finally(() => {
      location.hash && document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    });
  }
  function renderAccount(a, note2 = "") {
    if ($("acct").hidden = !1, $("signedOut").hidden = a.signedIn, $("signedIn").hidden = !a.signedIn, a.signedIn) {
      $("acctEmail").textContent = a.email, $("acctEmail").title = a.email, $("acctInitial").textContent = a.email.trim().charAt(0);
      let el = $("acctSync");
      el.textContent = a.error ?? (a.at ? `Synced ${ago(a.at)}` : "Syncing\u2026"), el.className = a.error ? "err" : a.at ? "" : "busy";
    } else
      a.email && !$("email").value && ($("email").value = a.email), setStatus("acctStatus", note2 || a.error || "", note2 ? "ok" : "err");
  }
  async function showAccount() {
    renderAccount(await import_browser_polyfill_min.default.runtime.sendMessage({ type: "account" }));
  }
  async function signIn(create) {
    if (!$("signedOut").reportValidity()) return;
    try {
      if (!await import_browser_polyfill_min.default.permissions.request({ data_collection: ["personallyIdentifyingInfo", "authenticationInfo"] })) return setStatus("acctStatus", "An account needs that permission.", "err");
    } catch {
    }
    setStatus("acctStatus", create ? "Creating your account\u2026" : "Signing in\u2026");
    let a = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "signIn", email: $("email").value, password: $("password").value, create });
    $("password").value = "", renderAccount(a);
  }
  $("signedOut").addEventListener("submit", (e) => {
    e.preventDefault(), signIn(!1);
  });
  $("signUp").addEventListener("click", () => void signIn(!0));
  $("forgot").addEventListener("click", async () => {
    let email = $("email");
    if (!email.value || !email.checkValidity())
      return email.focus(), setStatus("acctStatus", "Type your email first.", "err");
    setStatus("acctStatus", "Sending\u2026");
    let res = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "forgot", email: email.value });
    setStatus("acctStatus", res.ok ? "Check your inbox for a link to set a new password." : res.error ?? "That didn\u2019t work.", res.ok ? "ok" : "err");
  });
  $("syncNow").addEventListener("click", async () => {
    $("acctSync").textContent = "Syncing\u2026", $("acctSync").className = "busy", renderAccount(await import_browser_polyfill_min.default.runtime.sendMessage({ type: "syncNow" }));
  });
  $("signOut").addEventListener("click", async () => renderAccount(await import_browser_polyfill_min.default.runtime.sendMessage({ type: "signOut" }), "Signed out. Your words stay in this browser."));
  var recording;
  function showKeys() {
    for (let [id, group] of [["keysCard", "card"], ["keysYt", "yt"]]) {
      let actions = Object.keys(KEY_ACTIONS).filter((a) => KEY_ACTIONS[a].group === group), rows = Math.ceil(actions.length / 2);
      $(id).style.gridTemplateRows = `repeat(${rows}, auto)`, $(id).replaceChildren(
        ...actions.map((a, i) => {
          let key = keyOf(settings, a), b = document.createElement("button");
          b.type = "button", b.textContent = key ? keyLabel(key) : "\u2014", b.className = key ? "" : "none", b.title = "Click, then press the new key (Backspace: no key)", b.addEventListener("click", () => record(a, b));
          let row = document.createElement("div");
          return i >= rows && row.classList.add("col2"), i % rows === 0 && row.classList.add("top"), row.append(KEY_ACTIONS[a].label, b), row;
        })
      );
    }
  }
  function record(action, b) {
    recording?.(), b.textContent = "Press a key", b.className = "rec";
    let onKey = (e) => {
      if (/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key) || (e.preventDefault(), e.stopPropagation(), recording?.(), e.key === "Escape")) return;
      let clear = e.key === "Backspace" || e.key === "Delete";
      if (!clear && (e.ctrlKey || e.metaKey || e.altKey || /^(Enter|Tab|Arrow|F\d|Page|Home|End)/.test(e.key))) return;
      let k = clear ? "" : keyName(e), keys = { ...settings.keys };
      if (k) for (let other of Object.keys(KEY_ACTIONS)) other !== action && keyOf(settings, other) === k && (keys[other] = "");
      k === KEY_ACTIONS[action].key ? delete keys[action] : keys[action] = k, saveKeys(keys);
    };
    recording = () => {
      window.removeEventListener("keydown", onKey, !0), recording = void 0, showKeys();
    }, window.addEventListener("keydown", onKey, !0);
  }
  async function saveKeys(keys) {
    settings = { ...settings, keys }, state.settings = settings, await import_browser_polyfill_min.default.runtime.sendMessage({ type: "saveSettings", settings: { keys } }), showKeys();
  }
  $("resetKeys").addEventListener("click", () => void saveKeys({}));
  for (let el of document.querySelectorAll(".altKey")) el.textContent = ALT;
  helpPopovers();
  $("altOption").textContent = `while holding ${ALT}`;
  $("altOption").dataset.short = `Hold ${ALT}`;
  import_browser_polyfill_min.default.commands.getAll().then((cmds) => {
    $("colorKey").textContent = shortcutLabel(cmds.find((c) => c.name === "toggle-colors")?.shortcut), $("colorAllKey").textContent = shortcutLabel(cmds.find((c) => c.name === "toggle-colors-all")?.shortcut);
  }).catch(() => {
  });
  for (let b of document.querySelectorAll(".changeKey"))
    b.addEventListener("click", () => {
      import_browser_polyfill_min.default.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
  for (let a of document.querySelectorAll("a.words")) a.href = DASHBOARD;
  $("backup").addEventListener("click", async () => {
    let all = await import_browser_polyfill_min.default.storage.local.get(null);
    delete all.acct, delete all["acct:dirty"], download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: "chinese-brain", v: 1, at: Date.now(), data: all }), "application/json");
  });
  $("restore").addEventListener("change", async (e) => {
    let f = e.target.files?.[0];
    if (!f) return;
    let data;
    try {
      let json = JSON.parse(await f.text());
      json.app === "chinese-brain" && (data = json.data);
    } catch {
    }
    if (!data) return setStatus("backupStatus", "That isn\u2019t a Chinese Brain backup.", "err");
    let recs = Object.entries(data).filter(([k]) => k.startsWith("w:")).map(([, v]) => v), n = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "importWords", words: recs, mode: "merge" }), existing = await import_browser_polyfill_min.default.storage.local.get(null), extra = {};
    for (let [k, v] of Object.entries(data)) !k.startsWith("w:") && !k.startsWith("acct") && !(k in existing) && (extra[k] = v);
    await import_browser_polyfill_min.default.storage.local.set(extra), setStatus("backupStatus", `\u2713 Restored ${n} word${n === 1 ? "" : "s"}.`, "ok");
  });
  $("version").textContent = import_browser_polyfill_min.default.runtime.getManifest().version;
  $("feedback").href = feedbackLink();
  $("testVoice").addEventListener("click", async () => {
    setStatus("voiceStatus", "Playing\u2026");
    let res = await speak("\u4F60\u597D\uFF0C\u5F88\u9AD8\u8208\u8A8D\u8B58\u4F60"), names = { google: "Google voice", azure: "Azure voice", system: "system voice" };
    res.engine === settings.voice ? setStatus("voiceStatus", `\u2713 ${names[res.engine]}`, "ok") : setStatus("voiceStatus", `${res.errors[0] ?? "Failed"} Used the ${names[res.engine]} instead.`, "err");
  });
  $("checkAzure").addEventListener("click", async () => {
    let key = $("azureKey");
    await save("azureKey", key), setStatus("azureStatus", "Checking\u2026");
    let res = await import_browser_polyfill_min.default.runtime.sendMessage({
      type: "azureCheck",
      key: key.value,
      region: settings.azureRegion
    });
    if (!res.ok) return setStatus("azureStatus", res.error ?? "The key did not work.", "err");
    let region = $("azureRegion");
    res.region && res.region !== settings.azureRegion && (ensureOption(region, res.region), region.value = res.region, await save("azureRegion", region)), setStatus("azureStatus", `\u2713 The key works (region ${res.region}).`, "ok");
  });
  async function loadModels(report) {
    let key = $("geminiKey").value.trim();
    if (!key) return setStatus("geminiStatus", "Paste your Gemini API key first.", "err");
    report && setStatus("geminiStatus", "Checking\u2026");
    let res = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "geminiModels", key });
    if (!res.models) return setStatus("geminiStatus", res.error ?? "The key did not work.", "err");
    let sel = $("geminiModel");
    sel.replaceChildren(...res.models.map((m) => new Option(`${m.name}  (${m.id})`, m.id)));
    let current = settings.geminiModel;
    if (res.models.some((m) => m.id === current)) sel.value = current;
    else {
      let pick = res.models.find((m) => /flash/.test(m.id) && !/lite|preview|exp/.test(m.id)) ?? res.models[0];
      pick && (sel.value = pick.id, await save("geminiModel", sel));
    }
    report && setStatus("geminiStatus", `\u2713 The key works. ${res.models.length} models available.`, "ok");
  }
  $("checkGemini").addEventListener("click", async () => {
    await save("geminiKey", $("geminiKey")), await loadModels(!0);
  });
  init();
})();
