-- v7 §13 — Auth (Magic Link via Lucia pattern + D1)
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/auth.sql
--
-- 두 테이블:
--   users         — 이메일 가입 사용자 (no password — magic link only)
--   magic_tokens  — 단일 사용 토큰 (15분 유효)

CREATE TABLE IF NOT EXISTS users (
    id            TEXT    PRIMARY KEY,    -- nanoid 21
    email         TEXT    UNIQUE NOT NULL,
    edition       TEXT    NOT NULL DEFAULT 'en',
    tier          TEXT    NOT NULL DEFAULT 'free',
    created_at    INTEGER NOT NULL,
    last_login_at INTEGER
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS magic_tokens (
    token_hash    TEXT    PRIMARY KEY,    -- sha256(token) hex
    email         TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,
    used_at       INTEGER                  -- null = unused
);

CREATE INDEX IF NOT EXISTS magic_tokens_email_idx   ON magic_tokens (email);
CREATE INDEX IF NOT EXISTS magic_tokens_expires_idx ON magic_tokens (expires_at);

-- 세션은 클라이언트 cookie/localStorage 만. 서버 세션 테이블 X — 토큰만 검증 후
-- 클라이언트가 user.id 를 들고다님. 추후 sessions 테이블 추가 가능.
