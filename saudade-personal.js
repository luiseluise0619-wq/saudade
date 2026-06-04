// saudade · personal moments
//
// The empathy layer. Reads the user's localStorage data (visa stays,
// insurance, pension, and a "home cities" list) and turns the numbers into
// short italic sentences in the saudade voice — the kind of line a
// thoughtful editor would write to a single reader, not a dashboard.
//
// Example output:
//   "184 days since you last sat in a Seoul café."
//   "Your Schengen window resets in 47 days."
//   "On this day, last year, you were in Lisbon."
//   "Insurance lapses in 12 days."
//
// API:
//   window.SAUDADE_PERSONAL.compute()  →  [{ kind, line, weight }]
//   window.SAUDADE_PERSONAL.render(target, { lang, max })
//   window.SAUDADE_PERSONAL.setHomes(['SEL', 'LIS'])  → up to 3
//   window.SAUDADE_PERSONAL.getHomes()
'use strict';

(function() {
    if (window.SAUDADE_PERSONAL) return;
    const KEY_HOMES = 'saudade.homes';

    const MS_DAY = 86400000;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function safeRead(k, fallback) {
        try { const r = localStorage.getItem(k); if (!r) return fallback; const a = JSON.parse(r); return Array.isArray(a) || (a && typeof a === 'object') ? a : fallback; }
        catch (e) { return fallback; }
    }
    function safeWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function toUTC(s) {
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function todayUTC() {
        const n = new Date();
        return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    }
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY); }

    // ─── Curated home-city dictionary ────────────────────────────────────
    // 3-letter IATA-ish keys. Names per edition. The point of this small
    // dictionary is so 'LIS' renders as "Lisbon" / "리스본" / "リスボン" etc.,
    // not as a raw code. Free to extend.
    const CITIES = {
        SEL: { en: 'Seoul',      ko: '서울',     ja: 'ソウル',    pt: 'Seul',       es: 'Seúl' },
        LIS: { en: 'Lisbon',     ko: '리스본',   ja: 'リスボン',  pt: 'Lisboa',     es: 'Lisboa' },
        OPO: { en: 'Porto',      ko: '포르투',   ja: 'ポルト',    pt: 'Porto',      es: 'Oporto' },
        TYO: { en: 'Tokyo',      ko: '도쿄',     ja: '東京',      pt: 'Tóquio',     es: 'Tokio' },
        BCN: { en: 'Barcelona',  ko: '바르셀로나', ja: 'バルセロナ', pt: 'Barcelona',  es: 'Barcelona' },
        MAD: { en: 'Madrid',     ko: '마드리드', ja: 'マドリード', pt: 'Madrid',     es: 'Madrid' },
        BER: { en: 'Berlin',     ko: '베를린',   ja: 'ベルリン',  pt: 'Berlim',     es: 'Berlín' },
        DPS: { en: 'Bali',       ko: '발리',     ja: 'バリ',      pt: 'Bali',       es: 'Bali' },
        BKK: { en: 'Bangkok',    ko: '방콕',     ja: 'バンコク',  pt: 'Banguecoque',es: 'Bangkok' },
        CNX: { en: 'Chiang Mai', ko: '치앙마이', ja: 'チェンマイ', pt: 'Chiang Mai', es: 'Chiang Mai' },
        MEX: { en: 'Mexico City',ko: '멕시코시티', ja: 'メキシコシティ', pt: 'Cidade do México', es: 'Ciudad de México' },
        DAD: { en: 'Da Nang',    ko: '다낭',     ja: 'ダナン',    pt: 'Da Nang',    es: 'Da Nang' },
        TBS: { en: 'Tbilisi',    ko: '트빌리시', ja: 'トビリシ',  pt: 'Tbilisi',    es: 'Tiflis' },
        MED: { en: 'Medellín',   ko: '메데인',   ja: 'メデジン',  pt: 'Medellín',   es: 'Medellín' },
        BUE: { en: 'Buenos Aires', ko: '부에노스아이레스', ja: 'ブエノスアイレス', pt: 'Buenos Aires', es: 'Buenos Aires' }
    };
    function cityName(code, ed) { const c = CITIES[code]; return (c && c[ed]) || (c && c.en) || code; }

    // Map ISO-2 country codes to a representative home city when the user
    // imports stays — best-guess only, the user can override via setHomes.
    const ISO_TO_HOME = {
        KR: 'SEL', PT: 'LIS', JP: 'TYO', ES: 'MAD', DE: 'BER',
        ID: 'DPS', TH: 'CNX', MX: 'MEX', VN: 'DAD', GE: 'TBS',
        CO: 'MED', AR: 'BUE'
    };

    // ─── Per-source readers ──────────────────────────────────────────────
    function readSchengen() { return safeRead('saudade.schengen.stays', []); }
    function readTax()      { return safeRead('saudade.tax.stays', []); }
    function readIns()      { return safeRead('saudade.insurance.policies', []); }
    function readPen()      { return safeRead('saudade.pension.filings', []); }

    function lastSeenInCountry(country) {
        // Most recent date the user was inside `country`, drawn from tax stays.
        const stays = readTax().filter(s => s.country === country);
        if (!stays.length) return null;
        let latest = null;
        for (const s of stays) {
            const b = toUTC(s.out) || todayUTC();
            if (!latest || b > latest) latest = b;
        }
        return latest;
    }

    function setHomes(arr) {
        const cleaned = (Array.isArray(arr) ? arr : []).filter(c => CITIES[c]).slice(0, 3);
        safeWrite(KEY_HOMES, cleaned);
        return cleaned;
    }
    function getHomes() {
        const stored = safeRead(KEY_HOMES, null);
        if (Array.isArray(stored) && stored.length) return stored;
        // Auto-derive from tax stays — most days = home.
        const stays = readTax();
        if (!stays.length) return [];
        const days = {};
        for (const s of stays) {
            const a = toUTC(s.in); const b = toUTC(s.out) || todayUTC();
            if (!a || b < a) continue;
            const n = diffDays(b, a) + 1;
            days[s.country] = (days[s.country] || 0) + n;
        }
        const sorted = Object.entries(days).sort(([,a],[,b]) => b - a).slice(0, 3);
        return sorted.map(([iso]) => ISO_TO_HOME[iso]).filter(Boolean);
    }

    // ─── Sentence generators ────────────────────────────────────────────
    function compute(opts) {
        opts = opts || {};
        const ed = opts.lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const today = todayUTC();
        const moments = [];

        // 0. Returning-reader moment — the one hook that needs no setup and
        // no content: it greets anyone who comes back. A slow magazine that
        // remembers you is the whole saudade ethos. Low weight so a real
        // visa/tax urgency always sits above it; present so the cover is
        // never cold. Reads the prior visit BEFORE stamping the new one.
        const KEY_LAST_VISIT = 'saudade.personal.last_visit';
        try {
            const prev = toUTC(localStorage.getItem(KEY_LAST_VISIT));
            if (prev) {
                const gap = diffDays(today, prev);
                if (gap >= 1) {
                    moments.push({
                        kind: 'return',
                        weight: 30,
                        line: L({
                            en: gap === 1 ? 'A day since you were last here.' : `${gap} days since you were last here.`,
                            ko: gap === 1 ? '여기 다녀간 지 하루.' : `여기 다녀간 지 ${gap}일.`,
                            ja: gap === 1 ? 'ここに来てから一日。' : `ここに来てから ${gap} 日。`,
                            pt: gap === 1 ? 'Um dia desde a sua última visita.' : `${gap} dias desde a sua última visita.`,
                            es: gap === 1 ? 'Un día desde su última visita.' : `${gap} días desde su última visita.`
                        }, ed)
                    });
                }
            }
            // Only stamp on the real cover render (opts.stampVisit), not the
            // demo/homes preview re-renders, so the gap reflects genuine visits.
            if (opts.stampVisit) {
                localStorage.setItem(KEY_LAST_VISIT, today.toISOString().slice(0, 10));
            }
        } catch (e) { /* private mode / disabled storage — skip silently */ }

        // 1. Saudade meter — days since last visit per home city.
        const homes = getHomes();
        for (const code of homes) {
            const iso = Object.entries(ISO_TO_HOME).find(([k, v]) => v === code);
            if (!iso) continue;
            const last = lastSeenInCountry(iso[0]);
            if (!last) continue;
            const days = diffDays(today, last);
            if (days <= 0) continue;
            const name = cityName(code, ed);
            moments.push({
                kind: 'saudade',
                weight: 80,
                line: L({
                    en: `${days} days since you last sat in a ${name} café.`,
                    ko: `마지막으로 ${name} 카페에 앉은 지 ${days}일.`,
                    ja: `最後に ${name} のカフェに座ってから ${days} 日。`,
                    pt: `${days} dias desde a última vez num café em ${name}.`,
                    es: `${days} días desde la última vez en un café de ${name}.`
                }, ed)
            });
        }

        // 2. Schengen window status (if any data).
        if (window.SAUDADE_SCHENGEN) {
            const stays = readSchengen();
            if (stays.length) {
                const r = window.SAUDADE_SCHENGEN.calc({ stays });
                if (r.used_in_window > 0) {
                    if (r.used_in_window >= 75) {
                        moments.push({
                            kind: 'schengen-warn',
                            weight: 95,
                            line: L({
                                en: `Schengen: ${r.used_in_window} of 90 used. ${r.remaining} left.`,
                                ko: `솅겐 ${r.used_in_window}/90 사용. 남은 ${r.remaining}일.`,
                                ja: `シェンゲン ${r.used_in_window}/90 使用。残り ${r.remaining} 日。`,
                                pt: `Schengen: ${r.used_in_window} de 90 usados. ${r.remaining} restantes.`,
                                es: `Schengen: ${r.used_in_window} de 90 usados. ${r.remaining} restantes.`
                            }, ed)
                        });
                    } else if (r.next_safe_entry_after && r.remaining < 30) {
                        moments.push({
                            kind: 'schengen-info',
                            weight: 60,
                            line: L({
                                en: `Your Schengen clock has ${r.remaining} days of room.`,
                                ko: `솅겐 시계에 ${r.remaining}일 여유.`,
                                ja: `シェンゲンの余裕は ${r.remaining} 日。`,
                                pt: `O seu relógio Schengen tem ${r.remaining} dias.`,
                                es: `Su reloj Schengen tiene ${r.remaining} días.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 3. Insurance gap proximity.
        if (window.SAUDADE_COVERAGE) {
            const policies = readIns();
            if (policies.length) {
                // Find the policy that ends soonest in the future.
                let nextEnd = null;
                let nextProvider = null;
                for (const p of policies) {
                    const end = toUTC(p.out);
                    if (!end || end < today) continue;
                    if (!nextEnd || end < nextEnd) { nextEnd = end; nextProvider = p.provider || ''; }
                }
                if (nextEnd) {
                    const days = diffDays(nextEnd, today);
                    if (days <= 30) {
                        moments.push({
                            kind: 'ins-warn',
                            weight: 90,
                            line: L({
                                en: `Insurance lapses in ${days} days.`,
                                ko: `보험 만료까지 ${days}일.`,
                                ja: `保険終了まで ${days} 日。`,
                                pt: `O seguro termina em ${days} dias.`,
                                es: `El seguro vence en ${days} días.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 4. Tax-residency near threshold.
        if (window.SAUDADE_TAX) {
            const stays = readTax();
            if (stays.length) {
                const r = window.SAUDADE_TAX.calc({ stays });
                for (const p of r.per_country) {
                    if (p.over_threshold) {
                        moments.push({
                            kind: 'tax-over',
                            weight: 92,
                            line: L({
                                en: `${p.days_in_year} days in ${p.country} this year — likely a tax resident.`,
                                ko: `올해 ${p.country} ${p.days_in_year}일 — 세금 거주자 가능성.`,
                                ja: `今年 ${p.country} ${p.days_in_year} 日 — 税居住の可能性。`,
                                pt: `${p.days_in_year} dias em ${p.country} este ano — provavelmente residente fiscal.`,
                                es: `${p.days_in_year} días en ${p.country} este año — probablemente residente fiscal.`
                            }, ed)
                        });
                    } else if (p.near_threshold) {
                        moments.push({
                            kind: 'tax-near',
                            weight: 70,
                            line: L({
                                en: `${p.days_in_year} of 183 in ${p.country}. Watch the calendar.`,
                                ko: `${p.country} 거주 ${p.days_in_year}/183. 달력을 주의.`,
                                ja: `${p.country} ${p.days_in_year}/183。暦に注意。`,
                                pt: `${p.days_in_year} de 183 em ${p.country}. Atenção ao calendário.`,
                                es: `${p.days_in_year} de 183 en ${p.country}. Atención al calendario.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 5. On-this-day — anniversary of any past stay.
        const taxStays = readTax();
        const todayMD = `-${String(today.getUTCMonth() + 1).padStart(2,'0')}-${String(today.getUTCDate()).padStart(2,'0')}`;
        for (const s of taxStays) {
            if (!s.in || !s.in.includes(todayMD)) continue;
            const a = toUTC(s.in);
            if (!a) continue;
            const years = today.getUTCFullYear() - a.getUTCFullYear();
            if (years < 1 || years > 25) continue;
            const homeCode = ISO_TO_HOME[s.country];
            if (!homeCode) continue;
            const cityNm = cityName(homeCode, ed);
            moments.push({
                kind: 'memory',
                weight: 50 + Math.min(years * 5, 30),
                line: L({
                    en: `On this day, ${years} year${years > 1 ? 's' : ''} ago, you arrived in ${cityNm}.`,
                    ko: `${years}년 전 오늘, ${cityNm}에 도착했다.`,
                    ja: `${years} 年前の今日、${cityNm} に着いた。`,
                    pt: `Neste dia, há ${years} ano${years > 1 ? 's' : ''}, chegou a ${cityNm}.`,
                    es: `Hoy hace ${years} año${years > 1 ? 's' : ''}, llegó a ${cityNm}.`
                }, ed)
            });
        }

        // Sort by weight descending — strongest first.
        moments.sort((a, b) => b.weight - a.weight);
        const max = (opts.max != null) ? opts.max : 4;
        return moments.slice(0, max);
    }

    function injectStyles() {
        if (document.getElementById('sddPersonalStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddPersonalStyles';
        s.textContent = `
.sdd-personal {
    margin: clamp(20px, 3vw, 32px) 0;
    padding: clamp(16px, 2.5vw, 24px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    position: relative;
}
.sdd-personal__eyebrow {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--rust);
    margin: 0 0 12px;
    display: flex; gap: 8px; align-items: baseline;
}
/* v644 — eyebrow alone is enough; the "— for you" suffix was self-narration. */
.sdd-personal__line {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(15px, 1.4vw, 19px);
    line-height: 1.5;
    color: var(--ink);
    margin: 8px 0;
    padding: 4px 0;
    text-wrap: balance;
}
.sdd-personal__line.is-warn  { color: var(--signal); }
.sdd-personal__line.is-alert { color: var(--rust); }
.sdd-personal__line.is-memory { color: var(--bone-d); }
.sdd-personal__cta {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--bone-d);
    margin: 14px 0 0; padding-top: 12px;
    border-top: 0.5px dotted var(--rule);
}
.sdd-personal__cta a {
    color: inherit; text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
    margin: 0 12px 0 0;
    transition: color .12s, border-color .12s;
}
.sdd-personal__cta a:hover { color: var(--rust); border-bottom-color: var(--rust); }

/* Empty-state empathy hook for fresh visitors with no data. */
.sdd-personal--empty .sdd-personal__line {
    color: var(--bone-d);
    font-size: clamp(14px, 1.3vw, 17px);
}
.sdd-personal--empty .sdd-personal__line strong {
    color: var(--rust); font-weight: 400; font-style: italic;
}
        `;
        document.head.appendChild(s);
    }

    function render(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        const ed = (opts && opts.lang) || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const moments = compute({ lang: ed, max: (opts && opts.max) || 4, stampVisit: !!(opts && opts.stampVisit) });
        // A visitor whose only moment is the returning-reader greeting still
        // has no real data — keep the setup CTAs visible alongside the line.
        const dataMoments = moments.filter(m => m.kind !== 'return');

        const eyebrowLabel = L({
            en: 'NOTES FOR ONE READER',
            ko: '한 사람을 위한 메모',
            ja: '一人の読者へ',
            pt: 'NOTAS PARA UM LEITOR',
            es: 'NOTAS PARA UN LECTOR'
        }, ed);

        if (!dataMoments.length) {
            // No real data yet. Show the setup hook — and, if they have been
            // here before, lead with the returning-reader greeting so even
            // the empty cover feels like it remembers them.
            const ret = moments.find(m => m.kind === 'return');
            const emptyLine = L({
                en: 'You have not told us where you are. <strong>Set a home city</strong>, or <strong>see how this looks populated</strong>.',
                ko: '아직 어디에 있는지 알려주지 않았다. <strong>홈 도시를 설정하거나</strong>, <strong>예시 데이터로 본다</strong>.',
                ja: 'まだあなたの居場所を知らない。<strong>ホーム都市を設定する</strong>か、<strong>サンプルで見る</strong>。',
                pt: 'Ainda não nos disse onde está. <strong>Defina uma cidade-base</strong>, ou <strong>veja com dados de exemplo</strong>.',
                es: 'Aún no nos ha dicho dónde está. <strong>Defina una ciudad base</strong>, o <strong>vea con datos de ejemplo</strong>.'
            }, ed);
            const ctaSet  = L({ en: 'SET HOME CITIES', ko: '홈 도시 설정', ja: 'ホーム都市', pt: 'CIDADES-BASE', es: 'CIUDADES BASE' }, ed);
            const ctaDemo = L({ en: 'SHOW DEMO',       ko: '예시 보기',   ja: 'サンプル', pt: 'VER EXEMPLO', es: 'VER EJEMPLO' }, ed);
            const retLine = ret
                ? `<p class="sdd-personal__line is-memory">${escapeHtml(ret.line)}</p>`
                : '';
            host.innerHTML = `
                <section class="sdd-personal sdd-personal--empty" lang="${ed}">
                    <p class="sdd-personal__eyebrow">${escapeHtml(eyebrowLabel)}</p>
                    ${retLine}
                    <p class="sdd-personal__line">${emptyLine /* trusted in-file copy */}</p>
                    <p class="sdd-personal__cta">
                        <a href="#homes">${escapeHtml(ctaSet)}</a>
                        <a href="#demo">${escapeHtml(ctaDemo)}</a>
                    </p>
                </section>
            `;
            return;
        }

        const lines = moments.map(m => {
            const cls = (m.kind === 'schengen-warn' || m.kind === 'tax-over') ? 'is-alert'
                      : (m.kind === 'ins-warn' || m.kind === 'tax-near')      ? 'is-warn'
                      : (m.kind === 'memory' || m.kind === 'return')           ? 'is-memory' : '';
            return `<p class="sdd-personal__line ${cls}">${escapeHtml(m.line)}</p>`;
        }).join('');

        host.innerHTML = `
            <section class="sdd-personal" lang="${ed}">
                <p class="sdd-personal__eyebrow">${escapeHtml(eyebrowLabel)}</p>
                ${lines}
            </section>
        `;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_PERSONAL = { compute, render, setHomes, getHomes, CITIES };
})();
