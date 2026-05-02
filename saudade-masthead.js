// SAUDADE · MASTHEAD + SECTION ROUTER (헌법 §0.5-5 신규 컴포넌트)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
//
// 역할:
// 1. dock-btn 클릭 → body.section-active + body[data-section="01..04"] 세팅
// 2. § 마다 다른 마스트헤드 ("§ 01 · THE LEDGER · ISSUE 03 · P.04") 자동 렌더
// 3. ESC / saudade 워드마크 클릭 → 표지로 복귀
'use strict';

(function() {
    if (window.SAUDADE_MASTHEAD) return;

    // dock data-cat → § 정보 (Handoff v2 §4 — tz/trip 재매핑)
    const SECTIONS = {
        visa: { num: '01', name: 'THE LEDGER',     ko: '레저',      page: 'P. 04' },
        cafe: { num: '02', name: 'THE ATLAS',      ko: '아틀라스',   page: 'P. 08' },
        tz:   { num: '03', name: 'DISPATCHES',     ko: '디스패치',   page: 'P. 13' },
        trip: { num: '04', name: 'THE DESK',       ko: '데스크',     page: 'P. 18' }
    };

    function injectStyles() {
        if (document.getElementById('sddMastheadStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddMastheadStyles';
        s.textContent = `
.sdd-masthead {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: clamp(20px, 3vw, 40px) clamp(24px, 6vw, 80px) clamp(12px, 1.5vw, 18px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    z-index: 6;
    pointer-events: none;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--ink);
}
body:not(.section-active) .sdd-masthead { display: none; }
body.cafe-mode .sdd-masthead { display: none; }
.sdd-mast-left, .sdd-mast-right {
    display: flex; gap: clamp(12px, 2vw, 32px); align-items: baseline;
    pointer-events: auto;
}
.sdd-mast-num     { color: var(--rust); }
.sdd-mast-name    { color: var(--ink); font-weight: 500; }
.sdd-mast-issue,
.sdd-mast-page    { color: var(--bone-d); font-weight: 400; letter-spacing: var(--tr-mono-meta); }
.sdd-mast-back {
    background: transparent;
    border: 0;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 0;
}
.sdd-mast-back:hover { color: var(--rust); }
.sdd-mast-back::before { content: '← '; }

/* 섹션 스테이지 — § 화면 진입 시 paper 위 콘텐츠 영역 */
body.section-active .sdd-cover { display: none !important; }
body.section-active::before { content: none !important; }

/* 모바일 마스트헤드 단축 */
@media (max-width: 768px) {
    .sdd-masthead {
        padding: 14px 16px 8px;
        font-size: 9px;
        flex-wrap: wrap;
        gap: 6px;
    }
    .sdd-mast-issue, .sdd-mast-page { display: none; }
}
`;
        document.head.appendChild(s);
    }

    function ensureMasthead() {
        let m = document.getElementById('sddMasthead');
        if (m) return m;
        m = document.createElement('header');
        m.id = 'sddMasthead';
        m.className = 'sdd-masthead';
        m.innerHTML = `
            <div class="sdd-mast-left">
                <span class="sdd-mast-num"></span>
                <span class="sdd-mast-name"></span>
            </div>
            <div class="sdd-mast-right">
                <span class="sdd-mast-issue">ISSUE 03</span>
                <span class="sdd-mast-page"></span>
                <button type="button" class="sdd-mast-back" data-sdd-back>BACK TO COVER</button>
            </div>
        `;
        document.body.appendChild(m);

        m.querySelector('[data-sdd-back]').addEventListener('click', () => {
            backToCover();
        });
        return m;
    }

    function applyMasthead(cat) {
        const sec = SECTIONS[cat];
        if (!sec) return;
        const m = ensureMasthead();
        const ko = window.state && window.state.lang === 'ko';
        m.querySelector('.sdd-mast-num').textContent  = '§ ' + sec.num;
        m.querySelector('.sdd-mast-name').textContent = ko ? sec.ko : sec.name;
        m.querySelector('.sdd-mast-page').textContent = sec.page;
    }

    function setSection(cat) {
        document.body.classList.add('section-active');
        document.body.setAttribute('data-section', SECTIONS[cat] ? SECTIONS[cat].num : '');
        applyMasthead(cat);
        // 헌법 §9 — saudade.last.screen
        try { localStorage.setItem('saudade.last.screen', cat); } catch (e) {}
        // saudade-rings 도 macro → meso 로 재마운트 (§ 화면은 안쪽으로)
        try { window.SAUDADE_RINGS?.unmount?.(); window.SAUDADE_RINGS?.mount?.('meso', 'top-right'); } catch (e) {}
    }

    function backToCover() {
        document.body.classList.remove('section-active');
        document.body.removeAttribute('data-section');
        try { localStorage.setItem('saudade.last.screen', 'cover'); } catch (e) {}
        try { window.SAUDADE_RINGS?.unmount?.(); window.SAUDADE_RINGS?.mount?.('macro', 'bottom-right'); } catch (e) {}
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
    }

    // v607 — 새로고침 시 마지막 § 복원 (자동 진입). 표지면 복원 안 함.
    function restoreLastScreen() {
        try {
            const last = localStorage.getItem('saudade.last.screen');
            if (last && SECTIONS[last]) {
                // dock-btn 의 click 핸들러도 호출되어야 기존 모듈 (visa-tracker 등) 의
                // 모달이 작동할 수 있도록 — 단 §62 에서 이미 모달 hide 됐으므로 setSection 만.
                setSection(last);
            }
        } catch (e) {}
    }

    // dock-btn 클릭 hook — JS 함수 손 안 대고 click 이벤트 capturing 으로 감지
    function watchDock() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.dock-btn');
            if (!btn) return;
            const cat = btn.getAttribute('data-cat');
            if (cat && SECTIONS[cat]) {
                setSection(cat);
            }
        }, true);

        // ESC = back to cover
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('section-active')) {
                e.stopPropagation();
                backToCover();
            }
        });

        // saudade 워드마크 클릭 = back to cover (있으면)
        document.addEventListener('click', (e) => {
            const wm = e.target.closest('.brand-stack, [data-sdd-wordmark]');
            if (wm && document.body.classList.contains('section-active')) {
                backToCover();
            }
        });
    }

    function init() {
        injectStyles();
        ensureMasthead();
        watchDock();
        // v607 새로고침 시 마지막 § 복원
        setTimeout(restoreLastScreen, 200);   // saudade-* 컴포넌트 init 후 실행
        window.SAUDADE_MASTHEAD = { setSection, backToCover, restoreLastScreen, SECTIONS };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
