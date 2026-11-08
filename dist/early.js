"use strict";
(() => {
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
