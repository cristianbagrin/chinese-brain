# Chinese Brain 中文腦

A Firefox (and Zen) extension for learning **Taiwan Mandarin**. It does two
things and shares one brain between them:

- **Hover lookup on any page.** Point at Chinese text and a card shows the
  word with its **Taiwan standard pinyin**, meanings, measure words, TOCFL
  level and how common it is. Press a key to stamp it 新 Fresh, 難 Difficult
  or 熟 Known.
- **YouTube dual subtitles.** The extension draws its own two-line subtitles
  (Chinese + English) over the video. Every word is hoverable and clickable,
  coloured by its status, and the video pauses while you read.

Everything you stamp goes into **one word list**, so a word you met on a news
site already shows as Known in a video. The list exports to Anki and Claude.
A live feed can also keep a copy in a Downloads folder, so Claude can read it
without you exporting anything.

Free and local. No accounts, no servers, no paid APIs.

## Install (no build needed)

1. Download this repository (green **Code** button → *Download ZIP*, then
   unzip), or `git clone` it.
2. In Firefox or Zen, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick `dist/manifest.json`.

A temporary add-on stays until the browser restarts. For a permanent install,
sign it as an unlisted add-on on [AMO](https://addons.mozilla.org/developers/)
(free): run `npm run zip` and upload `release/*.zip` as "On your own".

## Using it

| Where | Keys |
| --- | --- |
| Lookup card open | `1` 新 fresh · `2` 難 difficult · `3` 熟 known · `0` clear · `v` say it · `i` images · `n` next match · `Esc` close |
| YouTube | `A` previous line · `S` replay line · `D` next line · `R` loop line · `Q` shadowing · `P` pinyin · `X` English line (show / blur / hide) |
| Anywhere | `Alt+Shift+C` turns hover lookup on or off |

On YouTube, hover a word for the card. Click it to pin the card, which also
stamps a new word Fresh (this can be turned off). The small bar above the
subtitles shows the track, `熟 %` (the share of this video's words you know)
and the key hints.

The toolbar button shows your counts and turns lookup off for a site. The
**word list** page (toolbar → word list) has search, filters and status
editing, plus export and import:

- **Export new since last time**: one Markdown file for Claude with a
  summary, then your word changes and lookups as TSV.
- **Live feed**: `~/Downloads/chinese-brain/words.tsv` and `events.tsv`,
  rewritten a few minutes after any change.
- **Anki CSV**: all words, or only the ones added since the last Anki export.
- **Backup / restore** as JSON, for moving between browsers or computers.
- **Import known words**: paste a list (for example `known-words.txt`), or
  mark whole TOCFL levels as known to start with an accurate `熟 %`.

## Development

```bash
npm install
npm run build        # bundles src/ + static/ into dist/
npm run watch        # rebuild on change
npm test             # dictionary, pinyin and segmenter tests
npm run typecheck
npm run lint:ext     # web-ext lint on dist/
npm start            # launches Firefox with the add-on (web-ext run)
```

Rebuilding the dictionary (only needed to update CC-CEDICT):

```bash
pip install wordfreq
npm run data         # downloads sources into .cache/, writes static/data/dict.tsv.gz
npm run build
```

### Layout

```
src/background/   dictionary service, word store, YouTube caption capture, Claude feed
src/content/      lookup card (popup), hover lookup, shared state
src/youtube/      caption parsing and the subtitle overlay
src/pages/        word list, settings, toolbar popup
src/shared/       types, dictionary + segmenter, pinyin, export formats
static/           HTML/CSS, icons, data/dict.tsv.gz
scripts/          build.mjs (esbuild), build_data.py (dictionary)
docs/             design notes and Explore verdicts
```

### How the YouTube part works

The YouTube player downloads caption tracks itself. The extension watches
those `timedtext` responses with Firefox's `webRequest.filterResponseData`
and keeps a copy without changing them. It asks the player (through its own
API) to load the best Chinese track, and then YouTube's auto-translation of
that track into English. YouTube's own caption box is hidden and ours is drawn
inside the player, so it also works in theater and fullscreen. Words are split
with a frequency-weighted dictionary segmenter, so each word you click is a
real dictionary entry.

## Data and licences

- Code: GPL-3.0 (see `LICENSE`). The TOCFL word levels come from
  [LingLook](https://github.com/ph0ngp/linglook) (GPL-3.0).
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict): CC BY-SA 4.0.
- Taiwan readings: 教育部《重編國語辭典修訂本》 via
  [g0v/moedict-data](https://github.com/g0v/moedict-data), CC BY-ND 3.0 TW.
  Only the pinyin field is used, unchanged. The Ministry states that format
  conversion and reuse are allowed.
- Word frequencies: [wordfreq](https://github.com/rspeer/wordfreq), CC BY-SA 4.0.
