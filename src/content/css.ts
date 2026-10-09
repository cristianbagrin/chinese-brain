/**
 * Add CSS to the page itself (needed for ::highlight rules). On web pages it goes through
 * tabs.insertCSS, which no page CSP can block; the extension's own pages take a <style>.
 */
export function addPageCSS(css: string) {
  if (location.protocol === 'moz-extension:') {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  } else browser.runtime.sendMessage({ type: 'insertCSS', css });
}
