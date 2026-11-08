/**
 * Chrome build: names shared by the YouTube page hook (MAIN world) and the extension's
 * content scripts (isolated world). Nothing here touches extension APIs.
 */

/** window.postMessage key for a caption body the page downloaded. */
export const CAPTION_TAG = '__chineseBrainCaptions_v1';
/** DOM events for synchronous player calls: the content script asks, the page hook answers. */
export const CALL_EVENT = 'cb-yt-player-call-v1';
export const REPLY_EVENT = 'cb-yt-player-reply-v1';

export const isTimedText = (url: string) => url.includes('/api/timedtext');
