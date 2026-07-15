// SAUDADE · THEME SWITCHER
// 4 themes: auto / paper / saturated / dark.
// 'auto' = ISO-week rotation + prefers-color-scheme (the default).
// User pick persists in localStorage via SAUDADE_EDITION.setSkin().
// Mounted as a dropdown next to the legal-strip MENU, bottom-left.
'use strict';

(function () {
    if (window.SAUDADE_THEME_SWITCH) return;

    const T_LABEL = {
        auto:      { en: 'AUTO',    ko: '자동',  ja: '自動',     pt: 'AUTO',   es: 'AUTO' },
        paper:     { en: 'PAPER',   ko: '종이',  ja: '紙',       pt: 'PAPEL',  es: 'PAPEL' },
        saturated: { en: 'COVER',   ko: '표지',  ja: '表紙',     pt: 'CAPA',   es: 'TAPA' },
        dark:      { en: 'NIGHT',   ko: '밤',    ja: '夜',       pt: 'NOITE',  es: 'NOCHE' }
    };
    const ORDER = ['auto', 'paper', 'saturated', 'dark'];

    function T(strings) {
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return strings[ed] || strings.en;
    }
    function label(skin) { return T(T_LABEL[skin] || T_LABEL.auto); }

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
.sdd-theme-wrapper {
    position: fixed;
    top: calc(clamp(16px, 2vw, 24px) + 46px);
    right: clamp(16px, 2vw, 24px);
    /* 커버(z-index 4)·섹션 페이지(8) 위로 올려 클릭이 가로막히지 않게.
       모달(50+)보다는 아래라 모달이 뜨면 정상적으로 덮인다. */
    z-index: 10;
    display: inline-flex;
    align-items: center;
}
.sdd-theme-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
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
body.cafe-mode .sdd-theme-wrapper,
body.listening-active .sdd-theme-wrapper { display: none; }
`;
        document.head.appendChild(s);
    }

    function ensureMount() {
        // v750 — the legal strip that used to host this was hidden globally
        // ('투어가이드 요청'으로 좌하단 LEGAL pill 삭제), which left the theme
        // toggle 0×0 and unusable. Mount as a standalone fixed control instead,
        // stacked just under the cover edition switcher (top-right), so it is
        // visible on the cover AND on section pages.
        let wrapper = document.querySelector('.sdd-theme-wrapper');
        if (wrapper && document.body.contains(wrapper)) return wrapper;
        wrapper = document.createElement('span');
        wrapper.className = 'sdd-theme-wrapper';

        const cur = window.SAUDADE_EDITION?.skinPref?.() || 'auto';
        wrapper.innerHTML = `
            <button type="button" class="sdd-theme-toggle" aria-haspopup="menu" aria-expanded="false" aria-label="Theme">
                <span class="sdd-theme-toggle-mark" aria-hidden="true">◐</span>
                <span class="sdd-theme-toggle-label">${label(cur)}</span>
            </button>
            <div class="sdd-theme-menu" role="menu" hidden></div>
        `;
        document.body.appendChild(wrapper);
        return wrapper;
    }

    function renderMenu(wrapper) {
        const menu = wrapper.querySelector('.sdd-theme-menu');
        const cur = window.SAUDADE_EDITION?.skinPref?.() || 'auto';
        menu.innerHTML = ORDER.map(s =>
            `<button type="button" class="sdd-theme-opt" role="menuitem" data-skin="${s}" aria-current="${s === cur}">${label(s)}</button>`
        ).join('');
        wrapper.querySelector('.sdd-theme-toggle-label').textContent = label(cur);
    }

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

    function init() {
        injectStyles();
        const w = ensureMount();
        if (!w) return;
        renderMenu(w);
        bind(w);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-render label when edition changes (so labels translate)
    window.addEventListener('storage', (e) => {
        if (e.key === 'saudade.edition') {
            const w = document.querySelector('.sdd-theme-wrapper');
            if (w) renderMenu(w);
        }
    });

    window.SAUDADE_THEME_SWITCH = { init };
})();
