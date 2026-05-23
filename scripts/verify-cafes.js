#!/usr/bin/env node
/**
 * saudade · verify candidate cafes against Google Places API.
 *
 * Takes data/cafes-{city}.candidates.json, searches each entry on
 * Google Places (Find Place + Details), confirms it exists, captures
 * the REAL rating + lat/lng + formatted_address, and writes the verified
 * ones to data/cafes-{city}.json. Unverified entries stay in the
 * candidates file with verified:false so a follow-up run can retry.
 *
 * This is the gate the bulk CSV import never passes alone — if the
 * input data was fabricated, Google won't find the place and it
 * stays out of the published list.
 *
 * Usage:
 *   GOOGLE_PLACES_KEY=AIzaXXXX node scripts/verify-cafes.js seoul
 *   GOOGLE_PLACES_KEY=AIzaXXXX node scripts/verify-cafes.js da-nang
 *   GOOGLE_PLACES_KEY=AIzaXXXX node scripts/verify-cafes.js --all
 *
 * Get a key:
 *   https://console.cloud.google.com → enable "Places API (New)"
 *   → Credentials → Create API key. Free tier $200 / month (~11k req).
 *
 * Cost per cafe verified: ~2 requests (Find Place + Details) = $0.034.
 *   100 cafes = $3.40. 500 cafes = $17.
 *   First $200/month is free → ~5,800 cafes free.
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);
const SUPPORTED_CITIES = ['seoul', 'da-nang', 'bali', 'tokyo', 'lisbon'];

// Min rating to keep — Google ratings drift; user CSV said 4.7+ but
// Google may have lower numbers. We keep anything ≥ 4.2 as a buffer.
const MIN_RATING = 4.2;

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }

async function findPlace(query, key) {
    // Step 1: Find Place from Text — returns the most likely place_id
    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id,name,geometry,rating,formatted_address');
    url.searchParams.set('key', key);
    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`findPlace ${r.status}`);
    const data = await r.json();
    if (data.status !== 'OK' || !data.candidates?.length) return null;
    return data.candidates[0];
}

async function placeDetails(placeId, key) {
    // Step 2: Details — get rating + user_ratings_total + place URL
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'name,rating,user_ratings_total,formatted_address,geometry,url,business_status');
    url.searchParams.set('key', key);
    const r = await fetch(url.toString());
    if (!r.ok) throw new Error(`details ${r.status}`);
    const data = await r.json();
    if (data.status !== 'OK') return null;
    return data.result;
}

async function verifyCity(citySlug, key, opts = {}) {
    const candPath = path.join(ROOT, 'data', `cafes-${citySlug}.candidates.json`);
    const livePath = path.join(ROOT, 'data', `cafes-${citySlug}.json`);
    if (!fs.existsSync(candPath)) {
        console.error(`[skip] no candidates for ${citySlug}: ${candPath}`);
        return;
    }
    const cand = loadJson(candPath);
    const live = fs.existsSync(livePath) ? loadJson(livePath) : [];
    const liveMap = new Map((Array.isArray(live) ? live : []).map(c => [c.id, c]));

    let promoted = 0, dropped = 0, kept = 0, skipped = 0;
    process.stderr.write(`[${citySlug}] verifying ${cand.cafes.length}…\n`);

    for (const c of cand.cafes) {
        if (c.verified) { skipped++; continue; }
        const query = `${c.name} ${c.city} ${c.address}`.replace(/\s+/g, ' ').trim();
        try {
            const found = await findPlace(query, key);
            if (!found || !found.place_id) {
                process.stderr.write(`  ✗ not found: ${c.name}\n`);
                c.verified = false;
                c.verification_attempted = TODAY;
                kept++;
                continue;
            }
            const details = await placeDetails(found.place_id, key);
            await new Promise(r => setTimeout(r, 100));   // pace
            if (!details) { kept++; continue; }
            if (details.business_status && details.business_status !== 'OPERATIONAL') {
                process.stderr.write(`  ✗ ${details.business_status}: ${c.name}\n`);
                dropped++;
                continue;
            }
            const rating = details.rating || 0;
            if (rating < MIN_RATING) {
                process.stderr.write(`  ✗ rating ${rating} < ${MIN_RATING}: ${c.name}\n`);
                dropped++;
                continue;
            }
            // Build a clean entry for the live file
            const entry = {
                id: c.id,
                name: details.name || c.name,
                city: c.city,
                neighborhood: c.neighborhood,
                address: details.formatted_address || c.address,
                lat: details.geometry?.location?.lat || null,
                lng: details.geometry?.location?.lng || null,
                rating,
                user_ratings_total: details.user_ratings_total || 0,
                google_place_id: found.place_id,
                google_url: details.url || null,
                vetted_at: TODAY,
                visited_at: null,
                two_lines: c.two_lines,
                amenities: c.amenities,
                source: 'google-places-verified'
            };
            liveMap.set(entry.id, entry);
            promoted++;
            process.stderr.write(`  ✓ ${entry.name} (${rating}★, ${entry.user_ratings_total} reviews)\n`);
            if (opts.dry) continue;
        } catch (e) {
            process.stderr.write(`  ! error on ${c.name}: ${String(e).slice(0, 80)}\n`);
            kept++;
        }
    }

    // Write back
    if (!opts.dry) {
        const liveArr = Array.from(liveMap.values()).sort((a, b) => (b.rating || 0) - (a.rating || 0));
        saveJson(livePath, liveArr);
        // Update candidates: keep only the ones not yet promoted (still verified:false)
        const remaining = cand.cafes.filter(c => !c.verified && (!c.verification_attempted || c.verification_attempted !== TODAY ? true : true));
        // Mark which ones were tried today (so user can re-run later for failed ones)
        cand.cafes = remaining;
        cand.total = remaining.length;
        cand.last_verified = TODAY;
        saveJson(candPath, cand);
    }
    console.log(`[${citySlug}] promoted ${promoted}, dropped ${dropped} (closed/low-rating), kept ${kept} (not found), skipped ${skipped} (already verified)`);
}

async function main() {
    const key = (process.env.GOOGLE_PLACES_KEY || '').trim();
    if (!key) {
        console.error('Set GOOGLE_PLACES_KEY=<your Google Places API key>');
        console.error('Get one at: https://console.cloud.google.com → enable Places API (New)');
        process.exit(2);
    }
    const args = process.argv.slice(2);
    const dry = args.includes('--dry');
    const all = args.includes('--all');
    const cities = all ? SUPPORTED_CITIES : args.filter(a => SUPPORTED_CITIES.includes(a));
    if (!cities.length) {
        console.error(`Usage: node scripts/verify-cafes.js <city> [<city> …]   or  --all`);
        console.error(`Cities: ${SUPPORTED_CITIES.join(', ')}`);
        process.exit(2);
    }
    for (const c of cities) await verifyCity(c, key, { dry });
    console.log(`\n[done] Run 'node scripts/validate-content.js' to check, then commit.`);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
