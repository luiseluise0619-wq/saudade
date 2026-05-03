-- v7 §10 — AI 파이프라인 (raw feeds + staged dispatches)
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/ai_pipeline.sql
--
-- 일일 cron 흐름:
--   00:00 Gather    rss-parser → raw_feeds
--   00:30 Sort      Workers AI (Llama 3.1 8B) — 도시 분류 + raw_feeds.city
--   02:00 Score     Workers AI — quietness/dignity 1~10점
--   04:00 Write     Gemini 2.0 Flash — 3~4 문장 재작성 → dispatches_staged
--   05:00 Translate Gemini Flash — 별쇄 번역
--   05:30 Stage     검수 큐
--   06:00 File      Top 3 publish (auto)

CREATE TABLE IF NOT EXISTS raw_feeds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at      INTEGER NOT NULL,
    source_url      TEXT    NOT NULL,
    raw_title       TEXT,
    raw_summary     TEXT,
    raw_pub_date    INTEGER,
    city            TEXT,                    -- AI sort 결과
    weekday_section TEXT,                    -- visa/museum/cityhall/desk/photo/quiet
    ai_score        REAL,                    -- 0~10
    processed_at    INTEGER,                  -- null = unprocessed
    UNIQUE(source_url)
);

CREATE INDEX IF NOT EXISTS raw_feeds_fetched_idx   ON raw_feeds (fetched_at DESC);
CREATE INDEX IF NOT EXISTS raw_feeds_processed_idx ON raw_feeds (processed_at);
CREATE INDEX IF NOT EXISTS raw_feeds_city_idx      ON raw_feeds (city);
CREATE INDEX IF NOT EXISTS raw_feeds_score_idx     ON raw_feeds (ai_score DESC);

-- staged: AI 가 재작성한 dispatch. 편집장 검수 → 'published' or 'discarded'.
CREATE TABLE IF NOT EXISTS dispatches_staged (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_feed_id     INTEGER NOT NULL,
    edition         TEXT    NOT NULL DEFAULT 'en',
    weekday         INTEGER,                  -- 1=Mon, ..., 6=Sat
    headline        TEXT    NOT NULL,
    lede            TEXT,
    body            TEXT,
    quote           TEXT,
    quote_source    TEXT,
    source_name     TEXT,
    source_url      TEXT,
    license_type    TEXT,
    ai_score        REAL,
    edited_words    INTEGER DEFAULT 0,
    total_words     INTEGER DEFAULT 0,
    edited_by_human INTEGER DEFAULT 0,        -- boolean
    status          TEXT    NOT NULL DEFAULT 'staged',  -- staged|published|discarded|retracted
    staged_at       INTEGER NOT NULL,
    published_at    INTEGER,
    retracted_at    INTEGER,
    retract_reason  TEXT,
    FOREIGN KEY(raw_feed_id) REFERENCES raw_feeds(id)
);

CREATE INDEX IF NOT EXISTS staged_status_idx  ON dispatches_staged (status);
CREATE INDEX IF NOT EXISTS staged_edition_idx ON dispatches_staged (edition);
CREATE INDEX IF NOT EXISTS staged_published_idx ON dispatches_staged (published_at DESC);
