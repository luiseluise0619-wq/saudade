#!/usr/bin/env node
/**
 * saudade · single-file issue generator.
 *
 * Reads data/dispatches.<edition>.json and produces a self-contained HTML
 * file that prints cleanly to PDF (Cmd/Ctrl+P → Save as PDF) or feeds an
 * EPUB pipeline. No build chain, no Puppeteer — just deterministic HTML.
 *
 * Usage:
 *   node scripts/build-issue.js                     # all editions
 *   node scripts/build-issue.js en                  # single edition
 *   node scripts/build-issue.js --out dist/issues   # custom output dir
 *
 * Output: dist/issues/saudade-<edition>-<filed_at-date>.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DEFAULT_OUT = path.join(ROOT, 'dist', 'issues');

const EDITIONS = ['en', 'ko', 'ja', 'pt', 'es'];

function parseArgs(argv) {
    const args = { editions: [], out: DEFAULT_OUT };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out' && argv[i + 1]) { args.out = path.resolve(argv[++i]); continue; }
        if (EDITIONS.includes(a))         { args.editions.push(a); continue; }
    }
    if (args.editions.length === 0) args.editions = EDITIONS.slice();
    return args;
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tryLoad(edition) {
    const f = edition === 'en'
        ? path.join(DATA, 'dispatches.json')
        : path.join(DATA, `dispatches.${edition}.json`);
    if (!fs.existsSync(f)) return null;
    return loadJson(f);
}

const TITLES = {
    en: 'saudade — dispatches',
    ko: 'saudade — 디스패치',
    ja: 'saudade — ディスパッチ',
    pt: 'saudade — despachos',
    es: 'saudade — despachos'
};
const SUBS = {
    en: 'Three cities, no schedule. Edited from Lisbon.',
    ko: '세 도시, 정해진 시간 없음. 리스본에서 편집.',
    ja: '三つの都市、時刻表なし。リスボン編集。',
    pt: 'Três cidades, sem horário. Editado em Lisboa.',
    es: 'Tres ciudades, sin horario. Editado desde Lisboa.'
};
const NOTES = {
    en: 'AI-assisted. Each item carries an AI DRAFT or REWRITTEN tag. ≤200-char quotes per source. CONTENT-LICENSE.md §7.',
    ko: 'AI 보조. 각 항목에 AI DRAFT 또는 REWRITTEN 라벨 표시. 출처당 인용 ≤200자. CONTENT-LICENSE.md §7.',
    ja: 'AI補助。各項目に AI DRAFT または REWRITTEN ラベル。出典ごと引用 ≤200字。CONTENT-LICENSE.md §7。',
    pt: 'Assistido por IA. Cada item leva uma etiqueta AI DRAFT ou REWRITTEN. Citações ≤200 carac. por fonte. CONTENT-LICENSE.md §7.',
    es: 'Asistido por IA. Cada elemento lleva una etiqueta AI DRAFT o REWRITTEN. Citas ≤200 caract. por fuente. CONTENT-LICENSE.md §7.'
};

const STYLE = `
:root { --paper:#f5efe6; --ink:#1d1a16; --rust:#b35028; --rule:#5e554a; --bone-d:#8a7e6e; }
@page { size: A4 portrait; margin: 18mm 16mm 22mm 16mm; }
@page :first { @top-right { content: ""; } }
@page { @bottom-center { content: "saudade · " counter(page) " / " counter(pages); font-family: "JetBrains Mono", monospace; font-size: 9pt; letter-spacing: 0.18em; color: #5e554a; } }
html, body {
    background: var(--paper); color: var(--ink);
    font-family: "Fraunces", "Times New Roman", serif;
    font-weight: 300; font-size: 11pt; line-height: 1.5;
    margin: 0; padding: 0;
}
.cover {
    text-align: center;
    padding: 28mm 0 18mm;
    border-bottom: 0.5pt solid var(--rule);
    page-break-after: always;
}
.cover h1 {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-weight: 300;
    font-size: 64pt;
    line-height: 0.95;
    margin: 0;
}
.cover .sub {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-size: 14pt;
    color: var(--ink);
    margin: 12pt 0 0;
}
.cover .meta {
    font-family: "JetBrains Mono", monospace;
    font-size: 9pt;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 22pt 0 0;
}
.toc {
    margin: 14pt 0;
    page-break-after: always;
}
.toc h2 { font-family: "JetBrains Mono", monospace; font-size: 10pt; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); }
.toc ol { padding-left: 16pt; }
.toc li { margin: 4pt 0; }
.section {
    page-break-before: always;
}
.section .city {
    font-family: "JetBrains Mono", monospace;
    font-size: 10pt;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 4pt;
}
.section h2 {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-weight: 300;
    font-size: 28pt;
    line-height: 1.05;
    margin: 0 0 10pt;
}
.item {
    page-break-inside: avoid;
    margin: 12pt 0;
    padding: 8pt 0;
    border-top: 0.5pt solid var(--rule);
}
.item .num { font-family: "JetBrains Mono", monospace; font-size: 9pt; letter-spacing: 0.32em; color: var(--bone-d); display: inline-block; min-width: 26pt; }
.item .ai-tag {
    font-family: "JetBrains Mono", monospace;
    font-size: 7pt;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--rust);
    margin-left: 8pt;
}
.item h3 {
    font-family: "Fraunces", serif;
    font-weight: 400;
    font-size: 14pt;
    line-height: 1.25;
    margin: 4pt 0;
}
.item .lede {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-size: 11pt;
    margin: 0 0 4pt;
    color: var(--ink);
}
.item .body {
    font-size: 10.5pt;
}
.item blockquote {
    font-family: "Fraunces", serif;
    font-style: italic;
    border-left: 1pt solid var(--rust);
    padding-left: 10pt;
    margin: 6pt 0;
}
.item .src {
    font-family: "JetBrains Mono", monospace;
    font-size: 8pt;
    color: var(--bone-d);
    letter-spacing: 0.04em;
}
.item .src a { color: inherit; }
.item .src a::after {
    content: " " attr(href);
    font-size: 7pt;
    color: var(--bone-d);
}
.colophon {
    page-break-before: always;
    padding: 14pt 0;
    border-top: 0.5pt solid var(--rule);
}
.colophon p { font-family: "JetBrains Mono", monospace; font-size: 8pt; letter-spacing: 0.06em; color: var(--bone-d); }
`;

function buildHtml(edition, doc) {
    const cities = Array.isArray(doc.cities) ? doc.cities : [];
    const filed  = (doc.filed_at || '').slice(0, 10);
    const next   = (doc.next_filing || '').slice(0, 10);
    const aiNote = doc.ai_disclosure || NOTES[edition] || NOTES.en;
    const aiModels = (doc.ai_models || []).join(' · ');

    const tocItems = cities.map((c, i) => {
        const cName = escHtml(c.city || '');
        return `<li><a href="#sec-${i + 1}">${cName}</a></li>`;
    }).join('\n');

    const sections = cities.map((c, ci) => {
        const items = (c.items || []).map(it => {
            const ai = it.human_rewritten === true ? 'REWRITTEN' : 'AI DRAFT';
            const head = escHtml(it.headline || '');
            const lede = escHtml(it.lede || '');
            const body = escHtml(it.body || '');
            const quote = it.quote
                ? `<blockquote>&ldquo;${escHtml(it.quote)}&rdquo;${it.quote_source ? ' — ' + escHtml(it.quote_source) : ''}</blockquote>`
                : '';
            const src = it.source_url
                ? `<p class="src"><a href="${escHtml(it.source_url)}">${escHtml(it.source || '')}${it.source_date ? ' · ' + escHtml(it.source_date) : ''}</a></p>`
                : `<p class="src">${escHtml(it.source || '')}${it.source_date ? ' · ' + escHtml(it.source_date) : ''}</p>`;
            return `
            <article class="item">
                <p><span class="num">${escHtml(it.n || '')}</span><span class="ai-tag">${ai}</span></p>
                <h3>${head}</h3>
                <p class="lede">${lede}</p>
                ${body ? `<p class="body">${body}</p>` : ''}
                ${quote}
                ${src}
            </article>`;
        }).join('\n');
        return `
        <section class="section" id="sec-${ci + 1}">
            <p class="city">${escHtml(c.city || '')}${c.season ? ' · ' + escHtml(c.season) : ''}</p>
            <h2>${escHtml(TITLES[edition] || TITLES.en)}</h2>
            ${items}
        </section>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="${edition}">
<head>
<meta charset="utf-8" />
<title>${escHtml(TITLES[edition] || TITLES.en)} · ${escHtml(filed)}</title>
<meta name="generator" content="saudade build-issue.js" />
<meta name="ai-assisted" content="${doc.ai_assisted ? 'true' : 'false'}" />
<style>${STYLE}</style>
</head>
<body>
    <header class="cover">
        <h1>${escHtml(TITLES[edition] || TITLES.en).replace(' — ', '<br/>')}</h1>
        <p class="sub">${escHtml(SUBS[edition] || SUBS.en)}</p>
        <p class="meta">FILED ${escHtml(filed)} · NEXT ${escHtml(next || '—')} · EDITION ${escHtml(edition.toUpperCase())}</p>
    </header>
    <nav class="toc">
        <h2>Contents</h2>
        <ol>${tocItems}</ol>
    </nav>
    ${sections}
    <footer class="colophon">
        <p>${escHtml(aiNote)}</p>
        ${aiModels ? `<p>Models: ${escHtml(aiModels)}</p>` : ''}
        <p>© saudade · CONTENT-LICENSE.md</p>
    </footer>
</body>
</html>
`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.out, { recursive: true });
    const built = [];
    for (const ed of args.editions) {
        const doc = tryLoad(ed);
        if (!doc) { console.error(`[skip] no data for edition: ${ed}`); continue; }
        const html = buildHtml(ed, doc);
        const filed = (doc.filed_at || '').slice(0, 10) || 'undated';
        const out = path.join(args.out, `saudade-${ed}-${filed}.html`);
        fs.writeFileSync(out, html, 'utf8');
        built.push(out);
        console.log(`[ok]   ${ed.toUpperCase()} → ${path.relative(ROOT, out)}`);
    }
    if (!built.length) { process.exitCode = 2; return; }
    console.log(`\nBuilt ${built.length} issue(s) into ${path.relative(ROOT, args.out)}/`);
    console.log(`Print to PDF: open the .html, Cmd/Ctrl+P → Save as PDF, A4 portrait.`);
}

if (require.main === module) main();
