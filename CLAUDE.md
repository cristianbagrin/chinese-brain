# Working on this repository

- **Ship to `main`.** When work is done and checks pass (`npm run typecheck`, `npm test`,
  `npm run build`, `npm run lint:ext`), merge it into `main` and push, in addition to any
  session branch. Pushing `main` deploys the website (`site/`, Cloudflare Workers Builds) and,
  when the version in `package.json` changed, releases the extension to the stores
  (`.github/workflows/release.yml`). No pull request needed unless asked.
- `dist/`, `dist-chrome/`, `site/public/brain/dashboard.js` and `site/public/site.js` (from
  `site/src/`) are committed: rebuild them (`npm run build`) before committing source changes.
- The word list is the Dashboard, on the website only (`/brain/dashboard`). With the extension it talks to the
  extension through `src/content/bridge.ts` (own site only, whitelisted messages).
- The site sends a strict CSP (`site/public/_headers`): no inline scripts; shared page code goes
  in `site/src/site.ts` (the demo card for visitors without the extension, the steps on How it
  works, the little YouTube player).
- A new version needs its notes in `store/PUBLISHING.md` (section 4), or the release stops.
  The website's What's new page (`site/public/brain/whats-new.html`) is hand-written: add an entry
  only for what a reader would notice, titled by what it gets them.
- The extension's website pages live under `/brain` (`site/public/brain*`); `/account` and
  `/api` are shared by everything on the site. Keep old addresses working (`MOVED` in
  `site/worker.js`): store listings and installed extensions link to them.
- Key names in the UI follow the computer: `Alt` on Windows and Linux, `⌥ Option` on a Mac.
- All user-facing English is American English (UI, docs, data; see `scripts/american.py`).
- Few words, clear controls: prefer a button or an icon with a tooltip over a sentence.
- Chris changes the pages' words himself at `/edit` (any page: `/edit/brain/guide`…; password = the
  `EDIT_KEY` secret). His edits live in the Worker's `Copy` database and are put into each page as it's
  served, tied to the words they replaced (`site/src/copy.ts`). Run `node site/sync.mjs` before changing
  page text by hand (`--apply` writes his edits into `site/public`); words that scripts write go in an
  element marked `data-js-text`, so the editor leaves them alone.
