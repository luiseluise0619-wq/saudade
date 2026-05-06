#!/usr/bin/env node
/**
 * saudade · wire-listening-photos
 *
 * Maps city → Pexels photo from data/listening-photos.json (auto-fetched seed)
 * into data/listening.json's cities[].default_photo_url. Picks the first photo
 * per city. Editor can swap to any other photo by hand later.
 *
 * Cities without a matching Pexels photo keep their existing local-path URL
 * (the /photos/cities/*.webp placeholder); saudade-listening.js falls back to
 * the "Awaiting photograph" placeholder via onerror="this.remove()".
 *
 * Usage:  node scripts/wire-listening-photos.js
 *
 * Re-run after each fetch-content workflow PR is merged to refresh the
 * mapping. Idempotent — picks the first photo for each city deterministically.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PHOTOS = path.join(ROOT, 'data', 'listening-photos.json');
const LISTEN = path.join(ROOT, 'data', 'listening.json');

if (!fs.existsSync(PHOTOS)) {
    console.error(`Missing ${PHOTOS} — run fetch-pexels-photos.js first.`);
    process.exit(2);
}

const photos = JSON.parse(fs.readFileSync(PHOTOS, 'utf8'));
const listen = JSON.parse(fs.readFileSync(LISTEN, 'utf8'));

// city name → first photo (deterministic on photos.json order)
const firstByCity = {};
for (const p of (photos.photos || [])) {
    if (!p.city || firstByCity[p.city]) continue;
    firstByCity[p.city] = p;
}

let updated = 0;
let skipped = 0;
for (const c of (listen.cities || [])) {
    // listening.json city slugs are lowercase-hyphenated; photos.json city is
    // the English name as Pexels saw it. Normalise on lowercase for the match.
    const enName = c.names?.en || c.slug || '';
    const match = Object.values(firstByCity).find(p =>
        p.city.toLowerCase() === enName.toLowerCase()
    );
    if (!match) { skipped++; continue; }
    c.default_photo_url   = match.src;          // Pexels CDN URL (durable)
    c.photo_credit        = `Photo by ${match.photographer} on Pexels`;
    c.photo_credit_url    = match.photographer_url;
    c.photo_source        = 'Pexels';
    c.photo_source_url    = match.pexels_url;
    updated++;
    console.log(`  ${c.slug.padEnd(15)} → ${match.alt?.slice(0, 60) || ''}…`);
}

fs.writeFileSync(LISTEN, JSON.stringify(listen, null, 4) + '\n');

console.log(`\n[ok] ${updated} cit${updated===1?'y':'ies'} wired with Pexels photos`);
console.log(`[--] ${skipped} cit${skipped===1?'y':'ies'} kept existing placeholder (no matching Pexels photo)`);
console.log(`     Run 'Fetch listening-room content' workflow with custom queries`);
console.log(`     to fill those — see DEPLOY.md §6.`);
