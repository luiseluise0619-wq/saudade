// saudade · calculator unit tests (node --test)
//
// Loads the four browser-side calculator modules under a minimal DOM stub
// and runs them against a curated set of cases — golden path, off-by-one,
// open stays, leap year, country-tax-year overrides, overlapping policies,
// month boundary edges. If any assert fails, CI fails.
//
// Run:  npm test
//       node --test test/calculators.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ─── Browser-stub sandbox ────────────────────────────────────────────────
function loadModules(...files) {
    const sandbox = {
        console,
        document: {
            addEventListener: () => {},
            getElementById: () => null,
            createElement: () => ({ style: {}, classList: { add: () => {} }, innerHTML: '', appendChild: () => {} }),
            head: { appendChild: () => {} },
            readyState: 'complete'
        },
        localStorage: { _: {}, getItem(k) { return this._[k] || null; }, setItem(k, v) { this._[k] = v; }, removeItem(k) { delete this._[k]; } }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of files) {
        const src = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
        vm.runInContext(src, sandbox, { filename: f });
    }
    return sandbox;
}

// ════════════════════════════════════════════════════════════════════════
test('Schengen calculator', async (t) => {
    const sb = loadModules('saudade-schengen.js');
    const SCH = sb.SAUDADE_SCHENGEN;
    assert.ok(SCH, 'SAUDADE_SCHENGEN exposed');

    await t.test('golden: 30 + 15 days, plenty of room', () => {
        const r = SCH.calc({
            stays: [
                { in: '2026-01-01', out: '2026-01-30' },
                { in: '2026-03-01', out: '2026-03-15' }
            ],
            ref: '2026-04-01'
        });
        assert.equal(r.used_in_window, 45);
        assert.equal(r.remaining, 45);
        assert.equal(r.currently_inside, false);
        assert.equal(r.max, 90);
        assert.equal(r.window_days, 180);
    });

    await t.test('cap exactly at 90/90', () => {
        const r = SCH.calc({
            stays: [{ in: '2026-01-01', out: '2026-03-31' }],
            ref: '2026-04-01'
        });
        assert.equal(r.used_in_window, 90);
        assert.equal(r.remaining, 0);
        // 90 days starting Jan 1 — the first day rolls off when we reach the
        // 181st day window from Jan 1 = Jun 30. Calculator returns the next
        // safe entry as the date where used drops below cap.
        assert.equal(r.next_safe_entry_after, '2026-06-30');
        // Full reset (used = 0) is 180 days after the LAST stay day.
        assert.ok(r.days_until_full_reset > 0 && r.days_until_full_reset < 365);
    });

    await t.test('open stay (no out → ref)', () => {
        const r = SCH.calc({
            stays: [{ in: '2026-04-15' }],
            ref: '2026-05-03'
        });
        assert.equal(r.used_in_window, 19);   // 15..30=16 + 1..3=3 = 19 inclusive
        assert.equal(r.currently_inside, true);
    });

    await t.test('endpoint inclusivity (1-day stay)', () => {
        const r = SCH.calc({
            stays: [{ in: '2026-05-03', out: '2026-05-03' }],
            ref: '2026-05-03'
        });
        assert.equal(r.used_in_window, 1, 'a single calendar day counts as 1');
        assert.equal(r.currently_inside, true);
    });

    await t.test('out before in is ignored', () => {
        const r = SCH.calc({
            stays: [{ in: '2026-05-10', out: '2026-05-01' }],
            ref: '2026-05-15'
        });
        assert.equal(r.used_in_window, 0);
    });

    await t.test('window output has 180 timeline entries', () => {
        const r = SCH.calc({ stays: [], ref: '2026-05-01' });
        assert.equal(r.timeline.length, 180);
        assert.equal(r.window_start, '2025-11-03');
        assert.equal(r.window_end,   '2026-05-01');
    });
});

// ════════════════════════════════════════════════════════════════════════
test('Tax 183-day counter', async (t) => {
    const sb = loadModules('saudade-tax.js');
    const TAX = sb.SAUDADE_TAX;

    await t.test('PT 227 days in 2026 → over_threshold', () => {
        const r = TAX.calc({
            stays: [
                { country: 'PT', in: '2026-01-01', out: '2026-04-30' },   // 120
                { country: 'KR', in: '2026-05-01', out: '2026-05-15' },   // 15
                { country: 'PT', in: '2026-06-01', out: '2026-09-15' }    // 107
            ],
            ref: '2026-10-01'
        });
        const pt = r.per_country.find(p => p.country === 'PT');
        const kr = r.per_country.find(p => p.country === 'KR');
        assert.equal(pt.days_in_year, 227);
        assert.equal(pt.over_threshold, true);
        assert.equal(kr.days_in_year, 15);
        assert.equal(kr.over_threshold, false);
        assert.equal(kr.near_threshold, false);
    });

    await t.test('UK tax year 6 Apr → 5 Apr', () => {
        const r = TAX.calc({
            stays: [{ country: 'GB', in: '2026-04-06', out: '2026-12-31' }],
            ref: '2026-12-31', year: 2026
        });
        const gb = r.per_country[0];
        assert.equal(gb.tax_year_start, '2026-04-06');
        assert.equal(gb.tax_year_end,   '2027-04-05');
        assert.equal(gb.days_in_year, 270);
        assert.equal(gb.over_threshold, true);
    });

    await t.test('AU tax year 1 Jul', () => {
        const r = TAX.calc({
            stays: [{ country: 'AU', in: '2026-07-01', out: '2026-12-31' }],
            ref: '2026-12-31', year: 2026
        });
        const au = r.per_country[0];
        assert.equal(au.tax_year_start, '2026-07-01');
        assert.ok(au.days_in_year >= 184);   // 31+31+30+31+30+31 = 184
    });

    await t.test('country sort is alphabetical', () => {
        const r = TAX.calc({
            stays: [
                { country: 'JP', in: '2026-01-01', out: '2026-01-10' },
                { country: 'AT', in: '2026-02-01', out: '2026-02-10' },
                { country: 'PT', in: '2026-03-01', out: '2026-03-10' }
            ],
            ref: '2026-04-01'
        });
        // Cross-realm Array — assert.deepEqual under strict mode requires
        // same prototype which the vm sandbox breaks. Compare via join.
        assert.equal(r.per_country.map(p => p.country).join(','), 'AT,JP,PT');
    });

    await t.test('near_threshold band is [150, 183)', () => {
        const stays = [{ country: 'DE', in: '2026-01-01', out: '2026-06-01' }];   // 152 days
        const r = TAX.calc({ stays, ref: '2026-12-01', year: 2026 });
        const de = r.per_country[0];
        assert.equal(de.days_in_year, 152);
        assert.equal(de.near_threshold, true);
        assert.equal(de.over_threshold, false);
    });
});

// ════════════════════════════════════════════════════════════════════════
test('Insurance gap counter', async (t) => {
    const sb = loadModules('saudade-coverage.js');
    const COV = sb.SAUDADE_COVERAGE;

    await t.test('Q1 + Q3 covered, Q2 gap', () => {
        const r = COV.insurance({
            policies: [
                { provider: 'A', in: '2026-01-01', out: '2026-03-31' },
                { provider: 'B', in: '2026-07-01', out: '2026-09-30' }
            ],
            ref: '2026-09-30', year: 2026
        });
        assert.equal(r.covered_days,    182);   // 90 + 92
        assert.equal(r.gap_days,        91);    // Apr 1 → Jun 30
        assert.equal(r.longest_gap_days, 91);
        assert.equal(r.gaps.length, 1);
        assert.equal(r.gaps[0].from, '2026-04-01');
        assert.equal(r.gaps[0].to,   '2026-06-30');
        assert.equal(r.gaps[0].days, 91);
    });

    await t.test('overlapping policies dedupe correctly', () => {
        const r = COV.insurance({
            policies: [
                { provider: 'A', in: '2026-01-01', out: '2026-02-15' },   // 46
                { provider: 'B', in: '2026-02-01', out: '2026-03-15' }    // 43
            ],
            ref: '2026-03-15', year: 2026
        });
        // Jan 1 → Mar 15 inclusive = 31+28+15 = 74
        assert.equal(r.covered_days, 74);
        assert.equal(r.gap_days, 0);
    });

    await t.test('gap before first policy is counted', () => {
        const r = COV.insurance({
            policies: [{ provider: 'A', in: '2026-04-01', out: '2026-06-30' }],
            ref: '2026-06-30', year: 2026
        });
        assert.equal(r.gap_days, 90);   // Jan 1 → Mar 31
        assert.equal(r.gaps[0].from, '2026-01-01');
        assert.equal(r.gaps[0].to,   '2026-03-31');
    });

    await t.test('multiple gaps preserve chronology', () => {
        const r = COV.insurance({
            policies: [
                { provider: 'A', in: '2026-02-01', out: '2026-02-28' },
                { provider: 'B', in: '2026-05-01', out: '2026-05-31' },
                { provider: 'C', in: '2026-08-01', out: '2026-08-31' }
            ],
            ref: '2026-09-30', year: 2026
        });
        assert.ok(r.gaps.length >= 3);
        // Gaps must be in order.
        for (let i = 1; i < r.gaps.length; i++) {
            assert.ok(r.gaps[i].from > r.gaps[i - 1].to);
        }
    });
});

// ════════════════════════════════════════════════════════════════════════
test('Pension month counter', async (t) => {
    const sb = loadModules('saudade-coverage.js');
    const COV = sb.SAUDADE_COVERAGE;

    await t.test('KR-NPS 12 + 6 = 18 months', () => {
        const r = COV.pension({
            filings: [
                { scheme: 'KR-NPS', country: 'KR', in: '2024-01-01', out: '2024-12-31' },
                { scheme: 'KR-NPS', country: 'KR', in: '2026-01-01', out: '2026-06-30' }
            ],
            ref: '2026-06-30'
        });
        assert.equal(r.per_scheme[0].months_contributed, 18);
        assert.equal(r.per_scheme[0].to_120_months, 102);
    });

    await t.test('partial months count as whole', () => {
        const r = COV.pension({
            filings: [{ scheme: 'KR-NPS', in: '2026-01-15', out: '2026-01-20' }],
            ref: '2026-01-31'
        });
        assert.equal(r.per_scheme[0].months_contributed, 1);
    });

    await t.test('vested at 120, capped to_240', () => {
        // 121 months
        const r = COV.pension({
            filings: [{ scheme: 'KR-NPS', in: '2014-01-01', out: '2024-01-31' }],
            ref: '2024-01-31'
        });
        assert.ok(r.per_scheme[0].months_contributed >= 120);
        assert.equal(r.per_scheme[0].to_120_months, 0);
        assert.ok(r.per_scheme[0].to_240_months > 0);
    });

    await t.test('overlapping filings to same scheme dedupe', () => {
        const r = COV.pension({
            filings: [
                { scheme: 'UK-NIC', in: '2026-01-01', out: '2026-06-30' },
                { scheme: 'UK-NIC', in: '2026-04-01', out: '2026-08-31' }
            ],
            ref: '2026-08-31'
        });
        assert.equal(r.per_scheme[0].months_contributed, 8);   // Jan-Aug
    });

    await t.test('two schemes count separately', () => {
        const r = COV.pension({
            filings: [
                { scheme: 'KR-NPS', in: '2026-01-01', out: '2026-03-31' },
                { scheme: 'UK-NIC', in: '2026-04-01', out: '2026-09-30' }
            ],
            ref: '2026-09-30'
        });
        assert.equal(r.per_scheme.length, 2);
        const kr = r.per_scheme.find(p => p.scheme === 'KR-NPS');
        const uk = r.per_scheme.find(p => p.scheme === 'UK-NIC');
        assert.equal(kr.months_contributed, 3);
        assert.equal(uk.months_contributed, 6);
    });
});
