-- Миграция 2026-11-13: таблица рекордов MUD RING (кольцевая гонка).
-- Только добавляет новую таблицу, существующие данные не трогает.
-- Применить: npx wrangler d1 execute mudracing --remote --file=migrate-ring.sql
CREATE TABLE IF NOT EXISTS ring_scores (
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
CREATE INDEX IF NOT EXISTS ring_scores_diff_total ON ring_scores (diff, total);
CREATE INDEX IF NOT EXISTS ring_scores_cid_total ON ring_scores (cid, total);
