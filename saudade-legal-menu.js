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

// IIFE — 로드 즉시 실행. 푸터의 법적 메뉴 토글 + 동의/도시추가 링크를 배선하는 모듈.
// (index.html 인라인 스크립트에서 분리 — CSP 로 인라인 스크립트 금지.)
(function () {
    // init — 세 가지 푸터 요소(법적 토글/동의 링크/내 도시 링크)에 핸들러를 건다.
    function init() {
        var toggle = document.getElementById('auraLegalToggle');
        var menu   = document.getElementById('auraLegalMenu');
        // 법적 메뉴 토글 — hidden 속성을 껐다 켜며 aria-expanded 도 동기화(접근성).
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
        // 동의 링크 — 동의 설정 화면을 연다.
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
        // "+ 내 도시" 링크 — 홈 도시 모달(없으면 기여 모달)을 연다.
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
