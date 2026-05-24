#!/usr/bin/env node
// scripts/verify-cafes-gemini.js — verify candidates via Gemini Search Grounding
//
// Substitute for Google Places API (which requires billing). Uses Gemini
// 2.5-flash with Google Search grounding to confirm a cafe actually exists
// at the listed address. Returns NO coordinates (grounding doesn't expose
// them) — only existence + light review prose.
//
// Run:
//   GEMINI_API_KEY=... node scripts/verify-cafes-gemini.js --city tokyo
//   GEMINI_API_KEY=... node scripts/verify-cafes-gemini.js --city all --limit 20
//
// Strategy per cafe:
//   1. Prompt: "Does <name> exist at <address> in <city>?" with Search grounding.
//   2. Gemini returns JSON {exists, confidence, two_lines_ko, amenities, google_url}.
//   3. If exists && confidence >= 0.7 → promote to data/cafes-{city}.json,
//      remove from candidates. Stamp source='gemini-2.5-flash-grounded',
//      vetted_at=today.
//   4. If not → leave in candidates with verify_attempts++ + last_attempt_at.
//
// Rate limiting:
//   - 1500ms between calls (Gemini free tier: ~10 RPM observed for grounding)
//   - Exponential backoff on 429 (4s, 8s, 16s, then give up)

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-lite';
const CITIES = ['seoul', 'da-nang', 'bali', 'tokyo', 'lisbon'];
const SLEEP_MS = 1500;
const TODAY = new Date().toISOString().slice(0, 10);

if (!KEY) {
    console.error('Set GEMINI_API_KEY env var.');
    process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROMPT_TEMPLATE = (cafe) => `Verify whether this café actually exists. Use Google Search to confirm.

Café: ${cafe.name}
City: ${cafe.city || 'unknown'}
Neighborhood: ${cafe.neighborhood || 'unknown'}
Address (if any): ${cafe.address || 'unknown'}

Return a JSON object ONLY (no markdown, no prose), with this shape:
{
  "exists": true | false,
  "confidence": 0.0 to 1.0,
  "two_lines_ko": ["first line of editor copy in Korean, ≤ 30 chars", "second line ≤ 30 chars"],
  "amenities": "WIFI · OUTLET · QUIET (pick from: WIFI, OUTLET, NO_OUTLET, QUIET, NO_CALLS, 24H, CALLS_OK — middot separated, max 4)",
  "google_url": "https://maps.app.goo.gl/... if grounding surfaces one, else null"
}

If you cannot confirm the café exists at this location with Google Search, set exists=false and confidence < 0.3.`;

async function geminiVerify(cafe) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
    const body = {
        contents: [{ parts: [{ text: PROMPT_TEMPLATE(cafe) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 }
    };

    let backoff = 4000;
    for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.status === 429) {
            console.log(`    (429, backing off ${backoff}ms)`);
            await sleep(backoff);
            backoff *= 2;
            continue;
        }
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`);
        }
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        // Strip ```json fences if present
        const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
        let parsed = null;
        try { parsed = JSON.parse(cleaned); }
        catch (e) {
            // Find first { ... } in text
            const m = cleaned.match(/\{[\s\S]*\}/);
            if (m) try { parsed = JSON.parse(m[0]); } catch (e2) {}
        }
        // groundingMetadata may carry sources (sometimes including maps URLs)
        const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const mapsHit = chunks.find(c => /maps\.(google|app\.goo)/.test(c.web?.uri || ''));
        return { parsed, mapsUrl: mapsHit?.web?.uri || null, raw: text.slice(0, 200) };
    }
    throw new Error('rate-limited too many times');
}

function loadJson(p, fallback) {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, data) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function promote(cafe, hit) {
    const out = {
        id: cafe.id,
        name: cafe.name,
        city: cafe.city,
        neighborhood: cafe.neighborhood,
        address: cafe.address || null,
        rating: cafe.rating || null,
        google_url: hit.parsed.google_url || hit.mapsUrl || null,
        google_maps_search_url: cafe.google_maps_search_url || null,
        vetted_at: TODAY,
        visited_at: null,
        two_lines: Array.isArray(hit.parsed.two_lines_ko) ? hit.parsed.two_lines_ko.slice(0, 2) : (cafe.two_lines || []),
        amenities: hit.parsed.amenities || cafe.amenities || '',
        notes_kr: cafe.notes_kr || (Array.isArray(hit.parsed.two_lines_ko) ? hit.parsed.two_lines_ko.join(' ') : ''),
        source: 'gemini-2.5-flash-grounded'
    };
    // Carry kakao/naver if seoul
    if (cafe.kakao_search_url) out.kakao_search_url = cafe.kakao_search_url;
    if (cafe.naver_search_url) out.naver_search_url = cafe.naver_search_url;
    return out;
}

async function processCity(citySlug, opts) {
    const vPath = path.join(DATA_DIR, `cafes-${citySlug}.json`);
    const cPath = path.join(DATA_DIR, `cafes-${citySlug}.candidates.json`);
    if (!fs.existsSync(cPath)) {
        console.log(`[${citySlug}] no candidates file`);
        return { promoted: 0, dropped: 0 };
    }
    const verified = loadJson(vPath, []);
    const candRaw = loadJson(cPath, []);
    const verArr = Array.isArray(verified) ? verified : (verified.cafes || verified.items || []);
    const verWrap = Array.isArray(verified) ? null : verified;
    const candArr = Array.isArray(candRaw) ? candRaw : (candRaw.cafes || candRaw.items || []);
    const candWrap = Array.isArray(candRaw) ? null : candRaw;

    const limit = opts.limit || candArr.length;
    let promoted = 0, dropped = 0, kept = 0;
    const remaining = [];

    for (let i = 0; i < candArr.length; i++) {
        const c = candArr[i];
        if (i >= limit) { remaining.push(c); continue; }
        process.stdout.write(`  [${i+1}/${candArr.length}] ${c.name?.slice(0,40) || '(no name)'} ... `);
        try {
            const hit = await geminiVerify(c);
            if (hit.parsed?.exists && (hit.parsed.confidence ?? 0) >= 0.7) {
                const promoted_entry = promote(c, hit);
                verArr.push(promoted_entry);
                promoted++;
                console.log(`OK (conf ${hit.parsed.confidence.toFixed(2)})`);
            } else if (hit.parsed?.exists === false) {
                dropped++;
                console.log(`drop (not found)`);
            } else {
                remaining.push({ ...c, verify_attempts: (c.verify_attempts || 0) + 1, last_attempt_at: TODAY });
                kept++;
                console.log(`uncertain — keep`);
            }
        } catch (err) {
            console.log(`error: ${err.message.slice(0, 80)}`);
            remaining.push(c);
            kept++;
            if (/rate-limited/.test(err.message)) {
                console.log('  quota wall reached — stopping');
                // push the rest unchanged
                for (let j = i + 1; j < candArr.length; j++) remaining.push(candArr[j]);
                break;
            }
        }
        await sleep(SLEEP_MS);
    }

    if (!opts.dryRun) {
        const vOut = verWrap ? { ...verWrap, cafes: verArr } : verArr;
        const cOut = candWrap
            ? { ...candWrap, total: remaining.length, cafes: remaining }
            : remaining;
        writeJson(vPath, vOut);
        writeJson(cPath, cOut);
    }
    console.log(`[${citySlug}] +${promoted} promoted, ${dropped} dropped, ${kept} kept-uncertain`);
    return { promoted, dropped };
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const cityIdx = args.indexOf('--city');
    const onlyCity = cityIdx >= 0 ? args[cityIdx + 1] : 'all';
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;

    const cities = onlyCity === 'all' ? CITIES : [onlyCity];
    const total = { promoted: 0, dropped: 0 };
    for (const c of cities) {
        console.log(`\n=== ${c} ===`);
        const r = await processCity(c, { dryRun, limit: limit || undefined });
        total.promoted += r.promoted;
        total.dropped += r.dropped;
    }
    console.log(`\n[done] +${total.promoted} promoted, ${total.dropped} dropped`);
    if (dryRun) console.log('(dry-run — no files written)');
}

main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
});
