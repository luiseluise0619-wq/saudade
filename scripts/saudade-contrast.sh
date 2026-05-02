#!/usr/bin/env bash
# SAUDADE · CONTRAST CHECK (Handoff v2 §3.1)
# 5 edition 각 paper × ink / paper × bone-d / paper × bone / paper × accent
# WCAG ratios — 표 §3.1 기준:
#   ink  × paper ≥ 11:1 (본문)
#   bone-d × paper ≥ 7:1 (메타 라벨)
#   bone × paper ≥ 4.5:1 (보조 텍스트)
#   accent × paper ≥ 5:1 (액센트)
#
# 사용: bash scripts/saudade-contrast.sh
set -u

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RST=$'\033[0m'
fail=0
ok()   { printf '%s%s%s\n' "$GRN" "$*" "$RST"; }
err()  { printf '%s%s%s\n' "$RED" "$*" "$RST"; fail=1; }
warn() { printf '%s%s%s\n' "$YEL" "$*" "$RST"; }

# Pure-node WCAG contrast — 별도 의존성 없이 node 만으로 계산
node - <<'JS'
const fs = require('fs');
const css = fs.readFileSync('./saudade-edition-tokens.css', 'utf8');

// edition-en / edition-ko / edition-ja / edition-pt / edition-es 각 블록의
// --paper / --ink / --bone / --bone-d / --accent 추출.
function pickHex(s) {
    const m = s.match(/#([0-9a-fA-F]{6})/);
    return m ? m[1].toLowerCase() : null;
}
function blockFor(edId) {
    const re = new RegExp('body\\.edition-' + edId + '[^{]*\\{([\\s\\S]*?)\\}', 'm');
    const m = css.match(re);
    return m ? m[1] : '';
}
function tokenFrom(block, name) {
    const re = new RegExp('--' + name + ':\\s*([^;]+);');
    const m = block.match(re);
    return m ? m[1].trim() : null;
}

// hex → relative luminance (WCAG 2.1)
function lum(hex) {
    const r = parseInt(hex.slice(0,2), 16) / 255;
    const g = parseInt(hex.slice(2,4), 16) / 255;
    const b = parseInt(hex.slice(4,6), 16) / 255;
    function ch(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function ratio(hexA, hexB) {
    const la = lum(hexA), lb = lum(hexB);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

const editions = ['en', 'ko', 'ja', 'pt', 'es'];
const REQUIREMENTS = [
    { name: 'ink',    label: 'BODY',       min: 11.0 },
    { name: 'bone-d', label: 'META',       min: 7.0  },
    { name: 'bone',   label: 'SECONDARY',  min: 4.5  },
    { name: 'accent', label: 'ACCENT',     min: 5.0  }
];

let totalFail = 0;
for (const ed of editions) {
    const block = blockFor(ed);
    if (!block) { console.log('SKIP', ed); continue; }
    const paperRaw = tokenFrom(block, 'paper');
    const paperHex = paperRaw && pickHex(paperRaw);
    if (!paperHex) { console.log('SKIP', ed, '(no paper)'); continue; }

    console.log(`\n== EDITION ${ed.toUpperCase()} ==  paper #${paperHex}`);
    for (const req of REQUIREMENTS) {
        const tokRaw = tokenFrom(block, req.name);
        const hex = tokRaw && pickHex(tokRaw);
        if (!hex) { console.log(`   ${req.label.padEnd(10)} —`); continue; }
        const r = ratio(paperHex, hex);
        const passed = r >= req.min;
        const marker = passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
        console.log(`   ${marker} ${req.label.padEnd(10)} ${req.name.padEnd(8)} #${hex}  ratio ${r.toFixed(2)}:1  (need ${req.min}:1)`);
        if (!passed) totalFail++;
    }
}

console.log('');
if (totalFail > 0) {
    console.log(`\x1b[31m━━━ ${totalFail} contrast failures ━━━\x1b[0m`);
    process.exit(1);
} else {
    console.log('\x1b[32m━━━ ALL CONTRAST PASS ━━━\x1b[0m');
    process.exit(0);
}
JS

if [ $? -ne 0 ]; then exit 1; fi
exit 0
