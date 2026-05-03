# Content License & Sourcing Policy

This document covers the **content** that appears in saudade — café reviews, photographs, ambient/field recordings, dispatch text, and contributor submissions. It complements [`LICENSE`](./LICENSE) (which covers the source code only).

If this document conflicts with `LICENSE`, this document controls for content.

Last revised: 2026-04-30. Operator: LEEJAEJIN.

---

## Why this exists

saudade republishes information drawn from official sources, accepts user submissions, and ships with photographs and audio. Each of those carries copyright, neighbouring rights, database rights, or moral rights — sometimes all four at once. This file lists the rules the editor and contributors must follow so the project never has to send a takedown apology.

---

## 1. Editorial dispatches (§03)

- **Sources** are limited to the Allowed list maintained at `data/rss-sources-seed.sql` and `docs/rss-sources.md`. Adding a source requires an entry there.
- **Length cap.** A dispatch quotes **≤ 200 characters** of original source text per item, and that quoted span is wrapped in `“…”` with the source name and date next to it.
- **Rewriting.** AI-assisted rewrites must extract facts and re-state them. Wholesale paraphrase of more than three consecutive sentences from a single source is forbidden.
- **Attribution.** Every dispatch carries `source`, `source_date`, and `source_url`. Removing these fields is a defect, not a style choice.
- **Retraction.** If a source files a complaint, the dispatch is retracted within 24 hours through `/dispatches/retract` (Bearer `EDITOR_TOKEN`). The retraction is logged in `editor_log`.
- **Reciprocity.** When another publication credits saudade, we credit them back in the next issue.

---

## 2. Photographs

| Source | Allowed | Conditions |
|---|---|---|
| Editor's own camera | yes | EXIF preserved or stripped at editor's choice |
| Contributor (UGC) | yes | only with the grant in §6 below |
| Unsplash / Pexels / Pixabay | yes | follow each platform's licence; photographer credit shown when required |
| `Wikimedia Commons` | case-by-case | check the file's specific licence (CC-BY-SA needs share-alike) |
| Carefully licensed paid stock (Getty, Adobe Stock, Shutterstock) | yes | only when an editorial-use licence has been purchased and the receipt is stored |
| AI-generated (Midjourney, Flux, Imagen) | discouraged | when used, label as `AI image` and confirm the platform's commercial-use clause |
| Pinterest, Google image search, screenshots from other apps, café SNS | **no** | always copyright-infringing by default |

People depicted in photographs taken in private spaces require their consent (right of publicity / 초상권). For street/public scenes, follow the laws of the city where the photo was taken.

---

## 3. Field recordings, music, ASMR (Listening Room)

| Source | Allowed | Conditions |
|---|---|---|
| Editor's own field recording | yes | preferred — this is the project's moat |
| Freesound (CC0 / CC-BY) | yes | attribution string stored in `data/listening.json.credits` |
| Epidemic Sound, Artlist, Soundstripe | yes | active subscription required, receipt stored |
| Public-domain music (verified, e.g. Musopen archive) | yes | jurisdictional check — public domain in some countries, not others |
| YouTube downloads, Spotify rips, SoundCloud rips, Apple Music | **no** | breaks platform ToS and copyright |
| Restaurants/cafés' background music | **no** | the venue does not own that recording |

Each track in `data/listening.json` MUST carry `license`, `license_url` (when applicable), and `attribution`.

---

## 4. Map tiles & geographic data

- The map ships © OpenStreetMap contributors under [ODbL](https://opendatacommons.org/licenses/odbl/). The attribution must remain visible on the map view.
- Café coordinates collected from public sources (carrier maps, the venue itself) are facts and not subject to copyright. The editorial commentary attached to each entry is.

---

## 5. Fonts

Listed in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). All fonts shipped are SIL OFL / Apache 2.0 / public-domain. Keeping their licence files inside the repository is mandatory.

---

## 6. Contributor License (UGC) {#ugc}

By submitting any text, photograph, audio recording, or other material to saudade — including but not limited to café entries, edits, weekly dispatch corrections, and listening-room submissions — the contributor:

1. **represents** that they hold all rights to the material, or that the material is in the public domain or under a compatible open licence;
2. **grants** to LEEJAEJIN a worldwide, non-exclusive, royalty-free, sublicensable, irrevocable licence to copy, modify, translate, distribute, and publicly display the material as part of saudade and its derivative editions (digital, print, podcast, RSS, archives);
3. **waives** moral rights to the extent permitted by their jurisdiction, except for the right to be credited (we will credit you by display name, never by full legal name unless requested);
4. **agrees** that we may remove or edit submissions for accuracy, length, or law.

A contributor may withdraw a submission by writing to <luiseluise0619@gmail.com>. Withdrawn submissions are removed from the live edition within 7 days; archived editions distributed before withdrawal cannot be recalled.

This licence does **not** transfer ownership. The contributor retains copyright.

---

## 7. AI-generated content disclosure (EU AI Act)

Every dispatch and translation produced with generative AI is labelled `AI-assisted` next to the source line. The model and pipeline step are recorded in `editor_log`. Where required by EU AI Act Art.50 (effective 2026), the disclosure is machine-readable in the dispatch JSON (`ai_assisted: true`, `ai_models: [...]`).

The Listening Room and editorial photographs are **not** AI-generated unless explicitly labelled.

---

## 8. Trademarks

- The word *saudade* is a common Portuguese noun. We do not, and cannot, claim a trademark over the word for its language meaning.
- The saudade **wordmark and logo** (typesetting, masthead lockup, italic ligature) are © 2026 LEEJAEJIN.
- Other trademarks (Cloudflare, Stripe, OpenStreetMap, etc.) belong to their respective owners and are used nominatively.

---

## 9. Reporting infringement / takedown

If you believe content on saudade infringes your rights:

- Email <luiseluise0619@gmail.com> with subject line `TAKEDOWN — <url>`.
- Include the URL, the work claimed, your relationship to the rights, and a statement of good-faith belief.
- We respond within 7 days; valid notices are honoured within 24 hours of acknowledgement.

DMCA agent designation will be filed once the operator establishes US presence.

---

## 10. Reuse of saudade content by others

Headlines and short quotations may be reused under fair-use / fair-dealing principles with attribution to `saudade` and a link back to the original dispatch. Wholesale republication of dispatch bodies, the Atlas dataset, or the photographs requires written permission.
