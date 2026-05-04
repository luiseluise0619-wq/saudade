---
title: How I built a Schengen 90/180 calculator in a weekend
slug: schengen-calculator-weekend
date: 2026-05-04
edition: en
tags: [schengen, digital-nomad, javascript, side-project]
canonical: https://saudade.app/blog/schengen-calculator-weekend
description: A Saturday morning in Lisbon, a passport with too many stamps, and 240 lines of JavaScript that count days the way an Italian customs officer counts them.
---

# How I built a Schengen 90/180 calculator in a weekend

A Saturday morning in Lisbon, a passport with too many stamps, and the cold realisation that I might be illegally inside the Schengen Area on Tuesday.

I had used three different free Schengen calculators that month. One disagreed with the next by a week. The third refused to load on a French train. None of them — and I mean *none* — handled the case where the trip you're currently inside has no exit date yet, which, if you think about it, is the only case any *traveller* actually cares about.

So I closed the tabs, opened a blank file, and wrote this:

```js
function expandStays(stays, ref) {
    const set = new Set();
    for (const s of stays) {
        const a = parseDate(s.in);
        const b = parseDate(s.out) || ref;
        for (let d = new Date(a); d <= b; d = nextDay(d)) {
            set.add(format(d));
        }
    }
    return set;
}
```

Forty-three minutes later it printed a number. Three weeks later it printed the right number on every test case I could throw at it.

## What "Schengen 90/180" actually means

The rule is small and the rule is mean. **In any rolling 180-day window, you may not spend more than 90 days inside Schengen.** Not 90 days per year. Not 90 days per visit. Not 90 days from the last exit. *In any rolling window.*

That last word is what every napkin-arithmetic version of this rule gets wrong. Most travellers count "I went home in March, so my counter resets in March." It does not. The counter is not a counter. It's a moving 180-day camera looking backwards from today. If today is June 1, the camera sees December 4 to June 1. If today is June 2, it sees December 5 to June 2. December 4 falls off the back; June 2 enters from the front.

Which means: a day you spent in Berlin five months ago can stop costing you only when it falls off the camera.

## The parts every calculator gets wrong

I rewrote the function nine times before I trusted it. Here are the things that bit me.

**Endpoint inclusivity.** EU regulation 610/2013 Article 6(1) says both the day of entry and the day of exit count. Two of the three calculators I'd used quietly subtracted one. They were *quietly wrong*.

**The open stay.** The traveller is, by definition, currently somewhere. If the most recent stay has no `out` date, the calculator must assume `out = today`. Sounds obvious. Two of the three didn't.

**Single-day visits.** A day-trip to Aachen counts as one day, not zero. If you cross into Germany at 8am and leave at 10pm, your Schengen counter clicks once. The naive `(out - in)` returns zero for same-day stays. The right answer is `inclusive day count`.

**The next safe entry.** Once the user has used 90/90, the actually useful question is "when can I come back?" — which is the date the *first* day of the relevant stay rolls off the back of the camera. Most calculators say "you're at the cap" and stop. The user is in Vienna with a flight to Paris on Friday. They need a date.

## What 240 lines of code looks like

The whole thing fits in one file. No dependencies. Pure functions. If you can pass it `[{ in: '2026-01-01', out: '2026-03-31' }]` and a reference date, it returns:

```js
{
  used_in_window: 90,
  remaining: 0,
  currently_inside: false,
  next_safe_entry_after: '2026-06-30',
  days_until_full_reset: 179,
  timeline: [/* 180 entries, one per day */]
}
```

The `timeline` is the underrated bit. Once you have a per-day inside/outside array, you can do anything: render a sparkline, animate a clock, project forward, subtract a planned trip and see the effect.

## What I would have done differently

I'd have written the tests first. I write tests after, the way most people do, and three of them found bugs the original code shipped with — including, embarrassingly, an off-by-one on January 1.

I'd have skipped writing a UI for two more weeks. The calculation is the entire product. The UI is decoration. I built a beautiful italic Fraunces panel before I had the math right, and the panel made every wrong answer look authoritative.

I'd have checked CBP's day count too. The 90/180 logic generalises pleasantly to other rolling rules — UK Visitor 6/12, US ESTA-ish patterns, Japan 90-day. Same shape, different numbers. I left that on the floor.

## Where the calculator lives

It's part of [saudade](https://saudade.app), a slow newspaper for digital nomads. The whole code is in [saudade-schengen.js](https://github.com/luiseluise0619-wq/saudade/blob/main/saudade-schengen.js) — under a hundred lines if you ignore the rendering. The 24 unit tests are in [`test/calculators.test.js`](https://github.com/luiseluise0619-wq/saudade/blob/main/test/calculators.test.js).

Free, no sign-up, no tracking. If you cross-reference it with another calculator and find them disagreeing, write to me and I'll reconcile.

— LEEJAEJIN, *Lisbon desk · May 2026*
