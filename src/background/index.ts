import { Dictionary } from '../shared/dict.ts';
import { numberedToMarked } from '../shared/pinyin.ts';
import { DEFAULT_SETTINGS, type Msg, type Settings, type Status, type WordRecord } from '../shared/types.ts';
import { scheduleFeed, writeFeed } from './feed.ts';
import { shortGloss, Store } from './store.ts';
import { cachedCaptions, startCaptionCapture } from './youtube.ts';

declare const __TEST__: boolean;

let dict: Dictionary | undefined;
const dictReady = loadDictionary();
const store = new Store();
const storeReady = store.load();

startCaptionCapture();

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

store.onChange = () => {
  getSettings().then((s) => s.feedFolder && scheduleFeed(store, s.feedFolder));
};

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
    case 'writeFeed':
      return storeReady.then(async () => writeFeed(store, ((await getSettings()).feedFolder || 'chinese-brain') as string));
    case 'insertCSS':
      if (sender.tab?.id != null)
        return browser.tabs.insertCSS(sender.tab.id, { code: any.css as string, frameId: sender.frameId ?? 0 }).then(() => true);
      return undefined;
    case 'bulkStatus':
      return Promise.all([dictReady, storeReady]).then(async ([d]) => {
        const status = any.status as Status;
        const now = Date.now();
        const recs: WordRecord[] = [];
        const seen = new Set<string>();
        for (const raw of any.words as string[]) {
          const e = d.get(raw)[0];
          const w = e?.trad ?? raw;
          if (seen.has(w) || (any.onlyNew && store.words.has(w))) continue;
          seen.add(w);
          const prev = store.words.get(w);
          recs.push({
            ...(prev ?? { w, added: now, hist: [], looks: 0, ctx: [] }),
            s: status,
            updated: now,
            hist: [...(prev?.hist ?? []), { t: now, s: status }],
            p: e ? numberedToMarked(e.tw || e.py) : prev?.p,
            g: e ? shortGloss(e) : prev?.g,
          } as WordRecord);
        }
        for (const r of recs) store.log({ at: now, k: 'status', w: r.w, s: status, from: store.words.get(r.w)?.s ?? null });
        return store.importWords(recs, 'replace');
      });
    case 'tocflWords':
      return dictReady.then((d) => [...new Set(d.entries.filter((e) => e.tocfl && e.tocfl <= (any.level as number)).map((e) => e.trad))]);
    case 'openPage':
      if (!__TEST__) return undefined;
      return browser.tabs.create({ url: browser.runtime.getURL(String(any.page)) }).then(() => true);
    case 'entries':
      return dictReady.then((d) => d.get(any.word as string));
  }
  return undefined;
});

browser.commands.onCommand.addListener(async (cmd) => {
  if (cmd === 'toggle-lookup') {
    const s = await getSettings();
    const hoverMode = s.hoverMode === 'off' ? 'hover' : 'off';
    await browser.storage.local.set({ settings: { ...s, hoverMode } });
  }
});
