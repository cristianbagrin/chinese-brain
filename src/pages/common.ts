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

/**
 * Save through Firefox's save-as dialog, which opens in the folder used last.
 * False if you cancel it. Without the downloads API (Android), a plain download.
 */
export async function saveAs(name: string, content: string, type = 'text/plain;charset=utf-8'): Promise<boolean> {
  if (!browser.downloads?.download) {
    download(name, content, type);
    return true;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    const id = await browser.downloads.download({ url, filename: name, saveAs: true });
    const done = (d: browser.downloads._OnChangedDownloadDelta) => {
      if (d.id !== id || !d.state || d.state.current === 'in_progress') return;
      browser.downloads.onChanged.removeListener(done);
      URL.revokeObjectURL(url);
    };
    browser.downloads.onChanged.addListener(done);
    return true;
  } catch (e) {
    URL.revokeObjectURL(url);
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return false;
    download(name, content, type); // saveAs not supported here: save it the plain way
    return true;
  }
}

export function h(tag: string, attrs: Record<string, string> | null, ...kids: (Node | string | null | undefined | false)[]): HTMLElement {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(k);
  return el;
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ago(t: number): string {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} days ago`;
  const d = new Date(t);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
}
