#!/usr/bin/env node
// SAUDADE · v7 §4.1 + §17.5 — token contrast verifier
//
// 모든 paper × token pair 의 WCAG contrast 계산. 미달 시 exit 1 (CI fail).
// 사용:
//   node scripts/check-contrast.js
//   pnpm contrast-check       (package.json scripts 등록 시)

'use strict';

function lumHex(hex) {
    const r = parseInt(hex.substr(1, 2), 16) / 255;
    const g = parseInt(hex.substr(3, 2), 16) / 255;
    const b = parseInt(hex.substr(5, 2), 16) / 255;
    const f = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
    const l1 = lumHex(a), l2 = lumHex(b);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
}

// v7 §3 — 5 에디션 토큰 (saudade-edition-tokens.css 와 동기화)
const EDITIONS = [
    { name: '영문 en',     paper: '#F2EEE3', ink: '#16151A', boneD: '#4A4540', bone: '#6F6A60', accent: '#9A3324' },
    { name: '한국 ko',     paper: '#F0EBE0', ink: '#1A1815', boneD: '#45413B', bone: '#6E6960', accent: '#3E6147' },
    { name: '일본 ja',     paper: '#F4F0E6', ink: '#1B1A1F', boneD: '#45413A', bone: '#6F6A60', accent: '#2B3A55' },
    { name: '포르투갈 pt', paper: '#EDE6D3', ink: '#2A1D14', boneD: '#423831', bone: '#6E6055', accent: '#3E5C76' },
    { name: '스페인 es',   paper: '#F1ECDB', ink: '#1F1A12', boneD: '#443D33', bone: '#706A5D', accent: '#8B2E1F' }
];
// base saudade-tokens.css 폴백
const BASE = { name: 'base 폴백', paper: '#F2EEE3', ink: '#16151A', boneD: '#4A4540', bone: '#6F6A60', accent: '#9A3324' };

// v7 §4.1 — 대비비 락
const TARGETS = {
    ink:    11,   // ≥11 (AAA body)
    boneD:   7,   // ≥7  (AAA secondary)
    accent:  5,   // ≥5  (AA accent)
    bone:    4.5  // ≥4.5 (AA — 단, PR1.5 옵션 4 후 비-텍스트 데코 전용)
};

function check(e) {
    const fails = [];
    const out = {};
    for (const k of Object.keys(TARGETS)) {
        const r = ratio(e.paper, e[k]);
        out[k] = r;
        if (r < TARGETS[k]) fails.push(`${k} ${r.toFixed(2)} < ${TARGETS[k]}`);
    }
    return { name: e.name, ratios: out, fails };
}

let totalFail = 0;
console.log('=== v7 §4.1 / §17.5 Contrast Check ===\n');
console.log('  edition           ink (≥11)  bone-d (≥7)  bone (≥4.5)*  accent (≥5)');
console.log('  ' + '-'.repeat(76));
for (const e of [BASE, ...EDITIONS]) {
    const res = check(e);
    const fmt = (k) => res.ratios[k].toFixed(2).padStart(5) + (res.ratios[k] >= TARGETS[k] ? ' ✓' : ' ✗');
    console.log('  ' + e.name.padEnd(18) +
        fmt('ink') + '   ' + fmt('boneD') + '     ' + fmt('bone') + '     ' + fmt('accent'));
    if (res.fails.length) totalFail += res.fails.length;
}
console.log('\n  * bone 은 PR1.5 옵션 4 이후 비-텍스트 데코 전용 — 4.5 미달 시 경고만 (fail X)');
console.log('  cf. v7 §4.1: bone-d 은 모든 텍스트 라벨, accent 는 화면당 ≤2회');
console.log();

// bone fail 은 경고만 (text 사용 X 이므로)
let hard = 0;
for (const e of [BASE, ...EDITIONS]) {
    const res = check(e);
    for (const f of res.fails) {
        if (!f.startsWith('bone ')) hard++;   // bone (not bone-d) 은 soft
    }
}

if (hard > 0) {
    console.log(`✗ ${hard} hard fail(s) — text token contrast 미달`);
    process.exit(1);
} else {
    console.log('✓ All hard targets met (text tokens pass §4.1)');
    process.exit(0);
}
