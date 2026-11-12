-- Миграция 2026-11-12: добавлен уровень «Экстрим» (diff = 'extreme').
-- SQLite не умеет менять CHECK, поэтому таблица пересоздаётся с копированием данных.
-- Сначала резервная копия:
--   npx wrangler d1 export mudracing --remote --output=backups/before-extreme.sql
-- Применить:
--   npx wrangler d1 execute mudracing --remote --file=migrate-extreme.sql
CREATE TABLE scores_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cid       TEXT    NOT NULL,
  diff      TEXT    NOT NULL CHECK (diff IN ('easy', 'normal', 'hard', 'extreme')),
  name      TEXT    NOT NULL,
  total     REAL    NOT NULL,
  best_lap  REAL,
  place     INTEGER,
  ts        INTEGER NOT NULL,
  UNIQUE (cid, diff)
);
INSERT INTO scores_new (id, cid, diff, name, total, best_lap, place, ts)
  SELECT id, cid, diff, name, total, best_lap, place, ts FROM scores;
DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;
CREATE INDEX IF NOT EXISTS scores_diff_total ON scores (diff, total);
CREATE INDEX IF NOT EXISTS scores_cid_total ON scores (cid, total);
