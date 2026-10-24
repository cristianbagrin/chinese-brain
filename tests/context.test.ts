import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSentence, hasWord, metSentence, usefulSentence, saveInList, sentenceAt } from '../src/shared/context.ts';

const met = (text: string, word: string, max?: number, q?: string) => metSentence({ text, q }, word, max);

test('page-title clutter is trimmed from met-in sentences', () => {
  assert.equal(cleanSentence('維基百科，自由的百科全書 | PDF', '維基百科'), '維基百科，自由的百科全書');
  assert.equal(cleanSentence('面積 - 維基百科，自由的百科全書 | PDF', '自由'), '維基百科，自由的百科全書');
  assert.equal(cleanSentence('簡單可愛的夏日插畫集（單色）-插圖素材[114902300] - PIXTA圖庫', '的'), '簡單可愛的夏日插畫集（單色）');
  assert.equal(cleanSentence('臺北市政府全球資訊網-臺北行政區', '臺北市'), '臺北市政府全球資訊網');
  // Real sentences stay whole, English words and all.
  assert.equal(cleanSentence('我昨天去 Costco 買了很多東西。', '東西'), '我昨天去 Costco 買了很多東西。');
  assert.equal(cleanSentence('我會保留這個工作流程。', '流程'), '我會保留這個工作流程。');
});

test('a bare word or title is not a useful sentence', () => {
  assert.equal(usefulSentence('面積', '面積'), false);
  assert.equal(usefulSentence('我會保留這個工作流程。', '流程'), true);
});

test('saveInList: an edit replaces the saved sentence and remembers where it came from', () => {
  let list = saveInList([], { zh: '我們今天去看電影吧，好不好呢', en: 'x', on: true, from: '我們今天去看電影吧，好不好呢' }, 1);
  assert.deepEqual(list, [{ zh: '我們今天去看電影吧，好不好呢', en: 'x', at: 1 }]);
  list = saveInList(list, { zh: '我們今天去看電影吧', en: 'x', on: true, replace: '我們今天去看電影吧，好不好呢', from: '我們今天去看電影吧，好不好呢' }, 2);
  assert.deepEqual(list, [{ zh: '我們今天去看電影吧', en: 'x', at: 2, from: '我們今天去看電影吧，好不好呢' }]);
  // Editing a saved edit keeps the original source.
  list = saveInList(list, { zh: '今天去看電影吧', en: 'x', on: true, replace: '我們今天去看電影吧' }, 3);
  assert.equal(list[0].from, '我們今天去看電影吧，好不好呢');
  assert.deepEqual(saveInList(list, { zh: '今天去看電影吧', on: false }), []);
});

test('metSentence: the one sentence with the word, from stop to stop', () => {
  const text = '昨天下雨了。我今天去台北車站買便當！便當很好吃？Yes. 明天再去';
  assert.equal(met(text, '便當'), '我今天去台北車站買便當！');
  assert.equal(met(text, '明天'), '明天再去');
  // 。！？ inside 「」 or 『』 don't end the sentence.
  assert.equal(met('「你好嗎？」他問。我很好。', '他問'), '「你好嗎？」他問。');
  assert.equal(met('「你好嗎？」他問。我很好。', '你好'), '「你好嗎？」他問。');
  assert.equal(met('他說：「好啊。」然後就走了。下一句。', '然後'), '他說：「好啊。」然後就走了。');
  assert.equal(met('書名是『我是貓！』，很有名。', '有名'), '書名是『我是貓！』，很有名。');
  assert.equal(met('她說：「我說『不要！』了。」好。', '她說'), '她說：「我說『不要！』了。」好。');
  // A quote that never closes doesn't swallow the rest.
  assert.equal(met('前一句。「沒有結尾。後面有字。', '後面'), '後面有字。');
  assert.equal(met('你好。」他問我今天好不好。', '他問'), '他問我今天好不好。');
  assert.equal(met('第一行\n第二行有颱風\n第三行', '颱風'), '第二行有颱風');
  // . ! ? followed by a letter or digit don't end the sentence: 3.5, .srt, watch?v=.
  assert.equal(met('我買了3.5公斤的芒果。', '芒果'), '我買了3.5公斤的芒果。');
  assert.equal(met('請把字幕存成 .srt 檔案再上傳到網站。', '字幕'), '請把字幕存成 .srt 檔案再上傳到網站。');
  assert.equal(met('影片在 youtube.com/watch?v=abc 這裡可以看到字幕。', '字幕'), '影片在 youtube.com/watch?v=abc 這裡可以看到字幕。');
  // 臺 and 台 match each other.
  assert.equal(met('我住在台北。', '臺北'), '我住在台北。');
});

test('metSentence: empty when the word is not in the text', () => {
  assert.equal(met('我今天去台北車站。', '颱風'), '');
  assert.equal(met('', '颱風'), '');
  // Real ones: a page sentence saved for a word opened inside the card.
  assert.equal(met('對我來說，先後文學得越來越快。', '意義'), '');
  assert.equal(met('由於昨天的討論，因此我今天儘量跟我的台灣同學多講中文。', '向'), '');
});

test('metSentence: the word as it was written there (simplified) counts', () => {
  assert.equal(met('我们今天去学习中文吧。', '學習', 80, '学习'), '我们今天去学习中文吧。');
  assert.ok(hasWord('我们去学习吧', '學習', '学习'));
  assert.ok(!hasWord('我们去学习吧', '學習'));
});

test('metSentence: not an English note with a few Chinese words in it', () => {
  const note = "Standalone note (his running club team): 他的跑團隊友 (or 他跑步社的隊友 if it's a university club)";
  assert.equal(met(note, '隊友'), '');
  const blob =
    "ssions, transcribe with SenseVoice and convert the .srt to Traditional Chinese, or use Whisper Large and type 以下是台灣繁體中文的字幕： plus any custom names into AutoSubs' Vocabulary & Context prompt (OpenAI Whisper Discussion #277; AutoSubs changelog).";
  assert.equal(met(blob, '字幕'), '');
  // A name or two in English is fine.
  assert.equal(met('我跟John一起騎大屯山了。', '大屯山'), '我跟John一起騎大屯山了。');
  assert.equal(met('然後父母跟他說「你要說『You’re welcome』」。', '要說'), '然後父母跟他說「你要說『You’re welcome』」。');
});

test('metSentence: caption cues are not part of the sentence', () => {
  assert.equal(met('[音樂] 我們一起來玩遊戲吧 [掌聲]', '遊戲'), '我們一起來玩遊戲吧');
  assert.equal(met('*拍手* 遊戲 *拍手* 週!', '遊戲'), '');
  assert.equal(cleanSentence('♪ 真是太幸福了 ♪', '幸福'), '真是太幸福了');
});

test("metSentence: a long YouTube comment becomes the part around the word", () => {
  const comment =
    '謝謝你們決定去小琉球環島我爸爸是純純的小琉球人，他已經看這支影片看3次了（估計還會有4、5、6⋯次）邊看邊跟我分享這裡是他同學的家、那裡是他小時候上學會經過的地方，他從小就在小琉球生活，也真的會游泳上學，驗證了阿斷的游泳環島哈哈哈哈';
  const out = met(comment, '估計');
  assert.ok(out.includes('估計'), out);
  assert.ok(out.length <= 82, `${out.length}: ${out}`);
});

test('metSentence: YouTube English stays only with the whole cue', () => {
  assert.equal(met('颱風來了 — The typhoon is here', '颱風'), '颱風來了 — The typhoon is here');
  assert.equal(met('你好。颱風來了 — Hi. The typhoon is here', '颱風'), '颱風來了');
});

test('metSentence: a long sentence is trimmed to ~80 around the word, between words', () => {
  const long =
    '在這個城市裡面有很多不同的地方可以去參觀，例如博物館、美術館、公園和夜市，' +
    '每個週末都有很多觀光客來這裡拍照和吃東西，而且當地人也很喜歡在晚上出來散步聊天，' +
    '所以整個城市一直都非常熱鬧';
  const out = met(long, '觀光客');
  assert.ok(out.includes('觀光客'));
  assert.ok(out.length <= 82, `${out.length}: ${out}`);
  assert.ok(out.startsWith('…') && out.endsWith('…'));
  // Cut between words: every piece is a whole word of the original.
  const inner = out.replace(/^…|…$/g, '');
  assert.ok(long.includes(inner));
  const seg = new Intl.Segmenter('zh-TW', { granularity: 'word' });
  const cuts = new Set([...seg.segment(long)].map((x) => x.index).concat(long.length));
  const at = long.indexOf(inner);
  assert.ok(cuts.has(at) && cuts.has(at + inner.length));
});

test('sentenceAt: the sentence around a point in a block', () => {
  assert.equal(sentenceAt('第一句。第二句有字！第三句。', 6), '第二句有字！');
  assert.equal(sentenceAt('no stop at all', 3), 'no stop at all');
});
