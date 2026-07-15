// AURA — bootstrap (extracted from inline scripts in index.html)
// 이 파일이 따로 빠져 나오면서 CSP 에서 'unsafe-inline' 제거 가능.
// 4가지 부트 작업: 서버 URL, 캐시 마이그레이션, SW 등록, globe.gl CDN 로딩, 로딩 타임아웃.
'use strict';

// ─── 0) Skin pre-load — apply <html data-skin> BEFORE first paint ─────
// saudade.editorial.js sets the data-skin attribute in its init(), but
// it loads with `defer` so the first paint flashes paper skin for
// ~50-200ms before the dark / cover skin kicks in (FOUC). This synchronous
// read of localStorage 'saudade.skin' + the system dark-mode query sets
// the attribute before the first paint so the chosen skin renders from
// frame 1. Runs from bootstrap.js (script-src 'self' allowed).
(function preApplySkin() {
    try {
        const SKINS = ['paper', 'saturated', 'dark'];
        let pref = null;
        try { pref = localStorage.getItem('saudade.skin'); } catch (e) {}
        let skin = SKINS.includes(pref) ? pref : null;
        if (!skin) {
            // Mirror editorial.js pickSkin() — prefers-reduced-motion
            // forces paper; OS dark-mode forces dark; otherwise paper.
            // ISO-week rotation lives in editorial.js, not here (this is
            // just the FOUC-elimination synchronous path).
            const mm = (typeof matchMedia === 'function') ? matchMedia : null;
            if (mm && mm('(prefers-reduced-motion: reduce)').matches)      skin = 'paper';
            else if (mm && mm('(prefers-color-scheme: dark)').matches)     skin = 'dark';
            else                                                            skin = 'paper';
        }
        document.documentElement.setAttribute('data-skin', skin);
    } catch (e) { /* never block bootstrap */ }
})();

function safeStorageGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { window.AURA?.dbgWarn?.('caught', e); return null; }
}

function safeStorageSet(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { window.AURA?.dbgWarn?.('caught', e); }
}

function safeStorageRemove(storage, key) {
    try { storage.removeItem(key); } catch (e) { window.AURA?.dbgWarn?.('caught', e); }
}

// ─── 1) 서버 URL 설정 (배포 시 한 줄만 바꾸면 됨) ─────────────────────────────
// ⚠ 형식: https://<worker-name>.<account-subdomain>.workers.dev   (slash 없이 끝남)
//   Cloudflare Dashboard → Workers & Pages → 해당 Worker → 상단 표시된 URL 그대로 복붙
//   현재: Worker 이름 'saudade' (wrangler.toml) + 계정 subdomain 'absbjj1230'
window.AURA_SERVER = 'https://saudade.absbjj1230.workers.dev';
// window.AURA_SERVER = 'https://aura-api.your-name.workers.dev';

// ─── 2) 버전 마이그레이션: 오래된 캐시 자동 정리 ────────────────────────────
(function() {
    const CURRENT_VER = '1.0.4';
    const prev = safeStorageGet(localStorage, 'aura_version');
    if (prev === CURRENT_VER) return;
    const keysToRemove = [
        'aura_events_cache_v2',
        'aura_events_v2',
        'aura_events_v3',
        'aura_wp_v50_articles'
    ];
    keysToRemove.forEach(k => {
        safeStorageRemove(localStorage, k);
    });
    safeStorageSet(localStorage, 'aura_version', CURRENT_VER);
})();

// ─── 3) PWA Service Worker — 1회성 강제 nuke 후 재등록 ─────────────────────
// 사용자 보고 '여러 번 push 해도 모바일에 변경사항 반영 안 됨' →
// 옛 SW (lounj-v515) 가 새 SW 설치 자체를 차단. localStorage 에 release 마커
// 기록해서 새 버전마다 1회 unregister + caches.delete + reload 강제.
const SAUDADE_RELEASE = 'v752';
window.SAUDADE_RELEASE = SAUDADE_RELEASE;   // expose so other modules can stamp cache-buster query strings.
                                            // Kept in lock-step with sw.js CACHE_VERSION by scripts/bump-cache.js.

// v557 — v1 출시 정리: 삭제된 모듈 (dancing-cat, movies, games, music-charts,
// tmdb-auto, sports-sidebar) 의 localStorage 키 청소. 남아있어 봤자 의미 없음.
(function saudadeLegacyKeyCleanup() {
    try {
        const stale = [
            'aura_cat_gif_cache_v5',     // dancing-cat
            'aura_itunes_charts_v1',     // music-charts
            'aura_tmdb_cache_v1',        // tmdb-auto
            'aura_sports_sidebar_open'   // sports-sidebar
        ];
        stale.forEach(k => safeStorageRemove(localStorage, k));
        // movies_*/games_*/sports_*/music_charts_* prefix 도 한번 sweep
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (/^(movies_|games_|sports_|music_charts_|tmdb_|aura_cat_|events_|startups_|hotels_|flights_|travel_|learn_|aura_tutorial_|aura_shorts_)/i.test(k)) {
                safeStorageRemove(localStorage, k);
            }
        }
    } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
})();

(function saudadeReleaseGuard() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' || navigator.userAgent.includes('Electron')) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
        return;
    }
    const prev = safeStorageGet(localStorage, 'saudade_release');

    // 첫 방문 (prev === null) 은 nuke 할 캐시도 SW 도 없음 — marker 만 세팅 후 정상 등록.
    // 옛 release 에서 업그레이드 (prev 가 다른 값) 일 때만 unregister + reload.
    if (prev !== SAUDADE_RELEASE && prev !== null) {
        Promise.all([
            navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))).catch(() => {}),
            (typeof caches !== 'undefined' && caches.keys ? caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))) : Promise.resolve()).catch(() => {})
        ]).then(() => {
            safeStorageSet(localStorage, 'saudade_release', SAUDADE_RELEASE);
            const reloadedFlag = safeStorageGet(sessionStorage, 'saudade_release_reloaded') === SAUDADE_RELEASE;
            if (!reloadedFlag) {
                safeStorageSet(sessionStorage, 'saudade_release_reloaded', SAUDADE_RELEASE);
                setTimeout(() => location.reload(), 300);
            }
        });
        return;
    }

    // 첫 방문이면 marker 만 세팅
    if (prev === null) {
        safeStorageSet(localStorage, 'saudade_release', SAUDADE_RELEASE);
    }

    // 같은 release (또는 첫 방문) — 정상 SW 등록 흐름
    window.addEventListener('load', () => {
        // 첫 install 시 controllerchange 가 reload 트리거하지 않도록 사전 컨트롤러 유무 캡처
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('./sw.js?v=' + SAUDADE_RELEASE).then(reg => {
            let _reloaded = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!hadController) return;  // 첫 install — reload 불필요
                if (_reloaded) return;
                _reloaded = true;
                location.reload();
            });
        }).catch(err => {
            if (window.__DEBUG) console.warn('[AURA] SW register failed:', err);
        });
    });
})();

// ─── 4) (구) globe.gl CDN 로딩 — v610 SAUDADE 정리. 잡지에 globe 없음.
//        ~500KB 절약. app.js 의 globe init 은 saudade-skin §21 이 영구 hide.
//        __CDN_READY flag 만 즉시 true 로 (의존 코드의 wait 루프 차단).
//        v617: AURA_USE_2D_MAP 도 true 로 — initGlobe 가 globe.gl 대기 retry
//        10초 도는 것 차단 (early return). saudade 가 globe 안 그림.
window.__CDN_READY = true;
window.AURA_USE_2D_MAP = true;

// ─── 4b) Cafe-mode trigger from the manifest shortcut.
//        manifest.json has a "Cafe Mode" shortcut → ?mode=cafe; the CSS
//        in saudade-masthead/hud/listening/etc all references
//        body.cafe-mode but no JS ever added the class. v659: add it
//        on boot when the query is present, so the shortcut becomes a
//        real entry point instead of a dead-end link.
(function cafeModeFromQuery() {
    try {
        const p = new URLSearchParams(location.search);
        if (p.get('mode') === 'cafe') {
            const apply = () => document.body && document.body.classList.add('cafe-mode');
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', apply);
            } else { apply(); }
        }
    } catch (e) {}
})();

// ─── 4c) Offline chip — the SW serves the magazine from cache when the
//        network drops, which is a feature, but readers should know they're
//        looking at yesterday's paper. A quiet mono chip appears top-center
//        while offline and leaves when the connection returns. 5 editions.
(function offlineChip() {
    if (typeof navigator === 'undefined' || !('onLine' in navigator)) return;
    let el = null;
    const LABEL = {
        en: 'OFFLINE · READING FROM CACHE',
        ko: '오프라인 · 저장된 지면',
        ja: 'オフライン · 保存紙面',
        pt: 'OFFLINE · EDIÇÃO GUARDADA',
        es: 'SIN CONEXIÓN · EDICIÓN GUARDADA'
    };
    function edition() {
        try { const v = localStorage.getItem('saudade.edition'); return /^(en|ko|ja|pt|es)$/.test(v) ? v : 'en'; }
        catch (e) { return 'en'; }
    }
    function show() {
        if (el || !document.body) return;
        el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.style.cssText = [
            'position:fixed', 'top:10px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:100001', 'padding:6px 14px',
            'font-family:JetBrains Mono,ui-monospace,monospace', 'font-weight:500',
            'font-size:9px', 'letter-spacing:0.22em',
            'background:var(--ink,#1A130D)', 'color:var(--paper,#F4ECD6)',
            'border-radius:2px', 'opacity:0', 'transition:opacity .4s ease',
            'pointer-events:none'
        ].join(';');
        el.textContent = LABEL[edition()] || LABEL.en;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '0.92'; });
    }
    function hide() {
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => { el?.remove(); el = null; }, 450);
    }
    function sync() { if (navigator.onLine) hide(); else show(); }
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sync);
    } else { sync(); }
})();

// ─── 5) 로딩 오버레이 fade — saudade-boot.js 가 처리.
//        v650 — moved the cover-rendered listener + backstop timers into
//        saudade-boot.js so any consumer can await window.SAUDADE_BOOT.ready
//        for "the overlay is gone, the page is paintable" semantics.
//        bootstrap.js stays minimal — only legacy SW unregister + secrets.
