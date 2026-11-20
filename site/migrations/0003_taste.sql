-- The taste test (Stage 2): the same jobs done by Claude and by other models, judged blind.
-- items: one sample of one job (card, grade, essay, image), with its prompt and Claude's answer.
CREATE TABLE IF NOT EXISTS taste_items (id TEXT PRIMARY KEY, job TEXT NOT NULL, ord INTEGER NOT NULL, data TEXT NOT NULL);
-- models: who else takes the test, per kind (text or image).
CREATE TABLE IF NOT EXISTS taste_models (model TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL);
-- runs: each model's answer to each item (an image's R2 key for images), or why it failed.
CREATE TABLE IF NOT EXISTS taste_runs (item TEXT NOT NULL, model TEXT NOT NULL, out TEXT, err TEXT, at INTEGER NOT NULL, PRIMARY KEY (item, model));
-- picks: the one Chris chose for each item ('none' when nothing was good enough).
CREATE TABLE IF NOT EXISTS taste_picks (item TEXT PRIMARY KEY, pick TEXT NOT NULL, at INTEGER NOT NULL);
