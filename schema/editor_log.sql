-- v6 §9.10 — Editor activity log for auto-pause computation.
-- Cloudflare D1 (SQLite). Apply with:
--   wrangler d1 execute lounj_db --file=schema/editor_log.sql
-- Or, for a remote (production) DB:
--   wrangler d1 execute lounj_db --remote --file=schema/editor_log.sql
--
-- Tracked actions (only these count toward auto-pause):
--   dispatch.review        — editor opened a daily dispatch for review
--   dispatch.edit          — editor edited body text
--   dispatch.headline_edit — editor changed a headline
--   dispatch.retract       — editor pulled a published dispatch
--
-- Stage computation (worker reads MAX(at)):
--   active        — last activity within 7 days
--   soft pause    — 7  ≤ days_idle < 14   (UI label only; publishing continues)
--   hard pause    — 14 ≤ days_idle < 30   (publishing cron stops; cover message)
--   subscription  — days_idle ≥ 30        (Stripe subscriptions auto-pause)

CREATE TABLE IF NOT EXISTS editor_log (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    at     INTEGER NOT NULL,    -- unix ms (Date.now())
    action TEXT    NOT NULL,    -- one of the four allowed actions above
    editor TEXT,                -- editor identifier (nullable)
    target TEXT                 -- dispatch id or city, nullable
);

CREATE INDEX IF NOT EXISTS editor_log_at_idx     ON editor_log (at DESC);
CREATE INDEX IF NOT EXISTS editor_log_action_idx ON editor_log (action);
