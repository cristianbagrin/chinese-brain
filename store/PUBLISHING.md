# Publishing Chinese Brain on addons.mozilla.org

Copy each block into the matching field of the AMO Developer Hub.

## 1. Build the two files to upload

```bash
git pull
npm ci
npm run zip      # -> release/chinese_brain-1.0.0.zip      (the add-on)
npm run source   # -> release/chinese-brain-source.zip     (source code for the reviewers)
```

Upload `chinese_brain-1.0.0.zip` under **Submit a New Add-on → On this site**.
When asked "Do you need to submit source code?", answer **Yes** and upload
`chinese-brain-source.zip` (the add-on is bundled with esbuild).

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
• The last sentences you met the word in
• Click any word inside the card to look it up; ← → to go back and forth

ONE WORD LIST, THREE STATUSES
• 新 Fresh · 學 Learning · 熟 Known: press 1, 2 or 3
• The same colors in the card, the subtitles, the transcript, your word list, and (optional) on every page
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

Free and open source (GPL-3.0). No account and no server of ours; your word list stays in your browser.

Data: CC-CEDICT (CC BY-SA 4.0); Taiwan readings from the MOE Revised Mandarin Dictionary via g0v/moedict-data (CC BY-ND 3.0 TW, pinyin only); word frequencies from wordfreq (CC BY-SA 4.0).
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

**License**: GNU General Public License v3.0

**Icon**: `store/icon-128.png`

## 3. Privacy policy

Tick "This add-on has a privacy policy" and paste:

```
Chinese Brain keeps your data in your browser. It has no account, no analytics, and no server of its own. Your word list, settings and API keys are stored locally (browser storage) and are never sent to the developer.

Some features send data to third-party services, only to perform the feature:

• Reading words and sentences aloud (default voice): the text is sent to Google's text-to-speech service (translate.google.com) when you press V or a play button.
• English subtitle line on YouTube: when YouTube does not provide an English translation, the video's Chinese caption lines are sent to Google Translate (translate.googleapis.com).
• Azure voice (optional, your own key): the text you play is sent to Microsoft Azure Speech in the region you choose.
• Gemini (optional, your own key): when you press "Subtitles with Gemini", the YouTube video's link is sent to the Google Gemini API; when you press "Write example sentences", the word and its short meaning are sent. On Google's free tier, Google may use these requests to improve its models.
• Image search: pressing I opens a DuckDuckGo image search for the word in a new tab.

Nothing else leaves your browser. Uninstalling the add-on deletes its data.
```

## 4. Version notes (1.0.0)

```
First public release.
```

## 5. Notes to reviewer

```
Build (Node 22, npm 10):
  npm ci
  npm run build     # esbuild bundles src/ + static/ into dist/ (scripts/build.mjs); output is not minified
The uploaded add-on is the dist/ folder zipped by web-ext (npm run zip).

The bundled data files (static/data/dict.tsv.gz, static/data/examples.tsv.gz) are prebuilt:
  dict: python3 scripts/build_data.py (downloads CC-CEDICT and MOE readings, uses the wordfreq package)
  examples: python3 scripts/build_examples.py (from data-src/examples/)

Permissions:
  <all_urls> + content script: hover lookup works on any page the user reads.
  webRequest + webRequestBlocking: only for *://*.youtube.com/api/timedtext* (see src/background/youtube.ts).
    filterResponseData passes the caption response through unchanged and keeps a read-only copy for
    the subtitle overlay. The add-on never requests timedtext itself.
  storage + unlimitedStorage: the word list, logs and caches stay local.

Remote requests (all user-facing features, listed in the privacy policy): translate.google.com (TTS),
translate.googleapis.com (caption translation fallback), *.tts.speech.microsoft.com (optional, user key),
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
