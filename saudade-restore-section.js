// saudade · restore last section before first paint
//
// Sync-loaded in <head> so the body picks up data-section before any CSS
// paints — prevents the cover→section "double load" flash a user reported.
// Extracted from an inline <script> in index.html so the page's CSP can stay
// strict (script-src 'self' https:; no unsafe-inline).
'use strict';

// IIFE — <head>에서 동기 로드. 첫 페인트 전에 마지막 섹션을 복원해 "표지→섹션" 깜빡임을 막는다.
(function () {
    try {
        // 마지막으로 보던 화면을 읽어 유효한 섹션이면 body 에 data-section 을 미리 세팅.
        var last = localStorage.getItem('saudade.last.screen');
        var sections = { visa: '01', cafe: '02', tz: '03', trip: '04' };
        if (!last || !sections[last]) return;
        if (document.body) {
            document.body.classList.add('section-active');
            document.body.setAttribute('data-section', sections[last]);
        } else {
            // body 가 아직 없으면 <html> 에 임시 표시 후 DOMContentLoaded 에서 본체에 반영.
            document.documentElement.setAttribute('data-pending-section', sections[last]);
            document.addEventListener('DOMContentLoaded', function () {
                var sec = document.documentElement.getAttribute('data-pending-section');
                if (sec && !document.body.classList.contains('section-active')) {
                    document.body.classList.add('section-active');
                    document.body.setAttribute('data-section', sec);
                }
                document.documentElement.removeAttribute('data-pending-section');
            });
        }
    } catch (e) {}
})();
