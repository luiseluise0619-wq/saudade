// SAUDADE · WORDMARK (헌법 §5)
// 신규 컴포넌트. 4 variant 인라인 SVG. 기존 JS 손 안 댐.
// 사용:
//   <span data-saudade-wordmark="full"></span>   // ≥24px (마스트헤드)
//   <span data-saudade-wordmark="small"></span>  // 14-24px (헤더)
//   <span data-saudade-wordmark="icon"></span>   // 60-120px (앱 아이콘)
//   <span data-saudade-wordmark="favicon"></span>// 16-32px (탭)
'use strict';

// IIFE — 로드 즉시 실행. "saudade" 워드마크(로고)를 4가지 변형 인라인 SVG 로 렌더하는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_WORDMARK) return;

    // SVG — 변형(full/small/icon/favicon)별 인라인 SVG 문자열. 외부 아이콘 라이브러리 대신.
    const SVG = {
        full:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160" aria-label="saudade">' +
            '<text x="0" y="120" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="300" font-size="140" letter-spacing="-6" fill="currentColor">saudade</text>' +
            '<circle cx="345" cy="92" r="10" fill="none" stroke="#9A3324" stroke-width="1"/>' +
            '</svg>',
        small:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 56" aria-label="saudade">' +
            '<text x="0" y="42" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="300" font-size="48" letter-spacing="-1.5" fill="currentColor">saudade</text>' +
            '<circle cx="118" cy="32" r="4" fill="none" stroke="#9A3324" stroke-width="1.5"/>' +
            '</svg>',
        icon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-label="saudade icon">' +
            '<circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" stroke-width="1"/>' +
            '<circle cx="60" cy="60" r="18" fill="none" stroke="#9A3324" stroke-width="1.2"/>' +
            '<text x="60" y="78" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="300" font-size="48" letter-spacing="-2" fill="currentColor">s</text>' +
            '</svg>',
        favicon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-label="saudade">' +
            '<rect width="32" height="32" fill="#F2EEE3"/>' +
            '<circle cx="16" cy="16" r="12" fill="none" stroke="#16151A" stroke-width="1"/>' +
            '<circle cx="16" cy="16" r="6" fill="none" stroke="#9A3324" stroke-width="1.2"/>' +
            '</svg>'
    };

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddWordmarkStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWordmarkStyles';
        s.textContent = `
[data-saudade-wordmark] {
    display: inline-block;
    line-height: 0;
    color: var(--ink);
    cursor: pointer;
}
[data-saudade-wordmark] svg {
    width: auto;
    height: 1em;
    fill: currentColor;
}
[data-saudade-wordmark="full"] svg    { height: 1.4em; }
[data-saudade-wordmark="small"] svg   { height: 1.2em; }
[data-saudade-wordmark="icon"] svg    { height: 60px; width: 60px; }
[data-saudade-wordmark="favicon"] svg { height: 16px; width: 16px; }
[data-saudade-wordmark]:hover { color: var(--rust); }
`;
        document.head.appendChild(s);
    }

    // render — data-saudade-wordmark 속성의 변형에 맞는 SVG 를 노드에 넣는다(한 번만).
    function render(node) {
        const variant = node.getAttribute('data-saudade-wordmark') || 'small';
        const svg = SVG[variant] || SVG.small;
        if (node.dataset.sddRendered === '1') return;
        node.innerHTML = svg;
        node.dataset.sddRendered = '1';
    }

    // renderAll — 페이지의 모든 워드마크 자리표시자를 렌더.
    function renderAll() {
        document.querySelectorAll('[data-saudade-wordmark]').forEach(render);
    }

    // init — 스타일 주입 + 전체 렌더 + 동적으로 추가되는 노드도 자동 렌더(MutationObserver).
    function init() {
        injectStyles();
        renderAll();
        // 동적으로 추가된 노드도 자동 렌더
        const mo = new MutationObserver(renderAll);
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — SVG 정의 + 개별/전체 렌더.
    window.SAUDADE_WORDMARK = { SVG, render, renderAll };
})();
