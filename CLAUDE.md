# Working on this repository

- **Ship to `main`.** When work is done and checks pass (`npm run typecheck`, `npm test`,
  `npm run build`, `npm run lint:ext`), merge it into `main` and push, in addition to any
  session branch. Pushing `main` deploys the website (`site/`, Cloudflare Workers Builds) and,
  when the version in `package.json` changed, releases the extension to the stores
  (`.github/workflows/release.yml`). No pull request needed unless asked.
- `dist/` and `dist-chrome/` are committed: rebuild them (`npm run build`) before committing
  source changes.
- A new version needs its notes in `store/PUBLISHING.md` (section 4), or the release stops.
  The build writes the website's What's new page from them.
- The extension's website pages live under `/brain` (`site/public/brain*`); `/account` and
  `/api` are shared by everything on the site. Keep old addresses working (`MOVED` in
  `site/worker.js`): store listings and installed extensions link to them.
- Key names in the UI follow the computer: `Alt` on Windows and Linux, `⌥ Option` on a Mac.
- All user-facing English is American English (UI, docs, data; see `scripts/american.py`).
- Few words, clear controls: prefer a button or an icon with a tooltip over a sentence.
