// SAUDADE · § 03 DISPATCHES (Handoff v2 §5.3)
// 일간 06:00 KST 발행. 9 quiet news (3 도시 × 3 items).
// data/dispatches.json fetch → 매거진 페이지 렌더.
// 카드 X — 1px rule + mono 번호 + Fraunces 헤드 + italic lede + mono 출처.
'use strict';

(function() {
    if (window.SAUDADE_DISPATCHES) return;

    let _cache = {};   // edition → data

    function currentEdition() {
        return (window.SAUDADE_EDITION?.get?.() || 'en');
    }

    function load() {
        const ed = currentEdition();
        if (_cache[ed]) return Promise.resolve(_cache[ed]);

        // v8 §02 — Worker /dispatches/today 가 fresh D1 데이터 반환.
        // Signed-in 사용자면 Following 도시로 필터, 익명이면 edition 전체.
        // 어느 쪽이든 static JSON 보다 신선해서 둘 다 시도. 실패 시 static fallback.
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const user = window.SAUDADE_AUTH?.getUser?.();
        if (base) {
            const wUrl = base + '/dispatches/today?edition=' + encodeURIComponent(ed) +
                          (user && user.id ? '&user_id=' + encodeURIComponent(user.id) : '');
            return fetch(wUrl, { cache: 'no-cache', credentials: 'omit' })
                .then(r => r.ok ? r.json() : null)
                .then(j => {
                    if (j && Array.isArray(j.items) && j.items.length) {
                        // worker 응답을 v7 cities 구조로 변환 — flattenForDay 가 그대로 매핑.
                        const synthetic = { edition: ed, cities: [] };
                        const byCity = {};
                        j.items.forEach(it => {
                            const city = it._city || 'UNKNOWN';
                            if (!byCity[city]) {
                                byCity[city] = { city, items: [] };
                                synthetic.cities.push(byCity[city]);
                            }
                            byCity[city].items.push(it);
                        });
                        synthetic.filed_at = new Date(j.published_at || Date.now()).toISOString();
                        synthetic._source = 'worker';   // 디버그
                        _cache[ed] = synthetic;
                        return synthetic;
                    }
                    return loadStatic(ed);
                })
                .catch(() => loadStatic(ed));
        }
        return loadStatic(ed);
    }

    function loadStatic(ed) {
        const url = ed === 'en' ? './data/dispatches.json' : `./data/dispatches.${ed}.json`;
        // v647 — also load dispatches.week.json (when present) and attach
        // the days array so the Past Week archive can render real per-day
        // content rather than reusing today's items rotated by weekday.
        const weekP = fetch('./data/dispatches.week.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);

        return fetch(url, { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) {
                    _cache[ed] = d;
                    return weekP.then(w => {
                        if (w && Array.isArray(w.days)) d._weekDays = w.days;
                        return d;
                    });
                }
                return fetch('./data/dispatches.json', { cache: 'force-cache' })
                    .then(r => r.ok ? r.json() : null)
                    .then(d2 => {
                        _cache[ed] = d2 || { cities: [] };
                        return weekP.then(w => {
                            if (w && Array.isArray(w.days)) _cache[ed]._weekDays = w.days;
                            return _cache[ed];
                        });
                    });
            })
            .catch(() => { _cache[ed] = { cities: [] }; return _cache[ed]; });
    }

    function injectStyles() {
        if (document.getElementById('sddDispatchStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDispatchStyles';
        s.textContent = `
.sdd-disp {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="03"] .sdd-disp { display: block; }

.sdd-disp-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    /* v7 검토 정정 — 이중선 방지: 다음 .sdd-disp-day-head / .sdd-disp-city 가 자체 border 가짐 */
}
.sdd-disp-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-disp-h2 .it { font-style: italic; display: inline; }

.sdd-disp-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 12px 0 0;
}
.sdd-disp-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 12px 0 0;
}
/* Filing age chip — quiet by default, rust when > 2 days stale.
   §9.5 — daily filing; surface when the cron / pipeline has dropped. */
.sdd-disp-stale {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 6px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    border: 0.5px solid var(--rule);
    color: var(--bone-d);
}
.sdd-disp-stale.is-warn {
    color: var(--rust);
    border-color: var(--rust);
}

.sdd-disp-city {
    margin: clamp(28px, 4vw, 56px) 0 0;
    padding-top: clamp(20px, 3vw, 32px);
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-city-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(16px, 2vw, 24px);
}
.sdd-disp-city-name {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 3.5vw, 40px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
}
.sdd-disp-city-name .season {
    font-style: normal;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-left: 12px;
}
.sdd-disp-city-count {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}

.sdd-disp-item {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(14px, 2vw, 20px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-item:last-child { border-bottom: 0.5px solid var(--rule); }

.sdd-disp-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    padding-top: 4px;
}
.sdd-disp-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.sdd-disp-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(17px, 1.7vw, 22px);
    line-height: 1.35;
    letter-spacing: var(--tr-fraunces-body-d);
    color: var(--ink);
    margin: 0;
}
.sdd-disp-lede {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 0;
}
.sdd-disp-fulltext {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(13.5px, 1.25vw, 15px);
    line-height: 1.55;
    color: var(--ink);
    margin: 8px 0 0;
}
.sdd-disp-quote {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(14px, 1.4vw, 17px);
    line-height: 1.45;
    color: var(--rust);
    margin: 8px 0 0;
    padding-left: 12px;
    border-left: 0.5px solid var(--rule-2, var(--rule));
}
.sdd-disp-source {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 8px 0 0;
}
.sdd-disp-source a {
    color: var(--bone-d);
    text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-disp-source a:hover { color: var(--rust); border-bottom-color: var(--rust); }

.sdd-disp-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-deeper {
    margin: clamp(32px, 5vw, 56px) 0 0;
    padding-top: clamp(20px, 3vw, 28px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-disp-deeper-link {
    color: var(--ink);
    text-decoration: none;
    border-bottom: 0.5px solid var(--ink);
    padding-bottom: 1px;
}
.sdd-disp-deeper-link:hover { color: var(--rust, #b2351a); border-bottom-color: var(--rust, #b2351a); }
.sdd-disp-deeper-soon { font-style: italic; font-family: var(--serif); text-transform: none; letter-spacing: 0; font-size: 13px; }
/* v7 검토 정정 — 면책 토글 (기본 접힘, 클릭 시 펼침). 콘텐츠가 압도되지 않게. */
.sdd-disp-disclaimer-toggle {
    list-style: none;
    cursor: pointer;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    padding: 6px 0;
    transition: color .12s;
    user-select: none;
}
.sdd-disp-disclaimer-toggle::-webkit-details-marker { display: none; }
.sdd-disp-disclaimer-toggle::marker { content: ''; }
.sdd-disp-disclaimer-toggle::after { content: ' →'; opacity: .6; }
.sdd-disp-foot[open] .sdd-disp-disclaimer-toggle::after { content: ' ↓'; opacity: 1; }
.sdd-disp-disclaimer-toggle:hover { color: var(--ink); }
.sdd-disp-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: clamp(12px, 1.5vw, 16px) 0 0;
}
.sdd-disp-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

/* v6 §9 — 일요일 휴간 + TODAY + ARCHIVE 섹션 */
.sdd-disp-sunday {
    padding: clamp(40px, 6vw, 80px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    text-align: center;
    margin: clamp(24px, 4vw, 48px) 0;
}
.sdd-disp-sunday-line {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(20px, 2.4vw, 28px);
    line-height: 1.4;
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-disp-sunday-sub {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

.sdd-disp-day-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 0 clamp(12px, 1.5vw, 18px);
    margin: 0 0 clamp(16px, 2vw, 24px);
    border-bottom: 0.5px solid var(--rule);
}

/* v651 — inline city-picker chips above today's items. */
.sdd-disp-cities-bar {
    margin: 0 0 clamp(20px, 3vw, 32px);
    padding: 0 0 clamp(14px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-disp-cities-eyebrow {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--rust);
    margin: 0 0 12px;
}
.sdd-disp-cities-row {
    display: flex; flex-wrap: wrap; gap: 8px;
    align-items: center;
}
.sdd-disp-city-chip {
    display: inline-flex; align-items: baseline; gap: 8px;
    background: transparent;
    border: 0.5px solid var(--rule);
    padding: 8px 12px;
    font-family: var(--mono); font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ink);
    cursor: pointer;
    transition: color .15s, border-color .15s;
}
.sdd-disp-city-chip:hover { color: var(--rust); border-color: var(--rust); }
.sdd-disp-city-chip .n { color: var(--bone-d); font-weight: 500; }
.sdd-disp-city-chip .name {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; letter-spacing: 0; text-transform: none;
}
.sdd-disp-city-chip .x { color: var(--bone-d); font-size: 14px; }
.sdd-disp-city-chip:hover .x { color: var(--rust); }
.sdd-disp-cities-cta {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rust);
    color: var(--rust);
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    padding: 6px 4px; cursor: pointer;
    margin-left: auto;
    transition: color .15s, border-color .15s;
}
.sdd-disp-cities-cta:hover { color: var(--ink); border-bottom-color: var(--ink); }
.sdd-disp-cities-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d);
    flex: 1;
}
@media (max-width: 540px) {
    .sdd-disp-cities-cta { margin-left: 0; width: 100%; text-align: left; }
}
.sdd-disp-day-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--accent, var(--rust));
}
.sdd-disp-day-section {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}

.sdd-disp-today { margin: clamp(20px, 3vw, 32px) 0 clamp(40px, 6vw, 80px); }

.sdd-disp-archive {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(20px, 3vw, 32px);
    border-top: 0.5px solid var(--rule-2, var(--rule));
}
.sdd-disp-archive-mast {
    margin: 0 0 clamp(12px, 1.5vw, 20px);
}
.sdd-disp-archive-day {
    margin: clamp(20px, 3vw, 32px) 0;
    padding-top: clamp(12px, 1.5vw, 18px);
    border-top: 0.5px solid var(--rule);
    opacity: 0.78;
}
.sdd-disp-archive-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(12px, 1.5vw, 18px);
}
.sdd-disp-archive-date {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    color: var(--ink);
}
.sdd-disp-archive-section {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}

.sdd-disp-citytag {
    display: inline-block;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 6px;
}
.sdd-disp-empty {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
    padding: clamp(40px, 6vw, 80px) 0;
}

/* v7 §9.5 데일리 디스패치 30% 재작성 (편집자 모드 전용) */
.sdd-disp-editor {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--jade);
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 0.5px solid var(--rule);
    display: none;
}
body[data-editor="1"] .sdd-disp-editor { display: block; }
.sdd-disp-editor strong { font-weight: 500; color: var(--jade); margin-right: 8px; }
.sdd-disp-editor.below,
.sdd-disp-editor.below strong { color: var(--rust); }
.sdd-disp-rewrite-tag {
    display: none;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    margin: 0 0 4px;
}
body[data-editor="1"] .sdd-disp-rewrite-tag { display: inline-block; }
.sdd-disp-rewrite-tag.rewritten { color: var(--jade); }
.sdd-disp-rewrite-tag.draft     { color: var(--signal); }

/* v8 §02 — Awaiting placeholder (Following 도시이지만 dispatch 없을 때) */
.sdd-disp-awaiting { opacity: 0.6; }
.sdd-disp-awaiting .sdd-disp-citytag { color: var(--rust); }

/* v8 §02 — Inline onboarding (Following 비었을 때) */
.sdd-disp-onboarding { padding: clamp(20px, 3vw, 32px) 0; }
.sdd-disp-onboarding-h3 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.2;
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-disp-onboarding-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-disp-onboarding-pairings {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-onboarding-pairings li { border-bottom: 0.5px solid var(--rule); }
.sdd-disp-pairing {
    background: transparent !important;
    border: 0 !important;
    width: 100% !important;
    text-align: left !important;
    padding: 14px 0 !important;
    cursor: pointer;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    min-height: 44px !important;
}
.sdd-disp-pairing-label {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    color: var(--ink);
}
.sdd-disp-pairing-cities {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-disp-pairing:hover .sdd-disp-pairing-label { color: var(--rust); }

/* v7 §9.9 retract placeholder */
.sdd-disp-retracted { opacity: 0.7; }
.sdd-disp-retract-msg {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

@media (max-width: 768px) {
    .sdd-disp { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-disp-item { grid-template-columns: 32px 1fr; gap: 12px; }
    .sdd-disp-city-head { flex-direction: column; align-items: flex-start; gap: 4px; }
}
`;
        document.head.appendChild(s);
    }

    function fmtDate(iso) {
        try { return new Date(iso).toISOString().slice(0, 10); }
        catch (e) { return ''; }
    }
    function fmtDateTime(iso) {
        try {
            const d = new Date(iso);
            return d.toISOString().slice(0, 10) + ' AT ' +
                d.toISOString().slice(11, 16) + ' KST';
        } catch (e) { return ''; }
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
    // v7 검토 정정 — italic 헤드라인 끝 마침표/쉼표는 regular 로 분리 (영문 잡지 표준)
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }
    function safeUrl(u) {
        if (!u || typeof u !== 'string') return null;
        try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? url.toString() : null; }
        catch (e) { return null; }
    }

    // v6 §9.2 — 요일별 섹션 (Mon=visa, Tue=museum, Wed=city hall, Thu=desk,
    // Fri=editor's photo, Sat=quiet news, Sun=NO PUBLISH)
    const WEEKDAY_SECTIONS = {
        en: {
            1: 'VISA & POLICY NOTES',
            2: 'MUSEUM & GALLERY',
            3: 'CITY HALL NOTICES',
            4: 'NEW ON THE DESK',
            5: "EDITOR'S PHOTOGRAPH",
            6: 'QUIET NEWS',
            sundayMsg: 'Saudade does not publish on Sundays.',
            sundaySub:  'Dispatches resume Monday at 06:00 KST.',
            todayLabel: 'TODAY',
            archiveLabel: 'PAST WEEK',
            empty: 'No dispatch filed yet today.'
        },
        ko: {
            1: '비자·정책', 2: '박물관·갤러리', 3: '시·구청 공지',
            4: '편집부 신간', 5: '편집장의 사진', 6: '단신',
            sundayMsg: 'Saudade는 일요일에 발행하지 않는다.',
            sundaySub:  '월요일 새벽 6시(KST) 디스패치 재개.',
            todayLabel: '오늘', archiveLabel: '지난 한 주', empty: '오늘 발행된 디스패치가 아직 없다.'
        },
        ja: {
            1: 'ビザ・政策', 2: '美術館・ギャラリー', 3: '市役所通知',
            4: '編集部の新着', 5: '編集長の写真', 6: '小さなニュース',
            sundayMsg: 'Saudadeは日曜日に発行しない。',
            sundaySub:  '月曜日 朝6時(KST)に通信を再開する。',
            todayLabel: '本日', archiveLabel: '今週', empty: '本日の通信はまだ届いていない。'
        },
        pt: {
            1: 'VISTOS & POLÍTICA', 2: 'MUSEUS & GALERIAS', 3: 'AVISOS MUNICIPAIS',
            4: 'NOVO NA REDAÇÃO', 5: 'A FOTOGRAFIA DO EDITOR', 6: 'NOTÍCIAS QUIETAS',
            sundayMsg: 'A Saudade não publica aos domingos.',
            sundaySub:  'Os despachos voltam segunda às 06h00 KST.',
            todayLabel: 'HOJE', archiveLabel: 'A SEMANA PASSADA', empty: 'Nenhum despacho publicado hoje.'
        },
        es: {
            1: 'VISADOS Y POLÍTICA', 2: 'MUSEOS Y GALERÍAS', 3: 'AVISOS MUNICIPALES',
            4: 'NUEVO EN LA REDACCIÓN', 5: 'LA FOTOGRAFÍA DEL EDITOR', 6: 'NOTICIAS QUIETAS',
            sundayMsg: 'Saudade no publica los domingos.',
            sundaySub:  'Los despachos vuelven el lunes a las 06:00 KST.',
            todayLabel: 'HOY', archiveLabel: 'LA SEMANA PASADA', empty: 'Aún no hay despacho publicado hoy.'
        }
    };

    function todayWeekday() {
        return new Date().getDay();   // 0=Sun, 1=Mon, ..., 6=Sat
    }

    function isSundayToday() {
        return todayWeekday() === 0;
    }

    // v7 §9.9 — dispatch retracts (worker /dispatches/retracted)
    let _retracts = null;
    let _retractsAt = 0;
    const RETRACTS_TTL = 60 * 1000;
    function fetchRetracts() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return Promise.resolve([]);
        if (_retracts && (Date.now() - _retractsAt) < RETRACTS_TTL) return Promise.resolve(_retracts);
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return fetch(base + '/dispatches/retracted?edition=' + encodeURIComponent(ed), { cache: 'no-cache', credentials: 'omit' })
            .then(r => r.ok ? r.json() : null)
            .then(j => { _retracts = (j && j.retracts) || []; _retractsAt = Date.now(); return _retracts; })
            .catch(() => { _retracts = []; _retractsAt = Date.now(); return _retracts; });
    }
    function dispatchIdFor(item) {
        const city = (item._city || '').toLowerCase().replace(/\s+/g, '-');
        return city + '-' + (item.n || '');
    }
    function isRetracted(item) {
        if (!_retracts) return null;
        const id = dispatchIdFor(item);
        return _retracts.find(r => r.dispatch_id === id);
    }
    const RETRACT_MSG = {
        en: 'This dispatch was retracted by the editor.',
        ko: '편집장이 이 디스패치를 철회했다.',
        ja: 'この通信は編集長により撤回された。',
        pt: 'Este despacho foi retirado pelo editor.',
        es: 'Este despacho fue retirado por el editor.'
    };


    // v647 — collapse multiple "Awaiting from X" in a row into a single
    // pretty statement. If every item in a day is awaiting, render one
    // italic line listing the cities; otherwise render each item individually.
    function renderItemsBlock(items) {
        if (!Array.isArray(items) || !items.length) return '';
        const allAwaiting = items.every(it => it && it._awaiting);
        if (!allAwaiting) return items.map(renderItem).join('');
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const T = window.SAUDADE_T || ((s) => s.en);
        const cityList = items.map(it => it._city || '').filter(Boolean);
        const cities = cityList.length === 1
            ? cityList[0]
            : cityList.length === 2
                ? cityList.join(' & ')
                : cityList.slice(0, -1).join(', ') + ' & ' + cityList[cityList.length - 1];
        const msg = T({
            en: `On the wire from ${cities}.`,
            ko: `${cities} — 송고 대기.`,
            ja: `${cities} — 入稿待ち。`,
            pt: `Em transmissão de ${cities}.`,
            es: `En transmisión desde ${cities}.`
        });
        return `
            <article class="sdd-disp-item sdd-disp-awaiting sdd-disp-awaiting-collapsed">
                <p class="sdd-disp-lede" style="font-style:italic; margin: 0;">${escapeHtml(msg)}</p>
            </article>
        `;
    }

    function renderItem(it) {
        // v8 §02 — Awaiting placeholder (Following 도시이지만 dispatches.json 에 없을 때)
        if (it && it._awaiting) {
            const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
            const T = window.SAUDADE_T || ((s) => s.en);
            const msg = T({
                en: 'On the wire from $city.',
                ko: '$city 에서 오는 중.',
                ja: '$city より入電中。',
                pt: 'Em transmissão de $city.',
                es: 'En transmisión desde $city.'
            }).replace('$city', it._city || '');
            return `
                <article class="sdd-disp-item sdd-disp-awaiting">
                    <span class="sdd-disp-num">${escapeHtml(it.n || '')}</span>
                    <div class="sdd-disp-body">
                        <span class="sdd-disp-citytag">${escapeHtml(it._city || '')}</span>
                        <p class="sdd-disp-lede" style="font-style:italic">${escapeHtml(msg)}</p>
                    </div>
                </article>
            `;
        }
        // v7 §9.9 retract check
        const retract = isRetracted(it);
        if (retract) {
            if (retract.age_minutes < 30) return '';   // 완전 hide
            const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
            const msg = RETRACT_MSG[ed] || RETRACT_MSG.en;
            return `
                <article class="sdd-disp-item sdd-disp-retracted">
                    <span class="sdd-disp-num">${escapeHtml(it.n || '')}</span>
                    <div class="sdd-disp-body">
                        <p class="sdd-disp-retract-msg">${escapeHtml(msg)}</p>
                    </div>
                </article>
            `;
        }
        const safeSrc = safeUrl(it.source_url);
        const fulltext = it.body ? `<p class="sdd-disp-fulltext">${escapeHtml(it.body)}</p>` : '';
        const quoteHtml = it.quote
            ? `<p class="sdd-disp-quote">&ldquo;${escapeHtml(it.quote)}&rdquo;${it.quote_source ? ' — ' + escapeHtml(it.quote_source) : ''}</p>`
            : '';
        const srcLine = `${escapeHtml(it.source || '')}${it.source_date ? ' · ' + escapeHtml(it.source_date) : ''}`;
        const srcAnchor = safeSrc
            ? `<a href="${safeSrc}" target="_blank" rel="noopener noreferrer">${srcLine}</a>`
            : srcLine;
        const cityTag = it._city
            ? `<span class="sdd-disp-citytag">${escapeHtml(it._city)}${it._adjacent ? ' · ADJACENT' : ''}</span>`
            : '';
        return `
            <article class="sdd-disp-item">
                <span class="sdd-disp-num">${escapeHtml(it.n || '')}</span>
                <div class="sdd-disp-body">
                    ${cityTag}
                    <span class="sdd-disp-rewrite-tag ${it.human_rewritten === true ? 'rewritten' : 'draft'}">${it.human_rewritten === true ? 'REWRITTEN' : 'AI DRAFT'}</span>
                    <h3 class="sdd-disp-headline">${escapeHtml(it.headline || '')}</h3>
                    <p class="sdd-disp-lede">${escapeHtml(it.lede || '')}</p>
                    ${fulltext}
                    ${quoteHtml}
                    <p class="sdd-disp-source">${srcAnchor}</p>
                </div>
            </article>
        `;
    }

    // v8 §02 — 사용자 도시 선택 모델. 정착 + 주변 자동 매핑 폐기.
    // 사용자의 SAUDADE_FOLLOWING.list() 3 도시 각각에서 1개씩 추출.
    // dispatches.json 에 해당 도시 없으면 "Awaiting first dispatch" 플레이스홀더.
    // v649 — when the user has not picked following cities (fresh visitor),
    // fall back to whatever cities exist in the data for that day instead
    // of returning []. Was causing the entire Past Week archive to read
    // empty for any reader who hadn't gone through the city-picker.
    function flattenForDay(data, weekdayIdx /* 1..6 */) {
        const cities = (data && data.cities) || [];
        const followingRaw = (window.SAUDADE_FOLLOWING?.list?.() || []).slice(0, 3);
        const following = followingRaw.length
            ? followingRaw
            : cities.slice(0, 3).map(c => String(c.city || '').toLowerCase());
        if (!following.length) return [];

        // 도시명 매칭 (case-insensitive · slug ↔ display name)
        const findCityData = (slug) => {
            const s = String(slug).toLowerCase().replace(/-/g, ' ');
            return cities.find(c => String(c.city || '').toLowerCase() === s)
                || cities.find(c => String(c.city || '').toLowerCase().replace(/[\s-]/g, '') === s.replace(/[\s-]/g, ''));
        };
        // weekday 별 item rotation — 같은 도시도 요일마다 다른 item
        const baseIdx = (weekdayIdx - 1) % 9;

        const out = [];
        following.forEach((slug, slotIdx) => {
            const cityData = findCityData(slug);
            const slot = String(slotIdx + 1).padStart(2, '0');
            const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
            // v649 — when following is the fallback (no user picks), the
            // "slug" is actually the city name from the data. Use city.city
            // directly so display matches what we showed.
            const displayName = (cityData && cityData.city)
                || window.SAUDADE_FOLLOWING?.cityName?.(slug, ed)
                || slug;
            if (!cityData || !cityData.items || !cityData.items.length) {
                // Placeholder — operator 가 AI 파이프라인 active=1 후 채워짐
                out.push({
                    n: slot,
                    headline: '',
                    lede: '',
                    _city: displayName,
                    _awaiting: true
                });
                return;
            }
            const items = cityData.items;
            const item = items[baseIdx % items.length];
            out.push({ ...item, n: slot, _city: cityData.city || displayName });
        });
        return out;
    }

    // 지난 6일치 (월~토 중 오늘 제외) — archive stack
    // v647 — earlier this iterated flattenForDay(data, weekday) which always
    // used today's dispatches.json content with a different weekday rotation.
    // That meant every past-week row showed today's items dressed up in a new
    // weekday tag — confusing. Now we honour data._weekDays (loaded from
    // data/dispatches.week.json) when available, looking up each past date
    // and using its actual cities. Falls back to the old behaviour if no
    // week data is loaded yet.
    function flattenPastWeek(data, todayIdx) {
        const result = [];
        const weekDays = (data && data._weekDays) || [];
        const byDate = {};
        for (const d of weekDays) {
            const key = (d.filed_at || '').slice(0, 10);
            if (key) byDate[key] = d;
        }

        for (let back = 1; back <= 7; back++) {
            const d = new Date();
            d.setDate(d.getDate() - back);
            const wd = d.getDay();
            if (wd === 0) continue;   // 일요일 skip
            const dateKey = d.toISOString().slice(0, 10);
            const dayData = byDate[dateKey];

            // Use the simulated week's per-day cities when present.
            let items;
            if (dayData && Array.isArray(dayData.cities)) {
                items = flattenForDay({ cities: dayData.cities }, wd);
            } else {
                items = flattenForDay(data, wd);
            }
            if (!items.length) continue;
            result.push({ date: dateKey, weekdayIdx: wd, items });
            if (result.length >= 6) break;
        }
        return result;
    }

    function render(data) {
        let root = document.getElementById('sddDispatches');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddDispatches';
            root.className = 'sdd-disp';
            document.body.appendChild(root);
        }

        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const W = WEEKDAY_SECTIONS[ed] || WEEKDAY_SECTIONS.en;
        const wdIdx = todayWeekday();
        const filed = data && data.filed_at ? fmtDateTime(data.filed_at) : '';
        const next  = data && data.next_filing ? fmtDate(data.next_filing) : '';
        // Age of last filing, in days. >2 days flips the chip into rust;
        // §9.5 expects daily filing so anything older is a visible defect.
        const filedAgeDays = (data && data.filed_at)
            ? Math.floor((Date.now() - new Date(data.filed_at).getTime()) / 86400000)
            : null;

        // v622 — 5 에디션 자국어 헤더
        const T = window.SAUDADE_T || ((s) => s.en);
        const V = window.SAUDADE_VOICE;
        const _vEd = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const headLabel   = (V && V.get('dispatchesHead', _vEd))    || 'The wires,';
        const headEdited  = (V && V.get('dispatchesEdited', _vEd))  || 'edited.';
        const headResting = (V && V.get('dispatchesResting', _vEd)) || 'resting.';
        const subTpl = T({
            en: `Three a day. Six days a week. ${'$section'}.`,
            ko: `매일 세 편. 주 엿새. ${'$section'}.`,
            ja: `日に三本、週に六日。${'$section'}。`,
            pt: `Três por dia. Seis dias por semana. ${'$section'}.`,
            es: `Tres al día. Seis días por semana. ${'$section'}.`
        });
        const filedLabel = T({
            en: 'FILED', ko: '발행', ja: '発行', pt: 'PUBLICADO', es: 'PUBLICADO'
        });
        const nextLabel = T({
            en: 'NEXT FILING', ko: '다음 발행', ja: '次回発行',
            pt: 'PRÓXIMA EDIÇÃO', es: 'PRÓXIMA EDICIÓN'
        });
        let ageChipHtml = '';
        if (filedAgeDays !== null && filedAgeDays >= 1) {
            const ageLabel = T({
                en: `${filedAgeDays} ${filedAgeDays === 1 ? 'DAY' : 'DAYS'} AGO`,
                ko: `${filedAgeDays}일 전`,
                ja: `${filedAgeDays}日前`,
                pt: `HÁ ${filedAgeDays} ${filedAgeDays === 1 ? 'DIA' : 'DIAS'}`,
                es: `HACE ${filedAgeDays} ${filedAgeDays === 1 ? 'DÍA' : 'DÍAS'}`
            });
            const warn = filedAgeDays > 2 ? ' is-warn' : '';
            ageChipHtml = ` <span class="sdd-disp-stale${warn}">${escapeHtml(ageLabel)}</span>`;
        }
        const _vEdNote = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const _V = window.SAUDADE_VOICE;
        const noteTitle       = (_V && _V.get('dispatchesNoteTitleFull', _vEdNote)) || 'A note on sources.';
        const noteBody        = (_V && _V.get('dispatchesNoteBody',      _vEdNote)) || 'Each dispatch is rewritten in our own words from the source listed.';
        const noteToggleLabel = (_V && _V.get('dispatchesNoteToggle',    _vEdNote)) || 'A note on sources';

        // 일요일 휴간 (v6 §9.1)
        if (isSundayToday()) {
            const sundayMsg = (_V && _V.get('sundayMessage', _vEdNote)) || W.sundayMsg;
            const sundaySub = (_V && _V.get('sundayResume',  _vEdNote)) || W.sundaySub;
            root.innerHTML = `
                <header class="sdd-disp-head">
                    <h2 class="sdd-disp-h2">
                        ${dropItalicPunct(headLabel)}
                        <span class="it">${dropItalicPunct(headResting)}</span>
                    </h2>
                </header>
                <section class="sdd-disp-sunday">
                    <p class="sdd-disp-sunday-line">${escapeHtml(sundayMsg)}</p>
                    <p class="sdd-disp-sunday-sub">${escapeHtml(sundaySub)}</p>
                </section>
                <details class="sdd-disp-foot">
                    <summary class="sdd-disp-disclaimer-toggle">${escapeHtml(noteToggleLabel)}</summary>
                    <p class="sdd-disp-disclaimer">
                        <strong>${escapeHtml(noteTitle)}</strong> ${escapeHtml(noteBody)}
                    </p>
                </details>
            `;
            return;
        }

        // v8 §02 — Following 도시 안 골랐으면 inline onboarding (popular pairings 카드).
        // Desk 강제 진입 X — 여기서 한 클릭으로 시작.
        const followingList = (window.SAUDADE_FOLLOWING?.list?.() || []);
        const todayItems = flattenForDay(data, wdIdx);
        const todaySection = W[wdIdx] || W[1];
        let todayHtml;
        if (!followingList.length) {
            const onboardingHead = T({
                en: 'No cities yet.', ko: '아직 도시가 없다.', ja: 'まだ街がない。',
                pt: 'Ainda sem cidades.', es: 'Aún sin ciudades.'
            });
            const onboardingBody = T({
                en: 'Pick a starting set below — or open The Desk to choose three cities yourself.',
                ko: '아래에서 시작 묶음을 고른다 — 또는 데스크에서 세 도시를 직접 고른다.',
                ja: '下から始まりの組み合わせを選ぶ — またはデスクで三つの街を自分で選ぶ。',
                pt: 'Escolha um conjunto inicial abaixo — ou abra A Mesa para escolher três cidades você mesmo.',
                es: 'Elija un conjunto inicial abajo — o abra La Mesa para elegir tres ciudades usted mismo.'
            });
            const pairings = window.SAUDADE_FOLLOWING?.pairings?.() || [];
            const pairingsHtml = pairings.map(p => {
                const lbl = window.SAUDADE_FOLLOWING.pairingLabel(p, ed);
                const cityNames = (p.cities || []).map(s => window.SAUDADE_FOLLOWING.cityName(s, ed)).join(' · ');
                return `
                    <li>
                        <button type="button" class="sdd-disp-pairing" data-disp-pairing="${escapeHtml(p.id)}">
                            <span class="sdd-disp-pairing-label">${escapeHtml(lbl)}</span>
                            <span class="sdd-disp-pairing-cities">${escapeHtml(cityNames)}</span>
                        </button>
                    </li>
                `;
            }).join('');
            todayHtml = `
                <section class="sdd-disp-onboarding">
                    <h3 class="sdd-disp-onboarding-h3">${dropItalicPunct(onboardingHead)}</h3>
                    <p class="sdd-disp-onboarding-body">${escapeHtml(onboardingBody)}</p>
                    <ul class="sdd-disp-onboarding-pairings">${pairingsHtml}</ul>
                </section>
            `;
        } else if (!todayItems.length) {
            // v636 — unified empty-state when nothing has been filed yet today.
            todayHtml = `<div id="sddDispEmpty"></div><p class="sdd-disp-empty" style="display:none">${escapeHtml(W.empty)}</p>`;
            // Render after this method returns (root.innerHTML is set below).
            setTimeout(() => {
                if (!window.SAUDADE_EMPTY) return;
                const t = window.SAUDADE_EMPTY.text('dispatches');
                // v644 — Dispatches header above already shows the eyebrow.
                window.SAUDADE_EMPTY.render('#sddDispEmpty', {
                    eyebrow: '', headline: W.empty || t.headline, lede: t.lede, note: t.note
                });
            }, 0);
        } else {
            todayHtml = renderItemsBlock(todayItems);
        }

        // 지난 6일 archive stack
        const past = flattenPastWeek(data, wdIdx);
        const pastHtml = past.map(d => {
            // v647 — only show the weekday section tag (e.g. "QUIET NEWS")
            // when there is actual content. When the whole day is awaiting,
            // the label is misleading — drop it.
            const allAwaiting = d.items && d.items.every(it => it && it._awaiting);
            return `
            <section class="sdd-disp-archive-day">
                <header class="sdd-disp-archive-head">
                    <span class="sdd-disp-archive-date">${escapeHtml(d.date)}</span>
                    ${allAwaiting ? '' : `<span class="sdd-disp-archive-section">${escapeHtml(W[d.weekdayIdx] || '')}</span>`}
                </header>
                ${renderItemsBlock(d.items)}
            </section>
        `;
        }).join('');

        const subFilled = subTpl.replace('$section', todaySection);
        const headHtml = `
            <header class="sdd-disp-head">
                <h2 class="sdd-disp-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="it">${dropItalicPunct(headEdited)}</span>
                </h2>
                <p class="sdd-disp-sub">${escapeHtml(subFilled)}</p>
                <p class="sdd-disp-meta">${escapeHtml(filedLabel)} ${escapeHtml(filed)} · ${escapeHtml(nextLabel)} ${escapeHtml(next)}${ageChipHtml}</p>
            </header>
        `;

        // v651 — quick city-picker chips on the dispatches view itself.
        // Earlier the only way to set following cities was through §04 The
        // Desk → Following pool — too far. This puts the picker right above
        // today's items.
        const followNow = (window.SAUDADE_FOLLOWING?.list?.() || []).slice(0, 3);
        const followLabel = T({
            en: 'YOUR THREE CITIES', ko: '내 세 도시', ja: 'あなたの三都市',
            pt: 'AS SUAS TRÊS CIDADES', es: 'SUS TRES CIUDADES'
        });
        const followHelp = T({
            en: 'Pick up to three. Today\'s dispatch picks one item from each.',
            ko: '최대 셋. 오늘의 디스패치는 각 도시에서 한 항목씩 가져온다.',
            ja: '最大三つ。本日の通信は各都市から一本ずつ。',
            pt: 'Até três. O despacho de hoje pega um item de cada.',
            es: 'Hasta tres. El despacho de hoy toma un elemento de cada.'
        });
        const followCta = T({
            en: 'CHANGE →', ko: '변경 →', ja: '変更 →', pt: 'ALTERAR →', es: 'CAMBIAR →'
        });
        const removeLabel = T({
            en: 'Remove', ko: '제거', ja: '削除', pt: 'Remover', es: 'Quitar'
        });
        const chipsHtml = followNow.length
            ? followNow.map((slug, i) => {
                const name = window.SAUDADE_FOLLOWING?.cityName?.(slug, ed) || slug;
                return `<button type="button" class="sdd-disp-city-chip" data-city-slug="${escapeHtml(slug)}" title="${escapeHtml(removeLabel)}">
                    <span class="n">${String(i + 1).padStart(2, '0')}</span>
                    <span class="name">${escapeHtml(name)}</span>
                    <span class="x">×</span>
                </button>`;
              }).join('')
            : `<span class="sdd-disp-cities-empty">${escapeHtml(followHelp)}</span>`;

        const cityBar = `
            <section class="sdd-disp-cities-bar">
                <p class="sdd-disp-cities-eyebrow">${escapeHtml(followLabel)}</p>
                <div class="sdd-disp-cities-row">
                    ${chipsHtml}
                    <button type="button" class="sdd-disp-cities-cta" data-open-city-picker>${escapeHtml(followCta)}</button>
                </div>
            </section>
        `;

        const todayBlock = `
            ${cityBar}
            <section class="sdd-disp-today">
                <header class="sdd-disp-day-head">
                    <span class="sdd-disp-day-eyebrow">${escapeHtml(W.todayLabel)}</span>
                    <span class="sdd-disp-day-section">${escapeHtml(todaySection)}</span>
                </header>
                ${todayHtml}
            </section>
        `;

        const archiveBlock = past.length ? `
            <section class="sdd-disp-archive">
                <header class="sdd-disp-archive-mast">
                    <span class="sdd-disp-day-eyebrow">${escapeHtml(W.archiveLabel)}</span>
                </header>
                ${pastHtml}
            </section>
        ` : '';

        const disclaimer = `
            <details class="sdd-disp-foot">
                <summary class="sdd-disp-disclaimer-toggle">${escapeHtml(noteToggleLabel)}</summary>
                <p class="sdd-disp-disclaimer">
                    <strong>${escapeHtml(noteTitle)}</strong> ${escapeHtml(noteBody)}
                </p>
            </details>
        `;

        // Deeper-than-seven-days CTA — free tier sees a quiet link to the
        // support page; subscriber tier sees a "coming soon" note. The full
        // archive backend is forthcoming; this gives the tier value-prop
        // visible from launch day. Uses body[data-tier] set by saudade-billing.js.
        const deeperLabel = T({
            en: 'Deeper than seven days — read the full archive →',
            ko: '일주일 너머 — 전체 아카이브 읽기 →',
            ja: '七日より先へ — 全アーカイブを読む →',
            pt: 'Mais fundo que sete dias — ler o arquivo inteiro →',
            es: 'Más allá de siete días — leer el archivo completo →'
        });
        const deeperSoon = T({
            en: 'Full archive search — coming soon, by city.',
            ko: '전체 아카이브 검색 — 도시별로 곧.',
            ja: '全アーカイブ検索 — 街ごと、まもなく。',
            pt: 'Busca no arquivo — em breve, por cidade.',
            es: 'Búsqueda en el archivo — pronto, por ciudad.'
        });
        const deeperBlock = `
            <p class="sdd-disp-deeper">
                <a href="support.html" class="sdd-disp-deeper-link" data-tier-show="free">${escapeHtml(deeperLabel)}</a>
                <span class="sdd-disp-deeper-soon" data-tier-show="subscriber patron">${escapeHtml(deeperSoon)}</span>
            </p>
        `;

        root.innerHTML = headHtml + todayBlock + archiveBlock + deeperBlock + disclaimer;

        // v8 §02 — onboarding pairing 카드 클릭 → Following 적용 + 즉시 재렌더
        root.querySelectorAll('[data-disp-pairing]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-disp-pairing');
                window.SAUDADE_FOLLOWING?.applyPairing?.(id);
                load().then(render);
            });
        });

        // v651 — city chip click → remove from following.
        root.querySelectorAll('[data-city-slug]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slug = btn.getAttribute('data-city-slug');
                if (slug) window.SAUDADE_FOLLOWING?.remove?.(slug);
                load().then(render);
            });
        });

        // v651 — "CHANGE →" CTA opens the desk's city picker by routing to
        // §04 The Desk where saudade-desk.js renders the full pool with
        // pairings. Falls back to a simple prompt() if desk not available.
        const cta = root.querySelector('[data-open-city-picker]');
        if (cta) {
            cta.addEventListener('click', () => {
                const dock = document.querySelector('.dock-btn[data-cat="trip"]');
                if (dock) {
                    dock.click();
                    document.body.classList.add('section-active');
                    setTimeout(() => {
                        const pool = document.querySelector('.sdd-following-pool');
                        if (pool && pool.scrollIntoView) {
                            pool.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 250);
                }
            });
        }
    }

    function init() {
        injectStyles();
        // 두 fetch 다 끝나고 render — retract 리스트가 생겨야 필터링 정확
        Promise.all([load(), fetchRetracts()]).then(([d]) => render(d));
        // section 진입 + edition 변경 시 재로드
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '03') {
                load().then(render);
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_DISPATCHES = { reload: () => { _cache = {}; init(); } };
})();
