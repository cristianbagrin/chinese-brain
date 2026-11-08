/**
 * Chrome build: the YouTube player as the content script sees it. Firefox reaches the
 * page's player object through wrappedJSObject; Chrome's isolated world can't, so each
 * call goes to the page hook (src/platform/yt-hook.ts) as a DOM event and the answer
 * comes back synchronously.
 */
import { CALL_EVENT, REPLY_EVENT } from './yt-bridge.ts';

function call(method: string, args: unknown[]): unknown {
  let reply: unknown;
  const onReply = (e: Event) => (reply = (e as CustomEvent).detail);
  document.addEventListener(REPLY_EVENT, onReply);
  try {
    document.dispatchEvent(new CustomEvent(CALL_EVENT, { detail: JSON.stringify({ method, args }) }));
  } finally {
    document.removeEventListener(REPLY_EVENT, onReply);
  }
  if (typeof reply !== 'string') return undefined; // no page hook
  const r = JSON.parse(reply) as { value?: unknown; error?: string; missing?: true };
  if (r.error) throw new Error(r.error);
  return r.value ?? undefined;
}

/** A stand-in with the methods src/youtube/index.ts uses, or undefined without a player. */
export function pagePlayer() {
  if (!document.getElementById('movie_player')) return undefined;
  return {
    getPlayerResponse: () => call('getPlayerResponse', []),
    getOption: (module: string, key: string) => call('getOption', [module, key]),
    setOption: (module: string, key: string, value: unknown) => call('setOption', [module, key, value]),
    loadModule: (module: string) => call('loadModule', [module]),
    unloadModule: (module: string) => call('unloadModule', [module]),
  };
}
