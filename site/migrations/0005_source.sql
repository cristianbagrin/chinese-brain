-- Chinese Brain Plus becomes the source (Stage 1's switch-over).
-- meta: small settings; `source` = the day the website became the source (absent while the Mac is).
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
-- history: earlier versions of documents the website changed, at most one per document every ten minutes, so a bad
-- write can always be undone by hand.
CREATE TABLE IF NOT EXISTS history (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS history_doc ON history (col, id, at);
