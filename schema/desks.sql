-- saudade · stringer desks
--
-- A desk is an invited correspondent's column under the saudade masthead.
-- Distinct from letters (short, reactive). A desk publishes ongoing
-- dispatches — 1-2 per month, signed with the stringer's name and city.
--
-- Lifecycle:
--   apply  → review → invite → first post → ongoing
--
-- Apply with:
--   wrangler d1 execute saudade_db --remote --file=schema/desks.sql

CREATE TABLE IF NOT EXISTS desks (
    slug            TEXT    PRIMARY KEY,        -- 'seoul', 'bali-stringer', 'tokyo-night-desk'
    user_id         TEXT,                       -- nullable until invited
    user_email      TEXT    NOT NULL,
    display_name    TEXT    NOT NULL,           -- 'Inês Coutinho' / 'Yuna Park'
    city            TEXT    NOT NULL,           -- 'lisbon', 'seoul', 'bali'
    edition         TEXT    NOT NULL DEFAULT 'en',
    bio             TEXT,                       -- short italic bio shown on /desks/<slug>
    application     TEXT,                       -- the stringer's pitch (private)
    status          TEXT    NOT NULL DEFAULT 'applied',
                    -- applied | reviewing | invited | active | paused | retired | rejected
    cadence         TEXT,                       -- 'monthly' | 'biweekly' | 'quarterly'
    created_at      INTEGER NOT NULL,
    invited_at      INTEGER,
    first_post_at   INTEGER,
    last_post_at    INTEGER,
    rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS desks_status_idx   ON desks (status);
CREATE INDEX IF NOT EXISTS desks_city_idx     ON desks (city);
CREATE INDEX IF NOT EXISTS desks_edition_idx  ON desks (edition);

-- ─── Posts filed by a desk ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS desk_posts (
    id              TEXT    PRIMARY KEY,        -- nanoid
    desk_slug       TEXT    NOT NULL,
    submitted_at    INTEGER NOT NULL,
    title           TEXT    NOT NULL,           -- 30..120 chars
    lede            TEXT,                       -- 0..220 chars italic intro
    body            TEXT    NOT NULL,           -- 200..6000 chars (longer than letters)
    edited_body     TEXT,                       -- editor's edit, displayed if present
    edited_lede     TEXT,
    city            TEXT,                       -- override desk.city per-post
    edition         TEXT    NOT NULL DEFAULT 'en',
    status          TEXT    NOT NULL DEFAULT 'submitted',
                    -- submitted | reviewing | edited | published | retracted | rejected
    editor_note     TEXT,
    rejection_reason TEXT,
    published_at    INTEGER,
    issue_ref       TEXT,
    quote           TEXT,                       -- optional pull-quote (≤200 chars)
    quote_source    TEXT,
    source_url      TEXT,
    ai_assisted     INTEGER NOT NULL DEFAULT 0  -- 0 = human only, 1 = AI assisted
);

CREATE INDEX IF NOT EXISTS desk_posts_status_idx       ON desk_posts (status);
CREATE INDEX IF NOT EXISTS desk_posts_desk_idx         ON desk_posts (desk_slug);
CREATE INDEX IF NOT EXISTS desk_posts_published_idx    ON desk_posts (published_at);
CREATE INDEX IF NOT EXISTS desk_posts_edition_idx      ON desk_posts (edition);
