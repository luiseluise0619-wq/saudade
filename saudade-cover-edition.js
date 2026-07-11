// SAUDADE · v8 §02 — Cover edition switcher (top-right discrete dropdown)
// 5 에디션 (en/ko/ja/pt/es). Cover 에서만 노출 — 섹션 진입 시 hide.
// SAUDADE_EDITION 모듈을 호출하여 전환 — 기존 Desk 의 Editions 섹션과 동일 source.
'use strict';

// IIFE — 로드 즉시 실행. 표지 우상단의 에디션(언어) 전환 드롭다운 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_COVER_EDITION) return;

    // EDITIONS — 5개 에디션 코드와 표시 라벨.
    const EDITIONS = [
        { code: 'en', label: 'English' },
        { code: 'ko', label: '한국어' },
        { code: 'ja', label: '日本語' },
        { code: 'pt', label: 'Português' },
        { code: 'es', label: 'Español' }
    ];

    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // currentEd — 현재 에디션 코드(소문자).
    function currentEd() {
        return (window.SAUDADE_EDITION?.get?.() || 'en').toLowerCase();
    }

    // 드롭다운 DOM 캐시(한 번 만들어 재사용).
    let _el = null;
    // ensureEl — <details> 기반 드롭다운 요소를 한 번만 만든다.
    function ensureEl() {
        if (_el && document.body.contains(_el)) return _el;
        _el = document.createElement('details');
        _el.className = 'sdd-cover-edition';
        _el.setAttribute('aria-label', 'Edition');
        document.body.appendChild(_el);
        return _el;
    }

    // render — 현재 에디션을 요약에 표시하고 목록 클릭 시 에디션을 전환한다.
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

    // init — 첫 렌더 + 다른 곳에서 에디션이 바뀌면 드롭다운도 갱신.
    function init() {
        render();
        // edition 변경 (다른 곳에서) 감지
        const mo = new MutationObserver(() => render());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 드롭다운 렌더.
    window.SAUDADE_COVER_EDITION = { render };
})();
