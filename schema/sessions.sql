-- saudade · permission revocation — sessions, consent log, account deletion log
-- Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/sessions.sql
--
-- Adds the missing pieces so a user can:
--   • see their active sessions
--   • sign out everywhere (revoke all sessions + pending magic links)
--   • export their data (GDPR Art.20 / PIPA §35)
--   • delete their account (GDPR Art.17 / PIPA §36)
--   • revoke a previously granted consent category

-- 1. Server-side session table — opaque session id required for sensitive ops.
CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT    PRIMARY KEY,        -- sha256 of opaque session token (hex64)
    user_id       TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,           -- absolute expiry (default created_at + 30d)
    ua_hash       TEXT,                       -- sha256(User-Agent) for display only
    ip_hash       TEXT,                       -- sha256(IP + daily salt), audit only
    label         TEXT,                       -- short human label e.g. "Chrome · macOS"
    revoked_at    INTEGER,                    -- non-null = revoked
    revoked_by    TEXT                        -- 'user' | 'user_all' | 'admin' | 'expiry'
);

CREATE INDEX IF NOT EXISTS sessions_user_idx     ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx  ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_revoked_idx  ON sessions (revoked_at);

-- 2. Consent log — every grant / revoke event is auditable.
--    PIPA §22, GDPR Art.7(1) demand you can demonstrate lawful basis.
CREATE TABLE IF NOT EXISTS consent_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT,                       -- null = anonymous (cookie banner pre-login)
    anon_id       TEXT,                       -- client-generated UUID for pre-login users
    category      TEXT    NOT NULL,           -- 'analytics' | 'marketing' | 'functional' | 'ai'
    granted       INTEGER NOT NULL,           -- 0 | 1
    at            INTEGER NOT NULL,
    edition       TEXT,                       -- locale at time of consent
    ua_hash       TEXT,
    policy_ver    TEXT                        -- privacy policy version this consent refers to
);

CREATE INDEX IF NOT EXISTS consent_user_idx ON consent_log (user_id);
CREATE INDEX IF NOT EXISTS consent_anon_idx ON consent_log (anon_id);
CREATE INDEX IF NOT EXISTS consent_at_idx   ON consent_log (at);

-- 3. Deletion log — keep a tombstone record for audit (no PII) after account hard delete.
CREATE TABLE IF NOT EXISTS deletion_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id_hash  TEXT    NOT NULL,           -- sha256(user_id) — never the raw id
    email_hash    TEXT    NOT NULL,           -- sha256(email)
    requested_at  INTEGER NOT NULL,
    deleted_at    INTEGER NOT NULL,
    reason        TEXT                         -- optional, free text from user
);

CREATE INDEX IF NOT EXISTS deletion_at_idx ON deletion_log (deleted_at);

-- 4. Add soft-delete and deletion-pending columns to users (idempotent).
--    D1 does not support IF NOT EXISTS on ALTER — wrap and ignore errors when re-applying.
--    These statements are safe to run once. If they fail because the column already exists,
--    re-apply the rest manually.
-- ALTER TABLE users ADD COLUMN deletion_requested_at INTEGER;
-- ALTER TABLE users ADD COLUMN deleted_at            INTEGER;

-- Use these idempotently via a CREATE TABLE ... IF NOT EXISTS migration helper instead.
-- The worker checks for column presence at runtime and ignores missing columns.
