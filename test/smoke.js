'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

// v744 — file list updated for the current bundled architecture. app.js /
// main.js / preload.js were the legacy AURA entry points; they were
// removed when saudade.core.js and saudade.editorial.js absorbed every
// IIFE module that ships to the browser.
const REQUIRED_FILES = [
    'index.html',
    'manifest.json',
    'sw.js',
    'bootstrap.js',
    'saudade.editorial.js',   // cover + masthead + edition + cover-edition (bundle)
    'saudade.core.js',         // ledger + welcome + footer + auth + letters + contribute (bundle)
    'saudade-ledger.js',       // standalone (visa/tax/insurance/pension)
    'saudade-dispatches.js',
    'saudade-desk.js',
    'saudade-listening.js',
    'saudade-atlas.js'
];

for (const file of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(ROOT, file)), `Missing required file: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
// No `main` entry — this is a static-site PWA, not a Node module. Verify
// the run-serve script exists instead.
assert(pkg.scripts && pkg.scripts.serve, 'package.json scripts.serve not defined');

const html = read('index.html');
// Only check tokens that should actually be present as live <script src=>
// (not commented out). saudade-cover.js was inlined into saudade.editorial.js
// — assert the bundle is loaded, not the source.
for (const token of [
    'saudade.editorial.js',   // cover live via bundle
    'saudade.core.js',         // ledger empty + welcome live via bundle
    'saudade-ledger.js',
    'saudade-dispatches.js',
    'saudade-listening.js',
    'saudade-atlas.js'
]) {
    // Catch both quoting styles and ignore commented-out lines.
    const live = html.split('\n').some(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('<!--')) return false;
        return new RegExp(`<script\\b[^>]*src=["']${token.replace(/\./g, '\\.')}`).test(line);
    });
    assert(live, `index.html is missing live <script src> reference: ${token}`);
}

// Cache version sync — sw.js CACHE_VERSION must equal bootstrap.js
// SAUDADE_RELEASE. Mismatch means the release-reload guard would fight
// with itself.
const swSrc = read('sw.js');
const bootSrc = read('bootstrap.js');
const swVer = (swSrc.match(/CACHE_VERSION\s*=\s*['"]saudade-(v\d+)['"]/) || [])[1];
const bootVer = (bootSrc.match(/SAUDADE_RELEASE\s*=\s*['"](v\d+)['"]/) || [])[1];
assert(swVer && bootVer, 'cache version markers not found');
assert(swVer === bootVer, `cache version mismatch: sw.js ${swVer} vs bootstrap.js ${bootVer}`);

// Data files — listening, dispatches, cafés. Each must be valid JSON.
const DATA_FILES = [
    'data/listening.json',
    'data/dispatches.json',
    'data/dispatches.ko.json',
    'data/dispatches.ja.json',
    'data/dispatches.pt.json',
    'data/dispatches.es.json',
    'data/cafes-seoul.json',
    'data/cafes-tokyo.json',
    'data/cafes-da-nang.json',
    'data/cafes-bali.json',
    'data/cafes-lisbon.json'
];
let validData = 0;
for (const f of DATA_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;   // missing data files are ledger entries to flag, not crashes
    try { JSON.parse(fs.readFileSync(p, 'utf8')); validData++; }
    catch (e) { throw new Error(`Invalid JSON in ${f}: ${e.message}`); }
}

// 5-edition dispatches — for the cover hero per edition.
let dispatchesPerEd = 0;
for (const ed of ['ko', 'ja', 'pt', 'es']) {
    if (fs.existsSync(path.join(ROOT, `data/dispatches.${ed}.json`))) dispatchesPerEd++;
}
if (fs.existsSync(path.join(ROOT, 'data/dispatches.json'))) dispatchesPerEd++;

console.log('Smoke check: ' + REQUIRED_FILES.length + ' required files present');
console.log('  cache version: ' + swVer + ' (sw + bootstrap synced)');
console.log('  data files: ' + validData + ' present + valid JSON');
console.log('  dispatches: ' + dispatchesPerEd + '/5 editions present');
console.log('Smoke check passed.');
