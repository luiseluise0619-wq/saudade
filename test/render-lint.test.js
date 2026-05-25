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

test('all user-facing HTML cache busters match sw.js CACHE_VERSION', () => {
    // Was missed before: bump-cache.js only walked index.html, so install/
    // privacy/terms/etc. shipped pinned to ?v=v661 while sw.js had moved
    // 21 versions ahead. Browsers loading those pages saw broken CSS/JS.
    const sw = read('sw.js');
    const m = sw.match(/CACHE_VERSION\s*=\s*'saudade-(v\d+)'/);
    assert.ok(m, 'sw.js CACHE_VERSION pattern not found');
    const ver = m[1];

    const DEV = new Set(['index.html', 'test-suite.html', 'logo-preview.html']);
    const userHtml = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.html') && !DEV.has(f));

    for (const name of userHtml) {
        const src = read(name);
        const versions = [...src.matchAll(/\?v=(v\d+)/g)].map(m => m[1]);
        const stale = versions.filter(v => v !== ver);
        assert.strictEqual(stale.length, 0,
            `${name}: stale cache buster(s) — found ${[...new Set(stale)].join(', ')}, expected ${ver}. Run \`npm run bump-cache\`.`);
    }
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

test('no pinned/retired Gemini model in live code (use the -latest alias)', () => {
    // gemini-2.0-flash retiring from the free tier (limit:0) silently
    // broke the dispatch pipeline three times this development cycle
    // (#77, #94, #95). The fix is the gemini-flash[-lite]-latest alias.
    // Fail if a pinned version sneaks back into executable code. Comments
    // (which explain the history) are stripped first.
    const files = [
        'cloudflare-worker.js',
        'scripts/refresh-dispatches.js',
        'scripts/verify-cafes-gemini.js'
    ];
    // Retired or soon-retired pins we never want hard-coded again.
    const banned = /gemini-(?:2\.0-flash|1\.5-[a-z]+|1\.0-[a-z]+|pro)\b/;
    for (const f of files) {
        const src = stripComments(read(f));
        const m = src.match(banned);
        assert.ok(!m, `${f}: pinned/retired Gemini model "${m && m[0]}" in live code — use gemini-flash-lite-latest`);
    }
});
