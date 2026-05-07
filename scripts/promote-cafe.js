#!/usr/bin/env node
/**
 * saudade · promote a candidate café into the curated list.
 *
 * The candidate file (data/cafes-seoul.candidates.json) carries 100+
 * Seoul cafés as click-through worklist. This script takes one
 * candidate ID, prompts for the missing fields (lat / lng / two_lines /
 * amenities + visited_at OR vetted_at), writes a polished entry into
 * data/cafes-seoul.json, removes the candidate, runs validate, and
 * bumps the cache version.
 *
 * Constitution §3 (revised): "list only what the editor has read
 * carefully." Visited is preferred; vetted (review-based curation)
 * is accepted.
 *
 * Usage:
 *   node scripts/promote-cafe.js <candidate-id>
 *   node scripts/promote-cafe.js cafe-onion-anguk-anguk-dong
 *
 *   # Non-interactive (for batch / scripting):
 *   node scripts/promote-cafe.js <id> \
 *     --lat 37.5817 --lng 126.9846 \
 *     --line1 "Granite walls. 12 outlets visible." \
 *     --line2 "Stays open until 22:00." \
 *     --amenities "OUTLET · WIFI · QUIET" \
 *     --vetted   # or --visited <YYYY-MM-DD>
 */
'use strict';

const fs       = require('node:fs');
const path     = require('node:path');
const readline = require('node:readline/promises');

const ROOT       = path.resolve(__dirname, '..');
const CANDIDATES = path.join(ROOT, 'data', 'cafes-seoul.candidates.json');
const CURATED    = path.join(ROOT, 'data', 'cafes-seoul.json');

const ALLOWED_AMENITIES = ['OUTLET', 'WIFI', 'QUIET', 'NO_CALLS', '24H', 'CALLS_OK', 'NO_OUTLET'];

function parseArgs(argv) {
    const out = { id: null, lat: null, lng: null, line1: null, line2: null,
                  amenities: null, visitedAt: null, vetted: false };
    if (argv.length && !argv[0].startsWith('--')) out.id = argv.shift();
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i], v = argv[i + 1];
        if (a === '--lat')        { out.lat = parseFloat(v); i++; }
        else if (a === '--lng')   { out.lng = parseFloat(v); i++; }
        else if (a === '--line1') { out.line1 = v; i++; }
        else if (a === '--line2') { out.line2 = v; i++; }
        else if (a === '--amenities') { out.amenities = v; i++; }
        else if (a === '--visited')   { out.visitedAt = v; i++; }
        else if (a === '--vetted')    { out.vetted = true; }
    }
    return out;
}

async function ask(rl, label, validate) {
    while (true) {
        const v = (await rl.question(`  ${label}: `)).trim();
        const err = validate ? validate(v) : null;
        if (err) { console.error(`    ✗ ${err}`); continue; }
        return v;
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.id) {
        console.error('Usage: node scripts/promote-cafe.js <candidate-id> [flags]');
        console.error('       (run without flags to enter interactive mode)');
        process.exit(2);
    }

    const cand = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
    const idx = (cand.cafes || []).findIndex(c => c.id === args.id);
    if (idx < 0) {
        console.error(`Candidate "${args.id}" not found in ${path.relative(ROOT, CANDIDATES)}`);
        const sample = (cand.cafes || []).slice(0, 3).map(c => '  · ' + c.id).join('\n');
        if (sample) console.error('Sample IDs:\n' + sample);
        process.exit(2);
    }

    const c = cand.cafes[idx];
    console.log(`\n${c.name} — ${c.neighborhood}`);
    console.log(`Kakao Map: ${c.kakao_search_url}\n`);

    let lat = args.lat, lng = args.lng;
    let line1 = args.line1, line2 = args.line2;
    let amenities = args.amenities;
    let visitedAt = args.visitedAt;
    let vetted = args.vetted;

    const interactive = !lat || !lng || !line1 || !line2 || !amenities ||
                        (!visitedAt && !vetted);

    if (interactive) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try {
            console.log('Open the Kakao Map URL above. Right-click on the place,');
            console.log('"copy coordinates" gives "37.5817, 126.9846". Paste each part.\n');

            if (lat == null) lat = parseFloat(await ask(rl, 'lat (e.g. 37.5817)', v => {
                const n = parseFloat(v);
                return (n > 33 && n < 39) ? null : 'lat looks wrong (Seoul is 37.x)';
            }));
            if (lng == null) lng = parseFloat(await ask(rl, 'lng (e.g. 126.9846)', v => {
                const n = parseFloat(v);
                return (n > 125 && n < 130) ? null : 'lng looks wrong (Seoul is 126.x or 127.x)';
            }));

            console.log('\nTwo lines (mono · ≤ 36 chars each). One observation each.\n');
            if (!line1) line1 = await ask(rl, 'line 1', v => v && v.length <= 60 ? null : 'too long or empty');
            if (!line2) line2 = await ask(rl, 'line 2', v => v && v.length <= 60 ? null : 'too long or empty');

            console.log('\nAmenities. Pipe-separated, all caps. Allowed:');
            console.log('  ' + ALLOWED_AMENITIES.join(' · '));
            if (!amenities) amenities = await ask(rl, 'amenities (e.g. OUTLET · WIFI · QUIET)', v => {
                if (!v) return 'required';
                const parts = v.split(/[·|]/).map(s => s.trim()).filter(Boolean);
                const bad = parts.filter(p => !ALLOWED_AMENITIES.includes(p));
                return bad.length ? `unknown: ${bad.join(', ')}` : null;
            });

            if (!visitedAt && !vetted) {
                console.log('\nDid you visit, or vetted by reviews?');
                const ans = (await ask(rl, '[v]isited / [r]eviewed (default r)', null) || 'r').toLowerCase();
                if (ans.startsWith('v')) {
                    visitedAt = await ask(rl, 'visited_at (YYYY-MM-DD)', v =>
                        /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'use YYYY-MM-DD');
                } else {
                    vetted = true;
                }
            }
        } finally { rl.close(); }
    }

    const today = new Date().toISOString().slice(0, 10);

    const entry = {
        id:           c.id,
        name:         c.name,
        neighborhood: c.neighborhood,
        lat, lng,
        visited_at:   visitedAt || null,
        vetted_at:    vetted ? today : null,
        two_lines:    [line1, line2],
        amenities
    };

    // Append to curated, dedupe by id (last write wins).
    let curated;
    try { curated = JSON.parse(fs.readFileSync(CURATED, 'utf8')); }
    catch (e) { curated = []; }
    if (!Array.isArray(curated)) curated = [];

    const before = curated.length;
    curated = curated.filter(e => e.id !== entry.id);
    curated.push(entry);
    fs.writeFileSync(CURATED, JSON.stringify(curated, null, 4) + '\n');

    // Remove from candidates.
    cand.cafes.splice(idx, 1);
    cand.total = cand.cafes.length;
    fs.writeFileSync(CANDIDATES, JSON.stringify(cand, null, 2) + '\n');

    console.log(`\n[ok] promoted "${entry.name}"`);
    console.log(`  cafes-seoul.json:            ${before} → ${curated.length}`);
    console.log(`  cafes-seoul.candidates.json: ${cand.total + 1} → ${cand.total}`);
    console.log(`\nNext: npm run validate && npm run bump-cache && git add -A && git commit`);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
