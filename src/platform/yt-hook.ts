/**
 * Chrome build, YouTube only: runs in the page's own JavaScript world (manifest
 * `world: "MAIN"`) at document_start. Chrome has no webRequest.filterResponseData, so
 * this stands in for src/background/youtube.ts:
 *
 * - It wraps fetch and XMLHttpRequest and copies every response from /api/timedtext
 *   (the caption tracks the player downloads itself) to the content script with
 *   window.postMessage. Requests and responses pass through untouched.
 * - It answers the content script's player calls (getPlayerResponse, setOption, ...),
 *   which Firefox makes through wrappedJSObject: a CustomEvent on `document` asks, and
 *   the answer comes back synchronously in another one.
 *
 * No extension APIs here: page scripts can't use them.
 */
import { CALL_EVENT, CAPTION_TAG, REPLY_EVENT, isTimedText } from './yt-bridge.ts';

const w = window as Window & { [CAPTION_TAG]?: boolean };
if (!w[CAPTION_TAG]) {
  w[CAPTION_TAG] = true;
  hookFetch();
  hookXhr();
  answerPlayerCalls();
}

function absolute(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function post(url: string, body: string) {
  window.postMessage({ [CAPTION_TAG]: 1, url, body }, location.origin);
}

function hookFetch() {
  const original = window.fetch;
  if (typeof original !== 'function') return;
  const wrapped = function (this: unknown, ...args: Parameters<typeof fetch>): Promise<Response> {
    const res = original.apply(this, args);
    let url = '';
    try {
      const input = args[0];
      url = absolute(input instanceof Request ? input.url : String(input));
    } catch {
      /* an odd input: not ours */
    }
    if (url && isTimedText(url)) {
      res
        .then((r) => r.clone().text())
        .then((body) => post(url, body))
        .catch(() => {});
    }
    return res;
  };
  window.fetch = wrapped as typeof window.fetch;
}

function hookXhr() {
  const proto = XMLHttpRequest.prototype;
  const urls = new WeakMap<XMLHttpRequest, string>();
  const open = proto.open;
  proto.open = function (this: XMLHttpRequest, _method: string, url: string | URL) {
    try {
      urls.set(this, absolute(String(url)));
    } catch {
      /* not ours */
    }
    // eslint-disable-next-line prefer-rest-params
    return (open as (...a: unknown[]) => void).apply(this, arguments as unknown as unknown[]);
  } as typeof proto.open;
  const send = proto.send;
  proto.send = function (this: XMLHttpRequest) {
    const url = urls.get(this);
    if (url && isTimedText(url)) this.addEventListener('load', () => readXhr(this, url));
    // eslint-disable-next-line prefer-rest-params
    return (send as (...a: unknown[]) => void).apply(this, arguments as unknown as unknown[]);
  };
}

function readXhr(xhr: XMLHttpRequest, url: string) {
  try {
    switch (xhr.responseType) {
      case '':
      case 'text':
        return post(url, xhr.responseText);
      case 'json':
        return post(url, JSON.stringify(xhr.response));
      case 'arraybuffer':
        return post(url, new TextDecoder('utf-8').decode(xhr.response as ArrayBuffer));
      case 'blob':
        void (xhr.response as Blob).text().then((body) => post(url, body));
        return;
    }
  } catch {
    /* unreadable: the player still has it */
  }
}

const PLAYER_METHODS = new Set(['getPlayerResponse', 'getOption', 'setOption', 'loadModule', 'unloadModule']);

function answerPlayerCalls() {
  document.addEventListener(CALL_EVENT, (e) => {
    let out: { value?: unknown; error?: string; missing?: true };
    try {
      const { method, args } = JSON.parse(String((e as CustomEvent).detail)) as { method: string; args: unknown[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = document.getElementById('movie_player') as any;
      if (!PLAYER_METHODS.has(method) || !p || typeof p[method] !== 'function') out = { missing: true };
      else {
        let value = p[method](...(Array.isArray(args) ? args : []));
        if (method === 'getPlayerResponse') value = captionsPart(value);
        out = { value: value ?? null };
      }
    } catch (err) {
      out = { error: String(err instanceof Error ? err.message : err) };
    }
    let json: string;
    try {
      json = JSON.stringify(out);
    } catch {
      json = '{"value":null}';
    }
    document.dispatchEvent(new CustomEvent(REPLY_EVENT, { detail: json }));
  });
}

/** Only what the content script reads: the full player response is large. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function captionsPart(resp: any) {
  if (!resp) return null;
  return {
    videoDetails: { videoId: resp.videoDetails?.videoId },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: resp.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [] } },
  };
}
