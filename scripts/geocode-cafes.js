#!/usr/bin/env node
// scripts/geocode-cafes.js — fill missing lat/lng for verified cafes
//
// Source: Nominatim (OpenStreetMap). Free, no key, but strict usage policy:
//   - 1 request/second max (enforced here as 1100ms between requests)
//   - identifying User-Agent required
//   - bulk geocoding (>1k/day) discouraged — for one-off backfills only
//
// Strategy:
//   1. For each cafes-{city}.json, walk entries lacking lat/lng.
//   2. Query Nominatim with: "{name}, {neighborhood}, {city}" then "{address}".
//   3. Accept first result whose displayed locale matches the expected city
//      (loose contains check on display_name).
//   4. Stamp result.lat / result.lng + provenance (geo_source='nominatim',
//      geo_at=ISO date).
//   5. Sleep 1100ms between requests.
//   6. Write back. Items that fail to geocode are left untouched.
//
// Run:
//   node scripts/geocode-cafes.js                  # all cities
//   node scripts/geocode-cafes.js --city seoul     # one city
//   node scripts/geocode-cafes.js --dry-run        # don't write
//
// Constitution: §3 — coordinate provenance must be recorded. We never
// fabricate coords; if Nominatim has no match, the cafe stays without
// coords and is excluded from the map until a better source is wired.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CITIES = ['seoul', 'da-nang', 'bali', 'tokyo', 'lisbon'];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'saudade-magazine/1.0 (geocode-cafes; luiseluise0619@gmail.com)';
const SLEEP_MS = 1100;

// City display tokens — display_name from Nominatim must include one of these
// for us to accept a result (prevents picking same-name café in another city).
const CITY_TOKENS = {
    'seoul':   ['Seoul', '서울'],
    'da-nang': ['Da Nang', 'Đà Nẵng', 'Danang'],
    'bali':    ['Bali', 'Denpasar', 'Ubud', 'Canggu', 'Seminyak', 'Kuta'],
    'tokyo':   ['Tokyo', '東京'],
    'lisbon':  ['Lisbon', 'Lisboa']
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function nominatimQuery(q) {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=0`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } });
    if (!res.ok) {
        throw new Error(`Nominatim ${res.status} for "${q}"`);
    }
    return res.json();
}

function pickResult(results, citySlug) {
    if (!Array.isArray(results) || results.length === 0) return null;
    const tokens = CITY_TOKENS[citySlug] || [];
    for (const r of results) {
        const name = (r.display_name || '');
        if (tokens.some(t => name.includes(t))) {
            const lat = parseFloat(r.lat);
            const lon = parseFloat(r.lon);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                return { lat, lng: lon, display_name: name };
            }
        }
    }
    return null;
}

async function geocodeOne(cafe, citySlug) {
    const queries = [];
    if (cafe.name && cafe.neighborhood) {
        queries.push(`${cafe.name}, ${cafe.neighborhood}, ${cafe.city || citySlug}`);
    }
    if (cafe.name && cafe.address) {
        queries.push(`${cafe.name}, ${cafe.address}`);
    }
    if (cafe.address) {
        queries.push(cafe.address);
    }
    for (const q of queries) {
        try {
            const results = await nominatimQuery(q);
            const hit = pickResult(results, citySlug);
            if (hit) return hit;
        } catch (err) {
            console.warn(`  ! query failed: ${err.message}`);
        }
        await sleep(SLEEP_MS);
    }
    return null;
}

async function processCity(citySlug, opts) {
    const file = path.join(DATA_DIR, `cafes-${citySlug}.json`);
    if (!fs.existsSync(file)) {
        console.log(`[${citySlug}] no file, skip`);
        return { done: 0, miss: 0 };
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const arr = Array.isArray(raw) ? raw : (raw.cafes || raw.items || []);
    const wrapper = Array.isArray(raw) ? null : raw;

    let done = 0, miss = 0, skipped = 0;
    for (const c of arr) {
        if (typeof c.lat === 'number' && typeof c.lng === 'number') {
            skipped++;
            continue;
        }
        process.stdout.write(`  · ${c.name || '(no name)'} ... `);
        const hit = await geocodeOne(c, citySlug);
        if (hit) {
            c.lat = hit.lat;
            c.lng = hit.lng;
            c.geo_source = 'nominatim';
            c.geo_at = new Date().toISOString().slice(0, 10);
            done++;
            console.log(`OK (${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)})`);
        } else {
            miss++;
            console.log('miss');
        }
        await sleep(SLEEP_MS);
    }

    if (!opts.dryRun && done > 0) {
        const out = wrapper ? raw : arr;
        fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    }
    console.log(`[${citySlug}] +${done} geocoded, ${miss} miss, ${skipped} already had coords`);
    return { done, miss };
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const cityIdx = args.indexOf('--city');
    const onlyCity = cityIdx >= 0 ? args[cityIdx + 1] : null;

    const cities = onlyCity ? [onlyCity] : CITIES;
    let total = { done: 0, miss: 0 };
    for (const c of cities) {
        console.log(`\n=== ${c} ===`);
        const r = await processCity(c, { dryRun });
        total.done += r.done;
        total.miss += r.miss;
    }
    console.log(`\n[done] +${total.done} geocoded, ${total.miss} miss across ${cities.length} cities`);
    if (dryRun) console.log('(dry-run — no files written)');
}

main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
});
