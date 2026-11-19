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

  // src/pages/action.ts
  init_browser_shim();

  // src/shared/types.ts
  init_browser_shim();
  function cardMode(s, host) {
    return s.hoverMode === "off" || s.disabledSites.includes(host) ? "off" : s.hoverMode === "hover" ? s.altSites.includes(host) ? "alt" : "hover" : s.hoverSites.includes(host) ? "hover" : "alt";
  }
  function setSiteMode(s, host, mode) {
    let without = (list) => list.filter((h2) => h2 !== host), out = { altSites: without(s.altSites), hoverSites: without(s.hoverSites), disabledSites: without(s.disabledSites) };
    return mode === "off" ? out.disabledSites.push(host) : s.hoverMode === "hover" && mode === "alt" ? out.altSites.push(host) : s.hoverMode === "alt" && mode === "hover" && out.hoverSites.push(host), out;
  }
  function colorsOn(s, host) {
    return s.siteColors[host] ?? s.pageColors;
  }

  // src/pages/common.ts
  init_browser_shim();

  // src/shared/time.ts
  init_browser_shim();

  // src/pages/common.ts
  function h(tag, attrs, ...kids) {
    let el = document.createElement(tag);
    if (attrs) for (let [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (let k of kids) k && el.append(k);
    return el;
  }
  var $ = (id) => document.getElementById(id);
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
      let raf = 0, place = () => {
        cancelAnimationFrame(raf), raf = requestAnimationFrame(() => position(pop, trigger));
      };
      pop.addEventListener("beforetoggle", (e) => {
        let open = e.newState === "open";
        trigger.setAttribute("aria-expanded", String(open)), open ? (place(), addEventListener("scroll", place, { capture: !0, passive: !0 }), addEventListener("resize", place)) : (removeEventListener("scroll", place, { capture: !0 }), removeEventListener("resize", place));
      }), trigger.setAttribute("aria-expanded", "false");
    }
  }
  var sheet = new CSSStyleSheet(), GAP = 8, EDGE = 8;
  function position(pop, trigger) {
    let t = trigger.getBoundingClientRect(), w = pop.offsetWidth, h2 = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = innerHeight, below = t.bottom + GAP + h2 <= vh - EDGE || t.top - GAP - h2 < EDGE, top = below ? t.bottom + GAP : t.top - GAP - h2, left = Math.max(EDGE, Math.min(t.left - 10, vw - EDGE - w));
    pop.style.top = `${Math.round(top)}px`, pop.style.left = `${Math.round(left)}px`, pop.style.transformOrigin = `${Math.round(t.left + t.width / 2 - left)}px ${below ? 0 : h2}px`;
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

  // src/pages/action.ts
  var save = (settings) => import_browser_polyfill_min.default.runtime.sendMessage({ type: "saveSettings", settings });
  async function init() {
    let [s, statuses, tabs] = await Promise.all([
      import_browser_polyfill_min.default.runtime.sendMessage({ type: "settings" }),
      import_browser_polyfill_min.default.runtime.sendMessage({ type: "statuses" }),
      import_browser_polyfill_min.default.tabs.query({ active: !0, currentWindow: !0 })
    ]), vals = Object.values(statuses);
    $("counts").replaceChildren(
      ...[
        ["fresh", "\u65B0", "Fresh"],
        ["learning", "\u5B78", "Learning"],
        ["known", "\u719F", "Known"]
      ].map(([k, zh, label]) => {
        let n = vals.filter((v) => v === k).length;
        return h(
          "a",
          { class: k, href: `${DASHBOARD}#${k}`, target: "_blank", title: `Open your ${label.toLowerCase()} words`, "aria-label": `${n} ${label.toLowerCase()} words` },
          h("span", { class: "seal", lang: "zh-Hant" }, zh),
          h("b", null, n.toLocaleString("en-US"))
        );
      })
    ), $("feedback").href = feedbackLink(), helpPopovers(), $("words").href = DASHBOARD, $("altMode").textContent = ALT, $("altMode").title = `Only while holding ${ALT}`;
    for (let el of document.querySelectorAll(".altName"))
      el.textContent = ALT, el.title = `Only while holding ${ALT} on this website`;
    import_browser_polyfill_min.default.runtime.sendMessage({ type: "account" }).then((a) => {
      a.signedIn && ($("acctLink").textContent = a.error ? "Sync problem" : "\u2713 Synced");
    });
    let dl = $("dlNew"), newCount = async () => {
      let n = await import_browser_polyfill_min.default.runtime.sendMessage({ type: "newCount" });
      $("newN").textContent = n ? n.toLocaleString("en-US") : "", dl.disabled = !n, dl.title = n ? `Download the ${n} word${n === 1 ? "" : "s"} you changed since the last download (TSV)` : "Nothing new since your last download";
    };
    newCount(), dl.addEventListener("click", async () => {
      if (dl.disabled = !0, !await import_browser_polyfill_min.default.runtime.sendMessage({ type: "downloadNew" })) return void newCount();
      $("newN").textContent = "\u2713", setTimeout(newCount, 1500);
    });
    for (let el of document.querySelectorAll("[data-setting]")) {
      let key = el.dataset.setting;
      if (el instanceof HTMLInputElement) {
        el.checked = !!s[key], el.addEventListener("change", () => {
          s[key] = el.checked, save({ [key]: el.checked }), key === "sounds" && el.checked && playStamp("fresh"), key === "pageColors" && (syncColors(), setTimeout(showStats, 1500));
        });
        continue;
      }
      let buttons = [...el.querySelectorAll("button")], mark = (v) => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
      mark(String(s[key]));
      for (let b of buttons)
        b.addEventListener("click", () => {
          mark(b.dataset.v), s[key] = b.dataset.v, save({ [key]: b.dataset.v }), key === "hoverMode" && syncSite();
        });
    }
    let syncColors = () => {
    }, syncSite = () => {
    }, tab = tabs[0], showStats = async () => {
      try {
        let st = await import_browser_polyfill_min.default.tabs.sendMessage(tab.id, { type: "pageStats" });
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
    $("siteLine").hidden = !1;
    for (let el of document.querySelectorAll(".hostname")) el.textContent = host.replace(/^www\./, "");
    $("colorLine").hidden = !1;
    let colors = $("colorsOn");
    syncColors = () => colors.checked = colorsOn(s, host), syncColors(), colors.addEventListener("change", () => {
      let siteColors = { ...s.siteColors, [host]: colors.checked };
      s.siteColors = siteColors, save({ siteColors }), setTimeout(showStats, 1500);
    }), import_browser_polyfill_min.default.commands.getAll().then((cmds) => {
      let key = cmds.find((c) => c.name === "toggle-colors")?.shortcut;
      key && ($("colorKey").textContent = shortcutLabel(key));
    }).catch(() => {
    });
    let siteButtons = [...$("siteMode").querySelectorAll("button")];
    syncSite = () => {
      let now = cardMode(s, host);
      for (let b of siteButtons) b.setAttribute("aria-pressed", String(b.dataset.v === now));
      $("siteLine").hidden = s.hoverMode === "off";
    }, syncSite();
    for (let b of siteButtons)
      b.addEventListener("click", () => {
        let lists = setSiteMode(s, host, b.dataset.v);
        Object.assign(s, lists), syncSite(), save(lists);
      });
  }
  init();
})();
