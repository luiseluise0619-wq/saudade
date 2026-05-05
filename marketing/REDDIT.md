# Reddit — drafted posts

Three subreddits, three angles. Post on three different days. Don't crosspost; rewrite each.

Reddit hates self-promotion. Lead with the tool, not the launch. No "I built this!" titles.
The first 90 seconds of comments matter — keep notifications on, reply within five minutes.

---

## 1. r/digitalnomad — Tuesday morning

**Title:**
> Free Schengen 90/180 + tax 183 + insurance + pension counters in one page (no signup, no app store)

**Body:**

```
hey r/dn,

I'm a Lisbon-based remote engineer and I got tired of using three different
free Schengen calculators that disagreed by a week. So I wrote my own,
then added the three other counters I check every quarter (tax-residency
days, insurance windows, pension months).

It's at saudade.app. No signup, no email. Click #demo to see it populated
with a sample year of an Inês — Portugal Q1, Korea May, Bali summer with
a two-week insurance gap that the panel correctly flags.

Things I built into it that other free calculators don't:
- The open-stay case (you're currently inside, no exit date yet)
- Endpoint inclusivity per EU 610/2013 Art.6(1) — both entry and exit count
- "Next safe entry" date when you're at 90/90, not just "you're capped"
- UK / AU / IN tax-year overrides for the 183-day counter
- Insurance gaps shown as a list of [from → to, X days]

Feedback wanted on:
- Have I gotten any country's tax-year window wrong?
- Is the insurance "gap" model useful or am I solving the wrong problem?
- What other calendars do you check that aren't in here yet?

Source on GitHub. Eight Cloudflare Workers endpoints. localStorage for
the visa data — never sent to a server. The whole thing is "feel free to
delete in 0.3 seconds" by design (account panel → Danger Zone → DELETE).
```

**Why this works on r/dn:**
- Specific feature list, not a sales pitch
- Acknowledges the existing tools and what they get wrong
- Explicit feedback ask (the algorithm rewards questions)
- "No signup" + "localStorage" hits two pet peeves of the sub

**What to avoid:**
- Don't say "newspaper". Lead with calculator. Mention the editorial
  layer in comments only if someone asks.
- Don't say "Lisbon desk". Sounds like a brand, looks like marketing.
- Don't link your Twitter.

---

## 2. r/typography — Thursday afternoon

**Title:**
> Variable Fraunces + tabular nums + hanging punctuation — designing a digital newspaper that prints to PDF

**Body:**

```
Built a small editorial site recently and used it to figure out the
microtype I'd been meaning to learn for years. Putting the notes here
in case anyone else is going through the same.

The stack:
- Fraunces (variable, opsz 9..144 + SOFT 0..100) for serif
- JetBrains Mono (300/400/500) for data and labels
- One-rust accent (#9A3324), paper background (#F2EEE3)

The microtype CSS that mattered:

  font-feature-settings:
    'tnum' 1, 'zero' 1, 'calt' 1, 'ss02' 1
  for monospace tabular columns and slashed zero on data;

  font-feature-settings:
    'kern' 1, 'liga' 1, 'clig' 1, 'onum' 1, 'salt' 1
  for serif body — old-style figures inside running text;

  font-feature-settings:
    'kern' 1, 'liga' 1, 'dlig' 1, 'salt' 1
  for italic headlines (discretionary ligatures: st, ct, fi);

  text-wrap: balance for h1/h2/headlines;
  text-wrap: pretty for body p;
  hanging-punctuation: first last on blockquotes;
  hyphens: auto + hyphenate-limit-chars: 8 4 4;
  font-synthesis: none — never fake italic when the variable axis fails

The italic-period drop trick (newspaper convention — the period after an
italic headline sets upright):

  .punct { font-style: normal; margin-left: -0.04em; }

The bit I'm proudest of: the same CSS prints to A4 PDF cleanly. Built a
build-issue.js script that generates a single-file HTML from a JSON
dispatch and Cmd+P → Save As PDF gives you a real-feeling newspaper.

The site is saudade.app. Open the cover, then etymology.html for the
220px italic wordmark in context. Source on GitHub.

Curious what y'all use for variable opsz — I haven't seen many production
sites actually drive the axis from CSS. Most ship a single weight and call
it variable.
```

**Why this works on r/typography:**
- Concrete CSS, not vague design talk
- Names the specific properties + their values
- Acknowledges what's still rare (production opsz)
- The site link is at the bottom, framed as "the example"

**What to avoid:**
- Don't claim this is the best-typeset nomad app. r/typography roasts that.
- Don't post screenshots of just the cover; if you post images,
  include the @media print A4 PDF too.

---

## 3. r/webdev — Saturday afternoon

**Title:**
> Hard-deleting user accounts in 0.3 seconds (and a small argument against soft delete)

**Body:**

```
Built a small product where the "delete account" button actually deletes.
Eight DELETEs in a single batch, ~300ms in the worker. No flag, no
30-day cooldown, no anonymisation step that pretends to be deletion.

The endpoint:

  POST /auth/delete  body: { confirm: "DELETE", reason?: string }

  - sessions       DELETE WHERE user_id = ?
  - magic_tokens   DELETE WHERE email   = ?
  - consent_log    DELETE WHERE user_id = ?
  - cafe_submissions   DELETE WHERE user_email = ?
  - city_requests      DELETE WHERE user_email = ?
  - listening_log      DELETE WHERE user_id    = ?
  - user_following_cities DELETE WHERE user_id = ?
  - users          DELETE WHERE id = ?

  insert a hashed-only tombstone in deletion_log so a regulator can
  verify the request was honoured without recovering any PII

I want to make the case that soft-delete is, in 99% of cases, a polite
lie. Wrote it up here:
https://saudade.app/blog/delete-account-fast

Stack: Cloudflare Workers + D1. The whole worker file is on GitHub if
anyone wants to crib the SQL pattern. The cascade is best-effort across
non-FK tables (D1 doesn't enforce cross-table FKs the same as Postgres),
which is the one design wart I haven't been satisfied with.

Curious how others handle this. Specifically:
- What do you do about backups that contain the deleted row?
- Do you keep an analytics roll-up after the row is gone, and is that
  fair under GDPR Art.17?
- Anyone using D1 in production hit the FK-cascade gap and how did
  you solve it?
```

**Why this works on r/webdev:**
- Code first, marketing buried
- Genuinely open questions at the end
- Cloudflare Workers + D1 is a hot stack right now
- The blog link is the explainer, not the pitch

**What to avoid:**
- Don't title it "I built". The pattern title is fine.
- Don't mention "newspaper" or "nomad". Out of context here.
- Don't post the worker URL — link the blog post which links the source

---

## Other subreddits worth considering (smaller, do later)

- **r/SideProject** — once main launch is over, post with the title
  *"saudade — a newspaper that's actually four nomad calculators in disguise"*
  and link the Product Hunt launch. r/SideProject is polite and
  occasionally seeds Reddit/HN echoes.
- **r/expats** — focus on the tax-residency 183 angle.
  Title: *"Free 183-day calculator across 60+ countries (with GB/AU/IN
  tax-year overrides)"*. Don't post on r/digitalnomad and r/expats in the
  same week — too obvious.
- **r/programming** if and only if there's a HN frontpage for the
  Atom feed post. r/programming is hostile to bare promotion; only
  works as "here's an interesting technical decision" angle.

---

## What to do in the comments

The comments are the launch. The post is the entry ticket.

- **Reply within 5 minutes** to the first three comments. The Reddit
  algorithm uses early engagement velocity heavily.
- **Be a colleague, not a founder.** "Yeah, that's a good catch — I went
  back and forth on whether to count single-day stays as 1 or 0."
- **Acknowledge competitor tools by name.** "Visa Calculator dot com
  has the math right but the UX is from 2009; nomadlist's calendar
  doesn't compute the rolling 180-day window."
- **Don't shill in replies.** Reddit smells it. "Read the privacy
  policy, it explains" is fine. "BUY THE PRO TIER" is not.

When the post stops getting comments, stop. Don't bump.
