# saudade

> A slow newspaper for digital nomads. Three cities, no schedule. Edited from Lisbon.

[![status](https://img.shields.io/badge/status-MVP-orange)]()
[![pricing](https://img.shields.io/badge/pricing-free%20core-brightgreen)]()
[![license](https://img.shields.io/badge/license-Proprietary-blue)](./LICENSE)
[![pwa](https://img.shields.io/badge/PWA-installable-blueviolet)]()
[![stack](https://img.shields.io/badge/stack-Cloudflare%20Workers%20%2B%20D1%20%2B%20Vanilla%20JS-yellow)]()

`saudade` /sɐwˈðaðɨ/ — Portuguese for the longing you carry for places you can't return to. The product is the same idea: a quiet desk that tracks the visa days you have left, the cafés you can actually work from, and the city policies that change while you sleep.

---

## What this is

A multi-edition online newspaper, filed daily. Five **independently authored** editions: `en`, `ko`, `ja`, `pt`, `es`. Each edition speaks to its own audience's cities — KO for Seoul/Busan/Jeju, JA for Tokyo/Osaka/Kyoto, PT for Lisboa/Porto/Sintra, ES for Madrid/Barcelona/Buenos Aires, EN for Seoul/Tokyo/Lisbon. **Not translations.**

| § | Section | What it does |
|---|---|---|
| **01** | **Ledger** | Schengen 90/180, tax-residency days, health-insurance gaps, pension filings — counted, not advised. |
| **02** | **Atlas** | Cafés the editor has visited. Outlets, noise level, Wi-Fi, hours. |
| **03** | **Dispatches** | Three city items, six days a week. Visa & policy notes, sourced and dated. |
| **04** | **The Desk** | Filing pipeline (EN: Worker D1 cron · KO/JA/PT/ES: GitHub Actions cron). |
| (sub) | **Listening Room** | Field-recorded ambient tracks per city + photo. |

For the module map, data flow, and the "adding a feature" checklist, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Stack

- **Frontend** — vanilla JS IIFE modules, no bundler. PWA-installable, prefers-reduced-motion respected.
- **Backend** — single Cloudflare Worker (`cloudflare-worker.js`) + D1 (`schema/`) + KV cache.
- **AI pipeline** — Workers AI (Llama 3.1 8B) for sort/score, Gemini 2.0 Flash for write. Disclosed per dispatch.
- **Per-edition refresh** — GitHub Actions cron + `scripts/refresh-dispatches.js` writes KO/JA/PT/ES native-voice content daily.
- **Auth** — passwordless magic-link (Resend), opaque server sessions, full revocation flow.

---

## Run

```bash
# 1. Local dev (no auth, no DB)
python3 serve.py            # → http://localhost:8000

# 2. Worker (auth + dispatches + admin)
cp wrangler.toml.example wrangler.toml      # if you need a template
wrangler d1 create saudade_db
wrangler d1 execute saudade_db --remote --file=schema/auth.sql
wrangler d1 execute saudade_db --remote --file=schema/sessions.sql
wrangler deploy
# then point window.AURA_SERVER in index.html to your worker URL
```

Required worker secrets (all optional unless noted):

| Secret | Purpose |
|---|---|
| `RESEND_KEY` + `RESEND_FROM` | sends magic-link sign-in email (else returns the link inline — fine for solo) |
| `EDITOR_TOKEN` | bearer for `/editor/*` and `/admin/*` |
| `LICENSE_SIGNING_KEY` | only if you re-enable paid plans |
| `GEMINI_KEY` | rewrite step in The Desk pipeline |

---

## Permission revocation (this is the part most apps skip)

Every signed-in user can, from the in-app account panel (`#account`):

- **List active sessions** with device label and last-used time
- **Sign out (this device)**
- **Sign out everywhere** — revokes every session and burns every unused magic link tied to the email
- **Export my data** (`/auth/export`, GDPR Art.20 / PIPA §35, JSON download)
- **Delete my account** (`/auth/delete`, GDPR Art.17 / PIPA §36 — hard delete with hashed tombstone)
- **Toggle consent categories** — analytics, marketing, AI rewrite, functional. Each change is logged server-side (`/auth/consent`) so the lawful basis is auditable.

Schema: `schema/sessions.sql` (sessions, consent_log, deletion_log).
Worker routes: `/auth/sessions`, `/auth/signout`, `/auth/signout-all`, `/auth/export`, `/auth/delete`, `/auth/consent`.
Client API: `window.SAUDADE_AUTH.{ signOut, exportData, deleteAccount, listSessions, logConsent }` and the panel at `window.SAUDADE_ACCOUNT.openPanel()`.

---

## Content licensing — read this before importing anything

`saudade` ships with editorial obligations the average web app does not have. See [`CONTENT-LICENSE.md`](./CONTENT-LICENSE.md) for the rules. Short version:

| Asset | Allowed | Not allowed |
|---|---|---|
| **Café reviews** | First-hand visits, UGC under our [Contributor License](./CONTENT-LICENSE.md#ugc) | Pasted Naver/Google Maps reviews |
| **Photos** | Editor's own + Unsplash/Pexels (with attribution where required) + UGC with explicit grant | Pinterest/Google image search |
| **ASMR / field recordings** | Editor's own + Freesound CC0/CC-BY + Epidemic Sound (paid) | YouTube rips, Spotify rips |
| **RSS sources** | Headline + ≤200-char summary + dated link to original | Republished body text |

Every AI-generated dispatch is labelled `AI-assisted` (EU AI Act compliance).

---

## Privacy / legal

- [`privacy.html`](./privacy.html) — PIPA + GDPR + CCPA/CPRA + LGPD + APPI summary
- [`terms.html`](./terms.html)
- [`SECURITY.md`](./SECURITY.md) — disclosure policy
- [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) — fonts, libraries, map tiles
- [`TRADEMARK-NOTES.md`](./TRADEMARK-NOTES.md)

---

## Roadmap

- [x] Multi-edition desk pipeline (Lisbon)
- [x] Atlas — Seoul cafés (110)
- [x] Magic-link auth + tour mode
- [x] Permission revocation (this branch)
- [ ] Bundler (24 modules → 4)
- [ ] Schengen 90/180 auto-calculator (input passport stamps → remaining days)
- [ ] Native field-recording library per city (R2)
- [ ] Quarterly PDF/EPUB issue
- [ ] RSS/Atom feed of Dispatches
- [ ] Stripe Pro tier ($8/mo) — issue archive + alerts

---

## License

Source: see [`LICENSE`](./LICENSE).
Editorial content: see [`CONTENT-LICENSE.md`](./CONTENT-LICENSE.md).
The word *saudade* is a common Portuguese word and is not claimed as a trademark for the language meaning. The wordmark and logo are © 2026 LEEJAEJIN.
