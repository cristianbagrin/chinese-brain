# Explore verdicts

Each idea from the brief got a short, time-boxed spike: a quick prototype or a
feasibility check. **KEEP** = built. **LATER** = feasible, not built yet.
**DROP** = not worth building. Updated after round 2 of feedback.

| # | Idea | Verdict | Notes |
|---|------|---------|-------|
| 1 | Image search | **KEEP** (link) / DROP (inline thumbnails) | `I` opens DuckDuckGo image search, Taiwan region. Inline thumbnails would mean scraping DuckDuckGo or Brave, which answer with captchas and rate limits. |
| 2 | Status colors + coverage | **KEEP** | 新 red / 學 yellow / 熟 green in the card, subtitles, transcript, word list, and optionally on any page. Coverage % is in the player panel, the learn-first list and the toolbar menu. |
| 3 | Export only what's new | **KEEP** | One weekly TSV (or clipboard copy) with K/L/F codes like `known-words.txt`: your own status changes only (lookups are not counted). The always-on live feed was removed at your request. |
| 4 | Click-to-seek, loop line | **KEEP** | `A` `S` `D`, `R` loop, and a transcript panel where clicking a line seeks to it. |
| 5 | Shadowing | **KEEP** | `Q`: pauses after each line for 1.5× its length, then resumes. |
| 6 | Pinyin toggles | **KEEP** | `P` toggles subtitle pinyin only. The card and hints always show pinyin. |
| 7 | Learn-first list | **KEEP** | A tab in the transcript panel. It ranks this video's unknown words by how often they occur and how common they are, and shows the coverage gain. |
| 8 | Example sentences | **KEEP** | About 16,000 Taiwan-natural sentences for the ~8,500 most common words plus your known-words list, written to a Taiwan-usage brief and machine-checked. The card also shows up to 3 sentences you met the word in. Tatoeba was dropped: half of it is Simplified, and it has almost no Taiwan words. |
| 9 | Caption fallback | Gemini **KEEP**, Whisper **DROP** | Gemini is opt-in per video, uses your key and caches the result. In-browser Whisper: 77–250 MB models, 43–53% character error on Chinese, and it would need the audio stream. |
| 10 | Second-line translation | YouTube `tlang` + Google fallback **KEEP**, Bergamot **LATER** | YouTube sometimes answers `tlang` with 429, so the Google web endpoint fills in. Bergamot zh→en is about 57 MB, and Firefox exposes no translation API to extensions. |
| 11 | Other sources | Netflix **LATER**, PDFs **DROP**, Bilibili **DROP** | The card, segmenter and overlay don't depend on the site; Netflix would need its own subtitle capture. Firefox's PDF viewer doesn't run content scripts. Bilibili is Mainland content. |
| 12 | Sync | Backup file **KEEP**, Gist **LATER** | `storage.sync` caps at 100 KB. A backup JSON moves everything between browsers and computers. |

## Other ideas

| Idea | Verdict | Why |
|------|---------|-----|
| Import `known-words.txt` with K/L and dates | **KEEP** | Makes coverage accurate from day one. |
| Color words on any page | **KEEP** | Toolbar toggle. Uses the CSS Highlight API, so pages are never rewritten. Shows page coverage in the toolbar menu. |
| Stamp sounds | **KEEP** | Short synthesized cues, a different one per status. Can be turned off. |
| Voices | **KEEP** | Google's online Taiwan voice by default (played through Web Audio with a fade, so no click at the end), the system voice offline, or an Azure neural voice with your own key. |
| On-screen caption mirroring | **KEEP** | Fallback if caption capture ever breaks. |
| Monolingual MOE definitions in the card | **LATER** | Good for intermediate learners. Adds about 25 MB. |
| Taiwan words missing from CC-CEDICT (滷肉飯 …) | **LATER** | A small supplement list. Neither CC-CEDICT nor MOE has every everyday Taiwan food or slang compound. |
| Stroke order, streaks, badges | **DROP** | Outside how you study, or duplicates your learning system. |
