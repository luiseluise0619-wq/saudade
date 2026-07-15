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

// city name → ALL photos for that city (배열, 랜덤 표시용). photos.json 순서 유지.
const allByCity = {};
for (const p of (photos.photos || [])) {
    if (!p.city) continue;
    (allByCity[p.city] = allByCity[p.city] || []).push(p);
}

let updated = 0;
let skipped = 0;
// Normalise NFD + strip diacritics so 'Medellín' (listening.json) matches
// 'Medellin' (Pexels query / response).
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
for (const c of (listen.cities || [])) {
    const enName = c.names?.en || c.slug || '';
    const key  = Object.keys(allByCity).find(k => norm(k) === norm(enName));
    const pool = key ? allByCity[key] : null;
    if (!pool || !pool.length) { skipped++; continue; }
    const first = pool[0];
    c.default_photo_url   = first.src;                  // 하위호환: 첫 장(랜덤 폴백용)
    c.photos              = pool.map(p => p.src);        // 랜덤 표시용 전체 URL 배열
    c.photo_credit        = `Photo by ${first.photographer} on Pexels`;
    c.photo_credit_url    = first.photographer_url;
    c.photo_source        = 'Pexels';
    c.photo_source_url    = first.pexels_url;
    updated++;
    console.log(`  ${c.slug.padEnd(15)} → ${pool.length} photo(s)`);
}

fs.writeFileSync(LISTEN, JSON.stringify(listen, null, 4) + '\n');

console.log(`\n[ok] ${updated} cit${updated===1?'y':'ies'} wired with Pexels photos`);
console.log(`[--] ${skipped} cit${skipped===1?'y':'ies'} kept existing placeholder (no matching Pexels photo)`);
console.log(`     Run 'Fetch listening-room content' workflow with custom queries`);
console.log(`     to fill those — see DEPLOY.md §6.`);
