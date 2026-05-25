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
//   GEMINI_API_KEY=... node scripts/verify-cafes-gemini.js --city lisbon --batch 5
//
// --batch N packs N cafés into one grounded call. Free-tier grounding
// quota is the bottleneck (~handful of calls/day), so --batch 5 verifies
// 5× more cafés per quota unit. Gemini still searches each café; results
// map back by the index handed to it. Use 1 (default) for max per-café
// search depth, 5 to clear a backlog fast.
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

// Batch prompt — verify N cafés in one grounded call. The free-tier
// grounding quota is the bottleneck (≈ a handful of calls per day), so
// packing 5 cafés per call multiplies effective throughput 5×. Gemini
// still searches per café; we just ask it to return an array keyed by
// the index we hand it, so a dropped/reordered entry can't corrupt the
// mapping back to the source café.
const BATCH_PROMPT = (cafes) => `Verify whether each of these cafés actually exists right now. Use Google Search for each one independently.

Cafés:
${cafes.map((c, i) => `[${i}] ${c.name} — ${c.neighborhood || '?'}, ${c.city || '?'}${c.address ? ' (' + c.address + ')' : ''}`).join('\n')}

Return a JSON ARRAY ONLY (no markdown, no prose). One object per café, in the same order, each shaped:
{
  "index": <the bracket number above>,
  "exists": true | false,
  "confidence": 0.0 to 1.0,
  "two_lines_ko": ["editor copy line 1 in Korean ≤30 chars", "line 2 ≤30 chars"],
  "amenities": "middot-separated, max 4 of: WIFI OUTLET NO_OUTLET QUIET NO_CALLS 24H CALLS_OK",
  "google_url": "https://maps.app.goo.gl/... if surfaced, else null"
}

For any café you cannot confirm with Google Search, set exists=false and confidence < 0.3. Return exactly ${cafes.length} objects.`;

async function geminiCall(promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
    const body = {
        contents: [{ parts: [{ text: promptText }] }],
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
        if (res.status === 429 || res.status === 503) {
            console.log(`    (${res.status}, backing off ${backoff}ms)`);
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
        const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const mapsUrl = (chunks.find(c => /maps\.(google|app\.goo)/.test(c.web?.uri || '')) || {}).web?.uri || null;
        return { text, mapsUrl };
    }
    throw new Error('rate-limited too many times');
}

function parseJsonLoose(text) {
    const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* fall through */ }
    // Grab the first balanced array or object.
    const arr = cleaned.match(/\[[\s\S]*\]/);
    if (arr) { try { return JSON.parse(arr[0]); } catch (e) {} }
    const obj = cleaned.match(/\{[\s\S]*\}/);
    if (obj) { try { return JSON.parse(obj[0]); } catch (e) {} }
    return null;
}

async function geminiVerify(cafe) {
    const { text, mapsUrl } = await geminiCall(PROMPT_TEMPLATE(cafe));
    return { parsed: parseJsonLoose(text), mapsUrl, raw: text.slice(0, 200) };
}

// Returns an array aligned to `cafes` (same length). Each element:
// { parsed, mapsUrl } or { parsed: null } if Gemini omitted that index.
async function geminiVerifyBatch(cafes) {
    const { text, mapsUrl } = await geminiCall(BATCH_PROMPT(cafes));
    const parsed = parseJsonLoose(text);
    const out = cafes.map(() => ({ parsed: null, mapsUrl }));
    if (Array.isArray(parsed)) {
        for (const v of parsed) {
            const idx = (typeof v.index === 'number') ? v.index : parsed.indexOf(v);
            if (idx >= 0 && idx < cafes.length) out[idx] = { parsed: v, mapsUrl };
        }
    }
    return out;
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
    const batchSize = Math.max(1, opts.batch || 1);
    let promoted = 0, dropped = 0, kept = 0;
    const remaining = [];

    // Apply one verdict to a café — mutates the counters + arrays.
    function applyVerdict(c, hit) {
        if (hit.parsed?.exists && (hit.parsed.confidence ?? 0) >= 0.7) {
            verArr.push(promote(c, hit));
            promoted++;
            return `OK (conf ${Number(hit.parsed.confidence).toFixed(2)})`;
        }
        if (hit.parsed?.exists === false) {
            dropped++;
            return 'drop (not found)';
        }
        remaining.push({ ...c, verify_attempts: (c.verify_attempts || 0) + 1, last_attempt_at: TODAY });
        kept++;
        return 'uncertain — keep';
    }

    const toProcess = candArr.slice(0, limit);
    const carryOver = candArr.slice(limit);   // beyond --limit, untouched
    let wall = false;

    for (let i = 0; i < toProcess.length && !wall; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        try {
            const hits = batch.length === 1
                ? [await geminiVerify(batch[0])]
                : await geminiVerifyBatch(batch);
            batch.forEach((c, j) => {
                const status = applyVerdict(c, hits[j] || { parsed: null });
                console.log(`  [${i + j + 1}/${toProcess.length}] ${(c.name || '(no name)').slice(0, 40)} ... ${status}`);
            });
        } catch (err) {
            console.log(`  batch [${i + 1}-${i + batch.length}] error: ${err.message.slice(0, 80)}`);
            batch.forEach(c => { remaining.push(c); kept++; });
            if (/rate-limited/.test(err.message)) {
                console.log('  quota wall reached — stopping');
                for (let j = i + batchSize; j < toProcess.length; j++) remaining.push(toProcess[j]);
                wall = true;
            }
        }
        if (!wall) await sleep(SLEEP_MS);
    }
    remaining.push(...carryOver);

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
    const batchIdx = args.indexOf('--batch');
    const batch = batchIdx >= 0 ? Math.max(1, parseInt(args[batchIdx + 1], 10) || 1) : 1;

    const cities = onlyCity === 'all' ? CITIES : [onlyCity];
    const total = { promoted: 0, dropped: 0 };
    for (const c of cities) {
        console.log(`\n=== ${c} ===`);
        const r = await processCity(c, { dryRun, limit: limit || undefined, batch });
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
