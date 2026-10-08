# Chinese Brain 中文腦

A Firefox (and Zen) extension for learning **Taiwan Mandarin**, with one brain
shared by everything:

- **Hover lookup on any page.** Point at Chinese text and a card opens just
  under the pointer. It shows Traditional characters, **Taiwan standard
  pinyin**, how common the word is, the meanings on one line, a breakdown of
  each character, and two natural Taiwan-Mandarin example sentences. It also
  shows the sentences you met the word in before.
- **Three statuses everywhere:** 新 Fresh (red), 學 Learning (yellow),
  熟 Known (green). Press `1` `2` `3` in the card. The same colours appear in
  the card, the YouTube subtitles, the transcript, the word list, and
  optionally on every page you read.
- **YouTube dual subtitles.** Our own Chinese + English lines over the video.
  Every word is hoverable and clickable, and the video pauses while you read.
  A 中 switch in the player turns them on or off. Hover the switch to see how
  much of the video you know, toggles, keys, and the **transcript** with a
  **learn-first list**.
- **Weekly export for Claude** in the same K / L format as `known-words.txt`,
  with only what changed since the last export.

Free and local. No accounts, no servers. Gemini and Azure are optional, and
only used with your own keys.

## Install (no build needed)

1. Download this repository (green **Code** button → *Download ZIP*, then
   unzip), or `git clone` it.
2. In Firefox or Zen, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `dist/manifest.json`.

A temporary add-on stays until the browser restarts. For a permanent install,
sign it as an unlisted add-on on [AMO](https://addons.mozilla.org/developers/)
(free): run `npm run zip` and upload `release/*.zip` as "On your own".

## Keys

| Where | Keys |
| --- | --- |
| Card open | `1` 新 Fresh · `2` 學 Learning · `3` 熟 Known (again = clear) · `0` remove · `V` say it · `I` images · `P` show hidden pinyin · `Esc` close |
| YouTube | `A` previous line · `S` replay line · `D` next line · `R` loop line · `Q` shadowing · `P` pinyin · `X` English line (show / blur / hide) · `E` transcript |

On YouTube, click a new word to stamp it Fresh. Click it again to undo.

## Your word list

Toolbar button → **Word list & export**.

- **Import** your `known-words.txt` (`word⇥K|L⇥date`). K → Known, L → Learning,
  and the dates are kept.
- **Export what's new** (or **Copy what's new**) gives one small TSV: words
  whose status changed since the last export, plus the words you looked up.
  A Known word that you looked up again is marked, since it means you forgot it.
- **Backup / restore** saves everything as JSON, for moving to another
  browser or computer.

## Development

```bash
npm install
npm run build        # bundles src/ + static/ into dist/
npm run watch        # rebuild on change
npm test             # dictionary, segmenter, captions, export tests
npm run typecheck
npm run lint:ext     # web-ext lint on dist/
```

Data (only needed to refresh it):

```bash
pip install wordfreq
npm run data                      # CC-CEDICT + MOE readings + frequencies -> static/data/dict.tsv.gz
python3 scripts/build_examples.py # data-src/examples/out-*.tsv -> static/data/examples.tsv.gz
```

`tests/youtube-mock/` is a small stand-in for the YouTube player, used to test
the subtitle overlay without YouTube (`python3 tests/youtube-mock/server.py`).

### Layout

```
src/background/   dictionary service, word store, caption capture, translate + Gemini fallbacks
src/content/      lookup card, hover lookup, page colouring, sounds and speech
src/youtube/      caption parsing, subtitle overlay, player switch + panel, transcript
src/pages/        word list, settings, toolbar menu
src/shared/       types, dictionary + segmenter, pinyin, export/import formats
static/           HTML/CSS, icon, data/
scripts/          build.mjs (esbuild), build_data.py, build_examples.py
docs/             Step 0 assessment, Explore verdicts
```

### How the YouTube part works

The YouTube player downloads caption tracks itself. The extension watches
those `timedtext` responses with Firefox's `webRequest.filterResponseData` and
keeps a copy without changing them. It asks the player (through its own API) to
load the best Chinese track, and then YouTube's English auto-translation of it.
If YouTube refuses the translation, the lines go to Google's free web
translator instead. If no track is captured, the extension reads YouTube's
on-screen captions. Videos with no Chinese captions can be transcribed with
Gemini, on request.

## Data and licences

- Code: GPL-3.0 (see `LICENSE`). TOCFL levels come from
  [LingLook](https://github.com/ph0ngp/linglook) (GPL-3.0); they are kept in
  the data but not shown.
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict): CC BY-SA 4.0.
- Taiwan readings: 教育部《重編國語辭典修訂本》 via
  [g0v/moedict-data](https://github.com/g0v/moedict-data), CC BY-ND 3.0 TW.
  Only the pinyin field is used, unchanged.
- Word frequencies: [wordfreq](https://github.com/rspeer/wordfreq), CC BY-SA 4.0.
- Example sentences: written for this project by language models from a
  Taiwan-usage brief (`data-src/examples/PROMPT.md`), then machine-checked
  (Traditional only, no 兒化, the word present) and spot-checked.
