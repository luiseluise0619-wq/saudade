#!/usr/bin/env node
/**
 * saudade · audit RSS_PIPELINE_FEEDS liveness.
 *
 * Extracts every URL from cloudflare-worker.js's RSS_PIPELINE_FEEDS,
 * fetches each with a real-browser UA + RSS-friendly Accept header,
 * 12s timeout, parallelised at 10 concurrent. Reports per-URL:
 *
 *   STATUS   ALIVE   url                                       hint
 *   200      ✓       https://news.seoul.go.kr/rss/news_all.xml 서울시
 *   404      ✗       https://www.jongno.go.kr/portal/main/...  종로구
 *
 * Alive = HTTP 200 + body looks like XML/RSS (root element <rss /
 * <feed / <channel / <?xml).
 *
 * Usage:
 *   node scripts/audit-rss.js              # human-readable table
 *   node scripts/audit-rss.js --json       # machine-readable JSON
 *   node scripts/audit-rss.js --markdown   # GitHub Actions summary
 *
 * Run via GitHub Actions (.github/workflows/audit-rss.yml) so the
 * outbound network goes through GitHub-hosted runners (no sandbox
 * firewall). Pulls list straight from the worker source so it
 * always matches the deployed list.
 */
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKER = path.join(ROOT, 'cloudflare-worker.js');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const ACCEPT = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5';

function extractFeeds() {
    const src = fs.readFileSync(WORKER, 'utf8');
    const start = src.indexOf('const RSS_PIPELINE_FEEDS = [');
    const end = src.indexOf('\n];', start);
    if (start < 0 || end < 0) throw new Error('RSS_PIPELINE_FEEDS not found');
    const block = src.slice(start, end);
    const feeds = [];
    const re = /\{\s*url:\s*'([^']+)'[^}]*city:\s*('?[^,']*'?)[^}]*section:\s*'([^']+)'(?:[^}]*hint:\s*'([^']+)')?[^}]*\}/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        feeds.push({
            url: m[1],
            city: m[2].replace(/'/g, '') === 'null' ? null : m[2].replace(/'/g, ''),
            section: m[3],
            hint: m[4] || ''
        });
    }
    return feeds;
}

function fetchWithTimeout(url, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fetch(url, {
        redirect: 'follow',
        signal: ac.signal,
        headers: { 'User-Agent': UA, 'Accept': ACCEPT, 'Accept-Language': 'en-US,en;q=0.9' }
    }).then(async r => {
        clearTimeout(t);
        const buf = await r.arrayBuffer().catch(() => null);
        const head = buf ? new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 800)) : '';
        const isXml = /<\?xml|<rss\b|<feed\b|<channel\b/i.test(head);
        return { status: r.status, ctype: r.headers.get('content-type') || '', size: buf?.byteLength || 0, isXml };
    }).catch(e => {
        clearTimeout(t);
        return { status: 0, ctype: '', size: 0, isXml: false, err: e.name === 'AbortError' ? 'timeout' : e.message };
    });
}

async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function worker() {
        while (true) {
            const idx = i++;
            if (idx >= items.length) break;
            out[idx] = await fn(items[idx], idx);
        }
    }
    await Promise.all(Array.from({ length: n }, worker));
    return out;
}

async function main() {
    const args = process.argv.slice(2);
    const format = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text';

    const feeds = extractFeeds();
    process.stderr.write(`Auditing ${feeds.length} feeds…\n`);

    const results = await pool(feeds, 10, async (f) => {
        const r = await fetchWithTimeout(f.url, 12000);
        const alive = r.status === 200 && r.isXml;
        return { ...f, ...r, alive };
    });

    const aliveCount = results.filter(r => r.alive).length;
    const xml200 = results.filter(r => r.status === 200 && r.isXml).length;
    const html200 = results.filter(r => r.status === 200 && !r.isXml).length;
    const dead = results.filter(r => r.status === 0 || r.status >= 400);

    if (format === 'json') {
        console.log(JSON.stringify({ total: feeds.length, alive: aliveCount, results }, null, 2));
        return;
    }

    if (format === 'markdown') {
        console.log(`## RSS feed audit\n`);
        console.log(`**${aliveCount} / ${feeds.length} alive** · ${xml200} valid XML · ${html200} 200-but-not-XML · ${dead.length} dead\n`);
        console.log(`### Dead / missing\n`);
        console.log(`| status | url | city | section | hint |`);
        console.log(`|---|---|---|---|---|`);
        for (const r of results.filter(x => !x.alive)) {
            const code = r.status === 0 ? (r.err || 'FAIL') : r.status;
            const u = r.url.length > 60 ? r.url.slice(0, 57) + '…' : r.url;
            console.log(`| ${code} | \`${u}\` | ${r.city || '—'} | ${r.section} | ${r.hint || ''} |`);
        }
        console.log(`\n### Alive\n`);
        console.log(`| url | city | section | hint |`);
        console.log(`|---|---|---|---|`);
        for (const r of results.filter(x => x.alive)) {
            const u = r.url.length > 60 ? r.url.slice(0, 57) + '…' : r.url;
            console.log(`| \`${u}\` | ${r.city || '—'} | ${r.section} | ${r.hint || ''} |`);
        }
        return;
    }

    // text
    console.log(`STATUS  XML  CITY            SECTION       URL`);
    console.log(`──────  ───  ──────────────  ────────────  ────────────────────────────────────────`);
    for (const r of results) {
        const code = r.status === 0 ? (r.err === 'timeout' ? 'TIMEOUT' : 'FAIL') : String(r.status);
        const xml = r.isXml ? '✓' : '·';
        const city = (r.city || '—').padEnd(14);
        const section = r.section.padEnd(12);
        const url = r.url.length > 70 ? r.url.slice(0, 67) + '…' : r.url;
        console.log(`${code.padEnd(7)}${xml}    ${city}  ${section}  ${url}${r.hint ? '  // ' + r.hint : ''}`);
    }
    console.log(`\n${aliveCount} / ${feeds.length} alive · ${xml200} XML 200 · ${html200} 200-not-XML · ${dead.length} dead`);
    process.exit(aliveCount > 0 ? 0 : 1);
}

main().catch(e => { console.error(e.stack || e); process.exit(2); });
