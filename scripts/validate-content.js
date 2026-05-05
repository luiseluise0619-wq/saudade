#!/usr/bin/env node
/**
 * saudade · content licence validator.
 *
 * Fails (exit 1) if any audio/photo asset listed in shipped data files
 * is missing a licence declaration or attribution string. This is the
 * machine half of CONTENT-LICENSE.md.
 *
 * Usage:  node scripts/validate-content.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Allowed licence identifiers. Anything else must be an explicit URL or paid receipt.
const OK_LICENCES = new Set([
    'CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-ND', 'CC-BY-NC', 'PUBLIC-DOMAIN',
    'OWN', 'OWN-FIELD-RECORDING', 'OWN-PHOTO',
    'EPIDEMIC-SOUND', 'ARTLIST', 'SOUNDSTRIPE', 'MUSOPEN',
    'UNSPLASH', 'PEXELS', 'PIXABAY',
    'STOCK-EDITORIAL'   // any paid editorial-use stock photo (receipt logged off-repo)
]);

// Friendly aliases — strings the editor used in data/ that map to a known licence.
const LICENCE_ALIASES = {
    'Owned recording · Saudade': 'OWN-FIELD-RECORDING',
    'Saudade · Field recording':  'OWN-FIELD-RECORDING',
    'Saudade owned':              'OWN',
    'Saudade · own photo':        'OWN-PHOTO'
};

let errors = 0;
let checked = 0;

function fail(file, msg) {
    console.error(`✗ ${file}: ${msg}`);
    errors++;
}
function ok(msg) {
    console.log(`✓ ${msg}`);
}

function checkListening() {
    const f = path.join(ROOT, 'data', 'listening.json');
    if (!fs.existsSync(f)) return;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const tracks = Array.isArray(j.tracks) ? j.tracks : [];
    let bad = 0;
    for (const t of tracks) {
        checked++;
        if (!t.title)   { fail(f, `track missing title: ${JSON.stringify(t).slice(0, 80)}`); bad++; }
        if (!t.license) { fail(f, `track "${t.title}" missing license`); bad++; }
        else {
            const norm = LICENCE_ALIASES[t.license] || t.license;
            if (!OK_LICENCES.has(norm) && !/^https?:\/\//.test(norm)) {
                fail(f, `track "${t.title}" has unrecognised license "${t.license}" — add it to OK_LICENCES, LICENCE_ALIASES, or use a URL`);
                bad++;
            }
        }
        if (!t.credits && t.license !== 'CC0') {
            fail(f, `track "${t.title}" needs credits/attribution (license ${t.license})`);
            bad++;
        }
    }
    if (bad === 0) ok(`listening.json — ${tracks.length} tracks all licensed`);
}

function checkDispatches() {
    const editions = ['', 'ko', 'ja', 'es', 'pt'];
    for (const ed of editions) {
        const f = path.join(ROOT, 'data', ed ? `dispatches.${ed}.json` : 'dispatches.json');
        if (!fs.existsSync(f)) continue;
        const j = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (j.ai_assisted && !j.ai_disclosure) fail(f, 'ai_assisted set but no ai_disclosure string');
        const cities = j.cities || [];
        for (const c of cities) {
            for (const it of (c.items || [])) {
                checked++;
                if (!it.source) fail(f, `${c.city} item ${it.n} missing source`);
                if (it.body && it.body.length > 800) fail(f, `${c.city} item ${it.n} body > 800 chars (rewrite shorter)`);
                if (it.quote && it.quote.length > 200) fail(f, `${c.city} item ${it.n} quote > 200 chars (CONTENT-LICENSE.md §1)`);
            }
        }
        ok(`dispatches.${ed || 'en'} — ${cities.length} cities`);
    }
}

function checkCafes() {
    const f = path.join(ROOT, 'data', 'cafes-seoul.json');
    if (!fs.existsSync(f)) return;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const cafes = Array.isArray(j.cafes) ? j.cafes : Array.isArray(j) ? j : [];
    let bad = 0;
    for (const c of cafes) {
        if (!c.name) { fail(f, 'café missing name'); bad++; }
        // Photos, when present, must declare provenance.
        if (c.photo && !c.photo_credit) {
            fail(f, `café "${c.name}" has photo but no photo_credit (CONTENT-LICENSE.md §2)`);
            bad++;
        }
    }
    if (bad === 0) ok(`cafes-seoul.json — ${cafes.length} cafés all sourced`);
}

(function main() {
    console.log('saudade · content validation');
    console.log('---');
    checkListening();
    checkDispatches();
    checkCafes();
    console.log('---');
    console.log(`checked ${checked} items, ${errors} error(s)`);
    if (errors > 0) process.exit(1);
})();
