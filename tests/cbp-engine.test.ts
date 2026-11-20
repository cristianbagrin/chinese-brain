// Chinese Brain Plus engine: the places where JavaScript and Python disagree, which words.py's answers depend on.
// The full comparison with words.py runs on real data: scripts/cbp-parity.ts, and nightly through scripts/cbp-push.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../site/src/cbp/engine.ts';

test('rounds like Python (half to even, on the exact binary value)', () => {
  for (const [x, n, want] of [[2.675, 2, 2.67], [0.25, 1, 0.2], [0.35, 1, 0.3], [2.5, 0, 2], [3.5, 0, 4], [12.05, 1, 12.1]] as const) {
    assert.equal(E.pyRound(x, n), want, `round(${x}, ${n})`);
  }
});

test('prints floats and JSON like Python', () => {
  assert.equal(E.pyFloat(3), '3.0');
  assert.equal(E.pyFloat(3.25), '3.25');
  assert.equal(E.pyJson({ a: [1, '好'], b: {} }), '{\n "a": [\n  1,\n  "好"\n ],\n "b": {}\n}');
});

test('compares strings by code point, as Python does', () => {
  assert.ok(E.cmp('\u{20000}', '￿') > 0); // JavaScript's < says the opposite
  assert.equal(E.key(' 臺灣 '), '台灣');
  assert.equal(E.plus('2026-12-30', 3), '2027-01-02');
});

test('reads the status from a minimal system', () => {
  const files: E.Files = new Map([
    [E.KW, '# words\n好 · hǎo · good\n'],
    [E.LN, ''],
    [E.LOG, 'date\ttarget\tkind\tresult\tnote\n'],
  ]);
  assert.match(E.statusText(files, '2026-11-20'), /\S/);
});
