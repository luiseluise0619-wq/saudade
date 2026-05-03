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

(function() {
    if (window.SAUDADE_WEAK_SIGNALS) return;

    let _stats = null;          // worker 응답 캐시
    let _fetchedAt = 0;
    const TTL_MS = 60 * 60 * 1000;   // 1 시간 (cron 은 주 1회지만 클라이언트는 더 자주 갱신 시도 OK)

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

    function fetchStats() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return Promise.resolve(null);
        if (_stats && (Date.now() - _fetchedAt) < TTL_MS) return Promise.resolve(_stats);
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
    function listeningCopy(stats) {
        const entry = stats['listening:weekly_total'];
        if (!entry || !entry.value) return null;
        const sessions = entry.value.sessions || 0;
        const cities = entry.value.cities || 0;
        if (sessions < 100) return null;   // 100 미만이면 노출 X (외롭게 안 보이게)
        return `${spell(sessions)} sessions logged this week from ${spell(cities)} cit${cities === 1 ? 'y' : 'ies'}.`;
    }

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

    function ensureCoverEl() {
        let el = document.getElementById('sddCoverWeak');
        if (el) return el;
        el = document.createElement('p');
        el.id = 'sddCoverWeak';
        el.className = 'sdd-weak-signal sdd-cover-weak';
        document.body.appendChild(el);
        return el;
    }

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_WEAK_SIGNALS = { spell, fetchStats, renderAll };
})();
