-- saudade · subscriptions schema (Stripe-backed)
-- Apply: wrangler d1 execute saudade_db --remote --file=schema/subscriptions.sql
--
-- Tracks Stripe subscriptions so the worker can update users.tier on webhook
-- events. The free/patron/subscriber tier on users (auth.sql) is the source of
-- truth for gating; this table is the audit log + Stripe ID mapping.

CREATE TABLE IF NOT EXISTS subscriptions (
    id                    TEXT    PRIMARY KEY,    -- stripe subscription id (sub_xxx)
    user_id               TEXT    NOT NULL,        -- foreign key to users.id
    stripe_customer_id    TEXT    NOT NULL,        -- cus_xxx
    status                TEXT    NOT NULL,        -- active | canceled | past_due | trialing | incomplete
    plan                  TEXT    NOT NULL,        -- 'subscriber' | 'patron'
    current_period_start  INTEGER,
    current_period_end    INTEGER,
    cancel_at_period_end  INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx     ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx   ON subscriptions (status);

-- One-shot patron contributions (Buy Me a Coffee, manual). Optional table —
-- only populated if you wire BMaC webhooks. Otherwise patron tier is set
-- manually via worker /auth/promote (admin endpoint, not yet built).
CREATE TABLE IF NOT EXISTS patron_contributions (
    id              TEXT    PRIMARY KEY,
    user_id         TEXT,                 -- nullable — anonymous BMaC ok
    email           TEXT,
    amount_cents    INTEGER NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'usd',
    source          TEXT    NOT NULL,     -- 'bmac' | 'stripe' | 'manual'
    received_at     INTEGER NOT NULL,
    note            TEXT
);

CREATE INDEX IF NOT EXISTS patron_email_idx ON patron_contributions (email);
