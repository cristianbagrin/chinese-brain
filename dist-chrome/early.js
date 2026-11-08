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
          }, h = (a3, b2, c2) => new Proxy(b2, { apply(b3, d2, e2) {
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
                if (typeof b2[f2] == "function") k2 = h(a3, a3[f2], b2[f2]);
                else if (i(c2, f2)) {
                  let b3 = g(f2, c2[f2]);
                  k2 = h(a3, a3[f2], b3);
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
            let f2, g2, h2 = !1, i2 = new Promise((a4) => {
              f2 = function(b3) {
                h2 = !0, a4(b3);
              };
            });
            try {
              g2 = a3(b2, c2, f2);
            } catch (a4) {
              g2 = Promise.reject(a4);
            }
            let j2 = g2 !== !0 && d(g2);
            if (g2 !== !0 && !j2 && !h2) return !1;
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

  // src/content/early.ts
  init_browser_shim();

  // src/content/keys.ts
  init_browser_shim();
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
