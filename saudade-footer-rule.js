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

.sdd-footer-r .sdd-footer-copy,
.sdd-footer-r .sdd-footer-link {
    color: inherit;
    text-decoration: none;
    border-bottom: 0.5px solid transparent;
    transition: color .15s, border-color .15s;
}
.sdd-footer-r .sdd-footer-copy:hover,
.sdd-footer-r .sdd-footer-link:hover {
    color: var(--rust);
    border-bottom-color: var(--rust);
}
.sdd-footer-r .sdd-footer-link {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--bone-d);
    margin-right: 16px;
}
@media (max-width: 540px) {
    .sdd-footer-r .sdd-footer-link { display: none; }
}
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

    const FOOTER_COPY = {
        en: { archive: 'ARCHIVE',  desks: 'DESKS',     letter: 'LETTER',
              archT:   'every issue we have filed',
              desksT:  'stringers writing under the saudade masthead',
              letterT: 'write a letter to the editor',
              tag:     'saudade · a longing for what cannot return' },
        ko: { archive: '발행 기록',  desks: '특파원',   letter: '편지',
              archT:   '발행한 모든 호',
              desksT:  '사우다지 이름으로 글 쓰는 특파원들',
              letterT: '편집장에게 보내는 편지',
              tag:     '사우다지 · 돌아갈 수 없는 것을 향한 그리움' },
        ja: { archive: 'アーカイブ', desks: '特派員',  letter: '手紙',
              archT:   'これまで発行した号',
              desksT:  'サウダージ名義で書く特派員',
              letterT: '編集長に宛てる手紙',
              tag:     'サウダージ · 戻らないものへの想い' },
        pt: { archive: 'ARQUIVO',   desks: 'MESAS',    letter: 'CARTA',
              archT:   'todas as edições publicadas',
              desksT:  'correspondentes que escrevem sob o nome saudade',
              letterT: 'escrever uma carta ao editor',
              tag:     'saudade · um anseio pelo que não pode voltar' },
        es: { archive: 'ARCHIVO',   desks: 'MESAS',    letter: 'CARTA',
              archT:   'todas las ediciones publicadas',
              desksT:  'corresponsales que escriben bajo el nombre saudade',
              letterT: 'escribir una carta al editor',
              tag:     'saudade · un anhelo por lo que no puede volver' }
    };

    function ensureFooter() {
        let f = document.getElementById('sddFooter');
        if (f) return f;
        const ed = (window.state && window.state.lang) || 'en';
        const c = FOOTER_COPY[ed] || FOOTER_COPY.en;
        f = document.createElement('footer');
        f.id = 'sddFooter';
        f.className = 'sdd-footer-rule';
        f.innerHTML = `
            <div class="sdd-footer-l">
                <span class="sdd-footer-page"></span>
                <span class="sdd-footer-section"></span>
            </div>
            <div class="sdd-footer-r">
                <a class="sdd-footer-link" href="/issues/" title="${c.archT}">${c.archive}</a>
                <a class="sdd-footer-link" href="desks.html" title="${c.desksT}">${c.desks}</a>
                <a class="sdd-footer-link" href="#letter" title="${c.letterT}">${c.letter}</a>
                <a class="sdd-footer-copy" href="etymology.html"
                   title="saudade /sɐwˈðaðɨ/">${c.tag}</a>
                <span class="sdd-footer-issue">© 2026</span>
            </div>
        `;
        document.body.appendChild(f);
        return f;
    }

    const COVER_LABEL = {
        en: 'ISSUE COVER', ko: '표지', ja: '表紙', pt: 'CAPA', es: 'PORTADA'
    };

    // 이슈 총 페이지 수 — 마스트헤드의 가장 큰 섹션 페이지에서 유도한다.
    // 예전엔 'OF 12' 로 하드코딩돼 § 03(P. 13) 이 불가능한 "P. 13 OF 12" 를
    // 렌더했다. 섹션이 늘어나도 항상 유효하도록 최대 페이지를 계산해 쓴다.
    function issueTotal() {
        const S = window.SAUDADE_MASTHEAD?.SECTIONS;
        let max = 12;
        if (S) for (const s of Object.values(S)) {
            const n = parseInt(String(s.page).replace(/\D/g, ''), 10);
            if (Number.isFinite(n) && n > max) max = n;
        }
        return String(max).padStart(2, '0');
    }

    function update() {
        const f = ensureFooter();
        const sec = document.body.getAttribute('data-section');
        const ed = (window.state && window.state.lang) || 'en';
        const SECTIONS = window.SAUDADE_MASTHEAD?.SECTIONS;
        if (sec && SECTIONS) {
            const matched = Object.values(SECTIONS).find(s => s.num === sec);
            if (matched) {
                // PR #81 changed `matched.name` from a flat string to a
                // {en,ko,ja,pt,es} map. This used to render "[object Object]".
                const name = (matched.name && typeof matched.name === 'object')
                    ? (matched.name[ed] || matched.name.en)
                    : matched.name;
                f.querySelector('.sdd-footer-page').textContent = matched.page + ' OF ' + issueTotal();
                f.querySelector('.sdd-footer-section').textContent = '§ ' + matched.num + ' · ' + name;
                return;
            }
        }
        f.querySelector('.sdd-footer-page').textContent = 'P. 01 OF ' + issueTotal();
        f.querySelector('.sdd-footer-section').textContent = '§ 00 · ' + (COVER_LABEL[ed] || COVER_LABEL.en);
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
