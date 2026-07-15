#!/usr/bin/env node
/**
 * saudade · fetch listening-room sounds from Freesound.
 *
 * Pulls top-rated CC0 / CC-BY ambient recordings, downloads the .mp3 preview
 * (full quality available with OAuth — see end of file), and writes:
 *   audio/asmr/<slug>.mp3                — the audio file
 *   data/licenses/freesound-<id>.json    — sidecar (artist, license, source)
 *   data/listening-tracks.json           — combined index, ready to merge into listening.json
 *
 * Defaults: queries tuned for saudade's city roster + general ambience.
 *
 * Usage:
 *   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.js
 *   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.js --per 5
 *   FREESOUND_TOKEN=xxxx node scripts/fetch-freesound.js --queries "tokyo cafe,rain on window"
 *   --dry         print plan without downloading
 *   --no-download just fetch metadata (URLs only)
 *
 * Token: https://freesound.org/apiv2/apply/  (free, requires account)
 *   The "API token" (not OAuth) is enough for search + preview download.
 *
 * Filters applied:
 *   - duration >= 20s, <= 1200s
 *   - sample rate >= 22050 Hz (previews are mp3 anyway)
 *   - license CC0 or CC-BY (NC excluded so commercial use is safe)
 *   - num_downloads >= 10 (rough quality signal)
 *   - rating: keep unrated; drop only sounds rated >=3 times AND scoring < 2.5
 *
 * Rate limit: 60/min (Freesound free tier).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LIC  = path.join(DATA, 'licenses');
const AUDIO_DIR = path.join(ROOT, 'audio', 'asmr');

// Three queries per city = ~9 candidates after per=3, gives editor variety to
// pick from while still hitting Freesound's free tier comfortably (60/min).
// The wire script picks the first N per city when merging into listening.json.
const DEFAULT_QUERIES = [
    // Iberia
    { category: 'CAFE',  city: 'Lisbon',       q: 'cafe ambience stereo' },
    { category: 'CITY',  city: 'Lisbon',       q: 'lisbon tram street' },
    { category: 'NIGHT', city: 'Lisbon',       q: 'lisbon night quiet' },
    { category: 'CAFE',  city: 'Porto',        q: 'porto cafe morning' },
    { category: 'CITY',  city: 'Porto',        q: 'porto street tram' },
    { category: 'RAIN',  city: 'Porto',        q: 'porto rain on tile roof' },
    { category: 'CAFE',  city: 'Madrid',       q: 'madrid cafe interior' },
    { category: 'CITY',  city: 'Madrid',       q: 'madrid plaza ambience' },
    { category: 'NIGHT', city: 'Madrid',       q: 'madrid night cafe' },
    { category: 'CAFE',  city: 'Barcelona',    q: 'barcelona cafe street' },
    { category: 'CITY',  city: 'Barcelona',    q: 'barcelona market ambience' },
    { category: 'NIGHT', city: 'Barcelona',    q: 'barcelona night quiet' },
    // East Asia
    { category: 'CAFE',  city: 'Tokyo',        q: 'tokyo cafe rain' },
    { category: 'CAFE',  city: 'Tokyo',        q: 'kissaten' },
    { category: 'CITY',  city: 'Tokyo',        q: 'tokyo rainy street' },
    { category: 'CAFE',  city: 'Seoul',        q: 'quiet cafe morning' },
    { category: 'CITY',  city: 'Seoul',        q: 'seoul subway distant' },
    { category: 'RAIN',  city: 'Seoul',        q: 'seoul rain window' },
    // Southeast Asia
    { category: 'CAFE',  city: 'Chiang Mai',   q: 'chiang mai temple bells' },
    { category: 'CITY',  city: 'Chiang Mai',   q: 'chiang mai market street' },
    { category: 'NIGHT', city: 'Chiang Mai',   q: 'thailand night insects' },
    { category: 'CAFE',  city: 'Bali',         q: 'bali rice paddy morning' },
    { category: 'NIGHT', city: 'Bali',         q: 'bali frog cricket night' },
    { category: 'RAIN',  city: 'Bali',         q: 'bali tropical rain palm' },
    { category: 'CAFE',  city: 'Da Nang',      q: 'vietnam cafe ambience' },
    { category: 'CITY',  city: 'Da Nang',      q: 'da nang beach distant' },
    { category: 'NIGHT', city: 'Da Nang',      q: 'vietnam night cicada' },
    // Latin America
    { category: 'CAFE',  city: 'Mexico City',  q: 'mexico city cafe morning' },
    { category: 'CITY',  city: 'Mexico City',  q: 'mexico city plaza ambience' },
    { category: 'RAIN',  city: 'Mexico City',  q: 'mexico city afternoon rain' },
    { category: 'CAFE',  city: 'Medellin',     q: 'medellin cafe balcony' },
    { category: 'CITY',  city: 'Medellin',     q: 'medellin street ambience' },
    { category: 'NIGHT', city: 'Medellin',     q: 'colombia tropical night' },
    { category: 'CAFE',  city: 'Buenos Aires', q: 'buenos aires cafe interior' },
    { category: 'CITY',  city: 'Buenos Aires', q: 'buenos aires street ambience' },
    { category: 'NIGHT', city: 'Buenos Aires', q: 'buenos aires night quiet' },
    // Caucasus + Europe
    { category: 'CAFE',  city: 'Tbilisi',      q: 'tbilisi cafe morning' },
    { category: 'CITY',  city: 'Tbilisi',      q: 'tbilisi old town ambience' },
    { category: 'RAIN',  city: 'Tbilisi',      q: 'georgia rain on roof' },
    { category: 'CAFE',  city: 'Berlin',       q: 'berlin cafe interior' },
    { category: 'CITY',  city: 'Berlin',       q: 'berlin u-bahn distant' },
    { category: 'RAIN',  city: 'Berlin',       q: 'berlin rain altbau window' }
];

function parseArgs(argv) {
    const out = { per: 3, dry: false, noDownload: false, queries: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--per') out.per = parseInt(argv[++i] || '3', 10);
        else if (a === '--dry') out.dry = true;
        else if (a === '--no-download') out.noDownload = true;
        else if (a === '--queries') {
            out.queries = (argv[++i] || '').split(',').map(s => ({
                category: 'CUSTOM', city: null, q: s.trim()
            }));
        }
    }
    return out;
}

const FIELDS = 'id,name,tags,description,duration,samplerate,channels,bitdepth,filesize,download,previews,images,license,username,url,num_downloads,avg_rating,num_ratings';

const ALLOWED_LICENSES = [
    'Creative Commons 0',
    'Attribution',
    'Attribution 4.0',
    'Attribution NonCommercial 4.0' // included only because Freesound returns it; filtered out below
];

function isCommercialOk(lic) {
    if (!lic) return false;
    return /Creative Commons 0/i.test(lic) || /^Attribution(?:\s+4\.0)?$/i.test(lic);
}

function shortLicense(lic) {
    if (/Creative Commons 0/i.test(lic)) return 'CC0';
    if (/Attribution NonCommercial/i.test(lic)) return 'CC-BY-NC';
    if (/Attribution/i.test(lic)) return 'CC-BY';
    return lic;
}

function slugify(s) {
    return String(s).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function searchFreesound(token, query, per) {
    const url = new URL('https://freesound.org/apiv2/search/text/');
    url.searchParams.set('query', query);
    // 필터 완화: 이전 값(duration 60-600 · samplerate≥44100 · downloads≥100)은
    // 도시별 니치 쿼리("porto rain on tile roof" 등)에 대해 0건을 반환했다.
    // 앰비언트/ASMR 은 짧은(20s~) 루프도, 22.05kHz 프리뷰도, 다운로드 적은 것도
    // 충분히 쓸 만하다. 프리뷰 mp3 만 받으므로 원음 샘플레이트는 덜 중요.
    url.searchParams.set('filter',
        'duration:[20 TO 1200] samplerate:[22050 TO 192000] num_downloads:[10 TO 999999]');
    url.searchParams.set('sort', 'rating_desc');
    url.searchParams.set('page_size', String(Math.max(per * 4, 12))); // overfetch + filter
    url.searchParams.set('fields', FIELDS);
    url.searchParams.set('token', token);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Freesound ${res.status}: ${await res.text()}`);
    return res.json();
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                downloadFile(res.headers.location, dest).then(resolve, reject); return;
            }
            if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
            const out = fs.createWriteStream(dest);
            res.pipe(out);
            out.on('finish', () => out.close(resolve));
            out.on('error', reject);
        });
        req.on('error', reject);
    });
}

async function main() {
    // .trim() — repo secrets occasionally carry a leading whitespace/tab from
    // a careless paste; Freesound rejects with 401 Invalid token without it.
    const token = (process.env.FREESOUND_TOKEN || '').trim();
    if (!token) {
        console.error('Set FREESOUND_TOKEN=<your Freesound API token>');
        console.error('Get one free at https://freesound.org/apiv2/apply/');
        process.exit(2);
    }
    const opts = parseArgs(process.argv.slice(2));
    const queries = opts.queries || DEFAULT_QUERIES;

    fs.mkdirSync(LIC, { recursive: true });
    fs.mkdirSync(AUDIO_DIR, { recursive: true });

    const tracks = [];

    for (const { category, city, q } of queries) {
        process.stderr.write(`[search] ${(city||'-').padEnd(10)} "${q}"… `);
        let r;
        try { r = await searchFreesound(token, q, opts.per); }
        catch (e) { console.error('FAIL: ' + e.message); continue; }

        // 상업 이용 가능 라이선스(CC0 / CC-BY)만 남긴다 — 이건 양보 불가.
        const commercial = (r.results || []).filter(s => isCommercialOk(s.license));
        // 평점 게이트 완화: 예전엔 `평점≥3.5 || 평가수≥5` 라 평가 0개인 음원을
        // 전부 버렸다(앰비언트 대부분이 평가 0개 → 0건). 이제는 "여러 번 평가받고도
        // 낮은" 것만 배제하고 미평가 음원은 통과시킨다. 다운로드 하한(필터)이
        // 이미 최소 품질 신호 역할을 한다.
        let candidates = commercial
            .filter(s => !((s.num_ratings || 0) >= 3 && (s.avg_rating || 0) < 2.5))
            .slice(0, opts.per);
        // 폴백: 게이트가 다 걸러도 상업 이용 가능한 후보가 있으면 상위 것을 쓴다.
        if (!candidates.length && commercial.length) candidates = commercial.slice(0, opts.per);

        console.error(`${candidates.length}/${(r.results||[]).length} pass filters`);

        for (const s of candidates) {
            const slug = slugify(s.name) || `freesound-${s.id}`;
            const filename = `${slug}-${s.id}.mp3`;
            const audioPath = path.join(AUDIO_DIR, filename);

            // sidecar (license — required by validate-content.js)
            const sidecar = {
                track_or_image: 'audio',
                id: String(s.id),
                title: s.name,
                author: s.username,
                author_url: `https://freesound.org/people/${s.username}/`,
                license: shortLicense(s.license),
                license_long: s.license,
                license_url: shortLicense(s.license) === 'CC0'
                    ? 'https://creativecommons.org/publicdomain/zero/1.0/'
                    : 'https://creativecommons.org/licenses/by/4.0/',
                source: 'Freesound',
                source_url: s.url,
                duration_s: Math.round(s.duration || 0),
                samplerate: s.samplerate,
                channels: s.channels,
                downloaded: new Date().toISOString().slice(0, 10),
                attribution_text: shortLicense(s.license) === 'CC0'
                    ? `${s.name} (CC0). Source: Freesound.`
                    : `"${s.name}" by ${s.username} on Freesound (${shortLicense(s.license)}).`
            };

            const previewUrl = (s.previews || {})['preview-hq-mp3']
                            || (s.previews || {})['preview-lq-mp3'];

            if (!opts.dry && !opts.noDownload && previewUrl) {
                process.stderr.write(`  → ${filename} … `);
                try {
                    await downloadFile(previewUrl, audioPath);
                    console.error('ok');
                } catch (e) { console.error('FAIL: ' + e.message); continue; }
            }

            if (!opts.dry) {
                fs.writeFileSync(path.join(LIC, `freesound-${s.id}.json`),
                    JSON.stringify(sidecar, null, 2) + '\n');
            }

            tracks.push({
                category,
                city,
                title: s.name,
                duration_minutes: Math.round((s.duration || 0) / 60),
                license: shortLicense(s.license),
                license_url: sidecar.license_url,
                credits: sidecar.attribution_text,
                audio_url: `/audio/asmr/${filename}`,
                source_url: s.url
            });
        }
        await new Promise(r => setTimeout(r, 1100)); // stay under 60/min
    }

    if (opts.dry) {
        console.log(JSON.stringify({ tracks }, null, 2));
        return;
    }
    fs.writeFileSync(path.join(DATA, 'listening-tracks.json'),
        JSON.stringify({
            generated: new Date().toISOString().slice(0, 10),
            source: 'Freesound',
            attribution_required: true,
            tracks
        }, null, 2) + '\n');

    console.log(`\n[ok] ${tracks.length} track(s) → data/listening-tracks.json`);
    console.log(`[ok] mp3 files → audio/asmr/*.mp3`);
    console.log(`[ok] license sidecars → data/licenses/freesound-*.json`);
    console.log(`\nReview by listening:`);
    console.log(`     for f in audio/asmr/*-${tracks[0]?.audio_url?.match(/-(\\d+)\\.mp3/)?.[1] || 'XX'}.mp3; do echo $f; done`);
    console.log(`Then merge picks into data/listening.json (replace "tracks" array or append).`);
    console.log(`Finally run: node scripts/validate-content.js`);
}

/*
 * Note on download quality:
 *   The "preview-hq-mp3" link works without OAuth and is good enough for
 *   the listening-room (web player streams it). For the original WAV /
 *   high-bitrate file you'd need OAuth2 — Freesound docs:
 *     https://freesound.org/docs/api/authentication.html
 *   For now, previews are sufficient and lighter to host.
 */

main().catch(e => { console.error(e.stack || e); process.exit(1); });
