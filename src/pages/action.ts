import { cardMode, colorsOn, setSiteMode, type HoverMode, type Settings, type Status } from '../shared/types.ts';
import type { AccountInfo } from '../background/sync.ts';
import { $, ALT, DASHBOARD, feedbackLink, h, shortcutLabel } from './common.ts';
import { helpPopovers } from './help.ts';
import { playStamp } from '../shared/sounds.ts';

const save = (settings: Partial<Settings>) => browser.runtime.sendMessage({ type: 'saveSettings', settings });

async function init() {
  const [s, statuses, tabs]: [Settings, Record<string, Status>, browser.tabs.Tab[]] = await Promise.all([
    browser.runtime.sendMessage({ type: 'settings' }),
    browser.runtime.sendMessage({ type: 'statuses' }),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]);
  const vals = Object.values(statuses);
  // Each pile opens the word list on it.
  $('counts').replaceChildren(
    ...([
      ['fresh', '新', 'Fresh'],
      ['learning', '學', 'Learning'],
      ['known', '熟', 'Known'],
    ] as const).map(([k, zh, label]) => {
      const n = vals.filter((v) => v === k).length;
      return h(
        'a',
        { class: k, href: `${DASHBOARD}#${k}`, target: '_blank', title: `Open your ${label.toLowerCase()} words`, 'aria-label': `${n} ${label.toLowerCase()} words` },
        h('span', { class: 'seal', lang: 'zh-Hant' }, zh),
        h('b', null, n.toLocaleString('en-US')),
      );
    }),
  );

  $<HTMLAnchorElement>('feedback').href = feedbackLink();
  helpPopovers();
  $<HTMLAnchorElement>('words').href = DASHBOARD;
  $('altMode').textContent = ALT;
  $('altMode').title = `Only while holding ${ALT}`;
  for (const el of document.querySelectorAll<HTMLElement>('.altName')) {
    el.textContent = ALT;
    el.title = `Only while holding ${ALT} on this website`;
  }
  void browser.runtime.sendMessage({ type: 'account' }).then((a: AccountInfo) => {
    if (a.signedIn) $('acctLink').textContent = a.error ? 'Sync problem' : '✓ Synced';
  });

  // What you stamped since the last download, straight to a file (for Anki or a spreadsheet).
  const dl = $<HTMLButtonElement>('dlNew');
  const newCount = async () => {
    const n: number = await browser.runtime.sendMessage({ type: 'newCount' });
    $('newN').textContent = n ? n.toLocaleString('en-US') : '';
    dl.disabled = !n;
    dl.title = n ? `Download the ${n} word${n === 1 ? '' : 's'} you changed since the last download (TSV)` : 'Nothing new since your last download';
  };
  void newCount();
  dl.addEventListener('click', async () => {
    dl.disabled = true;
    const kept: boolean = await browser.runtime.sendMessage({ type: 'downloadNew' });
    if (!kept) return void newCount();
    $('newN').textContent = '✓';
    setTimeout(newCount, 1500);
  });

  // Switches and segmented choices, each bound to one setting.
  for (const el of document.querySelectorAll<HTMLElement>('[data-setting]')) {
    const key = el.dataset.setting as keyof Settings;
    if (el instanceof HTMLInputElement) {
      el.checked = !!s[key];
      el.addEventListener('change', () => {
        (s as unknown as Record<string, unknown>)[key] = el.checked;
        void save({ [key]: el.checked });
        if (key === 'sounds' && el.checked) playStamp('fresh');
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
        (s as unknown as Record<string, unknown>)[key] = b.dataset.v;
        void save({ [key]: b.dataset.v });
        if (key === 'hoverMode') syncSite();
      });
    }
  }

  let syncColors = () => {};
  let syncSite = () => {};
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
    // Remembered for this website, whatever "every website" is set to later.
    const siteColors = { ...s.siteColors, [host]: colors.checked };
    s.siteColors = siteColors;
    void save({ siteColors });
    setTimeout(showStats, 1500);
  });
  browser.commands
    .getAll()
    .then((cmds) => {
      const key = cmds.find((c) => c.name === 'toggle-colors')?.shortcut;
      if (key) $('colorKey').textContent = shortcutLabel(key);
    })
    .catch(() => {});
  // How the card opens on this website: an exception to the choice above, in one click.
  const siteButtons = [...$('siteMode').querySelectorAll<HTMLButtonElement>('button')];
  syncSite = () => {
    const now = cardMode(s, host);
    for (const b of siteButtons) b.setAttribute('aria-pressed', String(b.dataset.v === now));
    // "Never" everywhere leaves nothing to make an exception to.
    $('siteLine').hidden = s.hoverMode === 'off';
  };
  syncSite();
  for (const b of siteButtons) {
    b.addEventListener('click', () => {
      const lists = setSiteMode(s, host, b.dataset.v as HoverMode);
      Object.assign(s, lists);
      syncSite();
      void save(lists);
    });
  }
}
init();
