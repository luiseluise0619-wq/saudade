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

// Required runtime files for the Cloudflare Pages site.
for (const file of [
    'index.html',
    'bootstrap.js',
    'saudade-boot.js',
    'saudade.core.js',
    'saudade.editorial.js',
    'saudade-cover.js',
    'saudade-ledger.js',
    'saudade-dispatches.js',
    'saudade-desk.js',
    'saudade-listening.js',
    'sw.js',
]) {
    assert(fs.existsSync(path.join(ROOT, file)), `Missing required file: ${file}`);
}

const html = read('index.html');
for (const token of [
    'saudade-cover',
    'saudade-ledger',
    'saudade-dispatches',
    'saudade-desk',
    'saudade-listening',
]) {
    assert(html.includes(token), `index.html is missing reference to: ${token}`);
}

// Cache-version sync: index.html cache-buster query and sw.js CACHE_VERSION
// must agree, otherwise stale assets are served until SW activate runs.
const sw = read('sw.js');
const swMatch = sw.match(/CACHE_VERSION\s*=\s*['"]saudade-(v\d+)['"]/);
assert(swMatch, 'sw.js CACHE_VERSION not found');
const swVersion = swMatch[1];
const htmlVersions = new Set();
for (const m of html.matchAll(/\?v=(v\d+)/g)) htmlVersions.add(m[1]);
assert(htmlVersions.size > 0, 'index.html has no ?v= cache-busters');
for (const v of htmlVersions) {
    assert(v === swVersion,
        `Cache version mismatch: sw.js=${swVersion} but index.html has ?v=${v}`);
}

console.log('Smoke check passed.');
console.log(`  cache version: ${swVersion} (sw.js + index.html in sync)`);

