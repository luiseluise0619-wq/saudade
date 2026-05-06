#!/usr/bin/env node
/**
 * saudade · build Seoul café candidate list with click-through URLs.
 *
 * Compiles ~140 well-known Seoul cafés across 14 neighborhoods from
 * editor research. Names may include places that have closed or moved —
 * each entry carries a Kakao + Naver search URL for the editor to click,
 * verify rating + existence, then move good ones into cafes-seoul.json.
 *
 *   node scripts/build-cafe-candidates.js
 *
 * Output:
 *   data/cafes-seoul.candidates.json
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'data', 'cafes-seoul.candidates.json');

// Editor research notes:
//   tags = ["specialty"]      = 3rd-wave / pour-over focus
//          ["roastery"]       = roasts on premises
//          ["design"]         = notable interior / architecture
//          ["hanok"]          = traditional Korean house
//          ["quiet"]          = magazine-tone calm
//          ["bookshop"]       = books on site
//          ["indie"]          = small operator
const RAW = [
    // ── Yeonnam-dong (연남동) ───────────────────────────────
    { name: 'Manufact Coffee Roasters', neighborhood: 'Yeonnam-dong', tags: ['specialty','roastery'] },
    { name: 'Coffee Libre Yeonnam', neighborhood: 'Yeonnam-dong', tags: ['specialty','roastery'] },
    { name: 'Lowkey', neighborhood: 'Yeonnam-dong', tags: ['specialty','quiet'] },
    { name: 'Aboutee', neighborhood: 'Yeonnam-dong', tags: ['indie'] },
    { name: 'Café Onion Yeonnam', neighborhood: 'Yeonnam-dong', tags: ['design','landmark'] },
    { name: 'Layered Yeonnam', neighborhood: 'Yeonnam-dong', tags: ['design','bakery'] },
    { name: 'Pomerolo', neighborhood: 'Yeonnam-dong', tags: ['design'] },
    { name: 'Yeonnam Bangagan', neighborhood: 'Yeonnam-dong', tags: ['hanok','quiet'] },
    { name: 'Cobalt Box', neighborhood: 'Yeonnam-dong', tags: ['indie'] },
    { name: 'Magpie & Tiger Yeonnam', neighborhood: 'Yeonnam-dong', tags: ['tea'] },

    // ── Seongsu-dong (성수동) ───────────────────────────────
    { name: 'Café Onion Seongsu', neighborhood: 'Seongsu-dong', tags: ['design','landmark'] },
    { name: 'Daelim Changgo', neighborhood: 'Seongsu-dong', tags: ['design','landmark'] },
    { name: 'Mesh Coffee', neighborhood: 'Seongsu-dong', tags: ['specialty','roastery'] },
    { name: 'Center Coffee Seongsu', neighborhood: 'Seongsu-dong', tags: ['specialty'] },
    { name: 'Blue Bottle Seongsu', neighborhood: 'Seongsu-dong', tags: ['specialty','design'] },
    { name: 'Manufact Coffee Seongsu', neighborhood: 'Seongsu-dong', tags: ['specialty','roastery'] },
    { name: 'LCDC Seoul', neighborhood: 'Seongsu-dong', tags: ['design','landmark'] },
    { name: 'Café Sukkara', neighborhood: 'Seongsu-dong', tags: ['indie'] },
    { name: 'Café Halfmile', neighborhood: 'Seongsu-dong', tags: ['indie','specialty'] },
    { name: 'Bloomster', neighborhood: 'Seongsu-dong', tags: ['design'] },
    { name: 'Felt Coffee Seongsu', neighborhood: 'Seongsu-dong', tags: ['specialty'] },
    { name: 'Pierre Hermé Seongsu', neighborhood: 'Seongsu-dong', tags: ['bakery'] },

    // ── Bukchon / Samcheong (북촌·삼청동) ───────────────────
    { name: 'Café Onion Anguk', neighborhood: 'Anguk-dong', tags: ['design','landmark','hanok'] },
    { name: 'Blue Bottle Samcheong', neighborhood: 'Samcheong-dong', tags: ['specialty','design'] },
    { name: 'Mil Toast Samcheong', neighborhood: 'Samcheong-dong', tags: ['bakery'] },
    { name: 'Layered Bukchon', neighborhood: 'Bukchon', tags: ['bakery','design'] },
    { name: 'Tea Therapy Bukchon', neighborhood: 'Bukchon', tags: ['tea','quiet'] },
    { name: 'Cha Masineun Tteul', neighborhood: 'Bukchon', tags: ['hanok','tea','quiet'] },
    { name: 'Ssamzie-gil Café', neighborhood: 'Insa-dong', tags: ['landmark'] },
    { name: 'Coffee Hanyakbang Bukchon', neighborhood: 'Bukchon', tags: ['specialty','quiet'] },
    { name: 'Onion Anguk Garden', neighborhood: 'Anguk-dong', tags: ['design'] },
    { name: 'Deep Blue Lake', neighborhood: 'Anguk-dong', tags: ['quiet','specialty'] },
    { name: 'Queens Bukchon', neighborhood: 'Bukchon', tags: ['hanok'] },

    // ── Hannam-dong (한남동) ────────────────────────────────
    { name: 'Anthracite Hannam', neighborhood: 'Hannam-dong', tags: ['specialty','roastery'] },
    { name: 'Felt Coffee Hannam', neighborhood: 'Hannam-dong', tags: ['specialty'] },
    { name: 'Mitte Hannam', neighborhood: 'Hannam-dong', tags: ['bookshop','quiet'] },
    { name: 'Café Bora Hannam', neighborhood: 'Hannam-dong', tags: ['quiet','specialty'] },
    { name: 'Camel Coffee Hannam', neighborhood: 'Hannam-dong', tags: ['indie','specialty'] },
    { name: 'Pancake Epidemic', neighborhood: 'Hannam-dong', tags: ['brunch'] },
    { name: 'Mokyeonri', neighborhood: 'Hannam-dong', tags: ['design'] },
    { name: 'Boontheshop Café', neighborhood: 'Hannam-dong', tags: ['design'] },
    { name: 'Comfort', neighborhood: 'Hannam-dong', tags: ['indie'] },
    { name: 'D Museum Café', neighborhood: 'Hannam-dong', tags: ['museum'] },

    // ── Yongsan / Haebangchon (용산·해방촌) ─────────────────
    { name: 'Felt Coffee Yongsan', neighborhood: 'Yongsan-gu', tags: ['specialty'] },
    { name: 'Center Coffee Yongsan', neighborhood: 'Yongsan-gu', tags: ['specialty','quiet'] },
    { name: 'Orot Coffee', neighborhood: 'Yongsan-gu', tags: ['specialty','indie'] },
    { name: 'Ireaby Coffee HBC', neighborhood: 'Haebangchon', tags: ['indie','view'] },
    { name: 'Anthracite Itaewon', neighborhood: 'Itaewon', tags: ['specialty','roastery'] },
    { name: 'Lichen Coffee HBC', neighborhood: 'Haebangchon', tags: ['indie','specialty'] },
    { name: 'Café Saison', neighborhood: 'Haebangchon', tags: ['indie'] },
    { name: 'Standa Coffee', neighborhood: 'Itaewon', tags: ['indie'] },
    { name: '5 Brewing Co', neighborhood: 'Yongsan-gu', tags: ['specialty'] },
    { name: 'Phillocoffee', neighborhood: 'Itaewon', tags: ['specialty','quiet'] },

    // ── Hongdae (홍대) ──────────────────────────────────────
    { name: 'Café Aalia', neighborhood: 'Hongdae', tags: ['indie'] },
    { name: 'Anthracite Hapjeong', neighborhood: 'Hapjeong-dong', tags: ['specialty','roastery'] },
    { name: 'Cafe Sukkara Hongdae', neighborhood: 'Hongdae', tags: ['indie'] },
    { name: 'Coffee Libre Hongdae', neighborhood: 'Hongdae', tags: ['specialty'] },
    { name: 'Magnetic Café', neighborhood: 'Hongdae', tags: ['indie','specialty'] },
    { name: 'Cafe Aboutee Hongdae', neighborhood: 'Hongdae', tags: ['indie','quiet'] },
    { name: 'Buveca', neighborhood: 'Hongdae', tags: ['bakery'] },
    { name: 'Café Comma Hongdae', neighborhood: 'Hongdae', tags: ['bookshop'] },
    { name: 'Aida Hapjeong', neighborhood: 'Hapjeong-dong', tags: ['indie'] },
    { name: 'Anthracite Seogyo', neighborhood: 'Seogyo-dong', tags: ['specialty','roastery'] },

    // ── Apgujeong / Cheongdam (압구정·청담) ─────────────────
    { name: 'Café Knotted Apgujeong', neighborhood: 'Apgujeong', tags: ['bakery','landmark'] },
    { name: 'Blue Bottle Apgujeong', neighborhood: 'Apgujeong', tags: ['specialty'] },
    { name: 'Maison Hermès Café Madang', neighborhood: 'Cheongdam', tags: ['design','landmark'] },
    { name: 'Café 10 Corso Como', neighborhood: 'Cheongdam', tags: ['design'] },
    { name: 'Tongsangmyeong', neighborhood: 'Apgujeong', tags: ['design'] },
    { name: 'Ddorang', neighborhood: 'Apgujeong', tags: ['indie'] },
    { name: 'Layered Apgujeong', neighborhood: 'Apgujeong', tags: ['bakery'] },
    { name: 'Mecenatpolis Café', neighborhood: 'Cheongdam', tags: ['design'] },
    { name: 'Café Sannolae', neighborhood: 'Apgujeong', tags: ['indie'] },
    { name: 'Hyundai Card Music Library Café', neighborhood: 'Cheongdam', tags: ['design'] },

    // ── Mangwon-dong (망원동) ───────────────────────────────
    { name: 'Café Knotted Mangwon', neighborhood: 'Mangwon-dong', tags: ['bakery'] },
    { name: 'Yard Coffee Mangwon', neighborhood: 'Mangwon-dong', tags: ['quiet','indie'] },
    { name: 'Cafe Halmoni', neighborhood: 'Mangwon-dong', tags: ['indie'] },
    { name: 'Mangwon Sound', neighborhood: 'Mangwon-dong', tags: ['music','quiet'] },
    { name: 'Café Onion Mangwon', neighborhood: 'Mangwon-dong', tags: ['design'] },
    { name: 'Sungtan Coffee', neighborhood: 'Mangwon-dong', tags: ['specialty'] },
    { name: 'Café Mongmonghan Pago', neighborhood: 'Mangwon-dong', tags: ['indie'] },
    { name: 'Modern Time', neighborhood: 'Mangwon-dong', tags: ['indie','quiet'] },
    { name: 'Patoer', neighborhood: 'Mangwon-dong', tags: ['bakery'] },
    { name: 'Café Yeolmae', neighborhood: 'Mangwon-dong', tags: ['indie'] },

    // ── Yeonhui-dong (연희동) ───────────────────────────────
    { name: 'Coffee Libre Yeonhui', neighborhood: 'Yeonhui-dong', tags: ['specialty','roastery'] },
    { name: 'Café Knotted Yeonhui', neighborhood: 'Yeonhui-dong', tags: ['bakery'] },
    { name: 'Manufact Coffee Yeonhui', neighborhood: 'Yeonhui-dong', tags: ['specialty'] },
    { name: 'Sajik Café', neighborhood: 'Yeonhui-dong', tags: ['quiet','indie'] },
    { name: 'Café Nopyeon', neighborhood: 'Yeonhui-dong', tags: ['indie'] },
    { name: 'Polin Coffee', neighborhood: 'Yeonhui-dong', tags: ['specialty','indie'] },
    { name: 'Bloomster Yeonhui', neighborhood: 'Yeonhui-dong', tags: ['design'] },
    { name: 'Hak-rim Dabang Yeonhui', neighborhood: 'Yeonhui-dong', tags: ['quiet'] },
    { name: 'Cafe Sunny', neighborhood: 'Yeonhui-dong', tags: ['indie'] },
    { name: 'Atelier Hermitage', neighborhood: 'Yeonhui-dong', tags: ['quiet','indie'] },

    // ── Seochon (서촌) ──────────────────────────────────────
    { name: 'Mk2 Café', neighborhood: 'Seochon', tags: ['design','quiet'] },
    { name: 'Tongin Café', neighborhood: 'Seochon', tags: ['indie'] },
    { name: 'Layered Seochon', neighborhood: 'Seochon', tags: ['bakery'] },
    { name: 'Sajikdong Café', neighborhood: 'Seochon', tags: ['indie','quiet'] },
    { name: 'Café Onion Seochon', neighborhood: 'Seochon', tags: ['design'] },
    { name: 'Mok-keun-da Café', neighborhood: 'Seochon', tags: ['indie'] },
    { name: 'Seochon Sarang Café', neighborhood: 'Seochon', tags: ['hanok','quiet'] },
    { name: 'Mil Toast Seochon', neighborhood: 'Seochon', tags: ['bakery'] },
    { name: 'Boan Yeogwan', neighborhood: 'Seochon', tags: ['art','quiet'] },
    { name: 'Café Magpie Seochon', neighborhood: 'Seochon', tags: ['indie'] },

    // ── Euljiro 3-ga (을지로3가) ───────────────────────────
    { name: 'Coffee Hanyakbang', neighborhood: 'Euljiro 3-ga', tags: ['specialty','landmark'] },
    { name: 'Sewoon Coffee', neighborhood: 'Euljiro 3-ga', tags: ['indie','specialty'] },
    { name: 'Cafe Horangi', neighborhood: 'Euljiro 3-ga', tags: ['indie'] },
    { name: 'Mil Toast Euljiro', neighborhood: 'Euljiro 3-ga', tags: ['bakery'] },
    { name: 'Cheonghak-dong Café', neighborhood: 'Euljiro 3-ga', tags: ['hanok'] },
    { name: 'Café Sik-mul', neighborhood: 'Euljiro 3-ga', tags: ['indie','design'] },
    { name: 'Layered Euljiro', neighborhood: 'Euljiro 3-ga', tags: ['bakery'] },
    { name: 'Hosu', neighborhood: 'Euljiro 3-ga', tags: ['indie'] },
    { name: 'Sentimental', neighborhood: 'Euljiro 3-ga', tags: ['indie','design'] },
    { name: 'Café Onion Euljiro', neighborhood: 'Euljiro 3-ga', tags: ['design'] },

    // ── Ikseon-dong (익선동) ───────────────────────────────
    { name: 'Madang Flower Café', neighborhood: 'Ikseon-dong', tags: ['hanok','design'] },
    { name: 'Cheong Su Dang', neighborhood: 'Ikseon-dong', tags: ['hanok','tea'] },
    { name: 'Sik Mul', neighborhood: 'Ikseon-dong', tags: ['hanok','design'] },
    { name: 'Tteul Café', neighborhood: 'Ikseon-dong', tags: ['hanok','quiet'] },
    { name: 'Ikseon Mil Toast', neighborhood: 'Ikseon-dong', tags: ['bakery'] },
    { name: 'Onion Ikseon', neighborhood: 'Ikseon-dong', tags: ['design'] },
    { name: 'Café Layla', neighborhood: 'Ikseon-dong', tags: ['indie'] },
    { name: 'Tteok Café Joseon Sigdang', neighborhood: 'Ikseon-dong', tags: ['hanok','tea'] },
    { name: 'Pavilion 1939', neighborhood: 'Ikseon-dong', tags: ['hanok','quiet'] },
    { name: 'Café Wesley', neighborhood: 'Ikseon-dong', tags: ['indie'] },

    // ── Itaewon proper (이태원) ────────────────────────────
    { name: '5 Extracts Itaewon', neighborhood: 'Itaewon', tags: ['specialty','indie'] },
    { name: 'Maman Gateaux', neighborhood: 'Itaewon', tags: ['bakery'] },
    { name: 'Tartine Bakery Itaewon', neighborhood: 'Itaewon', tags: ['bakery'] },
    { name: 'Passion 5', neighborhood: 'Hannam-dong', tags: ['bakery','landmark'] },
    { name: 'Sandsoul', neighborhood: 'Itaewon', tags: ['specialty','indie'] },
    { name: 'Aside', neighborhood: 'Itaewon', tags: ['indie'] },
    { name: 'Sweetbird', neighborhood: 'Itaewon', tags: ['bakery'] },
    { name: 'Anchor Coffee', neighborhood: 'Itaewon', tags: ['specialty','quiet'] },
    { name: 'Hooga', neighborhood: 'Itaewon', tags: ['indie'] },
    { name: 'Wave on Coffee Itaewon', neighborhood: 'Itaewon', tags: ['view'] }
];

function slugify(s) {
    return s.toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim().replace(/\s+/g, '-').slice(0, 60);
}

function neighborhoodKo(en) {
    // Korean equivalent for search query — Kakao matches Korean far better.
    const map = {
        'Yeonnam-dong': '연남동',
        'Seongsu-dong': '성수동',
        'Bukchon': '북촌',
        'Anguk-dong': '안국동',
        'Samcheong-dong': '삼청동',
        'Insa-dong': '인사동',
        'Hannam-dong': '한남동',
        'Yongsan-gu': '용산',
        'Haebangchon': '해방촌',
        'Itaewon': '이태원',
        'Hongdae': '홍대',
        'Hapjeong-dong': '합정동',
        'Seogyo-dong': '서교동',
        'Apgujeong': '압구정',
        'Cheongdam': '청담동',
        'Mangwon-dong': '망원동',
        'Yeonhui-dong': '연희동',
        'Seochon': '서촌',
        'Euljiro 3-ga': '을지로'
    };
    return map[en] || en;
}

const cafes = RAW.map((c, i) => {
    const idBase = slugify(c.name);
    const nbhdSlug = slugify(c.neighborhood);
    const id = `${idBase}-${nbhdSlug}`.slice(0, 80);
    const ko = neighborhoodKo(c.neighborhood);
    const q = `${c.name} ${ko}`;
    return {
        id,
        name: c.name,
        neighborhood: c.neighborhood,
        tags: c.tags || [],
        kakao_search_url: `https://map.kakao.com/?q=${encodeURIComponent(q)}`,
        naver_search_url: `https://map.naver.com/p/search/${encodeURIComponent(q)}`,
        status: 'candidate',
        verified: false,
        visited_at: null
    };
});

// Dedupe by id (just in case).
const seen = new Set();
const dedup = cafes.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id); return true;
});

const out = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'editor-research',
    note: 'Candidate seed list. Names compiled from editor research of well-known Seoul cafés — NOT verified, NOT visited. Some may have closed or moved. Editor clicks each kakao_search_url, confirms it exists with rating ≥ 4.3, then moves chosen entries into data/cafes-seoul.json with lat/lng/two_lines/amenities/visited_at filled in.',
    workflow: 'click → verify rating + existence → if good, move to cafes-seoul.json with full fields → drop from this file',
    total: dedup.length,
    cafes: dedup
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`[ok] ${dedup.length} candidates → ${path.relative(ROOT, OUT)}`);

// Per-neighborhood counts for sanity.
const byN = {};
for (const c of dedup) byN[c.neighborhood] = (byN[c.neighborhood] || 0) + 1;
console.log('\nBy neighborhood:');
for (const [k, v] of Object.entries(byN).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(18)} ${v}`);
}
