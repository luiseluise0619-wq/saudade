// test/render-lint.test.js — pure-Node assertions against the JS source.
//
// Built after PR #81 shipped '[object Object]' in the footer because
// SECTIONS[cat].name was changed from a string to a {en,ko,...} map but
// one consumer still string-concatenated it. Smoke tests don't render,
// so the regression survived merge.
//
// This file catches the class without a browser: scan known IIFE modules
// for risky concat patterns + a small set of invariants. Cheap, runs in
// node --test, fails the existing CI flow.

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Strip line comments and block comments so source scans don't trip on
// prose. Crude but sufficient for our patterns.
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('SAUDADE_MASTHEAD.SECTIONS[*].name is consumed with [ed] lookup, never raw concat', () => {
    // Anywhere that reads `SECTIONS[...].name` (or `matched.name`, the
    // common alias) should immediately follow with `[` (index lookup) or
    // assign-and-localize before concatenating. Raw `' + matched.name'`
    // is what produced '[object Object]'.
    const files = [
        'saudade-masthead.js',
        'saudade-footer-rule.js',
        'saudade-cover.js'
    ];
    // Narrow signal: fail only if `matched.name` is the right operand of
    // a string concatenation (`+ matched.name`) — that is the exact
    // shape that rendered '[object Object]' pre-#82.
    for (const f of files) {
        const src = stripComments(read(f));
        const offenders = [...src.matchAll(/\+\s*matched\.name\b(?!\s*\[)/g)];
        for (const m of offenders) {
            const tail = src.slice(Math.max(0, m.index - 20), m.index + 40);
            assert.fail(`${f}: \`+ matched.name\` raw concat (would render [object Object]) — ${tail.replace(/\s+/g, ' ')}`);
        }
    }
});

test('cover nav, masthead, footer never embed raw English section labels', () => {
    // PRs #81-#83 closed the inline 'LEDGER' / 'ATLAS' / 'DISPATCHES' /
    // 'THE DESK' literals in renderable templates. If any future change
    // re-introduces an inline-only label, fail loud.
    const FORBIDDEN = [
        /<span[^>]*class="sdd-mark"[^>]*>\s*§\s*\d\d?\s*<\/span>\s*LEDGER\s*</i,
        /<span[^>]*class="sdd-mark"[^>]*>\s*§\s*\d\d?\s*<\/span>\s*ATLAS\s*</i,
        /<span[^>]*class="sdd-mark"[^>]*>\s*§\s*\d\d?\s*<\/span>\s*DISPATCHES\s*</i,
        /<span[^>]*class="sdd-mark"[^>]*>\s*§\s*\d\d?\s*<\/span>\s*THE DESK\s*</i
    ];
    const files = ['saudade-cover.js', 'saudade-masthead.js', 'saudade-footer-rule.js'];
    for (const f of files) {
        const src = read(f);
        for (const re of FORBIDDEN) {
            assert.ok(!re.test(src), `${f}: re-introduced an inline English-only section label`);
        }
    }
});

test('listening cover CTA + ledger ADD button + footer nav are localized', () => {
    // Defensive against the i18n regression discovered post-#81. Each of
    // these used to be hard-coded English; assert the L({...}) /
    // T({...}) shape is still in place.
    const cases = [
        { file: 'saudade-listening.js',    needle: /CTA_LABEL\s*=\s*\{[^}]*ko:/s,    name: 'listening CTA_LABEL' },
        { file: 'saudade-ledger.js',       needle: /T\(\{[^}]*en:\s*'ADD'/s,         name: 'ledger ADD button' },
        { file: 'saudade-footer-rule.js',  needle: /FOOTER_COPY\s*=\s*\{[\s\S]*?ko:\s*\{/,  name: 'footer copy map' }
    ];
    for (const c of cases) {
        const src = read(c.file);
        assert.ok(c.needle.test(src), `${c.file}: ${c.name} missing or de-localized`);
    }
});

test('sw.js CACHE_VERSION matches index.html ?v= cache buster', () => {
    const sw = read('sw.js');
    const html = read('index.html');
    const m = sw.match(/CACHE_VERSION\s*=\s*'saudade-(v\d+)'/);
    assert.ok(m, 'sw.js CACHE_VERSION pattern not found');
    const ver = m[1];
    const found = (html.match(new RegExp(`\\?v=${ver}\\b`, 'g')) || []).length;
    assert.ok(found > 0, `index.html does not reference ?v=${ver}; bump-cache may not have run`);
});

test('SEO meta tags carry English defaults (syncMetaTags rewrites per edition)', () => {
    const html = read('index.html');
    // Description must be in EN at static-paint (matches <html lang="en">),
    // not Korean as it was before PR #84.
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
    assert.ok(desc, 'description meta tag missing');
    assert.ok(/Saudade/.test(desc[1]), 'description meta should mention Saudade');
    assert.ok(!/비자|카페|디지털/.test(desc[1]), 'description should be EN default, not KO');

    const ogLoc = html.match(/<meta\s+property="og:locale"\s+content="([^"]+)"/);
    assert.ok(ogLoc, 'og:locale missing');
    assert.strictEqual(ogLoc[1], 'en_US', 'og:locale should be en_US (was hardcoded ko_KR pre-#84)');
});
