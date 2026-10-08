import { DEFAULT_SETTINGS, type Settings } from '../shared/types.ts';
import { $ } from './common.ts';

type Key = keyof Settings;

async function init() {
  const s: Settings = await browser.runtime.sendMessage({ type: 'settings' });
  for (const key of Object.keys(DEFAULT_SETTINGS) as Key[]) {
    const el = $(key) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!el) continue;
    const v = s[key];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!v;
    else if (Array.isArray(v)) el.value = v.join('\n');
    else el.value = String(v);
    el.addEventListener('change', () => save(key, el));
  }
}

function save(key: Key, el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const def = DEFAULT_SETTINGS[key];
  let value: unknown;
  if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
  else if (typeof def === 'number') value = Number(el.value) || def;
  else if (Array.isArray(def))
    value = el.value
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);
  else value = el.value.trim();
  browser.runtime.sendMessage({ type: 'saveSettings', settings: { [key]: value } });
}

init();
