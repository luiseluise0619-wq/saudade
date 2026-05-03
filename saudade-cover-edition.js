// SAUDADE · v8 §02 — Cover edition switcher (top-right discrete dropdown)
// 5 에디션 (en/ko/ja/pt/es). Cover 에서만 노출 — 섹션 진입 시 hide.
// SAUDADE_EDITION 모듈을 호출하여 전환 — 기존 Desk 의 Editions 섹션과 동일 source.
'use strict';

(function() {
    if (window.SAUDADE_COVER_EDITION) return;

    const EDITIONS = [
        { code: 'en', label: 'English' },
        { code: 'ko', label: '한국어' },
        { code: 'ja', label: '日本語' },
        { code: 'pt', label: 'Português' },
        { code: 'es', label: 'Español' }
    ];

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function currentEd() {
        return (window.SAUDADE_EDITION?.get?.() || 'en').toLowerCase();
    }

    let _el = null;
    function ensureEl() {
        if (_el && document.body.contains(_el)) return _el;
        _el = document.createElement('details');
        _el.className = 'sdd-cover-edition';
        _el.setAttribute('aria-label', 'Edition');
        document.body.appendChild(_el);
        return _el;
    }

    function render() {
        const ed = currentEd();
        const cur = EDITIONS.find(e => e.code === ed) || EDITIONS[0];
        const el = ensureEl();
        el.innerHTML = `
            <summary>${escapeHtml(cur.code.toUpperCase())}</summary>
            <ul class="sdd-cover-edition-list">
                ${EDITIONS.map(e => `
                    <li><button type="button" class="sdd-cover-edition-opt"
                                data-cover-ed="${escapeHtml(e.code)}"
                                aria-current="${e.code === ed}">${escapeHtml(e.label)}</button></li>
                `).join('')}
            </ul>
        `;
        el.querySelectorAll('[data-cover-ed]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-cover-ed');
                if (window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
                el.removeAttribute('open');
                render();
            });
        });
    }

    function init() {
        render();
        // edition 변경 (다른 곳에서) 감지
        const mo = new MutationObserver(() => render());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_COVER_EDITION = { render };
})();
