-- v7 §9.9 — Dispatch retracts
-- Cloudflare D1. Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/dispatch_retracts.sql
--
-- 30분 이내 retract → archive 에서도 삭제 (frontend 가 hide).
-- 30분 이후 → "This dispatch was retracted by the editor." placeholder.
-- reason 은 audit only — 사용자 노출 X.

CREATE TABLE IF NOT EXISTS dispatch_retracts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id   TEXT    NOT NULL,        -- e.g. "lisbon-01" (lowercase city + n)
    edition       TEXT    NOT NULL DEFAULT 'en',
    retracted_at  INTEGER NOT NULL,        -- unix ms
    reason        TEXT,                     -- audit log, 사용자 노출 X
    editor        TEXT
);

CREATE INDEX IF NOT EXISTS dispatch_retracts_at_idx       ON dispatch_retracts (retracted_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_retracts_dispatch_idx ON dispatch_retracts (dispatch_id, edition);
