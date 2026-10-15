import { colorsOn, type Settings, type Status } from '../shared/types.ts';
import { $, h } from './common.ts';

const save = (settings: Partial<Settings>) => browser.runtime.sendMessage({ type: 'saveSettings', settings });

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
    ] as const).map(([k, label]) =>
      h('a', { class: `count ${k}`, href: `vocab.html#${k}`, target: '_blank', title: `Open the ${label.split(' ')[1]} words` }, h('b', null, String(vals.filter((v) => v === k).length)), h('span', null, label)),
    ),
  );

  // Switches and segmented choices, each bound to one setting.
  for (const el of document.querySelectorAll<HTMLElement>('[data-setting]')) {
    const key = el.dataset.setting as keyof Settings;
    if (el instanceof HTMLInputElement) {
      el.checked = !!s[key];
      el.addEventListener('change', () => {
        (s as unknown as Record<string, unknown>)[key] = el.checked;
        void save({ [key]: el.checked });
        if (key === 'pageColors') {
          syncColors();
          setTimeout(showStats, 1500);
        }
      });
      continue;
    }
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
    const mark = (v: string) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    mark(String(s[key]));
    for (const b of buttons) {
      b.addEventListener('click', () => {
        mark(b.dataset.v!);
        void save({ [key]: b.dataset.v });
      });
    }
  }

  let syncColors = () => {};
  const tab = tabs[0];
  const showStats = async () => {
    try {
      const st = await browser.tabs.sendMessage(tab.id!, { type: 'pageStats' });
      if (!st?.on || !st.total) return ($('pageStats').textContent = '');
      const pct = (n: number) => Math.round((n / st.total) * 100);
      $('pageStats').textContent = `This page: 熟 ${pct(st.known)}% · 學 ${pct(st.learning)}% · 新 ${pct(st.fresh)}% · new ${pct(st.new)}%`;
    } catch {
      /* no content script on this tab */
    }
  };
  showStats();

  // Only real websites can have lookup switched off (not extension or browser pages).
  let host = '';
  try {
    const u = new URL(tab?.url ?? '');
    if (/^https?:$/.test(u.protocol)) host = u.hostname;
  } catch {
    /* no url (permission) */
  }
  if (!host) return;
  $('siteLine').hidden = false;
  for (const el of document.querySelectorAll('.hostname')) el.textContent = host.replace(/^www\./, '');

  // Colors on this site: its own exception to the switch above (also the shortcut).
  $('colorLine').hidden = false;
  const colors = $<HTMLInputElement>('colorsOn');
  syncColors = () => (colors.checked = colorsOn(s, host));
  syncColors();
  colors.addEventListener('change', () => {
    const siteColors = { ...s.siteColors };
    if (colors.checked === s.pageColors) delete siteColors[host];
    else siteColors[host] = colors.checked;
    s.siteColors = siteColors;
    void save({ siteColors });
    setTimeout(showStats, 1500);
  });
  browser.commands
    .getAll()
    .then((cmds) => {
      const key = cmds.find((c) => c.name === 'toggle-colors')?.shortcut;
      const mac = navigator.platform.startsWith('Mac');
      if (key) $('colorKey').textContent = `Shortcut ${mac ? key.replace('Alt', 'Option') : key}`;
    })
    .catch(() => {});
  const box = $<HTMLInputElement>('siteOn');
  box.checked = !s.disabledSites.includes(host);
  box.addEventListener('change', () => {
    const list = new Set(s.disabledSites);
    if (box.checked) list.delete(host);
    else list.add(host);
    s.disabledSites = [...list];
    void save({ disabledSites: s.disabledSites });
  });
}
init();
