// saudade · footer legal menu toggle + footer link wiring
//
// Extracted from an inline <script> in index.html (CSP compliance — the page
// runs script-src 'self' https:; no unsafe-inline).
//
// Wires three footer affordances:
//   #auraLegalToggle   — toggles the legal flyout
//   #auraConsentLink   — opens consent settings (AURA_CONSENT, still loaded)
//   #auraAddCityLink   — opens the homes modal (SAUDADE_HOMES)
'use strict';

(function () {
    function init() {
        var toggle = document.getElementById('auraLegalToggle');
        var menu   = document.getElementById('auraLegalMenu');
        if (toggle && menu) {
            toggle.addEventListener('click', function () {
                var open = !menu.hasAttribute('hidden');
                if (open) {
                    menu.setAttribute('hidden', '');
                    toggle.setAttribute('aria-expanded', 'false');
                } else {
                    menu.removeAttribute('hidden');
                    toggle.setAttribute('aria-expanded', 'true');
                }
                // Visual state handled by .sdd-legal-toggle CSS via the
                // aria-expanded selector. No inline style mutation needed.
            });
        }
        var consent = document.getElementById('auraConsentLink');
        if (consent) {
            consent.addEventListener('click', function (e) {
                e.preventDefault();
                if (window.AURA_CONSENT && window.AURA_CONSENT.openSettings) {
                    window.AURA_CONSENT.openSettings();
                }
            });
        }
        // "+ MY CITY" was wired to a removed AURA module. Repoint at the
        // saudade homes modal so the link does what it says.
        var addCity = document.getElementById('auraAddCityLink');
        if (addCity) {
            addCity.addEventListener('click', function (e) {
                e.preventDefault();
                if (window.SAUDADE_HOMES && window.SAUDADE_HOMES.openModal) {
                    window.SAUDADE_HOMES.openModal();
                } else if (window.SAUDADE_CONTRIBUTE && window.SAUDADE_CONTRIBUTE.openCity) {
                    window.SAUDADE_CONTRIBUTE.openCity();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
