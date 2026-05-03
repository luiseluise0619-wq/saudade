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
        default: return { ok: false, reason: 'unknown_cron', cron };
    }
}

// 각 phase — 스텁 (실제 구현은 점진적으로)
async function gather(env, ctx) {
    // TODO: rss-parser 로 RSS_FEEDS 모아 raw_feeds INSERT
    return { ok: true, phase: 'gather', count: 0, todo: true };
}
async function sort(env, ctx, llm) {
    // TODO: SELECT raw_feeds WHERE city IS NULL → llm.classify → UPDATE
    return { ok: true, phase: 'sort', count: 0, todo: true };
}
async function score(env, ctx, llm) {
    // TODO: SELECT raw_feeds WHERE ai_score IS NULL → llm.score → UPDATE
    return { ok: true, phase: 'score', count: 0, todo: true };
}
async function writeRewrites(env, ctx, llm) {
    // TODO: top scored → llm.rewrite (per weekday prompt) → INSERT dispatches_staged
    // 금지어 hasForbidden() → 폐기 + 재시도 max 3
    return { ok: true, phase: 'write', count: 0, todo: true };
}
async function translateAll(env, ctx, llm) {
    // TODO: dispatches_staged WHERE edition='en' → llm.translate × 4 에디션 → INSERT
    return { ok: true, phase: 'translate', count: 0, todo: true };
}
async function stage(env, ctx) {
    // 검수 큐 marker (no-op — 편집장 /desk 가 처리)
    return { ok: true, phase: 'stage', todo: true };
}
async function file(env, ctx) {
    // top 3 staged → published, today's dispatches.json regenerate
    return { ok: true, phase: 'file', count: 0, todo: true };
}

// 테스트/수동 트리거용 export (모듈 export 형태로 변경 가능)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runCronJob, createLLMClient, hasForbidden, WEEKDAY_PROMPTS, FORBIDDEN_WORDS };
}
