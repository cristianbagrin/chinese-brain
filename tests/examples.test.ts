import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ExampleBank } from '../src/background/examples.ts';
import { Dictionary } from '../src/shared/dict.ts';
import type { Status } from '../src/shared/types.ts';

const dict = Dictionary.fromTsv(gunzipSync(readFileSync('static/data/dict.tsv.gz')).toString('utf8'));
const bank = new ExampleBank();
bank.load(gunzipSync(readFileSync('static/data/examples.tsv.gz')).toString('utf8'));

test('words without sentences of their own get real ones from the pool', async () => {
  assert.equal(bank.own.get('胡椒'), undefined);
  const ex = bank.pick('胡椒', dict, () => undefined);
  assert.ok(ex.length > 0, 'some sentence uses 胡椒');
  for (const x of ex) assert.ok(x.zh.includes('胡椒'));
});

test('a word found in the pool is a word there, not part of a longer one; and it is found fast', () => {
  for (const [zh] of bank.using('子', dict)) assert.ok(dict.segment(zh).some((t) => t.word === '子'), zh);
  const t0 = performance.now();
  for (const w of ['的', '子', '颱風', '胡椒', '臺北', '不存在的詞']) bank.using(w, dict);
  assert.ok(performance.now() - t0 < 1500, `took ${Math.round(performance.now() - t0)} ms`);
  assert.ok(bank.using('臺北', dict).length > 0);
});

test('sentences you can read come first; deleted ones never; saved ones always', async () => {
  const all = bank.pick('颱風', dict, () => undefined, [], new Set(), new Set(), 20);
  assert.ok(all.length > 2);
  // Know every word of one particular sentence: it moves to the top.
  const target = all[all.length - 1];
  const known = new Set(target.toks.filter((t) => t.word).map((t) => t.word!));
  const mine = (w: string): Status | undefined => (known.has(w) ? 'known' : undefined);
  assert.equal(bank.pick('颱風', dict, mine)[0].zh, target.zh);
  const top = bank.pick('颱風', dict, () => undefined)[0].zh;
  assert.notEqual(bank.pick('颱風', dict, () => undefined, [], new Set([top]))[0].zh, top);
  assert.equal(bank.pick('颱風', dict, () => undefined, [], new Set(), new Set([target.zh]))[0].zh, target.zh);
});
