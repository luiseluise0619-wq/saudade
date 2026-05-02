// SAUDADE · FOOTER RULE (헌법 §0.5-5)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
// dock 위에 항상 떠 있는 룰 + 카피라인. 메인 / 섹션 모두 동일한 구조.
// "PG 04 OF 12 · § 01 · LEDGER · saudade" 식.
'use strict';

(function() {
    if (window.SAUDADE_FOOTER) return;

    function injectStyles() {
        if (document.getElementById('sddFooterStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddFooterStyles';
        s.textContent = `
.sdd-footer-rule {
    position: fixed;
    bottom: var(--dock-h, 56px);
    left: 0; right: 0;
    padding: clamp(8px, 1vw, 12px) clamp(20px, 5vw, 64px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 0.5px solid var(--rule);
    background: var(--paper);
    z-index: 5;
    pointer-events: none;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta, .18em);
    text-transform: uppercase;
    color: var(--bone-d);
}
body.cafe-mode .sdd-footer-rule { display: none; }

.sdd-footer-l, .sdd-footer-r {
    display: flex; gap: clamp(8px, 1.5vw, 24px); align-items: center;
}

@media (max-width: 768px) {
    .sdd-footer-rule {
        padding: 6px 12px;
        font-size: 8.5px;
        gap: 6px;
    }
    .sdd-footer-r .sdd-footer-copy { display: none; }
}

/* dock 위 v600 의 .bottom-dock::before 푸터는 영구 hide (이 컴포넌트로 대체) */
body:not(.cafe-mode) .bottom-dock::before { content: none !important; display: none !important; }
`;
        document.head.appendChild(s);
    }

    function ensureFooter() {
        let f = document.getElementById('sddFooter');
        if (f) return f;
        f = document.createElement('footer');
        f.id = 'sddFooter';
        f.className = 'sdd-footer-rule';
        f.innerHTML = `
            <div class="sdd-footer-l">
                <span class="sdd-footer-page"></span>
                <span class="sdd-footer-section"></span>
            </div>
            <div class="sdd-footer-r">
                <span class="sdd-footer-copy">saudade · a longing for what cannot return</span>
                <span class="sdd-footer-issue">© 2026</span>
            </div>
        `;
        document.body.appendChild(f);
        return f;
    }

    function update() {
        const f = ensureFooter();
        const sec = document.body.getAttribute('data-section');
        const SECTIONS = window.SAUDADE_MASTHEAD?.SECTIONS;
        if (sec && SECTIONS) {
            const matched = Object.values(SECTIONS).find(s => s.num === sec);
            if (matched) {
                f.querySelector('.sdd-footer-page').textContent = matched.page + ' OF 12';
                f.querySelector('.sdd-footer-section').textContent = '§ ' + matched.num + ' · ' + matched.name;
                return;
            }
        }
        f.querySelector('.sdd-footer-page').textContent = 'P. 01 OF 12';
        f.querySelector('.sdd-footer-section').textContent = '§ 00 · ISSUE COVER';
    }

    function init() {
        injectStyles();
        ensureFooter();
        update();
        // body class 변경 시 (section-active 토글) 자동 갱신
        const mo = new MutationObserver(update);
        mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-section'] });
        window.SAUDADE_FOOTER = { update };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
