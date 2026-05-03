-- v8 §02 + §11 + §13 — 사용자 도시 선택 Dispatches + 약한 연결 (Weak Signals)
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/v8_following_sessions.sql
--
-- v7 의 정착+주변 도시 매핑을 사용자가 직접 고르는 Following 3 모델로 전환.
-- 약한 연결 표시 (Cover/Atlas/Listening) 데이터는 M1 에서 모으고 M3 에서 표시.

-- ─── user_following_cities ─────────────────────────────────────
-- 사용자별 Following 도시 3개. position 1~3 = dispatch 슬롯 매칭 순서.
-- v7 §5.4 Switch the desk 폐기 — 사용자가 직접 변경하면 됨.

CREATE TABLE IF NOT EXISTS user_following_cities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    city        TEXT    NOT NULL,            -- city slug (city-pool.json 정의)
    position    INTEGER NOT NULL,            -- 1, 2, 3
    added_at    INTEGER NOT NULL,
    UNIQUE(user_id, position),
    UNIQUE(user_id, city)
);

CREATE INDEX IF NOT EXISTS following_user_idx ON user_following_cities (user_id);
CREATE INDEX IF NOT EXISTS following_city_idx ON user_following_cities (city);

-- ─── listening_sessions ────────────────────────────────────────
-- 트랙 재생 시작 = 한 행. 사용자별 이력 페이지 X — 약한 연결 집계만.
-- duration_seconds 는 종료 시점에 UPDATE (재생 중 페이지 떠나도 OK — 마지막 timeupdate 값).

CREATE TABLE IF NOT EXISTS listening_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT,                       -- NULL 가능 (로그인 전)
    track_id        TEXT,                       -- track audio_url 또는 slug
    city            TEXT,                       -- track.city (도시 트랙일 때만)
    started_at      INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_started_idx ON listening_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS sessions_city_idx    ON listening_sessions (city);

-- ─── weekly_stats ──────────────────────────────────────────────
-- D1 읽기 한도 보존용 캐싱. 매주 월요일 자정 cron 이 갱신.
-- key 예: 'cover:lisbon:readers' / 'atlas:weekly_submissions' / 'listening:weekly_total'

CREATE TABLE IF NOT EXISTS weekly_stats (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_key    TEXT    NOT NULL UNIQUE,
    stat_value  TEXT    NOT NULL,                -- JSON string (배열·객체 가능)
    computed_at INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL                 -- next Monday midnight
);

CREATE INDEX IF NOT EXISTS stats_key_idx     ON weekly_stats (stat_key);
CREATE INDEX IF NOT EXISTS stats_expires_idx ON weekly_stats (expires_at);
