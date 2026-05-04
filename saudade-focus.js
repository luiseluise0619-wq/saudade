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

(function () {
    if (window.SAUDADE_FOCUS) return;

    const MODAL_SELECTOR = [
        '.sdd-auth-modal', '.sdd-acct-modal', '.sdd-welcome',
        '.sdd-homes-modal', '.sdd-let-modal', '.sdd-desk-modal',
        '.sdd-imp-modal'
    ].join(',');

    const TABBABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    let _previousFocus = null;
    let _activeModal = null;

    function tabbablesIn(el) {
        return Array.from(el.querySelectorAll(TABBABLE))
            .filter(n => n.offsetParent !== null || n === document.activeElement);
    }

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
    function onClose() {
        _activeModal = null;
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            try { _previousFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _previousFocus = null;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();

    window.SAUDADE_FOCUS = { _activeModal: () => _activeModal };
})();
