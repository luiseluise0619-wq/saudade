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

for (const file of [
    'index.html',
    'app.js',
    'bootstrap.js',
    'main.js',
    'preload.js',
    'saudade-cover.js',
    'saudade-ledger.js',
    'saudade-dispatches.js',
    'saudade-desk.js',
    'saudade-listening.js',
]) {
    assert(fs.existsSync(path.join(ROOT, file)), `Missing required file: ${file}`);
}

const pkg = JSON.parse(read('package.json'));
assert(pkg.main === 'main.js', 'package.json main entry should point to main.js');

const html = read('index.html');
for (const token of [
    'saudade-cover.js',
    'saudade-ledger.js',
    'saudade-dispatches.js',
    'saudade-desk.js',
    'saudade-listening.js',
]) {
    assert(html.includes(token), `index.html is missing script reference: ${token}`);
}

console.log('Smoke check passed.');
