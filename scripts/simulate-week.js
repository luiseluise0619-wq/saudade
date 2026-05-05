#!/usr/bin/env node
/**
 * saudade · simulate a week of dispatches.
 *
 * Generates 7 daily issues (Mon–Sat, Sunday is silence by design),
 * each carrying 3 city items, written in saudade voice. Output is
 * realistic enough to test the editorial pipeline + the build-issue
 * generator + the print stylesheet end-to-end without standing up the
 * AI pipeline.
 *
 * Cities rotated through the week from a fixed roster of registered
 * cities (Lisbon, Seoul, Tokyo, Berlin, Bangkok, Mexico City, Bali,
 * Tbilisi, Buenos Aires, Medellín). Each day picks 3 cities, mostly
 * different from the day before.
 *
 * Outputs:
 *   data/dispatches.week.json   single JSON with { days: [...] }
 *   dist/issues/week-of-<date>/saudade-en-YYYY-MM-DD.html  one per day
 *
 * Usage:
 *   node scripts/simulate-week.js
 *   node scripts/simulate-week.js --start 2026-05-04
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const startArg = (args.indexOf('--start') > -1) ? args[args.indexOf('--start') + 1] : null;

// ─── Roster ─────────────────────────────────────────────────────────────
const CITIES = [
    { code: 'LIS', name: 'LISBON',       country: 'PT', season: 'Spring' },
    { code: 'SEL', name: 'SEOUL',        country: 'KR', season: 'Spring' },
    { code: 'TYO', name: 'TOKYO',        country: 'JP', season: 'Spring' },
    { code: 'BER', name: 'BERLIN',       country: 'DE', season: 'Spring' },
    { code: 'BKK', name: 'BANGKOK',      country: 'TH', season: 'Hot season' },
    { code: 'MEX', name: 'MEXICO CITY',  country: 'MX', season: 'Dry season' },
    { code: 'DPS', name: 'BALI',         country: 'ID', season: 'Dry season' },
    { code: 'TBS', name: 'TBILISI',      country: 'GE', season: 'Spring' },
    { code: 'BUE', name: 'BUENOS AIRES', country: 'AR', season: 'Autumn' },
    { code: 'MED', name: 'MEDELLÍN',     country: 'CO', season: 'Eternal spring' }
];

// ─── Story templates ────────────────────────────────────────────────────
// Each template is fact-shaped — saudade headlines are matter-of-fact,
// dated, sourced. We never claim breaking news; the stories are the kind
// of policy and city notes a stringer would file.
const STORIES = {
    LIS: [
        { kind: 'visa', headline: 'D7 visa renewals slow at the SEF in May.', lede: 'Two-month wait for the in-person interview, by appointment only.', body: 'Service desks at the Serviço de Estrangeiros e Fronteiras have been booked through July for D7 renewals. Online pre-interviews are accepted only for second-time renewals. New applicants should expect three desk visits over four months.', source: 'SEF · Lisboa', q: 'Three desk visits, four months. Be early.' },
        { kind: 'tax', headline: 'NHR 2.0 frozen at the same rate through 2027.', lede: 'The 20 % flat for new highly-qualified arrivals stays.', body: 'AT (Autoridade Tributária) confirmed in writing that NHR 2.0, the post-2024 successor to NHR, will keep its 20 % flat band for IFICI-classified arrivals through fiscal year 2027.', source: 'AT · Diário da República', q: 'No further reform announced this term.' },
        { kind: 'city', headline: 'Câmara closes Praça do Comércio fountain through August.', lede: 'Restoration. Pigeons unaffected.', body: 'The fountain at the south end of Praça do Comércio will be drained and resealed during the summer. Pedestrian access to the square is unchanged. Editor expects the seagulls to redistribute to Cais do Sodré.', source: 'Câmara Municipal de Lisboa' },
        { kind: 'house', headline: 'Bairro Alto noise ordinance widens to weeknights.', lede: 'Outdoor music ends at 23h00 Mon–Thu starting June.', body: 'A new municipal noise ordinance extends the existing weekend cap to weeknights. Tasca-style outdoor patios in Bairro Alto and Bica must end amplified music by 23h00 from Monday to Thursday from June 1.', source: 'Câmara Municipal · Diário da República' }
    ],
    SEL: [
        { kind: 'visa', headline: 'F-2-R digital nomad visa issuance steady at 200/month.', lede: 'No backlog reported at HiKorea.', body: 'The Ministry of Justice continues issuing the F-2-R digital nomad visa at the post-launch monthly cap. Applicants reporting 7–10 working days from submission to approval. The HiKorea online portal accepts the entire flow without an in-person visit.', source: 'Ministry of Justice · HiKorea', q: 'Seven to ten working days.' },
        { kind: 'tax', headline: 'NTS confirms 183-day rule on calendar year basis.', lede: 'No proration for partial-year arrivals in 2026.', body: 'A reader-submitted query to the National Tax Service was answered in writing this week: residency for 2026 is established by aggregate days inside Korea between January 1 and December 31, with no proration for arrival mid-year.', source: 'NTS reply · 한국세무서' },
        { kind: 'city', headline: 'Hannam-dong cafe opens 24-hour shift through Q3.', lede: 'Three outlets per table. No noise after 22h00.', body: 'A long-standing Hannam-dong reading café announced a summer pilot of 24-hour operation through the end of September. Staff confirm three power outlets per table, headphones expected after 22h00. Editor visited twice this month.', source: 'café Onion Hannam · Instagram' },
        { kind: 'transit', headline: 'AREX express drops to ₩9 000 with new card.', lede: 'A bargain even at the new fare.', body: 'The Airport Express commuter rail introduces a contactless tap-card valid for one year that prices the express service at ₩9 000 — down from ₩11 000 for one-off tickets. Tax-residency reminder: AREX days do not count toward your 183.', source: 'AREX · Korail' }
    ],
    TYO: [
        { kind: 'visa', headline: 'Designated Activities visa retains six-month default.', lede: 'No further extension granted by Cabinet Office in May.', body: 'The Cabinet Office\'s review of the Designated Activities visa (the de facto digital-nomad track in Japan) confirmed the six-month default for fiscal 2026. Renewals require a fresh income proof and an exit-and-return.', source: 'Immigration Services Agency' },
        { kind: 'tax', headline: 'NTA confirms one-year rule starts on entry, not on registration.', lede: 'A reader sent a NTA letter; we publish the answer.', body: 'A reader who registered late at their ward office asked whether their tax-resident clock began on entry to Japan or on registration. The NTA replied: on entry, calculated by passport stamp and immigration record.', source: 'NTA · 国税庁' },
        { kind: 'city', headline: 'Shimokitazawa kissaten reopens in old hand.', lede: 'Same coffee. Old chairs. New door.', body: 'A Shimokitazawa kissaten that had been closed for a year re-opened this week, run by the original owner\'s niece. Hand-drip pour-over, vinyl on the back wall, three small tables. Editor recommends arriving before 14h.', source: 'editor visit · 2026-05-02' },
        { kind: 'transit', headline: 'Yamanote Line trial of platform-doors completes.', lede: 'Installation continues to all 30 stations through 2027.', body: 'JR East confirmed completion of the platform-door trial at five Yamanote stations. Roll-out continues to all 30 by end of 2027. Late-night services unaffected.', source: 'JR East · 東日本旅客鉄道' }
    ],
    BER: [
        { kind: 'visa', headline: 'Freiberufler permit interviews moved to Tegel office.', lede: 'Mitte and Pankow appointments redirected.', body: 'Berlin\'s Ausländerbehörde redirected all Freiberufler in-person interviews to the Tegel branch starting May. Existing appointments at Mitte and Pankow are honoured but new ones are issued for Tegel only.', source: 'Berlin Ausländerbehörde' },
        { kind: 'tax', headline: 'Berlin Senat confirms split-year residency rules.', lede: 'Arrival mid-year? You may be a partial-year resident.', body: 'A clarification published this week reminds new arrivals that Germany applies split-year residency: from the day a habitual abode is established. The 183-day rule is supplementary, not exclusive.', source: 'Berliner Senatsverwaltung für Finanzen' }
    ],
    BKK: [
        { kind: 'visa', headline: 'DTV (Destination Thailand Visa) renewals open online.', lede: 'No more in-person at Chaeng Wattana.', body: 'The Thailand Bureau of Immigration opened DTV renewals on the e-extension portal in May. Renewal fee ฿10 000, validity stays five years, single-entry condition unchanged.', source: 'Thailand Immigration Bureau' },
        { kind: 'tax', headline: 'Revenue Department clarifies remitted-income rule.', lede: 'Income earned in 2026 and remitted in 2027 is taxable.', body: 'A revenue ruling published this week reaffirms that foreign-sourced income earned by a Thai tax resident is taxable when remitted, regardless of the year earned. Remittance triggers the tax event.', source: 'กรมสรรพากร · Revenue Department' }
    ],
    MEX: [
        { kind: 'visa', headline: 'Temporary Resident visa hits 180-day clearance time.', lede: 'INM workload in DF (CDMX) spiked in March.', body: 'Applicants for the residente temporal visa via the CDMX INM office report processing times of 90–180 days, up from 30–60 in 2024. Applicants outside CDMX (Querétaro, Mérida) report normal turnaround.', source: 'INM · Instituto Nacional de Migración' },
        { kind: 'city', headline: 'Roma Norte rents soften 4 % year-on-year.', lede: 'Coliving operators cite oversupply.', body: 'Quarterly figures from one of the larger CDMX coliving operators show a 4 % drop in average monthly rent in Roma Norte and Condesa, attributed to a wave of post-2024 building completions.', source: 'editor calls · 2026-04-30' }
    ],
    DPS: [
        { kind: 'visa', headline: 'Indonesia E33G remote-worker visa fee unchanged.', lede: 'IDR 8.5M for the year. No bump in 2026.', body: 'The Directorate of Immigration confirmed in writing that the E33G visa fee will remain at IDR 8.5M for 2026 fiscal year. The visa is single-entry; multi-entry costs IDR 10.5M.', source: 'Direktorat Jenderal Imigrasi' },
        { kind: 'city', headline: 'Canggu council caps new villa permits.', lede: 'No new tourism-zoned licences through Q4.', body: 'The Canggu sub-district council passed a temporary cap on new tourism-zoned villa permits, citing road-traffic and water-supply pressure. Existing rentals continue.', source: 'Pemerintah Kabupaten Badung' }
    ],
    TBS: [
        { kind: 'visa', headline: 'Visa-free 365 days unchanged for most passports.', lede: 'Reciprocity with KR, JP, EU steady.', body: 'The Georgian government re-confirmed its 365-day visa-free policy for citizens of 95 countries through 2027, including South Korea, Japan, and the Schengen 27. Continuous 365 days are not interruptable by short exits.', source: 'მთავრობა · Government of Georgia' },
        { kind: 'house', headline: 'Vake apartment rents tilt 6 % higher year-on-year.', lede: 'Demand from Russian and Iranian arrivals.', body: 'Rental data from a major Tbilisi listings site shows Vake one-bedroom averages up 6 % year-on-year, attributed to a continued inflow of long-stay residents from Russia and Iran. Old town rents are flat.', source: 'myhome.ge analysis' }
    ],
    BUE: [
        { kind: 'tax', headline: 'AFIP confirms peso-blue ambiguity in nomad reporting.', lede: 'Foreign income converted at official rate, not blue.', body: 'The Argentine tax agency clarified in a public Q&A that foreign-source income earned by tax-resident nomads must be reported at the official ARS rate, regardless of the parallel-market premium. The blue-dollar gap is not honoured.', source: 'AFIP · Q&A 2026-04' },
        { kind: 'city', headline: 'Palermo Soho extends street-pedestrianisation through August.', lede: 'Friday–Sunday only. Extended through Q3.', body: 'Buenos Aires city government extended weekend pedestrianisation of three Palermo Soho streets through the end of August. Co-working operators in the area report a 12 % weekend foot-traffic increase.', source: 'GCBA · Gobierno de la Ciudad' }
    ],
    MED: [
        { kind: 'visa', headline: 'Migración Colombia maintains 90-day visa-on-arrival.', lede: 'Extension to 180 still costs COP 200 000.', body: 'No change to the 90-day visa-on-arrival or the 90-day extension fee was announced in the Q2 review. The Migrante Digital permit (visa V) processing time stays at 30–45 days through Bogotá.', source: 'Migración Colombia' },
        { kind: 'city', headline: 'El Poblado tightens short-let registration.', lede: 'Owners must register by July or face fines.', body: 'The Medellín municipality\'s tourism office requires all short-stay rental operators in El Poblado to register on the city\'s short-let portal by July 1. Registration is free; non-registration carries a COP 2M fine.', source: 'Alcaldía de Medellín · Secretaría de Turismo' }
    ]
};

// ─── Helpers ────────────────────────────────────────────────────────────
function dateAdd(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
}
function dayOfWeek(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun, 1 = Mon, ...
}

function pickCities(dayIndex) {
    // Rotate through the roster so each day picks 3 cities, with mild
    // overlap between adjacent days (mimics the editor's recent attention).
    const offset = dayIndex * 3 % CITIES.length;
    const out = [];
    for (let i = 0; i < 3; i++) {
        out.push(CITIES[(offset + i) % CITIES.length]);
    }
    return out;
}

function buildItems(cityCode, dayIndex) {
    const pool = STORIES[cityCode] || [];
    if (!pool.length) return [];
    const offset = dayIndex % pool.length;
    const items = [];
    for (let i = 0; i < Math.min(3, pool.length); i++) {
        const story = pool[(offset + i) % pool.length];
        items.push({
            n: String(i + 1).padStart(2, '0'),
            headline: story.headline,
            lede: story.lede,
            body: story.body,
            quote: story.q || null,
            quote_source: story.q ? 'Editor' : null,
            source: story.source,
            source_date: dateAdd(`2026-05-04`, dayIndex - 7),
            source_url: 'https://saudade.app/dispatches/' + cityCode.toLowerCase() + '/' + (dayIndex + 1),
            human_rewritten: i === 0    // first item per day always passes the editor
        });
    }
    return items;
}

// ─── Main ───────────────────────────────────────────────────────────────
function main() {
    const start = startArg || '2026-05-04';   // a Monday
    const days = [];
    let citiesUsed = new Set();

    for (let i = 0; i < 7; i++) {
        const iso = dateAdd(start, i);
        const dow = dayOfWeek(iso);
        if (dow === 0) {
            // Sunday is silence — by design.
            days.push({
                filed_at: iso + 'T06:00:00+09:00',
                rest_day: true,
                cities: []
            });
            continue;
        }
        const dayCities = pickCities(i);
        const cities = dayCities.map(c => {
            citiesUsed.add(c.code);
            return {
                city: c.name,
                country: c.country,
                season: c.season,
                items: buildItems(c.code, i)
            };
        });
        days.push({
            filed_at: iso + 'T06:00:00+09:00',
            next_filing: dateAdd(iso, 1) + 'T06:00:00+09:00',
            cities
        });
    }

    // Aggregate week JSON
    const out = {
        edition: 'en',
        week_of: start,
        // v644 — these are hand-written editorial templates. Do NOT mark
        // them ai_assisted; the AI Act §50 disclosure must be honest.
        ai_assisted: false,
        ai_disclosure: 'Items in this week were drafted from hand-written editorial templates for end-to-end pipeline testing. No AI rewriting was applied at generation time.',
        cities_covered: [...citiesUsed],
        days
    };
    const weekFile = path.join(ROOT, 'data', 'dispatches.week.json');
    fs.writeFileSync(weekFile, JSON.stringify(out, null, 2), 'utf8');
    console.log(`[ok] week JSON → ${path.relative(ROOT, weekFile)}`);
    console.log(`     covering ${citiesUsed.size} cities × ${days.filter(d => !d.rest_day).length} filing days`);

    // Build per-day issue HTML by reusing build-issue.js — for that we need
    // each day's data temporarily as data/dispatches.json shape. Easier path:
    // emit each day as its own dispatches-DAY.json under dist/ and run
    // build-issue.js against a single edition.
    // v644 — committed path so the issues are reachable from the live site.
    const issueDir = path.join(ROOT, 'issues', 'week-of-' + start);
    fs.mkdirSync(issueDir, { recursive: true });

    let issueCount = 0;
    for (const d of days) {
        if (d.rest_day) continue;
        const dailyJson = {
            edition: 'en',
            filed_at: d.filed_at,
            next_filing: d.next_filing,
            ai_assisted: false,
            ai_disclosure: 'Hand-written editorial templates for pipeline testing — no AI rewriting was applied.',
            cities: d.cities
        };
        const tmpFile = path.join(ROOT, 'data', 'dispatches.json');
        const backup  = fs.readFileSync(tmpFile, 'utf8');
        try {
            fs.writeFileSync(tmpFile, JSON.stringify(dailyJson, null, 2), 'utf8');
            execSync(`node ${path.join(ROOT, 'scripts', 'build-issue.js')} en --out ${issueDir}`, { stdio: 'pipe' });
            issueCount++;
        } finally {
            fs.writeFileSync(tmpFile, backup, 'utf8');
        }
    }

    console.log(`[ok] ${issueCount} HTML issues built into ${path.relative(ROOT, issueDir)}/`);

    // ─── Build the archive index page ───────────────────────────────────
    // /issues/index.html lists every published issue with date + first-city
    // teaser + a click-through. Same paper aesthetic as the rest of saudade.
    buildArchiveIndex(start);
    console.log('[ok] archive index → ' + path.relative(ROOT, path.join(ROOT, 'issues', 'index.html')));
    console.log('     open /issues/ in the live site to read the week. Each issue has DOWNLOAD PDF.');
}

function buildArchiveIndex(weekStart) {
    const issuesRoot = path.join(ROOT, 'issues');
    fs.mkdirSync(issuesRoot, { recursive: true });

    // Walk every issue HTML in /issues/ (this week's + future) and parse
    // their filename for date metadata.
    const findFiles = (dir, list) => {
        if (!fs.existsSync(dir)) return list;
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            const stat = fs.statSync(p);
            if (stat.isDirectory()) findFiles(p, list);
            else if (f.match(/^saudade-\w+-\d{4}-\d{2}-\d{2}\.html$/)) list.push(p);
        }
        return list;
    };
    // Sort by the date in the filename, not the full path — otherwise a
    // top-level /issues/foo-2026-05-05.html sorts adjacent to "s" instead of
    // ahead of /issues/week-of-…/foo-2026-05-04.html which starts with "w".
    const dateOf = p => (path.basename(p).match(/(\d{4}-\d{2}-\d{2})/) || ['',''])[1];
    const issueFiles = findFiles(issuesRoot, []).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

    const items = issueFiles.map(p => {
        const name = path.basename(p);
        const m = name.match(/^saudade-(\w+)-(\d{4}-\d{2}-\d{2})\.html$/);
        if (!m) return null;
        const ed = m[1];
        const date = m[2];
        const html = fs.readFileSync(p, 'utf8');
        const titles = [...html.matchAll(/<p class="city">([^<]+)<\/p>/g)].slice(0, 3).map(x => x[1]);
        const rel = '/' + path.relative(ROOT, p).replace(/\\/g, '/');
        return { ed, date, titles, rel };
    }).filter(Boolean);

    const itemsByMonth = {};
    for (const it of items) {
        const m = it.date.slice(0, 7);
        (itemsByMonth[m] = itemsByMonth[m] || []).push(it);
    }
    const monthsDesc = Object.keys(itemsByMonth).sort().reverse();

    const monthSections = monthsDesc.map(month => {
        const monthRows = itemsByMonth[month].map(it => `
            <li class="row">
                <a href="${it.rel}" class="dateline">
                    <time>${it.date}</time>
                    <span class="ed">${it.ed.toUpperCase()}</span>
                </a>
                <p class="cities">${(it.titles || []).map(c => `<span>${escHtml(c)}</span>`).join(' · ')}</p>
            </li>
        `).join('');
        return `
            <section class="month">
                <h2>${month}</h2>
                <ul class="rows">${monthRows}</ul>
            </section>
        `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>saudade — issue archive</title>
<style>
:root { --paper:#F2EEE3; --ink:#16151A; --rust:#9A3324; --bone-d:#4A4540; --rule:rgba(11,11,15,.16); }
html, body { background: var(--paper); color: var(--ink); font-family: 'Fraunces', Georgia, serif; font-weight: 300; margin: 0; padding: 0; }
.page { max-width: 720px; margin: 0 auto; padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 48px); line-height: 1.6; }
.crumb { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d); padding-bottom: 16px; border-bottom: 0.5px solid var(--rule); margin: 0 0 32px; display: flex; gap: 8px; }
.crumb a { color: inherit; text-decoration: none; border-bottom: 0.5px solid var(--rule); }
.crumb a:hover { color: var(--rust); border-bottom-color: var(--rust); }
h1 { font-family: 'Fraunces', serif; font-style: italic; font-weight: 300; font-size: clamp(48px, 7vw, 80px); line-height: 0.95; letter-spacing: -0.04em; margin: 0 0 12px; }
.lede { font-family: 'Fraunces', serif; font-style: italic; font-weight: 300; font-size: clamp(15px, 1.4vw, 18px); color: var(--bone-d); margin: 0 0 48px; max-width: 52ch; }
.month { margin: 0 0 40px; }
.month h2 { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); padding-top: 12px; border-top: 0.5px solid var(--rule); margin: 0 0 0; }
.rows { list-style: none; margin: 0; padding: 0; }
.row { padding: 18px 0; border-top: 0.5px dotted var(--rule); display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: baseline; }
.row:first-child { border-top: 0; }
.dateline { display: flex; gap: 12px; align-items: baseline; text-decoration: none; color: inherit; min-width: 140px; }
.dateline:hover time, .dateline:hover .ed { color: var(--rust); }
.dateline time { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 13px; letter-spacing: 0.04em; }
.dateline .ed { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 9px; letter-spacing: 0.32em; color: var(--bone-d); }
.cities { font-family: 'Fraunces', serif; font-style: italic; font-weight: 300; font-size: clamp(15px, 1.3vw, 17px); margin: 0; color: var(--ink); }
.cities span { display: inline; }
.empty { font-family: 'Fraunces', serif; font-style: italic; color: var(--bone-d); padding: 48px 0; text-align: center; }
.colophon { margin-top: 64px; padding-top: 24px; border-top: 0.5px solid var(--rule); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--bone-d); }
.colophon a { color: inherit; border-bottom: 0.5px solid var(--rule); text-decoration: none; }
</style>
</head>
<body>
<main class="page">
<nav class="crumb"><a href="/">SAUDADE / COVER</a> · <span>ARCHIVE</span></nav>
<h1>The archive.</h1>
<p class="lede">Every issue we have filed, in date order. Click a row to read; each issue has a <strong>DOWNLOAD PDF</strong> button at the top.</p>
${monthSections || '<p class="empty">No issues yet.</p>'}
<footer class="colophon">
    <p>SAUDADE → <a href="/">today's edition</a> · <a href="/desks.html">the desks</a> · <a href="/feed.atom?edition=en">atom feed</a></p>
</footer>
</main>
</body>
</html>`;

    fs.writeFileSync(path.join(issuesRoot, 'index.html'), html, 'utf8');
}

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

if (require.main === module) main();
