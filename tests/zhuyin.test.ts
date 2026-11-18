import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  markedToNumbered,
  markedToZhuyin,
  numberedToZhuyin,
  pron,
  pronMarked,
  splitPinyin,
  syllableToZhuyin,
  zhuyinLetters,
  zhuyinParts,
} from '../src/shared/zhuyin.ts';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/types.ts';

const z = syllableToZhuyin;

test('every initial', () => {
  const cases: [string, string][] = [
    ['ba1', 'ㄅㄚ'], ['pa2', 'ㄆㄚˊ'], ['ma3', 'ㄇㄚˇ'], ['fa4', 'ㄈㄚˋ'],
    ['de2', 'ㄉㄜˊ'], ['te4', 'ㄊㄜˋ'], ['ne4', 'ㄋㄜˋ'], ['le4', 'ㄌㄜˋ'],
    ['ge1', 'ㄍㄜ'], ['ke3', 'ㄎㄜˇ'], ['he2', 'ㄏㄜˊ'],
    ['ji1', 'ㄐㄧ'], ['qi2', 'ㄑㄧˊ'], ['xi3', 'ㄒㄧˇ'],
    ['zhe4', 'ㄓㄜˋ'], ['che1', 'ㄔㄜ'], ['she2', 'ㄕㄜˊ'], ['re4', 'ㄖㄜˋ'],
    ['ze2', 'ㄗㄜˊ'], ['ce4', 'ㄘㄜˋ'], ['se4', 'ㄙㄜˋ'],
  ];
  for (const [py, want] of cases) assert.equal(z(py), want, py);
});

test('every final, with no initial (y-, w- spellings)', () => {
  const cases: [string, string][] = [
    ['a1', 'ㄚ'], ['o1', 'ㄛ'], ['e4', 'ㄜˋ'], ['ai4', 'ㄞˋ'], ['ei4', 'ㄟˋ'], ['ao4', 'ㄠˋ'], ['ou1', 'ㄡ'],
    ['an1', 'ㄢ'], ['en1', 'ㄣ'], ['ang2', 'ㄤˊ'], ['eng1', 'ㄥ'], ['er2', 'ㄦˊ'], ['er4', 'ㄦˋ'],
    ['yi1', 'ㄧ'], ['ya2', 'ㄧㄚˊ'], ['yo1', 'ㄧㄛ'], ['ye3', 'ㄧㄝˇ'], ['yai2', 'ㄧㄞˊ'], ['yao4', 'ㄧㄠˋ'], ['you3', 'ㄧㄡˇ'],
    ['yan2', 'ㄧㄢˊ'], ['yin1', 'ㄧㄣ'], ['yang2', 'ㄧㄤˊ'], ['ying1', 'ㄧㄥ'], ['yong3', 'ㄩㄥˇ'],
    ['wu3', 'ㄨˇ'], ['wa1', 'ㄨㄚ'], ['wo3', 'ㄨㄛˇ'], ['wai4', 'ㄨㄞˋ'], ['wei4', 'ㄨㄟˋ'], ['wan3', 'ㄨㄢˇ'],
    ['wen2', 'ㄨㄣˊ'], ['wang4', 'ㄨㄤˋ'], ['weng1', 'ㄨㄥ'],
    ['yu2', 'ㄩˊ'], ['yue4', 'ㄩㄝˋ'], ['yuan2', 'ㄩㄢˊ'], ['yun2', 'ㄩㄣˊ'],
  ];
  for (const [py, want] of cases) assert.equal(z(py), want, py);
});

test('finals after an initial, short spellings expanded (iu, ui, un)', () => {
  const cases: [string, string][] = [
    ['bo2', 'ㄅㄛˊ'], ['mo4', 'ㄇㄛˋ'], ['duo1', 'ㄉㄨㄛ'], ['zhong1', 'ㄓㄨㄥ'], ['long2', 'ㄌㄨㄥˊ'],
    ['jiong3', 'ㄐㄩㄥˇ'], ['xiong2', 'ㄒㄩㄥˊ'], ['liu2', 'ㄌㄧㄡˊ'], ['jiu3', 'ㄐㄧㄡˇ'], ['gui4', 'ㄍㄨㄟˋ'],
    ['dui4', 'ㄉㄨㄟˋ'], ['lun2', 'ㄌㄨㄣˊ'], ['chun1', 'ㄔㄨㄣ'], ['lia3', 'ㄌㄧㄚˇ'], ['bia1', 'ㄅㄧㄚ'], ['tie3', 'ㄊㄧㄝˇ'],
    ['piao4', 'ㄆㄧㄠˋ'], ['mian4', 'ㄇㄧㄢˋ'], ['bin1', 'ㄅㄧㄣ'], ['liang2', 'ㄌㄧㄤˊ'], ['ting1', 'ㄊㄧㄥ'],
    ['gua1', 'ㄍㄨㄚ'], ['kuai4', 'ㄎㄨㄞˋ'], ['huan2', 'ㄏㄨㄢˊ'], ['shuang1', 'ㄕㄨㄤ'], ['feng1', 'ㄈㄥ'],
    ['zou3', 'ㄗㄡˇ'], ['cai4', 'ㄘㄞˋ'], ['sen1', 'ㄙㄣ'], ['bei3', 'ㄅㄟˇ'], ['gao1', 'ㄍㄠ'],
  ];
  for (const [py, want] of cases) assert.equal(z(py), want, py);
});

test('ü: written u after j q x, ü (u:, v) after n and l', () => {
  assert.equal(z('ju4'), 'ㄐㄩˋ');
  assert.equal(z('qu4'), 'ㄑㄩˋ');
  assert.equal(z('xue2'), 'ㄒㄩㄝˊ');
  assert.equal(z('quan2'), 'ㄑㄩㄢˊ');
  assert.equal(z('jun1'), 'ㄐㄩㄣ');
  assert.equal(z('lu:4'), 'ㄌㄩˋ');
  assert.equal(z('nu:3'), 'ㄋㄩˇ');
  assert.equal(z('lv3'), 'ㄌㄩˇ');
  assert.equal(z('lü4'), 'ㄌㄩˋ');
  assert.equal(z('lu:e4'), 'ㄌㄩㄝˋ');
  assert.equal(z('nue4'), 'ㄋㄩㄝˋ');
  assert.equal(z('lu4'), 'ㄌㄨˋ', 'lu is not lü');
  assert.equal(z('nu3'), 'ㄋㄨˇ');
});

test('-i after zh ch sh r z c s is the initial alone, with no ㄧ', () => {
  const cases: [string, string][] = [
    ['zhi1', 'ㄓ'], ['chi1', 'ㄔ'], ['shi4', 'ㄕˋ'], ['ri4', 'ㄖˋ'], ['zi4', 'ㄗˋ'], ['ci2', 'ㄘˊ'], ['si4', 'ㄙˋ'], ['shi5', '˙ㄕ'],
  ];
  for (const [py, want] of cases) assert.equal(z(py), want, py);
});

test('tones: first unmarked, ˊ ˇ ˋ after, neutral ˙ before', () => {
  assert.equal(z('ma1'), 'ㄇㄚ');
  assert.equal(z('ma2'), 'ㄇㄚˊ');
  assert.equal(z('ma3'), 'ㄇㄚˇ');
  assert.equal(z('ma4'), 'ㄇㄚˋ');
  assert.equal(z('ma5'), '˙ㄇㄚ');
  assert.equal(z('de5'), '˙ㄉㄜ');
  assert.equal(z('zi5'), '˙ㄗ');
  assert.equal(numberedToZhuyin('xie4 xie5'), 'ㄒㄧㄝˋ ˙ㄒㄧㄝ');
});

test('erhua: r5 on its own or written onto the syllable', () => {
  assert.equal(z('r5'), 'ㄦ');
  assert.equal(numberedToZhuyin('yi1 dian3 r5'), 'ㄧ ㄉㄧㄢˇㄦ');
  assert.equal(z('dianr3'), 'ㄉㄧㄢˇㄦ');
  assert.equal(z('huar1'), 'ㄏㄨㄚㄦ');
  assert.equal(z('wanr2'), 'ㄨㄢˊㄦ');
  assert.equal(z('er2'), 'ㄦˊ', 'er itself is no erhua');
  assert.equal(numberedToZhuyin('nü3 er2'), 'ㄋㄩˇ ㄦˊ');
});

test('capitals, interjections, and anything that is not pinyin', () => {
  assert.equal(numberedToZhuyin('Zhong1 guo2'), 'ㄓㄨㄥ ㄍㄨㄛˊ');
  assert.equal(z('m2'), 'ㄇˊ');
  assert.equal(z('n2'), 'ㄣˊ');
  assert.equal(z('hm5'), '˙ㄏㄇ');
  assert.equal(z('ng2'), 'ㄫˊ');
  assert.equal(z('ê1'), 'ㄝ');
  assert.equal(z('?'), '?');
  assert.equal(z('A'), 'A');
  assert.equal(z('xx5'), 'xx5');
  assert.equal(numberedToZhuyin('A A zhi4'), 'A A ㄓˋ');
  assert.equal(z('ma'), 'ma', 'no tone number: left alone');
  assert.equal(numberedToZhuyin(''), '');
});

test('real words from the dictionary', () => {
  const cases: [string, string][] = [
    ['tai2 bei3', 'ㄊㄞˊ ㄅㄟˇ'],
    ['ye4 shi4', 'ㄧㄝˋ ㄕˋ'],
    ['jie2 yun4', 'ㄐㄧㄝˊ ㄩㄣˋ'],
    ['pian2 yi5', 'ㄆㄧㄢˊ ˙ㄧ'],
    ['lü3 guan3', 'ㄌㄩˇ ㄍㄨㄢˇ'],
    ['xi1 an1', 'ㄒㄧ ㄢ'],
    ['peng2 you5', 'ㄆㄥˊ ˙ㄧㄡ'],
    ['qu4 nian2', 'ㄑㄩˋ ㄋㄧㄢˊ'],
    ['zhi1 dao5', 'ㄓ ˙ㄉㄠ'],
    ['ke3 ai4', 'ㄎㄜˇ ㄞˋ'],
  ];
  for (const [py, want] of cases) assert.equal(numberedToZhuyin(py), want, py);
});

test('strings that only look like pinyin are not syllables', () => {
  for (const s of ['zhia', 'bü', 'ji ', 'gi', 'zhiong', 'fiao', 'buo', 'ia', 'u', 'ong', 'q', 'xyz', '']) assert.equal(zhuyinLetters(s), null, s);
});

test('pinyin with tone marks: syllables and numbers', () => {
  assert.equal(markedToNumbered('zhōng'), 'zhong1');
  assert.equal(markedToNumbered('wén'), 'wen2');
  assert.equal(markedToNumbered('hǎo'), 'hao3');
  assert.equal(markedToNumbered('shì'), 'shi4');
  assert.equal(markedToNumbered('ma'), 'ma5');
  assert.equal(markedToNumbered('lǜ'), 'lü4');
  assert.equal(markedToNumbered('nǚ'), 'nü3');
  assert.equal(markedToNumbered('Ń'), 'n2');
  assert.deepEqual(splitPinyin('zhōngwén'), ['zhōng', 'wén']);
  assert.deepEqual(splitPinyin("Xī'ān"), ['Xī', 'ān']);
  assert.deepEqual(splitPinyin('xiān'), ['xiān']);
  assert.deepEqual(splitPinyin('gèrén'), ['gè', 'rén']);
  assert.deepEqual(splitPinyin('tiānānmén'), null, 'an apostrophe is needed before ān');
  assert.deepEqual(splitPinyin('píngguǒ'), ['píng', 'guǒ']);
  assert.deepEqual(splitPinyin('Táiběishì'), ['Tái', 'běi', 'shì']);
  assert.deepEqual(splitPinyin('jiéyùn zhàn'), ['jié', 'yùn', 'zhàn']);
  // The word's number of characters picks between splits.
  assert.deepEqual(splitPinyin('xian', 2), ['xian'], 'no tone marks, no other way');
  assert.equal(splitPinyin('hello world'), null);
});

test('saved readings in zhuyin', () => {
  assert.equal(markedToZhuyin('zhōngwén'), 'ㄓㄨㄥ ㄨㄣˊ');
  assert.equal(markedToZhuyin('piányi'), 'ㄆㄧㄢˊ ˙ㄧ');
  assert.equal(markedToZhuyin('xièxie'), 'ㄒㄧㄝˋ ˙ㄒㄧㄝ');
  assert.equal(markedToZhuyin('lǚguǎn'), 'ㄌㄩˇ ㄍㄨㄢˇ');
  assert.equal(markedToZhuyin('zhīdào'), 'ㄓ ㄉㄠˋ');
  assert.equal(markedToZhuyin('Not pinyin!'), 'Not pinyin!');
});

test('pron follows the choice; Pinyin stays exactly as before', () => {
  assert.equal(pron('zhong1 wen2', 'pinyin'), 'zhōngwén');
  assert.equal(pron('zhong1 wen2', 'pinyin', false), 'zhōng wén');
  assert.equal(pron('xi1 an1', 'pinyin'), "xī'ān");
  assert.equal(pron('zhong1 wen2', 'zhuyin'), 'ㄓㄨㄥ ㄨㄣˊ');
  assert.equal(pronMarked('zhōngwén', 'pinyin'), 'zhōngwén');
  assert.equal(pronMarked('zhōngwén', 'zhuyin'), 'ㄓㄨㄥ ㄨㄣˊ');
});

test('parts for drawing a column beside each character', () => {
  assert.deepEqual(zhuyinParts('zhong1'), { letters: 'ㄓㄨㄥ', tone: '', er: '' });
  assert.deepEqual(zhuyinParts('wen2'), { letters: 'ㄨㄣ', tone: 'ˊ', er: '' });
  assert.deepEqual(zhuyinParts('ma5'), { letters: '˙ㄇㄚ', tone: '', er: '' });
  assert.deepEqual(zhuyinParts('dianr3'), { letters: 'ㄉㄧㄢ', tone: 'ˇ', er: 'ㄦ' });
  assert.deepEqual(zhuyinParts('r5'), { letters: 'ㄦ', tone: '', er: '' });
  assert.equal(zhuyinParts('?'), null);
});

test('注音 is the default; a saved choice is kept', () => {
  assert.equal(DEFAULT_SETTINGS.pron, 'zhuyin');
  assert.equal(normalizeSettings({}).pron, 'zhuyin');
  assert.equal(normalizeSettings({ pron: 'pinyin' }).pron, 'pinyin');
  assert.equal(normalizeSettings({ pron: 'nonsense' }).pron, 'zhuyin');
});
