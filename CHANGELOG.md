# Changelog

All notable changes to saudade. Format follows [Keep a Changelog](https://keepachangelog.com/) loosely; semver in spirit but not strictly enforced for the magazine content (which is the product).

Cache version (`saudade-vNNN`) bumps independently of semver — every JS/data change increments it.

## [Unreleased]

### Added
- `scripts/bump-cache.js` + `npm run bump-cache` — automates the cache-version sync across `sw.js`, `index.html` (50 cache-busters), and `saudade-listening.js`. Replaces the manual `sed` ritual that broke once already and motivated the smoke-test invariant.
- `RUNBOOK.md` — daily / weekly / monthly / quarterly operational checklist + incident response procedures. The runtime equivalent of `ARCHITECTURE.md`.
- GitHub issues #32-#38 (master + 6 sub-issues) — operational launch checklist tracking activation of GEMINI_KEY, listening-room fetch, domain decision, café curation, marketing, and Stripe.

### Fixed
- `saudade-dispatches.js`: hardcoded English `title="Remove"` on Following-cities chip routed through the `T()` i18n helper (en/ko/ja/pt/es). Caught by `scripts/check-i18n.sh`.

### Changed
- `DEPLOY.md`: `0 20 UTC` cron documented as decommissioned in v659; KO/JA/PT/ES refresh now points to `.github/workflows/refresh-dispatches.yml`. `GEMINI_KEY` description clarifies it serves EN write + the GH Actions writer.

## [1.2.0] · 2026-05-06

### Added
- **Per-edition dispatch writer** (`scripts/refresh-dispatches.js` + `.github/workflows/refresh-dispatches.yml`) — KO/JA/PT/ES are now independently authored via Gemini against per-edition city pools. Each edition speaks to its own audience; Korean is for Seoul/Busan/Jeju readers in 평어체, not a translation of EN.
- `types.d.ts` — central type definitions for Cafe, DispatchFile, ListeningTrack, ListeningCity, LedgerCity, Edition.
- `ARCHITECTURE.md` — module map, data flow, "adding a feature" checklist.
- `CLAUDE.md` — orientation for AI agents working in the repo.
- `data/cafes-seoul.candidates.json` — 133 Seoul café candidates with Kakao + Naver search URLs for editor verification. Replaces the 110 fabricated entries that violated constitution §3 ("we list only what we have visited").
- `.editorconfig`.
- Smoke test expanded from 4 → 65 invariants (data files, dispatches, constitution rule, SW precache list).

### Changed
- `data/cafes-seoul.json` wiped (was 110 fabricated entries with `visited_at:null` and made-up coordinates).
- 9 cities in `data/listening.json` had their broken `/photos/cities/*.webp` paths nulled — placeholder renders cleanly until proper Pexels fetch.
- 38 broken track entries in `data/listening.json` cleared (audio files don't exist; will be repopulated by Freesound fetch).
- `sw.js` cache version v656 → v658; `index.html` cache-busters synced.
- Worker cron `0 20 UTC` (Translate phase) decommissioned; admin `POST /admin {"phase":"translate"}` returns 410 Gone.
- README rewrites the section-§ table to reflect independent editions.

### Removed
- `saudade-ai-pipeline.js` (orphaned 474-line scaffold).
- Electron-era `package.json` entries: `electron`/`electron-builder` devDeps, `start`/`dev`/`build:win`/`build:mac`/`build:linux` scripts, the `build` config block, the `main: "main.js"` field.
- `tsconfig.json` references to ten files that don't exist in the tree.
- `.github/workflows/saudade.yml` references to non-existent `main.js` / `preload.js`.

### Fixed
- **Logo overlap on cover** — `.brand-stack` rendered both an SVG wordmark (via `saudade-wordmark.js`) and a CSS `::after { content: 'saudade' }` pseudo-element. Removed the legacy pseudo.
- **9-city listening photos** — workflow `fetch-pexels-photos.js` `DEFAULT_QUERIES` extended from 8 (5 cities) to 28 (all 14 cities × 2 queries each).
- **Music city tagging** — `fetch-freesound.js` `DEFAULT_QUERIES` extended from 9 (3 tagged cities + 4 untagged ambient) to 42 (14 cities × 3 categories), so the wire script can now route tracks to the correct `cities[].slug` filter.
- `wire-listening-photos.js` matches `Medellín` ↔ `Medellin` via NFD diacritic stripping.
- `index.html` cache-buster `?v=v657` → `?v=v658` across 50 occurrences (had drifted out of sync with `sw.js` `CACHE_VERSION` after PR #24).
- `test/smoke.js` repaired — was checking for Electron-era `app.js` / `main.js` / `preload.js`.

## [1.1.0] · prior

Pre-quality-pass state. Cache versions v50x – v657. See `git log` for details.
