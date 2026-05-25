#!/usr/bin/env node
/**
 * saudade · refresh per-edition dispatches.
 *
 * Replaces the broken translate cron. Each edition (ko/ja/pt/es) is now
 * generated independently against its own city pool with a native-voice
 * Gemini prompt — KO speaks to Seoul/Busan/Jeju readers, JA to Tokyo/Osaka/
 * Kyoto, etc. EN keeps its existing D1-backed Worker pipeline (this script
 * does not touch it).
 *
 * Schema preserved (frontend reads it unchanged):
 *   {
 *     "edition":     "ko",
 *     "filed_at":    "2026-05-06T06:00:00+09:00",
 *     "next_filing": "2026-05-07T06:00:00+09:00",
 *     "ai_assisted": true,
 *     "ai_disclosure": "Drafted with Gemini, edited by the saudade desk.",
 *     "cities":      [{ "city": "서울", "items": [{ n, headline, lede, body, ... }] }]
 *   }
 *
 * Two-stage AI pipeline (no human in the loop, by founder decision):
 *   1. DRAFT  — Gemini writes 3 items per city in the edition's voice.
 *   2. REVIEW — a second Gemini pass copy-edits the draft against the
 *               constitution's hard rules (no politics/violence/scandal,
 *               declarative tone, no invented figures, quotes ≤25 words,
 *               right language, right cities, Latin numerals). If ANY
 *               item is rejected, publication is BLOCKED and the previous
 *               day's file is kept. Bad copy never auto-publishes.
 *
 * Usage:
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js --editions ko,ja
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js --dry
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js --no-review   # skip the gate
 *
 * Exit: 0 on full success, 1 if any edition failed/was-blocked (others still write).
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// Use the -latest alias, not a pinned version. gemini-2.0-flash was
// retired from the free tier (limit:0) and silently killed this script
// once already; pinning 2.5-flash-lite would just defer the same bug to
// its eventual retirement. gemini-flash-lite-latest always routes to the
// current stable flash-lite (cheap tier), immune to deprecation.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const GEMINI_URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Per-edition city pools ──────────────────────────────────────────────
// Each edition speaks to its own audience's cities. KO doesn't try to
// cover Lisbon — Lisbon is EN's job. PT covers Iberia + lusofonia, ES
// covers Spain + Latam, JA covers Japan, KO covers Korea.
const EDITION_CONFIG = {
    ko: {
        label: 'Korean',
        cities: ['서울', '부산', '제주'],
        voice: '평어체 (declarative). 매거진 톤. 짧은 문장. 정보 + 한 줄의 관찰.',
        examples: [
            '북촌의 한옥 지붕에서, 빗방울이 늦게 떨어진다.',
            '광안리 모래사장이, 하루 동안 비어 있었다.',
            '한라산의 철쭉이, 이주째 전성기에 머물러 있다.'
        ]
    },
    ja: {
        label: 'Japanese',
        cities: ['東京', '大阪', '京都'],
        voice: '平叙体 (declarative). 雑誌のトーン. 短文. 観察 + 一行の余韻.',
        examples: [
            '上野公園の遅咲きが、今年は十日ほど続く。',
            '淀川の水位が、今春一番低い。',
            '鴨川の床営業が、今年は四月二十九日から始まった。'
        ]
    },
    pt: {
        label: 'Portuguese (European, with Brazil acceptable)',
        cities: ['LISBOA', 'PORTO', 'SINTRA'],
        voice: 'Declarative. Magazine tone. Short sentences. Observation + restraint.',
        examples: [
            'O 28, em pedaços, regressa.',
            'A ponte Luís I fecha ao trânsito durante uma noite.',
            'O Palácio da Pena reabre a sala oriental depois de restauro.'
        ]
    },
    es: {
        label: 'Spanish (European + Latin American)',
        cities: ['MADRID', 'BARCELONA', 'BUENOS AIRES'],
        voice: 'Declarative. Magazine tone. Short sentences. Observation + restraint.',
        examples: [
            'El Retiro abre por la noche los viernes de mayo.',
            'El metro L9 Sur amplía su servicio nocturno los sábados.',
            'El Teatro Colón estrena temporada con butacas reformadas.'
        ]
    }
};

function parseArgs(argv) {
    const out = { editions: Object.keys(EDITION_CONFIG), dry: false, noReview: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--editions') {
            out.editions = (argv[++i] || '')
                .split(',').map(s => s.trim()).filter(Boolean)
                .filter(s => EDITION_CONFIG[s]);
            if (out.editions.length === 0) {
                console.error(`No valid editions. Available: ${Object.keys(EDITION_CONFIG).join(', ')}`);
                process.exit(2);
            }
        } else if (a === '--dry') {
            out.dry = true;
        } else if (a === '--no-review') {
            out.noReview = true;
        }
    }
    return out;
}

function buildPrompt(edition) {
    const cfg = EDITION_CONFIG[edition];
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
        `You are writing the ${cfg.label} edition of saudade — a slow-news magazine`,
        `for travelers and quiet observers. Voice: ${cfg.voice}`,
        ``,
        `Today is ${today}. For each of these cities, write ONE seasonal observation`,
        `that a careful resident or returning traveler might notice this week.`,
        `Topics: weather, architecture, public space, transit, gardens, festivals,`,
        `quiet neighborhood news. NEVER cover politics, war, scandals, or violence.`,
        `Each item is small, declarative, magazine-tone — not news headlines.`,
        ``,
        `Cities (write items in this exact city order, in ${cfg.label}):`,
        ...cfg.cities.map(c => `  - ${c}`),
        ``,
        `Voice examples (do not copy, match cadence):`,
        ...cfg.examples.map(e => `  ${e}`),
        ``,
        `Output STRICT JSON only — no prose, no markdown, no code fences.`,
        `Schema:`,
        `{`,
        `  "cities": [`,
        `    {`,
        `      "city": "<city name in ${cfg.label}>",`,
        `      "items": [`,
        `        {`,
        `          "n": "01",`,
        `          "headline": "<one declarative sentence in ${cfg.label}, ≤ 18 words>",`,
        `          "lede":     "<one supporting sentence in ${cfg.label}, ≤ 22 words>",`,
        `          "body":     "<two short sentences in ${cfg.label}, ≤ 60 words total>",`,
        `          "source":      "saudade desk",`,
        `          "source_date": "${today}"`,
        `        }`,
        `      ]`,
        `    }`,
        `  ]`,
        `}`,
        ``,
        `Each city gets exactly 3 items numbered "01", "02", "03".`,
        `Total 9 items. Every string is ${cfg.label}, no other languages.`,
        ``,
        `CRITICAL — numerals: ALWAYS Latin digits (10日, 4月29日, 21:00, 30分,`,
        `42%). NEVER spelled out — not 十日, not 四月二十九日, not 사십칠,`,
        `not "thirty". Idioms with Sino-Korean readings (사흘, 이틀, 하루)`,
        `MAY remain — those aren't numerals, they're words. But everything`,
        `that means an actual count or date or duration must be a Latin digit.`
    ];
    return lines.join('\n');
}

async function callGemini(prompt, key) {
    const url = `${GEMINI_URL_BASE}?key=${encodeURIComponent(key)}`;
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
        }
    };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
}

function safeParse(s) {
    if (!s) return null;
    // Gemini sometimes wraps in ```json ... ``` despite responseMimeType.
    let t = s.trim();
    if (t.startsWith('```')) t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); } catch (e) { return null; }
}

function isoNowKst() {
    // KST 06:00 today. Next filing = +24h.
    const d = new Date();
    const kst = new Date(d.getTime() + 9 * 3600 * 1000);
    const ymd = kst.toISOString().slice(0, 10);
    return {
        filed_at:    `${ymd}T06:00:00+09:00`,
        next_filing: new Date(new Date(`${ymd}T06:00:00+09:00`).getTime() + 24 * 3600 * 1000)
            .toISOString().replace(/\.\d{3}Z$/, '+00:00')
    };
}

function fileFor(edition) {
    return path.join(DATA, edition === 'en' ? 'dispatches.json' : `dispatches.${edition}.json`);
}

function validate(parsed, cfg) {
    if (!parsed || !Array.isArray(parsed.cities)) return 'cities array missing';
    if (parsed.cities.length !== cfg.cities.length) return `expected ${cfg.cities.length} cities, got ${parsed.cities.length}`;
    for (const c of parsed.cities) {
        if (!c.city || !Array.isArray(c.items)) return 'city missing items';
        if (c.items.length !== 3) return `${c.city} has ${c.items.length} items, expected 3`;
        for (const it of c.items) {
            if (!it.n || !it.headline || !it.lede) return `${c.city} item missing required fields`;
        }
    }
    return null;
}

// ── AI review gate ────────────────────────────────────────────────────
// The founder dropped the human-rewrite step (cadence sustainability).
// So a second AI pass acts as copy editor: it scores the draft against
// the constitution's hard rules and BLOCKS publication if any item
// violates them. Bad output never reaches readers; the previous day's
// file stays in place until a clean draft passes. This is the "AI files,
// AI reviews" model — with a real gate, not a rubber stamp.
function buildReviewPrompt(edition, cities) {
    const cfg = EDITION_CONFIG[edition];
    return [
        `You are the copy desk for the ${cfg.label} edition of saudade, a slow-news`,
        `magazine. Review the drafted dispatches below against these HARD rules.`,
        `Be strict — you are the last gate before publication, there is no human after you.`,
        ``,
        `REJECT an item (pass=false) if ANY of these is true:`,
        `  1. It covers politics, elections, war, conflict, crime, scandal, death,`,
        `     disaster-as-spectacle, or protest. (Quiet civic notes are fine.)`,
        `  2. It reads like a breaking-news headline rather than a calm, declarative`,
        `     observation a resident might make.`,
        `  3. It states a specific statistic, price, or hard figure that is not`,
        `     common public record (invented precision).`,
        `  4. It contains a quotation longer than 25 words.`,
        `  5. It is not written in ${cfg.label}, or mixes other languages.`,
        `  6. A numeral that means a count/date/time is spelled out instead of`,
        `     Latin digits (e.g. 十日 instead of 10일). Word-idioms like 사흘/이틀 are OK.`,
        `  7. The city does not belong to this edition. Allowed cities: ${cfg.cities.join(', ')}.`,
        ``,
        `Drafted dispatches (JSON):`,
        JSON.stringify({ cities }, null, 1),
        ``,
        `Return STRICT JSON only:`,
        `{`,
        `  "overall_pass": true | false,`,
        `  "rejected": [ { "city": "<city>", "n": "<NN>", "reason": "<short>" } ],`,
        `  "notes": "<one sentence overall>"`,
        `}`,
        `overall_pass MUST be false if "rejected" is non-empty.`
    ].join('\n');
}

async function reviewDispatches(edition, cities, key) {
    let raw;
    try {
        raw = await callGemini(buildReviewPrompt(edition, cities), key);
    } catch (e) {
        // If the reviewer itself errors (quota, network), fail closed:
        // do NOT publish unreviewed content.
        return { pass: false, rejected: [], notes: `reviewer error: ${e.message}`, errored: true };
    }
    const v = safeParse(raw);
    if (!v || typeof v.overall_pass !== 'boolean') {
        return { pass: false, rejected: [], notes: 'reviewer returned unparseable verdict', errored: true };
    }
    const rejected = Array.isArray(v.rejected) ? v.rejected : [];
    return {
        pass: v.overall_pass === true && rejected.length === 0,
        rejected,
        notes: v.notes || '',
        errored: false
    };
}

async function refreshOne(edition, opts, key) {
    const cfg = EDITION_CONFIG[edition];
    process.stderr.write(`[${edition}] generating… `);
    const prompt = buildPrompt(edition);
    let raw;
    try {
        raw = await callGemini(prompt, key);
    } catch (e) {
        console.error(`FAIL Gemini: ${e.message}`);
        return false;
    }
    const parsed = safeParse(raw);
    const err = validate(parsed, cfg);
    if (err) {
        console.error(`FAIL parse/validate: ${err}`);
        return false;
    }

    // AI review gate — blocks publication on any hard-rule violation.
    // Skippable with --no-review (debugging / quota), but the default
    // path always reviews so unreviewed copy never auto-publishes.
    let review = { pass: true, rejected: [], notes: 'review skipped', errored: false };
    if (!opts.noReview) {
        process.stderr.write('reviewing… ');
        review = await reviewDispatches(edition, parsed.cities, key);
        if (!review.pass) {
            console.error(`BLOCKED by review: ${review.notes}` +
                (review.rejected.length ? ` — rejected ${review.rejected.map(r => `${r.city}/${r.n}`).join(', ')}` : ''));
            console.error('  (previous file kept; nothing published)');
            return false;
        }
    }

    const { filed_at, next_filing } = isoNowKst();
    const out = {
        edition,
        filed_at,
        next_filing,
        ai_assisted: true,
        ai_reviewed: !opts.noReview,
        ai_disclosure: opts.noReview
            ? 'Drafted with Gemini for this edition\'s readers — not translated from English. Review skipped this run.'
            : 'Drafted and copy-reviewed by AI (Gemini) against the saudade editorial rules. Written for this edition\'s readers — not translated from English. No human rewrite.',
        cities: parsed.cities
    };
    if (opts.dry) {
        console.log('OK (dry)');
        console.log(JSON.stringify(out, null, 2).slice(0, 600) + '…');
        return true;
    }
    fs.writeFileSync(fileFor(edition), JSON.stringify(out, null, 2) + '\n');
    console.log(`OK → ${path.relative(ROOT, fileFor(edition))} (${out.cities.reduce((s,c)=>s+c.items.length,0)} items)`);
    return true;
}

async function main() {
    const key = (process.env.GEMINI_KEY || '').trim();
    if (!key) {
        console.error('Set GEMINI_KEY=<your Gemini API key>');
        console.error('Get one free at https://aistudio.google.com/apikey');
        process.exit(2);
    }
    const opts = parseArgs(process.argv.slice(2));
    let ok = 0, fail = 0;
    for (const ed of opts.editions) {
        const r = await refreshOne(ed, opts, key);
        if (r) ok++; else fail++;
        // Light pacing — Gemini free tier 15/min for 2.0-flash.
        await new Promise(r => setTimeout(r, 1500));
    }
    console.log(`\n[done] ${ok} edition(s) refreshed · ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
