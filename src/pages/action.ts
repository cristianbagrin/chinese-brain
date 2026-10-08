import type { Settings, Status } from '../shared/types.ts';
import { $, h } from './common.ts';

async function init() {
  const [s, statuses, tabs]: [Settings, Record<string, Status>, browser.tabs.Tab[]] = await Promise.all([
    browser.runtime.sendMessage({ type: 'settings' }),
    browser.runtime.sendMessage({ type: 'statuses' }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]);
  const vals = Object.values(statuses);
  $('counts').replaceChildren(
    ...([
      ['fresh', '新 Fresh'],
      ['learning', '學 Learning'],
      ['known', '熟 Known'],
    ] as const).map(([k, label]) => h('div', { class: `count ${k}` }, h('b', null, String(vals.filter((v) => v === k).length)), h('span', null, label))),
  );
  const mode = $<HTMLSelectElement>('hoverMode');
  mode.value = s.hoverMode;
  mode.addEventListener('change', () => browser.runtime.sendMessage({ type: 'saveSettings', settings: { hoverMode: mode.value } }));

  let host = '';
  try {
    host = new URL(tabs[0]?.url ?? '').hostname;
  } catch {
    /* no url (permission) */
  }
  if (!host) {
    $('siteLine').hidden = true;
    return;
  }
  $('host').textContent = host;
  const box = $<HTMLInputElement>('siteOff');
  box.checked = s.disabledSites.includes(host);
  box.addEventListener('change', () => {
    const list = new Set(s.disabledSites);
    if (box.checked) list.add(host);
    else list.delete(host);
    browser.runtime.sendMessage({ type: 'saveSettings', settings: { disabledSites: [...list] } });
  });
}
init();
