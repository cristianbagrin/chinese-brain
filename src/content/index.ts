import { YouTubeSubs } from '../youtube/index.ts';
import { HoverLookup } from './hover.ts';
import { Popup } from './popup.ts';
import { state } from './state.ts';

declare const __TEST__: boolean;

const w = window as Window & { __chineseBrain?: boolean };
if (__TEST__) {
  window.addEventListener('message', (e) => {
    if (e.data?.cbOpen) browser.runtime.sendMessage({ type: 'openPage', page: e.data.cbOpen });
    if (e.data?.cbMsg) browser.runtime.sendMessage(e.data.cbMsg);
  });
}
if (!w.__chineseBrain) {
  w.__chineseBrain = true;
  state.ready().then(() => {
    const popup = new Popup();
    new HoverLookup(popup);
    const onYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
    if (onYouTube) new YouTubeSubs(popup);
    else {
      window.addEventListener(
        'keydown',
        (e) => {
          const t = e.target as HTMLElement | null;
          if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
          if (popup.visible && popup.handleKey(e)) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true,
      );
    }
  });
}
