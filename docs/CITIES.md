# Cities — where they live, and why there are four lists

When adding a new city, you may need to touch up to four files. They look like
duplicates but each has a distinct role. **Do not consolidate** without
understanding why they differ.

| File | Var | Shape | Purpose |
|---|---|---|---|
| `data/city-definitions.json` | `cities` | `{ Slug: { lat, lng, adjacent, names } }` | UI-facing pool. Drives home-city picker, atlas, dispatches "follow" list. The user-visible source of truth. |
| `saudade-cover.js` | `COVER_COPY` | `{ Slug: { noun, ko } }` | Editorial lede copy ("Lisbon — Tile."). Hand-curated; not all cities have one. |
| `saudade-personal.js` | `CITIES` | `{ Slug: { … } }` | Sentence templates for the empathy block ("641 days since Seoul…"). Editorial. |
| `cloudflare-worker.js` | `PIPELINE_CITIES` | `['Slug', …]` | Cities the daily cron pipeline targets. May lead `data/` (pipeline writes ahead of UI). |
| `saudade-ai-pipeline.js` | `CITY_POOL_SLUGS` | `['slug-dashed', …]` | Cities the AI rota stocks. Lowercase-dashed convention (matches `dispatches.json` keys). |

**Naming**: UI dictionaries use Title Case slugs (`Lisbon`, `Mexico City`); the
AI pipeline uses lowercase-dashed (`mexico-city`). Translate when crossing.

## Adding a new city

Minimum (UI only):
1. Add an entry to `data/city-definitions.json` (`cities.<Slug>`).
2. Optionally add COVER_COPY and CITIES sentence templates if you want this
   city to appear on the cover lede or empathy block.

To make it a daily-pipeline target as well:
3. Add slug to `PIPELINE_CITIES` (worker).
4. Add lowercase-dashed slug to `CITY_POOL_SLUGS` (ai-pipeline).

## Why four lists

Different intents — the lists do not need to match:
- A city can exist in the UI before the pipeline writes for it (most common —
  user picks Madrid, gets "On the wire" until pipeline is wired up there).
- The pipeline can stock a city the user can't pick yet (rotation experiments).
- Cover lede curation is pure editorial — adding a slug to the JSON does not
  oblige writing a `Lisbon — Tile.` line.
