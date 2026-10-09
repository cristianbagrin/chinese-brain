import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignTranslation, cueAt, parseTimedText, pickChinese, splitNote, stripNote } from '../src/youtube/captions.ts';

const json3 = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: '大家好' }] },
    { tStartMs: 2000, dDurationMs: 1500, segs: [{ utf8: '\n' }] },
    { tStartMs: 2500, dDurationMs: 2500, segs: [{ utf8: '今天' }, { utf8: '天氣很好' }] },
    { tStartMs: 2600, aAppend: 1, segs: [{ utf8: 'x' }] },
  ],
});

test('json3 parsing', () => {
  const cues = parseTimedText(json3);
  assert.deepEqual(
    cues.map((c) => [c.start, c.end, c.text]),
    [
      [0, 2, '大家好'],
      [2.5, 5, '今天天氣很好'],
    ],
  );
});

test('vtt parsing', () => {
  const cues = parseTimedText('WEBVTT\n\n00:00:01.000 --> 00:00:02.500\n你好\n\n00:00:03.000 --> 00:00:04.000\n<c>再見</c>\n');
  assert.deepEqual(cues.map((c) => c.text), ['你好', '再見']);
  assert.equal(cues[0].end, 2.5);
});

test('translation alignment by overlap', () => {
  const src = [
    { start: 0, end: 2, text: 'a' },
    { start: 2.5, end: 5, text: 'b' },
  ];
  const tr = [
    { start: 0.1, end: 1.9, text: 'A' },
    { start: 2.4, end: 3.6, text: 'B1' },
    { start: 3.6, end: 5.2, text: 'B2' },
  ];
  assert.deepEqual(alignTranslation(src, tr), ['A', 'B1 B2']);
});

test('cueAt', () => {
  const cues = parseTimedText(json3);
  assert.equal(cueAt(cues, 1), 0);
  assert.equal(cueAt(cues, 2.2), -1);
  assert.equal(cueAt(cues, 3), 1);
});

test('track choice prefers manual Traditional', () => {
  const t = pickChinese([
    { languageCode: 'zh', kind: 'asr', name: 'auto' },
    { languageCode: 'zh-Hans', name: 'S' },
    { languageCode: 'zh-TW', name: 'T' },
    { languageCode: 'en', name: 'E' },
  ]);
  assert.equal(t?.languageCode, 'zh-TW');
});

test('stress: markup, entities, invisible chars, sound labels, bad timings', () => {
  const body = JSON.stringify({
    events: [
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: '一個(胡椒餅) (<font color=#FFF900FF>Note:</font> locals omit it)' }] },
      { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: '<i>你好</i> &amp; 再見&#33; &#x4E2D;' }] },
      { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: '​好​吃﻿' }] },
      { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: '[音樂]' }] },
      { tStartMs: 4000, dDurationMs: 1000, segs: [{ utf8: '♪♪' }] },
      { tStartMs: 5000, dDurationMs: 1000, segs: [{ utf8: '   ' }] },
      { tStartMs: 6000, dDurationMs: 1000, segs: [{ utf8: 'a < b > c' }] },
      { dDurationMs: 1000, segs: [{ utf8: '沒有開始時間' }] },
      { tStartMs: 7000, segs: [{ utf8: '沒有長度' }] },
    ],
  });
  const texts = parseTimedText(body).map((c) => c.text);
  assert.ok(texts.includes('一個(胡椒餅) (Note: locals omit it)'));
  assert.ok(texts.includes('你好 & 再見! 中'));
  assert.ok(texts.includes('好吃'));
  assert.ok(!texts.some((t) => t.includes('<') && t.includes('font')));
  assert.ok(!texts.includes('[音樂]') && !texts.includes('♪♪'));
  assert.ok(texts.includes('a < b > c'));
  assert.ok(texts.includes('沒有長度'));
  for (const c of parseTimedText(body)) assert.ok(c.end >= c.start);
});

test('stress: garbage bodies never throw', () => {
  for (const b of ['', '{', '{"events":null}', '<html><p>Sorry</p></html>', 'WEBVTT', 'null', '[]', '{"events":[{"segs":[{}]}]}']) {
    try {
      assert.ok(Array.isArray(parseTimedText(b)));
    } catch (e) {
      // JSON.parse errors are caught by the caller; anything else is a bug.
      assert.ok(e instanceof SyntaxError, `${b}: ${e}`);
    }
  }
});

test('uploader notes move off the Chinese line; English inside sentences stays', () => {
  const n = splitNote('一個(胡椒餅) (Note: The truth is locals usually omit the food name. Many famous stalls only sell one item.)');
  assert.equal(n.text, '一個(胡椒餅)');
  assert.equal(n.note, 'Note: The truth is locals usually omit the food name. Many famous stalls only sell one item.');
  for (const keep of ['我今天去 Costco 買東西', '這是 iPhone 15 Pro Max 的新功能', '他說 I love you 然後就走了', '我們來玩 (笑)', '(Sorry) 不好意思', 'OK 好啊']) {
    assert.deepEqual(splitNote(keep), { text: keep, note: '' });
  }
  assert.deepEqual(splitNote('好吃！Note: this stall only opens at night'), { text: '好吃！', note: 'Note: this stall only opens at night' });
  assert.deepEqual(splitNote('【The stall has been here for forty years】老店'), { text: '老店', note: 'The stall has been here for forty years' });
  assert.equal(
    stripNote('One (pepper cake) (Note: The truth is locals usually omit the food name. Many famous stalls only sell one item.)', n.note),
    'One (pepper cake)',
  );
  assert.equal(stripNote('I went to Costco', 'Note: something else entirely here'), 'I went to Costco');
});
