# saudade · architecture

A one-page map for anyone (human or AI) about to add a feature.

## 1. Big picture

```
┌────────────────┐    ┌─────────────────┐    ┌──────────────────────┐
│ Cloudflare     │    │ Cloudflare      │    │ GitHub Actions       │
│ Pages          │◄──┤ Worker (D1+KV)  │    │ (cron + manual)      │
│ (static)       │    │ (auth + EN cron)│    │ (KO/JA/PT/ES cron)   │
└───────┬────────┘    └────────┬────────┘    └──────────┬───────────┘
        │                      │                        │
        ▼                      ▼                        ▼
   index.html         /dispatches/today           data/dispatches.*.json
   saudade-*.js       /auth/*  /cafe/*            data/cafes-seoul.json
   data/*.json        /admin   /pexels-quota      data/listening.json
   sw.js (PWA)
```

Three layers, three deploy targets, three responsibilities. **Don't blur them.**

## 2. Sections (§ 00 → § 05)

| § | DOM marker | Module | Data source |
|---|---|---|---|
| 00 | `body[data-section="00"]` | `saudade-cover.js` (+ rings, masthead) | `data/cover-titles.json` |
| 01 | `body[data-section="01"]` | `saudade-ledger.js` | localStorage (user input) + `data/city-definitions.json` |
| 02 | `body[data-section="02"]` | `saudade-atlas.js` (+ atlas-cafes, atlas-map, atlas-gps, atlas-walkring) | `data/cafes-seoul.json` |
| 03 | `body[data-section="03"]` | `saudade-dispatches.js` | `data/dispatches.{ed}.json` + `data/dispatches.week.json` |
| 04 | `body[data-section="04"]` | `saudade-desk.js` (+ following, switch-desk, desk-admin) | localStorage (Following) + worker `/dispatches/today` |
| 05 | (sub-page from cover) | `saudade-listening.js` | `data/listening.json` |

Each section is **self-contained**: one module owns its DOM tree, its CSS (injected `<style>`), and its data fetch. Adding a § 06 = new `saudade-newpage.js` + DOM marker + index.html `<script defer>` line + cache-buster `?v=v???`.

## 3. Data layer

```
data/
├── city-definitions.json        # ledger source (lat/lng/adjacent/names)
├── city-pool.json               # ledger drift candidates
├── cover-titles.json            # cover headlines per city + edition
├── dispatches.json              # § 03 EN — Worker D1 pipeline writes
├── dispatches.{ko,ja,pt,es}.json # § 03 native editions — refresh-dispatches.yml
├── dispatches.week.json         # § 03 archive — simulate-week.js
├── quarterly-dispatch.json      # § 03 quarterly issue
├── cafes-seoul.json             # § 02 — curated, MUST have lat/lng (see types.d.ts)
├── cafes-seoul.candidates.json  # § 02 worklist — search URLs only
├── cafe-vocabulary.json         # § 02 phrase pool
├── listening.json               # § 05 — cities[] + top-level tracks[]
├── listening-photos.json        # § 05 raw fetch dump (Pexels)
├── listening-tracks.json        # § 05 raw fetch dump (Freesound)
├── next-issues.json             # § 00 upcoming issues teaser
└── licenses/                    # one JSON per external asset (Pexels/Freesound)
```

**Schema rules**:
- New fields → `types.d.ts` first, then code, then data.
- Frontend uses `cache: 'force-cache'` everywhere → bump `sw.js` `CACHE_VERSION` AND every `?v=` in `index.html` after data changes. The smoke test (`test/smoke.js`) verifies these match.
- License sidecars (`data/licenses/*.json`) are required for any photo or audio used. `scripts/validate-content.js` enforces.

## 4. Module conventions

Every `saudade-*.js`:

```js
(function () {
    'use strict';
    if (window.SAUDADE_<NAME>) return;        // idempotency guard
    const ROOT = document;
    const T = (k) => /* i18n helper */ ;
    function injectStyles() { /* one-shot <style> append */ }
    function init() { injectStyles(); /* mount DOM, fetch data */ }
    document.addEventListener('DOMContentLoaded', init);
    window.SAUDADE_<NAME> = { /* public API for other modules */ };
})();
```

- **No bundler required.** Concatenation order in `scripts/build-bundle.js` is the single source of truth.
- **No external runtime deps.** `package.json` `dependencies` is intentionally empty. `devDependencies` (esbuild, eslint, typescript) are tooling only.
- **CSS lives next to the JS** that owns the DOM. Tokens come from `saudade-tokens.css` and `saudade-edition-tokens.css`.

## 5. Worker (`cloudflare-worker.js`)

Single 3,000-line file (acceptable for now; split planned). Routing is a `switch (path)` in the `fetch` handler. Cron is `switch (event.cron)` in `scheduled`.

| Cron (UTC) | Phase | What |
|---|---|---|
| `0 15 * * *` | Gather | RSS → `raw_feeds` |
| `0 17 * * *` | Sort + Score | Workers AI tags + scores feeds |
| `0 19 * * *` | Write | Gemini drafts EN → `dispatches_staged` |
| `0 20 * * *` | (decommissioned) | was Translate, now `{skipped:'decommissioned_v659'}` |
| `0 21 * * *` | File | Top 3 EN staged → published |

KO/JA/PT/ES are filed by `.github/workflows/refresh-dispatches.yml` (separate cron, not in worker).

## 6. Cache versioning

Three places must agree:

1. `sw.js` `const CACHE_VERSION = 'saudade-v???'`
2. `index.html` `<script src="…?v=v???">` (50 occurrences)
3. `data/listening.json` fetch in `saudade-listening.js` (manual cache-bust query)

`test/smoke.js` enforces #1 ↔ #2. Bump procedure: edit `sw.js`, run `sed -i 's/v=vOLD/v=vNEW/g' index.html`, run smoke test.

## 7. Build & deploy

```bash
npm run validate     # license + schema check
npm run test:all     # unit + smoke
npm run bundle       # optional — concatenate IIFEs into dist/bundle/
npm run deploy       # wrangler deploy (worker only — Pages auto-deploys on push)
```

`main` push → Cloudflare Pages auto-deploys static assets. Worker only redeploys on `wrangler deploy` from CLI or `saudade · build & validate` workflow (manual trigger).

## 8. Adding a feature — checklist

- [ ] New data shape? → `types.d.ts` first.
- [ ] New `saudade-foo.js` module? → follow the IIFE convention in §4.
- [ ] Reads a JSON? → cache it via `cache: 'force-cache'` and bump `CACHE_VERSION`.
- [ ] Renders DOM? → inject styles ONCE via `getElementById('sddXxxStyles')` guard.
- [ ] Fetches user data? → use the worker `/auth/*` endpoints, never localStorage for sensitive data.
- [ ] Adds external asset (photo/audio)? → write a license sidecar in `data/licenses/`.
- [ ] Multilingual? → add string to all five editions or use the i18n `T({en,ko,ja,pt,es})` pattern.
- [ ] Run `npm run validate && npm run test:all` before committing.
- [ ] Update this file if you changed the architecture.

## 9. What NOT to do

- Don't add to `saudade.core.js` (5k lines, splitting is on the roadmap).
- Don't hard-code city lists; read from `city-definitions.json`.
- Don't fabricate cafe entries (visited_at:null + lat/lng filled = constitutional violation, see PR #26 backstory).
- Don't translate — each edition is independently authored (see §5 row for `0 20 * * *`).
- Don't push to `main` directly; PR + squash-merge.
- Don't bypass the cache-buster sync (`test/smoke.js` will catch you).
