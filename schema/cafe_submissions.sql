-- v7 §8.9 — Cafe submissions table.
-- Cloudflare D1 (SQLite). Apply with:
--   wrangler d1 execute lounj_db --file=schema/cafe_submissions.sql
-- Or remote:
--   wrangler d1 execute lounj_db --remote --file=schema/cafe_submissions.sql
--
-- 사용자가 "Submit a café" 폼으로 제출 → 다음 분기 발행 시 편집부 검수.
-- 입점료·광고·추천 협찬 0건. status 가 'queued' 인 것만 검수 대상.

CREATE TABLE IF NOT EXISTS cafe_submissions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    at             INTEGER NOT NULL,          -- 제출 시각 (unix ms)
    name           TEXT    NOT NULL,          -- cafe name (required)
    city           TEXT    NOT NULL,          -- city (required)
    neighborhood   TEXT,                       -- optional
    lat            REAL,                       -- optional, 검수 시 보강 가능
    lng            REAL,
    submitter      TEXT,                       -- email or 익명, optional
    note           TEXT,                       -- 1-2 줄, optional
    status         TEXT    NOT NULL DEFAULT 'queued',   -- queued | reviewed | rejected
    reviewed_at    INTEGER,                    -- 검수 시각
    reviewer_notes TEXT                        -- 편집장 메모
);

CREATE INDEX IF NOT EXISTS cafe_subs_at_idx     ON cafe_submissions (at DESC);
CREATE INDEX IF NOT EXISTS cafe_subs_status_idx ON cafe_submissions (status);
CREATE INDEX IF NOT EXISTS cafe_subs_city_idx   ON cafe_submissions (city);
