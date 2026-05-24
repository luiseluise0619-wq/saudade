# Cafe coordinates — paths to the map

The 297 Gemini-verified cafes carry name / neighborhood / rating / Maps URL
but **no `lat` / `lng`**. The MAP view shows a notice card explaining
this and falls back to a paper-tone empty map.

Three paths to fill the gap, ordered by accuracy.

## Path A — Nominatim (free, OSM)

Best when you want zero cost and accept ~70-80% match rate.

```bash
# locally
node scripts/geocode-cafes.js --city seoul --dry-run
node scripts/geocode-cafes.js --city seoul
```

Or trigger the workflow:

```
Actions → Geocode cafes (Nominatim) → Run workflow
  city: seoul (or 'all')
  dry:  false
```

It opens a PR with `data/cafes-{city}.json` updates stamping `lat`, `lng`,
`geo_source='nominatim'`, `geo_at` on each match.

Rate limit: 1 req/sec (script sleeps 1100ms). 297 entries ≈ 6 minutes.

## Path B — Google Places API (New) (paid, accurate)

Best when you want coords + reviews + hours + website in one pass.

1. Cloud Console → APIs & Services → enable **Places API (New)**.
2. Credentials → create API key (HTTP referrer restricted is fine).
3. GitHub → Settings → Secrets and variables → Actions → new secret
   `GOOGLE_PLACES_KEY`.
4. Actions → **Verify cafes against Google Places** → Run workflow.

Cost: ~$0.034/cafe (Find Place + Details). 484 candidates ≈ $16.50.
Well under Google's $200/month free tier.

## Path C — manual

For the editor's own visits. Edit `data/cafes-{city}.json`, add `lat` /
`lng` from Google Maps (right-click → "What's here"), and stamp
`visited_at` to flip the row to JADE status.

## What renders when

| Cafe field      | LIST row                          | MAP marker                |
|-----------------|-----------------------------------|---------------------------|
| `rating`        | shown as ★ in meta                | shown in popup            |
| `city`          | shown as chip                     | tooltip                   |
| `google_url`    | shown as ↗ MAPS link              | popup link                |
| `visited_at`    | status = JADE (filled marker)     | jade marker               |
| `lat` / `lng`   | not used                          | required to render marker |
| `geo_source`    | not shown (provenance metadata)   | not shown                 |

## Constitution

§3 — every coord must have a provenance. `geo_source` field records it:
`nominatim`, `google-places`, or `editor-pin` (manual).
We never fabricate coordinates. Entries that cannot be geocoded stay
in the LIST view and are excluded from the map until a better source
is wired.
