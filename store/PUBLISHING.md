# Publishing Chinese Brain

Firefox Add-ons (AMO) and the Chrome Web Store. Copy each block into the matching field.

## Automatic releases (Firefox and Chrome)

Once the secrets below are in place, you never upload by hand again. When a new version
lands on `main` (`package.json` changed), the **Release** workflow (`.github/workflows/release.yml`) builds and checks it,
uploads it to Firefox Add-ons with its version notes (section 4) and notes to reviewer
(section 5), uploads and publishes it on the Chrome Web Store, and tags it `v<version>`.
A version is released once; a run for a version that already has a tag does nothing. You can
also start it by hand: GitHub → Actions → Release → Run workflow.

Every version needs its notes in section 4 (`1.4.0:` and a fenced block), or the run stops.
Don't also upload the same version by hand: the store refuses a version it already has.
Chrome refuses an upload while an earlier version is still in review; the run carries on, and
once the review is done you send it with Run workflow → store: **chrome**.

Each store is skipped until its secrets exist (GitHub → the repository → Settings →
Secrets and variables → Actions → New repository secret):

**Firefox** (free):

1. Open [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/)
   → **Generate new credentials**.
2. Save the *JWT issuer* as `AMO_JWT_ISSUER` and the *JWT secret* as `AMO_JWT_SECRET`.

**Chrome** (one-time $5 developer fee). A Google Cloud *service account* signs in for the
release, so there is no consent screen to fill in or publish, and nothing expires:

1. Publish the first version by hand (section "Chrome Web Store" below); the API can only
   update an item that exists. Save its item ID (the 32 letters in its dashboard URL) as
   `CWS_EXTENSION_ID`, and your publisher ID (Developer Dashboard → Account) as
   `CWS_PUBLISHER_ID`.
2. In any Google Cloud project you already have, turn on the
   [Chrome Web Store API](https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com).
3. [Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → **Create
   service account** → any name (e.g. `chrome-release`) → **Done** (no roles needed). Copy its
   email.
4. Open it → **Keys** → **Add key** → **Create new key** → JSON. Save the whole file's text as
   `CWS_SERVICE_ACCOUNT`, then delete the downloaded file.
5. Chrome Web Store Developer Dashboard → **Account** → service accounts → add that email
   (one per publisher).

`scripts/cws-publish.mjs` does the upload and publish (API v2). The older route (an OAuth client
plus `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`) still works if those secrets
are set and `CWS_SERVICE_ACCOUNT` isn't.

Mozilla and Google still review each version (minutes to a few days); users get it after
that, on their own.

## Updating the published add-on by hand (new version)

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
chinesebrain
```

**Summary** (250 characters max)

```
Learn Taiwanese Chinese while you read and watch. Hover any Chinese word for zhuyin or Taiwan pinyin, meanings and natural example sentences; get dual Chinese + English subtitles on YouTube; keep one word list with Fresh, Learning and Known.
```

**Description**

```
Chinese Brain turns everything you read and watch into Taiwanese Chinese practice.

HOVER ANY CHINESE WORD
• Traditional characters with Taiwan's standard readings (教育部), in zhuyin over each character or in pinyin
• How common the word is, in plain words: essential, very common, common, less common, rare
• The meaning, and a top-down breakdown: 臺北市 → 臺北 → 臺 · 北, then 市
• Two natural Taiwanese Chinese example sentences, picked so the other words are ones you know. Play them aloud, save the ones you want to learn, delete the ones you don't
• The sentence you're reading and the last ones you met the word in: save them for your export, trimmed if you like
• Click any word inside the card to look it up; ← → to go back and forth
• Copy any example sentence with one click

SELECT ANYTHING
• Select Chinese text anywhere (pages, search boxes, Google Translate's box) and tap Option (Alt), or right-click → Look up
• Words get their card; names, phrases and whole sentences get pinyin, a translation and the words inside them
• Taiwan place names, sights and dishes (野柳, 清境, 滷肉飯, 薑母鴨…) are in the dictionary

ONE WORD LIST, THREE STATUSES
• 新 Fresh · 學 Learning · 熟 Known: press 1, 2 or 3
• The same colors in the card, the subtitles, the transcript, your Dashboard, and (optional) on every page; Option+Shift+C (Alt+Shift+C) turns them on or off for one website
• Import any word list (a ready AI prompt converts an Anki export, a spreadsheet or a photo); export what changed each week as a small TSV

YOUTUBE DUAL SUBTITLES
• Chinese + English lines over the video; every word is hoverable and clickable
• The video pauses while you read
• Keys: A / D previous and next line, S replay, R loop, Q shadowing, P pronunciation, X English line, E transcript
• Transcript with a "learn first" list: the words that unlock the most of this video
• How much of the video you already know, as a percentage

OPTIONAL, WITH YOUR OWN KEYS
• Gemini: subtitles for videos without Chinese captions (Mandarin is transcribed; other languages are translated into Taiwanese Chinese), and new example sentences
• Azure: a Taiwan neural voice

SYNC (OPTIONAL)
• Works without an account: your words stay in your browser
• A free account keeps your words in sync across your browsers; reset your password or delete the account any time

MAKE IT YOURS
• Change any shortcut in Settings

Questions or bugs: chris@cristianbagrin.com

Copyright © Cristian Bagrin. All rights reserved.

Data: CC-CEDICT (CC BY-SA 4.0); Taiwan readings from the MOE Revised Mandarin Dictionary via g0v/moedict-data (CC BY-ND 3.0 TW, pinyin only); word frequencies from wordfreq (CC BY-SA 4.0); names and foods from Wikidata (CC0). Font: LXGW WenKai TC (SIL Open Font License 1.1).
```

**Categories**: Language Support · Photos, Music & Videos

**Tags**

```
chinese, mandarin, taiwan, traditional chinese, pinyin, dictionary, language learning, youtube, subtitles, vocabulary
```

**Homepage**

```
https://chinese.cristianbagrin.com/brain
```

**Support email**

```
chris@cristianbagrin.com
```

**License**: All Rights Reserved

**Icon**: `store/icon-128.png`

## 3. Privacy policy

The policy lives at https://chinese.cristianbagrin.com/brain/privacy (`site/public/brain/privacy.html`).
Link it on both stores. AMO also wants the text: tick "This add-on has a privacy policy" and
paste the page's text.

Since 1.5.0 (optional accounts) the stores' data questions have new answers:

- **AMO**: nothing to fill in; the manifest declares it (`data_collection_permissions`:
  required `websiteContent`, `browsingActivity`; optional `personallyIdentifyingInfo`,
  `authenticationInfo`, asked for when someone signs in).
- **Chrome** → Privacy practices → Data usage: tick **Personally identifiable information**
  (email address), **Authentication information** (password), **Website content** and
  **Web history** (the page address saved with a sentence you met a word in, synced when
  signed in). Keep the three certifications ticked (not sold, not used for unrelated
  purposes, not used for creditworthiness).

## 4. Version notes

These are the store notes: every change. The website's What's new page
(`site/public/brain/whats-new.html`) is written by hand from them: only what a reader would notice.

1.9.0 (November 19, 2026):

```
• Zhuyin sits over each character in the card, like the subtitles, easier to read at a glance.
• Import any word list: the Dashboard gives you the format and a ready prompt. Paste it into any AI with your Anki export, spreadsheet or photo of a list, then paste the answer back.
• A "?" next to settings explains them right there (Gemini, Azure voice, per-website settings, Import, sync).
• Clicking a new word in the subtitles can stamp it Fresh, Learning or Known, or nothing.
• Switching stamp sounds on plays one; changing the card size or pronunciation in Settings shows the card.
• "↓ New" in the toolbar menu asks where to save, starting in the folder you used last.
• The toolbar menu fits long website names.
• Settings: click your account to manage it; "Auto-hover on" is the new name for websites where the card opens without a key; shortcuts read down each column.
• Practice with AI is gone from the Dashboard.
```

1.8.0 (November 18, 2026):

```
• 注音 (Zhuyin): pronunciation in Taiwan's own script, now the default. In the card each character has its 注音 beside it, as Taiwan prints it; the subtitles, the transcript, word hints, the Dashboard and the website use it too. Prefer pinyin? Settings → Lookup → Pronunciation, or the toolbar menu.
• One Dashboard: the word list is the Dashboard on the website (chinese.cristianbagrin.com/brain/dashboard), and every "Word list" link now says Dashboard. It opens on your latest 30 words; Show more adds 100 at a time. Search finds 注音 too.
• The card's activation, per website: with "hover" chosen, pick websites where it waits for Option (Alt); with "hold Option" chosen, websites where hover is enough. One click from the toolbar menu (On this website: hover, Option, off).
• Settings show only what applies: the website list that fits your choice, YouTube options while the subtitles are on, the Gemini model once there's a key.
• The P key and its switch are called Pronunciation; the switch moved to YouTube in Settings.
• The website's demo card no longer reads words aloud.
```

1.7.0 (November 17, 2026):

```
• One word list, on the website: Word list opens chinese.cristianbagrin.com/brain/dashboard. With the extension it reads the list straight from your browser: no account, nothing uploaded. Signed in, it works on any device too.
• A website you switch colors on or off keeps that choice, even with Colors on every website on. Settings lists those sites; click one to forget it.
• Download new, from the toolbar menu: what you stamped since your last download, as a file for Anki or a spreadsheet.
• How it works, rebuilt: try the card, the stamps and a selection right on the page (a demo, if the extension isn't installed yet), and drive a small YouTube player with A S D R E.
• Backup and restore moved to Settings.
• Settings, redesigned: a sidebar with one section at a time, clear switches and pickers, larger text, and help on hover.
• Your account is now shared with Chris's other apps (At Peace, Money in Order, Ten Dollar Words), and you can change its email at account.cristianbagrin.com.
```

1.6.0 (November 15, 2026):

```
• Your words on the web: a dashboard at chinese.cristianbagrin.com/brain/dashboard, with your three piles, what you stamped each week, and your word list to search, restamp and tidy. Works on a phone too. Needs the free account.
• Practice with AI: Word list → Copy prompt gives a ready prompt with the words you're learning. Paste it into Claude, ChatGPT or Gemini for a story and a quiz.
• Word colors on every website, with its own shortcut (Alt+Shift+A; Option+Shift+A on a Mac).
• Settings fit on one screen: the sections sit side by side. Key names match your computer (Alt on Windows, Option on a Mac).
• Give feedback, from Settings and the toolbar menu. A guide and a What's new page on the website.
• Sync fixes: Chrome no longer sends back what it just received, and no longer asks the server every time it wakes up. A backup file no longer carries your sign-in.
• Faster start: example sentences are searched when a card needs them, not indexed every time the extension starts.
• A letter you chose as a shortcut no longer swallows the first letter you type into a page; Shift with a letter is left to the page.
```

1.5.0 (November 15, 2026):

```
• Optional free account: sign in from Settings and your word list, saved sentences and settings stay in sync across your browsers (Firefox and Chrome). Forgot your password? Reset it by email. Everything still works without an account.
• Change any shortcut: Settings → Shortcuts. Click a key, press the new one.
• A simpler panel on YouTube (hover the 中 switch): how much you know, previous / replay / next line buttons and the switches. Nothing else.
• Settings and the toolbar menu say less. New: Report a bug and Email support, straight to the developer.
• A welcome page after installing, with Chinese to try the card on.
```

1.4.0:

```
• Now also for Chrome.
• Editing a sentence in the card works inside pop-up dialogs, like YouTube Studio's video details: what you type goes into the card, not the video's description, and Esc closes only the card's editor.
• With the pointer on the card, 1 2 3 0 and Esc are the card's even right after you typed in the page.
```

1.3.3:

```
• Hover lookup, page colors and the card work inside embedded frames right away, like an artifact on Claude or an embedded document: no need to start them with the right-click Look up first.
```

1.3.2:

```
• The card's shortcuts (1 2 3 0, Esc) work right away on YouTube and in pages you're typing in, like Notion: no need to click the card first. Once you type something else, digits go back to your text.
```

1.3.1:

```
• Stamping sounds like a rubber stamp: a thud with an ink tick in each status's own pitch (新 brightest, 熟 lowest). Clearing a status sounds like the stamp lifting off; saving a sentence has its own light tick. The word list's stamps make the same sounds.
• Stamps land on the first frame, together with the sound, and spring back in a ring of ink. The card fades in from the word's side.
• Editing a sentence: the text boxes grow to fit the whole sentence.
• The word list and export show your edited version of a sentence you met, whole, instead of the long original cut short.
• The toolbar menu no longer has a pale rim around its red top.
• Reduced motion (system setting): stamps and the card change without moving.
```

1.3.0:

```
• The export saves through Firefox's save-as dialog, which opens in the folder you used last. Cancel it and nothing is marked as exported.
• The sentence column holds the one sentence the word appears in (punctuation inside 「」 or 『』 doesn't end it; trimmed to about 80 characters around it, between words), or nothing when the captured text doesn't contain the word.
• A new look: a new icon (中 made of a 口 and a pair of chopsticks) and red, ink and paper colors across the card, the word list, settings, the toolbar menu and the YouTube subtitles. Stamps look like seals.
• New word list: words written in 田字格 squares with each character's pinyin above, in 楷書; it opens on your Fresh words, with a filter bar that stays on screen. Restamping a word keeps it in place; removing one can be undone; hover a word for its card.
• Meanings in the list and export are short and whole (they used to be cut mid-word), long pinyin is spaced into its parts, and words typed in by hand get their parts' readings.
• Fixed: a word opened inside the card (from an example or the breakdown) was saved with the page's sentence, which didn't contain it. Sentences without the word, and English notes, are no longer shown or exported.
• Hover finds the whole word from any of its characters, also when a page splits the word over several elements.
• Edit any sentence in the card, example sentences included, Chinese and English (the pencil); the edited version is the one saved.
• The play, copy, edit and save buttons line up with the sentence.
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

Mozilla takes at most 3,000 characters here (`scripts/release-notes.mjs` checks).

```
Build (Node 22): npm ci && npm run build (esbuild bundles src/ + static/ into dist/, not minified). The upload is dist/ zipped by web-ext.

Prebuilt data in static/data: dict (scripts/build_data.py: CC-CEDICT, MOE readings, wordfreq), names (scripts/build_names.py: Wikidata, CC0), examples (scripts/build_examples.py). Font static/fonts/zh*.woff2: LXGW WenKai TC (SIL OFL 1.1, static/fonts/OFL.txt), cut by scripts/build_fonts.py; used only on the extension's pages.

Permissions:
- <all_urls> + content script: hover lookup on any page the user reads.
- webRequest + webRequestBlocking: only *://*.youtube.com/api/timedtext* (src/background/youtube.ts). filterResponseData passes captions through unchanged and keeps a read-only copy for the subtitle overlay.
- storage, unlimitedStorage: word list, logs, caches, all local.
- menus: "Look up" on selected text; in a frame without the content script, tabs.executeScript injects the add-on's own content.js.
- commands: Alt+Shift+C / Alt+Shift+A toggle word colors.
- alarms: syncs the word list every 20 min when signed in.
- downloads: "Download new" saves a TSV built from the local list.

The Dashboard is on the developer's site (chinese.cristianbagrin.com/brain/dashboard, site/src/dashboard.ts). On that origin only, top frame only, the content script answers a fixed list of postMessage requests (read list, set status, import, account status), checked against e.origin and e.source (src/content/bridge.ts). It marks the page with the pronunciation choice (data-cb-pron) and posts which demo step the user just did. Nothing is uploaded by this.

Remote requests (all in the privacy policy): translate.google.com (speech), translate.googleapis.com (translation), *.tts.speech.microsoft.com and generativelanguage.googleapis.com (optional, user's own key), chinese.cristianbagrin.com/api (optional account, src/background/sync.ts; server: site/worker.js). No remote code, no eval, no innerHTML.

Data collection: websiteContent (words and captions sent for speech and translation), browsingActivity (YouTube link sent to Gemini on request); optional at sign-in: personallyIdentifyingInfo (email), authenticationInfo (password). Test account: create one in Settings → Account.
```

## 6. Screenshots (1280 × 800)

Take these in Firefox at 1280 × 800 (Responsive Design Mode helps):

1. The card over a Chinese web page (a word with examples and the breakdown).
2. The card with "This sentence" and "You met it in" (colors show your level).
3. YouTube with the dual subtitles, the card and the clickable transcript.
4. The transcript's "Learn first" tab.
5. The 中 panel on YouTube (coverage bar and toggles).

The files in `store/screenshots/` are these shots in the red-and-paper frame (1280 × 800).

## Chrome Web Store (first upload)

1. Get the file to upload: GitHub → the repository → **Releases** → the newest version →
   download `chinese_brain-<version>-chrome.zip` (the Release workflow attaches it; nothing to
   run). Developers can build it with `npm run zip:chrome`.

   While a version is still **pending review**, the dashboard won't take a new upload. Either
   wait for the approval and then upload the newest zip as an update (Package → Upload new
   package), or press **Cancel review**, upload the newest zip and submit again.
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time $5 registration) → **New item** → upload the zip.
3. **Store listing**: the same name, summary, description, category (Education or
   Productivity), icon (`store/icon-128.png`) and screenshots as on AMO (sections 2 and 6).
4. **Privacy practices**: single purpose "Look up Chinese words on web pages and in YouTube
   subtitles to learn Taiwanese Chinese." Permission justifications:
   - host permissions / content scripts: hover lookup on any page the user reads.
   - storage, unlimitedStorage: the word list and settings, kept locally.
   - alarms: syncs the word list every 20 minutes when signed in to the optional account.
   - contextMenus: the "Look up" item on selected text.
   - downloads: "Download new" saves the word-list export (a TSV built from the local list).
   - scripting: starts the lookup in a frame from the menu, and hides YouTube's own captions
     while ours show.
   - Remote code: No. Data usage: see section 3.
   - Privacy policy URL: https://chinese.cristianbagrin.com/brain/privacy
   - Homepage: https://chinese.cristianbagrin.com/brain · Support email: chris@cristianbagrin.com
   - Store listing → **YouTube video**: https://youtu.be/rJeqKHkXHmo
5. Submit for review. Then set up the `CWS_*` secrets ("Automatic releases") so later
   versions go out on their own.


## Website and accounts (Cloudflare)

`site/` is one Cloudflare Worker, `chinesebrain`, at https://chinese.cristianbagrin.com.
Pushing `main` deploys it (Workers & Pages → chinesebrain → Settings → Builds: production
branch `main`).

| Address | What |
| --- | --- |
| `/brain`, `/brain/guide` (How it works; `#welcome` after installing), `/brain/whats-new`, `/brain/privacy` | the extension's pages (`site/public/brain*`) |
| `/brain/dashboard` | the word list: from the extension in this browser, or from the account |
| `/account`, `/reset` | sign in, password, delete: one login for everything on this site |
| `/admin` | who signed up (owner only, see below) |
| `/api/*` | the account service (`site/worker.js`) |
| `/` | shows `/brain` until the main site exists |
| `chinesebrain.cristianbagrin.com` | short address, forwards to `/brain` |

The layout leaves room for more products on the same site and the same login: another one
goes in its own folder (`/tocfl/...`), and `/` becomes the page that presents them all.

Accounts need no database to set up: every account is a Durable Object with its own small
SQLite database, created by the deploy, plus one list of all accounts (`Directory`).

**Limits (Cloudflare free plan, per day):** 100,000 requests, 5 million rows read, 100,000
rows written, 5 GB stored in total. Past a limit the account service answers with an error
until midnight UTC; the extension keeps working and syncs later. The Workers Paid plan
($5 a month) lifts all of them far beyond what this needs; switch in Cloudflare →
Workers & Pages → Plans. Nothing in the code changes.

**Password-reset emails** go through [Resend](https://resend.com) (free: 3,000 emails a
month, 100 a day). Once:

1. Sign up at resend.com → **Domains** → add `cristianbagrin.com` → **Auto configure** with
   Cloudflare (or add the DNS records it shows) → wait for "Verified".
2. **API Keys** → Create (Sending access) → copy it.
3. Cloudflare dashboard → Workers & Pages → chinesebrain → Settings → Variables and Secrets →
   Add → type **Secret**, name `RESEND_API_KEY`, the key as its value → Deploy.

`https://chinese.cristianbagrin.com/api/health` then answers `"email": true`. Until then,
"Forgot password?" tells people to write to chris@cristianbagrin.com.

**Who signed up:** add a second secret the same way, name `ADMIN_KEY`, any long password you
make up. Then https://chinese.cristianbagrin.com/admin asks for it and shows the number of
accounts, new and active this week, and each account's email, join date and last use.
