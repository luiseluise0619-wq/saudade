# DEPLOY — domain & launch checklist

Single-pass guide from "registered domain" to "press the Product Hunt button". No prior Cloudflare experience assumed.

Estimated time: **3–4 hours** end-to-end if everything cooperates.
Estimated cost: **$15–$25** in year one.

---

## 0. What you need before you start

- [ ] A debit card or PayPal for the domain
- [ ] A Cloudflare account (free)
- [ ] A Resend account for the magic-link emails (free, up to 3,000/month)
- [ ] A Stripe Connected Account *(skip — saudade has no paywall yet)*
- [ ] A working `git push` on the saudade repo

That's it. No hosting, no DNS, no certificate manager — Cloudflare bundles all three into the free tier.

---

## 1. Buy the domain — 10 minutes

```
Registrar:    Cloudflare Registrar (cheapest at-cost, no upsell)
Domain:       saudade.app
Year 1 cost:  $15.62 USD as of 2026 (.app TLD)
WHOIS:        privacy on by default (Cloudflare default)
```

Steps:
1. Go to dash.cloudflare.com → Domain Registration → Register Domains.
2. Search `saudade.app`. If taken, fall back to `saudade.email` ($23) or `saudade.bio` ($19).
3. Add to cart, pay, wait 5 minutes for propagation.
4. The domain auto-attaches to your Cloudflare account. No DNS migration needed.

---

## 2. Wire Cloudflare Pages — 30 minutes

Pages serves the static HTML/JS/CSS at the apex domain.

1. **Connect repo.** Cloudflare Pages → Create a Project → Connect to GitHub → pick `luiseluise0619-wq/saudade`.
2. **Build settings:**
   - **Framework preset:** None
   - **Build command:** `npm run bundle && npm run build:issue`
   - **Build output directory:** `/`
   - **Environment variables:** none for Pages
3. **Branch:** `main` for production, `claude/**` for previews.
4. **Custom domain:** Pages → Custom Domains → add `saudade.app` and `www.saudade.app`. Cloudflare provisions an SSL cert automatically (~3 minutes).
5. **Verify:** open `https://saudade.app`. The cover should load.

If the cover renders but the magic-link auth fails, that's expected — we haven't wired the worker yet.

---

## 3. Deploy the worker — 45 minutes

The worker is `cloudflare-worker.js`. It hosts every API endpoint (`/auth/*`, `/feed.atom`, `/dispatches/*`, `/cafe/submit`).

```bash
# install wrangler if you don't have it
npm i -g wrangler
wrangler login   # opens a browser, authorise

# create the D1 database (once)
wrangler d1 create saudade_db

# wrangler will print:
#   [[d1_databases]]
#   binding = "SAUDADE_DB"
#   database_name = "saudade_db"
#   database_id   = "xxxx-xxxx-xxxx"
# copy the database_id into wrangler.toml

# apply the schemas
wrangler d1 execute saudade_db --remote --file=schema/auth.sql
wrangler d1 execute saudade_db --remote --file=schema/sessions.sql
wrangler d1 execute saudade_db --remote --file=schema/cafe_submissions.sql
wrangler d1 execute saudade_db --remote --file=schema/city_requests.sql
wrangler d1 execute saudade_db --remote --file=schema/dispatch_retracts.sql
wrangler d1 execute saudade_db --remote --file=schema/editor_log.sql
wrangler d1 execute saudade_db --remote --file=schema/rss_sources.sql
wrangler d1 execute saudade_db --remote --file=schema/v8_following_sessions.sql
wrangler d1 execute saudade_db --remote --file=schema/ai_pipeline.sql

# secrets — set them once
wrangler secret put RESEND_KEY        # paste your Resend API key
wrangler secret put RESEND_FROM       # e.g. "Saudade <desk@saudade.app>"
wrangler secret put EDITOR_TOKEN      # 32-char random hex; you'll use it from the editor admin
wrangler secret put GEMINI_KEY        # for the AI rewrite step (optional for launch)

# deploy
wrangler deploy

# wrangler prints the worker URL, e.g.:
#   https://saudade-worker.<your-subdomain>.workers.dev
```

Take the worker URL and **route** it to your domain:

1. Cloudflare Dashboard → saudade.app → Workers Routes → Add route
2. Route pattern: `saudade.app/auth/*` — service: your worker
3. Add three more for `saudade.app/feed.*`, `saudade.app/dispatches/*`, `saudade.app/admin/*`
4. (Optional) Add `saudade.app/listening/*`, `saudade.app/cafe/*`, `saudade.app/following/*`

Now in `index.html`, set:
```html
<script>window.AURA_SERVER = 'https://saudade.app';</script>
```

(it's currently `https://saudade-worker.<placeholder>` — search and replace).

Push the change. Pages auto-redeploys in ~1 minute.

---

## 4. Set up Resend for magic links — 15 minutes

1. resend.com → Sign up (free, no card).
2. Add domain → `saudade.app`.
3. Resend prints 3 DNS records (SPF, DKIM, DMARC). Copy them.
4. Cloudflare → DNS → add the 3 records.
5. Wait 5 min for propagation. Resend "Verify domain" should turn green.
6. Create an API key → name "saudade-magic-link" → copy it.
7. Run `wrangler secret put RESEND_KEY` and paste.

The first sign-in email should now arrive within 5 seconds at `desk@saudade.app`.

---

## 5. Verify everything — 30 minutes

Open `https://saudade.app` and walk through:

- [ ] Cover loads, masthead reads "saudade"
- [ ] Welcome modal appears (one card, italic)
- [ ] Click into §01 Ledger, type a Schengen entry, the calculator updates live
- [ ] Click `#demo` URL — four panels populate with Inês's data
- [ ] Click `#account` (or sign-in flow), enter your email
- [ ] Magic link arrives at your inbox in <10s, click it, you're logged in
- [ ] Account panel shows the current session
- [ ] Click "Sign out everywhere", confirm the toast
- [ ] Sign in again, click "Export my data", verify JSON downloads
- [ ] Try `/feed.atom?edition=en` — XML loads
- [ ] Try the etymology page, sitemap, editor-on-leave page
- [ ] Mobile: open on a phone, the cover renders, the four-section nav is reachable

Common gotchas:

- **Magic link goes to spam.** Add SPF/DKIM if you haven't yet (Resend domain verification handles this).
- **Worker route 404.** Route patterns in Cloudflare are exact — `saudade.app/auth/*` matches but `saudade.app/auth` (no trailing path) doesn't. Add the bare path explicitly if needed.
- **D1 query fails.** Re-run the schema files; Cloudflare doesn't allow `IF NOT EXISTS` in some indexes — run idempotently.

---

## 6. SEO — 30 minutes

Before any launch, do these or you'll regret it:

- [ ] `robots.txt` → already exists. Check `Allow: /` and that crawl-delay isn't set.
- [ ] `sitemap.xml` → already exists. Confirm it lists every public page (cover, sections, etymology, sitemap, editor-on-leave, all 5 privacy pages, all 5 feed.atom URLs).
- [ ] `<meta description>` on every public page. Confirm cover, etymology, sitemap, blog posts all have one.
- [ ] Open Graph tags on cover (`og:image`, `og:title`, `og:description`).
- [ ] Submit `sitemap.xml` to Google Search Console (free, takes 5 min).

---

## 7. Pre-launch dry-run — 30 minutes

Don't post to Product Hunt or Reddit yet. Do this first:

- [ ] Send the saudade.app link to **3 friends** who fit the audience (one nomad, one designer, one engineer).
- [ ] Watch them open it for 90 seconds. Take notes.
- [ ] Three things they asked or got confused about → fix in next 24h.
- [ ] Re-deploy. Re-test.

**This is the single highest-leverage step in the entire launch.** Most launches fail because the founder's first user is a stranger. Make your first three users people you trust to be honest.

---

## 8. The launch sequence — 7 days

```
Day -2 (Sunday)    Send saudade.app to 3 trusted readers. Collect feedback.
Day -1 (Monday)    Post REDDIT.md draft on r/digitalnomad.
                   Reply to every comment. Note which feature draws questions.

Day 0  (Tuesday)   Product Hunt launch at 00:01 PT.
                   Post launch thread on Twitter at 09:00 local time.
                   DM three creators (TWITTER.md template A).
                   Be on Twitter all day.

Day 1  (Wednesday) Reply to remaining PH/Twitter comments.
                   Post REDDIT.md draft on r/typography.
                   Send DM to two more creators (template B).

Day 2  (Thursday)  Post the etymology blog post on Twitter, link to it
                   on the cover footer for one week.

Day 3  (Friday)    Post REDDIT.md draft on r/webdev.
                   Send DM to two more creators (template C).

Day 4–6 (Weekend)  Don't promote. Read every reply. Note the most common
                   feature request. Plan the v641 release for Monday.

Day 7  (Monday)    Ship one improvement based on the most common feedback.
                   Post about it ("v641 — added X because three of you
                   asked"). Tag the three.
```

---

## 9. Money — what to do about it

For the first 90 days, do nothing. Track:

- MAU (Cloudflare Pages analytics, free)
- Sign-ups (D1 query: `SELECT count(*) FROM users`)
- Atom feed subscribers (Cloudflare Pages → Analytics → page views on `/feed.atom`)

If MAU > 5,000 or sign-ups > 500 by day 90, write a 2-paragraph case for one of:

- **Affiliate links** (Wise, SafetyWing, Genki, etc.) → check the existing footer.
- **Pro tier** ($5/mo: cloud sync of calculator data, alerts, archive). Stripe Tax handles VAT/GST in 30+ countries; saudade ships GDPR/PIPA/CCPA-compliant from day one.

If MAU < 1,000 by day 90, the calculator angle isn't enough. Pivot to a tighter niche (Schengen-only? Korean tax residency only?) or a different surface (newsletter-only?). Don't ship a Pro tier on a small audience.

---

## 10. Things that will go wrong

- **Magic-link goes to Gmail spam.** Resolution: warm the domain by sending 5–10 manual emails from `desk@saudade.app` to friends in week 1.
- **The first viral comment will be uncharitable.** Resolution: reply once, briefly, in the saudade voice. Don't engage with bad faith.
- **A regulator emails you.** Resolution: read it carefully, reply in 7 days, link to the relevant privacy section. If genuinely uncertain, ask a lawyer (typical fee €200–€400 for a one-page response review).
- **A copycat appears within 4 weeks.** Resolution: ignore. The moat is the writing voice + the calculator math, neither of which they'll replicate quickly. Stay slow.

---

## Final pre-launch check

```
[ ] saudade.app loads HTTPS
[ ] /feed.atom?edition=en returns valid XML
[ ] /auth/request POST returns 200 with a magic link
[ ] /auth/verify GET with a valid token returns user + session
[ ] /auth/delete POST with confirm:"DELETE" actually deletes
[ ] privacy.html lists you as DPO with a real email
[ ] CONTENT-LICENSE.md is current
[ ] /sitemap.xml is reachable
[ ] /sitemap.html is reachable (human-readable)
[ ] mobile renders the cover at 360px width without horizontal scroll
[ ] Atom feed includes <category term="ai-assisted"/>
```

If all ten boxes are green, you're cleared for launch.

— LEEJAEJIN, *Lisbon desk*
