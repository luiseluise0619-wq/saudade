// saudade · demo data
//
// Loads a realistic example traveller's stays into the four calculators so
// a fresh visitor can see what saudade does in 0.3s instead of staring at
// empty forms. Triggered from the empty-state of any calculator section
// or from #demo URL hash.
//
// Persona: "Inês, Lisbon-based remote engineer who spent Q1 in Schengen,
// travelled to Seoul in May, took a 3-month break in Bali (uninsured for
// 2 weeks between policies), pays into KR-NPS and PT Segurança Social."
//
// API:
//   window.SAUDADE_DEMO.load()    populate localStorage with the persona
//   window.SAUDADE_DEMO.clear()   wipe demo data (keeps real user data
//                                  if any was already there — refuses to
//                                  clear when keys look user-edited)
//   window.SAUDADE_DEMO.isLoaded()
'use strict';

// IIFE — 로드 즉시 실행. 예시 여행자 데이터를 계산기들에 채워 첫 방문자가 바로 체감하게 하는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_DEMO) return;
    // FLAG — 데모 데이터가 로드됐음을 표시하는 localStorage 키.
    const FLAG = 'saudade.demo.loaded';

    // ─── The persona ─────────────────────────────────────────────────────
    // 아래 배열들은 가상의 인물 "Inês"의 셰겐/세금/보험/연금/홈도시 예시 데이터.
    const SCHENGEN_STAYS = [
        { in: '2026-01-08', out: '2026-02-21', country: 'PT' },   // 45 days Lisbon
        { in: '2026-03-12', out: '2026-04-02', country: 'ES' },   // 22 days Madrid
        { in: '2026-04-18', out: '2026-04-30', country: 'IT' }    // 13 days Rome
    ];
    const TAX_STAYS = [
        { country: 'PT', in: '2026-01-08', out: '2026-02-21' },
        { country: 'ES', in: '2026-03-12', out: '2026-04-02' },
        { country: 'IT', in: '2026-04-18', out: '2026-04-30' },
        { country: 'KR', in: '2026-05-08', out: '2026-05-22' },
        { country: 'ID', in: '2026-06-01', out: '2026-08-30' },
        { country: 'PT', in: '2026-09-15', out: '2026-12-15' }
    ];
    const INS_POLICIES = [
        { provider: 'SafetyWing', country: 'GLOBAL', in: '2026-01-08', out: '2026-05-31' },
        // Two-week gap in Bali — the calculator should flag it.
        { provider: 'Genki',      country: 'GLOBAL', in: '2026-06-15', out: '2026-08-30' },
        { provider: 'National (PT SNS)', country: 'PT', in: '2026-09-15', out: '2026-12-31' }
    ];
    const PEN_FILINGS = [
        { scheme: 'KR-NPS',     country: 'KR', in: '2014-03-01', out: '2018-12-31' },
        { scheme: 'PT-SocSeg',  country: 'PT', in: '2024-01-01', out: '2026-12-31' }
    ];

    // The persona carries Lisbon (where she is editing the paper from), Seoul
    // (where she lived through her 20s — KR-NPS roots) and Bali (where she
    // spent the most days last summer). These drive the personal block on
    // the cover: "184 days since you last sat in a Seoul café."
    const HOMES = ['LIS', 'SEL', 'DPS'];

    // load — 예시 데이터를 localStorage 에 채운다. 실제 사용자 데이터가 있으면 확인 후에만 덮어쓴다.
    function load(opts) {
        opts = opts || {};
        // v644 — refuse to overwrite real user data unless explicitly forced.
        // Detect any pre-existing non-empty entries; if we find one, ask
        // the user via a native confirm() before stomping it.
        if (!opts.force) {
            const keys = ['saudade.stays', 'saudade.schengen.stays',
                          'saudade.tax.stays', 'saudade.insurance.policies',
                          'saudade.pension.filings', 'saudade.homes'];
            const hasReal = keys.some(k => {
                try { const v = localStorage.getItem(k); if (!v) return false; const a = JSON.parse(v); return Array.isArray(a) ? a.length > 0 : true; } catch (e) { return false; }
            });
            const flagged = (function () { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } })();
            if (hasReal && !flagged) {
                const ok = (typeof confirm === 'function') && confirm(
                    'You have your own data in saudade.\n\n' +
                    'Loading the demo replaces it with a sample year. Your real data will be lost.\n\n' +
                    'Continue?'
                );
                if (!ok) return false;
            }
        }
        try {
            localStorage.setItem('saudade.stays',              JSON.stringify(TAX_STAYS));
            localStorage.setItem('saudade.schengen.stays',     JSON.stringify(SCHENGEN_STAYS));
            localStorage.setItem('saudade.tax.stays',          JSON.stringify(TAX_STAYS));
            localStorage.setItem('saudade.insurance.policies', JSON.stringify(INS_POLICIES));
            localStorage.setItem('saudade.pension.filings',    JSON.stringify(PEN_FILINGS));
            localStorage.setItem('saudade.homes',              JSON.stringify(HOMES));
            localStorage.setItem(FLAG, '1');
        } catch (e) { return false; }
        // 화면에 떠 있는 계산기 폼들과 표지 공감 블록을 새 데이터로 다시 그린다.
        // Re-render the calculator forms if mounted.
        if (window.SAUDADE_STAYS_FORM)     refreshForm(window.SAUDADE_STAYS_FORM);
        if (window.SAUDADE_SCHENGEN_FORM)  refreshForm(window.SAUDADE_SCHENGEN_FORM);
        if (window.SAUDADE_TAX_FORM)       refreshForm(window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_COVERAGE_FORM)  refreshForm(window.SAUDADE_COVERAGE_FORM);
        // Repaint the cover personal block so the saudade meter populates.
        if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
            const target = document.getElementById('sddCoverPersonal');
            if (target) window.SAUDADE_PERSONAL.render(target);
        }
        return true;
    }

    // refreshForm — 모듈에 맞는 호스트 선택자를 찾아 폼을 다시 마운트(재렌더).
    function refreshForm(mod) {
        // Re-paint the form by remounting it onto its current host.
        const sel = (mod === window.SAUDADE_STAYS_FORM)     ? '#sddStaysForm'
                  : (mod === window.SAUDADE_SCHENGEN_FORM)  ? '#sddSchForm'
                  : (mod === window.SAUDADE_TAX_FORM)       ? '#sddTaxForm'
                  : (mod === window.SAUDADE_COVERAGE_FORM)  ? '#sddCoverageForm'
                  : null;
        if (!sel) return;
        const host = document.querySelector(sel);
        if (host && mod.mount) mod.mount(host);
    }

    // clear — 데모 데이터만 지운다(데모가 로드된 상태일 때만 동작).
    function clear() {
        if (!isLoaded()) return false;
        try {
            ['saudade.schengen.stays', 'saudade.tax.stays',
             'saudade.insurance.policies', 'saudade.pension.filings',
             'saudade.homes'].forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(FLAG);
        } catch (e) { return false; }
        if (window.SAUDADE_SCHENGEN_FORM)  refreshForm(window.SAUDADE_SCHENGEN_FORM);
        if (window.SAUDADE_TAX_FORM)       refreshForm(window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_COVERAGE_FORM)  refreshForm(window.SAUDADE_COVERAGE_FORM);
        if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
            const target = document.getElementById('sddCoverPersonal');
            if (target) window.SAUDADE_PERSONAL.render(target);
        }
        return true;
    }

    // isLoaded — 데모 데이터가 현재 로드돼 있는지 여부.
    function isLoaded() {
        try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
    }

    // ─── Hash trigger ────────────────────────────────────────────────────
    // handleHash — #demo 면 데모 로드 후 장부로 이동, #demo-clear 면 데모 제거.
    function handleHash() {
        if (location.hash === '#demo') {
            load();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
            // Jump to Ledger so the user sees the populated panels immediately.
            try { document.body.setAttribute('data-section', '01'); } catch (e) {}
        } else if (location.hash === '#demo-clear') {
            clear();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    // 전역 공개 API — 데모 로드/제거/상태 조회.
    window.SAUDADE_DEMO = { load, clear, isLoaded };
})();
