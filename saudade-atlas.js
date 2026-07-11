// SAUDADE · § 02 THE ATLAS (헌법 §4-3, §11)
// data/cafes-seoul.json 시드 → 매거진 리스트. 카드 X, 1px rule.
// 별점 X — JADE (visited) / BONE (unvisited) 두 상태만.
// 거리 표기 "0.4 KM" mono. 분 표기 X.
// 자동 강등: visited_at + 30일 < 오늘 → JADE → BONE.
'use strict';

// IIFE (즉시 실행 함수) 패턴 — 파일이 로드되면 이 익명 함수가 곧바로 실행된다.
// 안쪽에서 선언한 변수/함수는 전역을 오염시키지 않고 이 스코프 안에만 산다.
(function() {
    // 중복 로드 방어 — 이 스크립트가 두 번 <script> 태그로 실려도
    // window.SAUDADE_ATLAS 가 이미 있으면 곧장 return 하여 다시 초기화하지 않는다.
    // (index.html 은 소스 모듈과 번들을 함께 싣기 때문에 이 가드가 꼭 필요하다.)
    if (window.SAUDADE_ATLAS) return;

    // localStorage 에 방문 기록을 저장할 때 쓰는 키 이름. 헌법 §9 가 정한 네임스페이스.
    const VISITED_KEY = 'saudade.atlas.visited';     // 헌법 §9 키
    // 카페 목록 캐시. 처음엔 null, load() 가 한 번 채우면 다시 fetch 하지 않는다.
    let _cafes = null;
    // 현재 검색어. 사용자가 검색창에 입력한 문자열을 담아 render() 가 필터링에 쓴다.
    let _query = '';     // v607 검색 query

    // 카페 데이터(data/cafes-seoul.json)를 비동기로 읽어온다. Promise 를 돌려준다.
    function load() {
        // 이미 한 번 읽었으면 네트워크를 다시 타지 않고 캐시된 배열을 즉시 반환한다.
        if (_cafes) return Promise.resolve(_cafes);
        // fetch 는 네트워크 요청을 하는 브라우저 표준 API. Promise 를 반환한다.
        // cache: 'force-cache' — 캐시에 있으면 네트워크 없이 캐시본을 쓴다(정적 데이터라 안전).
        return fetch('./data/cafes-seoul.json', { cache: 'force-cache' })
            // 응답이 200 OK(r.ok) 면 JSON 으로 파싱, 아니면 빈 배열로 대체.
            .then(r => r.ok ? r.json() : [])
            // 배열이 맞는지 방어적으로 확인한 뒤 캐시에 담아 돌려준다.
            .then(d => { _cafes = Array.isArray(d) ? d : []; return _cafes; })
            // 네트워크 실패/파싱 실패 등 어떤 예외든 빈 배열로 안전하게 마무리.
            .catch(() => { _cafes = []; return _cafes; });
    }

    // 방문 기록 — saudade.atlas.visited = { id: timestamp_ms }
    // 사용자가 "방문함"으로 표시한 카페의 id 를 키로, 표시한 시각(ms)을 값으로 담는 객체.
    function getVisited() {
        // localStorage 는 문자열만 저장하므로 JSON 문자열을 객체로 되돌린다(parse).
        // 값이 없으면 빈 객체 문자열로 시작. 파싱이 깨지면 빈 객체로 안전 복구.
        try { return JSON.parse(localStorage.getItem(VISITED_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    // 방문 기록 한 건을 쓰거나(ts 있으면) 지운다(ts 가 falsy 면 delete).
    function setVisited(id, ts) {
        const all = getVisited();
        if (ts) all[id] = ts; else delete all[id];
        // 객체 → JSON 문자열로 직렬화해 저장. 사생활보호 모드 등 저장 실패는 무시.
        try { localStorage.setItem(VISITED_KEY, JSON.stringify(all)); } catch (e) {}
    }

    // 30일 이내 방문 = JADE, 그 외 = BONE
    // 카페 하나의 상태 색을 결정한다: 30일 이내 방문 = JADE(초록), 그 외 = BONE(뼈색).
    function statusFor(c) {
        const v = getVisited();
        const ts = v[c.id];
        // Date.now() 는 현재 시각(ms). 86400000 = 하루(ms). 30일 = 30*86400000.
        // 사용자가 최근 30일 안에 방문 표시를 했으면 JADE.
        if (ts && (Date.now() - ts) < 30 * 86400000) return 'JADE';
        // visited_at 시드 값도 확인 (서버 큐레이션 데이터)
        // 사용자 기록이 없더라도 서버 큐레이션 데이터의 visited_at(편집자 방문일)을 확인.
        if (c.visited_at) {
            const seedTs = new Date(c.visited_at).getTime();
            // Number.isFinite — 날짜 파싱이 성공(NaN 아님)했는지 확인.
            if (Number.isFinite(seedTs) && (Date.now() - seedTs) < 30 * 86400000) return 'JADE';
        }
        // 그 밖에는 오래됐거나 방문 안 함 → BONE 으로 강등.
        return 'BONE';
    }

    function injectStyles() {
        if (document.getElementById('sddAtlasStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddAtlasStyles';
        s.textContent = `
.sdd-atlas {
    position: fixed;
    inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="02"] .sdd-atlas { display: block; }

.sdd-atlas-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    /* v7 검토 정정 — 이중선 방지: search input 의 border-bottom 이 분리선 역할 */
}
.sdd-atlas-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    /* v7 §2.2 — 헤드라인 전체 italic */
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-atlas-h2 .sdd-atlas-h2-italic {
    font-style: italic;
    display: block;
}
.sdd-atlas-count {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}

/* v607 검색 — 단일 input. 필터 chip X (헌법 §7 카드 UI 금지) */
.sdd-atlas-search {
    position: relative;
    margin: 0 0 clamp(12px, 2vw, 20px);
    display: flex;
    align-items: center;
    gap: 12px;
}
/* v7 검토 정정 — global input rule (saudade-skin.css:268) 이 4면 box border 강제하므로
   !important 로 hairline border-bottom only 강제. */
.sdd-atlas-search input {
    flex: 1;
    background: transparent !important;
    border: 0 !important;
    border-bottom: 0.5px solid var(--rule) !important;
    color: var(--ink) !important;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    padding: 14px 0 !important;
    border-radius: 0 !important;
    min-height: 44px;
    outline: none;
}
.sdd-atlas-search input:focus { border-bottom-color: var(--ink) !important; }
.sdd-atlas-search input::placeholder { color: var(--bone-d); }
.sdd-atlas-q-count {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}
.sdd-atlas-empty {
    padding: clamp(40px, 6vw, 80px) 0;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
}

/* v7 검토 정정 — Atlas 전체 빈 상태 (cafes = [] 일 때) */
.sdd-atlas-empty-state {
    padding: clamp(16px, 2vw, 24px) 0;
    margin: 0 0 clamp(20px, 3vw, 32px);
}
.sdd-atlas-empty-h3 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.2;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-atlas-empty-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-atlas-empty-actions {
    list-style: none;
    margin: 0 0 clamp(20px, 3vw, 28px);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.sdd-atlas-empty-actions li {
    border-top: 0.5px solid var(--rule);
    margin: 0;
}
/* 마지막 항목 border-bottom 없음 — 잡지 리스트 분리선만 (박스 X) */
.sdd-atlas-empty-btn {
    background: transparent;
    border: 0;
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    text-align: left;
    padding: 14px 0;
    width: 100%;
    cursor: pointer;
    border-radius: 0;
    min-height: 44px;
    transition: color .12s;
}
.sdd-atlas-empty-btn:hover { color: var(--rust); }

.sdd-atlas-list { display: flex; flex-direction: column; gap: 0; }

.sdd-atlas-item {
    display: grid;
    /* v640 — photo slot is opt-in via data-has-photo="1". Cards without a
       photo collapse back to the original 3-col layout so we don't ship 110
       orphan placeholders next to the dataset (which currently has no
       cafe.photo field). When a photo is committed alongside its sidecar
       under photos/cafes/<file>, the rule below kicks in.                  */
    grid-template-columns: 32px 1fr auto;
    grid-template-areas:
        'badge head meta'
        '.     body body'
        '.     amen amen';
    gap: 4px clamp(12px, 2vw, 20px);
    padding: clamp(14px, 2.4vw, 20px) 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
    min-height: 60px;
    cursor: pointer;
    transition: background .12s;
}
.sdd-atlas-item[data-has-photo="1"] {
    grid-template-columns: 32px 1fr auto 96px;
    grid-template-areas:
        'badge head meta photo'
        '.     body body photo'
        '.     amen amen photo';
    min-height: 96px;
}
.sdd-atlas-item:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-atlas-item:hover { background: var(--paper-d); }

.sdd-atlas-photo {
    grid-area: photo;
    align-self: stretch;
    position: relative;
    background: var(--paper-d);
    border: 0.5px solid var(--rule);
    aspect-ratio: 1 / 1;
    overflow: hidden;
    width: 96px;
}
.sdd-atlas-photo__ph {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-weight: 500;
    font-size: 9px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--bone-d);
    text-align: center;
    padding: 6px;
}
.sdd-atlas-photo__img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity .35s ease;
}
.sdd-atlas-photo__img.is-loaded { opacity: 1; }
@media (max-width: 600px) {
    .sdd-atlas-item {
        grid-template-columns: 32px 1fr auto;
        grid-template-areas:
            'badge head meta'
            'photo body body'
            'photo amen amen';
    }
    .sdd-atlas-photo { width: auto; aspect-ratio: 4 / 3; }
}

.sdd-atlas-badge {
    grid-area: badge;
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50% !important;
    background: var(--bone);
    margin-top: 6px;
}
.sdd-atlas-badge.jade { background: var(--jade); }
.sdd-atlas-badge.bone { background: var(--bone); }

.sdd-atlas-head-line {
    grid-area: head;
    display: flex; align-items: baseline; gap: 12px;
    flex-wrap: wrap;
}
.sdd-atlas-name {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 13px;
    line-height: 1.3;
    letter-spacing: var(--tr-mono-label);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-atlas-neigh {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-atlas-meta {
    grid-area: meta;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
    text-align: right;
    white-space: nowrap;
}

.sdd-atlas-body {
    grid-area: body;
    font-family: var(--serif);
    font-weight: 300;
    font-size: 14.5px;
    line-height: 1.5;
    letter-spacing: var(--tr-fraunces-body-m);
    color: var(--ink-soft, var(--ink));
    margin-top: 4px;
}
.sdd-atlas-body p { margin: 0; }
.sdd-atlas-body p + p { margin-top: 2px; }

.sdd-atlas-amen {
    grid-area: amen;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    align-items: center;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 0.5px dotted var(--rule);
}
.sdd-atlas-status {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--bone-d);
    /* v647 — was a 0.5px hairline that was too thin to read as a divider
       on a busy chip row. Switch to a longer rust-2 1px rule with extra
       padding so BONE/JADE reads as a status word distinct from chips. */
    padding: 4px 10px 4px 0;
    border-right: 1px solid var(--rule-2, var(--rule));
    margin-right: 8px;
}
.sdd-atlas-status.is-jade { color: var(--jade); }
.sdd-atlas-chip {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--bone-d);
    padding: 3px 6px;
    border: 0.5px solid var(--rule);
    background: var(--paper);
}
.sdd-atlas-chip.is-negative {
    color: var(--rust);
    border-color: var(--rust);
    background: transparent;
    text-decoration: line-through;
    text-decoration-color: var(--rust);
    text-decoration-thickness: 0.5px;
}
.sdd-atlas-chip.is-note {
    color: var(--ink);
    border-color: var(--ink);
}
.sdd-atlas-city {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-soft, var(--ink));
    padding-left: 4px;
    border-left: 0.5px solid var(--rule);
    margin-left: 4px;
}
.sdd-atlas-extlink {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--ink);
    padding: 3px 6px;
    border: 0.5px solid var(--rule);
    background: transparent;
    text-decoration: none;
    margin-left: auto;
}
.sdd-atlas-extlink:hover,
.sdd-atlas-extlink:focus-visible {
    color: var(--jade);
    border-color: var(--jade);
    outline: none;
}

.sdd-atlas-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
}

.sdd-atlas-note {
    margin-top: clamp(24px, 4vw, 40px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-atlas-note p {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: 0;
}
.sdd-atlas-note p strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

@media (max-width: 768px) {
    .sdd-atlas { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    /* v7 검토 정정 — mobile head 세로 스택, count + toggle 한 행에 노출 */
    .sdd-atlas-head {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    .sdd-atlas-count {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        white-space: normal;
    }
    .sdd-atlas-view-pair { margin-left: 0; }
    .sdd-atlas-item {
        grid-template-columns: 16px 1fr;
        grid-template-areas:
            'badge head'
            '.     meta'
            '.     body'
            '.     amen';
    }
    .sdd-atlas-meta { text-align: left; margin-top: 2px; }
}

/* ─── 카페 디테일 페이지 (모달 X — 헌법 §3) ─── */
.sdd-atlas-detail {
    position: fixed; inset: 0;
    z-index: calc(var(--z-section-page, 8) + 1);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.atlas-detail-open .sdd-atlas-detail { display: block; }

.sdd-atlas-d-head {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
    margin: 0 0 clamp(20px, 3vw, 40px);
}
.sdd-atlas-d-back {
    background: transparent;
    border: 0;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    cursor: pointer;
    padding: 8px 0;
    min-height: 44px;
    transition: color .12s;
}
.sdd-atlas-d-back:hover { color: var(--rust); }
.sdd-atlas-d-page {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-atlas-d-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-atlas-d-neigh {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(20px, 3vw, 40px);
}
.sdd-atlas-d-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.5;
    color: var(--ink);
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    margin-bottom: clamp(20px, 3vw, 32px);
}
.sdd-atlas-d-body p { margin: 0 0 8px; }
.sdd-atlas-d-data {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 12px 24px;
    margin: 0 0 clamp(24px, 4vw, 40px);
}
.sdd-atlas-d-data dt {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-atlas-d-data dd {
    margin: 0;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 13px;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
}
.sdd-atlas-d-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-atlas-d-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: 0;
}
.sdd-atlas-d-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}
.sdd-atlas-d-toggle {
    background: transparent;
    border: 0.5px solid var(--ink);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 14px 24px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 4px;
    transition: background .12s, color .12s;
}
.sdd-atlas-d-toggle:hover { background: var(--ink); color: var(--paper); }

@media (max-width: 768px) {
    .sdd-atlas-detail { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-atlas-d-data { grid-template-columns: 1fr; gap: 4px 0; }
    .sdd-atlas-d-data dd { margin-bottom: 12px; }
}
`;
        document.head.appendChild(s);
    }

    // 아틀라스 § 02 전체 화면을 그린다. items = 카페 배열.
    // 순서: 루트 섹션 확보 → 통계 계산 → 검색 필터 → 헤더/행/노트 HTML 조립 → 이벤트 연결.
    function render(items) {
        // 섹션 컨테이너가 아직 DOM 에 없으면 새로 만들어 body 에 붙인다(최초 1회).
        let root = document.getElementById('sddAtlas');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddAtlas';
            root.className = 'sdd-atlas';
            document.body.appendChild(root);
        }

        // 전체 개수와 그중 JADE(최근 방문) 개수를 세어 헤더 카운터에 쓴다.
        const total = items.length;
        const visited = items.filter(c => statusFor(c) === 'JADE').length;
        const ko = (window.state && window.state.lang === 'ko');

        // v607 search filter — name/neighborhood/amenities 부분 매칭
        // 검색어를 소문자로 정규화해 이름/동네/도시/편의시설 부분 일치 검색.
        const q = _query.trim().toLowerCase();
        const filtered = q
            ? items.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.neighborhood || '').toLowerCase().includes(q) ||
                (c.city || '').toLowerCase().includes(q) ||
                (c.amenities || '').toLowerCase().includes(q)
              )
            : items;

        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'Cafés', ko: '카페,', ja: 'カフェ、', pt: 'Cafés', es: 'Cafés'
        });
        const headItalic = T({
            en: 'verified.', ko: '들른 곳.', ja: '訪れた場所。', pt: 'verificados.', es: 'verificados.'
        });
        const visitedLabel = T({
            en: `${visited} of ${total} visited`,
            ko: `${total}곳 중 ${visited}곳 방문`,
            ja: `${total}軒中 ${visited}軒 訪問済`,
            pt: `${visited} de ${total} visitados`,
            es: `${visited} de ${total} visitados`
        });
        const searchPh = T({
            en: 'SEARCH NAME · CITY · NEIGHBORHOOD · AMENITY',
            ko: '이름 · 도시 · 동네 · 편의 검색',
            ja: '名前 · 都市 · 街 · 設備で検索',
            pt: 'BUSCAR NOME · CIDADE · BAIRRO · COMODIDADE',
            es: 'BUSCAR NOMBRE · CIUDAD · BARRIO · COMODIDAD'
        });
        // v7 §8.7 PR1 — LIST/MAP 뷰 토글 (5 에디션). 두 라벨 모두 노출, 현재 모드 강조.
        const _curView = root.getAttribute('data-view') || 'list';
        const labelList = T({ en: 'LIST', ko: '목록', ja: '一覧', pt: 'LISTA', es: 'LISTA' });
        const labelMap  = T({ en: 'MAP',  ko: '지도', ja: '地図', pt: 'MAPA',  es: 'MAPA'  });
        const headHtml = `
            <header class="sdd-atlas-head">
                <h2 class="sdd-atlas-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="sdd-atlas-h2-italic">${dropItalicPunct(headItalic)}</span>
                </h2>
                <div class="sdd-atlas-count">
                    ${escapeHtml(visitedLabel)}
                    <span class="sdd-atlas-view-pair" role="tablist" aria-label="${escapeHtml(T({ en: 'View mode', ko: '보기 모드', ja: '表示モード', pt: 'Modo de visualização', es: 'Modo de visualización' }))}">
                        <button type="button" class="sdd-atlas-view-btn"
                                data-view-set="list" role="tab"
                                aria-selected="${_curView === 'list'}">${escapeHtml(labelList)}</button>
                        <span class="sdd-atlas-view-sep" aria-hidden="true">/</span>
                        <button type="button" class="sdd-atlas-view-btn"
                                data-view-set="map" role="tab"
                                aria-selected="${_curView === 'map'}">${escapeHtml(labelMap)}</button>
                    </span>
                </div>
            </header>
            <div class="sdd-atlas-search">
                <input type="search" id="sddAtlasQ" placeholder="${escapeHtml(searchPh)}"
                       value="${escapeHtml(_query)}"
                       autocomplete="off" spellcheck="false" />
                ${q ? `<span class="sdd-atlas-q-count">${filtered.length} of ${total}</span>` : ''}
            </div>
        `;

        // 필터된 카페 목록을 각각 한 줄(article)의 HTML 문자열로 변환해 이어붙인다.
        // .map(...) 은 배열을 같은 길이의 새 배열로 바꾸는 함수, .join('') 로 하나의 문자열이 된다.
        const rowsHtml = filtered.map((c, i) => {
            const status = statusFor(c);
            // 거리 표기: 1km 미만은 소수 1자리("0.4 KM"), 이상은 반올림. 없으면 빈 문자열.
            const distKm = (typeof c.distance_km === 'number')
                ? (c.distance_km < 1 ? c.distance_km.toFixed(1) : Math.round(c.distance_km * 10) / 10) + ' KM'
                : '';
            const lines = Array.isArray(c.two_lines) ? c.two_lines : [];
            const lineNum = String(i + 1).padStart(2, '0');
            // v637 — typed amenity chips. The string form ("OUTLET · WIFI ·
            // QUIET") splits into individual chips with negative-state styling
            // for NO_OUTLET / NO_CALLS / 24H, etc.
            const amenityChips = (c.amenities || '').split(/[·,\s]+/)
                .map(a => a.trim().toUpperCase()).filter(Boolean)
                .map(a => {
                    const negative = /^NO_/.test(a);
                    const note     = /^(24H|CALLS_OK)$/.test(a);
                    const cls      = negative ? 'is-negative' : (note ? 'is-note' : '');
                    return `<span class="sdd-atlas-chip ${cls}">${escapeHtml(a.replace(/_/g, ' '))}</span>`;
                }).join('');
            // v640 — photo slot only renders when c.photo exists. Earlier
            // attempts left a 96px placeholder on every card even though no
            // café in the dataset carries a photo field — 110 orphan
            // placeholders. Now the row collapses back to its 32+1fr+auto
            // grid when there is no photo, via the data-has-photo attr.
            const photoSrc = c.photo ? `/photos/cafes/${c.photo}` : null;
            const photoAlt = `${c.name} · ${c.neighborhood || ''}`.trim();
            const photoHtml = photoSrc ? `
                <figure class="sdd-atlas-photo" aria-hidden="true">
                    <div class="sdd-atlas-photo__ph">${escapeHtml(c.name.split(' ').slice(0, 2).join(' '))}</div>
                    <img class="sdd-atlas-photo__img"
                         data-sdd-atlas-photo
                         src="${escapeHtml(photoSrc)}"
                         alt="${escapeHtml(photoAlt)}"
                         loading="lazy" decoding="async" />
                </figure>
            ` : '';
            const ratingHtml = (typeof c.rating === 'number' && c.rating > 0)
                ? `★ ${c.rating.toFixed(1)}`
                : distKm;
            const cityChip = c.city
                ? ` · <span class="sdd-atlas-city">${escapeHtml(c.city)}</span>`
                : '';
            const mapsLink = c.google_url
                ? `<a class="sdd-atlas-extlink" href="${escapeHtml(c.google_url)}" target="_blank" rel="noopener" aria-label="Open in Google Maps">↗ MAPS</a>`
                : '';
            return `
                <article class="sdd-atlas-item" data-cafe-id="${c.id}" tabindex="0" role="button"
                         data-has-photo="${photoSrc ? '1' : '0'}"
                         aria-label="${escapeHtml(c.name)}, ${escapeHtml(c.neighborhood || '')}, ${distKm}">
                    <span class="sdd-atlas-badge ${status === 'JADE' ? 'jade' : 'bone'}" aria-hidden="true"></span>
                    <div class="sdd-atlas-head-line">
                        <span class="sdd-atlas-name">${lineNum} · ${escapeHtml(c.name)}</span>
                        <span class="sdd-atlas-neigh">${escapeHtml(c.neighborhood || '')}${cityChip}</span>
                    </div>
                    <span class="sdd-atlas-meta">${ratingHtml}</span>
                    <div class="sdd-atlas-body">
                        ${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}
                    </div>
                    <div class="sdd-atlas-amen">
                        <span class="sdd-atlas-status ${status === 'JADE' ? 'is-jade' : ''}">${escapeHtml(status)}</span>
                        ${amenityChips}
                        ${mapsLink}
                    </div>
                    ${photoHtml}
                </article>
            `;
        }).join('');

        // Notes from the desk (Handoff v2 §7.4) — i18n
        const noteTitle = T({
            en: 'A note on places.', ko: '편집부 메모.',
            ja: '場所についての覚書。', pt: 'Uma nota sobre os lugares.',
            es: 'Una nota sobre los lugares.'
        });
        const noteBody = T({
            en: 'We list only what we have visited. We accept no payment for inclusion. We never use a photograph that is not our own. If you are an owner and would like to be removed, write to luiseluise0619@gmail.com.',
            ko: '직접 방문한 곳만 게재한다. 입점료를 받지 않는다. 본인이 촬영하지 않은 사진은 사용하지 않는다. 삭제를 원하는 점주는 luiseluise0619@gmail.com 으로 연락 바람.',
            ja: '実際に訪れた場所のみを掲載する。掲載料は受け取らない。自身で撮影していない写真は使用しない。掲載辞退は luiseluise0619@gmail.com まで。',
            pt: 'Listamos apenas o que visitámos. Não aceitamos pagamento pela inclusão. Nunca usamos uma fotografia que não seja nossa. Se é proprietário e deseja ser removido, escreva para luiseluise0619@gmail.com.',
            es: 'Sólo listamos lo que hemos visitado. No aceptamos pago por inclusión. Nunca usamos una fotografía que no sea nuestra. Si es propietario y desea ser retirado, escriba a luiseluise0619@gmail.com.'
        });
        const noMatches = T({
            en: 'No matches.', ko: '검색 결과 없음.', ja: '該当なし。',
            pt: 'Sem resultados.', es: 'Sin resultados.'
        });
        const footLine = T({
            en: total === 0
                ? 'Awaiting first entry · 0 user reviews · 0 stars'
                : `${total} ${total === 1 ? 'place' : 'places'} · 0 user reviews · 0 stars`,
            ko: total === 0
                ? '첫 항목 대기 중 · 사용자 리뷰 0건 · 별점 0건'
                : `${total}곳 · 사용자 리뷰 0건 · 별점 0건`,
            ja: total === 0
                ? '最初の一件を待つ · ユーザーレビュー 0件 · 星 0件'
                : `${total} 軒 · ユーザーレビュー 0件 · 星 0件`,
            pt: total === 0
                ? 'A aguardar primeira entrada · 0 avaliações · 0 estrelas'
                : `${total} ${total === 1 ? 'lugar' : 'lugares'} · 0 avaliações · 0 estrelas`,
            es: total === 0
                ? 'Esperando primera entrada · 0 reseñas · 0 estrellas'
                : `${total} ${total === 1 ? 'lugar' : 'lugares'} · 0 reseñas · 0 estrellas`
        });
        const noteHtml = `
            <div class="sdd-atlas-note">
                <p>
                    <strong>${escapeHtml(noteTitle)}</strong>
                    ${escapeHtml(noteBody)}
                </p>
            </div>
        `;

        // v7 §8.7 PR1 — data-view 속성 first-render 기본값
        if (!root.hasAttribute('data-view')) root.setAttribute('data-view', 'list');

        // v7 검토 정정 — Atlas 전체 빈 상태 (cafes = [] 일 때만)
        const emptyAtlasH3 = T({
            en: 'The atlas opens with a city.',
            ko: '아틀라스는 도시 한 곳에서 시작한다.',
            ja: 'アトラスは一つの街から始まる。',
            pt: 'O atlas abre com uma cidade.',
            es: 'El atlas se abre con una ciudad.'
        });
        const emptyAtlasBody = T({
            en: 'Each café in this list is a place we have walked into. We list none until we have. Switch the desk to the city you live in, or write to suggest one we should visit.',
            ko: '이 목록에 오른 카페는 모두 우리가 직접 걸어 들어간 곳이다. 들르기 전에는 적지 않는다. 거주하는 도시로 데스크를 옮기거나, 들렀으면 하는 곳을 제안한다.',
            ja: 'この一覧に並ぶカフェは、いずれも私たちが実際に足を運んだ場所だ。訪れるまでは載せない。住む街にデスクを切り替えるか、訪ねるべき場所を知らせてほしい。',
            pt: 'Cada café desta lista é um lugar onde entrámos. Não listamos nenhum antes disso. Mude a redação para a cidade onde vive, ou escreva-nos a sugerir um que devíamos visitar.',
            es: 'Cada café de esta lista es un lugar al que hemos entrado. No listamos ninguno hasta haberlo hecho. Cambia la mesa a la ciudad donde vives, o escríbenos para sugerir uno que deberíamos visitar.'
        });
        const emptyAtlasSwitch = T({
            en: '+ Switch the desk to your home city',
            ko: '+ 데스크를 거주 도시로 옮기기',
            ja: '+ デスクを住む街へ切り替える',
            pt: '+ Mudar a redação para a sua cidade',
            es: '+ Cambiar la mesa a tu ciudad'
        });
        const emptyAtlasSubmit = T({
            en: '+ Submit a café we should visit',
            ko: '+ 들렀으면 하는 카페 제안하기',
            ja: '+ 訪ねるべきカフェを知らせる',
            pt: '+ Sugerir um café que devíamos visitar',
            es: '+ Sugerir un café que deberíamos visitar'
        });
        const isAtlasEmpty = total === 0;

        // 조립한 조각들을 하나의 innerHTML 로 한 번에 그린다(부분 조작보다 단순하고 빠르다).
        // 빈 아틀라스면 리스트 대신 빈 상태 컴포넌트가, 검색 0건이면 "No matches" 가 들어간다.
        root.innerHTML = headHtml +
            `<div id="sddAtlasEmpty"></div>` +
            (isAtlasEmpty ? '' : `<div class="sdd-atlas-list">${rowsHtml || `<div class="sdd-atlas-empty">${escapeHtml(noMatches)}</div>`}</div>`) +
            `<div class="sdd-atlas-map" id="sddAtlasMap"></div>` +
            `<div class="sdd-atlas-foot">${escapeHtml(footLine)}</div>` +
            noteHtml;

        // v636 — unified empty-state component (saudade-empty.js)
        if (isAtlasEmpty && window.SAUDADE_EMPTY) {
            // v644 — eyebrow suppressed; Atlas already shows 'CAFÉS, VERIFIED.'
            // as its big italic page header just above this block.
            window.SAUDADE_EMPTY.render('#sddAtlasEmpty', {
                eyebrow: '',
                headline: emptyAtlasH3,
                lede: escapeHtml(emptyAtlasBody),
                actions: [
                    { label: emptyAtlasSwitch.replace(/^\+\s*/, ''), kind: 'primary',
                      onClick: () => root.querySelector('[data-empty-action="switch"]')?.click()
                                  || (window.SAUDADE_FOLLOWING && window.SAUDADE_FOLLOWING.openSwitcher && window.SAUDADE_FOLLOWING.openSwitcher()) },
                    { label: emptyAtlasSubmit.replace(/^\+\s*/, ''),
                      onClick: () => root.querySelector('[data-empty-action="submit"]')?.click()
                                  || (window.SAUDADE_ATLAS_SUBMIT && window.SAUDADE_ATLAS_SUBMIT.openModal && window.SAUDADE_ATLAS_SUBMIT.openModal()) }
                ],
                note: T({
                    en: "We test outlets, noise, and Wi-Fi ourselves. We do not list a café we have not sat in.",
                    ko: '콘센트·소음·와이파이는 우리가 직접 시험한다. 앉아보지 않은 카페는 등록하지 않는다.',
                    ja: 'コンセント・騒音・Wi-Fi は自分たちで試す。座ったことのないカフェは載せない。',
                    pt: 'Testamos as tomadas, o ruído e o Wi-Fi. Não listamos um café onde não nos sentámos.',
                    es: 'Probamos enchufes, ruido y Wi-Fi. No incluimos un café donde no nos hayamos sentado.'
                })
            });
        }

        // ── innerHTML 을 새로 그렸으므로, 방금 만들어진 버튼/입력에 이벤트를 다시 붙인다. ──
        // v7 §8.7 PR1 — LIST/MAP 토글 핸들러 (페어 버튼). MAP 첫 진입 시 lazy load.
        // addEventListener('click', ...) — 버튼을 누르면 실행될 콜백을 등록.
        // async 함수라 안에서 await(비동기 대기)로 지도 모듈 초기화를 기다릴 수 있다.
        root.querySelectorAll('[data-view-set]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const next = btn.getAttribute('data-view-set');
                const cur  = root.getAttribute('data-view') || 'list';
                if (next === cur) return;
                root.setAttribute('data-view', next);
                // aria-selected 즉시 갱신 (재렌더 X — search focus 보존)
                root.querySelectorAll('[data-view-set]').forEach(b => {
                    b.setAttribute('aria-selected', String(b.getAttribute('data-view-set') === next));
                });
                if (next === 'map') {
                    const container = root.querySelector('#sddAtlasMap');
                    if (!window.SAUDADE_ATLAS_MAP || !window.SAUDADE_ATLAS_MAP.initMap) {
                        if (container) container.innerHTML = '<p class="sdd-atlas-map-error">MAP MODULE NOT LOADED · RELOAD PAGE</p>';
                        console.warn('[ATLAS] SAUDADE_ATLAS_MAP unavailable — saudade-atlas-map.js failed to load');
                        return;
                    }
                    try {
                        await window.SAUDADE_ATLAS_MAP.initMap(container);
                        if (window.SAUDADE_ATLAS_MAP.setCafes) {
                            window.SAUDADE_ATLAS_MAP.setCafes(filtered);
                        }
                    } catch (err) {
                        // v659 — was injecting err.message into innerHTML unescaped (potential XSS
                        // vector if maplibre ever surfaces user-controlled error text). escapeHtml.
                        if (container) {
                            const msg = ((err && err.message) || 'UNKNOWN ERROR').toUpperCase();
                            container.innerHTML = '<p class="sdd-atlas-map-error">MAP UNAVAILABLE · ' + escapeHtml(msg) + '</p>';
                        }
                        console.warn('[ATLAS] map init failed:', err);
                    }
                }
                // LIST 로 돌아갈 때 map 인스턴스는 유지 — 다시 토글하면 같은 상태로
            });
        });

        // v607 — search input 핸들러 (입력 변화 시 즉시 재렌더, focus 유지)
        // 'input' 이벤트는 글자를 칠 때마다 발생. 매번 render 를 다시 부르는 대신
        // 커서 위치(selectionStart)를 저장했다가 새 입력창에 복원해 타이핑이 끊기지 않게 한다.
        const qInput = root.querySelector('#sddAtlasQ');
        if (qInput) {
            qInput.addEventListener('input', (ev) => {
                _query = ev.target.value || '';
                const sel = ev.target.selectionStart;
                render(items);
                const newInput = document.getElementById('sddAtlasQ');
                if (newInput) {
                    newInput.focus();
                    try { newInput.setSelectionRange(sel, sel); } catch (e) {}
                }
            });
        }

        // v7 검토 정정 — 빈 상태 액션 (Switch desk / Submit a café)
        root.querySelectorAll('[data-empty-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-empty-action');
                if (action === 'switch') {
                    // Desk 섹션으로 이동 (THE DESK = section 04)
                    const deskBtn = document.querySelector('.dock-btn[data-cat="trip"]');
                    if (deskBtn) deskBtn.click();
                } else if (action === 'submit') {
                    // Submit a café 모듈 (saudade-atlas-submit.js)
                    if (window.SAUDADE_ATLAS_SUBMIT?.open) {
                        window.SAUDADE_ATLAS_SUBMIT.open();
                    } else {
                        // fallback — mailto desk
                        window.location.href = 'mailto:luiseluise0619@gmail.com?subject=Café suggestion';
                    }
                }
            });
        });

        // 클릭 시 cafe detail 페이지 진입 (모달 X — 헌법 §3)
        // Cafe photo fade-in. The inline onload="this.classList…" attribute
        // used to live on the <img> tag, but the page CSP is
        //   script-src 'self' https:;   (no 'unsafe-inline')
        // so the handler was blocked → .is-loaded class never added →
        // opacity stayed 0 → all cafe photos invisible. Same bug as the
        // listening-room photo fix in #120. Bind properly here instead.
        root.querySelectorAll('img[data-sdd-atlas-photo]').forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('is-loaded');
            } else {
                img.addEventListener('load',  () => img.classList.add('is-loaded'));
                img.addEventListener('error', () => img.remove());
            }
        });

        // 각 카페 행을 클릭하면 그 카페의 상세 페이지로 이동한다(모달이 아니라 전체 페이지).
        // data-cafe-id 로 클릭된 행이 어떤 카페인지 알아내 items 에서 원본 객체를 찾는다.
        root.querySelectorAll('.sdd-atlas-item').forEach(el => {
            el.addEventListener('click', (ev) => {
                const id = el.getAttribute('data-cafe-id');
                if (!id) return;
                const cafe = items.find(c => c.id === id);
                if (cafe) renderDetail(cafe);
            });
        });
    }

    // 카페 디테일 = 페이지 (모달 X)
    function renderDetail(cafe) {
        let detail = document.getElementById('sddAtlasDetail');
        if (!detail) {
            detail = document.createElement('section');
            detail.id = 'sddAtlasDetail';
            detail.className = 'sdd-atlas-detail';
            document.body.appendChild(detail);
        }
        const status = statusFor(cafe);
        const distKm = (typeof cafe.distance_km === 'number')
            ? (cafe.distance_km < 1 ? cafe.distance_km.toFixed(1) : Math.round(cafe.distance_km * 10) / 10) + ' KM'
            : '';
        const lines = Array.isArray(cafe.two_lines) ? cafe.two_lines : [];
        const visited = getVisited()[cafe.id];

        // v7 §8.10 면책 노출 필요 — list footer 와 동일 카피
        const T = window.SAUDADE_T || ((s) => s.en);
        const noteTitle = T({
            en: 'A note on places.', ko: '편집부 메모.',
            ja: '場所についての覚書。', pt: 'Uma nota sobre os lugares.',
            es: 'Una nota sobre los lugares.'
        });
        const noteBody = T({
            en: 'We list only what we have visited. We accept no payment for inclusion. We never use a photograph that is not our own. If you are an owner and would like to be removed, write to luiseluise0619@gmail.com.',
            ko: '직접 방문한 곳만 게재한다. 입점료를 받지 않는다. 본인이 촬영하지 않은 사진은 사용하지 않는다. 삭제를 원하는 점주는 luiseluise0619@gmail.com 으로 연락 바람.',
            ja: '実際に訪れた場所のみを掲載する。掲載料は受け取らない。自身で撮影していない写真は使用しない。掲載辞退は luiseluise0619@gmail.com まで。',
            pt: 'Listamos apenas o que visitámos. Não aceitamos pagamento pela inclusão. Nunca usamos uma fotografia que não seja nossa. Se é proprietário e deseja ser removido, escreva para luiseluise0619@gmail.com.',
            es: 'Sólo listamos lo que hemos visitado. No aceptamos pago por inclusión. Nunca usamos una fotografía que no sea nuestra. Si es propietario y desea ser retirado, escriba a luiseluise0619@gmail.com.'
        });

        detail.innerHTML = `
            <header class="sdd-atlas-d-head">
                <button class="sdd-atlas-d-back" data-d-back>← BACK TO ATLAS</button>
                <span class="sdd-atlas-d-page">P. ${(cafe.id || '').slice(0,8).toUpperCase()}</span>
            </header>
            <h2 class="sdd-atlas-d-h2">
                ${escapeHtml(cafe.name)}
            </h2>
            <p class="sdd-atlas-d-neigh">${escapeHtml(cafe.neighborhood || '')} · ${distKm}</p>
            <div class="sdd-atlas-d-body">
                ${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}
            </div>
            <dl class="sdd-atlas-d-data">
                <dt>Status</dt>
                <dd>${status}${visited ? ' · visited ' + new Date(visited).toISOString().slice(0,10) : ''}</dd>
                <dt>Seen</dt>
                <dd>${cafe.visited_at ? new Date(cafe.visited_at).toISOString().slice(0,10) : 'pending review'}</dd>
                <dt>Amenities</dt>
                <dd>${escapeHtml(cafe.amenities || '')}</dd>
            </dl>
            <div class="sdd-atlas-d-actions">
                <button class="sdd-atlas-d-toggle" data-toggle-visit>
                    ${visited ? 'MARK UNVISITED' : 'MARK AS VISITED'}
                </button>
            </div>
            <!-- v7 §8.10 — cafe detail 페이지에도 면책 노출 (어디서든 보이게) -->
            <footer class="sdd-atlas-d-foot">
                <p class="sdd-atlas-d-disclaimer">
                    <strong>${escapeHtml(noteTitle)}</strong>
                    ${escapeHtml(noteBody)}
                </p>
            </footer>
        `;
        // body 에 클래스를 붙이면 CSS 가 상세 페이지를 화면 위로 띄운다.
        document.body.classList.add('atlas-detail-open');

        // "← BACK TO ATLAS" — 클래스를 떼어 상세 페이지를 닫고 목록으로 돌아간다.
        detail.querySelector('[data-d-back]').addEventListener('click', () => {
            document.body.classList.remove('atlas-detail-open');
        });
        // 방문 표시 토글: 이미 방문(cur)이면 null 로 지우고, 아니면 지금 시각을 기록.
        detail.querySelector('[data-toggle-visit]').addEventListener('click', () => {
            const cur = getVisited()[cafe.id];
            setVisited(cafe.id, cur ? null : Date.now());
            renderDetail(cafe);
            // 메인 리스트도 갱신 (다음 진입 시 반영)
            load().then(items => render(items));
        });
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
    // v7 검토 정정 — italic 헤드라인 마침표 regular 분리
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }

    // 모듈 초기화: 스타일 주입 + 첫 렌더 + 섹션 진입 감지.
    function init() {
        injectStyles();
        load().then(items => render(items));
        // body section 변경 감지 — 02 진입 시 재렌더 (JADE/BONE 새로고침)
        // MutationObserver — DOM 변화를 감시하는 브라우저 API.
        // body 의 data-section 속성이 바뀔 때마다 콜백이 돌아, § 02(아틀라스)로
        // 들어온 순간 다시 그려 JADE/BONE 상태를 최신으로 새로고침한다.
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '02') {
                load().then(items => render(items));
            }
        });
        // body 의 attributes 중 data-section 만 관찰(불필요한 콜백을 줄인다).
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
    }

    // 문서가 아직 로딩 중이면 DOM 준비 완료(DOMContentLoaded) 후 init, 이미 끝났으면 즉시 init.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 이 모듈의 공개 API 를 window 전역에 붙여 다른 모듈이 호출할 수 있게 한다.
    // reload 는 캐시(_cafes)를 비우고 다시 초기화한다(에디션/도시 전환 시 사용).
    window.SAUDADE_ATLAS = { reload: () => { _cafes = null; init(); }, statusFor, getVisited, setVisited };
})();
