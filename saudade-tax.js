// saudade · tax-residency day counter
//
// Counts presence days per country per tax-year window. The 183-day rule is
// the universal anchor — if you spend more than 183 days of a country's tax
// year inside that country, you almost certainly become a tax resident.
//
// What this is: a calendar of presence, summed by country. We do NOT
// claim tax residency conclusions — different jurisdictions have different
// extras (UK Statutory Residence Test ties, USA substantial-presence weighting,
// Spain centre-of-life, Korea calendar-year vs Portugal calendar-year+).
// Surface the data; let the user think.
//
// API:
//   window.SAUDADE_TAX.calc({ stays, year?, ref? })
//     stays = [{ country, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD' }]
//     year  = 'YYYY' (default: year of ref). Country tax-years that don't
//             align with calendar — UK 6 Apr→5 Apr, India Apr 1→Mar 31, etc. —
//             are TODO; v1 uses Jan 1 → Dec 31 with a country-specific override
//             table for the major exceptions.
//   →  {
//        year, ref,
//        per_country: [{ country, days_in_year, days_total, last_seen, near_threshold, over_threshold }]
//      }
//
//   window.SAUDADE_TAX.render(container, { stays, lang, year? })
//
// Caveat displayed inline: "We are not your accountant."
'use strict';

(function() {
    if (window.SAUDADE_TAX) return;

    const THRESHOLD = 183;
    const NEAR      = 150;       // amber warning when close
    const MS_DAY    = 86400000;

    // Country tax years where the rule is not Jan 1 → Dec 31.
    // Key = ISO-3166 alpha-2, value = [startMonth, startDay] (1-indexed).
    const TAX_YEAR_START = {
        GB: [4, 6],     // United Kingdom: 6 April
        IN: [4, 1],     // India:           1 April
        AU: [7, 1],     // Australia:       1 July
        NZ: [4, 1],     // New Zealand:     1 April
        ZA: [3, 1],     // South Africa:    1 March
        // All others fall back to Jan 1.
    };

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function toUTC(s) {
        if (!s) return null;
        if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function fmt(d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function addDays(d, n) { return new Date(d.getTime() + n * MS_DAY); }
    function clamp(d, min, max) {
        if (d < min) return new Date(min);
        if (d > max) return new Date(max);
        return new Date(d);
    }

    function taxYearWindow(country, year) {
        const cfg = TAX_YEAR_START[country];
        if (!cfg) {
            return [
                new Date(Date.UTC(year, 0, 1)),
                new Date(Date.UTC(year, 11, 31))
            ];
        }
        const [m, d] = cfg;
        const start = new Date(Date.UTC(year, m - 1, d));
        const end   = new Date(start.getTime() + 365 * MS_DAY - MS_DAY);
        return [start, end];
    }

    function calc(opts) {
        opts = opts || {};
        const stays = Array.isArray(opts.stays) ? opts.stays : [];
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const year = opts.year ? +opts.year : ref.getUTCFullYear();

        // Group stays by country.
        const byCountry = {};
        for (const s of stays) {
            const country = (s.country || '').toUpperCase().slice(0, 3);
            if (!country) continue;
            const a = toUTC(s.in);
            if (!a) continue;
            const b = toUTC(s.out) || ref;
            if (b < a) continue;
            (byCountry[country] = byCountry[country] || []).push([a, b]);
        }

        const per_country = Object.keys(byCountry).sort().map(country => {
            const ranges = byCountry[country];
            const [winStart, winEnd] = taxYearWindow(country, year);
            // Days inside the tax-year window for this country.
            // Both endpoints inclusive — same convention as Schengen.
            const setYear = new Set();
            const setTotal = new Set();
            let lastSeen = null;
            for (const [a, b] of ranges) {
                for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                    const k = fmt(d);
                    setTotal.add(k);
                    if (d >= winStart && d <= winEnd) setYear.add(k);
                    if (!lastSeen || d > lastSeen) lastSeen = new Date(d);
                }
            }
            const days_in_year = setYear.size;
            const days_total   = setTotal.size;
            return {
                country,
                tax_year_start: fmt(winStart),
                tax_year_end:   fmt(winEnd),
                days_in_year,
                days_total,
                last_seen: lastSeen ? fmt(lastSeen) : null,
                near_threshold: days_in_year >= NEAR && days_in_year < THRESHOLD,
                over_threshold: days_in_year >= THRESHOLD
            };
        });

        return { year, ref: fmt(ref), per_country, threshold: THRESHOLD };
    }

    function copy(lang) {
        return {
            title:   L({ en: 'Tax-residency days.', ko: '세금 거주일.', ja: '税居住日。', pt: 'Dias de residência fiscal.', es: 'Días de residencia fiscal.' }, lang),
            year:    L({ en: 'TAX YEAR', ko: '과세년도', ja: '税年度', pt: 'ANO FISCAL', es: 'AÑO FISCAL' }, lang),
            country: L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            days:    L({ en: 'DAYS IN YEAR', ko: '연내 일수', ja: '年内日数', pt: 'DIAS NO ANO', es: 'DÍAS EN EL AÑO' }, lang),
            window:  L({ en: 'WINDOW', ko: '윈도우', ja: 'ウィンドウ', pt: 'JANELA', es: 'VENTANA' }, lang),
            none:    L({ en: 'No tax-residency entries yet.', ko: '아직 입력된 세금 거주일 기록이 없다.', ja: 'まだ税居住日の記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang),
            note:    L({
                en: 'A calendar, not advice. Different countries weight ties beyond presence days. Consult a tax adviser before filing.',
                ko: '계산기가 아니라 달력. 국가마다 거주성 판단에 거주일 외의 연결고리도 본다. 신고 전에 세무사 상담 필수.',
                ja: '計算機ではなく暦。国によっては居住日数以外の紐帯も考慮する。申告前に税理士へ。',
                pt: 'Um calendário, não um conselho. Cada país pondera laços para além dos dias. Consulte um contabilista antes de declarar.',
                es: 'Un calendario, no un consejo. Cada país pondera vínculos más allá de los días. Consulte a un asesor antes de declarar.'
            }, lang),
            over:    L({ en: 'OVER 183', ko: '183 초과', ja: '183超過', pt: 'ACIMA DE 183', es: 'POR ENCIMA DE 183' }, lang),
            near:    L({ en: 'NEAR 183', ko: '183에 근접', ja: '183に接近', pt: 'PERTO DE 183', es: 'CERCA DE 183' }, lang)
        };
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function render(root, opts) {
        if (!root) return;
        const stays = (opts && opts.stays) || [];
        const lang  = opts && opts.lang;
        const c = copy(lang);
        if (!stays.length) {
            root.innerHTML = `<p class="sdd-tax-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = calc({ stays, year: opts && opts.year, ref: opts && opts.ref });
        const rows = r.per_country.map(p => {
            const cls = p.over_threshold ? 'is-over' : p.near_threshold ? 'is-near' : '';
            const tag = p.over_threshold ? c.over : p.near_threshold ? c.near : '';
            return `
                <tr class="sdd-tax-row ${escapeHtml(cls)}">
                    <td class="sdd-tax-c">${escapeHtml(p.country)}</td>
                    <td class="sdd-tax-d">${p.days_in_year}<span class="of"> / ${r.threshold}</span></td>
                    <td class="sdd-tax-w">${escapeHtml(p.tax_year_start)} → ${escapeHtml(p.tax_year_end)}</td>
                    <td class="sdd-tax-t">${tag ? escapeHtml(tag) : ''}</td>
                </tr>
            `;
        }).join('');
        root.innerHTML = `
            <section class="sdd-tax-panel">
                <h3 class="sdd-tax-h">${escapeHtml(c.title)}</h3>
                <table class="sdd-tax-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(c.country)}</th>
                            <th>${escapeHtml(c.days)}</th>
                            <th>${escapeHtml(c.window)}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="sdd-tax-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddTaxStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddTaxStyles';
        s.textContent = `
.sdd-tax-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-tax-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-tax-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 12px;
}
.sdd-tax-table th {
    font-family: var(--mono); font-weight: 500;
    font-size: 9px; letter-spacing: 0.32em;
    text-transform: uppercase;
    text-align: left;
    color: var(--bone-d);
    padding: 8px 12px 8px 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-tax-table td {
    padding: 12px 12px 12px 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink); vertical-align: baseline;
}
.sdd-tax-c {
    font-weight: 500; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink);
}
.sdd-tax-d {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 24px; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums;
}
.sdd-tax-d .of { font-size: 0.45em; color: var(--bone-d); font-style: normal; letter-spacing: 0.06em; margin-left: 4px; }
.sdd-tax-row.is-near .sdd-tax-d { color: var(--signal); }
.sdd-tax-row.is-over .sdd-tax-d { color: var(--rust); }
.sdd-tax-w { color: var(--bone-d); font-size: 11px; }
.sdd-tax-t {
    font-family: var(--mono); font-weight: 500; font-size: 9px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust);
    text-align: right; white-space: nowrap;
}
.sdd-tax-row.is-near .sdd-tax-t { color: var(--signal); }
.sdd-tax-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; line-height: 1.55;
    color: var(--bone-d); margin: 16px 0 0;
}
.sdd-tax-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}
@media (max-width: 540px) {
    .sdd-tax-table { font-size: 11px; }
    .sdd-tax-w { display: none; }
    .sdd-tax-table th:nth-child(3) { display: none; }
    .sdd-tax-table td:nth-child(3) { display: none; }
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_TAX = { calc, render, THRESHOLD };
})();
