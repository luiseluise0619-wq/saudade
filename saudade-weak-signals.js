// SAUDADE · v8 §13 — 약한 연결 표시 (Weak Social Signals)
//
// Cover / Atlas / Listening 에 도시별·전체 통계를 잡지 톤으로 노출.
// 데이터: worker /stats/weekly (월요일 자정 cron 갱신). M1/M2 사용자 100명 미만이면
// 응답 비어있음 — 화면 표시 자체를 hide (정성 표현 폴백 대신).
//
// 톤 규칙 (v8 §13.3):
//   - 숫자 영문으로 풀어쓰기 ("forty-seven readers" not "47 readers")
//   - 마침표만, 느낌표·물음표 X
//   - "join us" / "growing community" 등 SNS 키워드 X
//   - "noted" / "logged" / "the desk" / "quiet" 어휘 사용
//
// 5명 미만일 때 정성 폴백 ("a quiet desk") — 사용자가 외로움 느끼지 않게.

'use strict';

// IIFE — 로드 즉시 실행. "약한 연결"(독자 수 등 통계)을 잡지 톤으로 노출하는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_WEAK_SIGNALS) return;

    // _stats: Worker 통계 응답 캐시. _fetchedAt: 마지막 로드 시각. TTL_MS: 캐시 유효기간(1시간).
    let _stats = null;          // worker 응답 캐시
    let _fetchedAt = 0;
    const TTL_MS = 60 * 60 * 1000;   // 1 시간 (cron 은 주 1회지만 클라이언트는 더 자주 갱신 시도 OK)

    // spell — 숫자를 영어 단어로 풀어쓴다("47" → "forty-seven"). 톤 규칙(§13.3).
    // 영문 숫자 풀어쓰기 — 0~99 정확, 그 외 mass term ("hundreds", "thousands")
    const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine'];
    const TEENS = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    function spell(n) {
        n = Math.max(0, Math.floor(Number(n) || 0));
        if (n < 10) return ONES[n];
        if (n < 20) return TEENS[n - 10];
        if (n < 100) {
            const t = Math.floor(n / 10), o = n % 10;
            return o === 0 ? TENS[t] : TENS[t] + '-' + ONES[o];
        }
        if (n < 1000) {
            const h = Math.floor(n / 100), r = n % 100;
            return ONES[h] + ' hundred' + (r ? ' ' + spell(r) : '');
        }
        if (n < 10000) {
            const k = Math.floor(n / 1000), r = n % 1000;
            return ONES[k] + ' thousand' + (r >= 100 ? ' ' + spell(r) : '');
        }
        if (n < 1000000) {
            // round to nearest hundred for compactness
            const rounded = Math.round(n / 100) * 100;
            const k = Math.floor(rounded / 1000);
            const h = (rounded % 1000) / 100;
            return spell(k) + ' thousand' + (h ? ' ' + ONES[h] + ' hundred' : '');
        }
        return 'many thousand';
    }

    // fetchStats — 주간 통계를 Worker 에서 가져와 캐시(서버 없으면 null, 캐시 신선하면 재사용).
    function fetchStats() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return Promise.resolve(null);
        if (_stats && (Date.now() - _fetchedAt) < TTL_MS) return Promise.resolve(_stats);
        // GET /stats/weekly — 월요일 cron 이 갱신하는 도시별/전체 통계.
        return fetch(base + '/stats/weekly?key=all', { cache: 'no-cache', credentials: 'omit' })
            .then(r => r.ok ? r.json() : null)
            .then(j => {
                _stats = (j && j.stats) || {};
                _fetchedAt = Date.now();
                return _stats;
            })
            .catch(() => { _stats = {}; return _stats; });
    }

    // ── Cover: 같은 도시 독자 수 ─────────────────────────────────
    // "Lisbon today: forty-seven readers on the desk."
    // 5 명 미만: "Lisbon today: a quiet desk."
    // coverCopy — 표지용 문구: "같은 도시 독자 N명"(5명 미만이면 "a quiet desk").
    function coverCopy(stats) {
        const f = window.SAUDADE_FOLLOWING?.list?.() || [];
        const slug = f[0];
        if (!slug) return null;
        const entry = stats['cover:' + slug + ':readers'];
        const cityName = window.SAUDADE_FOLLOWING?.cityName?.(slug, 'en') || slug;
        if (!entry || !entry.value) return null;
        const n = entry.value.readers || 0;
        if (n < 5) {
            return `${cityName} today: a quiet desk.`;
        }
        return `${cityName} today: ${spell(n)} readers on the desk.`;
    }

    // ── Atlas: 주간 카페 제출 활동 ───────────────────────────────
    // "This week, three readers added cafés in Porto. Pending review."
    // atlasCopy — 아틀라스용 문구: 이번 주 카페 제출이 가장 많은 도시.
    function atlasCopy(stats) {
        const entry = stats['atlas:weekly_submissions'];
        if (!entry || !entry.value || !Array.isArray(entry.value.top_cities)) return null;
        const top = entry.value.top_cities[0];
        if (!top || top.count < 1) return null;
        const cityName = window.SAUDADE_FOLLOWING?.cityName?.(top.city, 'en') || top.city;
        const word = top.count === 1 ? 'reader' : `${spell(top.count)} readers`;
        return `This week, ${word} added café${top.count === 1 ? '' : 's'} in ${cityName}. Pending review.`;
    }

    // ── Listening: 누적 세션 수 ──────────────────────────────────
    // "Two thousand eight hundred sessions logged this week from twenty-three cities."
    // listeningCopy — 청취실용 문구: 이번 주 세션 수/도시 수(100 미만이면 노출 안 함).
    function listeningCopy(stats) {
        const entry = stats['listening:weekly_total'];
        if (!entry || !entry.value) return null;
        const sessions = entry.value.sessions || 0;
        const cities = entry.value.cities || 0;
        if (sessions < 100) return null;   // 100 미만이면 노출 X (외롭게 안 보이게)
        return `${spell(sessions)} sessions logged this week from ${spell(cities)} cit${cities === 1 ? 'y' : 'ies'}.`;
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddWeakSignalsStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWeakSignalsStyles';
        s.textContent = `
.sdd-weak-signal {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: 0;
    padding: 0;
}
.sdd-weak-signal:empty { display: none; }
.sdd-cover-weak {
    position: fixed;
    bottom: calc(var(--dock-h, 56px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-cover, 4);
    text-align: center;
    pointer-events: none;
    padding: 0 16px;
}
body.section-active .sdd-cover-weak,
body.cafe-mode .sdd-cover-weak,
body.listening-active .sdd-cover-weak { display: none !important; }
@media print { .sdd-weak-signal, .sdd-cover-weak { display: none !important; } }
        `;
        document.head.appendChild(s);
    }

    // ensureCoverEl — 표지 하단 통계 문구 요소를 한 번만 만든다.
    function ensureCoverEl() {
        let el = document.getElementById('sddCoverWeak');
        if (el) return el;
        el = document.createElement('p');
        el.id = 'sddCoverWeak';
        el.className = 'sdd-weak-signal sdd-cover-weak';
        document.body.appendChild(el);
        return el;
    }

    // renderAll — 통계를 받아 표지/아틀라스/청취실 각 자리에 문구를 채운다.
    function renderAll() {
        fetchStats().then(stats => {
            if (!stats) return;
            const cover = coverCopy(stats);
            const atlas = atlasCopy(stats);
            const listening = listeningCopy(stats);
            // Cover
            const cEl = ensureCoverEl();
            cEl.textContent = cover || '';
            // Atlas — sdd-atlas-foot 안에 추가 노출
            const aEl = document.querySelector('.sdd-atlas-foot');
            if (aEl && atlas) {
                let span = aEl.querySelector('.sdd-weak-signal');
                if (!span) {
                    span = document.createElement('p');
                    span.className = 'sdd-weak-signal';
                    span.style.marginTop = '12px';
                    aEl.appendChild(span);
                }
                span.textContent = atlas;
            }
            // Listening — sdd-listen-foot 안에 추가
            const lEl = document.querySelector('.sdd-listen-foot');
            if (lEl && listening) {
                let span = lEl.querySelector('.sdd-weak-signal');
                if (!span) {
                    span = document.createElement('p');
                    span.className = 'sdd-weak-signal';
                    span.style.marginTop = '12px';
                    lEl.appendChild(span);
                }
                span.textContent = listening;
            }
        });
    }

    // init — 모듈 시동: 스타일 주입 + 첫 렌더 + 섹션/에디션/팔로잉 변화 시 재계산.
    function init() {
        injectStyles();
        renderAll();
        // 섹션 변경 / Following 변경 시 재계산
        const mo = new MutationObserver(() => renderAll());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
        if (window.SAUDADE_FOLLOWING?.subscribe) {
            window.SAUDADE_FOLLOWING.subscribe(() => renderAll());
        }
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 숫자 풀어쓰기 + 통계 로드 + 렌더.
    window.SAUDADE_WEAK_SIGNALS = { spell, fetchStats, renderAll };
})();
