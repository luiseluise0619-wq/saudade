// saudade · modal focus trap (a11y)
//
// Watches every saudade modal class. When a modal becomes .active:
//   • record the previously-focused element
//   • move focus into the modal (first tabbable)
//   • intercept Tab / Shift+Tab so focus stays inside
// When the modal closes (.active removed) restore focus to the original.
//
// Selectors covered: every saudade-* modal class. New modals just need a
// .sdd-*-modal class with the .active toggle to opt in.
'use strict';

// IIFE — 로드 즉시 실행. 모달의 포커스 트랩(접근성): 열리면 안으로 포커스, Tab 을 안에 가둠, 닫히면 복원.
(function () {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_FOCUS) return;

    // MODAL_SELECTOR — 이 트랩이 감시할 모든 saudade 모달 클래스.
    const MODAL_SELECTOR = [
        '.sdd-auth-modal', '.sdd-acct-modal', '.sdd-welcome',
        '.sdd-homes-modal', '.sdd-let-modal', '.sdd-desk-modal',
        '.sdd-imp-modal', '.sdd-cb-modal'
    ].join(',');

    const TABBABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    // _previousFocus: 모달 열기 전 포커스였던 요소(닫을 때 복원). _activeModal: 현재 활성 모달.
    let _previousFocus = null;
    let _activeModal = null;

    // tabbablesIn — 모달 안에서 탭 이동 가능한(보이는) 요소 목록.
    function tabbablesIn(el) {
        return Array.from(el.querySelectorAll(TABBABLE))
            .filter(n => n.offsetParent !== null || n === document.activeElement);
    }

    // trapHandler — Tab/Shift+Tab 을 가로채 포커스가 모달 밖으로 나가지 않게 순환시킨다.
    function trapHandler(e) {
        if (e.key !== 'Tab' || !_activeModal) return;
        const tabs = tabbablesIn(_activeModal);
        if (!tabs.length) { e.preventDefault(); return; }
        const first = tabs[0];
        const last  = tabs[tabs.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first || !_activeModal.contains(document.activeElement)) {
                e.preventDefault(); last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        }
    }

    // watch — 모든 모달의 .active 토글을 감시해 열림/닫힘을 처리하고 Tab 트랩을 건다.
    function watch() {
        // Use a MutationObserver to detect class="active" toggles on any modal.
        const observer = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                const el = m.target;
                if (!el.matches(MODAL_SELECTOR)) continue;
                if (el.classList.contains('active')) {
                    if (_activeModal !== el) onOpen(el);
                } else if (_activeModal === el) {
                    onClose();
                }
            }
        });
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

        // Also catch modals that were already .active on first paint (rare).
        document.querySelectorAll(MODAL_SELECTOR + '.active').forEach(onOpen);

        document.addEventListener('keydown', trapHandler);
    }

    // onOpen — 모달이 열릴 때: 직전 포커스를 기억하고 닫기류가 아닌 첫 요소로 포커스 이동.
    function onOpen(el) {
        _previousFocus = document.activeElement;
        _activeModal = el;
        const tabs = tabbablesIn(el);
        // Prefer the first non-close button so a destructive close doesn't get
        // auto-focused; fall back to whatever is tabbable.
        const target = tabs.find(t => !/(\bclose\b|\bcancel\b|\bskip\b)/i.test(t.className + ' ' + (t.textContent || '')))
                    || tabs[0] || el;
        try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (ee) {} }
    }
    // onClose — 모달이 닫힐 때: 열기 전에 있던 요소로 포커스를 되돌린다.
    function onClose() {
        _activeModal = null;
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            try { _previousFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _previousFocus = null;
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 감시 시작.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();

    // 전역 공개 API — 현재 활성 모달 조회.
    window.SAUDADE_FOCUS = { _activeModal: () => _activeModal };
})();
