import { Dictionary } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { DEFAULT_SETTINGS, type Msg, type Settings, type Status, type WordRecord } from '../shared/types.ts';
import { shortGloss, Store } from './store.ts';
import { geminiTranscribe } from './gemini.ts';
import { translateLines } from './translate.ts';
import { cachedCaptions, startCaptionCapture } from './youtube.ts';

declare const __TEST__: boolean;

let dict: Dictionary | undefined;
const dictReady = loadDictionary();
const store = new Store();
const storeReady = store.load();

startCaptionCapture();

/** Example sentences: word -> [[sentence, English], ...]. */
const examples = new Map<string, [string, string][]>();
const examplesReady = loadExamples();

async function loadExamples() {
  try {
    const res = await fetch(browser.runtime.getURL('data/examples.tsv.gz'));
    if (!res.ok) return;
    const text = await new Response(res.body!.pipeThrough(new DecompressionStream('gzip'))).text();
    for (const line of text.split('\n')) {
      const [w, zh, en] = line.split('\t');
      if (!w || !zh) continue;
      const list = examples.get(w);
      if (list) list.push([zh, en ?? '']);
      else examples.set(w, [[zh, en ?? '']]);
    }
  } catch {
    /* no example file in this build */
  }
}

async function loadDictionary(): Promise<Dictionary> {
  const t0 = performance.now();
  const res = await fetch(browser.runtime.getURL('data/dict.tsv.gz'));
  const stream = res.body!.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  dict = Dictionary.fromTsv(text);
  console.log(`[chinese-brain] dictionary: ${dict.entries.length} entries in ${Math.round(performance.now() - t0)} ms`);
  return dict;
}

async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

browser.runtime.onMessage.addListener((msg: Msg | { type: string; [k: string]: unknown }, sender) => {
  const m = msg as Msg;
  switch (m.type) {
    case 'lookup':
      return dictReady.then((d) => d.lookup(m.text));
    case 'segment':
      return dictReady.then((d) => m.lines.map((l) => d.segment(l)));
    case 'statuses':
      return storeReady.then(() => store.statuses());
    case 'getWord':
      return storeReady.then(() => store.words.get(m.word) ?? null);
    case 'setStatus':
      return storeReady.then(() => store.setStatus(m.word, m.status, m.entry, m.ctx)).then(() => true);
    case 'looked':
      return storeReady.then(() => store.looked(m.word, m.src, m.url, m.ctx)).then(() => true);
    case 'watch':
      store.log({ at: Date.now(), k: 'watch', url: m.url, title: m.title, secs: m.secs, coverage: m.coverage, lang: m.lang });
      return Promise.resolve(true);
    case 'settings':
      return getSettings();
    case 'saveSettings':
      return getSettings().then((s) => browser.storage.local.set({ settings: { ...s, ...m.settings } }).then(() => true));
  }
  const any = msg as { type: string; [k: string]: unknown };
  switch (any.type) {
    case 'ytCached':
      return Promise.resolve(sender.tab?.id != null ? cachedCaptions(sender.tab.id) : []);
    case 'allData':
      return storeReady.then(async () => ({ words: [...store.words.values()], logs: await store.allLogs() }));
    case 'importWords':
      return storeReady.then(() => store.importWords(any.words as never, (any.mode as 'merge' | 'replace') ?? 'merge'));
    case 'insertCSS':
      if (sender.tab?.id != null)
        return browser.tabs.insertCSS(sender.tab.id, { code: any.css as string, frameId: sender.frameId ?? 0 }).then(() => true);
      return undefined;
    case 'importList':
      // [{ w, s, t }] from known-words.txt style lists. Existing words keep their history.
      return Promise.all([dictReady, storeReady]).then(async ([d]) => {
        const recs: WordRecord[] = [];
        const seen = new Set<string>();
        for (const item of any.items as { w: string; s: Status; t: number }[]) {
          const e = d.get(item.w)[0];
          const w = e && e.trad.length === item.w.length ? e.trad : item.w;
          if (seen.has(w)) continue;
          seen.add(w);
          const prev = store.words.get(w);
          if (prev?.s === item.s) continue;
          const t = item.t || Date.now();
          recs.push({
            ...(prev ?? { w, added: t, hist: [], looks: 0, ctx: [] }),
            s: item.s,
            updated: Math.max(t, prev?.updated ?? 0),
            hist: [...(prev?.hist ?? []), { t, s: item.s }],
            p: e ? numberedToMarked(e.tw || e.py) : prev?.p,
            g: e ? shortGloss(e) : prev?.g,
          } as WordRecord);
        }
        for (const r of recs) store.log({ at: Date.now(), k: 'status', w: r.w, s: r.s, from: store.words.get(r.w)?.s ?? null });
        return store.importWords(recs, 'replace');
      });
    case 'testSet':
      if (!__TEST__) return undefined;
      return browser.storage.local.set(any.data as Record<string, unknown>).then(() => true);
    case 'openPage':
      if (!__TEST__) return undefined;
      return browser.tabs.create({ url: browser.runtime.getURL(String(any.page)) }).then(() => true);
    case 'translate':
      return translateLines(any.lines as string[], String(any.sl ?? 'zh-TW'), String(any.tl ?? 'en')).catch((e) => {
        console.warn('[chinese-brain] translate fallback failed', e);
        return null;
      });
    case 'azureTTS':
      return getSettings().then(async (st) => {
        const res = await fetch(`https://${st.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': st.azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          },
          body: any.ssml as string,
        });
        if (!res.ok) throw new Error(`Azure TTS HTTP ${res.status}`);
        return res.arrayBuffer();
      });
    case 'wordInfo':
      // Everything the card shows beyond the dictionary entry: character breakdown,
      // example sentences and the user's own record.
      return Promise.all([dictReady, storeReady, examplesReady]).then(([d]) => {
        const word = any.word as string;
        const py = String(any.py ?? '');
        const sylls = py.split(/\s+/);
        const chars = [...word].length > 1
          ? [...word].map((ch, i) => {
              const e = d.charEntry(ch, sylls[i]);
              return { ch, py: sylls[i] ?? e?.tw ?? e?.py ?? '', gloss: e ? shortGloss(e) : '' };
            })
          : [];
        return { chars, examples: examples.get(word) ?? [], record: store.words.get(word) ?? null };
      });
    case 'glosses':
      return dictReady.then((d) => {
        const out: Record<string, { py: string; g: string; zipf: number }> = {};
        for (const w of any.words as string[]) {
          const e = d.get(w)[0];
          if (e) out[w] = { py: e.tw || e.py, g: shortGloss(e), zipf: e.zipf };
        }
        return out;
      });
    case 'gemini':
      return getSettings().then(async (st) => {
        if (!st.geminiKey) return { error: 'Add your Gemini API key in Settings first.' };
        try {
          return { lines: await geminiTranscribe(String(any.videoId), st.geminiKey, st.geminiModel || 'gemini-3.8-flash') };
        } catch (e) {
          return { error: String(e instanceof Error ? e.message : e) };
        }
      });
    case 'geminiCached':
      return browser.storage.local.get('gem:' + any.videoId).then((r) => r['gem:' + any.videoId] ?? null);
    case 'entries':
      return dictReady.then((d) => d.get(any.word as string));
  }
  return undefined;
});
