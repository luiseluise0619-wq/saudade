#!/usr/bin/env node
/**
 * saudade · bump cache version everywhere.
 *
 * The cache version lives in three (sometimes four) places and they MUST
 * match or the smoke test fails:
 *   1. sw.js  — `const CACHE_VERSION = 'saudade-vNNN'`
 *   2. index.html — every `<script src="x.js?v=vNNN">`
 *   3. saudade-listening.js — fetch('./data/listening.json?v=vNNN')
 *
 * This script reads the current sw.js version, bumps it by 1, and rewrites
 * every reference. Run when you change any committed JS / CSS / data file
 * the frontend caches with `force-cache`.
 *
 * Usage:
 *   node scripts/bump-cache.js            # auto-bump (vN → vN+1)
 *   node scripts/bump-cache.js v700       # set explicit version
 *   node scripts/bump-cache.js --dry      # preview changes
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SW   = path.join(ROOT, 'sw.js');
const HTML = path.join(ROOT, 'index.html');

function main() {
    const args = process.argv.slice(2);
    const dry  = args.includes('--dry');
    const explicit = args.find(a => /^v\d+$/.test(a));

    const sw = fs.readFileSync(SW, 'utf8');
    const m = sw.match(/CACHE_VERSION\s*=\s*['"]saudade-(v\d+)['"]/);
    if (!m) { console.error('sw.js: CACHE_VERSION not found'); process.exit(1); }
    const current = m[1];
    const next = explicit || ('v' + (parseInt(current.slice(1), 10) + 1));

    console.log(`Current: ${current}`);
    console.log(`Next:    ${next}${dry ? '  (DRY RUN)' : ''}`);
    if (current === next) { console.log('Already at requested version.'); return; }

    let totalChanges = 0;

    // 1. sw.js
    const newSw = sw.replace(
        /(CACHE_VERSION\s*=\s*['"]saudade-)v\d+(['"])/,
        `$1${next}$2`
    );
    if (newSw !== sw) {
        if (!dry) fs.writeFileSync(SW, newSw);
        totalChanges++;
        console.log(`  sw.js                    1 change`);
    }

    // 2. index.html — every ?v=vNNN cache buster
    const html = fs.readFileSync(HTML, 'utf8');
    let htmlChanges = 0;
    const newHtml = html.replace(/\?v=v\d+/g, () => { htmlChanges++; return `?v=${next}`; });
    if (htmlChanges > 0) {
        if (!dry) fs.writeFileSync(HTML, newHtml);
        totalChanges += htmlChanges;
        console.log(`  index.html               ${htmlChanges} changes`);
    }

    // 3. saudade-listening.js — fetch query
    const LIST = path.join(ROOT, 'saudade-listening.js');
    if (fs.existsSync(LIST)) {
        const lj = fs.readFileSync(LIST, 'utf8');
        let ljChanges = 0;
        const newLj = lj.replace(/listening\.json\?v=v\d+/g, () => { ljChanges++; return `listening.json?v=${next}`; });
        if (ljChanges > 0) {
            if (!dry) fs.writeFileSync(LIST, newLj);
            totalChanges += ljChanges;
            console.log(`  saudade-listening.js     ${ljChanges} changes`);
        }
    }

    console.log(`\n[ok] ${totalChanges} ${dry ? 'would change' : 'changed'} · ${current} → ${next}`);

    if (!dry) {
        console.log(`\nNext: run 'node test/smoke.js' to verify, then commit.`);
    }
}

main();
