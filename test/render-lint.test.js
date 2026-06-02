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

test('data/dispatches.<ed>.json ai_disclosure must not claim human-editor review', () => {
    // Locked after #103 / #(this PR) — the AI-review-gate (#93/#94) moved
    // dispatch review from a human editor to a second Gemini pass against
    // the constitution. The user-facing copy lagged by 6 surfaces for
    // weeks. This is the §3 honesty contract: the machine-readable
    // disclosure (EU AI Act Art.50) must describe what actually happens.
    //
    // Letters and desks are NOT covered here — they're separately
    // moderated and may honestly claim human review.
    const FALSE_CLAIMS = {
        en: /human editor/i,
        ko: /사람 편집장/,
        ja: /人間の編集/,
        pt: /editor humano/i,
        es: /editor humano/i
    };
    for (const ed of ['ko', 'ja', 'pt', 'es']) {
        const json = JSON.parse(read(`data/dispatches.${ed}.json`));
        const disc = String(json.ai_disclosure || '');
        const re = FALSE_CLAIMS[ed];
        assert.ok(!re.test(disc),
            `dispatches.${ed}.json ai_disclosure still claims human-editor review — pipeline is AI-only since #93/#94`);
    }
    const enJson = JSON.parse(read('data/dispatches.json'));
    const enDisc = String(enJson.ai_disclosure || '');
    assert.ok(!FALSE_CLAIMS.en.test(enDisc),
        'dispatches.json (en) ai_disclosure claims human-editor review');
});

test('every user-facing HTML page declares viewport, html lang, and a <main> landmark', () => {
    // Locked after a static a11y/mobile sweep found 9 pages
    // (credits/install/privacy ×5/support/terms) shipping with no <main>
    // landmark — screen readers fell through to <body>. Dev-only pages
    // (admin, test-suite, logo-preview) are excluded; they're disallowed
    // by robots.txt and not the front door.
    const DEV_ONLY = /^(admin|test-suite|logo-preview)\./;
    const files = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.html') && !DEV_ONLY.test(f));
    for (const f of files) {
        const src = read(f);
        assert.ok(/<html\s+lang=["'][a-z]{2}/i.test(src),
            `${f}: <html lang="…"> missing`);
        assert.ok(/<meta\s+name=["']viewport["']/i.test(src),
            `${f}: viewport meta missing — mobile users see desktop layout`);
        assert.ok(/<main\b/i.test(src),
            `${f}: <main> landmark missing — screen readers cannot skip to content`);
    }
});

test('index.html JSON-LD describes the current product (no retired tier prices, no decision-tool copy)', () => {
    // Locked after a sweep found the schema.org block in index.html still
    // advertised a "Digital nomad decision tool — visa counter, tax
    // residency..." plus paid Patron/Subscriber tiers at $3/$5 — while the
    // worker has been in GONE_FREE_MODE for billing for months. This
    // copy gets republished verbatim by Google AI Overviews, ChatGPT,
    // and Perplexity, so the lie propagates beyond the site itself.
    const html = read('index.html');
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(m, 'index.html: no JSON-LD block');
    const block = m[1];

    // Retired product vocabulary that must not return.
    const RETIRED = [
        /decision tool/i,
        /visa counter/i,
        /Schengen/i,
        /tax residency/i,
        /Patron/i,
        /Subscriber/i
    ];
    for (const re of RETIRED) {
        assert.ok(!re.test(block),
            `index.html JSON-LD still mentions retired product vocabulary matching ${re}`);
    }
    // Current product must be there.
    assert.ok(/magazine|newspaper/i.test(block),
        'index.html JSON-LD description should call the site a magazine / newspaper');
});

test('cloudflare-worker /health response describes the actual product, no AURA branding', () => {
    // Caught in the same drift sweep that fixed JSON-LD (#107). The
    // worker's / and /health endpoints returned
    //   { status: 'ok', service: 'AURA Backend', version: '4.0', ... }
    // when the product had been saudade for many months. Uptime monitors,
    // dev consoles, and curl-checks all picked up the stale brand.
    const src = read('cloudflare-worker.js');
    const healthLines = src.split('\n').filter(l => /service:\s*['"]/.test(l));
    for (const line of healthLines) {
        assert.ok(!/AURA/.test(line),
            `cloudflare-worker.js leaks AURA brand in a health-style response: ${line.trim()}`);
    }
});

test('cloudflare-worker uses env.SITE_ORIGIN, not a hardcoded saudade.app, for user-facing URLs', () => {
    // saudade.app is the planned custom domain but is not provisioned.
    // Magic-link emails and the Atom feed used to point at it; users got
    // DNS errors. Both now derive from siteOrigin(env), defaulting to
    // saudade.pages.dev (the actually-deployed URL).
    const src = read('cloudflare-worker.js');
    // The two specific hardcodes we removed must not reappear.
    assert.ok(!/['"]https:\/\/saudade\.app\/\?token=['"]/.test(src),
        'magic-link base reverted to https://saudade.app/?token= — env.SITE_ORIGIN required');
    assert.ok(!/homeMap\s*=\s*\{\s*en:\s*['"]https:\/\/saudade\.app\//.test(src),
        'Atom feed homeMap reverted to https://saudade.app/ — env.SITE_ORIGIN required');
});

test('README + desk PIPELINE describe the current AI stack, not the retired one', () => {
    // Caught alongside the same drift sweep that fixed JSON-LD (#107)
    // and SITE_ORIGIN (#108). The README and the in-app desk page both
    // advertised:
    //   - "Gemini 2.0 Flash" (retired from free tier, #95 fixed code)
    //   - A "TRANSLATE" pipeline step (contradicts the constitution:
    //     KO/JA/PT/ES are independent editions, not translations)
    //   - "Human editor reviews afterwards" (after #93/#94 the review
    //     gate is an AI pass — no human editor in the loop)
    const readme = read('README.md');
    const desk   = read('saudade-desk.js');

    // Retired Gemini version names — alias-only is enforced (see existing
    // "Gemini model name pin" test for live code).
    for (const where of [{ name: 'README.md', src: readme },
                         { name: 'saudade-desk.js', src: desk }]) {
        assert.ok(!/gemini-?2\.0-?flash/i.test(where.src),
            `${where.name}: still names gemini-2.0-flash (retired) — use the gemini-flash-lite-latest alias`);
        assert.ok(!/gemini 2\.0 flash/i.test(where.src),
            `${where.name}: still names "Gemini 2.0 Flash" in prose — use "Gemini Flash" (latest)`);
    }

    // PIPELINE step "TRANSLATE" describes a workflow that does not exist.
    assert.ok(!/step:\s*['"]TRANSLATE['"]/.test(desk),
        'saudade-desk.js PIPELINE still has a TRANSLATE step — KO/JA/PT/ES are independent editions, not translations');

    // The desk file step used to claim "Human editor reviews afterwards".
    assert.ok(!/Human editor reviews/i.test(desk),
        'saudade-desk.js still claims a human editor reviews — the AI-review gate replaced human review in #93/#94');
});

test('etymology.html describes the actual product (filed daily from Seoul, not Lisbon)', () => {
    // Locked alongside #109. etymology.html had the same drift as the
    // README tagline — claimed the newspaper is filed from Lisbon and
    // doesn't have a publication schedule. credits.html explicitly says
    // "Issue 03 was edited from Seoul" and constitution §9.5 says
    // daily filing at 06:00 KST. The about-page text now matches both.
    //
    // The per-edition cover lede uses a dynamic $editorCity template
    // (Seoul for KO, Lisbon for EN, etc.) — that's intentional brand
    // framing and lives in saudade-cover.js / saudade.editorial.js,
    // not on this static prose page.
    const html = read('etymology.html');
    assert.ok(!/(?:edited|filed)\s+from\s+lisbon/i.test(html),
        'etymology.html still claims the newspaper is edited/filed from Lisbon — credits.html says Seoul');
});

test('cover lede + Atom subtitle reflect daily filing from Seoul (no "no schedule" / "from Lisbon")', () => {
    // Locked after a screenshot showed the deployed cover still claiming
    // "Three cities, no schedule. Edited from Lisbon." — both clauses
    // contradict the magazine's own sources:
    //   - §9.5 mandates daily filing at 06:00 KST, not "no schedule"
    //   - credits.html: "Issue 03 was edited from Seoul"
    //
    // Live files:
    //   - saudade.editorial.js — ISSUE_LEDE_5 (cover lede) + detectCity
    //   - saudade.core.js — empty-state cover + welcome copy (duplicates
    //     of the dead saudade-empty.js / saudade-welcome.js bundled here)
    //   - cloudflare-worker.js — Atom feed subMap (RSS subscriber face)
    const LIVE_FILES = ['saudade.editorial.js', 'saudade.core.js', 'cloudflare-worker.js'];
    for (const f of LIVE_FILES) {
        const src = read(f);
        assert.ok(!/Three cities,\s*no schedule/i.test(src),
            `${f}: still claims "Three cities, no schedule" — §9.5 mandates daily filing`);
        assert.ok(!/Edited from Lisbon/i.test(src),
            `${f}: still claims "Edited from Lisbon" — credits.html says Seoul`);
        assert.ok(!/세 도시,\s*정해진 시간 없음/.test(src),
            `${f}: KO copy still claims 정해진 시간 없음 — §9.5 매일 발행`);
        assert.ok(!/리스본에서 편집/.test(src),
            `${f}: KO copy still claims 리스본에서 편집 — credits.html 서울`);
    }
});

test('SAUDADE_EDITION export in editorial.js includes the skin API (setSkin, skinPref, SKINS)', () => {
    // Caught when the user reported the cover theme button + the legal-strip
    // theme switcher both silently no-op'd. saudade-edition.js (the
    // standalone) exports a full skin API; the editorial.js bundled module
    // ships a trimmed export that dropped setSkin/skinPref/SKINS, so every
    // caller's `SAUDADE_EDITION?.setSkin?.(v)` chain was a no-op.
    const src = read('saudade.editorial.js');
    const m = src.match(/window\.SAUDADE_EDITION\s*=\s*\{([\s\S]*?)\};/);
    assert.ok(m, 'editorial.js: window.SAUDADE_EDITION export not found');
    const block = m[1];
    for (const fn of ['setSkin', 'skinPref', 'SKINS']) {
        assert.ok(new RegExp('\\b' + fn + '\\b').test(block),
            `editorial.js SAUDADE_EDITION export missing "${fn}" — skin switching will silently fail`);
    }
});

test('no inline onload="this.classList.add..." in live JS — CSP blocks it', () => {
    // Caught twice now: #120 (listening room city photo) and #129 (atlas
    // cafe photo). The page CSP is
    //     script-src 'self' https:;   (no 'unsafe-inline')
    // so inline event-handler attributes are blocked. Images load but
    // the .is-loaded class is never added → opacity stays 0 forever.
    // Always bind via addEventListener('load', …) on rendered <img>.
    const LIVE = [
        'saudade.editorial.js', 'saudade.core.js', 'saudade-listening.js',
        'saudade-dispatches.js', 'saudade-atlas.js', 'saudade-atlas-map.js',
        'saudade-desk.js', 'saudade-ledger.js'
    ];
    for (const f of LIVE) {
        const src = stripComments(read(f));
        assert.ok(!/onload="this\.classList/.test(src),
            `${f}: inline onload="this.classList…" detected — CSP blocks it. Use addEventListener instead (see #120 / #129).`);
    }
});
