import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLines } from '../src/background/gemini.ts';

test('Gemini lines: schema reply, bare array, clock times, fenced JSON', () => {
  assert.deepEqual(parseLines('{"lines":[{"start":1.5,"end":3,"zh":" 你好 ","en":"Hi"}]}'), [{ start: 1.5, end: 3, zh: '你好', en: 'Hi' }]);
  assert.deepEqual(parseLines('```json\n[{"start":"1:02","end":"1:04.5","zh":"走吧","en":"Let\'s go"}]\n```'), [
    { start: 62, end: 64.5, zh: '走吧', en: "Let's go" },
  ]);
  assert.deepEqual(parseLines('{"lines":[]}'), []);
});

test('Gemini lines: a reply cut off mid-way keeps its complete lines', () => {
  const cut = '{"lines":[{"start":0,"end":2,"zh":"大家好","en":"Hello"},{"start":2,"end":4,"zh":"今天","en":"Today"},{"start":4,"end":6,"zh":"我們去';
  assert.deepEqual(
    parseLines(cut).map((l) => l.zh),
    ['大家好', '今天'],
  );
});

test('Gemini lines: missing or bad end times get a sane length; lines are sorted', () => {
  const lines = parseLines('[{"start":5,"zh":"二","en":""},{"start":1,"end":0,"zh":"一","en":""}]');
  assert.deepEqual(lines, [
    { start: 1, end: 3, zh: '一', en: '' },
    { start: 5, end: 7, zh: '二', en: '' },
  ]);
});
