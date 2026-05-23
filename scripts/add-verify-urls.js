#!/usr/bin/env node
/**
 * saudade · enrich candidate cafes with manual-verify URLs.
 *
 * For each entry in data/cafes-{city}.candidates.json adds:
 *   google_maps_search_url   — every city, primary source of truth
 *   naver_search_url         — Seoul/Korean entries only
 *   kakao_search_url         — Seoul/Korean entries only
 *
 * The URLs are deterministic query encodings — they NEVER point at a
 * specific place_id, only at search queries. So if the cafe doesn't
 * exist, the user clicks and Google/Kakao/Naver returns "no results"
 * — they never land on a wrong place by accident.
 *
 * After this script runs, the editor can spot-check candidates by
 * clicking the URL in any JSON viewer. Combined with verify-cafes.js
 * (Google Places API), this gives two layers of verification.
 *
 * Usage:
 *   node scripts/add-verify-urls.js                # all cities
 *   node scripts/add-verify-urls.js seoul tokyo    # named cities
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SUPPORTED = ['seoul', 'da-nang', 'bali', 'tokyo', 'lisbon'];

// Known district keywords per city — addresses that don't contain any
// of these are flagged for editor review. Not a fail, just a signal.
const KNOWN_DISTRICTS = {
    'Seoul':   ['중구', '종로구', '용산구', '강남구', '성동구', '마포구', '서대문구', '광진구',
                '동작구', '서초구', '송파구', '강서구', '영등포구', '관악구', '구로구',
                '금천구', '도봉구', '강북구', '노원구', '중랑구', '동대문구', '성북구',
                '은평구', '양천구', '강동구'],
    'Da Nang': ['Hải Châu', 'Ngũ Hành Sơn', 'Sơn Trà', 'Thanh Khê', 'Liên Chiểu',
                'Cẩm Lệ', 'Hòa Vang', 'Hội An', 'Hoi An', 'Cam An', 'Cẩm Châu',
                'Cẩm Sơn', 'Minh An'],
    'Bali':    ['Canggu', 'Pererenan', 'Berawa', 'Ubud', 'Uluwatu', 'Seminyak',
                'Kuta', 'Sanur', 'Denpasar', 'Penestanan', 'Umalas', 'Tegallalang',
                'Sayan', 'Keliki'],
    'Tokyo':   ['Shibuya', 'Shinjuku', 'Minato', 'Chiyoda', 'Chuo', 'Taito',
                'Setagaya', 'Meguro', 'Sumida', 'Koto', 'Shinagawa', 'Nakano',
                'Suginami', 'Toshima', 'Mitaka', 'Koganei'],
    'Lisbon':  ['Alfama', 'Bairro Alto', 'Chiado', 'Baixa', 'Belém', 'Lapa',
                'Estrela', 'Príncipe Real', 'Cais do Sodré', 'Campolide',
                'Restelo', 'Anjos', 'Mouraria', 'Santos', 'Marvila']
};

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }

function enrich(citySlug) {
    const p = path.join(ROOT, 'data', `cafes-${citySlug}.candidates.json`);
    if (!fs.existsSync(p)) {
        console.error(`[skip] no candidates for ${citySlug}`);
        return;
    }
    const j = loadJson(p);
    const known = KNOWN_DISTRICTS[j.city] || [];
    let flagged = 0;
    for (const c of j.cafes) {
        const q = encodeURIComponent(`${c.name} ${c.city} ${c.address}`);
        c.google_maps_search_url = `https://www.google.com/maps/search/${q}`;
        if (j.city === 'Seoul') {
            c.kakao_search_url = `https://map.kakao.com/?q=${encodeURIComponent(c.name + ' ' + c.address)}`;
            c.naver_search_url = `https://map.naver.com/p/search/${encodeURIComponent(c.name + ' ' + c.address)}`;
        }
        // Heuristic: address looks plausible for the city?
        //   · contains a known district keyword, OR
        //   · contains the city's postal-code pattern.
        // Two signals because each city formats addresses differently:
        // Lisbon uses postal codes (1200-XXX), Seoul uses 구 names, etc.
        const addr = c.address || '';
        const districtHit = known.some(k => addr.includes(k));
        const postalHit = j.city === 'Lisbon' ? /1[0-9]{3}-[0-9]{3}/.test(addr) :
                          j.city === 'Tokyo'  ? /\b\d{3}-\d{4}\b|chome|chōme|Tokyo|東京/i.test(addr) :
                          j.city === 'Seoul'  ? /서울|Seoul/.test(addr) :
                          j.city === 'Bali'   ? /Bali|Indonesia|Jl\./.test(addr) :
                          j.city === 'Da Nang' ? /Đà Nẵng|Da Nang|Hội An|Hoi An/.test(addr) :
                          false;
        const hit = districtHit || postalHit;
        c.address_district_match = hit;
        if (!hit) flagged++;
    }
    saveJson(p, j);
    console.log(`[${citySlug}] ${j.cafes.length} enriched · ${flagged} flagged (address didn't match known district)`);
}

const args = process.argv.slice(2);
const cities = args.length ? args.filter(a => SUPPORTED.includes(a)) : SUPPORTED;
for (const c of cities) enrich(c);
