import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignTranslation, cueAt, parseTimedText, pickChinese } from '../src/youtube/captions.ts';

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
