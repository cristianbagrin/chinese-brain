import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Dictionary } from '../src/shared/dict.ts';
import { numberedToMarked } from '../src/shared/pinyin.ts';

const dict = Dictionary.fromTsv(gunzipSync(readFileSync('static/data/dict.tsv.gz')).toString('utf8'));
const seg = (s: string) => dict.segment(s).map((t) => t.text).join('|');

test('pinyin marks', () => {
  assert.equal(numberedToMarked('xing1 qi2'), 'xīngqí');
  assert.equal(numberedToMarked('lu:4 se4'), 'lǜsè');
  assert.equal(numberedToMarked('Xi1 an1'), "xī'ān");
  assert.equal(numberedToMarked('Zhong1 wen2'), 'zhōngwén');
  assert.equal(numberedToMarked('liu2'), 'liú');
  assert.equal(numberedToMarked('gui4'), 'guì');
  assert.equal(numberedToMarked('de5'), 'de');
});

test('Taiwan readings win', () => {
  assert.equal(dict.get('星期')[0].tw, 'xing1 qi2');
  assert.equal(dict.get('危險')[0].tw, 'wei2 xian3');
});

test('segmentation', () => {
  for (const [s, want] of [
    ['我今天要去台北車站買東西', '我|今天|要|去|台北|車站|買|東西'],
    ['他們正在研究這個問題', '他們|正在|研究|這個|問題'],
    ['我们明天一起去吃饭吧', '我们|明天|一起|去|吃饭|吧'],
    ['下雨了，記得帶傘！', '下雨|了|，|記得|帶|傘|！'],
  ]) {
    console.log(seg(s));
    assert.equal(seg(s), want);
  }
});

test('everyday reading of common heteronyms', () => {
  for (const [w, py] of [['要', 'yao4'], ['著', 'zhe5'], ['看', 'kan4'], ['行', 'xing2'], ['了', 'le5'], ['還', 'hai2']]) {
    assert.equal(dict.segment(w)[0].py, py, w);
  }
});

test('lookup longest first', () => {
  const m = dict.lookup('電腦很好玩');
  assert.equal(m[0].text, '電腦');
  assert.ok(m.some((x) => x.text === '電'));
});

test('simplified token gets traditional form', () => {
  const t = dict.segment('我们吃饭');
  assert.equal(t[0].trad, '我們');
  assert.equal(t[1].trad, '吃飯');
});
