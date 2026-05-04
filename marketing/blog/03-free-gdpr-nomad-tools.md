---
title: Free GDPR-compliant tools for digital nomads
slug: free-gdpr-nomad-tools
date: 2026-05-04
edition: en
tags: [gdpr, privacy, digital-nomad, free-tools, ccpa, pipa]
canonical: https://saudade.app/blog/free-gdpr-nomad-tools
description: Most "free" digital nomad tools sell your visa data. The ones that don't are usually paid. Here are seven I trust, and the one I built to fix what was missing.
---

# Free GDPR-compliant tools for digital nomads

Most "free" digital nomad tools sell your visa data.

The ones that don't are usually paid. The ones that are both free *and* don't sell are usually broken, abandoned, or built by someone who has now joined a startup and made the URL redirect to it.

I have spent two years curating the small handful that survive. Here are seven, plus the one I had to build because none of them did this thing right.

## The criteria

Before the list, the standards. A tool earns a spot if and only if:

1. **Free without an account.** A signup gate is fine; a paywall is not, even if the gate "unlocks features" the basic version mysteriously can't show me.
2. **No tracking pixels on the auth path.** I check. I open devtools. Anyone who pings Google Tag Manager before I've consented to analytics is off the list.
3. **A real privacy policy.** Not a copy-pasted one. Specifically, it must answer: what data, what purpose, what retention, what rights, what supervisory authority. PIPA / GDPR / CCPA / LGPD / APPI cover most of the world's nomads; if a tool can't name three of those five it is, at minimum, unprofessional.
4. **A way to delete the account.** Not "email support" — a button, in the UI, that performs a cascade.

Five tools I trust meet all four. Two more meet three. One I built to fix the gap.

## Five that meet all four

**[Wise](https://wise.com)** for currency. Eight years in, multi-currency account, fully transparent fees, GDPR-compliant deletion. Yes there's a paywall on premium features. The free tier is not crippled.

**[Bookmarks.dev](https://bookmarks.dev)** for the unsorted pile of "I should look at this country" links. Open-source backend, no tracking, account deletion is one click.

**[Pretzelmail](https://pretzelmail.com)** alias service. ProtonMail or Fastmail are the heavyweight options; Pretzel is what I use for newsletters I'll regret. EU-hosted, deletion verified.

**[Cryptpad](https://cryptpad.org)** for collaborative drafts. Encrypted, French DPA-blessed, account deletion in three clicks. The interface is dated. The privacy posture is impeccable.

**[Standard Notes](https://standardnotes.com)** for the journal you keep across borders. End-to-end encrypted. Plaintext export. Nothing is ever locked behind a server you can't read.

## Two that meet three

**[Nomad List](https://nomadlist.com)** is the canonical city ranker. It has a clear privacy policy and lets you delete the account, but the auth path was loading three trackers last time I checked. Useful enough that I tolerate it; not so useful I'd recommend without the caveat.

**[SafetyWing](https://safetywing.com)** for nomad insurance. Strong policy, clear data practices, but the marketing site loads more than it should. The product itself is fine; you'll fill in your passport country and move on.

## What was missing

Three things kept tripping me up across all of these.

**Schengen 90/180.** Nomad List has a calendar but doesn't compute the rolling 180-day window. Wise doesn't try. Visa-Calculator-dot-com has the math but its UX is from 2009 and it ships analytics on the auth path.

**Tax residency 183-day across your countries.** Nobody does this in one screen for free. The closest is a personal-finance app that wants $9/month and your bank password.

**Health-insurance gap visualisation.** My SafetyWing policy ends. My Korean NHI doesn't begin for two weeks. *I am uninsured for those weeks.* I want a calendar that shows me. None of the providers do.

So I built one. It's called [saudade](https://saudade.app) and it does all four — Schengen, tax days, insurance gaps, pension months — in one §01 of a slow newspaper. Free. No signup needed to try it. If you sign up, the [account panel](https://saudade.app/#account) lets you export your data as JSON or hard-delete in 0.3 seconds.

## What I built into saudade specifically

To make sure it survives my own list above:

- **No tracking on the auth path.** Magic-link only, no analytics on the sign-in flow. Analytics on other pages, but only with explicit consent toggled in `#account` and logged server-side so the lawful basis is auditable.
- **A privacy policy in five languages.** Korean is authoritative under PIPA; English, Japanese, Portuguese, and Spanish are aligned with GDPR / APPI / LGPD / CCPA respectively. Each one names the right supervisory authority for that jurisdiction. [privacy.html](https://saudade.app/privacy.html).
- **`/auth/export` and `/auth/delete` endpoints.** The export is a single JSON file; the delete is a hard cascade across users, sessions, magic tokens, café submissions, listening log, and following list — with a hashed-only tombstone for audit. [Source](https://github.com/luiseluise0619-wq/saudade/blob/main/cloudflare-worker.js#L1339).
- **AI Act §50 disclosure.** Every dispatch declares `ai_assisted: true` machine-readably so external readers and aggregators can detect AI provenance. [Disclosure JSON](https://saudade.app/data/dispatches.json).
- **Visa data on-device.** Ledger entries (your visa, tax, insurance, pension records) live in `localStorage`. The server never sees them. Clear your browser, they vanish with you.

## What I cut

I removed analytics from the cover page entirely. Analytics on the cover doesn't help me make better decisions; it tells me how many people glanced at a homepage. I'd rather have ten readers I can email than 10,000 I can't recognise.

I also dropped the "Pro tier" plan from the launch. The Cloudflare Workers + D1 stack is cheap enough that even at meaningful MAU I can cover hosting from affiliate links to Wise / SafetyWing without putting anything behind a paywall.

## Try the calculator

If you've read this far, you're the audience.

Open [saudade.app/#demo](https://saudade.app/#demo) and the four calculators populate with a sample year of an Inês — Lisbon-based remote engineer, Q1 in Schengen, May in Seoul, summer in Bali, two-week insurance gap that my insurance counter correctly flags in red. Once you're done with the demo, `#demo-clear` wipes it.

If you find a bug or a wrong number, write to me. I read every email before the next dispatch is filed.

— LEEJAEJIN, *Lisbon desk · May 2026*
