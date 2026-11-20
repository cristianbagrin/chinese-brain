-- Chinese Brain Plus: the release switches. `who` is an account id, or '*' for everyone.
CREATE TABLE IF NOT EXISTS flags (
  who TEXT NOT NULL,
  flag TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (who, flag)
);
