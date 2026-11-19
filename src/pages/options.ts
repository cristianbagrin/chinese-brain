import { speak } from '../content/audio.ts';
import { state } from '../content/state.ts';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.ts';
import { KEY_ACTIONS, keyLabel, keyName, keyOf, type KeyAction } from '../shared/keys.ts';
import type { AccountInfo } from '../background/sync.ts';
import type { Status, WordRecord } from '../shared/types.ts';
import { $, ago, ALT, DASHBOARD, download, feedbackLink, shortcutLabel, today } from './common.ts';
import { helpPopovers } from './help.ts';
import { playStamp } from '../shared/sounds.ts';
import { Popup } from '../content/popup.ts';
import type { LookupMatch } from '../shared/types.ts';

type Key = keyof Settings;
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const AZURE_REGIONS = [
  'eastasia', 'southeastasia', 'japaneast', 'japanwest', 'koreacentral', 'centralindia', 'australiaeast', 'westeurope',
  'northeurope', 'uksouth', 'francecentral', 'germanywestcentral', 'swedencentral', 'switzerlandnorth', 'norwayeast',
  'italynorth', 'eastus', 'eastus2', 'westus', 'westus2', 'westus3', 'centralus', 'northcentralus', 'southcentralus',
  'westcentralus', 'canadacentral', 'brazilsouth', 'southafricanorth', 'uaenorth', 'qatarcentral',
];

let settings: Settings;
let savedTimer: ReturnType<typeof setTimeout> | undefined;

function setStatus(id: string, text: string, kind: 'ok' | 'err' | '' = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `status ${kind}`;
}

/** Make sure a select can show the stored value even when it isn't one of the listed choices. */
function ensureOption(el: HTMLSelectElement, value: string, label = value) {
  if (value && ![...el.options].some((o) => o.value === value)) el.append(new Option(label, value));
}

function fill(el: Field, key: Key) {
  const v = settings[key];
  if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!v;
  else if (Array.isArray(v)) el.value = v.join('\n');
  else {
    if (el instanceof HTMLSelectElement) ensureOption(el, String(v));
    el.value = String(v);
  }
}

async function save(key: Key, el: Field) {
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
  if (JSON.stringify(settings[key]) === JSON.stringify(value)) return;
  settings = { ...settings, [key]: value };
  state.settings = settings;
  await browser.runtime.sendMessage({ type: 'saveSettings', settings: { [key]: value } });
  const tag = $('saved');
  tag.classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => tag.classList.remove('show'), 1400);
  showWhen();
  // Show, don't tell: switching sounds on, or picking a pile, plays its stamp.
  if (key === 'sounds' && value) playStamp('fresh');
  if (key === 'clickStamp' && value !== 'off' && settings.sounds) playStamp(value as Status);
  if (key === 'cardSize' || key === 'pron') void preview(el);
  if (key === 'azureKey') setStatus('azureStatus', '');
  if (key === 'geminiKey') setStatus('geminiStatus', '');
}

/** The real card, next to the control you just changed (card size, pronunciation): see it, not a description. */
let card: Popup | undefined;
async function preview(near: Field) {
  const matches: LookupMatch[] = await browser.runtime.sendMessage({ type: 'lookup', text: '臺北' });
  if (!matches?.length) return;
  if (!card) {
    card = new Popup();
    const close = (e: Event) => {
      if (!card?.visible || card.contains(e.target)) return;
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      card.hide();
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close, true);
    addEventListener('scroll', () => card?.visible && card.hide(), { passive: true });
  }
  const row = (near.closest('.row') ?? near).getBoundingClientRect();
  void card.show({ matches: matches.slice(0, 1), rect: new DOMRect(row.right - 220, row.top, 200, row.height), src: 'web', pinned: true });
}

/** Websites whose word colors you switched on their own: click one to let it follow "every website" again. */
function showSites() {
  const sites = Object.entries(settings.siteColors).sort(([a], [b]) => a.localeCompare(b));
  $('siteColorsRow').hidden = !sites.length;
  $('siteColors').replaceChildren(
    ...sites.map(([host, on]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = on ? 'on' : 'off';
      b.title = 'Forget this website’s own setting';
      const flag = document.createElement('b');
      flag.textContent = on ? 'on' : 'off';
      const x = document.createElement('i');
      x.textContent = '×';
      b.append(host.replace(/^www\./, ''), flag, x);
      b.addEventListener('click', async () => {
        const siteColors = { ...settings.siteColors };
        delete siteColors[host];
        settings = { ...settings, siteColors };
        state.settings = settings;
        await browser.runtime.sendMessage({ type: 'saveSettings', settings: { siteColors } });
        showSites();
      });
      return b;
    }),
  );
}

/** A select with a few choices becomes a segmented picker; the select stays (hidden) and keeps saving. */
function segmented(sel: HTMLSelectElement) {
  const seg = document.createElement('div');
  seg.className = 'seg still';
  seg.setAttribute('role', 'radiogroup');
  const label = document.querySelector(`label[for="${sel.id}"]`)?.textContent?.trim();
  if (label) seg.setAttribute('aria-label', label);
  const thumb = document.createElement('i');
  thumb.className = 'thumb';
  const buttons = [...sel.options].map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.v = o.value;
    b.textContent = o.dataset.short ?? o.textContent;
    if (o.title) b.title = o.title;
    if (o.lang) b.lang = o.lang;
    b.addEventListener('click', () => pick(o.value));
    return b;
  });
  const sync = () => {
    for (const b of buttons) {
      const on = b.dataset.v === sel.value;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && b.offsetWidth) {
        thumb.style.width = `${b.offsetWidth}px`;
        thumb.style.transform = `translateX(${b.offsetLeft}px)`;
      }
    }
  };
  const pick = (v: string) => {
    if (sel.value === v) return;
    seg.classList.remove('still');
    sel.value = v;
    sel.dispatchEvent(new Event('change'));
    sync();
  };
  seg.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = Math.min(buttons.length - 1, Math.max(0, sel.selectedIndex + step));
    pick(sel.options[i].value);
    buttons[i].focus();
  });
  seg.append(thumb, ...buttons);
  sel.hidden = true;
  sel.after(seg);
  sync();
  // Sizes settle once the fonts load (and change with the window): the thumb follows without sliding.
  new ResizeObserver(() => {
    seg.classList.add('still');
    sync();
  }).observe(seg);
}

/** A number field gets − and + around it, with its unit. */
function stepper(input: HTMLInputElement) {
  const wrap = document.createElement('span');
  wrap.className = 'stepper';
  const btn = (text: string, label: string, dir: 1 | -1) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      if (dir > 0) input.stepUp();
      else input.stepDown();
      input.dispatchEvent(new Event('change'));
      sync();
    });
    return b;
  };
  const minus = btn('−', 'Less', -1);
  const plus = btn('+', 'More', 1);
  const sync = () => {
    minus.disabled = Number(input.value) <= Number(input.min);
    plus.disabled = Number(input.value) >= Number(input.max);
  };
  const val = document.createElement('span');
  val.className = 'val';
  input.replaceWith(wrap);
  val.append(input);
  if (input.dataset.unit) {
    const u = document.createElement('span');
    u.className = 'unit';
    u.textContent = input.dataset.unit;
    val.append(u);
  }
  wrap.append(minus, val, plus);
  input.addEventListener('input', sync);
  sync();
}

/** The sidebar marks the section in view. */
function followSections() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
  const mark = (id: string) => links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${id}`)));
  const secs = [...document.querySelectorAll<HTMLElement>('main .sec')];
  const update = () => {
    const line = Math.min(window.innerHeight * 0.3, 240);
    let current = secs[0];
    for (const s of secs) if (s.getBoundingClientRect().top <= line) current = s;
    // At the bottom of the page the last section counts, even when it is short.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = secs[secs.length - 1];
    mark(current.id);
    const link = links.find((a) => a.hash === `#${current.id}`);
    // Narrow windows: keep the current section's tab in view.
    link?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  let raf = 0;
  window.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  }, { passive: true });
  // Sections grow as they fill in (the account appears a moment later): look again.
  new ResizeObserver(update).observe(document.querySelector('main')!);
}

/**
 * A control shows only when it makes sense for the choices above it: data-when="key" (on, or
 * filled in), "key=value", "key!=value". Checked again after every change.
 */
function showWhen() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-when]')) {
    const m = /^(\w+)(?:(!?=)(.+))?$/.exec(el.dataset.when!);
    if (!m) continue;
    const v = settings[m[1] as Key];
    el.hidden = !(m[2] === '=' ? String(v) === m[3] : m[2] === '!=' ? String(v) !== m[3] : Array.isArray(v) ? v.length > 0 : !!v);
  }
}

async function init() {
  settings = await browser.runtime.sendMessage({ type: 'settings' });
  state.settings = settings;
  const region = $<HTMLSelectElement>('azureRegion');
  for (const r of AZURE_REGIONS) region.append(new Option(r, r));
  const model = $<HTMLSelectElement>('geminiModel');
  ensureOption(model, settings.geminiModel);

  for (const key of Object.keys(DEFAULT_SETTINGS) as Key[]) {
    const el = $(key) as Field | null;
    if (!el) continue;
    fill(el, key);
    el.addEventListener('change', () => void save(key, el));
    // Typed fields save as you type (no need to press Enter or leave the field).
    if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(text|password|number)$/.test(el.type))) {
      let t: ReturnType<typeof setTimeout> | undefined;
      el.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => void save(key, el), 500);
      });
    }
  }
  for (const sel of document.querySelectorAll<HTMLSelectElement>('select[data-seg]')) segmented(sel);
  for (const input of document.querySelectorAll<HTMLInputElement>('input[type="number"]')) stepper(input);
  showWhen();
  showSites();
  showKeys();
  followSections();
  if (settings.geminiKey) void loadModels(false);
  // A link straight to a section (the YouTube panel's "Add a Gemini key"), once the account above it has its height.
  void showAccount().finally(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  });
}

// ---------- Account ----------

function renderAccount(a: AccountInfo, note = '') {
  $('acct').hidden = false;
  $('signedOut').hidden = a.signedIn;
  $('signedIn').hidden = !a.signedIn;
  if (a.signedIn) {
    $('acctEmail').textContent = a.email;
    $('acctEmail').title = a.email;
    $('acctInitial').textContent = a.email.trim().charAt(0);
    const el = $('acctSync');
    el.textContent = a.error ?? (a.at ? `Synced ${ago(a.at)}` : 'Syncing…');
    el.className = a.error ? 'err' : a.at ? '' : 'busy';
  } else {
    if (a.email && !$<HTMLInputElement>('email').value) $<HTMLInputElement>('email').value = a.email;
    setStatus('acctStatus', note || a.error || '', note ? 'ok' : 'err');
  }
}

async function showAccount() {
  renderAccount(await browser.runtime.sendMessage({ type: 'account' }));
}

async function signIn(create: boolean) {
  const form = $<HTMLFormElement>('signedOut');
  if (!form.reportValidity()) return;
  // Firefox asks, in its own words, before an email address leaves the browser.
  try {
    const ok = await (browser.permissions.request as (p: object) => Promise<boolean>)({ data_collection: ['personallyIdentifyingInfo', 'authenticationInfo'] });
    if (!ok) return setStatus('acctStatus', 'An account needs that permission.', 'err');
  } catch {
    /* a browser without data-collection permissions (Chrome, older Firefox) */
  }
  setStatus('acctStatus', create ? 'Creating your account…' : 'Signing in…');
  const a: AccountInfo = await browser.runtime.sendMessage({ type: 'signIn', email: $<HTMLInputElement>('email').value, password: $<HTMLInputElement>('password').value, create });
  $<HTMLInputElement>('password').value = '';
  renderAccount(a);
}

$('signedOut').addEventListener('submit', (e) => {
  e.preventDefault();
  void signIn(false);
});
$('signUp').addEventListener('click', () => void signIn(true));
$('forgot').addEventListener('click', async () => {
  const email = $<HTMLInputElement>('email');
  if (!email.value || !email.checkValidity()) {
    email.focus();
    return setStatus('acctStatus', 'Type your email first.', 'err');
  }
  setStatus('acctStatus', 'Sending…');
  const res: { ok?: boolean; error?: string } = await browser.runtime.sendMessage({ type: 'forgot', email: email.value });
  setStatus('acctStatus', res.ok ? 'Check your inbox for a link to set a new password.' : (res.error ?? 'That didn’t work.'), res.ok ? 'ok' : 'err');
});
$('syncNow').addEventListener('click', async () => {
  $('acctSync').textContent = 'Syncing…';
  $('acctSync').className = 'busy';
  renderAccount(await browser.runtime.sendMessage({ type: 'syncNow' }));
});
$('signOut').addEventListener('click', async () => renderAccount(await browser.runtime.sendMessage({ type: 'signOut' }), 'Signed out. Your words stay in this browser.'));

// ---------- Shortcuts ----------

let recording: (() => void) | undefined;

function showKeys() {
  for (const [id, group] of [['keysCard', 'card'], ['keysYt', 'yt']] as const) {
    const actions = (Object.keys(KEY_ACTIONS) as KeyAction[]).filter((a) => KEY_ACTIONS[a].group === group);
    // Two columns, read down the first, then the second.
    const rows = Math.ceil(actions.length / 2);
    $(id).style.gridTemplateRows = `repeat(${rows}, auto)`;
    $(id).replaceChildren(
      ...actions.map((a, i) => {
          const key = keyOf(settings, a);
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = key ? keyLabel(key) : '—';
          b.className = key ? '' : 'none';
          b.title = 'Click, then press the new key (Backspace: no key)';
          b.addEventListener('click', () => record(a, b));
          const row = document.createElement('div');
          if (i >= rows) row.classList.add('col2');
          if (i % rows === 0) row.classList.add('top');
          row.append(KEY_ACTIONS[a].label, b);
          return row;
        }),
    );
  }
}

function record(action: KeyAction, b: HTMLButtonElement) {
  recording?.();
  b.textContent = 'Press a key';
  b.className = 'rec';
  const onKey = (e: KeyboardEvent) => {
    if (/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    recording?.();
    if (e.key === 'Escape') return;
    const clear = e.key === 'Backspace' || e.key === 'Delete';
    // Keys that already mean something in the card or the player stay theirs.
    if (!clear && (e.ctrlKey || e.metaKey || e.altKey || /^(Enter|Tab|Arrow|F\d|Page|Home|End)/.test(e.key))) return;
    const k = clear ? '' : keyName(e);
    const keys = { ...settings.keys };
    // One key, one action: whatever had it before is left without a key.
    if (k) for (const other of Object.keys(KEY_ACTIONS) as KeyAction[]) if (other !== action && keyOf(settings, other) === k) keys[other] = '';
    if (k === KEY_ACTIONS[action].key) delete keys[action];
    else keys[action] = k;
    void saveKeys(keys);
  };
  recording = () => {
    window.removeEventListener('keydown', onKey, true);
    recording = undefined;
    showKeys();
  };
  window.addEventListener('keydown', onKey, true);
}

async function saveKeys(keys: Settings['keys']) {
  settings = { ...settings, keys };
  state.settings = settings;
  await browser.runtime.sendMessage({ type: 'saveSettings', settings: { keys } });
  showKeys();
}

$('resetKeys').addEventListener('click', () => void saveKeys({}));

// Key names as this computer calls them.
for (const el of document.querySelectorAll('.altKey')) el.textContent = ALT;
helpPopovers();
$('altOption').textContent = `while holding ${ALT}`;
$('altOption').dataset.short = `Hold ${ALT}`;
browser.commands
  .getAll()
  .then((cmds) => {
    $('colorKey').textContent = shortcutLabel(cmds.find((c) => c.name === 'toggle-colors')?.shortcut);
    $('colorAllKey').textContent = shortcutLabel(cmds.find((c) => c.name === 'toggle-colors-all')?.shortcut);
  })
  .catch(() => {});
for (const b of document.querySelectorAll('.changeKey')) {
  b.addEventListener('click', () => {
    // The browser keeps these two (they work on every page): Chrome has a page for them, Firefox a menu.
    if (__CHROME__) void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    else {
      const f = (browser.commands as unknown as Record<string, (() => Promise<void>) | undefined>)[['open', 'ShortcutSettings'].join('')]; // Firefox 137+ (web-ext's linter doesn't know it yet)
      if (f) void f();
      else alert('Open about:addons, click the gear, then "Manage Extension Shortcuts".');
    }
  });
}

// ---------- Data and help ----------

for (const a of document.querySelectorAll<HTMLAnchorElement>('a.words')) a.href = DASHBOARD;

$('backup').addEventListener('click', async () => {
  const all = await browser.storage.local.get(null);
  // Not the account's session: a backup file must not sign anyone in.
  delete all.acct;
  delete all['acct:dirty'];
  download(`chinese-brain-backup-${today()}.json`, JSON.stringify({ app: 'chinese-brain', v: 1, at: Date.now(), data: all }), 'application/json');
});
$('restore').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  let data: Record<string, unknown> | undefined;
  try {
    const json = JSON.parse(await f.text());
    if (json.app === 'chinese-brain') data = json.data;
  } catch {
    /* not JSON */
  }
  if (!data) return setStatus('backupStatus', 'That isn’t a Chinese Brain backup.', 'err');
  const recs = Object.entries(data)
    .filter(([k]) => k.startsWith('w:'))
    .map(([, v]) => v as WordRecord);
  const n: number = await browser.runtime.sendMessage({ type: 'importWords', words: recs, mode: 'merge' });
  // Everything else (saved sentences, settings) comes back where this browser has nothing of its own.
  const existing = await browser.storage.local.get(null);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (!k.startsWith('w:') && !k.startsWith('acct') && !(k in existing)) extra[k] = v;
  await browser.storage.local.set(extra);
  setStatus('backupStatus', `✓ Restored ${n} word${n === 1 ? '' : 's'}.`, 'ok');
});


$('version').textContent = browser.runtime.getManifest().version;
$<HTMLAnchorElement>('feedback').href = feedbackLink();

$('testVoice').addEventListener('click', async () => {
  setStatus('voiceStatus', 'Playing…');
  const res = await speak('你好，很高興認識你');
  const names = { google: 'Google voice', azure: 'Azure voice', system: 'system voice' };
  if (res.engine === settings.voice) setStatus('voiceStatus', `✓ ${names[res.engine]}`, 'ok');
  else setStatus('voiceStatus', `${res.errors[0] ?? 'Failed'} Used the ${names[res.engine]} instead.`, 'err');
});

$('checkAzure').addEventListener('click', async () => {
  const key = $<HTMLInputElement>('azureKey');
  await save('azureKey', key);
  setStatus('azureStatus', 'Checking…');
  const res: { ok: boolean; region?: string; error?: string } = await browser.runtime.sendMessage({
    type: 'azureCheck',
    key: key.value,
    region: settings.azureRegion,
  });
  if (!res.ok) return setStatus('azureStatus', res.error ?? 'The key did not work.', 'err');
  const region = $<HTMLSelectElement>('azureRegion');
  if (res.region && res.region !== settings.azureRegion) {
    ensureOption(region, res.region);
    region.value = res.region;
    await save('azureRegion', region);
  }
  setStatus('azureStatus', `✓ The key works (region ${res.region}).`, 'ok');
});

async function loadModels(report: boolean) {
  const key = $<HTMLInputElement>('geminiKey').value.trim();
  if (!key) return setStatus('geminiStatus', 'Paste your Gemini API key first.', 'err');
  if (report) setStatus('geminiStatus', 'Checking…');
  const res: { models?: { id: string; name: string }[]; error?: string } = await browser.runtime.sendMessage({ type: 'geminiModels', key });
  if (!res.models) return setStatus('geminiStatus', res.error ?? 'The key did not work.', 'err');
  const sel = $<HTMLSelectElement>('geminiModel');
  sel.replaceChildren(...res.models.map((m) => new Option(`${m.name}  (${m.id})`, m.id)));
  const current = settings.geminiModel;
  if (res.models.some((m) => m.id === current)) sel.value = current;
  else {
    // The saved model isn't offered to this key: switch to the newest stable flash model.
    const pick = res.models.find((m) => /flash/.test(m.id) && !/lite|preview|exp/.test(m.id)) ?? res.models[0];
    if (pick) {
      sel.value = pick.id;
      await save('geminiModel', sel);
    }
  }
  if (report) setStatus('geminiStatus', `✓ The key works. ${res.models.length} models available.`, 'ok');
}

$('checkGemini').addEventListener('click', async () => {
  await save('geminiKey', $<HTMLInputElement>('geminiKey'));
  await loadModels(true);
});

init();
