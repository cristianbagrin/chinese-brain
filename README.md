# Chinese Brain 中文腦

A browser extension for learning **Taiwan Mandarin** while you read and watch.
[Website](https://chinese.cristianbagrin.com) ·
[Firefox](https://addons.mozilla.org/firefox/addon/chinesebrain/) · Chrome (in review) ·
[Privacy](https://chinese.cristianbagrin.com/privacy) ·
Questions and bugs: [chris@cristianbagrin.com](mailto:chris@cristianbagrin.com)

- **Hover any Chinese word** on any page: Traditional characters, Taiwan standard pinyin, how
  common it is, its meaning, a breakdown into parts (臺北市 → 臺北 → 臺, 北; then 市) and two
  natural example sentences. Play, copy, edit and save sentences.
- **Select anything** (a name, a phrase, a sentence) and tap `Alt` (`⌥ Option`), or
  right-click → **Look up**: pinyin, a translation and the words inside it. Taiwan places and
  dishes (野柳, 滷肉飯…) are in the dictionary.
- **Three stamps everywhere:** 新 Fresh, 學 Learning, 熟 Known (`1` `2` `3`). The same colors
  in the card, the subtitles, your word list and, if you like, on every page.
- **YouTube dual subtitles:** Chinese + English over the video, every word hoverable, the
  video pausing while you read; a transcript with a learn-first list. Videos without Chinese
  captions can get them from Gemini (your own key).
- **One word list**, with import, export and backup.
- **Optional account:** everything works without one; a free account keeps your words,
  saved sentences and settings in sync across browsers.

## Install

**Firefox** (140+) and Zen: [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/chinesebrain/).
**Chrome** (128+): the Chrome Web Store listing is in review.

From this repository: Firefox → `about:debugging#/runtime/this-firefox` → **Load Temporary
Add-on…** → `dist/manifest.json`. Chrome → `chrome://extensions` → **Developer mode** →
**Load unpacked** → the `dist-chrome` folder.

## Keys

Every key below can be changed in **Settings → Shortcuts**.

| Where | Keys |
| --- | --- |
| Card open | `1` 新 · `2` 學 · `3` 熟 (again = clear) · `0` remove · `V` say it · `I` images · `←` `→` back / forward · `Esc` close |
| Pointing at a word inside the card | the same keys act on that word |
| Text selected | tap `Alt` (`⌥ Option`) |
| Any website | `Alt`+`Shift`+`C`: word colors on / off for this site |
| YouTube | `A` previous line · `S` replay · `D` next · `R` loop · `Q` shadowing · `P` pinyin · `X` English line · `E` transcript |

## Your word list

Toolbar button → **Word list**. Filter by stamp, search, sort, restamp, remove (with Undo).
**Import** a `word⇥K|L⇥date` list; **Download new** exports what changed since the last
export as a small TSV; **Backup / restore** saves everything as JSON.

## Account and sync

Settings → **Account**. Create an account with an email and a password; sign in on your
other browsers and the lists merge (for a word changed in two places, the later stamp wins
and both keep every sentence). API keys never leave the browser. Forgot the password:
**Forgot password?** emails a link. Change the password, download your data or delete the
account at [chinese.cristianbagrin.com/account](https://chinese.cristianbagrin.com/account).

## Development

```bash
npm install
npm run build        # bundles src/ + static/ into dist/ (Firefox) and dist-chrome/ (Chrome)
npm run watch        # rebuild on change
npm test             # dictionary, segmenter, captions, export, shortcut tests
npm run typecheck
npm run lint:ext     # web-ext lint on dist/
npm run zip          # release/chinese_brain-<version>.zip for Firefox
npm run zip:chrome   # release/chinese_brain-<version>-chrome.zip for the Chrome Web Store
node scripts/chrome-smoke.mjs   # loads dist-chrome in headless Chromium (Playwright) and checks it
node scripts/sync-check.mjs     # accounts and sync between two browsers, against a local site (see the file)
```

The Chrome build is the same source with `__CHROME__` set at build time: a Manifest V3
service worker instead of the background page, Mozilla's `webextension-polyfill` for the
`browser.*` API, `contextMenus` and `scripting` in place of `menus` and
`tabs.executeScript`/`insertCSS`, and PNG icons from `static-chrome/`
(`node scripts/chrome-icons.mjs` renders them from `static/icons/icon.svg`). Chrome has
no `webRequest.filterResponseData`, so on YouTube a page script (`src/platform/yt-hook.ts`,
run in the page's own world) copies the caption tracks the player downloads and makes
the player calls the subtitles need. Chrome-only code lives in `src/platform/`.

Data (only needed to refresh it):

```bash
pip install wordfreq
npm run data                      # CC-CEDICT + MOE readings + frequencies -> static/data/dict.tsv.gz
python3 scripts/build_examples.py # data-src/examples/ -> static/data/examples.tsv.gz
python3 scripts/build_names.py    # Wikidata names + foods -> static/data/names.tsv.gz (slow when Wikidata rate-limits)
pip install fonttools brotli
python3 scripts/build_fonts.py    # LXGW WenKai TC, 7,000 most common characters -> static/fonts/zh.woff2
```

`tests/youtube-mock/` is a small stand-in for the YouTube player, used to test
the subtitle overlay without YouTube (`python3 tests/youtube-mock/server.py`).

### Layout

```
src/background/   dictionary service, word store, account sync, caption capture, translate + Gemini
src/content/      lookup card, hover lookup, page coloring, sounds and speech
src/youtube/      caption parsing, subtitle overlay, player switch + panel, transcript
src/pages/        word list, settings, toolbar menu
src/shared/       types, dictionary + segmenter, pinyin, shortcuts, export/import formats
src/platform/     what differs on Chrome: polyfill shim, background wrappers, YouTube page hook
static/           HTML/CSS, icon, data/
static-chrome/    PNG icons for the Chrome manifest
scripts/          build.mjs (esbuild), build_data.py, build_names.py, build_examples.py
site/             the website (public/) and the account service (worker.js), one Cloudflare Worker
store/            store listings, release notes, screenshots (PUBLISHING.md)
tests/            unit tests, fixtures, a YouTube player stand-in
```

### How accounts work

`site/worker.js` runs on Cloudflare's free plan. Each account is a Durable Object with its
own SQLite database: a salted PBKDF2 password hash, hashed session and reset tokens, and the
synced items. The extension (`src/background/sync.ts`) notes every change to a synced
storage key and sends it with its time; the same request brings back what changed elsewhere.
Password-reset emails go through Resend. Setup is in `store/PUBLISHING.md`.

### How the YouTube part works

The YouTube player downloads caption tracks itself. The extension watches
those `timedtext` responses with Firefox's `webRequest.filterResponseData` and
keeps a copy without changing them (on Chrome, which lacks that API, a small
script in the page copies them from the player's own requests). It asks the player (through its own API) to
load the best Chinese track, and then YouTube's English auto-translation of it.
If YouTube refuses the translation, the lines go to Google's free web
translator instead. If no track is captured, the extension reads YouTube's
on-screen captions. Videos with no Chinese captions can be transcribed with
Gemini, on request.

## Data and licenses

- Code: copyright © Cristian Bagrin, all rights reserved (see `LICENSE`).
  TOCFL levels come from [LingLook](https://github.com/ph0ngp/linglook)
  (GPL-3.0); they are kept in the data but not shown.
- [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict): CC BY-SA 4.0.
- Taiwan readings: 教育部《重編國語辭典修訂本》 via
  [g0v/moedict-data](https://github.com/g0v/moedict-data), CC BY-ND 3.0 TW.
  Only the pinyin field is used, unchanged.
- Names and foods: [Wikidata](https://www.wikidata.org/), CC0.
- Word frequencies: [wordfreq](https://github.com/rspeer/wordfreq), CC BY-SA 4.0.
- Font on the extension's pages: [LXGW WenKai TC](https://github.com/lxgw/LxgwWenkaiTC)
  (霞鶩文楷), SIL Open Font License 1.1 (`static/fonts/OFL.txt`), cut down to
  the 7,000 most common characters.
- Example sentences: written for this project by language models from a
  Taiwan-usage brief (`data-src/examples/PROMPT.md`), then machine-checked
  (Traditional only, no 兒化, the word present) and spot-checked.
