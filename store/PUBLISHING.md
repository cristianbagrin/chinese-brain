# Publishing Chinese Brain on addons.mozilla.org

Copy each block into the matching field of the AMO Developer Hub.

## Updating the published add-on (new version)

Users get a new version automatically once Mozilla approves it.

1. Build the zip (step 1 below). The version comes from `package.json`, so it is
   always higher than the last upload.
2. On the [Developer Hub](https://addons.mozilla.org/developers/addons), open
   Chinese Brain → **Upload New Version** → choose the zip from `release/`.
3. "Do you need to submit source code?" → **No**.
4. Paste the version notes (section 4) and, if permissions or remote requests
   changed, the notes to reviewer (section 5). Update the description and
   privacy policy on the listing if they changed (sections 2 and 3).
5. After approval (usually minutes to a day), Firefox updates on its own within
   a day, or right away from `about:addons` → ⚙ → **Check for Updates**.

## 1. Build the file to upload

```bash
git pull
npm ci
npm run zip      # -> release/chinese_brain-<version>.zip      (the add-on)
```

First release: upload it under **Submit a New Add-on → On this site**. Later
versions: see "Updating" above.
When asked "Do you need to submit source code?", answer **No**.

## 2. Listing

**Name**

```
Chinese Brain 中文腦
```

**Add-on URL**

```
chinese-brain
```

**Summary** (250 characters max)

```
Learn Taiwan Mandarin while you read and watch. Hover any Chinese word for Taiwan pinyin, meanings and natural example sentences; get dual Chinese + English subtitles on YouTube; keep one word list with Fresh, Learning and Known.
```

**Description**

```
Chinese Brain turns everything you read and watch into Taiwan Mandarin practice.

HOVER ANY CHINESE WORD
• Traditional characters with Taiwan standard pinyin (教育部 readings)
• How common the word is, in plain words: essential, very common, common, less common, rare
• The meaning, and a top-down breakdown: 臺北市 → 臺北 → 臺 · 北, then 市
• Two natural Taiwan-Mandarin example sentences, picked so the other words are ones you know. Play them aloud, save the ones you want to learn, delete the ones you don't
• The sentence you're reading and the last ones you met the word in: save them for your export, trimmed if you like
• Click any word inside the card to look it up; ← → to go back and forth
• Copy any example sentence with one click

SELECT ANYTHING
• Select Chinese text anywhere (pages, search boxes, Google Translate's box) and tap Option (Alt), or right-click → Look up
• Words get their card; names, phrases and whole sentences get pinyin, a translation and the words inside them
• Taiwan place names, sights and dishes (野柳, 清境, 滷肉飯, 薑母鴨…) are in the dictionary

ONE WORD LIST, THREE STATUSES
• 新 Fresh · 學 Learning · 熟 Known: press 1, 2 or 3
• The same colors in the card, the subtitles, the transcript, your word list, and (optional) on every page; Option+Shift+C (Alt+Shift+C) turns them on or off for one website
• Import your known-words list; export what changed each week as a small TSV

YOUTUBE DUAL SUBTITLES
• Chinese + English lines over the video; every word is hoverable and clickable
• The video pauses while you read
• Keys: A / D previous and next line, S replay, R loop, Q shadowing, P pinyin, X English line, E transcript
• Transcript with a "learn first" list: the words that unlock the most of this video
• How much of the video you already know, as a percentage

OPTIONAL, WITH YOUR OWN KEYS
• Gemini: subtitles for videos without Chinese captions (Mandarin is transcribed; other languages are translated into Taiwan Mandarin), and new example sentences
• Azure: a Taiwan neural voice

Copyright © Cristian Bagrin. All rights reserved. No account and no server of ours; your word list stays in your browser.

Data: CC-CEDICT (CC BY-SA 4.0); Taiwan readings from the MOE Revised Mandarin Dictionary via g0v/moedict-data (CC BY-ND 3.0 TW, pinyin only); word frequencies from wordfreq (CC BY-SA 4.0); names and foods from Wikidata (CC0).
```

**Categories**: Language Support · Photos, Music & Videos

**Tags**

```
chinese, mandarin, taiwan, traditional chinese, pinyin, dictionary, language learning, youtube, subtitles, vocabulary
```

**Homepage**

```
https://github.com/cristianbagrin/chinese-brain
```

(Only if the repository is public; otherwise leave it empty.)

**Support email or website**: your choice.

**License**: All Rights Reserved

**Icon**: `store/icon-128.png`

## 3. Privacy policy

Tick "This add-on has a privacy policy" and paste:

```
Chinese Brain keeps your data in your browser. It has no account, no analytics, and no server of its own. Your word list, settings and API keys are stored locally (browser storage) and are never sent to the developer.

Some features send data to third-party services, only to perform the feature:

• Reading words and sentences aloud (default voice): the text is sent to Google's text-to-speech service (translate.google.com) when you press V or a play button.
• English subtitle line on YouTube: when YouTube does not provide an English translation, the video's Chinese caption lines are sent to Google Translate (translate.googleapis.com).
• Looking up a selection: when you select Chinese text and ask for its card (Option key or right-click menu) and it is not a single dictionary word, the selected text is sent to Google Translate (translate.googleapis.com) for its English translation.
• Azure voice (optional, your own key): the text you play is sent to Microsoft Azure Speech in the region you choose.
• Gemini (optional, your own key): when you press "Subtitles with Gemini", the YouTube video's link is sent to the Google Gemini API; when you press "Write example sentences", the word and its short meaning are sent. On Google's free tier, Google may use these requests to improve its models.
• Image search: pressing I opens a DuckDuckGo image search for the word in a new tab.

Nothing else leaves your browser. Uninstalling the add-on deletes its data.
```

## 4. Version notes

1.3.0:

```
• The export saves through Firefox's save-as dialog, which opens in the folder you used last. Cancel it and nothing is marked as exported.
• The sentence column holds the one sentence the word appears in (punctuation inside 「」 or 『』 doesn't end it; trimmed to about 80 characters around it, between words), or nothing when the captured text doesn't contain the word.
• Edit any sentence in the card, example sentences included, Chinese and English (the pencil); the edited version is the one saved.
• The play, copy, edit and save buttons line up with the sentence.
• New word list: it opens on your Fresh words, as cards that line up, with a filter bar that stays on screen. Restamping a word keeps it in place; removing one can be undone.
• A word whose sentence you saved is in the next export even if its status didn't change. The export header explains the date, sentence and saved columns.
```

1.2.0:

```
• Save the sentence you met a word in: the card shows the sentence you're reading, with a bookmark to save it and a pencil to trim it first (Enter saves, Esc cancels). Saved sentences go into your export.
• Cleaner word list (the counts are the filter; export, import and backup in three small cards) and settings page.
• The toolbar menu fits without scrolling; the voice choice moved to All settings.
```

1.1.0:

```
• Look up anything you select: tap Option (Alt) or right-click → Look up. Names, phrases and sentences get pinyin and a translation; short ones can be saved as words.
• Taiwan place names, sights and dishes added to the dictionary (from Wikidata); 台 and 臺 spellings both work.
• Option+Shift+C (Alt+Shift+C) turns word colors on or off for a website; also in the toolbar menu.
• Page colors now work in editors like Notion and on pages that re-render text (image search, lightboxes).
• Copy button on example sentences.
• "Hold to look up" uses Option (Alt) instead of Shift.
```

1.0.1: First public release.

## 5. Notes to reviewer

```
Build (Node 22, npm 10):
  npm ci
  npm run build     # esbuild bundles src/ + static/ into dist/ (scripts/build.mjs); output is not minified
The uploaded add-on is the dist/ folder zipped by web-ext (npm run zip).

The bundled data files (static/data/dict.tsv.gz, names.tsv.gz, examples.tsv.gz) are prebuilt:
  dict: python3 scripts/build_data.py (downloads CC-CEDICT and MOE readings, uses the wordfreq package)
  names: python3 scripts/build_names.py (Wikidata SPARQL queries, CC0 data)
  examples: python3 scripts/build_examples.py (from data-src/examples/)

Permissions:
  <all_urls> + content script: hover lookup works on any page the user reads.
  webRequest + webRequestBlocking: only for *://*.youtube.com/api/timedtext* (see src/background/youtube.ts).
    filterResponseData passes the caption response through unchanged and keeps a read-only copy for
    the subtitle overlay. The add-on never requests timedtext itself.
  storage + unlimitedStorage: the word list, logs and caches stay local.
  menus: one context-menu item, "Look up" on selected text. If the selection is in a frame the content
    script was not already running in, tabs.executeScript injects the add-on's own content.js there.
  downloads: the word-list export is saved with downloads.download({ saveAs: true }) so the user picks
    the folder; it only ever downloads a blob the page just built.
  commands: one keyboard shortcut (Alt+Shift+C) that toggles page colors for the current site.

Remote requests (all user-facing features, listed in the privacy policy): translate.google.com (TTS),
translate.googleapis.com (caption translation fallback; translation of a selection the user looks up), *.tts.speech.microsoft.com (optional, user key),
generativelanguage.googleapis.com (optional, user key). No remote code is loaded; no eval, no innerHTML.

Data collection permissions: websiteContent (words and caption lines sent for speech and translation)
and browsingActivity (the YouTube link sent to Gemini when the user asks for it).
```

## 6. Screenshots (1280 × 800)

Take these in Firefox at 1280 × 800 (Responsive Design Mode helps):

1. The card over a Chinese web page (a word with examples and the breakdown).
2. YouTube with the dual subtitles and the card open on a subtitle word.
3. The 中 panel on YouTube (coverage bar and toggles).
4. The transcript with the "Learn first" tab.
5. The word list page.
