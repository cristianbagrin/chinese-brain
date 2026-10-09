import type { Settings } from '../shared/types.ts';

/** Azure Speech regions, most likely first; a key only works in its own region. */
export const AZURE_REGIONS = [
  'eastasia', 'southeastasia', 'japaneast', 'koreacentral', 'westeurope', 'northeurope', 'uksouth', 'francecentral',
  'germanywestcentral', 'swedencentral', 'switzerlandnorth', 'norwayeast', 'italynorth', 'eastus', 'eastus2', 'westus',
  'westus2', 'westus3', 'centralus', 'northcentralus', 'southcentralus', 'westcentralus', 'canadacentral', 'brazilsouth',
  'australiaeast', 'centralindia', 'japanwest', 'southafricanorth', 'uaenorth', 'qatarcentral',
];

const xml = (s: string) => s.replace(/[<&>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** MP3 audio for a word or sentence, from Google's web voice or Azure. */
export async function ttsAudio(engine: 'google' | 'azure', text: string, st: Settings): Promise<ArrayBuffer> {
  if (engine === 'google') {
    // The web voice has two speeds: normal, and a slow one for learners.
    const speed = st.speechRate < 0.75 ? '0.24' : '1';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=zh-TW&ttsspeed=${speed}&q=${encodeURIComponent(text.slice(0, 200))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google voice: HTTP ${res.status}`);
    return res.arrayBuffer();
  }
  if (!st.azureKey) throw new Error('No Azure key');
  const pct = Math.round((st.speechRate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-TW">` +
    `<voice name="${xml(st.azureVoice)}"><prosody rate="${pct}%">${xml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${st.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': st.azureKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(azureError(res.status));
  return res.arrayBuffer();
}

function azureError(status: number): string {
  if (status === 401) return 'Azure rejected the key for this region (401). Press "Check key" to find the right region.';
  if (status === 429) return 'Azure: too many requests or the free monthly quota is used up (429).';
  if (status === 400) return 'Azure: bad request (400). Try another voice.';
  return `Azure: HTTP ${status}`;
}

async function azureKeyWorks(key: string, region: string): Promise<number> {
  try {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });
    return res.status;
  } catch {
    return 0;
  }
}

/** Check an Azure key; if it fails in the chosen region, look for the region it belongs to. */
export async function checkAzure(key: string, region: string): Promise<{ ok: boolean; region?: string; error?: string }> {
  key = key.trim();
  if (!key) return { ok: false, error: 'Paste your Azure Speech key first.' };
  const first = await azureKeyWorks(key, region);
  if (first === 200) return { ok: true, region };
  if (first === 0) return { ok: false, error: 'Could not reach Azure. Check your connection.' };
  if (first !== 401 && first !== 403) return { ok: false, error: azureError(first) };
  const others = AZURE_REGIONS.filter((r) => r !== region);
  const results = await Promise.all(others.map(async (r) => [r, await azureKeyWorks(key, r)] as const));
  const hit = results.find(([, st]) => st === 200);
  if (hit) return { ok: true, region: hit[0] };
  return { ok: false, error: 'Azure did not accept this key in any region. Copy "KEY 1" from your Speech resource in the Azure portal.' };
}
