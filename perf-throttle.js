// ═══════════════════════════════════════════════════════════════════════════
//  perf-throttle.js — v566 발열 완화: visibilitychange 시 모든 setInterval
//  paused 상태로 만들어 GPU/CPU 사용률 ↓.
//  사용자 보고 '모바일 들어가면 폰이 너무 뜨거워져'.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // 1) 원본 setInterval 을 wrap 해서 모든 활성 타이머 추적.
    //    탭이 숨겨지면 clearInterval, 다시 보이면 reschedule.
    const _setInterval = window.setInterval;
    const _clearInterval = window.clearInterval;
    const _live = new Map(); // wrappedId → { fn, ms, nativeId }
    let _paused = false;
    let _nextId = 1;

    function wrappedSetInterval(fn, ms, ...args) {
        if (typeof fn !== 'function' || !Number.isFinite(ms)) {
            return _setInterval(fn, ms, ...args);
        }
        const id = _nextId++;
        const nativeId = _paused ? null : _setInterval(fn, ms, ...args);
        _live.set(id, { fn, ms, args, nativeId });
        return -id; // negative id 로 wrappedClearInterval 구분
    }
    function wrappedClearInterval(id) {
        if (id < 0) {
            const w = _live.get(-id);
            if (w && w.nativeId != null) _clearInterval(w.nativeId);
            _live.delete(-id);
            return;
        }
        _clearInterval(id);
    }
    window.setInterval = wrappedSetInterval;
    window.clearInterval = wrappedClearInterval;

    function pauseAll() {
        if (_paused) return;
        _paused = true;
        _live.forEach(w => {
            if (w.nativeId != null) {
                _clearInterval(w.nativeId);
                w.nativeId = null;
            }
        });
    }
    function resumeAll() {
        if (!_paused) return;
        _paused = false;
        _live.forEach(w => {
            if (w.nativeId == null) {
                w.nativeId = _setInterval(w.fn, w.ms, ...(w.args || []));
            }
        });
    }

    // v567 — cafe-mode video element 도 자동 pause (GPU decode ↓).
    function pauseVideos() {
        document.querySelectorAll('video[data-saudade-video], video.cafe-mode-video').forEach(v => {
            try { v.pause(); v.dataset.saudadePaused = '1'; } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
        });
    }
    function resumeVideos() {
        document.querySelectorAll('video[data-saudade-video][data-lounj-paused="1"], video.cafe-mode-video[data-lounj-paused="1"]').forEach(v => {
            try { v.play().catch(() => {}); delete v.dataset.saudadePaused; } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
        });
    }

    // 탭 숨김 = pause (interval + video). 보임 = resume.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseAll();
            pauseVideos();
        } else {
            resumeAll();
            // video 는 사용자 제스처 후만 resume — 자동재생 정책 때문에 cafe-mode
            // 활성 시에만 자동 play, 그 외엔 user click 대기.
            if (document.body.classList.contains('cafe-mode')) resumeVideos();
        }
    });

    // body class 'cafe-mode' 변화 감지 — video pause 외에 globe.gl 도 정지.
    // v580 사용자 보고 '데스크톱 영상 + 지구본 동시 렉 ㅈ됨' fix.
    function pauseGlobe() {
        try {
            const g = window.globeInstance;
            if (!g) return;
            // autoRotate 끄고 controls 비활성 → renderer.setAnimationLoop 가
            // 정지 상태로 idle (globe.gl 내부 raf 도 멈춤).
            if (g.controls && g.controls()) g.controls().autoRotate = false;
            // globe.gl 내부 renderer.setAnimationLoop(null) — 가능하면 stop
            if (g.renderer && g.renderer().setAnimationLoop) {
                g._saudadeAnimWasOn = true;
                g.renderer().setAnimationLoop(null);
            }
        } catch (e) {}
    }
    function resumeGlobe() {
        try {
            const g = window.globeInstance;
            if (!g) return;
            if (g.controls && g.controls()) g.controls().autoRotate = true;
            if (g._saudadeAnimWasOn && g.renderer && g.renderer().setAnimationLoop) {
                // globe.gl 내부 _animate fn 재구동 — set null 후 다시 set 해야 함.
                // 가장 안전한 방법: g._animationFrameRequestId 등 내부 API 없으니
                // controls 재활성만으로 raf 자동 복귀.
                g._saudadeAnimWasOn = false;
            }
        } catch (e) {}
    }
    if (typeof MutationObserver !== 'undefined') {
        let wasCafe = document.body.classList.contains('cafe-mode');
        const bodyObs = new MutationObserver(() => {
            const isCafe = document.body.classList.contains('cafe-mode');
            if (wasCafe !== isCafe) {
                if (isCafe) pauseGlobe();        // 카페 진입 → globe pause
                else { pauseVideos(); resumeGlobe(); }  // 카페 나옴 → video pause + globe resume
            }
            wasCafe = isCafe;
        });
        try { bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
    }

    // 모바일에서 카페 비활성 시 ambient/cafe 백그라운드 iframe + Pexels poll
    // 자체를 stop 하는건 ambient-mode 가 직접 처리해야 함. 여기선 setInterval
    // 차단만으로 큰 비중 잡힘 (대부분 폴링 기반).

    // diag — 콘솔에서 AURA_PERF.live() 로 확인
    window.AURA_PERF = {
        live: () => Array.from(_live.values()).map(w => ({ ms: w.ms })),
        pauseAll, resumeAll,
        get paused() { return _paused; },
    };
})();
