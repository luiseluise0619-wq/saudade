'use strict';

// saudade · smoke test. Verifies invariants that, if broken, would silently
// degrade production for users until someone notices. Run on every PR via
// the saudade.yml workflow.

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ok = [];
const errors = [];

function assert(cond, msg) { if (!cond) errors.push(msg); else ok.push(msg); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(ROOT, file)); }

// ─── 1. required runtime files ────────────────────────────────────────
const REQUIRED = [
    'index.html', 'bootstrap.js', 'sw.js',
    'saudade-boot.js', 'saudade.core.js', 'saudade.editorial.js',
    'saudade-cover.js', 'saudade-ledger.js', 'saudade-dispatches.js',
    'saudade-desk.js', 'saudade-listening.js', 'saudade-atlas.js',
    'saudade-wordmark.js', 'cloudflare-worker.js',
    'types.d.ts', 'CLAUDE.md', 'ARCHITECTURE.md',
    'package.json', 'tsconfig.json', 'wrangler.toml'
];
for (const f of REQUIRED) assert(exists(f), `runtime file present: ${f}`);

// ─── 2. index.html references each section module ────────────────────
const html = read('index.html');
for (const tok of [
    'saudade-cover', 'saudade-ledger', 'saudade-dispatches',
    'saudade-desk', 'saudade-listening', 'saudade-atlas'
]) assert(html.includes(tok), `index.html references: ${tok}`);

// ─── 3. cache-version sync ────────────────────────────────────────────
const sw = read('sw.js');
const swMatch = sw.match(/CACHE_VERSION\s*=\s*['"]saudade-(v\d+)['"]/);
assert(swMatch, 'sw.js CACHE_VERSION found');
const swVersion = swMatch ? swMatch[1] : null;

const htmlVersions = new Set();
for (const m of html.matchAll(/\?v=(v\d+)/g)) htmlVersions.add(m[1]);
assert(htmlVersions.size > 0, 'index.html has ?v= cache-busters');
for (const v of htmlVersions) {
    assert(v === swVersion,
        `cache version sync (sw=${swVersion}, html=${v})`);
}

// ─── 4. data files referenced by the frontend exist ──────────────────
const REQUIRED_DATA = [
    'data/cafes-seoul.json',
    'data/listening.json',
    'data/dispatches.json',
    'data/dispatches.ko.json',
    'data/dispatches.ja.json',
    'data/dispatches.pt.json',
    'data/dispatches.es.json',
    'data/city-definitions.json',
    'data/cover-titles.json'
];
for (const f of REQUIRED_DATA) assert(exists(f), `data file present: ${f}`);

// ─── 5. data files parse as JSON ─────────────────────────────────────
for (const f of REQUIRED_DATA) {
    if (!exists(f)) continue;
    try { JSON.parse(read(f)); assert(true, `valid JSON: ${f}`); }
    catch (e) { assert(false, `valid JSON: ${f} — ${e.message.slice(0, 60)}`); }
}

// ─── 6. constitution: cafes-seoul.json entries must have visited_at ──
//    (or it's empty — a wiped state, also acceptable). What's NOT acceptable
//    is fabricated entries with visited_at:null + lat/lng filled. See PR #26.
try {
    const cafes = JSON.parse(read('data/cafes-seoul.json'));
    if (Array.isArray(cafes) && cafes.length > 0) {
        const fab = cafes.filter(c =>
            c.visited_at == null && (typeof c.lat === 'number' || c.two_lines)
        );
        assert(fab.length === 0,
            `no fabricated cafés (visited_at:null + lat/two_lines filled): ${fab.length} found`);
    } else {
        assert(true, 'no fabricated cafés (file empty or [])');
    }
} catch (e) { assert(false, `cafes-seoul.json parses for constitution check: ${e.message.slice(0, 60)}`); }

// ─── 7. dispatch files match their edition ────────────────────────────
for (const ed of ['en', 'ko', 'ja', 'pt', 'es']) {
    const f = ed === 'en' ? 'data/dispatches.json' : `data/dispatches.${ed}.json`;
    try {
        const d = JSON.parse(read(f));
        assert(d.edition === ed, `${f} declares edition='${ed}'`);
        assert(Array.isArray(d.cities) && d.cities.length > 0,
            `${f} has cities`);
        assert(d.ai_assisted === true && typeof d.ai_disclosure === 'string',
            `${f} has ai_assisted + ai_disclosure`);
    } catch (e) { assert(false, `${f} validates: ${e.message.slice(0, 60)}`); }
}

// ─── 8. service worker caches a sane file list ───────────────────────
assert(/index\.html/.test(sw), 'sw.js precaches index.html');
assert(/saudade\.core/.test(sw), 'sw.js precaches saudade.core');

// ─── 9. report ───────────────────────────────────────────────────────
console.log(`Smoke check: ${ok.length} pass, ${errors.length} fail`);
if (errors.length) {
    console.error('\nFailures:');
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
}
console.log(`  cache version: ${swVersion}`);
console.log(`  data files: ${REQUIRED_DATA.length} present + valid JSON`);
console.log(`  dispatches: 5 editions verified`);
