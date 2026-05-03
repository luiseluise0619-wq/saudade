-- v7 §5.5 — City requests (정의 안 된 도시 요청)
-- "100건 시 다음 분기 추가" — per spec.
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/city_requests.sql

CREATE TABLE IF NOT EXISTS city_requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    at              INTEGER NOT NULL,        -- unix ms
    requested_city  TEXT    NOT NULL,        -- normalized (lowercased)
    user_email      TEXT,                     -- optional, identifies request
    edition         TEXT    NOT NULL DEFAULT 'en'
);

CREATE INDEX IF NOT EXISTS city_requests_city_idx ON city_requests (requested_city);
CREATE INDEX IF NOT EXISTS city_requests_at_idx   ON city_requests (at DESC);

-- 검수 쿼리 예:
-- SELECT requested_city, COUNT(*) AS n FROM city_requests
--   GROUP BY requested_city ORDER BY n DESC LIMIT 20;
