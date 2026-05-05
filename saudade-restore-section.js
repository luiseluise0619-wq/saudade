// saudade · restore last section before first paint
//
// Sync-loaded in <head> so the body picks up data-section before any CSS
// paints — prevents the cover→section "double load" flash a user reported.
// Extracted from an inline <script> in index.html so the page's CSP can stay
// strict (script-src 'self' https:; no unsafe-inline).
'use strict';

(function () {
    try {
        var last = localStorage.getItem('saudade.last.screen');
        var sections = { visa: '01', cafe: '02', tz: '03', trip: '04' };
        if (!last || !sections[last]) return;
        if (document.body) {
            document.body.classList.add('section-active');
            document.body.setAttribute('data-section', sections[last]);
        } else {
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
