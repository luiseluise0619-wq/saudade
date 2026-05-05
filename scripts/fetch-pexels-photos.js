#!/usr/bin/env node
/**
 * saudade · fetch listening-room photos from Pexels.
 *
 * Pulls 3-5 photos per query (configurable) and writes:
 *   data/listening-photos.json    — id, src, photographer, photographer_url, alt
 *   data/licenses/pexels-<id>.json — sidecar so validate-content.js passes
 *
 * Pexels CDN URLs are durable: deep-linking is permitted by their guidelines
 * provided attribution stays visible. saudade-listening.js renders the
 * photographer credit in the photo caption.
 *
 * Usage:
 *   PEXELS_KEY=xxxx node scripts/fetch-pexels-photos.js
 *   PEXELS_KEY=xxxx node scripts/fetch-pexels-photos.js --queries "lisbon cafe,seoul cafe"
 *   PEXELS_KEY=xxxx node scripts/fetch-pexels-photos.js --per 5 --orientation landscape
 *
 * Rate limit: 200/hr free tier. Each query = 1 call. Default 8 queries → 8 calls.
 * Add `--dry` to print what would be saved without writing files.
 *
 * License: Pexels License (free, attribution appreciated, commercial OK).
 *   https://www.pexels.com/license/
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LIC  = path.join(DATA, 'licenses');

// Default queries cover the cities saudade actively serves. Each query ~3 pix.
// Edit freely — these are seed tones, not exhaustive.
const DEFAULT_QUERIES = [
    { city: 'Lisbon',  q: 'azulejo tile yellow window' },
    { city: 'Lisbon',  q: 'lisbon tram morning' },
    { city: 'Seoul',   q: 'hanok wooden door morning' },
    { city: 'Seoul',   q: 'seoul cafe ceramic teacup' },
    { city: 'Tokyo',   q: 'kissaten brass kettle wood' },
    { city: 'Tokyo',   q: 'tokyo rain street umbrella' },
    { city: 'Tbilisi', q: 'tbilisi balcony old town' },
    { city: 'Berlin',  q: 'berlin tile cafe morning' }
];

function parseArgs(argv) {
    const out = { per: 3, orientation: 'landscape', size: 'large', dry: false, queries: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--per') out.per = parseInt(argv[++i] || '3', 10);
        else if (a === '--orientation') out.orientation = argv[++i];
        else if (a === '--size') out.size = argv[++i];
        else if (a === '--dry') out.dry = true;
        else if (a === '--queries') {
            out.queries = (argv[++i] || '').split(',').map(s => ({ city: 'mixed', q: s.trim() }));
        }
    }
    return out;
}

async function searchPexels(key, query, opts) {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(opts.per));
    url.searchParams.set('orientation', opts.orientation);
    url.searchParams.set('size', opts.size);
    const res = await fetch(url.toString(), { headers: { Authorization: key } });
    if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
    return res.json();
}

function sidecarFor(p, query, city) {
    const id = String(p.id);
    return {
        track_or_image: 'image',
        id,
        title: p.alt || query,
        photographer: p.photographer,
        photographer_url: p.photographer_url,
        license: 'Pexels-License',
        license_url: 'https://www.pexels.com/license/',
        source: 'Pexels',
        source_url: p.url,
        city,
        captured: null,
        downloaded: new Date().toISOString().slice(0, 10),
        attribution_text: `Photo by ${p.photographer} on Pexels`
    };
}

async function main() {
    const key = process.env.PEXELS_KEY;
    if (!key) {
        console.error('Set PEXELS_KEY=<your Pexels API key>');
        console.error('Get one free at https://www.pexels.com/api/');
        process.exit(2);
    }
    const opts = parseArgs(process.argv.slice(2));
    const queries = opts.queries || DEFAULT_QUERIES;

    fs.mkdirSync(LIC, { recursive: true });

    const photos = [];
    for (const { city, q } of queries) {
        process.stderr.write(`[fetch] ${city.padEnd(10)} "${q}"… `);
        try {
            const r = await searchPexels(key, q, opts);
            const got = r.photos || [];
            for (const p of got) {
                photos.push({
                    id: String(p.id),
                    city,
                    query: q,
                    src: p.src.large2x || p.src.large || p.src.original,
                    src_small: p.src.medium,
                    width: p.width, height: p.height,
                    alt: p.alt || q,
                    photographer: p.photographer,
                    photographer_url: p.photographer_url,
                    pexels_url: p.url
                });
                if (!opts.dry) {
                    const sc = sidecarFor(p, q, city);
                    fs.writeFileSync(path.join(LIC, `pexels-${p.id}.json`),
                        JSON.stringify(sc, null, 2) + '\n');
                }
            }
            console.error(`${got.length} found`);
        } catch (e) {
            console.error('FAIL: ' + e.message);
        }
        // light pacing — Pexels free tier is 200/hr but be polite
        await new Promise(r => setTimeout(r, 300));
    }

    const out = {
        generated: new Date().toISOString().slice(0, 10),
        source: 'Pexels',
        license: 'Pexels-License',
        license_url: 'https://www.pexels.com/license/',
        attribution_required: true,
        photos
    };

    if (opts.dry) {
        console.log(JSON.stringify(out, null, 2));
        return;
    }
    fs.writeFileSync(path.join(DATA, 'listening-photos.json'),
        JSON.stringify(out, null, 2) + '\n');
    console.log(`\n[ok] ${photos.length} photo(s) → data/listening-photos.json`);
    console.log(`[ok] ${photos.length} sidecar(s) → data/licenses/pexels-*.json`);
    console.log(`     Review the photos via their Pexels URLs, edit listening-photos.json`);
    console.log(`     to keep only what you want, then run validate-content.js to check.`);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
