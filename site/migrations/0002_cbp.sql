-- Chinese Brain Plus data. During the mirror (Stage 1) the Mac pushes these; afterwards the website owns them.
-- files: the Chinese system's texts under the names engine.ts reads (known-words.txt, learn-next.md, ...).
CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, text TEXT NOT NULL, sha TEXT NOT NULL, updated INTEGER NOT NULL);
-- docs: the board's documents (essays, reviews, improve, cards, board/*), one JSON per (collection, id).
CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, sha TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (col, id));
-- checks: each night, does the engine still say what words.py says?
CREATE TABLE IF NOT EXISTS checks (day TEXT NOT NULL, name TEXT NOT NULL, ok INTEGER NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (day, name));
