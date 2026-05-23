#!/usr/bin/env node
/**
 * saudade · import bulk cafe CSV → candidates file (per city).
 *
 * Input format (the user's CSVs):
 *   카페이름, 평점, 주소, 와이파이, 콘센트, 화장실, 특이사항
 *
 * Output:  data/cafes-{city}.candidates.json
 *   { source: 'user-csv', generated: <today>, city: ..., cafes: [...] }
 *
 * Each candidate carries:
 *   id, name, city, neighborhood (parsed from address), address,
 *   rating, two_lines (derived), amenities, notes_kr (preserved),
 *   verified: false  ← only flipped to true by verify-cafes.js after
 *                      Google Places API confirms the place exists.
 *
 * Constitution §3: "we list only what the editor has read carefully."
 * That now allows vetted_at (review-based) but ALSO requires that the
 * listed place is real. Hence verify-cafes.js before promoting from
 * candidates to data/cafes-{city}.json.
 *
 * Usage:
 *   node scripts/import-cafe-csv.js <csv-path> <city-slug> <city-display>
 *
 * Example:
 *   node scripts/import-cafe-csv.js ./seoul.csv seoul Seoul
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

function slugify(s) {
    return String(s).toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9가-힣\s|&'-]/g, '')
        .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        .slice(0, 80);
}

function parseAmenities(wifi, outlet, notes) {
    const flags = [];
    if (/제공|있|있음|있다|wifi|wi-fi/i.test(wifi)) flags.push('WIFI');
    if (/완비|매립|빌트|보유|구비|배치|충전|콘센트|있음|있다|outlet|plug/i.test(outlet)) {
        flags.push('OUTLET');
    }
    if (/조용|한적|차분|정숙|단조|평온|무소음|고요|평일.*한산|숨은|아지트/.test(notes)) {
        flags.push('QUIET');
    }
    if (/24시간|24h|밤샘|새벽|심야/.test(notes)) flags.push('24H');
    return flags.join(' · ');
}

function deriveTwoLines(notes) {
    if (!notes) return ['', ''];
    const t = notes.trim().replace(/\s+/g, ' ');
    if (t.length <= 36) return [t, ''];
    // Find a natural break: comma, '.', '·', or space near middle
    let cut = -1;
    for (const sep of [', ', '. ', '·', ' ']) {
        const found = t.indexOf(sep, 24);
        if (found > 0 && found <= 50) { cut = found; break; }
    }
    if (cut < 0) cut = 36;
    const line1 = t.slice(0, cut).trim().replace(/[,.·]$/, '');
    const line2 = t.slice(cut).trim().replace(/^[,.·]\s*/, '').slice(0, 60);
    return [line1, line2];
}

function parseNeighborhood(address, citySlug) {
    // Heuristic: take whatever comes after the city name, or last 2 tokens.
    // For Korean: "서울 중구 수표로6길 24-1" → "중구" (district)
    // For others: best-effort.
    if (/^서울/.test(address)) {
        const m = address.match(/^서울\s+([\S]+구)/);
        if (m) return m[1];
    }
    // Default: last 3 tokens minus the city itself
    const tokens = address.split(/\s+/).filter(Boolean);
    return tokens.slice(-2).join(' ');
}

function importCsv(csvPath, citySlug, cityDisplay) {
    const raw = fs.readFileSync(csvPath, 'utf8');
    // Drop optional header text + CSV header row
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

    let startIdx = 0;
    // Skip prose header if present (e.g. "서울에 있는 카페 데이터")
    while (startIdx < lines.length && !lines[startIdx].startsWith('카페이름,')) startIdx++;
    if (startIdx >= lines.length) {
        console.error('  CSV header row not found.');
        return;
    }
    startIdx++;  // skip header itself

    const cafes = [];
    const seen = new Set();

    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length < 7) {
            console.error(`  Line ${i + 1}: only ${parts.length} fields, skipping`);
            continue;
        }
        const [name, rating, address, wifi, outlet, toilet, ...rest] = parts;
        const notes = rest.join(',').trim();

        let id = `${slugify(name)}-${citySlug}`;
        if (seen.has(id)) id = `${id}-${cafes.length}`;
        seen.add(id);

        const amenities = parseAmenities(wifi, outlet, notes);
        const [line1, line2] = deriveTwoLines(notes);

        cafes.push({
            id,
            name: name.trim(),
            city: cityDisplay,
            neighborhood: parseNeighborhood(address, citySlug),
            address: address.trim(),
            rating: parseFloat(rating) || null,
            verified: false,
            visited_at: null,
            vetted_at: null,
            two_lines: [line1, line2],
            amenities,
            notes_kr: notes,
            wifi_csv: wifi.trim(),
            outlet_csv: outlet.trim(),
            toilet_csv: toilet.trim(),
            source: 'user-csv'
        });
    }

    const out = {
        generated: TODAY,
        source: 'user-csv',
        city: cityDisplay,
        note: `Imported ${cafes.length} candidates from user CSV. NOT yet verified against Google Places. Run scripts/verify-cafes.js with GOOGLE_PLACES_KEY to confirm existence + add lat/lng + promote to data/cafes-${citySlug}.json.`,
        total: cafes.length,
        cafes
    };

    const outPath = path.join(ROOT, 'data', `cafes-${citySlug}.candidates.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
    console.log(`[ok] ${cafes.length} candidates → ${path.relative(ROOT, outPath)}`);
}

const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('Usage: node scripts/import-cafe-csv.js <csv-path> <city-slug> <city-display>');
    console.error('Example: node scripts/import-cafe-csv.js ./seoul.csv seoul Seoul');
    process.exit(2);
}
importCsv(args[0], args[1], args[2]);
