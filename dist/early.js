"use strict";
(() => {
  // src/content/early.ts
  var w = window;
  if (!w.__cbKeys) {
    let keys = {};
    w.__cbKeys = keys, window.addEventListener("keydown", (e) => keys.fn?.(e), !0);
  }
})();
