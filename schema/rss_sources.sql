-- v7 §3 (출처 정책) + §9.2 (요일 구조) + §9.3 (금지 출처) + §10.1 (일일 cron)
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/rss_sources.sql
--
-- 운영자 워크플로우는 docs/rss-sources.md 참고.
-- 시드 INSERT 는 별도 파일: data/rss-sources-seed.sql

-- ─── rss_sources ────────────────────────────────────────────────
-- 도시별 RSS 피드 출처. site_url 은 시드, rss_url 은 운영자가
-- 사이트 직접 확인 후 채워 넣음 (NULL = 검증 대기).
-- terms_status='approved' + active=1 + rss_url NOT NULL → cron gather 대상.

CREATE TABLE IF NOT EXISTS rss_sources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    city_slug       TEXT    NOT NULL,            -- lisbon|chiang-mai|seoul|berlin|tokyo|mexico-city
    source_name     TEXT    NOT NULL,            -- 'Lisbon City Hall' / 'Gulbenkian' 등
    site_url        TEXT    NOT NULL,            -- 매체/기관 사이트 홈
    rss_url         TEXT,                        -- NULL = 운영자 검증 대기
    weekday_section TEXT    NOT NULL,            -- visa|museum|cityhall|desk|photo|quiet
    license_type    TEXT    NOT NULL,            -- public-domain|press-release|cc-by-4|editorial-review-required|terms-pending
    terms_status    TEXT    NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
    terms_notes     TEXT,                        -- 약관 검토 메모 (분쟁 시 근거)
    last_verified   INTEGER,                     -- ms timestamp 마지막 확인일
    last_fetch_at   INTEGER,                     -- 마지막 cron gather 시각
    last_fetch_ok   INTEGER NOT NULL DEFAULT 0,  -- boolean — 마지막 fetch 성공 여부
    fetch_error     TEXT,                        -- 마지막 실패 사유 (HTTP code 등)
    active          INTEGER NOT NULL DEFAULT 0,  -- 0=draft, 1=fetching
    created_at      INTEGER NOT NULL,
    UNIQUE(city_slug, source_name)
);

CREATE INDEX IF NOT EXISTS rss_sources_city_idx     ON rss_sources (city_slug);
CREATE INDEX IF NOT EXISTS rss_sources_active_idx   ON rss_sources (active);
CREATE INDEX IF NOT EXISTS rss_sources_section_idx  ON rss_sources (weekday_section);
CREATE INDEX IF NOT EXISTS rss_sources_status_idx   ON rss_sources (terms_status);

-- ─── forbidden_sources ──────────────────────────────────────────
-- v7 §9.3 절대 사용 금지. gather() 가 raw_feeds INSERT 전 도메인 매칭하여 차단.

CREATE TABLE IF NOT EXISTS forbidden_sources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_pattern  TEXT    NOT NULL UNIQUE,     -- 'reuters.com' / 'apnews.com' / 'chosun.com' 등
    reason          TEXT    NOT NULL,            -- 'wire-service' | 'paywall' | 'major-outlet' | 'gossip'
    notes           TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS forbidden_sources_pattern_idx ON forbidden_sources (domain_pattern);
CREATE INDEX IF NOT EXISTS forbidden_sources_reason_idx  ON forbidden_sources (reason);
