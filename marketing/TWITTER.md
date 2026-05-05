# Twitter / X — DM templates and launch thread

Three influencer DMs. One launch thread. Avoid sounding like a cold-email template.
A nomad influencer's DMs are 90% spam; the way to be the 10% is to write specific, short, and self-aware.

---

## DM templates — three audiences

### Audience A — established digital-nomad creator (50k+ followers)

> @PieterLevels-tier — Pieter himself, [Iva](https://twitter.com/iva), [Olive](https://twitter.com/olivemoneylife), [Jensen](https://twitter.com/JensenNomadic), [Lauren](https://twitter.com/LSearle).
>
> They get pitched constantly. Lead with what's specific to them.

```
hey {{firstName}} — long-time reader. saw your {{specific recent post}}
and it nudged me to send this.

I built a free Schengen 90/180 + tax-residency 183 + insurance gap +
pension counter, all in one page. saudade.app/#demo loads it populated
with a sample year so you can see what it looks like in 5 seconds.

three things about it I think your audience would actually like:
1. the open-stay case is handled — most calculators break when "out"
   is empty
2. UK/AU/IN tax-year overrides for the 183 counter
3. account deletion is hard delete in 0.3 seconds, not soft delete

no signup, 5 languages, pure localStorage — visa data never leaves
the device.

not asking for a tweet. if you find it useful and it crosses your mind
naturally, that's enough. if you spot a calculation bug, write back
and I'll fix it before the next post.

— LEEJAEJIN, Lisbon desk
```

### Audience B — mid-tier nomad creator (5–50k followers)

> Less crowded inboxes. Slightly warmer. Mid-tier creators reply to
> 30% of DMs vs 5% for top-tier.

```
hi {{firstName}},

I read {{specific post or thread}} last week and it stuck with me.

I'm in Lisbon and I built a small thing that solves my own annoying
nomad calendar problem: a free Schengen 90/180 + tax-residency 183 +
insurance gap + pension counter on one page (saudade.app). no signup,
5 languages, source on GitHub.

would value 3 mins of your time on whether the user-facing copy on
the cover {{or specific page}} reads like something your audience
would share or like a startup screaming for attention. I'm trying to
strike a slow-newspaper voice and would rather catch the misfires
before launch than after.

if you've got time later this week — completely fine if not.

— LEEJAEJIN
```

### Audience C — peer maker / tech writer (any size)

> Way warmer. Peer-to-peer. They'll signal-boost if the work is good
> and they like the writing.

```
{{firstName}} — saw your post on {{specific topic}}. hi, I'm @leeluise.

shipped saudade today (saudade.app) — an editorial wrapper around four
nomad calendars (Schengen 90/180, tax 183, insurance gap, pension months).
Cloudflare Workers + D1, no tracking, atom feed, source on GitHub.

if you like the engineering or the typography I'd love your eyes for
30 seconds. a couple of bits I think are interesting:
- the personal-moments engine on the cover (italic sentences from
  localStorage data — "641 days since you last sat in a Seoul café")
- font-variation-settings driving Fraunces opsz from CSS
- /auth/delete that actually deletes in 300ms

not asking for a post. if you think it's worth your audience's time,
that's a bonus. if not, hope the writing is at least pleasant.

— LEEJAEJIN, Lisbon desk
```

### What to do with each DM

- **Send three a day, max.** Twitter/X penalises burst-DM behaviour.
- **Send to people you actually read.** Reference an actual specific recent post — not a generic compliment. The asymmetry of effort is the entire signal.
- **Don't follow up.** One DM. If there's no reply, that's the answer.
- **Don't ask for a quote tweet.** Ask for nothing. Mention the work
  as the pretext, not the ask.

---

## Launch thread — 5 tweets

To be posted the morning saudade goes live publicly, after Cloudflare
Pages is wired and before the Product Hunt launch.

**Tweet 1 (the hook)**

```
saudade is live. saudade.app

a slow newspaper for digital nomads — Schengen 90/180, tax-residency 183,
insurance gap, pension month counters, all in one page.

free. no signup. five languages. atom feed.

🧵 1/5
```

**Tweet 2 (the calculator angle)**

```
the four numbers a nomad watches every morning are the same four:
- how many days the visa permits
- how long since the last entry to a tax country
- when the health insurance pauses
- when the pension residency files

every existing tool does one of these. mine does all four. 24 unit tests.

2/5
```

**Tweet 3 (the editorial angle)**

```
I dressed the calculators up like a newspaper because the
"MAXIMISE / OPTIMISE / HACK" voice of nomad apps is exhausting in a
country whose public transport you don't yet understand.

saudade is portuguese for the longing carried for places you can't
return to. now also the masthead.

3/5
```

**Tweet 4 (the engineering brag, modest)**

```
under the hood:
- cloudflare workers + D1, no other services
- 24 unit tests on the calculators
- atom feed at /feed.atom (the last good protocol on the internet)
- account deletion in 0.3s, not soft-delete
- AI Act §50 disclosures machine-readable in every JSON

source on github.

4/5
```

**Tweet 5 (the call)**

```
open saudade.app/#demo to see it populated.

if you find a calculation wrong, write to me — I read every email
before the next dispatch.

— LEEJAEJIN, lisbon desk

5/5
```

### Optional follow-up tweets (one a day for the launch week)

- "the etymology of saudade is older than Portugal as a country. wrote
  about it: saudade.app/blog/saudade-word-origin"
- "the schengen 90/180 calculator inside saudade is 240 lines of
  javascript. wrote about every off-by-one that bit me:
  saudade.app/blog/schengen-calculator-weekend"
- "every dispatch in saudade carries a machine-readable AI Act §50
  disclosure. atom readers can filter on `<category term='ai-assisted'/>`.
  the EU AI Act is good actually."
- "deleted my own account on saudade today as part of QA. it took
  300ms and printed 'Goodbye'. then I signed up again. it didn't
  recognise me. that's correct."

---

## What to do during the launch

- **First two hours** — be on Twitter. Reply to every comment.
- **First day** — pin the thread. Quote-tweet anyone who shares it
  with a sincere thank-you (not a "thanks for sharing!").
- **First week** — one follow-up tweet per day from the optional list.
  Don't post the same launch thread twice.
- **Stop checking after midnight.** Twitter rewards burst presence then
  punishes burst replies.

---

## What success looks like

- **20–80 organic impressions per follower** (so a 1,000-follower
  account gets 20–80k impressions on the launch thread). This is the
  baseline a well-written launch hits.
- **3–10 quote tweets from peer makers**, each in their own audience.
  This is the actual viral mechanism.
- **30–80 click-throughs to saudade.app** in the first 24 hours.
- **Zero requests** from press in the first week. Press takes 2–6 weeks
  to notice and arrives via referrals from the quote-tweeters above.

If quote-tweets stay below 3, the launch is a soft pass. Re-launch with
a different angle in 2 months — typically the etymology or the engineering
post is the second-bite hook.
