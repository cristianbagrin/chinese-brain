import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Dictionary } from '../src/shared/dict.ts';
import { freshen, listPinyin, shortGloss } from '../src/shared/gloss.ts';
import type { Entry, WordRecord } from '../src/shared/types.ts';

const entry = (defs: string, py = 'x1'): Entry => ({ trad: '', simp: '', py, tw: '', defs: defs.split('/'), zipf: 0, tocfl: 0 });
const g = (defs: string) => shortGloss(entry(defs));

test('shortGloss: never cut mid-word (it used to stop at 120 characters)', () => {
  assert.equal(g('Southern Min, a Sinitic language spoken in southern Fujian and surrounding areas/Hokkien, the most widely spoken variety of Southern Min'), 'Southern Min; Hokkien');
  assert.equal(
    g('pineapple bun, a sweet bun popular esp. in Hong Kong (typically does not contain pineapple – the name comes from the rough top crust which resembles pineapple skin)'),
    'pineapple bun',
  );
  assert.equal(
    g('(indicating that sth turns out just the opposite of what one would wish) unfortunately; as it happened/(indicating that sth is the opposite of what would be normal or reasonable) stubbornly; contrarily; against reason/(indicating that sb or a group is singled out) precisely; only; of all people'),
    'unfortunately; as it happened; stubbornly; contrarily',
  );
  for (const out of [g('to chase/to pursue/to look into/to investigate/to reminisce/to recall/to court (one\'s beloved)'), g('a'.repeat(30) + ' ' + 'b'.repeat(50))]) {
    assert.ok(out.length <= 60, out);
    assert.ok(!/\s\S{1,3}$/.test(out) || out.endsWith('…') || /; \S+$/.test(out), out);
  }
});

test('shortGloss: no CC-CEDICT notation, measure words or duplicates', () => {
  assert.equal(g('game (CL:場|场[chang3])/to play'), 'game; to play');
  assert.equal(g('to scold/to abuse/to curse/CL:通[tong4],頓|顿[dun4]'), 'to scold; to abuse; to curse');
  assert.equal(g('pineapple bun 菠蘿包|菠萝包[bo1 luo2 bao1] with a slice of butter inserted'), 'pineapple bun 菠蘿包 with a slice of butter inserted');
  assert.equal(g('condition; circumstance; term; factor/requirement; prerequisite; qualification/situation; state; condition/CL:個|个[ge4]'), 'condition; circumstance; term; factor; requirement');
  assert.equal(g('kind; type; class; category/(classifier) kind; type/(bound form) to resemble; to be similar to'), 'kind; type; class; category; (bound form) to resemble');
  assert.equal(g('wife of father\'s elder brother/aunt/(polite form of address for a woman who is about the age of one\'s mother)/CL:個|个[ge4]'), "wife of father's elder brother; aunt");
});

test('shortGloss: a note that says which sense a short word has stays', () => {
  assert.equal(g('light (of food, not greasy or strongly flavored)/insipid/slack (sales)'), 'light (of food, not greasy or strongly flavored); insipid');
  assert.equal(g('to edit (raw footage: film, video, audio etc)/edited version'), 'to edit (raw footage: film, video, audio etc)');
  assert.equal(g('(completed action marker)/(modal particle indicating change of state, situation now)'), 'completed action marker');
  assert.equal(g('to take blood/to draw blood (e.g. for a test)'), 'to take blood; to draw blood (e.g. for a test)');
});

test('shortGloss: pointer-only entries say where they point; placeholders say nothing', () => {
  assert.equal(g('old variant of 留[liu2]'), 'old variant of 留');
  assert.equal(g('(not in the dictionary)'), '');
  assert.equal(g('(your own word)'), '');
});

test('listPinyin: long words spaced into their parts, short ones joined', () => {
  assert.equal(listPinyin('gong1 zuo4 ren2 yuan2', '工作人員', ['工作', '人員']), 'gōngzuò rényuán');
  assert.equal(listPinyin('xing2 dong4 dian4 yuan2', '行動電源', ['行動', '電源']), 'xíngdòng diànyuán');
  assert.equal(listPinyin('ling2 yong4 qian2', '零用錢', ['零用', '錢']), 'língyòngqián');
  assert.equal(listPinyin('ka3 la1 O K', '卡拉OK', ['卡拉', 'O', 'K']), "kǎlā'ok");
});

test('freshen: stored meanings and pinyin come back whole, from the stamped reading', () => {
  const dict = Dictionary.fromTsv(gunzipSync(readFileSync('static/data/dict.tsv.gz')).toString('utf8'));
  const rec = (w: string, p?: string, g?: string): WordRecord => ({ w, s: 'fresh', p, g, added: 1, updated: 1, hist: [], looks: 0, ctx: [] });
  // An old record: the meaning was cut at 120 characters.
  const old = rec('閩南語', 'mínnányǔ', 'Southern Min, a Sinitic language spoken in southern Fujian and surrounding areas; Hokkien, the most widely spoken variet');
  assert.equal(freshen(dict, old).g, 'Southern Min; Hokkien');
  // 種 was stamped as zhòng (to plant): that reading's meaning, not zhǒng's.
  assert.equal(freshen(dict, rec('種', 'zhòng', 'x')).g, 'to plant; to grow; to cultivate');
  assert.equal(freshen(dict, rec('工作人員', 'gōngzuòrényuán', 'staff member')).p, 'gōngzuò rényuán');
  // Typed in by hand, not in the dictionary: the parts' readings and meanings.
  const parts = freshen(dict, rec('脫鞋子'));
  assert.equal(parts.p, 'tuō xiézi');
  assert.match(parts.g ?? '', /^脫 .+ \+ 鞋子 shoe/);
  // Nothing to go on: left alone.
  assert.deepEqual(freshen(dict, rec('Costco')), rec('Costco'));
  // A hand-typed word the extension added to the dictionary as "your own word" (at startup), or
  // stored with that placeholder by an older version: the parts, not the placeholder.
  dict.addWord({ trad: '脫鞋子', simp: '脫鞋子', py: '', tw: '', defs: ['(your own word)'], zipf: 0, tocfl: 0, rank: 0, own: true });
  for (const r of [rec('脫鞋子'), rec('脫鞋子', undefined, '(your own word)')]) {
    const f = freshen(dict, r);
    assert.equal(f.p, 'tuō xiézi');
    assert.match(f.g ?? '', /^脫 .+ \+ 鞋子 shoe/);
  }
  // A sentence saved on a simplified page before its form there was kept still has the word.
  const simplified = { ...rec('學習', 'xuéxí', 'x'), ctx: [{ text: '我们今天去学习中文吧。', url: 'https://x.cn', at: 1, src: 'web' as const }] };
  assert.equal(freshen(dict, simplified).ctx[0].q, '学习');
});
