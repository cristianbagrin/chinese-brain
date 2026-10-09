# Working on this repository

- **Ship to the default branch.** When work is done and checks pass (`npm run typecheck`,
  `npm test`, `npm run build`, `npm run lint:ext`), merge it into the default branch
  (`claude/chinese-brain-extension-drtq0h`) and push, in addition to any session branch.
  The owner loads the extension from a checkout of the default branch, so work that only
  lives on a session branch never reaches them. No pull request needed unless asked.
- `dist/` is committed: rebuild it (`npm run build`) before committing source changes.
- All user-facing English is American English (UI, docs, data; see `scripts/american.py`).
