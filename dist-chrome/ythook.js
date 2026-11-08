"use strict";
(() => {
  // src/platform/yt-bridge.ts
  var CAPTION_TAG = "__chineseBrainCaptions_v1", CALL_EVENT = "cb-yt-player-call-v1", REPLY_EVENT = "cb-yt-player-reply-v1", isTimedText = (url) => url.includes("/api/timedtext");

  // src/platform/yt-hook.ts
  var w = window;
  w[CAPTION_TAG] || (w[CAPTION_TAG] = !0, hookFetch(), hookXhr(), answerPlayerCalls());
  function absolute(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  }
  function post(url, body) {
    window.postMessage({ [CAPTION_TAG]: 1, url, body }, location.origin);
  }
  function hookFetch() {
    let original = window.fetch;
    if (typeof original != "function") return;
    let wrapped = function(...args) {
      let res = original.apply(this, args), url = "";
      try {
        let input = args[0];
        url = absolute(input instanceof Request ? input.url : String(input));
      } catch {
      }
      return url && isTimedText(url) && res.then((r) => r.clone().text()).then((body) => post(url, body)).catch(() => {
      }), res;
    };
    window.fetch = wrapped;
  }
  function hookXhr() {
    let proto = XMLHttpRequest.prototype, urls = /* @__PURE__ */ new WeakMap(), open = proto.open;
    proto.open = function(_method, url) {
      try {
        urls.set(this, absolute(String(url)));
      } catch {
      }
      return open.apply(this, arguments);
    };
    let send = proto.send;
    proto.send = function() {
      let url = urls.get(this);
      return url && isTimedText(url) && this.addEventListener("load", () => readXhr(this, url)), send.apply(this, arguments);
    };
  }
  function readXhr(xhr, url) {
    try {
      switch (xhr.responseType) {
        case "":
        case "text":
          return post(url, xhr.responseText);
        case "json":
          return post(url, JSON.stringify(xhr.response));
        case "arraybuffer":
          return post(url, new TextDecoder("utf-8").decode(xhr.response));
        case "blob":
          xhr.response.text().then((body) => post(url, body));
          return;
      }
    } catch {
    }
  }
  var PLAYER_METHODS = /* @__PURE__ */ new Set(["getPlayerResponse", "getOption", "setOption", "loadModule", "unloadModule"]);
  function answerPlayerCalls() {
    document.addEventListener(CALL_EVENT, (e) => {
      let out;
      try {
        let { method, args } = JSON.parse(String(e.detail)), p = document.getElementById("movie_player");
        if (!PLAYER_METHODS.has(method) || !p || typeof p[method] != "function") out = { missing: !0 };
        else {
          let value = p[method](...Array.isArray(args) ? args : []);
          method === "getPlayerResponse" && (value = captionsPart(value)), out = { value: value ?? null };
        }
      } catch (err) {
        out = { error: String(err instanceof Error ? err.message : err) };
      }
      let json;
      try {
        json = JSON.stringify(out);
      } catch {
        json = '{"value":null}';
      }
      document.dispatchEvent(new CustomEvent(REPLY_EVENT, { detail: json }));
    });
  }
  function captionsPart(resp) {
    return resp ? {
      videoDetails: { videoId: resp.videoDetails?.videoId },
      captions: { playerCaptionsTracklistRenderer: { captionTracks: resp.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [] } }
    } : null;
  }
})();
