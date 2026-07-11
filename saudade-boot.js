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
// ═══════════════════════════════════════════════════════════════════════
// [파일 역할 배너 — 초보자 안내]
// saudade-boot.js = 여러 모듈이 공용으로 쓰는 "부팅 + 유틸리티" 모음.
// 옛 대형 파일들에서 꼭 필요한 것만 추려 ~5KB 로 묶었다. 제공하는 도구:
//   - 토스트(잠깐 뜨는 알림), 로딩 오버레이 제거, ready 약속(화면 준비 완료 신호)
//   - debounce/throttle(이벤트 호출 빈도 조절), pausableInterval(탭 숨으면 멈추는 타이머)
//   - haptic(탭 진동), currentEd(현재 판 읽기)
// 다른 모듈은 window.SAUDADE_BOOT.xxx 로 이 도구들을 쓴다.
// ═══════════════════════════════════════════════════════════════════════
'use strict';

// IIFE + 중복 로드 가드.
(function () {
    if (window.SAUDADE_BOOT) return;

    // ─── Toast ───────────────────────────────────────────────────────────
    // toast: 화면 아래 잠깐 떴다 사라지는 알림 메시지.
    let _toastTimer = null;
    function toast(message, type, dur) {
        // 'toast' 라는 id 요소가 없으면 아무것도 안 함.
        const el = document.getElementById('toast');
        if (!el) return;
        // 이전 타이머 취소(연속 호출 시 겹침 방지).
        clearTimeout(_toastTimer);
        el.className = 'toast toast-' + (type || 'ok');
        // 너무 긴 메시지는 200자로 자름.
        el.textContent = String(message == null ? '' : message).slice(0, 200);
        // double rAF — let the browser paint the cleared element first so
        // the .show transition actually animates in. Same pattern app.js used.
        // requestAnimationFrame 을 두 번 겹쳐, 브라우저가 먼저 한 프레임 그린 뒤
        // 'show' 클래스를 붙여야 CSS 전환(애니메이션)이 제대로 재생된다.
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
        // dur(기본 2600ms) 뒤 자동으로 숨김.
        _toastTimer = setTimeout(() => el.classList.remove('show'), dur || 2600);
    }
    // 전역으로 노출 — 어디서든 SAUDADE_TOAST('저장됨') 처럼 호출.
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
    // ready = "화면이 그려질 준비가 됐다"를 알리는 약속(Promise). 다른 코드가 await 로 기다린다.
    // _resolveReady 를 나중에 호출하면 그 약속이 완료(resolve)된다.
    let _resolveReady;
    const ready = new Promise(resolve => { _resolveReady = resolve; });
    // markReady: 로딩 오버레이를 지우고 ready 약속을 완료. 한 번만 효과가 있게 _resolveReady 를 비운다.
    function markReady(reason) {
        fadeLoadingOverlay();
        if (_resolveReady) { _resolveReady(reason); _resolveReady = null; }
    }
    // 표지가 그려졌다는 이벤트가 오면 준비 완료로 표시. once:true = 한 번만 듣고 자동 해제.
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
    // debounce: 연달아 호출되면 "마지막 호출 후 wait 만큼 잠잠할 때" 딱 한 번 실행.
    // 예: 검색창 타이핑이 멈춘 뒤에만 검색 실행 → 불필요한 반복 호출 절약.
    function debounce(fn, wait) {
        wait = wait || 250;
        let t = null;
        // 반환되는 함수가 실제로 여기저기서 호출되는 "감싼" 함수.
        return function () {
            // arguments/this 를 보관해 원래 함수에 그대로 넘긴다.
            const args = arguments, ctx = this;
            // 이전 예약을 취소하고 새로 예약 → 계속 호출되면 계속 미뤄진다.
            clearTimeout(t);
            t = setTimeout(() => fn.apply(ctx, args), wait);
        };
    }
    // throttle: 아무리 자주 불러도 "wait 간격에 최대 한 번"만 실행(스크롤/리사이즈 등에 유용).
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
    // _intervals = 현재 살아있는 반복 타이머들의 집합(Set). 탭 숨김/복귀 때 한꺼번에 제어.
    const _intervals = new Set();
    // pausableInterval: setInterval 인데 탭이 숨으면 자동으로 멈추고 돌아오면 재개(배터리 절약).
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
    // haptic: 탭 시 짧은 진동 피드백. 지원 안 하는 기기/브라우저면 조용히 무시.
    function haptic(kind) {
        // navigator.vibrate 가 없으면(미지원) 그냥 종료.
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

    // 공개 API — 다른 모듈이 쓰는 도구 모음.
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
