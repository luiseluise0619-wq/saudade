---
title: Atom feed is the last good protocol on the internet
slug: atom-feed-last-good-protocol
date: 2026-05-04
edition: en
tags: [atom, rss, feeds, web-standards, slow-web]
canonical: https://saudade.app/blog/atom-feed-last-good-protocol
description: 144 lines of XML. No tracking. No algorithm. No paywall. The reader chooses when to read. Twenty years on, Atom is still the only honest publishing protocol the web has.
---

# Atom feed is the last good protocol on the internet

There is one button on saudade I am proud of in a way I am not proud of any of the rest.

It's in the `<head>` of the cover. It says:

```html
<link rel="alternate" type="application/atom+xml"
      title="saudade — dispatches (en)"
      href="/feed.atom?edition=en" />
```

That five-line invisible link is the most dignified thing the website does.

## What an Atom feed is

If you grew up on RSS readers in the 2000s, skip this section. If you didn't, here's the brief.

Atom is an XML format published in 2005 (RFC 4287). It contains a list of articles. Each article has a title, a link, a date, an optional summary, and an optional body. A feed reader — a separate piece of software — fetches the file at intervals, parses it, and shows you the new articles.

That's it.

The reader is yours. The reader can be Feedly, NetNewsWire, NewsBlur, NetVibes, FreshRSS on a Raspberry Pi in your kitchen, a 200-line Python script you wrote on a Saturday. The reader doesn't care which feed it's reading. The feed doesn't care which reader is reading it.

This is the one part of the web where the Berners-Lee future actually arrived.

## What an Atom feed is *not*

It is not a newsletter. The publisher does not have your email.

It is not a notification. There's no push, no badge, no red dot.

It is not algorithmic. The reader gets articles in publication order. There is no "for you" tab.

It is not paywalled. You cannot lock an Atom feed; the URL either resolves or it doesn't.

It is not surveilled. There are no tracking pixels in `application/atom+xml`. The publisher knows the reader fetched the file. They do not know which articles the reader read, how long the reader spent on each, what the reader scrolled past.

## What's been lost

Twenty years ago, every blog had a feed. Every newspaper had a feed. Wikipedia, GitHub, BBC, the *New York Times* — feed, feed, feed, feed.

Today, the *New York Times* still has a feed and they bury the link. Twitter's feed was removed in 2013. Instagram never had one. Substack has a feed but the writers it pays the most have been quietly opted out by default. Most "blogs" hosted on Medium since 2020 have no feed for individual authors.

The reason is the same in every case: a feed reader is a customer the publisher cannot monetise. A feed reader doesn't see your ads. A feed reader doesn't see your "subscribe to our newsletter" pop-up. A feed reader doesn't see your three-paragraph teaser before the paywall. A feed reader is a person who wants to read your writing and *only* your writing.

The feed reader was an existential threat to the modern publishing business model, so the modern publishing business model removed it.

## What I do anyway

The saudade worker has one route called `/feed.atom`. It accepts an `edition` parameter (`en`, `ko`, `ja`, `pt`, `es`) and returns the last 30 published dispatches as an Atom 1.0 file.

The whole function is 90 lines of JavaScript. It looks like this, abbreviated:

```js
async function feedAtom(req, env, ctx) {
    const edition = (url.searchParams.get('edition') || 'en');
    const items = await env.SAUDADE_DB.prepare(
        `SELECT s.headline, s.lede, s.body, s.source_url, s.published_at, r.city, s.id
         FROM dispatches_staged s
         JOIN raw_feeds r ON s.raw_feed_id = r.id
         WHERE s.edition = ? AND s.status = 'published'
         ORDER BY s.published_at DESC LIMIT ?`
    ).bind(edition, 30).all();

    const entries = items.results.map(it => `
        <entry>
          <title>${escXml(it.headline)}</title>
          <id>${escXml(self + '#' + it.id)}</id>
          <updated>${new Date(it.published_at).toISOString()}</updated>
          <link rel="alternate" href="${escXml(it.source_url)}"/>
          <category term="ai-assisted"/>
          <summary>${escXml(it.lede)}</summary>
          <content type="text">${escXml(it.body)}</content>
        </entry>
    `).join('');

    return atomXml(entries);
}
```

It's cached for 30 minutes at the edge. It costs roughly nothing to serve. It will work on a feed reader released in 2008 and a feed reader released last week.

## What's in the feed that isn't on the cover

A few things, deliberately.

**`<category term="ai-assisted"/>`** on every entry. This is the [EU AI Act §50](https://artificialintelligenceact.eu/article/50/) machine-readable disclosure. A feed reader that wanted to filter out AI-assisted content for its user could do it on this term.

**`<rights>` block** at the feed level. Atom doesn't require it; I include it. The text says the same thing my [content licence](https://saudade.app/CONTENT-LICENSE.md) does: ≤200-character quotes per source. A reader replacing my full text with their own ad-supported scraper would be visibly violating the rights notice.

**No tracking pixel.** Mainstream "RSS to email" services frequently inject `<img>` tags into feed body text to track open rates. Mine has none. The feed reader fetches; I don't know who.

## What feeds are good for

If you read writers across continents and time zones, a feed reader is the right tool. It catches everyone. The writer in Berlin who posts twice a year, the writer in Lagos who posts twice a week, the writer in Lisbon who files three city items six days a week, all sit in the same inbox in chronological order. You miss nothing. You see no ads. You scroll back as far as the writer's archive goes.

If you read this kind of writing exclusively in your email or your Twitter timeline, you are choosing — perhaps unknowingly — to read the writers your inbox or your timeline thinks will engage you. Those writers are different from the writers you would actually choose if asked.

## Try it

The saudade Atom feeds are at:

- `https://saudade.app/feed.atom?edition=en`
- `https://saudade.app/feed.atom?edition=ko`
- `https://saudade.app/feed.atom?edition=ja`
- `https://saudade.app/feed.atom?edition=pt`
- `https://saudade.app/feed.atom?edition=es`

If you don't have a feed reader, try [NetNewsWire](https://netnewswire.com/) (free, Mac/iOS), [Feedly](https://feedly.com/) (free tier, every platform), or [FreshRSS](https://freshrss.org/) (self-hosted). I use NetNewsWire in the morning and FreshRSS on a server I set up in 2019 that has not gone down since.

— LEEJAEJIN, *Lisbon desk · May 2026*
