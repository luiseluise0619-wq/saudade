// SAUDADE · § 02 THE ATLAS (헌법 §4-3, §11)
// data/cafes-seoul.json 시드 → 매거진 리스트. 카드 X, 1px rule.
// 별점 X — JADE (visited) / BONE (unvisited) 두 상태만.
// 거리 표기 "0.4 KM" mono. 분 표기 X.
// 자동 강등: visited_at + 30일 < 오늘 → JADE → BONE.
'use strict';

(function() {
    if (window.SAUDADE_ATLAS) return;

    const VISITED_KEY = 'saudade.atlas.visited';     // 헌법 §9 키
    let _cafes = null;
    let _query = '';     // v607 검색 query

    function load() {
        if (_cafes) return Promise.resolve(_cafes);
        return fetch('./data/cafes-seoul.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : [])
            .then(d => { _cafes = Array.isArray(d) ? d : []; return _cafes; })
            .catch(() => { _cafes = []; return _cafes; });
    }

    // 방문 기록 — saudade.atlas.visited = { id: timestamp_ms }
    function getVisited() {
        try { return JSON.parse(localStorage.getItem(VISITED_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function setVisited(id, ts) {
        const all = getVisited();
        if (ts) all[id] = ts; else delete all[id];
        try { localStorage.setItem(VISITED_KEY, JSON.stringify(all)); } catch (e) {}
    }

    // 30일 이내 방문 = JADE, 그 외 = BONE
    function statusFor(c) {
        const v = getVisited();
        const ts = v[c.id];
        if (ts && (Date.now() - ts) < 30 * 86400000) return 'JADE';
        // visited_at 시드 값도 확인 (서버 큐레이션 데이터)
        if (c.visited_at) {
            const seedTs = new Date(c.visited_at).getTime();
            if (Number.isFinite(seedTs) && (Date.now() - seedTs) < 30 * 86400000) return 'JADE';
        }
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
.sdd-atlas-item:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-atlas-item:hover { background: var(--paper-d); }

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
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-top: 6px;
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

    function render(items) {
        let root = document.getElementById('sddAtlas');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddAtlas';
            root.className = 'sdd-atlas';
            document.body.appendChild(root);
        }

        const total = items.length;
        const visited = items.filter(c => statusFor(c) === 'JADE').length;
        const ko = (window.state && window.state.lang === 'ko');

        // v607 search filter — name/neighborhood/amenities 부분 매칭
        const q = _query.trim().toLowerCase();
        const filtered = q
            ? items.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.neighborhood || '').toLowerCase().includes(q) ||
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
            en: 'SEARCH NAME · NEIGHBORHOOD · AMENITY',
            ko: '이름 · 동네 · 편의 검색',
            ja: '名前 · 街 · 設備で検索',
            pt: 'BUSCAR NOME · BAIRRO · COMODIDADE',
            es: 'BUSCAR NOMBRE · BARRIO · COMODIDAD'
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
                    <span class="sdd-atlas-view-pair" role="tablist" aria-label="View mode">
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

        const rowsHtml = filtered.map((c, i) => {
            const status = statusFor(c);
            const distKm = (typeof c.distance_km === 'number')
                ? (c.distance_km < 1 ? c.distance_km.toFixed(1) : Math.round(c.distance_km * 10) / 10) + ' KM'
                : '';
            const lines = Array.isArray(c.two_lines) ? c.two_lines : [];
            const lineNum = String(i + 1).padStart(2, '0');
            return `
                <article class="sdd-atlas-item" data-cafe-id="${c.id}" tabindex="0" role="button"
                         aria-label="${c.name}, ${c.neighborhood || ''}, ${distKm}">
                    <span class="sdd-atlas-badge ${status === 'JADE' ? 'jade' : 'bone'}" aria-hidden="true"></span>
                    <div class="sdd-atlas-head-line">
                        <span class="sdd-atlas-name">${lineNum} · ${c.name}</span>
                        <span class="sdd-atlas-neigh">${c.neighborhood || ''}</span>
                    </div>
                    <span class="sdd-atlas-meta">${distKm}</span>
                    <div class="sdd-atlas-body">
                        ${lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}
                    </div>
                    <div class="sdd-atlas-amen">${status} · ${c.amenities || ''}</div>
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
            en: 'We list only what we have visited. We accept no payment for inclusion. We never use a photograph that is not our own. If you are an owner and would like to be removed, write to desk@saudade.app.',
            ko: '직접 방문한 곳만 게재한다. 입점료를 받지 않는다. 본인이 촬영하지 않은 사진은 사용하지 않는다. 삭제를 원하는 점주는 desk@saudade.app 으로 연락 바람.',
            ja: '実際に訪れた場所のみを掲載する。掲載料は受け取らない。自身で撮影していない写真は使用しない。掲載辞退は desk@saudade.app まで。',
            pt: 'Listamos apenas o que visitámos. Não aceitamos pagamento pela inclusão. Nunca usamos uma fotografia que não seja nossa. Se é proprietário e deseja ser removido, escreva para desk@saudade.app.',
            es: 'Sólo listamos lo que hemos visitado. No aceptamos pago por inclusión. Nunca usamos una fotografía que no sea nuestra. Si es propietario y desea ser retirado, escriba a desk@saudade.app.'
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
        const atlasEmptyHtml = isAtlasEmpty ? `
            <section class="sdd-atlas-empty-state">
                <h3 class="sdd-atlas-empty-h3">${escapeHtml(emptyAtlasH3)}</h3>
                <p class="sdd-atlas-empty-body">${escapeHtml(emptyAtlasBody)}</p>
                <ul class="sdd-atlas-empty-actions">
                    <li><button type="button" class="sdd-atlas-empty-btn" data-empty-action="switch">${escapeHtml(emptyAtlasSwitch)}</button></li>
                    <li><button type="button" class="sdd-atlas-empty-btn" data-empty-action="submit">${escapeHtml(emptyAtlasSubmit)}</button></li>
                </ul>
            </section>
        ` : '';

        root.innerHTML = headHtml +
            atlasEmptyHtml +
            (isAtlasEmpty ? '' : `<div class="sdd-atlas-list">${rowsHtml || `<div class="sdd-atlas-empty">${escapeHtml(noMatches)}</div>`}</div>`) +
            `<div class="sdd-atlas-map" id="sddAtlasMap"></div>` +
            `<div class="sdd-atlas-foot">${escapeHtml(footLine)}</div>` +
            noteHtml;

        // v7 §8.7 PR1 — LIST/MAP 토글 핸들러 (페어 버튼). MAP 첫 진입 시 lazy load.
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
                    } catch (err) {
                        if (container) container.innerHTML = '<p class="sdd-atlas-map-error">MAP UNAVAILABLE · ' + (err && err.message || 'UNKNOWN ERROR').toUpperCase() + '</p>';
                        console.warn('[ATLAS] map init failed:', err);
                    }
                }
                // LIST 로 돌아갈 때 map 인스턴스는 유지 — 다시 토글하면 같은 상태로
            });
        });

        // v607 — search input 핸들러 (입력 변화 시 즉시 재렌더, focus 유지)
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
                        window.location.href = 'mailto:desk@saudade.app?subject=Café suggestion';
                    }
                }
            });
        });

        // 클릭 시 cafe detail 페이지 진입 (모달 X — 헌법 §3)
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
            en: 'We list only what we have visited. We accept no payment for inclusion. We never use a photograph that is not our own. If you are an owner and would like to be removed, write to desk@saudade.app.',
            ko: '직접 방문한 곳만 게재한다. 입점료를 받지 않는다. 본인이 촬영하지 않은 사진은 사용하지 않는다. 삭제를 원하는 점주는 desk@saudade.app 으로 연락 바람.',
            ja: '実際に訪れた場所のみを掲載する。掲載料は受け取らない。自身で撮影していない写真は使用しない。掲載辞退は desk@saudade.app まで。',
            pt: 'Listamos apenas o que visitámos. Não aceitamos pagamento pela inclusão. Nunca usamos uma fotografia que não seja nossa. Se é proprietário e deseja ser removido, escreva para desk@saudade.app.',
            es: 'Sólo listamos lo que hemos visitado. No aceptamos pago por inclusión. Nunca usamos una fotografía que no sea nuestra. Si es propietario y desea ser retirado, escriba a desk@saudade.app.'
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
        document.body.classList.add('atlas-detail-open');

        detail.querySelector('[data-d-back]').addEventListener('click', () => {
            document.body.classList.remove('atlas-detail-open');
        });
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

    function init() {
        injectStyles();
        load().then(items => render(items));
        // body section 변경 감지 — 02 진입 시 재렌더 (JADE/BONE 새로고침)
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '02') {
                load().then(items => render(items));
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_ATLAS = { reload: () => { _cafes = null; init(); }, statusFor, getVisited, setVisited };
})();
