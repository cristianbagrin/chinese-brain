import { speak } from '../content/audio.ts';
import { state } from '../content/state.ts';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types.ts';
import { $ } from './common.ts';

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
  if (settings.geminiKey) void loadModels(false);
}

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
