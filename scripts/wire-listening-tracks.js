#!/usr/bin/env node
/**
 * saudade · wire-listening-tracks
 *
 * Merges the auto-fetched data/listening-tracks.json into data/listening.json,
 * REPLACING the top-level tracks array (which previously held 38 untagged
 * legacy entries pointing to non-existent /audio/asmr/*.mp3 files).
 *
 * - Normalises city names (Lisbon → lisbon) so saudade-listening.js's filter
 *   t.city === activeSlug matches the cities[].slug in listening.json.
 * - Preserves existing track shape required by the renderer (category, title,
 *   duration_minutes, license, license_url, credits, audio_url, source_url).
 *
 * Usage:  node scripts/wire-listening-tracks.js
 *
 * Re-run after each fetch-content workflow PR is merged to refresh the
 * track list. Idempotent.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TRACKS_IN = path.join(ROOT, 'data', 'listening-tracks.json');
const LISTEN    = path.join(ROOT, 'data', 'listening.json');

if (!fs.existsSync(TRACKS_IN)) {
    console.error(`Missing ${TRACKS_IN} — run fetch-freesound.js first.`);
    process.exit(2);
}

const fetched = JSON.parse(fs.readFileSync(TRACKS_IN, 'utf8'));
const listen  = JSON.parse(fs.readFileSync(LISTEN, 'utf8'));

const validSlugs = new Set((listen.cities || []).map(c => c.slug));

function citySlug(name) {
    if (!name) return null;
    const slug = String(name)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, '-');
    return validSlugs.has(slug) ? slug : null;
}

const wired = [];
let dropped = 0;
for (const t of (fetched.tracks || [])) {
    const slug = citySlug(t.city);
    if (!slug) { dropped++; continue; }
    wired.push({
        category: t.category || 'CAFE',
        city: slug,
        title: t.title,
        duration_minutes: t.duration_minutes || 0,
        license: t.license,
        license_url: t.license_url,
        credits: t.credits,
        audio_url: t.audio_url,
        source_url: t.source_url
    });
}

const beforeCount = (listen.tracks || []).length;
listen.tracks = wired;

fs.writeFileSync(LISTEN, JSON.stringify(listen, null, 2) + '\n');

const byCity = {};
for (const t of wired) byCity[t.city] = (byCity[t.city] || 0) + 1;

console.log(`[ok] tracks: ${beforeCount} → ${wired.length} (dropped ${dropped} with unmatched city)`);
console.log('\nBy city:');
for (const c of (listen.cities || [])) {
    const n = byCity[c.slug] || 0;
    console.log(`  ${c.slug.padEnd(15)} ${n}`);
}
