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
const CACHE_VERSION = 'saudade-v695';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 셸 자산 (오프라인에서도 앱 켜지게 — 실제 데이터는 못 오지만 UI는 뜸)
// v655 — 옛 AURA 모듈 (app.js / ambient-mode.js / city-videos.js) 제거됨.
//        bootstrap + boot + bundle + 표지/마스트헤드만 캐시. 나머지는 runtime 캐시로 흡수.
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './saudade-tokens.css',
    './saudade-typography.css',
    './saudade-skin.css',
    './saudade-edition-tokens.css',
    './saudade-microtype.css',
    './saudade-empty.css',
    './bootstrap.js',
    './consent.js',
    './saudade-boot.js',
    './saudade.core.js',
    './saudade-edition.js',
    './saudade-cover.js',
    './saudade-masthead.js',
    './saudade-rings.js',
    './saudade-wordmark.js',
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

    // Cross-origin (CDN, fonts): network 우선, 실패 시 cache
    if (url.origin !== location.origin) {
        e.respondWith(
            fetch(req).then(res => {
                // 폰트/이미지/CDN 라이브러리는 cache 저장
                if (res.ok && /\.(woff2?|ttf|otf|eot|js|css|png|jpg|svg)(\?.*)?$/.test(url.pathname)) {
                    const clone = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, clone)).catch(() => {});
                }
                return res;
            }).catch(() => caches.match(req).then(r => r || (apiLike ? offlineJsonResponse() : offlineResponse('Cross-origin offline'))))
        );
        return;
    }

    // Same-origin: network-first (최신 코드 우선), 오프라인이면 cache
    e.respondWith(
        fetch(req).then(res => {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(req, clone)).catch(() => {});
            return res;
        }).catch(() =>
            caches.match(req).then(r => {
                if (r) return r;
                // SPA fallback: navigation 요청에만 index.html 반환. JSON/api 는 503 JSON.
                if (apiLike) return offlineJsonResponse();
                if (req.destination === 'document' || req.mode === 'navigate') {
                    return caches.match('./index.html').then(r2 => r2 || offlineResponse('Offline'));
                }
                return offlineResponse('Offline');
            })
        )
    );
});
