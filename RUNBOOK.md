# RUNBOOK · saudade

How to run the magazine day-to-day. Goes into the daily / weekly / monthly buckets so you can use it as a checklist without thinking.

If something is on fire, see the **Incident response** section at the bottom.

---

## One-time setup (before launch)

Do these once. Nothing below works until they are done. `npm run launch-check` prints what software can verify; this list is the human-only part.

### 1. Rotate the exposed Gemini key — **do this first**
A Gemini key was pasted into a chat during development and must be treated as compromised.
- Google Cloud Console → APIs & Services → Credentials → delete the old key, create a new one.
- Put the new value **only** in GitHub/Worker secrets (never in code or chat).

### 2. Worker secrets (`wrangler secret put <NAME>`)
| Secret | Powers | Notes |
|---|---|---|
| `GEMINI_KEY` | EN dispatch rewrite + review | the rotated key from step 1 |
| `RESEND_API_KEY` | sign-in email **and** Sunday digest | one key serves both (`RESEND_KEY` also accepted) |
| `EDITOR_TOKEN` | `/digest/send` + `/admin` auth | any 32+ char hex (`openssl rand -hex 32`) |
| `LICENSE_SIGNING_KEY` | (only if you re-enable paid tiers) | currently dormant |

**Never set `MAGIC_INLINE_OK`.** It exposes sign-in links in the HTTP response — localhost dev only. In production it is an account-takeover switch.

### 3. GitHub Actions secrets (Settings → Secrets → Actions)
| Secret | Powers |
|---|---|
| `GEMINI_KEY` | `Refresh per-edition dispatches` workflow (KO/JA/PT/ES) |
| `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | `D1 backup (daily)` workflow |
| `DIGEST_SEND_TOKEN` | `Sunday digest` workflow — same value as `EDITOR_TOKEN` |
| `PEXELS_KEY` + `FREESOUND_TOKEN` | `Fetch listening-room content` workflow |
| `KAKAO_KEY` *(optional)* | `Fetch Seoul cafes (Kakao)` — only if enriching café data |
| `GOOGLE_PLACES_KEY` *(optional)* | `Verify cafes against Google Places` — only if running that check |

### 4. D1 schema migrations (`wrangler d1 execute saudade_db --remote --file=<f>`)
Apply any not yet run — at minimum `schema/digest_subscribers.sql` (Sunday digest) and the auth/session/feed schemas in `schema/`.

### 5. Seed first content (run each workflow once)
- Actions → **Refresh per-edition dispatches** → Run → fills KO/JA/PT/ES (AI drafts + AI review gate, no human step).
- Actions → **Geocode cafes (Nominatim)** → `city: all` → adds map coordinates.
- Actions → **Fetch listening-room content** → fills the listening room (needs PEXELS/FREESOUND).
- Actions → **D1 backup (daily)** → Run once to seed the `backups` branch.

### 6. Decide two things (write them down)
- **Intent**: craft project / editorial business / venture. Every later trade-off depends on this.
- **Cadence**: §9.5 says daily. With the AI-files-AI-reviews pipeline this is now sustainable without daily human work — but confirm you're comfortable publishing AI-reviewed copy unattended (the disclosure says so honestly).

---

## Daily (5 minutes — optional)

### Dispatch publishing — now automatic

As of the AI-review-gate change, dispatches **file and review themselves**:
- KO/JA/PT/ES: the `0 21 UTC` cron drafts with Gemini, then a second Gemini pass copy-edits against the constitution (no politics/violence/scandal, declarative tone, no invented figures, quotes ≤25 words, right language/city/numerals). Anything that fails is **blocked** — the prior day's file stays. Clean drafts publish with `ai_reviewed: true`.
- EN: the Worker pipeline gathers → quietness-scores → forbidden-filters → rewrites → **re-reviews** before staging.

No daily human step is required. If you *want* to spot-check, open the dispatch PR and skim — but the gate already enforces the hard rules. Your time is better spent on the things AI can't do (café visits, the voice of the about/etymology pages).

### Lunch — café visit (3-5 times/week)

Pick one from `data/cafes-seoul.candidates.json`. Verify on the spot:

| Field | How to measure |
|---|---|
| `lat`/`lng` | Kakao Map → right-click → copy coordinates |
| `outlets` | Count power outlets visible from a typical seat |
| `wifi` | Run a speed test (target: ≥30 Mbps down) |
| `noise` | Use a SPL meter app on your phone, ~1 minute average |
| `quiet` | Conversation level — does it interrupt thinking? |
| `hours` | Glance at the door sign / Kakao listing |

Sit for ≥30 minutes before judging. Drink ≥1 cup. Don't list a café you only walked past.

### Evening — entry write + commit

```bash
# Edit data/cafes-seoul.json — add the new entry
# Remove the same id from data/cafes-seoul.candidates.json
npm run validate     # license + schema check
npm run bump-cache   # sw.js + index.html
git add data/cafes-seoul.json data/cafes-seoul.candidates.json sw.js index.html
git commit -m "content: add <name> (<neighborhood>)"
git push
```

Cloudflare Pages auto-deploys in ~30 seconds.

---

## Weekly (1 hour, Sunday or Monday morning)

### Pulse check

Open the worker `/admin` (your `EDITOR_TOKEN` from localStorage):

- [ ] `pipeline:last:0 19 * * *` — last EN write success?
- [ ] `pipeline:last:0 21 * * *` — last EN file (publish) success?
- [ ] D1 `SELECT COUNT(*) FROM dispatches_staged WHERE status='published' AND published_at > <last week>` — at least 6 publishes per edition

If any pipeline failure: see **Incident response** below.

### Marketing post

One channel per week, NOT a blast. Rotate:
- Week 1: Twitter/X thread (use `marketing/TWITTER.md`)
- Week 2: r/digitalnomad post (use `marketing/REDDIT.md`)
- Week 3: Instagram square (one cover image)
- Week 4: Brunch.co.kr essay (use `marketing/blog/`)

Track in #37: `[YYYY-MM-DD] <channel> · upvotes/likes · site visits · BMaC count`.

### Numbers check

Cloudflare Pages → Analytics. Plus your BMaC dashboard. Plus Stripe dashboard (after #38).

Target Sunday-to-Sunday delta:
- +20% unique visits month 1-3 (rough; very noisy)
- +1 paying customer per week month 3+
- 0 7-day-stale dispatches in any edition

If trend is flat for 3 weeks: revisit marketing channel mix (#37).

---

## Monthly

### CHANGELOG cut

Open `CHANGELOG.md` → move `[Unreleased]` items to a new dated section. Write 2-3 sentences summarising what shipped. Tag the repo:

```bash
git tag -a v1.X.0 -m "summary"
git push --tags
```

### Cache version house-keeping

If you've been bumping the cache constantly, the smoke test will keep passing — but the CHANGELOG becomes the single source of truth for "when did v674 ship".

### Subscription review (after #38)

Stripe dashboard → check churn, refunds, failed payments. Reach out to anyone who churned with one polite question email asking why. (Even if they don't reply, you'll learn from the 2-3 who do.)

---

## Quarterly

### Cron health audit

```bash
# Confirm both cron schedules are actually firing
wrangler tail --format=json | head -100
# Look for "scheduled" events at 21:00, 19:00, 17:00, 15:00 UTC
```

If a cron silently stopped: check Cloudflare Workers dashboard → Cron Triggers tab.

### Quarterly issue compile

`scripts/build-issue.js` produces a printable HTML of one quarter's dispatches. Run it, archive the output to `issues/YYYY-QN.html`, link it from `index.html` archive nav.

### Constitutional audit

Random-spot-check 5 entries each from:
- `data/cafes-seoul.json` — does each have a real `visited_at`? (constitution §3)
- `data/dispatches.<ed>.json` — does each have `ai_assisted: true` and a non-empty `ai_disclosure`?
- `data/licenses/*.json` — are sidecars 1:1 with the photos/audio in use?

If anything is fake: fix immediately. The trust dies on first lie.

---

## Incident response

### "Site is down"

1. Check https://www.cloudflarestatus.com first. If their fault, wait.
2. https://saudade.absbjj1230.workers.dev/health → expect `{"ok":true}`
3. `wrangler tail` → look for thrown errors in last 5 min
4. If recent deploy: `git log --oneline -5` and `wrangler rollback` if needed

### "Today's dispatch is empty"

1. Worker `/admin` → check `pipeline:last:0 19 * * *` → if `ok:false`, check `reason`
2. If `no_db` or `no_gemini`: re-confirm secrets are set
3. If a write failure: D1 `SELECT * FROM raw_feeds WHERE processed_at IS NULL ORDER BY id DESC LIMIT 12` → see if RSS gather actually pulled anything yesterday

### "Cron not firing"

1. Cloudflare dashboard → Workers → Cron Triggers → check timestamps of recent invocations
2. Free tier limit: 5 cron triggers per worker. We use 5; can't add a 6th without paid tier.
3. If silent for >24h: redeploy `wrangler deploy` (sometimes nudges scheduler)

### "GEMINI_KEY rate limited"

All Gemini callers use the `gemini-flash-lite-latest` alias (never a pinned version — a pinned model retiring silently broke the pipeline three times during development; a render-lint test now blocks re-pinning). Free-tier grounding/generation quota is still the real limit.
- Wait for the daily quota window to reset (UTC midnight), retry
- Or upgrade to paid tier (very cheap at our volume)
- The dispatch review gate doubles Gemini calls (draft + review); if quota is tight, `--no-review` skips the gate for a run (not recommended for unattended publishing)

### "Pexels / Freesound quota exhausted"

Free tiers: Pexels 200/hr, Freesound 60/min. The fetch-content workflow runs maybe once a week — you'll never hit these. If you do, wait until next hour.

### "Café data corrupted"

```bash
npm run validate     # which file failed?
git log --oneline -- data/cafes-seoul.json | head
git diff <last good commit> -- data/cafes-seoul.json
```

Last-resort: `git checkout <good sha> -- data/cafes-seoul.json`, re-add lost entries by hand.

---

## When to ask Claude (the AI agent) for help

Things Claude can do (no user action needed):
- Wire scripts after a fetch PR merges
- Cache version bumps
- Code refactors / cleanups
- Smoke + validate fixes
- Documentation updates
- New empty-state copy
- Minor bug fixes from screenshots

Things Claude **cannot** do:
- Trigger workflows (no MCP for `workflow_dispatch`)
- Add GitHub secrets
- Visit cafés
- Buy domains
- Pay for hosting
- Write content with your voice (it can draft; you must polish)

When in doubt, file an issue describing the problem; Claude can pick it up next session.