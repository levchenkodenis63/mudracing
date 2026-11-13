-- MUD RACING — общая таблица рекордов (Cloudflare D1 / SQLite)
-- Применить: npx wrangler d1 execute mudracing --remote --file=schema.sql

-- Лучший результат каждого игрока на каждом уровне соперников.
-- «Абсолют» не хранится отдельно: это лучший из результатов игрока по всем уровням.
-- cid — случайный id браузера (генерируется клиентом), по нему
-- игрок «узнаёт» свою запись; наружу он никогда не отдаётся.
CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  cid       TEXT    NOT NULL,
  diff      TEXT    NOT NULL CHECK (diff IN ('easy', 'normal', 'hard', 'extreme')),
  name      TEXT    NOT NULL,
  total     REAL    NOT NULL,
  best_lap  REAL,
  place     INTEGER,
  ts        INTEGER NOT NULL,  -- когда поставлен результат (время клиента)
  UNIQUE (cid, diff)
);
CREATE INDEX IF NOT EXISTS scores_diff_total ON scores (diff, total);
CREATE INDEX IF NOT EXISTS scores_cid_total ON scores (cid, total);

-- MUD RING (кольцевая гонка): та же структура, отдельная таблица.
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
