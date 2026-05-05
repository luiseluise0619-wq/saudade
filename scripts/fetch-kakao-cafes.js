#!/usr/bin/env node
/**
 * saudade · fetch Seoul cafes from Kakao Maps Local API.
 *
 * Pulls N cafés (CE7 category) per neighborhood, writes:
 *   data/cafes-seoul.fetched.json  — raw seed list, separate from the
 *                                    curated data/cafes-seoul.json
 *   data/licenses/kakao-<id>.json  — sidecar per café for provenance
 *
 * Why a separate file?
 *   The magazine constitution says "we list only what we have visited."
 *   Auto-fetched cafés are unverified seed; the editor manually moves
 *   chosen ones into data/cafes-seoul.json after a real visit, with
 *   two_lines + amenities + visited_at filled in.
 *
 * Usage:
 *   KAKAO_KEY=xxxx node scripts/fetch-kakao-cafes.js
 *   KAKAO_KEY=xxxx node scripts/fetch-kakao-cafes.js --neighborhoods "Yeonnam-dong,Seongsu-dong"
 *   KAKAO_KEY=xxxx node scripts/fetch-kakao-cafes.js --per 10 --radius 800
 *   KAKAO_KEY=xxxx node scripts/fetch-kakao-cafes.js --dry
 *
 * Get a key: https://developers.kakao.com → 앱 만들기 → REST API key
 * Rate: 300,000 / month free. Each neighborhood = 1 call (size up to 15).
 *
 * Attribution: Kakao requires "카카오맵" credit when displaying place data.
 *   The license sidecar carries source_url and attribution_text.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LIC  = path.join(DATA, 'licenses');

// 매거진이 다루는 서울 카페 거리 시드 좌표.
// editor 가 직접 추가/제거 가능. 위경도 = 동네 중심부 추정치.
const DEFAULT_NEIGHBORHOODS = [
    { name: 'Yeonnam-dong',   lat: 37.5631, lng: 126.9252 },
    { name: 'Seongsu-dong',   lat: 37.5447, lng: 127.0557 },
    { name: 'Bukchon',        lat: 37.5821, lng: 126.9842 },
    { name: 'Hannam-dong',    lat: 37.5378, lng: 127.0024 },
    { name: 'Yongsan-gu',     lat: 37.5326, lng: 126.9904 },
    { name: 'Hongdae',        lat: 37.5563, lng: 126.9229 },
    { name: 'Itaewon',        lat: 37.5347, lng: 126.9946 },
    { name: 'Apgujeong',      lat: 37.5273, lng: 127.0286 },
    { name: 'Mangwon-dong',   lat: 37.5571, lng: 126.9015 },
    { name: 'Yeonhui-dong',   lat: 37.5703, lng: 126.9286 },
    { name: 'Seochon',        lat: 37.5793, lng: 126.9701 },
    { name: 'Euljiro 3-ga',   lat: 37.5663, lng: 126.9926 },
    { name: 'Ikseon-dong',    lat: 37.5712, lng: 126.9912 },
    { name: 'Anguk-dong',     lat: 37.5817, lng: 126.9846 }
];

function parseArgs(argv) {
    const out = { per: 5, radius: 800, dry: false, neighborhoods: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--per') out.per = Math.min(15, parseInt(argv[++i] || '5', 10));
        else if (a === '--radius') out.radius = Math.min(20000, parseInt(argv[++i] || '800', 10));
        else if (a === '--dry') out.dry = true;
        else if (a === '--neighborhoods') {
            const wanted = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
            out.neighborhoods = DEFAULT_NEIGHBORHOODS.filter(n => wanted.includes(n.name));
            if (out.neighborhoods.length === 0) {
                console.error(`No matching neighborhoods. Available: ${DEFAULT_NEIGHBORHOODS.map(n => n.name).join(', ')}`);
                process.exit(2);
            }
        }
    }
    return out;
}

async function searchKakao(key, lat, lng, opts) {
    // category_group_code CE7 = 카페
    const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
    url.searchParams.set('category_group_code', 'CE7');
    url.searchParams.set('x', String(lng));
    url.searchParams.set('y', String(lat));
    url.searchParams.set('radius', String(opts.radius));
    url.searchParams.set('size', String(opts.per));
    url.searchParams.set('sort', 'distance');
    const res = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${key}` }
    });
    if (!res.ok) throw new Error(`Kakao ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
}

function toEntry(p, neighborhood) {
    return {
        id: `kakao-${p.id}`,
        name: p.place_name,
        neighborhood,
        distance_km: 0,            // editor 가 office-from 기준 측정
        lat: parseFloat(p.y),
        lng: parseFloat(p.x),
        visited_at: null,
        two_lines: ['', ''],       // editor 작성 후 cafes-seoul.json 으로 이전
        amenities: '',
        address: p.road_address_name || p.address_name || '',
        phone: p.phone || '',
        category_name: p.category_name || '',
        kakao_url: p.place_url || '',
        verified: false,
        source: 'kakao'
    };
}

function sidecarFor(p, neighborhood) {
    return {
        track_or_image: 'place',
        id: `kakao-${p.id}`,
        title: p.place_name,
        license: 'Kakao-Maps-API',
        license_url: 'https://apis.map.kakao.com/web/guide/',
        source: 'Kakao',
        source_url: p.place_url,
        neighborhood,
        category_name: p.category_name || '',
        downloaded: new Date().toISOString().slice(0, 10),
        attribution_text: '카카오맵 제공'
    };
}

async function main() {
    const key = process.env.KAKAO_KEY;
    if (!key) {
        console.error('Set KAKAO_KEY=<your Kakao REST API key>');
        console.error('Get one free at https://developers.kakao.com');
        process.exit(2);
    }
    const opts = parseArgs(process.argv.slice(2));
    const neighborhoods = opts.neighborhoods || DEFAULT_NEIGHBORHOODS;

    if (!opts.dry) fs.mkdirSync(LIC, { recursive: true });

    const cafes = [];
    const seenIds = new Set();
    for (const n of neighborhoods) {
        process.stderr.write(`[fetch] ${n.name.padEnd(20)} (${n.lat},${n.lng}) r=${opts.radius}m… `);
        try {
            const r = await searchKakao(key, n.lat, n.lng, opts);
            const docs = r.documents || [];
            let added = 0;
            for (const p of docs) {
                if (seenIds.has(p.id)) continue;
                seenIds.add(p.id);
                cafes.push(toEntry(p, n.name));
                added++;
                if (!opts.dry) {
                    fs.writeFileSync(path.join(LIC, `kakao-${p.id}.json`),
                        JSON.stringify(sidecarFor(p, n.name), null, 2) + '\n');
                }
            }
            console.error(`${docs.length} found, ${added} new`);
        } catch (e) {
            console.error('FAIL: ' + e.message);
        }
        // 가벼운 페이싱 — Kakao 무료 한도는 월 30만이지만 정중하게.
        await new Promise(r => setTimeout(r, 300));
    }

    const out = {
        generated: new Date().toISOString().slice(0, 10),
        source: 'Kakao',
        license: 'Kakao-Maps-API',
        license_url: 'https://apis.map.kakao.com/web/guide/',
        attribution_required: true,
        attribution_text: '카카오맵 제공',
        note: 'Seed candidates only — magazine ships only after editor visits and curates into cafes-seoul.json.',
        cafes
    };

    if (opts.dry) {
        console.log(JSON.stringify(out, null, 2));
        return;
    }
    const outPath = path.join(DATA, 'cafes-seoul.fetched.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
    console.log(`\n[ok] ${cafes.length} café(s) → data/cafes-seoul.fetched.json`);
    console.log(`[ok] ${cafes.length} sidecar(s) → data/licenses/kakao-*.json`);
    console.log(`     Review the candidates, visit the ones worth listing,`);
    console.log(`     then move chosen entries into data/cafes-seoul.json with`);
    console.log(`     two_lines + amenities + visited_at filled in.`);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
