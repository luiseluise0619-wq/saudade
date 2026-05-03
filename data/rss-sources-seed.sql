-- v7 §3 / §9.2 / §9.3 — RSS 출처 시드 (운영자 검증 대기 상태)
-- Apply with:
--   wrangler d1 execute saudade_db --remote --file=data/rss-sources-seed.sql
--
-- 모든 entry 의 rss_url 은 NULL — 운영자가 사이트 직접 방문하여 RSS URL 확인 후 채워야 함.
-- 약관 검토 (terms_status=pending) 도 운영자 책임. approved 는 공공/보도자료 채널만 자동.
-- 검증 완료 후 active=1 로 켜야 cron gather 가 fetching 시작.
--
-- 운영자 워크플로우:
--   1. SELECT * FROM rss_sources WHERE rss_url IS NULL;
--   2. 각 site_url 방문 → RSS 피드 URL 확인 (없으면 RSS.app 변환 또는 제외)
--   3. 약관 검토 (terms_notes 필드에 검토 결과 + 날짜 기록)
--   4. UPDATE rss_sources SET rss_url='https://...', terms_status='approved',
--                              terms_notes='reviewed YYYY-MM-DD: ...', active=1
--      WHERE id=...;
--   5. 첫 1주 매일 raw_feeds 결과 검수.

-- INSERT timestamp = 2026-05-03 (강제 deterministic — strftime epoch ms)
-- 1746230400000 = 2026-05-03 00:00:00 UTC

-- ─── Lisbon ────────────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('lisbon', 'Lisbon City Hall', 'https://www.lisboa.pt', NULL,
     'cityhall', 'public-domain', 'approved',
     'public-domain government channel — press releases + city notices', NULL, 0, 1746230400000),

    ('lisbon', 'Gulbenkian Foundation', 'https://gulbenkian.pt', NULL,
     'museum', 'press-release', 'approved',
     'museum/foundation press releases — generally permissive', NULL, 0, 1746230400000),

    ('lisbon', 'The Portugal News', 'https://www.theportugalnews.com', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'English-language local outlet — verify ToS before activating', NULL, 0, 1746230400000),

    ('lisbon', 'Time Out Lisbon', 'https://www.timeout.com/lisbon', NULL,
     'desk', 'editorial-review-required', 'pending',
     'larger outlet — review ToS carefully (republication restrictions likely)', NULL, 0, 1746230400000),

    ('lisbon', 'Visit Lisboa', 'https://www.visitlisboa.com', NULL,
     'desk', 'public-domain', 'approved',
     'official tourism board — typically free to use', NULL, 0, 1746230400000);

-- ─── Chiang Mai ────────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('chiang-mai', 'Chiang Mai City Life', 'https://www.chiangmaicitylife.com', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'small English local — verify ToS', NULL, 0, 1746230400000),

    ('chiang-mai', 'TAT Chiang Mai', 'https://www.tatchiangmai.com', NULL,
     'desk', 'public-domain', 'approved',
     'Tourism Authority of Thailand official channel', NULL, 0, 1746230400000),

    ('chiang-mai', 'MAIIAM Contemporary Art Museum', 'https://www.maiiam.com', NULL,
     'museum', 'press-release', 'approved',
     'gallery press releases — generally permissive', NULL, 0, 1746230400000),

    ('chiang-mai', 'The Nation Thailand', 'https://www.nationthailand.com', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'larger English outlet — review ToS', NULL, 0, 1746230400000);

-- ─── Seoul ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('seoul', 'Seoul Metropolitan Govt (English)', 'https://english.seoul.go.kr', NULL,
     'cityhall', 'public-domain', 'approved',
     'official city government English channel', NULL, 0, 1746230400000),

    ('seoul', 'Seoul Foundation for Arts and Culture', 'https://www.sfac.or.kr', NULL,
     'museum', 'press-release', 'approved',
     'arts foundation press releases', NULL, 0, 1746230400000),

    ('seoul', 'National Museum of Korea', 'https://www.museum.go.kr', NULL,
     'museum', 'press-release', 'approved',
     'national museum press releases', NULL, 0, 1746230400000),

    ('seoul', 'Visit Seoul (English)', 'https://english.visitseoul.net', NULL,
     'desk', 'public-domain', 'approved',
     'official tourism channel', NULL, 0, 1746230400000),

    ('seoul', 'The Korea Times', 'https://www.koreatimes.co.kr', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'larger English outlet — review ToS', NULL, 0, 1746230400000);

-- ─── Berlin ────────────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('berlin', 'Berlin.de (City English)', 'https://www.berlin.de/en/', NULL,
     'cityhall', 'public-domain', 'approved',
     'official city portal — English version', NULL, 0, 1746230400000),

    ('berlin', 'The Berlin Spectator', 'https://berlinspectator.com', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'small English local — verify ToS', NULL, 0, 1746230400000),

    ('berlin', 'Sammlung Boros', 'https://www.sammlung-boros.de', NULL,
     'museum', 'press-release', 'approved',
     'private collection / gallery press', NULL, 0, 1746230400000),

    ('berlin', 'Visit Berlin', 'https://www.visitberlin.de/en', NULL,
     'desk', 'public-domain', 'approved',
     'official tourism channel', NULL, 0, 1746230400000);

-- ─── Tokyo ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('tokyo', 'Tokyo Metropolitan Govt', 'https://www.metro.tokyo.lg.jp', NULL,
     'cityhall', 'public-domain', 'approved',
     'official metropolitan government channel', NULL, 0, 1746230400000),

    ('tokyo', 'Mori Art Museum', 'https://www.mori.art.museum', NULL,
     'museum', 'press-release', 'approved',
     'museum press releases', NULL, 0, 1746230400000),

    ('tokyo', 'Tokyo Art Beat', 'https://www.tokyoartbeat.com', NULL,
     'museum', 'editorial-review-required', 'pending',
     'art aggregator — verify ToS for republication', NULL, 0, 1746230400000),

    ('tokyo', 'Time Out Tokyo', 'https://www.timeout.com/tokyo', NULL,
     'desk', 'editorial-review-required', 'pending',
     'larger outlet — review ToS carefully', NULL, 0, 1746230400000);

-- ─── Mexico City ───────────────────────────────────────────────
INSERT OR IGNORE INTO rss_sources
    (city_slug, source_name, site_url, rss_url, weekday_section, license_type, terms_status, terms_notes, last_verified, active, created_at)
VALUES
    ('mexico-city', 'Gobierno CDMX', 'https://www.cdmx.gob.mx', NULL,
     'cityhall', 'public-domain', 'approved',
     'official city government', NULL, 0, 1746230400000),

    ('mexico-city', 'Museo Jumex', 'https://www.fundacionjumex.org', NULL,
     'museum', 'press-release', 'approved',
     'museum press releases', NULL, 0, 1746230400000),

    ('mexico-city', 'Mexico News Daily', 'https://mexiconewsdaily.com', NULL,
     'quiet', 'editorial-review-required', 'pending',
     'English-language outlet — review ToS', NULL, 0, 1746230400000);

-- ─── forbidden_sources (v7 §9.3) ───────────────────────────────
-- 도메인 패턴 매칭 — gather() 에서 raw_feeds INSERT 전 차단.

INSERT OR IGNORE INTO forbidden_sources (domain_pattern, reason, notes, created_at) VALUES
    -- Wire services (적극적 라이선스 추적 + 소송)
    ('reuters.com',         'wire-service', 'aggressive license enforcement — never republish', 1746230400000),
    ('apnews.com',          'wire-service', 'AP wire — same as ap.org', 1746230400000),
    ('ap.org',              'wire-service', 'Associated Press', 1746230400000),
    ('bloomberg.com',       'wire-service', 'financial wire — aggressive', 1746230400000),

    -- Major US/UK outlets (paywall + enforcement)
    ('nytimes.com',         'paywall',      'NYT — paywall + restrictive ToS', 1746230400000),
    ('wsj.com',             'paywall',      'Wall Street Journal — paywall', 1746230400000),
    ('theguardian.com',     'major-outlet', 'restrictive ToS', 1746230400000),
    ('ft.com',              'paywall',      'Financial Times — paywall', 1746230400000),
    ('washingtonpost.com',  'paywall',      'Washington Post — paywall', 1746230400000),
    ('economist.com',       'paywall',      'paywall', 1746230400000),

    -- Korean major papers (사용 불가)
    ('chosun.com',          'major-outlet', 'Chosun Ilbo — Korean major', 1746230400000),
    ('joongang.co.kr',      'major-outlet', 'JoongAng Ilbo — Korean major', 1746230400000),
    ('donga.com',           'major-outlet', 'Donga Ilbo — Korean major', 1746230400000),
    ('hani.co.kr',          'major-outlet', 'Hankyoreh — Korean major', 1746230400000),

    -- Gossip / entertainment / political (잡지 톤 X)
    ('tmz.com',             'gossip',       'celebrity gossip', 1746230400000),
    ('dailymail.co.uk',     'gossip',       'tabloid', 1746230400000),
    ('thesun.co.uk',        'gossip',       'tabloid', 1746230400000),
    ('foxnews.com',         'political',    'partisan political', 1746230400000),
    ('breitbart.com',       'political',    'partisan political', 1746230400000);
