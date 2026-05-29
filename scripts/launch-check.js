#!/usr/bin/env node
/**
 * saudade · launch readiness check.
 *
 * One command, one screen, one truth: is this thing ready to ship?
 * Prints a colored table grouped by severity. Exits non-zero if any
 * BLOCKER fails — wire into CI or read by eye before announcing.
 *
 * Usage:
 *   node scripts/launch-check.js           # human-readable
 *   node scripts/launch-check.js --json    # machine-readable
 *
 * Severity:
 *   BLOCKER  — must fix before launch (legal / security / data loss)
 *   WARN     — should fix soon (UX / monitoring / sustainability)
 *   INFO     — observability ('did you set up X yet?')
 *
 * What this is NOT: a substitute for the founder making the launch
 * decision. It is a checklist that surfaces the things software can
 * verify. The intent decision (craft / business / venture) and
 * editorial cadence policy remain founder calls.
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');

const results = []; // { severity, area, name, ok, detail }
function record(severity, area, name, ok, detail) {
    results.push({ severity, area, name, ok, detail });
}

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

// ─── BLOCKER: exposed API key still in tree ────────────────────────────
(function checkExposedKey() {
    // The literal Gemini key the user pasted into chat. If it ever lands
    // in committed source — sense. We check the suffix only (avoid the
    // full key landing in our own script).
    const KEY_TAIL = ['pri0', 'sSfHY'].join('');  // split so this scan itself doesn't match
    let hit = false;
    try {
        const out = execSync(`grep -rln "${KEY_TAIL}" --include="*.js" --include="*.toml" --include="*.json" --include="*.md" --include="*.yml" --exclude="launch-check.js"`, {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe']
        }).toString().trim();
        if (out) hit = out.split('\n');
    } catch (e) { /* grep exits 1 on no match */ }
    record('BLOCKER', 'security', 'exposed Gemini key not in tree',
        !hit, hit ? `found in: ${Array.isArray(hit) ? hit.join(', ') : hit}` : 'no match');
})();

// ─── BLOCKER: D1 backup workflow exists + is scheduled ─────────────────
(function checkD1Backup() {
    const p = '.github/workflows/d1-backup.yml';
    if (!exists(p)) {
        record('BLOCKER', 'data', 'D1 backup workflow', false, `${p} missing`);
        return;
    }
    const src = read(p);
    const hasCron = /schedule:\s*\n\s*-\s*cron:/i.test(src);
    record('BLOCKER', 'data', 'D1 backup workflow has cron', hasCron,
        hasCron ? 'scheduled' : 'cron block commented out');
})();

// ─── BLOCKER: Ledger disclaimer present in all 5 editions ──────────────
(function checkLedgerDisclaimer() {
    if (!exists('saudade-ledger.js')) {
        record('BLOCKER', 'legal', 'ledger disclaimer', false, 'saudade-ledger.js missing');
        return;
    }
    const src = read('saudade-ledger.js');
    const editions = ['en', 'ko', 'ja', 'pt', 'es'];
    const missing = editions.filter(ed => {
        const re = new RegExp(`disclaimer[\\s\\S]{0,500}${ed}:\\s*['"]`);
        return !re.test(src);
    });
    record('BLOCKER', 'legal', 'ledger disclaimer (all 5 editions)',
        missing.length === 0,
        missing.length ? `missing: ${missing.join(',')}` : 'all present');
})();

// ─── BLOCKER: smoke + render-lint pass ─────────────────────────────────
(function checkTests() {
    try {
        execSync('node test/smoke.js', { cwd: ROOT, stdio: 'pipe' });
        record('BLOCKER', 'tests', 'smoke test', true, '67 assertions');
    } catch (e) {
        record('BLOCKER', 'tests', 'smoke test', false, 'failed');
    }
    try {
        execSync('node --test test/calculators.test.js test/render-lint.test.js', { cwd: ROOT, stdio: 'pipe' });
        record('BLOCKER', 'tests', 'node --test', true, 'all pass');
    } catch (e) {
        record('BLOCKER', 'tests', 'node --test', false, 'failed');
    }
    try {
        execSync('npx tsc --noEmit -p .', { cwd: ROOT, stdio: 'pipe' });
        record('WARN', 'tests', 'tsc typecheck', true, 'clean');
    } catch (e) {
        record('WARN', 'tests', 'tsc typecheck', false,
            'failed (see `npm run typecheck`)');
    }
    try {
        execSync('npx eslint .', { cwd: ROOT, stdio: 'pipe' });
        record('WARN', 'tests', 'eslint (errors only)', true, 'clean');
    } catch (e) {
        record('WARN', 'tests', 'eslint (errors only)', false,
            'errors present (see `npm run lint`)');
    }
})();

// ─── BLOCKER: content validation passes ────────────────────────────────
(function checkValidate() {
    try {
        const out = execSync('node scripts/validate-content.js', { cwd: ROOT, stdio: 'pipe' }).toString();
        const m = out.match(/(\d+)\s+error/);
        const errs = m ? parseInt(m[1], 10) : 0;
        record('BLOCKER', 'content', 'validate-content', errs === 0, `${errs} errors`);
    } catch (e) {
        record('BLOCKER', 'content', 'validate-content', false, 'script failed');
    }
})();

// ─── WARN: dispatches not stale ────────────────────────────────────────
(function checkDispatchFreshness() {
    const files = [
        ['dispatches.json',    'en'],
        ['dispatches.ko.json', 'ko'],
        ['dispatches.ja.json', 'ja'],
        ['dispatches.pt.json', 'pt'],
        ['dispatches.es.json', 'es']
    ];
    for (const [name, ed] of files) {
        const p = `data/${name}`;
        if (!exists(p)) {
            record('WARN', 'content', `${ed} dispatches`, false, 'file missing');
            continue;
        }
        try {
            const d = JSON.parse(read(p));
            const filed = d.filed_at ? new Date(d.filed_at).getTime() : 0;
            const ageDays = Math.floor((Date.now() - filed) / 86400000);
            const ok = ageDays <= 3;
            record(ok ? 'INFO' : 'WARN', 'content', `${ed} dispatches fresh (≤3d)`,
                ok, `${ageDays} days old`);
        } catch (e) {
            record('WARN', 'content', `${ed} dispatches`, false, 'parse error');
        }
    }
})();

// ─── WARN: cafés cover all editions with ≥3 ────────────────────────────
(function checkCafeCoverage() {
    const cities = ['seoul', 'da-nang', 'bali', 'tokyo', 'lisbon'];
    for (const c of cities) {
        const p = `data/cafes-${c}.json`;
        if (!exists(p)) {
            record('WARN', 'content', `cafés-${c}`, false, 'missing');
            continue;
        }
        const arr = JSON.parse(read(p));
        const list = Array.isArray(arr) ? arr : (arr.cafes || arr.items || []);
        const ok = list.length >= 3;
        record(ok ? 'INFO' : 'WARN', 'content', `cafés-${c} ≥ 3`,
            ok, `${list.length} verified`);
    }
})();

// ─── WARN: listening tracks per city ───────────────────────────────────
(function checkListeningCoverage() {
    if (!exists('data/listening.json')) {
        record('WARN', 'content', 'listening data', false, 'missing');
        return;
    }
    const d = JSON.parse(read('data/listening.json'));
    const tracks = (d.tracks || []).length;
    const cities = (d.cities || []).length;
    record(tracks >= cities * 3 ? 'INFO' : 'WARN',
        'content', 'listening tracks ≥ cities × 3',
        tracks >= cities * 3, `${tracks} tracks / ${cities} cities`);
})();

// ─── WARN: og-cover.png present (FB/IG/Twitter scrapers reject SVG) ─────
(function checkOgImage() {
    const ok = exists('og-cover.png');
    record(ok ? 'INFO' : 'WARN',
        'marketing', 'og-cover.png (share-card image)',
        ok,
        ok ? 'present' : 'missing — run: npm install --no-save sharp && node scripts/build-og.js');
})();

// ─── WARN: founder secrets — surfaced as INFO (we can't verify remote) ─
(function infoSecrets() {
    const need = [
        ['CLOUDFLARE_API_TOKEN', 'D1 daily backup workflow'],
        ['CLOUDFLARE_ACCOUNT_ID', 'D1 daily backup workflow'],
        ['EDITOR_TOKEN',         'Sunday digest /digest/send auth'],
        ['DIGEST_SEND_TOKEN',    'Sunday digest GH Action cron'],
        ['RESEND_API_KEY',       'Sunday digest email sending'],
        ['GEMINI_KEY',           'Dispatch refresh workflow'],
        ['PEXELS_KEY',           'Listening room fetch workflow'],
        ['FREESOUND_TOKEN',      'Listening room fetch workflow']
    ];
    for (const [k, why] of need) {
        record('INFO', 'secrets', `secret ${k} set`, null, why);
    }
})();

// ─── WARN: editor on-leave page exists ─────────────────────────────────
(function checkEditorOnLeave() {
    const ok = exists('editor-on-leave.html');
    record('INFO', 'sustainability', 'editor-on-leave.html exists',
        ok, ok ? 'present' : 'consider adding');
})();

// ─── Render ────────────────────────────────────────────────────────────
if (asJson) {
    console.log(JSON.stringify({ results, summary: summary() }, null, 2));
    process.exit(blockerFails() ? 1 : 0);
}

const BLOCK = results.filter(r => r.severity === 'BLOCKER');
const WARN  = results.filter(r => r.severity === 'WARN');
const INFO  = results.filter(r => r.severity === 'INFO');

function fmt(r) {
    const okMark = r.ok === null ? '·' : (r.ok ? '✓' : '✗');
    const sevPad = r.severity.padEnd(7);
    const areaPad = r.area.padEnd(15);
    const namePad = r.name.padEnd(40);
    return `  ${okMark}  ${sevPad}  ${areaPad}  ${namePad}  ${r.detail || ''}`;
}

console.log('');
console.log('  saudade · launch readiness');
console.log('  ' + '─'.repeat(78));
console.log('');
console.log('  BLOCKERS  ' + '─'.repeat(70));
BLOCK.forEach(r => console.log(fmt(r)));
console.log('');
console.log('  WARNINGS  ' + '─'.repeat(70));
WARN.forEach(r => console.log(fmt(r)));
console.log('');
console.log('  INFO (founder verify)  ' + '─'.repeat(57));
INFO.forEach(r => console.log(fmt(r)));
console.log('');

const s = summary();
console.log(`  Summary: ${s.blockerPass}/${s.blockerTotal} blockers · ${s.warnPass}/${s.warnTotal} warnings · ${s.infoCount} info items`);
console.log('');
if (s.blockerPass < s.blockerTotal) {
    console.log('  ✗ NOT READY — fix blockers above.');
    process.exit(1);
}
if (s.warnPass < s.warnTotal) {
    console.log('  ⚠ Ready with warnings. Founder may choose to ship anyway.');
} else {
    console.log('  ✓ Software-checkable items pass. Founder decisions remain.');
}
console.log('');
console.log('  Founder-only items not checked here:');
console.log('    1. Rotate exposed Gemini key (Cloud Console).');
console.log('    2. Decide intent in one sentence: craft / editorial business / venture.');
console.log('    3. Decide editorial cadence: daily filing sustainable for 12+ months?');
console.log('    4. Set workflow secrets (see INFO rows above).');
console.log('');

function summary() {
    return {
        blockerTotal: BLOCK.length,
        blockerPass:  BLOCK.filter(r => r.ok).length,
        warnTotal:    WARN.length,
        warnPass:     WARN.filter(r => r.ok).length,
        infoCount:    INFO.length
    };
}
function blockerFails() {
    return BLOCK.some(r => r.ok === false);
}
