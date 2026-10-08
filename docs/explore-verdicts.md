# Explore verdicts

Each idea from the brief got a short, time-boxed spike: a quick prototype or a
feasibility check. **KEEP** = build it (or keep what is built). **MAYBE
LATER** = feasible, but not worth it yet. **DROP** = not worth building.
Items already built are marked *(built)*.

What was verified in a real Firefox 157: hover lookup, the card and status keys, and the live feed (including through a symlinked folder). On real YouTube, the player's caption download (`lang=zh-Hant`, `fmt=json3`) was captured by `filterResponseData`. The overlay was tested end to end against a local stand-in for the YouTube player (`tests/youtube-mock/`), because YouTube shows a captcha to the test machine's datacentre IP. They are small, and easy to remove
if you disagree.

| # | Idea | Verdict | Why, in one line |
|---|------|---------|------------------|
| 1 | Image search for a word | **KEEP** (link) / DROP (inline thumbnails) | `i` opens DuckDuckGo image search, Taiwan region. Fetching thumbnails into the card means scraping DuckDuckGo or Brave, which return captchas and rate limits. |
| 2 | Status colours + "you know X% of this video" | **KEEP** *(built)* | Words are coloured by status in subtitles, the card and the word list. Untracked words get a dotted underline. `熟 %` shows in the bar above the subtitles. |
| 3 | Export only what's new / no export at all | **KEEP** *(built)* | "Export new since last time" uses a watermark. The live feed in `~/Downloads/chinese-brain/` is rewritten after changes, so Claude can read it directly (see below). |
| 4 | Click-to-seek + loop line | **KEEP** | Built: `A` / `S` / `D` previous / replay / next line, `R` loop line. Proposed next: a transcript panel where clicking a line seeks to it. |
| 5 | Shadowing mode | **KEEP** *(built)* | `Q` pauses after each line for 1.5× the line's length, then resumes. The factor is in Settings. |
| 6 | Pinyin toggle | **KEEP** | `P` toggles pinyin over subtitles *(built)*. Proposed: an option to hide pinyin in the card until you hover it, for self-testing. |
| 7 | "Learn this first" list per video | **KEEP** | The data is already there (segmented video, TOCFL levels, your statuses). Rank unknown words by TOCFL level, then by how often they occur in the video. |
| 8 | Example sentences | **MAYBE LATER** (Tatoeba) / **KEEP** (your own sentences) | Tatoeba is general and half Simplified, with almost no Taiwan words (颱風 5 sentences, 捷運 1, 機車 0). Showing the sentences you already met a word in is free and more relevant. |
| 9 | Caption fallback: Gemini vs Whisper | Gemini **MAYBE LATER**, Whisper **DROP** | Whisper in the browser: 77–250 MB models, 43–53% character error on Chinese, and it needs the audio track (fragile, against YouTube's terms). Gemini: user key, opt-in per video, but the YouTube-URL path is in preview. |
| 10 | Second line: YouTube `tlang` vs Google endpoint vs Bergamot | **YouTube `tlang`** default, Google endpoint as automatic fallback *(built)*, Bergamot **MAYBE LATER** | `tlang` comes with the captured track. In testing, YouTube sometimes answered it with HTTP 429, so after 6 s without an English line the extension batches the lines to Google's free endpoint, and failure just leaves the line empty. Bergamot zh→en is about 57 MB, and Firefox exposes no translation API to extensions. |
| 11 | Other sources (Netflix, PDFs, …) | Netflix **MAYBE LATER**, PDFs **DROP**, Bilibili **DROP** | Overlay, card and segmenter are site-independent. Each site needs a capture adapter. Netflix has Taiwan dramas and uses the same interception idea. Firefox's PDF viewer doesn't run content scripts. Bilibili is Mainland content. |
| 12 | Cross-device sync | **KEEP** backup file *(built)*, Gist **MAYBE LATER** | `storage.sync` caps at 100 KB. The live feed also writes `backup.json`, so if that folder is in iCloud you always have an off-machine backup to restore from. |
| 13 | Other ideas | see below | |

## 3 · How Claude can read your data with no export

Extensions can only write files inside the Downloads folder. The extension
keeps three files up to date in `~/Downloads/chinese-brain/`:

- `words.tsv`: one row per word: status, Taiwan pinyin, gloss, status history, last sentence and link.
- `events.tsv`: append-only log of lookups, status changes and videos watched (minutes and `熟 %`).
- `backup.json`: everything, for restoring.
- `README.md`: the format, so any Claude session understands the files cold.

To land them straight in your Claude folder, run this once on the Mac:

```bash
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/Claude/life/chinese/chinese-brain ~/Downloads/chinese-brain
```

(Create the target folder first, or point the link wherever your Chinese files
live.) I tested that Firefox writes through a symlinked folder and overwrites
in place without creating `words(1).tsv`. Your Chinese skills can then read
`life/chinese/chinese-brain/words.tsv` directly, remember the newest
timestamp they processed, and read only later rows next time. No export
button needed. The monthly review's "merge Lexirise CSVs" step can point at
this file instead.

## 13 · Other ideas

| Idea | Verdict | Why |
|------|---------|-----|
| Import `known-words.txt` | **KEEP** *(built)* | Word list → Import. Makes `熟 %` accurate from day one. |
| Mark TOCFL levels as known | **KEEP** *(built)* | A quick start for words you obviously know. Only touches untracked words. |
| On-screen caption mirroring when no track is captured | **KEEP** *(built)* | A fallback that reads YouTube's own caption text, so lookup still works if capture breaks. |
| Colour words by status on any web page (LingQ-style) | **MAYBE LATER** | Valuable for reading news, but it rewrites the page's text. Better as a per-page key than always on. |
| Monolingual MOE (教育部) definitions in the card | **MAYBE LATER** | Good for intermediate learners. Adds about 25 MB and needs a tab in the card. |
| Taiwan words missing from CC-CEDICT (滷肉飯 etc.) | **MAYBE LATER** | A small hand-made supplement list. CC-CEDICT and MOE both lack some everyday Taiwan food and slang compounds. |
| Stroke order animation | **DROP** | Not part of how you study (reading/listening). It is also most of LingLook's 40 MB. |
| Streaks, badges, daily goals | **DROP** | Your learning system already tracks progress. Duplicating it adds noise. |
| Hard-subbed videos (subtitles burned into the picture) | **MAYBE LATER** | Common on Taiwanese channels. The realistic fix is the Gemini fallback (#9), not on-device OCR. |
