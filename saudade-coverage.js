// saudade · coverage gaps — health insurance & pension filings
//
// Two related calendars:
//   1. Health insurance — given a list of policy windows, find days the
//      traveller had NO valid policy. SafetyWing / IMG / national schemes
//      go in here; gap days are flagged so the user sees uninsured travel.
//   2. Pension contribution windows — same shape, surfaced as "months
//      contributed" rather than "days uninsured" because pension entitlement
//      typically vests on whole-month thresholds (KR NPS 10y/120mo,
//      UK NIC qualifying weeks, etc.).
//
// Same shape as saudade-schengen.js / saudade-tax.js — pure calc + render
// + paper-flavoured panel. Editor-voice caveat about not being an adviser.
//
// API:
//   window.SAUDADE_COVERAGE.insurance({ policies, ref?, year? })
//     policies = [{ provider, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD', country?: 'PT' }]
//     →  {
//          year, ref,
//          covered_days, gap_days, longest_gap_days,
//          gaps: [{ from, to, days }]   // each contiguous uninsured stretch
//        }
//
//   window.SAUDADE_COVERAGE.pension({ filings, ref? })
//     filings = [{ scheme, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD', country?: 'KR' }]
//     →  {
//          ref,
//          per_scheme: [{ scheme, country, months_contributed, last_filed,
//                          to_120_months, to_240_months }]
//        }
//
//   window.SAUDADE_COVERAGE.renderInsurance(container, { policies, lang })
//   window.SAUDADE_COVERAGE.renderPension(container, { filings, lang })
'use strict';

(function() {
    if (window.SAUDADE_COVERAGE) return;

    const MS_DAY  = 86400000;
    const NPS_MIN = 120;     // KR NPS minimum qualifying months for retirement (10 years)

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
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY) + 1; }

    // ─── Health insurance ───────────────────────────────────────────────
    function insurance(opts) {
        opts = opts || {};
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const year = opts.year ? +opts.year : ref.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd   = new Date(Date.UTC(year, 11, 31));
        // Reference cap for "to date" in the running year:
        const cap = ref < yearEnd ? ref : yearEnd;

        const policies = (opts.policies || [])
            .map(p => ({ ...p, _a: toUTC(p.in), _b: toUTC(p.out) || ref }))
            .filter(p => p._a && p._b >= p._a)
            .sort((a, b) => a._a - b._a);

        // Mark every day in year as covered/uncovered.
        const covered = new Set();
        for (const p of policies) {
            const a = p._a < yearStart ? yearStart : p._a;
            const b = p._b > cap       ? cap      : p._b;
            if (b < a) continue;
            for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                covered.add(fmt(d));
            }
        }

        // Compute gaps by walking yearStart → cap.
        let coveredDays = 0;
        let gapDays = 0;
        let longestGap = 0;
        const gaps = [];
        let gapStart = null;
        let curGap = 0;

        for (let d = new Date(yearStart); d <= cap; d = addDays(d, 1)) {
            if (covered.has(fmt(d))) {
                coveredDays++;
                if (gapStart) {
                    const to = addDays(d, -1);
                    gaps.push({ from: fmt(gapStart), to: fmt(to), days: curGap });
                    if (curGap > longestGap) longestGap = curGap;
                    gapStart = null;
                    curGap = 0;
                }
            } else {
                gapDays++;
                if (!gapStart) { gapStart = new Date(d); curGap = 0; }
                curGap++;
            }
        }
        if (gapStart) {
            gaps.push({ from: fmt(gapStart), to: fmt(cap), days: curGap });
            if (curGap > longestGap) longestGap = curGap;
        }

        return {
            year, ref: fmt(ref),
            covered_days: coveredDays,
            gap_days: gapDays,
            longest_gap_days: longestGap,
            gaps
        };
    }

    // ─── Pension ────────────────────────────────────────────────────────
    function pension(opts) {
        opts = opts || {};
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();

        // Group by scheme key (e.g. "KR-NPS", "UK-NIC", "PT-SocSeg").
        const byScheme = {};
        for (const f of (opts.filings || [])) {
            const a = toUTC(f.in);
            if (!a) continue;
            const b = toUTC(f.out) || ref;
            if (b < a) continue;
            const key = (f.scheme || `${f.country || '??'}-?`).toString().toUpperCase();
            (byScheme[key] = byScheme[key] || []).push({ a, b, country: f.country || null });
        }

        const per_scheme = Object.entries(byScheme).map(([scheme, ranges]) => {
            // Count whole calendar months in which the user contributed at any
            // point — that's the typical pension counting model.
            const months = new Set();
            let lastFiled = null;
            let country = null;
            for (const r of ranges) {
                country = country || r.country;
                let cur = new Date(Date.UTC(r.a.getUTCFullYear(), r.a.getUTCMonth(), 1));
                while (cur <= r.b) {
                    months.add(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`);
                    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
                }
                if (!lastFiled || r.b > lastFiled) lastFiled = r.b;
            }
            const m = months.size;
            return {
                scheme, country,
                months_contributed: m,
                last_filed: lastFiled ? fmt(lastFiled) : null,
                to_120_months: Math.max(0, 120 - m),
                to_240_months: Math.max(0, 240 - m)
            };
        });

        return { ref: fmt(ref), per_scheme };
    }

    // ─── Render ─────────────────────────────────────────────────────────
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function copyInsurance(lang) {
        return {
            title:    L({ en: 'Insurance, in days.', ko: '보험, 일수로.', ja: '保険、日数で。', pt: 'Seguro, em dias.', es: 'Seguro, en días.' }, lang),
            covered:  L({ en: 'COVERED',   ko: '가입',   ja: '加入',   pt: 'COBERTO',  es: 'CUBIERTO' }, lang),
            gap:      L({ en: 'UNINSURED', ko: '공백',   ja: '未加入', pt: 'SEM COB.', es: 'SIN COB.' }, lang),
            longest:  L({ en: 'LONGEST GAP', ko: '최장 공백', ja: '最長空白', pt: 'MAIOR LACUNA', es: 'MAYOR HUECO' }, lang),
            gapsHead: L({ en: 'GAPS THIS YEAR', ko: '올해 공백 구간', ja: '今年の空白', pt: 'LACUNAS NO ANO', es: 'HUECOS DEL AÑO' }, lang),
            note:     L({
                en: 'A calendar, not advice. Some countries require continuous coverage as a condition of residency. We are not your broker.',
                ko: '계산기가 아니라 달력. 일부 국가는 거주 조건으로 연속 가입을 요구한다. 보험설계사가 아니다.',
                ja: '計算機ではなく暦。継続加入を居住条件とする国もある。保険代理人ではない。',
                pt: 'Um calendário, não um conselho. Alguns países exigem cobertura contínua para residência. Não somos o seu corretor.',
                es: 'Un calendario, no un consejo. Algunos países exigen cobertura continua. No somos su corredor.'
            }, lang),
            none:     L({ en: 'No policies recorded yet.', ko: '아직 입력된 보험이 없다.', ja: 'まだ保険記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang)
        };
    }

    function copyPension(lang) {
        return {
            title:    L({ en: 'Pension, in months.', ko: '연금, 개월수로.', ja: '年金、月数で。', pt: 'Pensão, em meses.', es: 'Pensión, en meses.' }, lang),
            scheme:   L({ en: 'SCHEME',    ko: '제도',     ja: '制度',     pt: 'SISTEMA',  es: 'SISTEMA' }, lang),
            months:   L({ en: 'MONTHS PAID', ko: '납입 개월', ja: '納付月数', pt: 'MESES PAGOS', es: 'MESES PAGADOS' }, lang),
            to120:    L({ en: 'TO 120',    ko: '120까지',  ja: '120まで',  pt: 'ATÉ 120',  es: 'A 120' }, lang),
            last:     L({ en: 'LAST FILED', ko: '최근 신고', ja: '直近申告', pt: 'ÚLTIMO REG.', es: 'ÚLTIMO REG.' }, lang),
            note:     L({
                en: 'Pension entitlement vests on different thresholds in every system. KR NPS minimum is 120 months. We are not your accountant.',
                ko: '제도마다 수급 기준이 다르다. 한국 국민연금 최저 120개월. 회계사가 아니다.',
                ja: '受給要件は制度ごとに異なる。韓国NPSの最低は120か月。会計士ではない。',
                pt: 'Os direitos vencem em limiares diferentes em cada sistema. KR NPS = 120 meses. Não somos o seu contabilista.',
                es: 'Los derechos consolidan a umbrales distintos en cada sistema. KR NPS = 120 meses. No somos su contador.'
            }, lang),
            none:     L({ en: 'No pension filings yet.', ko: '아직 입력된 연금 신고가 없다.', ja: 'まだ年金記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang)
        };
    }

    function renderInsurance(root, opts) {
        if (!root) return;
        const policies = (opts && opts.policies) || [];
        const c = copyInsurance(opts && opts.lang);
        if (!policies.length) {
            root.innerHTML = `<p class="sdd-cov-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = insurance({ policies, ref: opts && opts.ref, year: opts && opts.year });
        const danger = r.gap_days > 0;
        const gapsHtml = r.gaps.length ? `
            <div class="sdd-cov-gaps">
                <p class="sdd-cov-sub">${escapeHtml(c.gapsHead)}</p>
                <ul>
                    ${r.gaps.map(g => `
                        <li>
                            <time>${escapeHtml(g.from)} → ${escapeHtml(g.to)}</time>
                            <span class="d">${g.days} d</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        root.innerHTML = `
            <section class="sdd-cov-panel ${danger ? 'is-danger' : ''}">
                <h3 class="sdd-cov-h">${escapeHtml(c.title)}</h3>
                <div class="sdd-cov-grid">
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.covered)}</p>
                        <p class="sdd-cov-num">${r.covered_days}</p>
                    </div>
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.gap)}</p>
                        <p class="sdd-cov-num is-danger">${r.gap_days}</p>
                    </div>
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.longest)}</p>
                        <p class="sdd-cov-num">${r.longest_gap_days}</p>
                    </div>
                </div>
                ${gapsHtml}
                <p class="sdd-cov-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function renderPension(root, opts) {
        if (!root) return;
        const filings = (opts && opts.filings) || [];
        const c = copyPension(opts && opts.lang);
        if (!filings.length) {
            root.innerHTML = `<p class="sdd-cov-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = pension({ filings, ref: opts && opts.ref });
        const rows = r.per_scheme.map(p => {
            const cls = p.months_contributed >= NPS_MIN ? 'is-vested' : (p.months_contributed >= NPS_MIN * 0.75 ? 'is-near' : '');
            return `
                <tr class="sdd-pen-row ${escapeHtml(cls)}">
                    <td class="sdd-pen-s">${escapeHtml(p.scheme)}</td>
                    <td class="sdd-pen-m">${p.months_contributed}<span class="of"> / 120</span></td>
                    <td class="sdd-pen-t">${p.to_120_months > 0 ? p.to_120_months : '✓'}</td>
                    <td class="sdd-pen-l">${escapeHtml(p.last_filed || '—')}</td>
                </tr>
            `;
        }).join('');

        root.innerHTML = `
            <section class="sdd-cov-panel">
                <h3 class="sdd-cov-h">${escapeHtml(c.title)}</h3>
                <table class="sdd-pen-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(c.scheme)}</th>
                            <th>${escapeHtml(c.months)}</th>
                            <th>${escapeHtml(c.to120)}</th>
                            <th>${escapeHtml(c.last)}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="sdd-cov-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddCovStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCovStyles';
        s.textContent = `
.sdd-cov-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-cov-panel.is-danger {
    background: linear-gradient(transparent 60%, rgba(178,53,40,.06));
}
.sdd-cov-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-cov-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: clamp(16px, 4vw, 48px); align-items: end;
}
.sdd-cov-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-cov-num {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(40px, 7vw, 84px); line-height: 1;
    color: var(--ink); margin: 0;
    font-variant-numeric: tabular-nums;
}
.sdd-cov-num.is-danger { color: var(--rust); }
.sdd-cov-sub {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 18px 0 8px;
    padding-top: 12px; border-top: 0.5px solid var(--rule);
}
.sdd-cov-gaps ul { list-style: none; margin: 0; padding: 0; }
.sdd-cov-gaps li {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 0; border-bottom: 0.5px dotted var(--rule);
    font-family: var(--mono); font-size: 12px;
    letter-spacing: 0.06em;
}
.sdd-cov-gaps time { color: var(--ink); }
.sdd-cov-gaps .d { color: var(--rust); font-weight: 500; }
.sdd-cov-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; line-height: 1.55;
    color: var(--bone-d); margin: 16px 0 0;
}
.sdd-cov-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}

/* Pension table */
.sdd-pen-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 12px;
}
.sdd-pen-table th {
    font-family: var(--mono); font-weight: 500; font-size: 9px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); text-align: left;
    padding: 8px 12px 8px 0; border-bottom: 0.5px solid var(--rule);
}
.sdd-pen-table td {
    padding: 12px 12px 12px 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); vertical-align: baseline;
}
.sdd-pen-s { font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
.sdd-pen-m {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 22px; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums;
}
.sdd-pen-m .of { font-size: 0.45em; color: var(--bone-d); font-style: normal; letter-spacing: 0.06em; margin-left: 4px; }
.sdd-pen-row.is-vested .sdd-pen-m { color: var(--jade); }
.sdd-pen-row.is-near .sdd-pen-m { color: var(--signal); }
.sdd-pen-t { color: var(--rust); font-weight: 500; }
.sdd-pen-row.is-vested .sdd-pen-t { color: var(--jade); }
.sdd-pen-l { color: var(--bone-d); font-size: 11px; }

@media (max-width: 540px) {
    .sdd-cov-grid { grid-template-columns: 1fr; gap: 18px; }
    .sdd-pen-table { font-size: 11px; }
    .sdd-pen-l { display: none; }
    .sdd-pen-table th:nth-child(4), .sdd-pen-table td:nth-child(4) { display: none; }
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_COVERAGE = { insurance, pension, renderInsurance, renderPension };
})();
