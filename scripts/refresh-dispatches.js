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
 * Usage:
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js --editions ko,ja
 *   GEMINI_KEY=xxxx node scripts/refresh-dispatches.js --dry
 *
 * Exit: 0 on full success, 1 if any edition failed (other editions still write).
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// gemini-2.0-flash was retired from the free tier (limit:0 as of 2026-05).
// 2.5-flash-lite is the current cheapest workable model; it accepts the
// same prompt shape and writes the same dispatch JSON.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
    const out = { editions: Object.keys(EDITION_CONFIG), dry: false };
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
    const { filed_at, next_filing } = isoNowKst();
    const out = {
        edition,
        filed_at,
        next_filing,
        ai_assisted: true,
        ai_disclosure: 'Drafted with Gemini, written for this edition\'s readers — not translated from English.',
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
