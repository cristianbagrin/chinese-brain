import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildClaudeExport, parseWordList } from '../src/shared/export.ts';
import type { WordRecord } from '../src/shared/types.ts';

test('parses known-words.txt (word, K/L, date)', () => {
  const items = parseWordList('# header\n一\tK\t2026-09-21\n經驗\tL\t2026-09-22\n颱風\n');
  assert.deepEqual(
    items.map((i) => [i.w, i.s]),
    [
      ['一', 'known'],
      ['經驗', 'learning'],
      ['颱風', 'known'],
    ],
  );
  assert.equal(new Date(items[1].t).getDate(), 22);
});

test("the user's real file parses completely", () => {
  const f = process.env.KNOWN_WORDS;
  if (!f || !existsSync(f)) return;
  const items = parseWordList(readFileSync(f, 'utf8'));
  assert.equal(items.length, 1736);
  assert.equal(items.filter((i) => i.s === 'learning').length, 91);
});

test('weekly export: only my status changes since the last export', () => {
  const day = 86400000;
  const now = Date.now();
  const since = now - 7 * day;
  const rec = (w: string, hist: [number, WordRecord['s']][]): WordRecord => ({
    w,
    s: hist[hist.length - 1][1],
    added: hist[0][0],
    updated: hist[hist.length - 1][0],
    hist: hist.map(([t, s]) => ({ t, s })),
    looks: 0,
    ctx: [],
    p: 'x',
    g: 'y',
  });
  const words = [
    rec('舊', [[now - 30 * day, 'known']]), // unchanged, not looked up: excluded
    rec('忘', [[now - 30 * day, 'known']]), // only looked up this week: lookups don't count
    rec('進', [[now - 20 * day, 'learning'], [now - 1 * day, 'known']]), // L -> K
    rec('新', [[now - 2 * day, 'fresh']]),
  ];
  const logs = [
    { at: now - day, k: 'look' as const, w: '忘', src: 'yt' as const },
    { at: now - day, k: 'status' as const, w: '進', s: 'known' as const, from: 'learning' as const },
    { at: now - 2 * day, k: 'status' as const, w: '新', s: 'fresh' as const, from: null },
    { at: now - 3 * day, k: 'status' as const, w: '刪', s: null, from: 'known' as const },
    { at: now - 3 * day, k: 'status' as const, w: '來回', s: 'fresh' as const, from: null },
    { at: now - 2 * day, k: 'status' as const, w: '來回', s: null, from: 'fresh' as const },
  ];
  const out = buildClaudeExport(words, logs, since);
  const rows = out.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('word\t'));
  const byWord = Object.fromEntries(rows.map((r) => [r.split('\t')[0], r.split('\t')]));
  assert.ok(!byWord['舊']);
  assert.ok(!byWord['忘']);
  assert.deepEqual(byWord['進'].slice(1, 3), ['K', 'L']);
  assert.deepEqual(byWord['新'].slice(1, 3), ['F', '-']);
  assert.deepEqual(byWord['刪'].slice(1, 3), ['-', 'K']); // removed this week
  assert.ok(!byWord['來回']); // added and removed again: nothing to report
});

test('saved example sentences ride along in the export', () => {
  const now = Date.now();
  const since = now - 7 * 86400000;
  const words: WordRecord[] = [{ w: '颱風', s: 'known', added: 1, updated: 1, hist: [{ t: 1, s: 'known' }], looks: 0, ctx: [], p: 'tái fēng', g: 'typhoon' }];
  const saved = {
    颱風: [
      { zh: '颱風快登陸了。', en: 'The typhoon is about to make landfall.', at: now - 1000 },
      { zh: '舊的句子。', en: 'Old one.', at: since - 1000 },
    ],
    捷運: [{ zh: '我搭捷運上班。', en: 'I take the MRT to work.', at: now - 500 }],
  };
  const out = buildClaudeExport(words, [], since, saved);
  const rows = out.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('word\t')).map((r) => r.split('\t'));
  const byWord = Object.fromEntries(rows.map((r) => [r[0], r]));
  assert.equal(byWord['颱風'][8], '颱風快登陸了。 — The typhoon is about to make landfall.');
  assert.deepEqual(byWord['颱風'].slice(1, 3), ['K', 'K']); // no status change, there for the sentence
  assert.equal(byWord['捷運'][8], '我搭捷運上班。 — I take the MRT to work.');
  assert.equal(rows.length, 2);
});
