# CLAUDE.md — agent guide for the saudade codebase

If you're an AI agent reading this, this is the orientation. Read once, then start.

## What this is

`saudade` — a slow newspaper for digital nomads. Five editions, 14 cities, a Cloudflare Pages + Worker stack, ~25k lines of vanilla JS. Deployed at saudade.pages.dev (custom domain TBD).

## Read these first

1. **ARCHITECTURE.md** — module map, data flow, conventions. Single source of truth.
2. **types.d.ts** — every shared data shape. Add fields here BEFORE touching code.
3. **README.md** — user-facing description.
4. **DEPLOY.md** (root) — Cloudflare + GitHub setup steps.

## Constitution rules (non-negotiable)

These come from the magazine's editorial constitution and predate any code:

- **§3 — list only what we have visited.** Cafés must have `visited_at` + lat/lng + two_lines + amenities filled in `data/cafes-seoul.json`. Candidates without verification go to `data/cafes-seoul.candidates.json`.
- **§4 — no chains, no popular pairings as primary content.** Chains can appear in candidates but should not be promoted to the curated file.
- **§9.5 — daily 06:00 KST filing.** Dispatches refresh once a day per edition. The cron schedule is in `cloudflare-worker.js` (EN) and `.github/workflows/refresh-dispatches.yml` (KO/JA/PT/ES).
- **AI disclosure required.** Every `dispatches.{ed}.json` must have `ai_assisted: true` + an `ai_disclosure` string.

## Patterns that recur

- **Idempotent IIFE modules.** Every `saudade-*.js` is `(function(){ if (window.X) return; … })()`. Never break this — multiple loads must be safe.
- **Cache-buster sync.** When you edit any JS file in the repo root, bump `sw.js` `CACHE_VERSION` AND `index.html` `?v=v???` in lock-step. Smoke test enforces.
- **License sidecars.** Any photo from Pexels, audio from Freesound, place data from Kakao MUST have a `data/licenses/<source>-<id>.json` file. `scripts/validate-content.js` is the gate.
- **Independent editions.** KO is not a translation of EN. Each language file has different cities, different topics, different voice. See `scripts/refresh-dispatches.js`.

## Common tasks

### Add a new city to the listening room

1. Add the city to `data/listening.json` `cities[]` (slug, names, default_photo_url null).
2. Add 2 Pexels queries to `scripts/fetch-pexels-photos.js` `DEFAULT_QUERIES`.
3. Add 3 Freesound queries to `scripts/fetch-freesound.js` `DEFAULT_QUERIES`.
4. Trigger `Fetch listening-room content` workflow.
5. After the resulting PR merges, run `node scripts/wire-listening-photos.js && node scripts/wire-listening-tracks.js`.
6. Bump cache version (`sw.js` + `index.html`).

### Add a new language edition

1. Add slug to `Edition` type in `types.d.ts`.
2. Add config to `EDITION_CONFIG` in `scripts/refresh-dispatches.js` (cities, voice, examples).
3. Add city `names` entries in `data/city-definitions.json`.
4. Add edition switcher entry in `saudade-edition.js`.
5. Run the refresh workflow once with `--editions <new>` to seed the file.

### Add a new data file

1. Define the shape in `types.d.ts`.
2. Reference it from one module only (avoid cross-module data coupling).
3. Use `cache: 'force-cache'` for reads.
4. Add a validator block in `scripts/validate-content.js`.
5. Bump cache version.

### Refactor `saudade.core.js` or `cloudflare-worker.js`

Don't, unless the user explicitly asks. Both are large but working. Splitting them is on the roadmap as a coordinated effort with tests, not a drive-by.

## Pull request hygiene

- Branch off `main`. Use `claude/<short-name>` naming.
- Squash-merge.
- Run `npm run validate && npm run test:all` locally first.
- Body must include: what changed, why, test plan.
- Do not skip pre-commit hooks.

## When in doubt

- Read **ARCHITECTURE.md §8** (the "adding a feature" checklist).
- Run `git log --oneline -20` to understand recent direction.
- Open the file you're about to edit and read 50 lines around the change point — patterns are local.

## Things to NEVER do

- Push to `main` directly.
- Fabricate cafe / dispatch / listening data (constitution §3).
- Skip the cache-buster bump (smoke test will fail).
- Use `--no-verify` on commits.
- Create a `dispatches.<ed>.json` by translating another edition's file.
