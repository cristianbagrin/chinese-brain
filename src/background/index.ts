import { cleanSentence, usefulSentence } from '../shared/context.ts';
import { Dictionary } from '../shared/dict.ts';
import type { Entry, SavedSentence } from '../shared/types.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { DEFAULT_SETTINGS, normalizeSettings, type Msg, type Settings, type Status, type WordRecord } from '../shared/types.ts';
import { shortGloss, Store } from './store.ts';
import { geminiExamples, geminiModels, geminiTranscribe } from './gemini.ts';
import { checkAzure, ttsAudio } from './speech.ts';
import { translateLines } from './translate.ts';
import { ExampleBank } from './examples.ts';
import { cachedCaptions, startCaptionCapture } from './youtube.ts';

declare const __TEST__: boolean;

let dict: Dictionary | undefined;
const dictReady = loadDictionary();
const store = new Store();
const storeReady = store.load();

startCaptionCapture();

/** Example sentences, and the best two for a word and for you. */
const examples = new ExampleBank();
const examplesReady = loadExamples();

async function loadExamples() {
  try {
    const res = await fetch(browser.runtime.getURL('data/examples.tsv.gz'));
    if (!res.ok) return;
    examples.load(await new Response(res.body!.pipeThrough(new DecompressionStream('gzip'))).text());
    // Which sentences use which words: built quietly once the dictionary is there.
    void dictReady.then((d) => examples.buildIndex(d));
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

/**
 * A word broken down top to bottom: smaller words first, then their characters
 * (臺北市 -> 臺北 -> 臺, 北; then 市). Readings come from the whole word, so a
 * part is read the way it is read here.
 */
function breakdown(d: Dictionary, word: string, sylls: string[], depth = 0, out: { ch: string; py: string; gloss: string; depth: number }[] = []) {
  const aligned = sylls.length === [...word].length;
  let i = 0;
  for (const part of d.split(word)) {
    const n = [...part].length;
    const py = aligned ? sylls.slice(i, i + n).join(' ') : '';
    let e: Entry | undefined;
    if (n === 1) e = d.charEntry(part, aligned ? sylls[i] : undefined);
    else {
      const list = d.get(part);
      e = list.find((x) => (x.tw || x.py).toLowerCase() === py.toLowerCase()) ?? list[0];
    }
    out.push({ ch: part, py: py || (e ? e.tw || e.py : ''), gloss: e ? shortGloss(e) : '', depth });
    if (n > 1) breakdown(d, part, aligned ? sylls.slice(i, i + n) : [], depth + 1, out);
    i += n;
  }
  return out;
}

async function getSettings(): Promise<Settings> {
  const { settings } = await browser.storage.local.get('settings');
  return normalizeSettings(settings as Record<string, unknown> | undefined);
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
      return storeReady.then(async () => {
        const all = await browser.storage.local.get(null);
        const saved: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(all)) if (k.startsWith('sav:')) saved[k.slice(4)] = v;
        return { words: [...store.words.values()], logs: await store.allLogs(), saved };
      });
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
          if (prev && item.t && prev.updated > item.t) continue; // a newer status set here wins
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
    case 'tts':
      return getSettings().then((st) =>
        ttsAudio(any.engine as 'google' | 'azure', String(any.text), st).then(
          (audio) => ({ audio }),
          (e) => ({ error: String(e instanceof Error ? e.message : e) }),
        ),
      );
    case 'azureCheck':
      return checkAzure(String(any.key ?? ''), String(any.region ?? 'eastasia'));
    case 'geminiModels':
      return geminiModels(String(any.key ?? '')).then(
        (models) => ({ models }),
        (e) => ({ error: String(e instanceof Error ? e.message : e) }),
      );
    case 'hideExample':
      // Delete an example sentence for good (a Gemini one is dropped, so a new one can be written).
      return browser.storage.local.get(['exh:' + any.word, 'gex:' + any.word]).then((got) => {
        const word = String(any.word);
        const zh = String(any.zh);
        const hidden = [...new Set([...((got['exh:' + word] as string[] | undefined) ?? []), zh])];
        const gex = ((got['gex:' + word] as [string, string][] | undefined) ?? []).filter(([x]) => x !== zh);
        return browser.storage.local.set({ ['exh:' + word]: hidden, ['gex:' + word]: gex }).then(() => true);
      });
    case 'saveSentence':
      // Save (or unsave) an example sentence; saved ones go into the export for Claude.
      return browser.storage.local.get('sav:' + any.word).then((got) => {
        const key = 'sav:' + any.word;
        const list = ((got[key] as SavedSentence[] | undefined) ?? []).filter((x) => x.zh !== any.zh);
        if (any.on) list.push({ zh: String(any.zh), en: String(any.en ?? ''), at: Date.now() });
        return (list.length ? browser.storage.local.set({ [key]: list }) : browser.storage.local.remove(key)).then(() => true);
      });
    case 'forgetContext':
      return storeReady.then(() => store.removeContext(String(any.word), String(any.text))).then(() => true);
    case 'geminiExamples':
      return Promise.all([getSettings(), dictReady]).then(async ([st, d]) => {
        if (!st.geminiKey) return { error: 'Add a Gemini API key in Settings first.' };
        const word = String(any.word);
        const e = d.get(word)[0];
        try {
          await geminiExamples(word, e ? shortGloss(e) : '', st.geminiKey, st.geminiModel, Math.max(1, Number(any.want) || 2));
          return { ok: true };
        } catch (err) {
          return { error: String(err instanceof Error ? err.message : err) };
        }
      });
    case 'wordInfo':
      // Everything the card shows beyond the dictionary entry: character breakdown,
      // example sentences and the user's own record.
      return Promise.all([dictReady, storeReady, examplesReady]).then(async ([d]) => {
        const word = any.word as string;
        const py = String(any.py ?? '');
        const chars = breakdown(d, word, py.split(/\s+/));
        const record = store.words.get(word) ?? null;
        // Sentences come pre-split into words so every word in the card is clickable and colored.
        // Bundled sentences first, then ones Gemini wrote on request; minus any you deleted.
        const got = await browser.storage.local.get(['gex:' + word, 'exh:' + word, 'sav:' + word]);
        const saved = ((got['sav:' + word] as SavedSentence[] | undefined) ?? []).map((x) => x.zh);
        const hidden = new Set((got['exh:' + word] as string[] | undefined) ?? []);
        const gex = (got['gex:' + word] as [string, string][] | undefined) ?? [];
        const ex = examples.pick(word, d, (w) => store.words.get(w)?.s, gex, hidden, new Set(saved));
        // Where you met it: the last two real sentences, without page-title clutter.
        const seen = (record?.ctx ?? [])
          .map((c) => ({ c, zh: cleanSentence(c.text.split(' — ')[0], word) }))
          .filter(({ zh }) => usefulSentence(zh, word))
          // The same line met twice (e.g. a replayed caption with a different tail) is one sentence.
          .filter(({ zh }, i, all) => all.findIndex((x) => x.zh === zh) === i)
          .slice(0, 3)
          .map(({ c, zh }) => ({ ...c, zh, toks: d.segment(zh) }));
        return { chars, examples: ex, seen, record, saved };
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
        const videoId = String(any.videoId);
        const tab = sender.tab?.id;
        try {
          return await geminiTranscribe(videoId, st.geminiKey, st.geminiModel || DEFAULT_SETTINGS.geminiModel, Number(any.duration), (p) => {
            if (tab != null) browser.tabs.sendMessage(tab, { type: 'geminiProgress', videoId, ...p }).catch(() => {});
          });
        } catch (e) {
          return { error: String(e instanceof Error ? e.message : e) };
        }
      });
    case 'geminiForget':
      // Drop a saved Gemini transcript (and any saved parts) so the next request starts fresh.
      return browser.storage.local.get(null).then((all) =>
        browser.storage.local.remove(Object.keys(all).filter((k) => k === 'gem:' + any.videoId || k.startsWith(`gemc:${any.videoId}:`))).then(() => true),
      );
    case 'geminiCached':
      return browser.storage.local.get('gem:' + any.videoId).then((r) => r['gem:' + any.videoId] ?? null);
    case 'entries':
      return dictReady.then((d) => d.get(any.word as string));
  }
  return undefined;
});
