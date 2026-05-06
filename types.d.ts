// saudade · central type definitions
//
// JSDoc-importable in plain JS via:
//   /** @typedef {import('./types').Cafe} Cafe */
//
// Editing rules:
//   - Add new optional fields with `?:` so existing data validates.
//   - Required fields must exist on EVERY entry (not just new ones).
//   - When the schema changes, bump `data/SCHEMA-VERSION.txt` (a one-line
//     text file the validator can compare against).

// ─── editions ─────────────────────────────────────────────────────────
export type Edition = 'en' | 'ko' | 'ja' | 'pt' | 'es';

// ─── cafés (data/cafes-seoul.json + cafes-seoul.candidates.json) ────
// The MAIN file is `data/cafes-seoul.json` — every entry MUST have
// `lat`, `lng`, `two_lines`, and `amenities` filled (the magazine
// constitution: "we list only what we have visited").
//
// The CANDIDATES file is `data/cafes-seoul.candidates.json` — entries
// have `kakao_search_url` for editor verification, and lat/lng/two_lines/
// amenities are absent until the editor visits and promotes the entry.
export interface Cafe {
    id: string;                      // slug-form, unique across both files
    name: string;
    neighborhood: string;            // e.g. 'Yeonnam-dong', 'Anguk-dong'

    /** Required for cafes-seoul.json (map view); absent on candidates. */
    lat?: number;
    /** Required for cafes-seoul.json (map view); absent on candidates. */
    lng?: number;
    /** Distance in km from editor's home cafe — drives list ordering. */
    distance_km?: number;

    visited_at: string | null;       // ISO date or null

    /** Two short observations (≤ 36 chars each), monospaced display. */
    two_lines?: [string, string];
    /** Pipe-separated flags. Allowed values:
     *  OUTLET · WIFI · QUIET · NO_CALLS · 24H · CALLS_OK · NO_OUTLET */
    amenities?: string;

    /** Candidate-only — Kakao Maps search URL with neighborhood query. */
    kakao_search_url?: string;
    /** Candidate-only — Naver Maps search URL with neighborhood query. */
    naver_search_url?: string;
    /** Candidate-only — magazine-tone tags ('specialty','quiet','design'…). */
    tags?: string[];
    /** Candidate-only — set true when editor moves to cafes-seoul.json. */
    verified?: boolean;
    /** Candidate-only — 'candidate' | 'rejected'. */
    status?: string;
}

// ─── dispatches (data/dispatches.{en,ko,ja,pt,es}.json) ───────────────
// Each edition is independently authored — KO is NOT a translation of EN.
// EN is filed by Worker D1 pipeline. KO/JA/PT/ES are filed by the
// `refresh-dispatches` GitHub Actions workflow (Gemini-drafted).
export interface DispatchItem {
    n: string;                       // '01' | '02' | '03'
    headline: string;                // ≤ 18 words
    lede: string;                    // ≤ 22 words
    body?: string;                   // ≤ 60 words; optional in candidate state
    quote?: string;                  // ≤ 200 chars (CONTENT-LICENSE.md §1)
    source: string;                  // e.g. 'EU COUNCIL', 'saudade desk'
    source_date?: string;            // ISO date
    source_url?: string;             // canonical URL of the source
    ai_score?: number;               // 1-10, Worker pipeline output
}

export interface DispatchCity {
    city: string;                    // localised display name
    season?: string;                 // 'Spring' | 'Summer' | … (quarterly only)
    items: DispatchItem[];           // exactly 3 per city
}

export interface DispatchFile {
    edition: Edition;
    filed_at: string;                // ISO timestamp
    next_filing: string;             // ISO timestamp
    ai_assisted: boolean;
    ai_disclosure: string;
    cities: DispatchCity[];
}

// ─── listening room (data/listening.json) ────────────────────────────
export interface ListeningTrack {
    category: 'CAFE' | 'CITY' | 'NIGHT' | 'RAIN' | 'CUSTOM';
    /** City slug ('lisbon','tokyo',…). Frontend filter key. */
    city: string;
    title: string;
    duration_minutes: number;
    license: string;                 // 'CC0' | 'CC-BY' | …
    license_url: string;
    credits: string;
    /** Public URL — Pexels CDN, Freesound preview, or '/audio/asmr/<slug>.mp3'. */
    audio_url: string;
    source_url?: string;
}

export interface ListeningCity {
    slug: string;                    // 'lisbon','tokyo','seoul'…
    names: Partial<Record<Edition, string>>;
    /** Pexels CDN URL preferred — local /photos/cities/*.webp paths break. */
    default_photo_url: string | null;
    photo_credit?: string;
    photo_credit_url?: string;
    photo_source?: string;
    photo_source_url?: string;
    sounds?: ListeningTrack[];       // unused — see top-level tracks instead
}

export interface ListeningFile {
    library?: string;
    cities: ListeningCity[];
    /** All tracks, filtered per city by `t.city === activeSlug`. */
    tracks: ListeningTrack[];
}

// ─── ledger (data/city-definitions.json) ─────────────────────────────
export interface LedgerCity {
    lat: number;
    lng: number;
    /** Adjacent cities (used for Atlas walk-rings + Editor-on-leave). */
    adjacent: string[];
    names: Record<Edition, string>;
}

// ─── module global ────────────────────────────────────────────────────
declare global {
    interface Window {
        SAUDADE_EDITION?: { get: () => Edition; set: (ed: Edition) => void };
        SAUDADE_EMPTY?: { isEmpty: () => boolean };
        SAUDADE_ATLAS_MAP?: { getMap: () => any };
        AURA_SERVER?: string;        // worker base URL
    }
}

export {};
