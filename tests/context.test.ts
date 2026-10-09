import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSentence, usefulSentence } from '../src/shared/context.ts';

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
