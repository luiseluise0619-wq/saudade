-- Sunday digest opt-in list.
-- One weekly email per edition. Constitution-compatible retention:
-- explicit opt-in, no daily noise, one-click unsubscribe in every email.
--
-- Apply once:
--   wrangler d1 execute saudade_db --remote --file=schema/digest_subscribers.sql

CREATE TABLE IF NOT EXISTS digest_subscribers (
    email           TEXT    PRIMARY KEY,         -- lowercased, trimmed
    edition         TEXT    NOT NULL,            -- en | ko | ja | pt | es
    token           TEXT    UNIQUE NOT NULL,     -- 32-char unsubscribe token
    created_at      INTEGER NOT NULL,            -- unix ms
    confirmed_at    INTEGER,                     -- set after click-confirm (NULL = pending)
    unsubscribed_at INTEGER,                     -- set on unsubscribe (NULL = active)
    last_sent_at    INTEGER                      -- updated each weekly send
);

CREATE INDEX IF NOT EXISTS digest_subscribers_ed_idx
    ON digest_subscribers (edition, confirmed_at, unsubscribed_at);

CREATE INDEX IF NOT EXISTS digest_subscribers_token_idx
    ON digest_subscribers (token);
