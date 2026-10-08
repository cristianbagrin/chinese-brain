# Step 0: Fork LingLook or build fresh?

Assessed: `ph0ngp/linglook` v1.2.4 (last commit 2026-09-14), GPL-3.0-only.

## What LingLook is
- A fork of 10ten Japanese Reader (formerly Rikaichamp), repurposed for Chinese.
  The README says the codebase "still contains unused code from the original
  project … making it much more complex than necessary". notes.md lists renamed
  but not cleaned-up concepts (wanikani→hsk, bunpro→tocfl, romaji→pinyin,
  kanji tab→stroke order, shogi/currency/era metadata disabled but present).
- About 35k lines of TypeScript across 223 source files. Preact, rspack,
  Tailwind, webextension-polyfill, Bugsnag, Playwright, an Xcode/Safari project.
- Manifest generated from a template: MV3 for Chrome/Safari, MV2 for Firefox.
- Repo is 172 MB; `data/` is 92 MB (CEDICT en/vi/fr, Dong Chinese char data,
  Hanzi Writer stroke data).

## How the engine works
- Dictionary: CC-CEDICT stored as a flat `.u8` file plus a sorted `.idx` file
  (headword → byte offsets), binary-searched in the background script. No
  IndexedDB. Simple and fast; the idea is worth reusing.
- Lookup: 10ten's hover scanner. It reads text from the caret position and runs
  longest-prefix matching against the index. No segmenter (no `Intl.Segmenter`).
- Popup: hand-built DOM through a small `html()` builder in a shadow root, with
  Preact for the character tab.
- HSK and TOCFL: large inline TS maps (`hsk.ts`, `tocfl.ts`). Worth reusing.
- Taiwan readings: only what CEDICT itself annotates ("Taiwan pr." appears in
  about 480 entries). Not enough for consistent Taiwan pinyin.

## What it lacks for our brief
No YouTube or subtitle layer, no saved-word store, no word status
(Fresh/Difficult/Known), no page-wide status colouring, no export, no
known-word coverage. That is most of what we need.

## Build check
`pnpm install` failed in this sandbox because one dependency is fetched from a
GitHub tarball (`quizlet/pinyin-converter`) that the network proxy blocks. It
would probably build on a normal machine, but it is one more fragile part.

## Recommendation: build fresh and borrow
A fork means learning and pruning a large Japanese-shaped codebase, then
writing most of our features anyway, on top of 10ten's dense content script
(about 3,000 lines in `content.ts` alone). A fresh build in plain TypeScript
with a small bundler should come to about 4–6k lines that we fully own.

We still borrow from LingLook:
- the flat-file + sorted-index dictionary format and the `generate_idx.py` idea,
- the TOCFL/HSK word-level maps,
- the longest-match-from-caret approach for hover lookup,
- optionally Hanzi Writer stroke data (MIT) if stroke order gets a KEEP.

We license the project GPL-3.0 so we can copy individual LingLook files
verbatim where useful. Data keeps its own licences (CC-CEDICT CC BY-SA 4.0).

Effort, in my estimate: fork ≈ 6/10 (mostly untangling plus new features);
fresh ≈ 5.5/10.
