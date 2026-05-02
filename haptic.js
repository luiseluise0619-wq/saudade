// ═══════════════════════════════════════════════════════════════════════════
//  haptic.js — Android 햅틱 통일 헬퍼.
//  iOS 는 vibrate() 무시하지만 Android Chrome 에서 동작.
//  사용: haptic('light')  / haptic('success')
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const PATTERN = {
        light:   10,
        medium:  15,
        heavy:   25,
        success: [10, 30, 10],
        warn:    [12, 20, 12, 20, 12],
        error:   [25, 40, 25],
    };

    function haptic(kind) {
        const p = PATTERN[kind] != null ? PATTERN[kind] : 10;
        try {
            if (navigator.vibrate) navigator.vibrate(p);
        } catch (e) {
            window.AURA?.dbgWarn?.('haptic', e);
        }
    }

    // tappable 클래스 자동 햅틱 (사용자: '모든 버튼 탭 → vibrate')
    document.addEventListener('click', (ev) => {
        const t = ev.target;
        if (!t || !t.closest) return;
        const el = t.closest('.tappable, .dock-btn, .topbar-btn, .icon-btn, .stage-btn');
        if (!el) return;
        if (el.dataset.hapticOff === '1') return;
        haptic(el.dataset.haptic || 'light');
    }, { passive: true });

    window.haptic = haptic;
    window.AURA_HAPTIC = { haptic, PATTERN };
})();
