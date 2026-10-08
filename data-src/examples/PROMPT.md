# Example sentences: writing brief

You are writing example sentences for a Taiwan Mandarin learner's pop-up
dictionary. The learner lives the Taiwan variety: Traditional characters,
Taiwan vocabulary and Taiwan speech habits. Every sentence must sound like
something a Taiwanese person would naturally say or write today.

For EACH word in your input file (columns: word, numbered pinyin, English
gloss) write exactly TWO example sentences with English translations.

## Rules
1. The headword appears in the sentence exactly as given (same characters).
   Use the sense given in the gloss (the first, most common sense).
2. Traditional characters only (台灣 standard forms: 裡, 台, 著, 為, 麼, 這, 說, 臺 only in official names).
3. Taiwan usage, not Mainland usage. Examples: 捷運 not 地铁, 機車 (scooter) not 摩托车,
   腳踏車 not 自行车, 計程車 not 出租车, 影片 not 视频, 軟體 not 软件, 網路 not 网络,
   資訊 not 信息, 便利商店/超商, 早餐店, 夜市, 垃圾車, 悠遊卡, 公車 not 公交车,
   馬鈴薯 not 土豆, 鳳梨 not 菠萝, 冷氣 not 空调, 品質 not 质量, 品質/水準, 優酪乳.
   Never use 兒化 (no 一點兒/這兒/哪兒; use 一點/這裡/哪裡).
   Taiwan-flavoured particles are welcome where natural: 啦, 喔, 耶, 欸, 嘛, 吧, 齁 (sparingly).
4. Sentence 1: short and simple (6-14 characters), everyday situation, easy words around the headword.
   Sentence 2: a bit richer (12-24 characters), a natural spoken or written context that shows how the word is really used (typical collocation, measure word, or construction).
5. Concrete, varied situations from daily life in Taiwan (school, work, family, food, MRT, weather,
   shopping, friends, phone, health, news). No proper names of real people; use 我/你/他/她/我媽/同事/老闆/朋友 etc.
   Don't reuse the same scene over and over.
6. Function words and particles (的, 了, 吧, 把, 被, 就, 才...) get sentences that show the grammar clearly.
   Formal or written words (與, 之, 其...) get a natural formal sentence (news, sign, notice) rather than forced speech.
7. Don't define the word inside the sentence. No meta sentences ("這個詞的意思是...").
8. English: natural, idiomatic, faithful, short. No pinyin.
9. If a word in the list is not a real standalone word, or you can't write a natural sentence, write one good sentence and leave the second line out, rather than writing something unnatural.

## Output
Append to the output file as TSV, one sentence per line, no header:
word<TAB>sentence<TAB>English

Write in batches of about 60 words per write so nothing is lost (create the file on the first batch, then append with Bash `cat >>` heredocs or by rewriting with the full content). Don't stop early: process every word in the input file, then reply "done N words".

## Variety
Keep the Taiwan flavour, but don't lean on the same props: use 捷運, 便當, 超商, 夜市, 悠遊卡
at most about once per 30 words each. Rotate through home, school, office, clinic, kitchen,
travel, sports, hobbies, weather, money, feelings, phone/apps, neighbours, pets, news.
Skip the word entirely (no lines) if it is only an obsolete variant character (e.g. 纔 for 才).
