-- saudade · letters to the editor
--
-- Reader-submitted letters about a dispatch, a calculator outcome, a city,
-- or the paper itself. Submitted via /letters/submit, queued for editor
-- review, published into a §05 "Letters" page or inlined under a dispatch.
--
-- The contract is editorial, not social: every letter is reviewed before
-- it is visible to anyone but the author. No public comment thread.
-- No reply chains. Only what an editor would print.
--
-- Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/letters.sql

CREATE TABLE IF NOT EXISTS letters (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_at    INTEGER NOT NULL,
    user_id         TEXT,                       -- nullable: anonymous letters allowed
    user_email      TEXT,                       -- contact for follow-up only, not displayed
    display_name    TEXT,                       -- 'Laia, Barcelona' — what the editor prints
    edition         TEXT NOT NULL DEFAULT 'en', -- which language the letter was written in
    dispatch_ref    TEXT,                       -- optional: dispatch id this letter responds to
    city_tag        TEXT,                       -- optional: 'lisbon', 'seoul', 'global'
    body            TEXT NOT NULL,              -- the letter (≤ 800 chars at submit)
    status          TEXT NOT NULL DEFAULT 'submitted',
                    -- submitted | reviewed | edited | published | rejected | retracted
    edited_body     TEXT,                       -- editor's edited version of the body
    editor_note     TEXT,                       -- internal note (not displayed)
    rejection_reason TEXT,                      -- internal, optional
    published_at    INTEGER,
    issue_ref       TEXT                         -- which issue this letter ran in
);

CREATE INDEX IF NOT EXISTS letters_status_idx     ON letters (status);
CREATE INDEX IF NOT EXISTS letters_dispatch_idx   ON letters (dispatch_ref);
CREATE INDEX IF NOT EXISTS letters_published_idx  ON letters (published_at);
CREATE INDEX IF NOT EXISTS letters_user_idx       ON letters (user_id);
