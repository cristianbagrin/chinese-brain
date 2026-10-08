import { buildEventsTsv, buildWordsTsv, FEED_README } from '../shared/export.ts';
import type { Store } from './store.ts';

let timer: ReturnType<typeof setTimeout> | undefined;

/** Rewrite the feed a couple of minutes after the last change. */
export function scheduleFeed(store: Store, folder: string) {
  clearTimeout(timer);
  timer = setTimeout(() => writeFeed(store, folder).catch((e) => console.warn('[chinese-brain] feed', e)), 2 * 60_000);
}

/**
 * Writes the live feed into ~/Downloads/<folder>/ (the only place an extension
 * may write files). Files are overwritten in place, so a Claude skill can read
 * them at any time without the user exporting anything.
 */
export async function writeFeed(store: Store, folder: string) {
  const logs = await store.allLogs();
  const words = [...store.words.values()];
  const files: Record<string, string> = {
    'words.tsv': buildWordsTsv(words),
    'events.tsv': buildEventsTsv(logs),
    'README.md': FEED_README,
    // Full backup: if the folder lives in iCloud/Dropbox, a reinstall or a new computer can restore from it.
    'backup.json': JSON.stringify({ app: 'chinese-brain', v: 1, at: Date.now(), data: await browser.storage.local.get(null) }),
  };
  for (const [name, content] of Object.entries(files)) {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    try {
      const id = await browser.downloads.download({
        url,
        filename: `${folder}/${name}`,
        conflictAction: 'overwrite',
        saveAs: false,
      });
      await waitForDownload(id);
      await browser.downloads.erase({ id }); // keep the downloads list clean
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }
  await browser.storage.local.set({ feedWrittenAt: Date.now() });
  return true;
}

function waitForDownload(id: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      browser.downloads.onChanged.removeListener(listener);
      resolve();
    };
    const listener = (d: browser.downloads._OnChangedDownloadDelta) => {
      if (d.id === id && d.state && d.state.current !== 'in_progress') done();
    };
    browser.downloads.onChanged.addListener(listener);
    setTimeout(done, 10_000);
  });
}
