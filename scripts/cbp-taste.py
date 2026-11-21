#!/usr/bin/env python3
"""The taste test's samples (Chinese Brain Plus, Stage 2), built from Chris's own board and sent to the website.

    python3 scripts/cbp-taste.py <life/chinese folder> [--site URL] [--dry]

Four jobs, each with the exact prompt the board (or the weekly review) uses. Every model answers fresh; what the board
already has is kept as `board` for reference only (not shown in the test):
  card   15 study cards: the board's card prompt; board = the card Opus 5.5 wrote on the board
  grade  30 test answers: the board's grading prompt; board = the board's grade where it graded one, else below
  essay  6 essays: the weekly review's marking rules; board = the marks the review put on the board
  image  10 card pictures: Claude writes each prompt from his flashcard skill, three models draw it
Models taking the test: MODELS below. Key: CBP_PUSH_KEY in ~/.cbp-push.env.
"""
import json, os, re, sys, urllib.request
from pathlib import Path

SITE = 'https://chinese.cristianbagrin.com'
MODELS = [  # text: is Opus worth twice Sonnet's price? (Gemini was tried first: slow, often refused, dropped)
    {'model': 'anthropic:claude-sonnet-5-5', 'kind': 'text', 'label': 'Claude Sonnet 5.5'},
    {'model': 'anthropic:claude-opus-5-5', 'kind': 'text', 'label': 'Claude Opus 5.5'},
]  # + one picture "model" per style, below

# ---------------------------------------------------------------- cards (board/js/cards.js, cardPrompt)
CARD_FORMAT = """Write the card as lines that each start with one of these tags, in this order. Nothing else: no headings, no markdown except **bold**, no closing remarks.
word: the word
pinyin: its Taiwan reading
meaning: short English
mine: Chinese | pinyin | English            (one per saved sentence of his, if any)
ex: Chinese | pinyin | English              (exactly two; a short exchange fits on one line: A：… B：…)
char: 字 | its meaning                       (one per character of the word, in order)
part: 扌 | hand                              (a component of the char above)
part: 巨 | giant, huge | ask                 (a common character on neither of his lists: meaning only, not taken apart; the board asks him if he knows it)
sub: 隹 | short-tailed bird                  (a component of the part above, when that part is unfamiliar)
story: the story, 2 or 3 short sentences, with the characters and parts written inside it in Chinese
know: one proactive-knowledge point, one sentence     (2 to 4; two strong ones beat four)
second: word | why he should learn it right now, one short line     (only when your judgment says so)

For a character he knows, write its char line and nothing under it. Write no "do you know…" question: the ask flag does that. Skip "Suggested next": the board shows his queue.

The story is the one place the characters get made sense of. It explains them through their parts the way a Taiwanese friend would, down to earth, so he sees it every time he looks at the character ("耂 is an old person hunched over with long hair, the top of 老"). Wild and funny when it helps it stick, never long. No separate logic or mnemonic lines.

Before you send, check: every line is as short as it can be; every word and phrase is what people in Taiwan say (mainland-only usage is wrong here: 揹黑鍋, not 背鍋); every pinyin tone mark is right; the story is 2 or 3 sentences and has the characters in it; each know point is about real use (which word a Taiwanese person reaches for, register, collocations), not grammar talk; nothing is introduced by a label or title before the point ("The 'progress' trap: …" becomes just the point); Chinese text has only Chinese punctuation."""
HAN = re.compile(r'[㐀-鿿⺀-⿕]')


def card_prompt(kit, word, next_up, docs):
    saved = (kit.get('saved') or {}).get(word.replace('臺', '台')) or []
    nu = next((r for r in next_up if r[0] == word), None)
    chars = [c for c in word if HAN.match(c)]
    char_set, comp_set = set(kit.get('chars') or ''), set((kit.get('components') or '').split())
    known = lambda c: c in char_set or c in comp_set
    recent = [d['word'] for d in sorted((d for d in docs if d.get('word') and d['word'] != word and (d.get('carded') or d.get('text'))), key=lambda d: d.get('made') or '', reverse=True)][:15]
    queue = [r[0] for r in next_up if r[0] != word]
    sprint = f"\nRight now: {kit['sprint']}\n" if kit.get('sprint') else ''
    savedtxt = ('\n' + '\n'.join('- ' + s for s in saved)) if saved else 'none'
    return f"""You are Chris's Taiwan Mandarin tutor. He is high A2, learns Traditional characters and Taiwan usage, and makes his Anki cards by hand from what you write. Write ONE card for: {word}{f' (his queue says: {nu[1]}, {nu[2]})' if nu else ''}

=== HIS CARD RULES (his words; they decide what goes in a card) ===
{kit['spec']}
{sprint}
The layout these rules describe is replaced by the line format at the end. Everything else in them holds. "Companion words" becomes the second: line.

=== WHAT HE KNOWS (checked by the board, exact) ===
The characters of {word}: {'; '.join(f"{c} {'KNOWN: char line only, nothing under it' if known(c) else 'new to him'}" for c in chars) or 'none'}
Every single character he knows: {kit['chars']}
Known components: {kit['components']}
Words he knows: {kit['known']}
Words he is learning: {kit['learning']}
His saved sentences for {word}: {savedtxt}
Carded lately: {' '.join(recent) or 'none'}
Queued next: {' '.join(queue) or 'none'}

=== A SECOND CARD ===
Judge it the way a good tutor sitting next to him would. Is there one other word he should learn right now, together with this one, so the pair does more than either alone? It earns a card when, for example, the target has a fixed partner, it is half of a pair, Taiwanese people actually reach for another word in its place, or the meaning leans on a word he lacks. Use your judgment beyond these: the test is whether he would be stuck, misled or clearly short-changed without it. A merely related word, a synonym list or a word he already knows or carded lately does not count. Most cards need none. At most one.

=== FORMAT ===
{CARD_FORMAT}"""


# ---------------------------------------------------------------- grades (board/js/test.js, gradePrompt)
def grade_prompt(it, answer, retry_ask=None):
    retry = retry_ask is not None
    extra = ''
    if it.get('hear'):
        extra += f'\n- This is a listening item: pass means his reply shows he understood "{it["target"]}" in the line he heard. Repeating the word back from that line without showing what it means is none, not partial.'
    if it.get('read'):
        extra += f'\n- This is a reading item: pass means his reply shows he understood "{it["target"]}" in the line he read; an answer that skips it or gets it wrong is a fail, not none.'
    follow = 'always ""' if retry else 'only when result is none: a new everyday situation in English where the target is the only natural answer, never naming the target or a synonym of it. Otherwise ""'
    ask = retry_ask if retry else it.get('ask', '')
    natural = ('the situation asks for English, so natural is a good plain-English version of what the line says. English only, not Chinese.' if re.search('english', ask or '', re.I) else
               'how a Taiwanese friend would say what he meant, in one short line: Traditional characters, Taiwan usage, Chinese punctuation (，。？！ never , . ? !). Keep his tone: casual stays casual, polite stays polite. Use words people really say every day and keep to his level; a new word only where it is clearly the natural choice.')
    tail = ''
    if it.get('hear'):
        tail += f"\nThe line he heard: {it['hear']}"
    if it.get('read') and not retry:
        tail += f"\nThe line he read: {it['read']}"
    return f"""You grade one answer in Chris's Taiwan Mandarin speaking test. He is high A2 and answers by voice through speech-to-text.
Reply with only this JSON: {{"result": "pass" | "partial" | "fail" | "none", "natural": string, "why": string, "followup": string}}

Grade the target only: {it['target']}
What the answer must show: {it['check']}
A model answer: {it['model']}

- Ignore the characters the transcriber picked (在/再, 的/得, 他/她) and punctuation; grade words, word order and completeness.
- A slip that turns what he clearly meant into other characters: grade what he meant, and start why with "Likely meant …". Read the answer aloud in your head: sound-alikes can hide the target itself (回答 huídá for 會打 huì dǎ hides 打赤腳 in 您也回答赤腳走嗎).
- pass: the target is used correctly and every part of the ask is answered.
- partial: the target is right but part of the ask is missing, or the target is only half right.
- fail: the target is wrong, or missing where the situation required it (a dropped half, a question instead of the statement asked for, English in its place).
- none: no evidence either way: a synonym or paraphrase in place of the target, or a use where he couldn't have gone wrong.{extra}

The three text fields:
- natural: {natural}
- why: one or two short, friendly, plain-English lines about the target: what to change and the frame to use (兩碗 + noun), never a grammar rule, never blaming. Say the point straight; no label or title before it. Empty for a clean pass.
- followup: {follow}.

The situation: {retry_ask if retry else it.get('ask', '')}{tail}
His answer: {answer}

Before you reply, check: natural is in the language the situation asks for; Chinese text has only Chinese punctuation; why is short, kind and starts with the point. Reply with the JSON only."""


def G(result, natural, why='', followup=''):
    return {'result': result, 'natural': natural, 'why': why, 'followup': followup}


# Claude's grade where the board never graded the answer (Opus 5.5, this session, on the same prompt): target → answer → grade
CLAUDE_GRADES = {
    ('值得', '他們的牛肉麪還好好吃，但不值得排那麼久'): G('pass', '他們的牛肉麵還蠻好吃的，但不值得排那麼久。'),
    ('進行', '倒置現在還算進行得蠻順利'): G('pass', '到現在都還算進行得蠻順利的。'),
    ('Separable verbs split', '我剛剛跑完步後洗了半個小時的澡'): G('pass', '我剛剛跑完步之後洗了半個小時的澡。'),
    ('放輕鬆', '放輕鬆，沒有對不對的回覆啊'): G('partial', '放輕鬆啦，我們只是聊聊天，沒有對錯。', 'The just-chatting half is missing: 我們只是聊聊天. "No right or wrong" is 沒有對錯.'),
    ('光', '我錢光了，沒辦法來'): G('partial', '我這個月的錢都花光了，沒辦法去。', 'Money runs out through a verb: 錢花光了 (spent to the last bit), not 錢光了. And you are the one going: 去.'),
    ('光是', '我房租每個月吃半個薪水啊'): G('none', '光是房租就要花掉我一半的薪水了。', 'No 光是 in the answer, so no evidence. The frame: 光是 + thing + 就 + how much.', 'A friend asks whether your new phone was expensive. Tell her the case alone already cost you 1,000 NT.'),
    ('光是', '光是買飛票就比旅遊的貴'): G('pass', '光是機票就比整趟旅遊還貴。'),
    ('打赤腳', '您也回答赤腳走嗎？'): G('none', '您也會打赤腳走嗎？', '赤腳 alone is a fair synonym, so no evidence on 打赤腳. The frame: 打赤腳 + 走.', 'Your niece runs out into the yard with no shoes on. Ask her why she is out there with bare feet.'),
    ('打赤膊', '你年輕的時候打赤膊做事喔？我也是啊。'): G('pass', '你年輕的時候都打赤膊做事喔？'),
    ('脫光光', '可以光著身子進去'): G('none', '要脫光光進去，不能穿泳衣喔。', '光著身子 is a fair way to say naked, so no evidence on 脫光光. "You have to" is 要, not 可以.', 'Your little nephew is about to get into the bath with his clothes still on. Tell him what he has to do first.'),
    # the same items answered the way he could have: each checks one call the grader has to get right
    ('又 for a past repeat', '我今天再去吃滷肉飯了。'): G('fail', '我今天又去吃滷肉飯了。', '再 is a repeat still to come; this one already happened, so 又: 我今天又去了.'),
    ('跟 / 先 after the modal', '會啊，不過我要先把作業寫完再過去。'): G('pass', '會啊，不過我要先把作業寫完再過去。'),
    ('伯母', "Eileen's mom said that next time you come over, she'll cook beef noodles for you."): G('pass', '伯母說你下次來，她要煮牛肉麵給你吃喔！'),
    ('光', '我這個月錢都花完了，不能去。'): G('none', '我這個月的錢都花光了，沒辦法去。', '花完了 is a fair synonym, so no evidence on 光. Spent to the very last is 花光.', 'You get to the bakery at 5 pm and every loaf is gone. Tell your friend what happened to the bread.'),
    ('放輕鬆', '放輕鬆，不用緊張啦！'): G('partial', '放輕鬆啦，我們只是聊聊天，沒有對錯。', 'The just-chatting half is missing: 我們只是聊聊天，沒有對錯.'),
    ('Separable verbs split', '跑步完我洗澡了半個小時。'): G('fail', '我跑完步洗了半個小時的澡。', 'A separable verb splits around the length: 洗了半個小時的澡. Finishing a run is 跑完步.'),
    ('脫光光', '要脫光光喔！'): G('partial', '大眾池要脫光光，不能穿泳衣喔。', 'The no-swimsuit half is missing: 不能穿泳衣.'),
    ('由', 'Dad is bringing dinner home today, everyone be back before 7.'): G('partial', '今天晚餐爸爸煮，大家七點前回家。', '由 here means "done by": 由爸爸煮 = Dad does the cooking, not brings it.'),
}
VARIANTS = [('又 for a past repeat', '我今天再去吃滷肉飯了。'), ('跟 / 先 after the modal', '會啊，不過我要先把作業寫完再過去。'),
            ('伯母', "Eileen's mom said that next time you come over, she'll cook beef noodles for you."), ('光', '我這個月錢都花完了，不能去。'),
            ('放輕鬆', '放輕鬆，不用緊張啦！'), ('Separable verbs split', '跑步完我洗澡了半個小時。'), ('脫光光', '要脫光光喔！'),
            ('由', 'Dad is bringing dinner home today, everyone be back before 7.')]
NOV11 = [('Separable verbs split', '我剛剛跑完步後洗了半個小時的澡'), ('放輕鬆', '放輕鬆，沒有對不對的回覆啊'), ('光', '我錢光了，沒辦法來'),
         ('光是', '我房租每個月吃半個薪水啊'), ('光是', '光是買飛票就比旅遊的貴'), ('打赤腳', '您也回答赤腳走嗎？'),
         ('打赤膊', '你年輕的時候打赤膊做事喔？我也是啊。'), ('脫光光', '可以光著身子進去')]

# ---------------------------------------------------------------- essays (the chinese-essay-review skill's marking rules)
ESSAY_RULES = """You review one of Chris's daily Chinese essays. He is high A2, writes Traditional characters and wants Taiwan usage. He reads your marks inside his essay, so keep it light: a few marks that matter, never homework.

Reply with only this JSON: {"marks": [{"t": "fix" | "better" | "word" | "good", "mine": string, "nat": string, "note": string}]}
- t: fix = a mistake · better = right, but not how a Taiwanese person would say it · word = English he dropped in, then the Chinese · good = something he did well (one or two per essay; nat and note empty).
- mine: his words exactly as he wrote them, copied from the essay, enough of them to land only where you mean.
- nat: the right version: Taiwan Mandarin, Traditional characters, no longer than it needs to be.
- note: only when it adds what nat doesn't show, in English, one line: a frame (兩碗 + noun) beats a grammar rule; gloss anything above ~B1. Otherwise "".
- Mark what matters. A typing slip inside a corrected phrase gets fixed with it; a typing slip on its own (sound-alikes like 在/再, 的/得) gets no mark.
- English is fine only when he couldn't find any way to say it: mark it as word, never as a mistake.
- Marks in the order they come in the essay.

What he keeps getting wrong (attack these when they show up):
"""


def essay_prompt(leaks, essay):
    return ESSAY_RULES + leaks + f"\n\nThe essay (DAY {essay['day']}, {essay['date']}):\n{essay['text']}"


# ---------------------------------------------------------------- images (reference/SKILL-taiwanese-mandarin-flashcards.md, Style 3)
STYLE = ("A tactile Taiwanese picture-book illustration (台灣繪本): chunky wax-crayon and oil-pastel edges, thick hand-painted gouache "
         "brushwork, visible warm paper grain. The whole image is in color from one soft, harmonious palette of 3 to 5 related hues; "
         "secondary people and context in the palette's quieter, paler tones, the thing that carries the meaning in its deepest, richest "
         "tone. Never a mostly black-and-white image with an isolated bright accent. Pure solid white (#FFFFFF) background with at least "
         "65% empty white space, one unified scene, no split panels, simple hands (at most two items per person), faces matching the "
         "mood. Strictly wordless: zero text, no letters, no Chinese characters, no numbers, no symbols. Square. The scene: ")
# the last picture round (2026-11-21): Claude Sonnet wrote each prompt from his flashcard skill (reference/), the way a
# real card would get its picture, and three models draw the same prompt. His notes on the first two rounds: the meaning
# must land at a glance, funny and over the top beats polite, crayon picture-book style, words only when they help
PICTURE_MODELS = [('pollinations:black-forest-labs/flux.1.1-pro', 'FLUX 1.1 Pro'), ('pollinations:black-forest-labs/flux.2-flex', 'FLUX.2 Flex'), ('pollinations:microsoft/mai-image-2.7', 'MAI Image 2.7')]
PICTURE_PROMPTS = {
    "值得": "Tactile Taiwanese picture-book illustration, chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, not 3D or glossy. One harmonious palette of warm ochre, dusty terracotta and muted teal, with the deepest, most saturated tone reserved for the reward. Scene: a big-eyed, exhausted, sweaty boy with a giant grin, drenched and muddy, has dragged an enormous pale-grey boulder of homework books up a tiny hill. He holds up, with both hands, one huge glowing golden trophy-shaped bubble tea cup, tears of joy streaming and stars bursting around his face. A small balance scale beside him shows the pale heavy boulder tipping far upward, outweighed by the single tiny glowing cup. Exaggerated anime-style comedic expression, big readable face. Pure solid white #FFFFFF background, at least 70% empty white space, no clutter, single scene, no text.",
    "拒絕": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, never 3D or glossy. One harmonious palette of dusty rose, sage green and warm ochre, with the deepest saturated rose reserved for the key prop. Scene: a big round-faced man with a huge, exaggerated frown, eyes squeezed shut and chin raised, stiffly straight-armed, slams one giant palm out toward a smiling woman holding out a towering, wobbling plate of dumplings. His palm is pressed flat against the plate. Her hopeful face is wilting into comic shock, with sweat drops and crayon speed lines bursting off his palm. A small speech bubble above him reads \"不要!\". Pale, quiet tones for her and her clothing; deepest rose for his palm, the speed lines and the bubble. Pure solid white #FFFFFF background, at least 70% empty white space, no other objects, no captions or labels, single unified scene.",
    "接受": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, never 3D or glossy. One harmonious palette of dusty rose, warm ochre, and sage, with the deepest saturated rose reserved for the gift and the joyful heart aura. Scene: a big round-faced girl with huge sparkling eyes and a beaming open-mouthed smile, arms wide open, hugging a giant ribbon-wrapped gift box that a pale, small friend hands over. The box is pulled tight against her chest, her whole body leaning in, little crayon hearts bursting around her. Exaggerated, anime-like joy, readable at a glance. Pure solid white #FFFFFF background, over 70% empty white space, no clutter, single scene. Speech bubble in Traditional Chinese: \"好啊，謝謝！\" No other text.",
    "浪費": "Tactile Taiwanese picture-book illustration, Style 3: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, never 3D or glossy. One harmonious palette of dusty teal, warm ochre, and pale peach, with the deepest saturated teal reserved for the wasted water. Scene: a big-eyed, horrified-then-oblivious man brushing his teeth at a small sink, the faucet gushing a huge, absurd torrent of deep teal water that pours over the sink, down the drain in swirling waves, and onto the floor. He stares dreamily at the ceiling, while a tiny, wide-eyed, gasping cat beside him watches the flood in shock. Exaggerated, readable faces and anime-style gag energy lines. Pure solid white #FFFFFF background, at least 65% empty white space, no room clutter, single unified scene. No text.",
    "捨不得": "Tactile Taiwanese picture-book illustration in chunky wax-crayon and thick gouache, visible warm paper grain, flat hand-drawn look, never 3D or glossy. One soft palette of dusty rose, warm ochre and muted teal, with the deepest saturated rose reserved for the beloved object. Scene: a big-eyed child with tearful, wobbling-mouth face hugs a worn, patched teddy bear with both arms, clinging desperately, while a calm parent holds out a donation box labeled \"捐贈\" in pale teal. The child's feet are dug in, legs stretched backward in an over-the-top comic tug-of-war, with exaggerated streaming tears and little crayon heart-crack lines around the bear. Parent drawn in quiet pale tones. Pure solid white #FFFFFF background, at least 65% empty white space, no other clutter, single unified scene, no captions or labels. Only the short text \"捐贈\" on the box.",
    "孝順": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, not 3D or glossy. One harmonious palette of warm ochre, dusty rose and muted teal, with the deepest saturated tone saved for the bowl of soup and the glowing heart. Scene: a comically over-the-top devoted grown son with huge, readable, beaming eyes kneels on the floor, massaging his smiling elderly mother's feet with one hand. In the other hand he holds up a steaming soup bowl to her. She sits in a simple chair with a blissful, closed-eye smile. An oversized glowing rose-red heart floats between them, and little sparkle lines burst from the son. Pale washes for clothes and chair. Pure solid white #FFFFFF background, at least 70% empty white space, no furniture clutter, one unified scene, no panels. Speech bubble in Traditional Chinese: \"媽，我來！\" No other text, no captions or labels.",
    "心意": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, not 3D or glossy. One harmonious palette of dusty rose, warm ochre and sage, with the deepest saturated rose reserved for the gift's glowing heart. Scene: a child with big, beaming, teary-eyed face proudly holds up a lumpy, lopsided handmade gift box with a crooked ribbon and a huge glowing rose-red heart radiating from inside it. Across from the child, a parent in pale washed-out tones clutches the gift to their chest, eyes sparkling with exaggerated anime-style happy tears. The shabby wrapping, with taped corners and scribbled crayon patches, is obviously cheap, but the heart's glow dwarfs it. Pure solid white #FFFFFF background, at least 70% empty white space, no other objects, one unified scene. No text.",
    "負責": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, never 3D or glossy. One palette of dusty terracotta, ochre and muted teal, with the deepest terracotta on the key props. Scene: at a classroom, a pot of soup has tipped over. One small schoolboy steps forward from a row of three pale-teal classmates who all point at the mess and back away; he thumps his chest with one hand, a mop already in the other, with a big determined, wide-eyed face, over-the-top heroic, comic sparkle lines around him. Speech bubble above him: \"我來！\". Pure solid white #FFFFFF background, at least 65% empty white space, no other clutter, no captions or labels, one unified scene.",
    "顧孫": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel outlines, thick gouache brushwork, visible warm paper grain, flat hand-drawn look, not 3D or glossy. One harmonious palette of dusty rose, warm ochre, and sage, with the deepest saturated tones on the grandma and the kids. Scene: a cheerful grandmother sits on a small stool, wearing a floral apron and holding a baby bottle in one hand and a toy rattle in the other. Three over-the-top hyperactive grandkids swarm her. One kid hangs from her shoulders, one rides her lap pulling her glasses crooked, and one stands on the stool waving a wooden spoon. Her eyes are wide and her smile is exhausted but loving, with big readable faces and comic motion lines. Pure solid white #FFFFFF background, at least 65% empty white space, no furniture or clutter, one single scene. No text.",
    "其中": "Tactile Taiwanese picture-book style: chunky wax-crayon and oil-pastel edges, thick gouache brushwork, visible warm paper grain, flat 2D drawing, no gloss. One harmonious palette of dusty teal, warm ochre, and pale cream, with the deepest saturated ochre-orange reserved for the focal item. Scene: a huge, round, comically surprised cartoon boy with big readable eyes and open mouth holds up one single plump orange persimmon, pinched between two fingers, pulled out of a big pale-teal woven basket crowded with dozens of pale, washed-out persimmons. A bold dotted arrow curves from the basket's crowd to the chosen fruit, which glows with deep orange crayon strokes. His other hand points proudly at it. The message: one picked from within a group. Pure solid white #FFFFFF background, over 65% empty white space, no clutter, single unified scene, no text."
}
IMAGES = [  # word, what it means, the scene (designed to rule out its nearest confusion)
    ('值得', 'worth it', 'a young man at the front of a very long line outside a small noodle stall, finally holding his steaming bowl of beef noodles, eyes shut in pure delight after the first bite; the long tired line stretches far behind him'),
    ('拒絕', 'to refuse', 'a grandmother at a round dinner table firmly pushing back a red envelope that a young man offers her with both hands, her palm held up flat like a wall, shaking her head with a kind but immovable smile'),
    ('接受', 'to accept', 'an old shopkeeper happily taking a small wrapped gift from a shy student with both open hands, bowing slightly, clearly receiving it'),
    ('浪費', 'to waste', 'a boy at a night market tossing a nearly full bubble tea into an overflowing bin while a full bowl of rice beside him goes cold, a stray cat staring at him in disbelief'),
    ('捨不得', "can't bear to part with", 'a grandmother hugging a worn old rice cooker to her chest while her grandson holds out a shiny new one; she turns away from the new one, eyes closed, holding the old one tight'),
    ('孝順', 'filial, good to one\'s parents', 'a grown son kneeling to wash his elderly father\'s feet in a wooden basin of warm water on a quiet evening, the father smiling down at him'),
    ('心意', 'the thought behind a gift', 'a small child giving a lopsided hand-folded paper flower to her mother, who holds it to her heart, moved; a fancy store-bought gift box sits ignored on the side'),
    ('負責', 'to be responsible for', 'one young woman carrying a whole stack of party plates and a cake toward a table, clipboard under her arm, while three friends behind her each hold only a balloon'),
    ('顧孫', 'to babysit the grandkids', 'a grandmother on a low stool in a Taiwanese apartment doorway watching two toddlers play with blocks at her feet while the parents wave goodbye far in the background'),
    ('其中', 'among them', 'a woven basket of a dozen green guavas seen from above, and among them one single ripe pink guava, a small hand reaching for exactly that one'),
]


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith('-'):
        sys.exit(__doc__)
    root = Path(a[0]).expanduser()
    site = (a[a.index('--site') + 1] if '--site' in a else SITE).rstrip('/')
    db = root / '.db' / 'cbp'
    rd = lambda p: json.loads((db / p).read_text(encoding='utf-8'))
    items, ord_ = [], 0

    def add(job, iid, title, show, prompt, claude, as_json):
        nonlocal ord_
        ord_ += 1
        items.append({'id': iid, 'job': job, 'ord': ord_, 'data': {'title': title, 'show': show, 'prompt': prompt, 'json': as_json, 'board': claude}})

    # cards: the 15 newest Opus cards
    kit, data = rd('board/cardkit.json'), rd('board/data.json')
    docs = [json.loads(p.read_text(encoding='utf-8')) for p in sorted((db / 'cards').glob('*.json'))]
    for d in sorted((d for d in docs if d.get('text')), key=lambda d: d.get('made') or '', reverse=True)[:15]:
        add('card', f"card-{d['word']}", d['word'], {'word': d['word']}, card_prompt(kit, d['word'], data.get('nextUp') or [], docs), d['text'], False)

    # grades: every answered item on his last two tests, then the variants
    t18 = rd('board/test.json')['items']
    t11 = json.loads((root / '.db' / 'out-sync-2026-11-20' / 'test-2026-11-11.json').read_text(encoding='utf-8'))['items']
    by = {i['target']: i for i in t11 + t18}
    n = 0

    def grade(it, answer, claude, retry_ask=None):
        nonlocal n
        n += 1
        show = {k: it[k] for k in ('target', 'kind', 'hear', 'read') if it.get(k)}
        show.update({'ask': retry_ask or it['ask'], 'answer': answer, 'check': it['check'], 'model': it['model']})
        add('grade', f'grade-{n:02d}', it['target'], show, grade_prompt(it, answer, retry_ask), claude, True)

    for it in t18:
        real = G(it['result'], it.get('natural') or '', it.get('why') or '', (it.get('retry') or {}).get('ask', '') if it.get('result') == 'none' else '') if it.get('result') else None
        grade(it, it['answer'], real or CLAUDE_GRADES[(it['target'], it['answer'])])
        r = it.get('retry')
        if r and r.get('answer'):
            real = G(r['result'], r.get('natural') or '', r.get('why') or '') if r.get('result') else None
            grade(it, r['answer'], real or CLAUDE_GRADES[(it['target'], r['answer'])], r['ask'])
    for target, answer in NOV11 + VARIANTS:
        grade(by[target], answer, CLAUDE_GRADES[(target, answer)])

    # essays: six the weekly review marked
    md = (root.parent.parent / '_memory' / 'chinese.md').read_text(encoding='utf-8', errors='replace')
    leaks = md[md.index('### Leaks (attack these)'):md.index('### What he knows')]
    leaks = re.sub(r'\*\*Retest table\*\*.*?\n\n', '', leaks, flags=re.S)
    for d in ['d053', 'd055', 'd056', 'd059', 'd060', 'd061']:
        e, r = rd(f'essays/{d}.json'), rd(f'reviews/{d}.json')
        marks = [{k: m.get(k, '') for k in ('t', 'mine', 'nat', 'note')} for m in r['marks']]
        add('essay', f'essay-{d}', f"DAY {e['day']}", {'text': e['text'], 'date': e['date'], 'day': e['day']}, essay_prompt(leaks, e), {'marks': marks}, True)

    # images
    for w, gloss, scene in IMAGES:
        add('image', f'drawn-{w}', w, {'word': w, 'gloss': gloss}, PICTURE_PROMPTS[w], None, False)

    counts = {}
    for it in items:
        counts[it['job']] = counts.get(it['job'], 0) + 1
    print(counts)
    if '--dump' in a:  # the items as JSON, for trying a prompt change without loading it
        Path(a[a.index('--dump') + 1]).write_text(json.dumps(items, ensure_ascii=False), encoding='utf-8')
        return
    if '--dry' in a:
        print(items[16]['data']['prompt'][:1500])
        return
    k = os.environ.get('CBP_PUSH_KEY') or next(l.split('=', 1)[1].strip() for l in (Path.home() / '.cbp-push.env').read_text().splitlines() if l.startswith('CBP_PUSH_KEY='))
    req = urllib.request.Request(site + '/api/plus/push/taste', data=json.dumps({'items': items, 'models': MODELS + [{'model': m, 'kind': 'image', 'label': label} for m, label in PICTURE_MODELS]}, ensure_ascii=False).encode(), method='POST',
                                 headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'cbp-taste'})
    print(urllib.request.urlopen(req, timeout=120).read().decode())


if __name__ == '__main__':
    main()
