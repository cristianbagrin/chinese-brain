export function download(name: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function h(tag: string, attrs: Record<string, string> | null, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export { today } from '../shared/time.ts';

export function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
}

export const SUPPORT = 'chris@cristianbagrin.com';
/** The word list lives on the website (it reads this browser's words through the extension). */
export const DASHBOARD = `${__SITE__}/brain/dashboard`;

/** On a Mac the Alt key is called Option. */
export const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
export const ALT = MAC ? '⌥ Option' : 'Alt';
/** A browser shortcut ("Alt+Shift+C") in this computer's words. */
export const shortcutLabel = (key: string | undefined) => (key ? (MAC ? key.replace('Alt', '⌥ Option').replace('Ctrl', '⌃ Control').replace('Command', '⌘') : key) : 'not set');

/** An email to the developer, already saying which version and browser this is. */
export function feedbackLink(): string {
  const v = browser.runtime.getManifest().version;
  const body = `\n\n\n(Reporting a bug? Say what happened and on which page or video. A screenshot helps a lot.)\n--\nChinese Brain ${v} · ${navigator.userAgent}`;
  return `mailto:${SUPPORT}?subject=${encodeURIComponent('Chinese Brain feedback')}&body=${encodeURIComponent(body)}`;
}
