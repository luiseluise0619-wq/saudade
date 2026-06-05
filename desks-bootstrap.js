// desks-bootstrap.js — kicks SAUDADE_DESKS.renderIndex() on the /desks
// page. Lives external because the page CSP disallows inline scripts.
(function () {
    'use strict';
    function start() {
        setTimeout(function () {
            if (window.SAUDADE_DESKS && window.SAUDADE_DESKS.renderIndex) {
                window.SAUDADE_DESKS.renderIndex('#sddDesksHost');
            }
        }, 80);
    }
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
