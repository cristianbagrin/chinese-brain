import { numberedToMarked } from '../shared/pinyin.ts';
import { dayKeyLocal } from '../shared/time.ts';
import type { Context, Entry, LogEvent, Status, WordRecord } from '../shared/types.ts';

/**
 * The single word list shared by every page. Each word lives under its own
 * storage key ("w:<word>") so writes stay small; content scripts watch
 * storage.onChanged for live status colouring.
 */
export class Store {
  words = new Map<string, WordRecord>();
  private pendingLog: LogEvent[] = [];
  private logTimer: ReturnType<typeof setTimeout> | undefined;
  private recentLooks = new Map<string, number>();
  onChange: (() => void) | undefined;

  async load() {
    const all = await browser.storage.local.get(null);
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith('w:')) this.words.set(k.slice(2), v as WordRecord);
    }
  }

  statuses(): Record<string, Status> {
    const out: Record<string, Status> = {};
    for (const [w, r] of this.words) out[w] = r.s;
    return out;
  }

  async setStatus(word: string, status: Status | null, entry?: Entry, ctx?: Context) {
    const now = Date.now();
    const prev = this.words.get(word);
    this.log({ at: now, k: 'status', w: word, s: status, from: prev?.s ?? null });
    if (!status) {
      this.words.delete(word);
      await browser.storage.local.remove('w:' + word);
      this.onChange?.();
      return;
    }
    const rec: WordRecord = prev ?? { w: word, s: status, added: now, updated: now, hist: [], looks: 0, ctx: [] };
    if (prev?.s !== status) rec.hist.push({ t: now, s: status });
    rec.s = status;
    rec.updated = now;
    if (entry) {
      rec.p = numberedToMarked(entry.tw || entry.py);
      rec.g = shortGloss(entry);
    }
    if (ctx) addContext(rec, ctx);
    this.words.set(word, rec);
    await browser.storage.local.set({ ['w:' + word]: rec });
    this.onChange?.();
  }

  /** A deliberate lookup (click, or a popup that stayed open). */
  async looked(word: string, src: 'yt' | 'web', url?: string, ctx?: Context) {
    const now = Date.now();
    const last = this.recentLooks.get(word) ?? 0;
    if (now - last < 10 * 60_000) return; // same word within 10 min counts once
    this.recentLooks.set(word, now);
    this.log({ at: now, k: 'look', w: word, src, url });
    const rec = this.words.get(word);
    if (rec) {
      rec.looks++;
      if (ctx) addContext(rec, ctx);
      await browser.storage.local.set({ ['w:' + word]: rec });
      this.onChange?.();
    }
  }

  log(ev: LogEvent) {
    this.pendingLog.push(ev);
    clearTimeout(this.logTimer);
    this.logTimer = setTimeout(() => this.flushLog(), 3000);
  }

  async flushLog() {
    if (!this.pendingLog.length) return;
    const byDay = new Map<string, LogEvent[]>();
    for (const ev of this.pendingLog) {
      const k = 'log:' + dayKeyLocal(ev.at);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(ev);
    }
    this.pendingLog = [];
    const existing = await browser.storage.local.get([...byDay.keys()]);
    const update: Record<string, LogEvent[]> = {};
    for (const [k, evs] of byDay) update[k] = [...((existing[k] as LogEvent[]) ?? []), ...evs];
    await browser.storage.local.set(update);
    this.onChange?.();
  }

  async allLogs(): Promise<LogEvent[]> {
    await this.flushLog();
    const all = await browser.storage.local.get(null);
    return Object.keys(all)
      .filter((k) => k.startsWith('log:'))
      .sort()
      .flatMap((k) => all[k] as LogEvent[]);
  }

  /** Bulk import (known-words file, backups). Existing records keep their history. */
  async importWords(recs: WordRecord[], mode: 'merge' | 'replace' = 'merge') {
    const update: Record<string, WordRecord> = {};
    for (const r of recs) {
      const prev = this.words.get(r.w);
      if (prev && mode === 'merge') {
        if (prev.s === r.s) continue;
        if (r.updated <= prev.updated) continue;
      }
      this.words.set(r.w, r);
      update['w:' + r.w] = r;
    }
    if (Object.keys(update).length) await browser.storage.local.set(update);
    this.onChange?.();
    return Object.keys(update).length;
  }
}


function addContext(rec: WordRecord, ctx: Context) {
  const text = ctx.text.trim().slice(0, 300);
  if (!text) return;
  if (rec.ctx.some((c) => c.text === text)) return;
  rec.ctx.unshift({ ...ctx, text });
  rec.ctx = rec.ctx.slice(0, 5);
}

export function shortGloss(e: Entry): string {
  return e.defs
    .filter((d) => !d.startsWith('CL:'))
    .slice(0, 3)
    .join('; ')
    .slice(0, 120);
}
