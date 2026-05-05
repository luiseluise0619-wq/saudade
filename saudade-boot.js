// saudade · boot helpers
//
// Extracted from the legacy AURA: World Pulse modules removed in v649:
//   app.js (213 KB)         → showToast, hideLoading, last-screen restore
//   perf-throttle.js (6 KB) → visibilitychange pause/resume for intervals
//   aura-common.js (18 KB)  → debounce / throttle / safe storage
//   haptic.js (2 KB)        → vibrate-on-tap (subtle mobile feedback)
//
// Bundles to ~5 KB. Replaces ~239 KB of legacy. Every saudade-* module can
// now rely on these helpers without re-implementing.
//
// Public API:
//   window.SAUDADE_TOAST(message, type?, duration_ms?)
//   window.SAUDADE_BOOT.fadeLoadingOverlay()
//   window.SAUDADE_BOOT.ready                 — resolves when paintable
//   window.SAUDADE_BOOT.debounce(fn, wait)
//   window.SAUDADE_BOOT.throttle(fn, wait)
//   window.SAUDADE_BOOT.pausableInterval(fn, ms) → { cancel }
//                                             auto-pauses when tab hidden
//   window.SAUDADE_BOOT.haptic('tap'|'success'|'error')
//   window.SAUDADE_BOOT.lastSection() / rememberSection(sec)
'use strict';

(function () {
    if (window.SAUDADE_BOOT) return;

    // ─── Toast ───────────────────────────────────────────────────────────
    let _toastTimer = null;
    function toast(message, type, dur) {
        const el = document.getElementById('toast');
        if (!el) return;
        clearTimeout(_toastTimer);
        el.className = 'toast toast-' + (type || 'ok');
        el.textContent = String(message == null ? '' : message).slice(0, 200);
        // double rAF — let the browser paint the cleared element first so
        // the .show transition actually animates in. Same pattern app.js used.
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
        _toastTimer = setTimeout(() => el.classList.remove('show'), dur || 2600);
    }
    window.SAUDADE_TOAST = toast;

    // ─── Loading overlay ────────────────────────────────────────────────
    function fadeLoadingOverlay() {
        const ov = document.getElementById('loadingOverlay');
        if (!ov || ov.classList.contains('fade-out')) return;
        ov.classList.add('fade-out');
        setTimeout(() => { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 600);
    }

    // ─── Last-section restore ───────────────────────────────────────────
    // app.js used to remember which section the user was on across reloads.
    // Saudade has saudade-masthead.js doing this already (saudade.last.screen
    // localStorage key). We just expose a helper for any module that wants it.
    function lastSection() {
        try { return localStorage.getItem('saudade.last.screen') || null; }
        catch (e) { return null; }
    }
    function rememberSection(sec) {
        try { localStorage.setItem('saudade.last.screen', sec); }
        catch (e) {}
    }

    // ─── Online / offline body class — small but helpful ──────────────
    function watchOnline() {
        const apply = () => document.body.classList.toggle('saudade-offline', !navigator.onLine);
        apply();
        window.addEventListener('online', apply);
        window.addEventListener('offline', apply);
    }

    // ─── 1-second clock for any element with [data-saudade-clock] ──────
    function tickClock() {
        const els = document.querySelectorAll('[data-saudade-clock]');
        if (!els.length) return;
        const now = new Date();
        const text = now.toISOString().slice(11, 16) + ' UTC';
        els.forEach(el => { el.textContent = text; });
    }

    // ─── Ready promise: resolves on cover-rendered event or 1.5s ──────
    let _resolveReady;
    const ready = new Promise(resolve => { _resolveReady = resolve; });
    function markReady(reason) {
        fadeLoadingOverlay();
        if (_resolveReady) { _resolveReady(reason); _resolveReady = null; }
    }
    window.addEventListener('sdd-cover-rendered', () => markReady('cover'), { once: true });

    // ─── Boot ───────────────────────────────────────────────────────────
    function boot() {
        watchOnline();
        // Clock — only run if at least one consumer element exists (cheap).
        if (document.querySelector('[data-saudade-clock]')) {
            tickClock();
            setInterval(tickClock, 60000);
        }
        // Backstops — fade overlay even if no cover-rendered event arrives.
        setTimeout(() => markReady('domcontentloaded'), 1500);
        setTimeout(() => markReady('hard-backstop'),   4000);
        // v654 — lazy-load quarterly-dispatch only when user navigates to it.
        // Saves 32 KB on every cold load for the 99% of visits that never see #02b.
        function maybeLoadQuarterly() {
            if (location.hash !== '#02b') return;
            if (window.SAUDADE_QUARTERLY) return;
            if (document.querySelector('script[data-lazy="quarterly"]')) return;
            const s = document.createElement('script');
            s.src = 'saudade-quarterly-dispatch.js?v=v654';
            s.defer = true;
            s.dataset.lazy = 'quarterly';
            document.head.appendChild(s);
        }
        window.addEventListener('hashchange', maybeLoadQuarterly);
        maybeLoadQuarterly();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else { boot(); }

    // ─── debounce / throttle (from aura-common.js) ────────────────────
    function debounce(fn, wait) {
        wait = wait || 250;
        let t = null;
        return function () {
            const args = arguments, ctx = this;
            clearTimeout(t);
            t = setTimeout(() => fn.apply(ctx, args), wait);
        };
    }
    function throttle(fn, wait) {
        wait = wait || 250;
        let last = 0, pending = null;
        return function () {
            const now = Date.now(), args = arguments, ctx = this;
            const remaining = wait - (now - last);
            if (remaining <= 0) {
                if (pending) { clearTimeout(pending); pending = null; }
                last = now;
                fn.apply(ctx, args);
            } else if (!pending) {
                pending = setTimeout(() => {
                    last = Date.now(); pending = null;
                    fn.apply(ctx, args);
                }, remaining);
            }
        };
    }

    // ─── pausable interval (from perf-throttle.js) ─────────────────────
    // setInterval that auto-pauses when the tab goes hidden + resumes when
    // visible. Saves battery + reduces phone heat. Saudade-cover uses a
    // 60s D-day re-render — wrap that with this.
    const _intervals = new Set();
    function pausableInterval(fn, ms) {
        const entry = { fn, ms, id: null, paused: false };
        function start() {
            if (entry.id != null) return;
            entry.id = setInterval(fn, ms);
        }
        function stop() {
            if (entry.id == null) return;
            clearInterval(entry.id);
            entry.id = null;
        }
        if (!document.hidden) start();
        _intervals.add(entry);
        return {
            cancel() { stop(); _intervals.delete(entry); }
        };
    }
    document.addEventListener('visibilitychange', () => {
        const hidden = document.hidden;
        _intervals.forEach(e => {
            if (hidden) {
                if (e.id != null) { clearInterval(e.id); e.id = null; e.paused = true; }
            } else {
                if (e.paused && e.id == null) { e.id = setInterval(e.fn, e.ms); e.paused = false; }
            }
        });
    });

    // ─── haptic (from haptic.js) ───────────────────────────────────────
    // Short vibration on tap. Many phones ignore unless the gesture is
    // user-initiated; we degrade silently when unsupported.
    function haptic(kind) {
        if (!navigator.vibrate) return;
        try {
            if (kind === 'success')      navigator.vibrate([6, 24, 6]);
            else if (kind === 'error')   navigator.vibrate([20, 40, 20]);
            else                          navigator.vibrate(8);   // 'tap' default
        } catch (e) {}
    }

    // ─── currentEd helper ──────────────────────────────────────────────
    // ~25 modules read the active edition the same way:
    //   const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
    // Centralised so a future edition rename touches one line.
    function currentEd() {
        try {
            return (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        } catch (e) { return 'en'; }
    }

    window.SAUDADE_BOOT = {
        fadeLoadingOverlay,
        lastSection,
        rememberSection,
        ready,
        debounce,
        throttle,
        pausableInterval,
        haptic,
        currentEd
    };
})();
