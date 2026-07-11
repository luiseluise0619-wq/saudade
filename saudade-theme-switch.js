// SAUDADE · THEME SWITCHER
// 4 themes: auto / paper / saturated / dark.
// 'auto' = ISO-week rotation + prefers-color-scheme (the default).
// User pick persists in localStorage via SAUDADE_EDITION.setSkin().
// Mounted as a dropdown next to the legal-strip MENU, bottom-left.
'use strict';

// IIFE — 로드 즉시 실행. 테마(auto/paper/saturated/dark) 전환 드롭다운 모듈.
(function () {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_THEME_SWITCH) return;

    // T_LABEL/ORDER — 각 테마의 다국어 라벨과 표시 순서.
    const T_LABEL = {
        auto:      { en: 'AUTO',    ko: '자동',  ja: '自動',     pt: 'AUTO',   es: 'AUTO' },
        paper:     { en: 'PAPER',   ko: '종이',  ja: '紙',       pt: 'PAPEL',  es: 'PAPEL' },
        saturated: { en: 'COVER',   ko: '표지',  ja: '表紙',     pt: 'CAPA',   es: 'TAPA' },
        dark:      { en: 'NIGHT',   ko: '밤',    ja: '夜',       pt: 'NOITE',  es: 'NOCHE' }
    };
    const ORDER = ['auto', 'paper', 'saturated', 'dark'];

    // T — 현재 에디션 언어 문자열 선택(없으면 영어).
    function T(strings) {
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return strings[ed] || strings.en;
    }
    // label — 테마 코드의 현재 언어 라벨.
    function label(skin) { return T(T_LABEL[skin] || T_LABEL.auto); }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddThemeStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddThemeStyles';
        s.textContent = `
.sdd-theme-toggle {
    all: unset;
    cursor: pointer;
    height: 30px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--paper);
    border: 0.5px solid var(--rule);
    border-radius: 4px;
    color: var(--bone-d);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--tr-mono-meta, .24em);
    text-transform: uppercase;
    transition: color .15s, border-color .15s;
}
.sdd-theme-toggle:hover {
    color: var(--accent);
    border-color: var(--accent);
}
.sdd-theme-toggle:focus-visible {
    outline: 1.5px solid var(--accent);
    outline-offset: 2px;
}
.sdd-theme-toggle-mark {
    font-family: var(--serif);
    font-style: italic;
    font-size: 12px;
    color: var(--accent);
    line-height: 1;
}
.sdd-theme-menu {
    position: absolute;
    bottom: 36px;
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 4px;
    background: var(--paper);
    border: 0.5px solid var(--rule-2);
    border-radius: 4px;
    min-width: 120px;
    z-index: 1600;
}
.sdd-theme-menu[hidden] { display: none; }
.sdd-theme-opt {
    all: unset;
    cursor: pointer;
    padding: 10px 14px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--tr-mono-meta, .24em);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-theme-opt:hover { color: var(--ink); background: var(--paper-d); }
.sdd-theme-opt[aria-current="true"] { color: var(--accent); }
.sdd-theme-opt[aria-current="true"]::after { content: ' ·'; }
body.listening-active .sdd-theme-wrapper { display: none; }
`;
        document.head.appendChild(s);
    }

    // ensureMount — 하단 법적 스트립 안에 테마 토글 버튼 + 메뉴를 한 번만 만든다.
    function ensureMount() {
        // Mount inside the legal strip if present, otherwise next to it.
        const strip = document.getElementById('auraLegalStrip');
        if (!strip) return null;
        let wrapper = strip.querySelector('.sdd-theme-wrapper');
        if (wrapper) return wrapper;
        wrapper = document.createElement('span');
        wrapper.className = 'sdd-theme-wrapper';
        wrapper.style.cssText = 'position:relative;display:inline-flex;align-items:center';

        const cur = window.SAUDADE_EDITION?.skinPref?.() || 'auto';
        wrapper.innerHTML = `
            <button type="button" class="sdd-theme-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="Theme">
                <span class="sdd-theme-toggle-mark" aria-hidden="true">◐</span>
                <span class="sdd-theme-toggle-label">${label(cur)}</span>
            </button>
            <div class="sdd-theme-menu" role="menu" hidden></div>
        `;
        strip.appendChild(wrapper);
        return wrapper;
    }

    // renderMenu — 테마 옵션 목록을 그리고 현재 선택을 강조, 토글 라벨도 갱신.
    function renderMenu(wrapper) {
        const menu = wrapper.querySelector('.sdd-theme-menu');
        const cur = window.SAUDADE_EDITION?.skinPref?.() || 'auto';
        menu.innerHTML = ORDER.map(s =>
            `<button type="button" class="sdd-theme-opt" role="menuitem" data-skin="${s}" aria-current="${s === cur}">${label(s)}</button>`
        ).join('');
        wrapper.querySelector('.sdd-theme-toggle-label').textContent = label(cur);
    }

    // bind — 토글 클릭으로 메뉴 열고/닫기, 바깥 클릭 시 닫기, 옵션 클릭 시 테마 적용.
    function bind(wrapper) {
        const toggle = wrapper.querySelector('.sdd-theme-toggle');
        const menu   = wrapper.querySelector('.sdd-theme-menu');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !menu.hasAttribute('hidden');
            menu.toggleAttribute('hidden');
            toggle.setAttribute('aria-expanded', String(!open));
        });
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                menu.setAttribute('hidden', '');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
        menu.addEventListener('click', (e) => {
            const b = e.target.closest('.sdd-theme-opt');
            if (!b) return;
            const skin = b.getAttribute('data-skin');
            window.SAUDADE_EDITION?.setSkin?.(skin);
            renderMenu(wrapper);
            menu.setAttribute('hidden', '');
            toggle.setAttribute('aria-expanded', 'false');
        });
    }

    // init — 스타일 주입 + 마운트 + 메뉴 렌더 + 이벤트 배선.
    function init() {
        injectStyles();
        const w = ensureMount();
        if (!w) return;
        renderMenu(w);
        bind(w);
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 다른 탭에서 에디션이 바뀌면(storage 이벤트) 라벨을 새 언어로 다시 렌더.
    // Re-render label when edition changes (so labels translate)
    window.addEventListener('storage', (e) => {
        if (e.key === 'saudade.edition') {
            const w = document.querySelector('.sdd-theme-wrapper');
            if (w) renderMenu(w);
        }
    });

    window.SAUDADE_THEME_SWITCH = { init };
})();
