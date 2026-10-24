/** A short note at the bottom of the page (after the colors shortcut). */
let host: HTMLElement | undefined;
let box: HTMLElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string) {
  if (!host || !box) {
    host = document.createElement('chinese-brain-toast');
    host.setAttribute('data-cb-own', '');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      div { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 2147483647;
        font: 500 14px/1.3 system-ui, sans-serif; color: #fff; background: rgba(30, 26, 24, 0.92);
        padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        pointer-events: none; transition: opacity 0.2s; }
      div.out { opacity: 0; }`;
    box = document.createElement('div');
    root.append(style, box);
  }
  (document.fullscreenElement ?? document.documentElement).append(host);
  box.textContent = text;
  box.classList.remove('out');
  clearTimeout(timer);
  timer = setTimeout(() => {
    box?.classList.add('out');
    timer = setTimeout(() => host?.remove(), 250);
  }, 1800);
}
