import { speak } from '../content/audio.ts';
import { state } from '../content/state.ts';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.ts';
import { KEY_ACTIONS, keyLabel, keyName, keyOf, type KeyAction } from '../shared/keys.ts';
import type { AccountInfo } from '../background/sync.ts';
import { $, ago, supportLink } from './common.ts';

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
  tag.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (tag.hidden = true), 1200);
  if (key === 'voice') showAzure();
  if (key === 'azureKey') setStatus('azureStatus', '');
  if (key === 'geminiKey') setStatus('geminiStatus', '');
}

function showAzure() {
  document.querySelectorAll<HTMLElement>('.azure').forEach((el) => (el.hidden = settings.voice !== 'azure'));
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
  showAzure();
  showKeys();
  void showAccount();
  if (settings.geminiKey) void loadModels(false);
  // A link straight to a section (the YouTube panel's "Add a Gemini key").
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// ---------- Account ----------

function renderAccount(a: AccountInfo, note = '') {
  $('acct').hidden = false;
  $('signedOut').hidden = a.signedIn;
  $('signedIn').hidden = !a.signedIn;
  if (a.signedIn) {
    $('acctEmail').textContent = a.email;
    const el = $('acctSync');
    el.textContent = a.error ?? (a.at ? `Synced ${ago(a.at)}` : 'Syncing…');
    el.className = a.error ? 'status err' : '';
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
  renderAccount(await browser.runtime.sendMessage({ type: 'syncNow' }));
});
$('signOut').addEventListener('click', async () => renderAccount(await browser.runtime.sendMessage({ type: 'signOut' }), 'Signed out. Your words stay in this browser.'));

// ---------- Shortcuts ----------

let recording: (() => void) | undefined;

function showKeys() {
  for (const [id, group] of [['keysCard', 'card'], ['keysYt', 'yt']] as const) {
    $(id).replaceChildren(
      ...(Object.keys(KEY_ACTIONS) as KeyAction[])
        .filter((a) => KEY_ACTIONS[a].group === group)
        .map((a) => {
          const key = keyOf(settings, a);
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = key ? keyLabel(key) : '—';
          b.className = key ? '' : 'none';
          b.title = 'Click, then press the new key (Backspace: no key)';
          b.addEventListener('click', () => record(a, b));
          const row = document.createElement('div');
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

const mac = navigator.platform.startsWith('Mac');
if (mac) $('altKey').textContent = '⌥ Option';
browser.commands
  .getAll()
  .then((cmds) => {
    const key = cmds.find((c) => c.name === 'toggle-colors')?.shortcut;
    $('colorKey').textContent = key ? (mac ? key.replace('Alt', '⌥ Option') : key) : 'none';
  })
  .catch(() => {});
$('changeColorKey').addEventListener('click', () => {
  // The browser keeps this one (it works on every page): Chrome has a page for it, Firefox a menu.
  if (__CHROME__) void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  else {
    const f = (browser.commands as unknown as Record<string, (() => Promise<void>) | undefined>)[['open', 'ShortcutSettings'].join('')]; // Firefox 137+ (web-ext's linter doesn't know it yet)
    if (f) void f();
    else alert('Open about:addons, click the gear, then "Manage Extension Shortcuts".');
  }
});

// ---------- Help ----------

$('version').textContent = browser.runtime.getManifest().version;
$<HTMLAnchorElement>('bug').href = supportLink('bug');
$<HTMLAnchorElement>('ask').href = supportLink('question');

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
