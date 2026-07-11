// ═══════════════════════════════════════════════════════════════════════
// [파일 역할 배너 — 초보자 안내]
// sw.js = 서비스 워커(Service Worker). 브라우저가 백그라운드에서 돌리는 작은 프록시.
// 페이지의 모든 네트워크 요청(fetch)을 가로채(intercept) 캐시에서 줄지, 네트워크로
// 나갈지 스스로 정한다. 덕분에 오프라인에서도 앱 껍데기(UI)가 뜨고, 반복 방문이 빨라진다.
// 핵심 개념:
//   - 캐시 버전(CACHE_VERSION): 파일을 바꾸면 이 버전을 올려야 옛 캐시가 버려지고
//     새 파일이 받아진다. 이것이 "캐시 버스터(cache-buster)". (index.html 의 ?v= 와 짝을 맞춘다.)
//   - install: 처음 등록 때 필수 자산을 미리 받아둔다(precache).
//   - activate: 새 버전이 켜질 때 옛 버전 캐시를 청소한다.
//   - fetch: 요청마다 캐시/네트워크 전략을 고른다(아래 참고).
// SWR(stale-while-revalidate): 일단 캐시본을 즉시 주고, 뒤에서 몰래 새 버전을 받아 갱신.
// ═══════════════════════════════════════════════════════════════════════
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
// CACHE_VERSION = 이 캐시 세대의 이름표. 루트 JS/CSS 를 바꾸면 이 숫자를 올린다
// (index.html 의 ?v= 와 반드시 같은 값으로 — smoke 테스트가 이 짝을 검사한다).
const CACHE_VERSION = 'saudade-v743';
// 정적 자산용/런타임용 캐시 이름(버전 접두어를 붙여 세대 구분).
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 셸 자산 (오프라인에서도 앱 켜지게 — 실제 데이터는 못 오지만 UI는 뜸)
// v659 — high-traffic preflight. Precache covers everything that the cover
// hero needs to render. Atlas/ledger/dispatches/listening are lazy via SWR
// (cached on first visit, served from cache on subsequent visits).
// Each entry uses `?v=v732` so the cache version-bumps and the SW install
// fetches the new file without bypassing the long-cache CF headers.
const CB = '?v=v732';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './style.css' + CB,
    './saudade-tokens.css' + CB,
    './saudade-typography.css' + CB,
    './saudade-skin.css' + CB,
    './saudade-edition-tokens.css' + CB,
    './saudade-stitch.css' + CB,
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
    './saudade-stitch-fx.js' + CB,
    // critical data the cover hero awaits
    './data/city-definitions.json',
    './data/cover-titles.json',
    './data/dispatches.json'
];

// install 이벤트: 서비스 워커가 처음 설치될 때 1회 실행.
self.addEventListener('install', (e) => {
    // skipWaiting: 기다리지 않고 새 워커를 즉시 활성 후보로. (배포 반영을 빠르게)
    self.skipWaiting();
    // waitUntil: 이 비동기 작업이 끝날 때까지 install 을 완료로 치지 않음.
    // 필수 자산들을 캐시에 미리 담는다(addAll). 실패해도 앱은 뜨게 catch 로 무시.
    e.waitUntil(
        caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
    );
});

// activate 이벤트: 새 워커가 실제로 켜질 때 실행 — 주로 옛 캐시 청소.
self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        // 존재하는 모든 캐시 이름을 가져온다.
        const keys = await caches.keys();
        // 현재 버전으로 시작하지 않는(=옛 세대) 캐시를 전부 삭제. filter 로 고르고 delete.
        await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
        // clients.claim: 이미 열려 있는 탭들도 새 워커가 즉시 제어하게.
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

// fetch 이벤트: 페이지의 모든 네트워크 요청이 여기로 들어온다. 전략을 골라 응답한다.
self.addEventListener('fetch', (e) => {
    const req = e.request;
    // GET 이 아닌 요청(POST 등)은 가로채지 않고 브라우저에 맡긴다.
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
    // staleWhileRevalidate: 캐시본을 먼저 주고(빠름) 뒤에서 네트워크로 새로 받아 갱신.
    function staleWhileRevalidate(cacheName) {
        // 캐시 조회 약속(Promise).
        const cachedP = caches.match(req);
        // 네트워크 조회 약속 — 성공하면 응답 복제본(clone)을 캐시에 저장해 둔다.
        const networkP = fetch(req).then(res => {
            if (res && res.ok) {
                // 응답 본문은 한 번만 읽히므로, 저장용으로 clone 해서 캐시에 넣는다.
                const clone = res.clone();
                caches.open(cacheName).then(c => c.put(req, clone)).catch(() => {});
            }
            return res;
        }).catch(() => null);
        return cachedP.then(cached => {
            // 캐시본이 있으면 즉시 반환(네트워크 갱신은 백그라운드로 진행).
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
