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
 *   - duration >= 60s, <= 600s
 *   - sample rate >= 44100 Hz
 *   - license CC0 or CC-BY (NC excluded so commercial use is safe)
 *   - num_downloads >= 100 (rough quality signal)
 *   - rating >= 3.5 (Freesound community ratings)
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

const DEFAULT_QUERIES = [
    { category: 'CAFE',  city: 'Lisbon',  q: 'cafe ambience stereo' },
    { category: 'CAFE',  city: 'Tokyo',   q: 'tokyo cafe rain' },
    { category: 'CAFE',  city: 'Tokyo',   q: 'kissaten' },
    { category: 'CAFE',  city: 'Seoul',   q: 'quiet cafe morning' },
    { category: 'RAIN',  city: null,      q: 'rain on window indoor' },
    { category: 'RAIN',  city: null,      q: 'soft rain interior loop' },
    { category: 'CITY',  city: 'Lisbon',  q: 'lisbon tram street' },
    { category: 'CITY',  city: 'Tokyo',   q: 'tokyo rainy street' },
    { category: 'NIGHT', city: null,      q: 'night ambience indoor' }
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
    url.searchParams.set('filter',
        'duration:[60 TO 600] samplerate:[44100 TO 192000] num_downloads:[100 TO 999999]');
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
    const token = process.env.FREESOUND_TOKEN;
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

        const candidates = (r.results || [])
            .filter(s => isCommercialOk(s.license))
            .filter(s => (s.avg_rating || 0) >= 3.5 || s.num_ratings >= 5)
            .slice(0, opts.per);

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
