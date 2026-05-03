// SAUDADE · v7 §10 — AI Pipeline (LLM 추상화 + cron 스캐폴드)
//
// 이 파일은 Cloudflare Worker scheduled() 핸들러용 모듈.
// cloudflare-worker.js 에서 import 하거나, 코드를 거기로 옮겨도 됨 (Workers 단일 파일 배포).
//
// LLM Abstraction Layer (v7 §10.3) — 교체 가능:
//   classify  — Workers AI Llama 3.1 8B (도시 분류)
//   score     — Workers AI (quietness/dignity 1~10점)
//   rewrite   — Gemini 2.0 Flash (3~4 문장)
//   translate — Gemini Flash (별쇄 번역)
//
// Cron 흐름 (KST 기준 → wrangler.toml 에 cron triggers):
//   00:00 Gather    rss-parser → raw_feeds INSERT
//   00:30 Sort      Workers AI → raw_feeds.city UPDATE
//   02:00 Score     Workers AI → raw_feeds.ai_score UPDATE
//   04:00 Write     Gemini → dispatches_staged INSERT
//   05:00 Translate Gemini → dispatches_staged (5 에디션) INSERT
//   05:30 Stage     no-op (편집자 검수 대기)
//   06:00 File      Top 3 publish (status='staged' → 'published')

'use strict';

// ─── 금지어 가드 (v7 §10.5) ────────────────────────────────────
const FORBIDDEN_WORDS = [
    'breaking', 'urgent', 'alert', 'crisis', 'shocking',
    'tragic', 'outrage', 'scandal', 'controversy'
];

function hasForbidden(text) {
    if (!text) return false;
    const lc = String(text).toLowerCase();
    return FORBIDDEN_WORDS.some(w => new RegExp('\\b' + w + '\\b', 'i').test(lc));
}

// ─── LLM Client 추상화 (v7 §10.3) ─────────────────────────────
function createLLMClient(env) {
    return {
        async classify(text, cities) {
            // Workers AI: env.AI.run(model, { prompt })
            if (!env || !env.AI) return null;
            const prompt = `Classify this article into one of: ${cities.join(', ')}. Return only the city name.\n\nArticle: ${text.slice(0, 800)}`;
            try {
                const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt });
                const out = (r.response || '').trim();
                return cities.find(c => out.toLowerCase().includes(c.toLowerCase())) || null;
            } catch (e) { return null; }
        },
        async score(text) {
            if (!env || !env.AI) return null;
            const prompt = `Rate quietness/dignity 1-10. 10 = magazine tone, 1 = breaking-news shouting. Return number only.\n\n${text.slice(0, 800)}`;
            try {
                const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt });
                const m = (r.response || '').match(/(\d+(\.\d+)?)/);
                return m ? Math.max(0, Math.min(10, parseFloat(m[1]))) : null;
            } catch (e) { return null; }
        },
        async rewrite(text, prompt) {
            if (!env || !env.GEMINI_KEY) return null;
            const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + env.GEMINI_KEY;
            const body = {
                contents: [{ parts: [{ text: `${prompt}\n\nSource:\n${text}` }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
            };
            try {
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!r.ok) return null;
                const j = await r.json();
                return (((j.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || null;
            } catch (e) { return null; }
        },
        async translate(text, fromLang, toLang) {
            if (!env || !env.GEMINI_KEY) return null;
            const prompt = `Translate from ${fromLang} to ${toLang}. Magazine tone, declarative voice. Return only translation:\n\n${text}`;
            return await this.rewrite(text, prompt);
        }
    };
}

// ─── 요일별 프롬프트 (v7 §10.4) ─────────────────────────────
const WEEKDAY_PROMPTS = {
    1: `Visa or policy notice. Rewrite in 3 sentences. Magazine tone. Declarative. No "breaking" or "alert". Quote at most 25 words.\nExample: "Schengen 90/180 stays unchanged through 2027."`,
    2: `Museum or gallery announcement. 3-4 sentences. Contemplative. Declarative.\nExample: "The Yodogawa is unusually quiet this week."`,
    3: `City hall notice. 3 sentences. Plain language. No urgency.\nExample: "Banks closed Monday for Liberdade."`,
    4: `New cafe / coworking note. 3 sentences. Sensory detail (walls, light, hours).\nExample: "Granite walls. Twelve outlets. Wifi reliable."`,
    5: `Editor's photograph note. 2 sentences. First person, restrained.`,
    6: `Quiet news. 3 sentences. Local, small, undramatic.\nExample: "The 28 tram is back, in pieces."`
};

// ─── Cron 핸들러 (Worker scheduled handler 용) ─────────────────
// Worker 의 scheduled() 에서 event.cron 으로 분기.
// wrangler.toml triggers 예: "0 15 * * *" (UTC 기준 = 00:00 KST)
async function runCronJob(event, env, ctx) {
    const cron = event.cron;
    const llm = createLLMClient(env);
    if (!env.SAUDADE_DB) return { ok: false, reason: 'no_db' };

    switch (cron) {
        case '0 15 * * *': return gather(env, ctx);                  // 00:00 KST
        case '30 15 * * *': return sort(env, ctx, llm);              // 00:30 KST
        case '0 17 * * *': return score(env, ctx, llm);              // 02:00 KST
        case '0 19 * * *': return writeRewrites(env, ctx, llm);      // 04:00 KST
        case '0 20 * * *': return translateAll(env, ctx, llm);       // 05:00 KST
        case '30 20 * * *': return stage(env, ctx);                  // 05:30 KST
        case '0 21 * * *': return file(env, ctx);                    // 06:00 KST
        case '0 15 * * 1': return weeklyStats(env, ctx);             // 월요일 00:00 KST 약한 연결 집계
        default: return { ok: false, reason: 'unknown_cron', cron };
    }
}

// v8 §11 §13 — 약한 연결 표시용 주간 통계 집계 (M3 활성화 시 UI 가 읽음).
// 매주 월요일 자정에 listening_sessions / cafe_submissions / users 집계 → weekly_stats.
async function weeklyStats(env, ctx) {
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'weekly_stats', reason: 'no_db' };
    const db = env.SAUDADE_DB;
    const now = Date.now();
    const weekStart = now - 7 * 86400 * 1000;
    const nextMonday = now + 7 * 86400 * 1000;
    let written = 0;

    async function setStat(key, value) {
        await db.prepare(
            `INSERT INTO weekly_stats (stat_key, stat_value, computed_at, expires_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(stat_key) DO UPDATE SET
                 stat_value = excluded.stat_value,
                 computed_at = excluded.computed_at,
                 expires_at = excluded.expires_at`
        ).bind(key, JSON.stringify(value), now, nextMonday).run();
        written++;
    }

    try {
        // listening:weekly_total — 전체 세션 수 + 도시 distinct count
        const listenStats = await db.prepare(
            `SELECT COUNT(*) AS sessions, COUNT(DISTINCT city) AS cities
             FROM listening_sessions WHERE started_at >= ?`
        ).bind(weekStart).first();
        await setStat('listening:weekly_total', {
            sessions: listenStats.sessions || 0,
            cities:   listenStats.cities   || 0
        });

        // atlas:weekly_submissions — 상위 3 도시별 카페 제출 수 (status='pending')
        const atlasStats = await db.prepare(
            `SELECT city, COUNT(*) AS n
             FROM cafe_submissions WHERE submitted_at >= ?
             GROUP BY city ORDER BY n DESC LIMIT 3`
        ).bind(weekStart).all();
        await setStat('atlas:weekly_submissions', {
            top_cities: ((atlasStats && atlasStats.results) || []).map(r => ({ city: r.city, count: r.n }))
        });

        // cover:{city}:readers — 도시별 Following 사용자 수 (slot 1 만 — 정착 의미)
        const followingStats = await db.prepare(
            `SELECT city, COUNT(*) AS n FROM user_following_cities
             WHERE position = 1 GROUP BY city`
        ).all();
        for (const row of ((followingStats && followingStats.results) || [])) {
            await setStat('cover:' + row.city + ':readers', { city: row.city, readers: row.n });
        }
    } catch (e) {
        return { ok: false, phase: 'weekly_stats', error: String(e).slice(0, 200) };
    }
    return { ok: true, phase: 'weekly_stats', written };
}

// ─── RSS sources / forbidden 로더 (v7 §3 / §9.3) ───────────────────────
// gather() 가 D1 의 rss_sources WHERE active=1 AND terms_status='approved'
// AND rss_url IS NOT NULL 만 조회. forbidden_sources 도메인은 raw_feeds INSERT 전 차단.

async function loadActiveSources(db) {
    if (!db) return [];
    try {
        const r = await db.prepare(
            `SELECT id, city_slug, source_name, rss_url, weekday_section, license_type
             FROM rss_sources
             WHERE active = 1 AND terms_status = 'approved' AND rss_url IS NOT NULL`
        ).all();
        return (r && r.results) || [];
    } catch (e) { return []; }
}

async function loadForbiddenDomains(db) {
    if (!db) return [];
    try {
        const r = await db.prepare(
            `SELECT domain_pattern FROM forbidden_sources`
        ).all();
        return ((r && r.results) || []).map(row => String(row.domain_pattern || '').toLowerCase());
    } catch (e) { return []; }
}

function isUrlForbidden(url, forbiddenList) {
    if (!url || !forbiddenList || !forbiddenList.length) return false;
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
    return forbiddenList.some(pat => host === pat || host.endsWith('.' + pat));
}

// ─── 미니 RSS 파서 (의존성 X — Workers 환경) ────────────────────────
// rss-parser 는 Workers 호환 X. RSS 2.0 / Atom 1.0 핵심 필드만 정규식 추출.
// 큰 spec X — title / link / pubDate / description 만.

function parseFeedXml(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const items = [];
    // <item>...</item> (RSS) 또는 <entry>...</entry> (Atom)
    const itemRe = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
    let m;
    while ((m = itemRe.exec(xml)) !== null) {
        const block = m[0];
        const pick = (tag) => {
            const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const mm = block.match(re);
            if (!mm) return '';
            return mm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        };
        const link = (() => {
            const linkText = pick('link');
            if (linkText && /^https?:/i.test(linkText)) return linkText;
            // Atom: <link href="..."/>
            const atomMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
            return atomMatch ? atomMatch[1] : '';
        })();
        const title = pick('title').replace(/<[^>]+>/g, '');
        const summary = (pick('description') || pick('summary') || pick('content')).replace(/<[^>]+>/g, '').slice(0, 1000);
        const pubDate = pick('pubDate') || pick('published') || pick('updated');
        const pubMs = pubDate ? Date.parse(pubDate) : 0;
        if (link && title) {
            items.push({ title, link, summary, pub_ms: Number.isFinite(pubMs) ? pubMs : 0 });
        }
    }
    return items;
}

// 각 phase — 점진적 구현 (스텁에서 D1 통합으로 단계 이전)
async function gather(env, ctx) {
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'gather', reason: 'no_db' };
    const db = env.SAUDADE_DB;
    const sources = await loadActiveSources(db);
    const forbidden = await loadForbiddenDomains(db);
    if (!sources.length) {
        return { ok: true, phase: 'gather', count: 0, sources: 0, note: 'no active rss_sources — operator setup pending' };
    }
    const now = Date.now();
    let inserted = 0, blocked = 0, errors = 0;

    for (const src of sources) {
        let xml = '';
        try {
            const r = await fetch(src.rss_url, {
                headers: { 'User-Agent': 'Saudade/1.0 (+https://saudade.app/about)' },
                cf: { cacheTtl: 0 }
            });
            if (!r.ok) {
                await db.prepare(
                    `UPDATE rss_sources SET last_fetch_at=?, last_fetch_ok=0, fetch_error=? WHERE id=?`
                ).bind(now, 'HTTP ' + r.status, src.id).run();
                errors++;
                continue;
            }
            xml = await r.text();
        } catch (e) {
            await db.prepare(
                `UPDATE rss_sources SET last_fetch_at=?, last_fetch_ok=0, fetch_error=? WHERE id=?`
            ).bind(now, String(e && e.message || e).slice(0, 200), src.id).run();
            errors++;
            continue;
        }

        const items = parseFeedXml(xml).slice(0, 20);   // per-feed cap
        for (const it of items) {
            if (isUrlForbidden(it.link, forbidden)) { blocked++; continue; }
            try {
                await db.prepare(
                    `INSERT OR IGNORE INTO raw_feeds
                        (fetched_at, source_url, raw_title, raw_summary, raw_pub_date, city, weekday_section)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    now, it.link, it.title, it.summary,
                    it.pub_ms || now, src.city_slug, src.weekday_section
                ).run();
                inserted++;
            } catch (e) { /* dedup unique constraint or other — skip */ }
        }
        await db.prepare(
            `UPDATE rss_sources SET last_fetch_at=?, last_fetch_ok=1, fetch_error=NULL WHERE id=?`
        ).bind(now, src.id).run();
    }
    return { ok: true, phase: 'gather', sources: sources.length, inserted, blocked, errors };
}
// v8 §02 — sort/score/write 가 도시-단위로 작동.
// city-pool.json 의 14 도시 각각에 대해 raw_feeds 가 존재하면 dispatch 1개씩 생성.
// 사용자별 매칭은 /dispatches/today 가 user_following_cities 조회 후 처리.

const CITY_POOL_SLUGS = [
    'lisbon', 'porto', 'madrid', 'barcelona', 'berlin',
    'tokyo', 'seoul', 'chiang-mai', 'bali', 'da-nang',
    'mexico-city', 'medellin', 'buenos-aires', 'tbilisi'
];

async function sort(env, ctx, llm) {
    // raw_feeds WHERE city IS NULL → Llama classify → UPDATE city
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'sort', reason: 'no_db' };
    if (!llm || !llm.classify) return { ok: false, phase: 'sort', reason: 'no_llm' };
    const db = env.SAUDADE_DB;
    let updated = 0, errors = 0;
    try {
        const rows = await db.prepare(
            `SELECT id, raw_title, raw_summary FROM raw_feeds WHERE city IS NULL LIMIT 50`
        ).all();
        const items = (rows && rows.results) || [];
        for (const r of items) {
            const text = (r.raw_title || '') + '\n' + (r.raw_summary || '');
            const city = await llm.classify(text, CITY_POOL_SLUGS);
            if (city) {
                await db.prepare(`UPDATE raw_feeds SET city = ? WHERE id = ?`).bind(city, r.id).run();
                updated++;
            } else { errors++; }
        }
    } catch (e) { return { ok: false, phase: 'sort', error: String(e).slice(0, 200) }; }
    return { ok: true, phase: 'sort', updated, errors };
}

async function score(env, ctx, llm) {
    // raw_feeds WHERE ai_score IS NULL → Llama score 1-10 → UPDATE
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'score', reason: 'no_db' };
    if (!llm || !llm.score) return { ok: false, phase: 'score', reason: 'no_llm' };
    const db = env.SAUDADE_DB;
    let updated = 0;
    try {
        const rows = await db.prepare(
            `SELECT id, raw_title, raw_summary FROM raw_feeds
             WHERE ai_score IS NULL AND city IS NOT NULL LIMIT 50`
        ).all();
        for (const r of (rows.results || [])) {
            const text = (r.raw_title || '') + '\n' + (r.raw_summary || '');
            const s = await llm.score(text);
            if (s != null) {
                await db.prepare(`UPDATE raw_feeds SET ai_score = ? WHERE id = ?`).bind(s, r.id).run();
                updated++;
            }
        }
    } catch (e) { return { ok: false, phase: 'score', error: String(e).slice(0, 200) }; }
    return { ok: true, phase: 'score', updated };
}

async function writeRewrites(env, ctx, llm) {
    // v8 §02 — 도시별 dispatch 1개씩 (정착+주변 폐기). 사용자별 매칭은 file 단계에서.
    // 각 city 의 ai_score 상위 1개 → llm.rewrite (요일 프롬프트) → dispatches_staged INSERT.
    // 금지어 hasForbidden 검사 후 재시도 max 3.
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'write', reason: 'no_db' };
    if (!llm || !llm.rewrite) return { ok: false, phase: 'write', reason: 'no_llm' };
    const db = env.SAUDADE_DB;
    const today = new Date();
    const weekday = today.getDay() || 1;   // 0(Sun)→1(Mon)
    if (weekday > 6) return { ok: true, phase: 'write', skipped: 'sunday' };
    const prompt = WEEKDAY_PROMPTS[weekday] || WEEKDAY_PROMPTS[1];
    const stagedAt = Date.now();
    let written = 0, blocked = 0;

    for (const city of CITY_POOL_SLUGS) {
        try {
            const top = await db.prepare(
                `SELECT id, raw_title, raw_summary, source_url
                 FROM raw_feeds
                 WHERE city = ? AND processed_at IS NULL AND ai_score IS NOT NULL
                 ORDER BY ai_score DESC LIMIT 1`
            ).bind(city).first();
            if (!top) continue;

            let attempts = 0, drafted = null;
            while (attempts < 3 && !drafted) {
                attempts++;
                const text = (top.raw_title || '') + '\n' + (top.raw_summary || '');
                const out = await llm.rewrite(text, prompt);
                if (out && !hasForbidden(out)) drafted = out; else if (out) blocked++;
            }
            if (!drafted) continue;
            // 첫 줄 = headline, 둘째 줄 = lede, 나머지 = body. 단순 split.
            const lines = drafted.split('\n').map(s => s.trim()).filter(Boolean);
            const headline = (lines[0] || '').slice(0, 160);
            const lede     = (lines[1] || '').slice(0, 240);
            const body     = lines.slice(2).join(' ').slice(0, 1200);

            await db.prepare(
                `INSERT INTO dispatches_staged
                    (raw_feed_id, edition, weekday, headline, lede, body, source_url, ai_score, status, staged_at)
                 VALUES (?, 'en', ?, ?, ?, ?, ?, ?, 'staged', ?)`
            ).bind(top.id, weekday, headline, lede, body, top.source_url, top.ai_score || 0, stagedAt).run();
            await db.prepare(
                `UPDATE raw_feeds SET processed_at = ? WHERE id = ?`
            ).bind(stagedAt, top.id).run();
            written++;
        } catch (e) { /* skip */ }
    }
    return { ok: true, phase: 'write', written, blocked, weekday };
}

async function translateAll(env, ctx, llm) {
    // dispatches_staged WHERE edition='en' AND status='staged' → 4 에디션 별쇄 INSERT
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'translate', reason: 'no_db' };
    if (!llm || !llm.translate) return { ok: false, phase: 'translate', reason: 'no_llm' };
    const db = env.SAUDADE_DB;
    const editions = ['ko', 'ja', 'pt', 'es'];
    let translated = 0;
    try {
        const rows = await db.prepare(
            `SELECT id, headline, lede, body, raw_feed_id, weekday, source_url, ai_score
             FROM dispatches_staged
             WHERE edition='en' AND status='staged' AND staged_at > ?
             LIMIT 30`
        ).bind(Date.now() - 24 * 3600 * 1000).all();
        for (const r of (rows.results || [])) {
            for (const ed of editions) {
                // 이미 번역됐는지 체크
                const exists = await db.prepare(
                    `SELECT id FROM dispatches_staged WHERE raw_feed_id = ? AND edition = ?`
                ).bind(r.raw_feed_id, ed).first();
                if (exists) continue;
                const trH = await llm.translate(r.headline || '', 'en', ed);
                const trL = await llm.translate(r.lede || '', 'en', ed);
                const trB = r.body ? await llm.translate(r.body, 'en', ed) : '';
                if (trH || trL || trB) {
                    await db.prepare(
                        `INSERT INTO dispatches_staged
                            (raw_feed_id, edition, weekday, headline, lede, body, source_url, ai_score, status, staged_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?)`
                    ).bind(r.raw_feed_id, ed, r.weekday, trH || r.headline,
                           trL || r.lede, trB || r.body, r.source_url, r.ai_score, Date.now()).run();
                    translated++;
                }
            }
        }
    } catch (e) { return { ok: false, phase: 'translate', error: String(e).slice(0, 200) }; }
    return { ok: true, phase: 'translate', translated };
}

async function stage(env, ctx) {
    // 검수 큐 marker — 편집장 /desk 가 처리. 단순 pass-through.
    return { ok: true, phase: 'stage' };
}

async function file(env, ctx) {
    // v8 §02 — staged 전체 published 상태로 전환. 사용자별 매칭은
    // /dispatches/today endpoint 가 user_following_cities 조회 후 수행.
    if (!env || !env.SAUDADE_DB) return { ok: false, phase: 'file', reason: 'no_db' };
    const db = env.SAUDADE_DB;
    const now = Date.now();
    try {
        const r = await db.prepare(
            `UPDATE dispatches_staged
             SET status='published', published_at = ?
             WHERE status='staged' AND staged_at > ?`
        ).bind(now, now - 24 * 3600 * 1000).run();
        return { ok: true, phase: 'file', published: r.meta && r.meta.changes };
    } catch (e) { return { ok: false, phase: 'file', error: String(e).slice(0, 200) }; }
}

// 테스트/수동 트리거용 export (모듈 export 형태로 변경 가능)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runCronJob, createLLMClient, hasForbidden, WEEKDAY_PROMPTS, FORBIDDEN_WORDS };
}
