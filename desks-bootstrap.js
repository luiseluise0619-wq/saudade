// desks-bootstrap.js — kicks SAUDADE_DESKS.renderIndex() on the /desks
// page. Lives external because the page CSP disallows inline scripts.
// IIFE — 로드 즉시 실행. /desks 페이지에서 데스크 목록 렌더를 띄우는 부트스트랩.
// (페이지 CSP 가 인라인 스크립트를 막아서 별도 파일로 분리됨.)
(function () {
    'use strict';
    // start — SAUDADE_DESKS 모듈이 준비되면 목록을 그린다(80ms 지연으로 모듈 로드 여유).
    function start() {
        setTimeout(function () {
            if (window.SAUDADE_DESKS && window.SAUDADE_DESKS.renderIndex) {
                window.SAUDADE_DESKS.renderIndex('#sddDesksHost');
            }
        }, 80);
    }
    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 실행.
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
