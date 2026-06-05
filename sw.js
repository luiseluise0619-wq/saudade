// AURA Service Worker — 오프라인 폴백 + 정적 자산 캐시
// 전략: network-first for HTML/JS (최신 데이터 우선), cache-first for fonts/static
//
// 보강 (2026-04):
//   - JSON / XHR / fetch (req.destination='' or req.headers.accept='application/json')
//     요청은 오프라인 시 절대 index.html 을 반환하지 않음 (JSON 파서 깨짐 방지).
//   - /license/* 경로는 항상 network-only (만료된 토큰 캐시 차단).
'use strict';

// CACHE_VERSION 을 v533 으로 강제 점프 — 사용자 보고 'css/js 변경 안 보임'.
// 옛 v515 캐시가 남아 있어서 새 자산이 안 들어오던 문제 차단.
// activate 핸들러가 startsWith(CACHE_VERSION) 외 모든 캐시 삭제.
const CACHE_VERSION = 'saudade-v660';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 셸 자산 (오프라인에서도 앱 켜지게 — 실제 데이터는 못 오지만 UI는 뜸)
// v659 — high-traffic preflight. Precache covers everything that the cover
// hero needs to render. Atlas/ledger/dispatches/listening are lazy via SWR
// (cached on first visit, served from cache on subsequent visits).
// Each entry uses `?v=v660` so the cache version-bumps and the SW install
// fetches the new file without bypassing the long-cache CF headers.
const CB = '?v=v660';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css' + CB,
    './saudade-tokens.css' + CB,
    './saudade-typography.css' + CB,
    './saudade-skin.css' + CB,
    './saudade-edition-tokens.css' + CB,
    './saudade-microtype.css' + CB,
    './saudade-empty.css' + CB,
    './design-tokens.css' + CB,
    './bootstrap.js' + CB,
    './consent.js' + CB,
    './saudade-boot.js' + CB,
    './saudade.core.js' + CB,
    './saudade.editorial.js' + CB,
    './saudade-edition.js' + CB,
    './saudade-cover.js' + CB,
    './saudade-masthead.js' + CB,
    './saudade-rings.js' + CB,
    './saudade-wordmark.js' + CB,
    './saudade-hud.js' + CB,
    // critical data the cover hero awaits
    './data/city-definitions.json',
    './data/cover-titles.json',
    './data/dispatches.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// 오프라인 폴백 Response (Response 객체 보장 — 'Failed to convert value to Response' 방지)
function offlineResponse(msg) {
    return new Response(msg || 'Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}
function offlineJsonResponse(code) {
    return new Response(JSON.stringify({ error: 'offline', code: code || 'OFFLINE' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

// JSON / API 성격 요청 감지 (Accept 헤더 + URL 패턴)
function isApiRequest(req, url) {
    const accept = (req.headers && req.headers.get && req.headers.get('Accept')) || '';
    if (/application\/json/i.test(accept)) return true;
    if (req.destination === '' && /^https?:/i.test(url.protocol)) {
        // fetch()/XHR 일반 요청은 destination 이 빈 문자열. 확장자로 추가 구분.
        if (/\.(json|xml|txt)(\?.*)?$/i.test(url.pathname)) return true;
        if (/\/(api|rss|json|graphql)(\/|$|\?)/i.test(url.pathname)) return true;
    }
    return false;
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // ─── License/결제 응답은 절대 캐시 X (만료 토큰 노출 방지) ───
    if (/^\/license\//i.test(url.pathname)) {
        e.respondWith(
            fetch(req).catch(() => offlineJsonResponse('LICENSE_OFFLINE'))
        );
        return;
    }

    // ─── SW 가로채면 안 되는 요청 (사용자 보고: 비디오 검정 화면) ───
    // - video/audio media — Pexels CDN 영상은 SW 거치면 깨질 수 있음
    // - API 호출 (Reddit, Frankfurter 등) — CORS preflight 복잡, SW 우회가 안전
    if (req.destination === 'video' ||
        req.destination === 'audio' ||
        /\.(mp4|webm|m3u8|mp3|ogg)(\?.*)?$/i.test(url.pathname) ||
        /api\./.test(url.hostname) ||
        /\.googleapis\.com$/.test(url.hostname) ||
        /pexels\.com$/.test(url.hostname) ||
        /reddit\.com$/.test(url.hostname)) {
        return;   // SW 가로채지 않음 → 브라우저가 직접 요청
    }

    const apiLike = isApiRequest(req, url);

    // ─── v659 — stale-while-revalidate helper ────────────────────────────
    // Serve from cache instantly, then revalidate in the background. Drops
    // p95 latency to ~5ms for repeat visitors and lets the page render
    // while CF Pages absorbs the freshness check at the edge.
    function staleWhileRevalidate(cacheName) {
        const cachedP = caches.match(req);
        const networkP = fetch(req).then(res => {
            if (res && res.ok) {
                const clone = res.clone();
                caches.open(cacheName).then(c => c.put(req, clone)).catch(() => {});
            }
            return res;
        }).catch(() => null);
        return cachedP.then(cached => {
            if (cached) {
                // Fire-and-forget revalidation; don't block the response.
                networkP.catch(() => {});
                return cached;
            }
            return networkP.then(res => res || (apiLike
                ? offlineJsonResponse()
                : (req.destination === 'document' || req.mode === 'navigate')
                    ? caches.match('./index.html').then(r2 => r2 || offlineResponse('Offline'))
                    : offlineResponse('Offline')));
        });
    }

    // Cross-origin (CDN, fonts): cache-first (immutable URLs), update in bg.
    // Fonts/CSS from CDN don't change at a given URL — once cached, the
    // network roundtrip is pure waste.
    if (url.origin !== location.origin) {
        if (/\.(woff2?|ttf|otf|eot|css|svg)(\?.*)?$/.test(url.pathname)) {
            e.respondWith(staleWhileRevalidate(RUNTIME_CACHE));
            return;
        }
        // Other cross-origin (analytics, JSON APIs): network-first
        e.respondWith(
            fetch(req).then(res => {
                if (res.ok && /\.(woff2?|ttf|otf|eot|js|css|png|jpg|svg)(\?.*)?$/.test(url.pathname)) {
                    const clone = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, clone)).catch(() => {});
                }
                return res;
            }).catch(() => caches.match(req).then(r => r || (apiLike ? offlineJsonResponse() : offlineResponse('Cross-origin offline'))))
        );
        return;
    }

    // Same-origin static assets (versioned via ?v=) — cache-first SWR.
    // These URLs change when content changes, so the cached copy is always
    // exactly right; refresh-in-background keeps it warm.
    if (/\.(js|css|woff2?|svg|png|webp|jpg|ico)(\?.*)?$/.test(url.pathname)) {
        e.respondWith(staleWhileRevalidate(STATIC_CACHE));
        return;
    }

    // Same-origin data JSON — SWR with shorter revalidation window. Edge
    // header (_headers) already says max-age=60 swr=86400, so the SW
    // matches: serve cached instantly, refresh in background.
    if (/^\/data\//.test(url.pathname) && url.pathname.endsWith('.json')) {
        e.respondWith(staleWhileRevalidate(RUNTIME_CACHE));
        return;
    }

    // HTML / navigation — network-first (deploy visibility) with cache fallback.
    e.respondWith(
        fetch(req).then(res => {
            if (res && res.ok) {
                const clone = res.clone();
                caches.open(STATIC_CACHE).then(c => c.put(req, clone)).catch(() => {});
            }
            return res;
        }).catch(() =>
            caches.match(req).then(r => {
                if (r) return r;
                if (apiLike) return offlineJsonResponse();
                if (req.destination === 'document' || req.mode === 'navigate') {
                    return caches.match('./index.html').then(r2 => r2 || offlineResponse('Offline'));
                }
                return offlineResponse('Offline');
            })
        )
    );
});
