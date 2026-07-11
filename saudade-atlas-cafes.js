// SAUDADE · § 02 ATLAS — 카페 마커 + 메타데이터 어휘 풀 (v7 §8.6 + §8.8)
// PR4 / 5
//
// §8.6 카페 마커:
//   - 잡지 footnote 박스: 1.5px outline 정사각형 + 숫자 (Atlas 리스트 번호 매칭)
//   - 색은 --ink. 둥근 X · 그림자 X · 펄스 X.
//   - 클릭 → 기존 renderDetail()
//
// §8.8 메타데이터:
//   - 어휘 풀: data/cafe-vocabulary.json (자유 입력 X)
//   - amenities (키 배열) + best_for/known_for/not_for (키 배열) + editor_note
//   - 5 에디션
//
// 의존: saudade-atlas-map.js (PR1) · saudade-atlas.js (기존 cafe data + renderDetail)
'use strict';

// IIFE — 로드 즉시 실행. 아틀라스 지도 위 카페 마커 + 상세 메타데이터를 담당하는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_ATLAS_CAFES) return;

    // _vocab: 어휘 풀 JSON 캐시. _vocabLoading: 로드 중 Promise(중복 방지).
    // _markers: 지도에 붙은 마커 배열. _bound: 바인딩 여부 플래그.
    let _vocab = null;
    let _vocabLoading = null;
    let _markers = [];
    let _bound = false;

    // L — 여러 언어 문자열 중 현재 에디션 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    // ed — 현재 에디션 코드(en/ko/ja/pt/es)를 반환.
    function ed() {
        return (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
    }

    // loadVocabulary — 카페 메타 어휘 풀을 한 번만 로드해 캐시(force-cache).
    function loadVocabulary() {
        if (_vocab) return Promise.resolve(_vocab);
        if (_vocabLoading) return _vocabLoading;
        _vocabLoading = fetch('./data/cafe-vocabulary.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _vocab = d || {}; return _vocab; })
            .catch(() => { _vocab = {}; return _vocab; });
        return _vocabLoading;
    }

    // phraseOf — 어휘 그룹+키를 현재 에디션 문구로. 자유 입력이 아니라 정의된 어휘만 쓴다.
    // 어휘 키 → 현재 에디션 phrase
    function phraseOf(group, key) {
        const e = ed();
        const item = _vocab && _vocab[group] && _vocab[group][key];
        if (!item) return key;   // 미정의 키 — fallback to key
        return item[e] || item.en || key;
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddCafeMarkerStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCafeMarkerStyles';
        s.textContent = `
/* §8.6 카페 마커 — 잡지 footnote 박스 (1.5px outline 정사각형 + 숫자) */
.sdd-cafe-marker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    background: var(--paper);
    border: 1.5px solid var(--ink);
    border-radius: 0;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0;
    color: var(--ink);
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    transition: background .12s;
}
.sdd-cafe-marker:hover  { background: var(--paper-d); }
.sdd-cafe-marker:focus  { outline: 1px dotted var(--ink); outline-offset: 2px; }
.sdd-cafe-marker.jade   { border-color: var(--jade); color: var(--jade); }

/* §8.8 — Atlas detail 의 새 메타데이터 영역 */
.sdd-atlas-d-amen-pool {
    margin: clamp(20px, 3vw, 32px) 0 0;
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-atlas-d-tag-row {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 16px;
    padding: 10px 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-atlas-d-tag-row:first-of-type { border-top: 0; }
.sdd-atlas-d-tag-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}
.sdd-atlas-d-tag-list {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-atlas-d-editor-note {
    margin: clamp(20px, 3vw, 32px) 0 0;
    padding: clamp(16px, 2vw, 24px) 0 0;
    border-top: 0.5px solid var(--rule);
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
}
.sdd-atlas-d-editor-sig {
    display: block;
    margin-top: 12px;
    font-family: var(--mono);
    font-weight: 500;
    font-style: normal;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
}

@media print {
    /* 마커는 인쇄 시 숨김 — atlas LIST 가 인쇄 기본 */
    .sdd-cafe-marker { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    // ─── 마커 렌더 (지도 위) ─────────────────────────────────
    // clearMarkers — 지도의 카페 마커를 모두 제거하고 배열을 비운다.
    function clearMarkers() {
        _markers.forEach(m => { try { m.remove(); } catch (e) {} });
        _markers = [];
    }

    // renderMarkers — 카페 목록을 번호 붙은 정사각 마커로 지도에 그린다(방문지는 jade).
    function renderMarkers(cafes) {
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map || !window.maplibregl) return;
        clearMarkers();
        cafes.forEach((c, i) => {
            // 좌표 없는 카페는 마커를 찍지 않는다.
            if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return;
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'sdd-cafe-marker';
            el.textContent = String(i + 1).padStart(2, '0');
            el.setAttribute('aria-label', c.name || '');
            // visited → jade outline (statusFor 조회)
            try {
                if (window.SAUDADE_ATLAS && window.SAUDADE_ATLAS.statusFor) {
                    const status = window.SAUDADE_ATLAS.statusFor(c);
                    if (status === 'JADE') el.classList.add('jade');
                }
            } catch (e) {}
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetail(c);
            });
            const m = new window.maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([c.lng, c.lat])
                .addTo(map);
            _markers.push(m);
        });
    }

    // openDetail — 마커 클릭 시 아틀라스의 상세 화면을 연다(리스트 항목 클릭을 우회 호출).
    // 기존 atlas 의 renderDetail 호출 — 직접 export 안 됐으면 클릭 시뮬레이션 fallback
    function openDetail(cafe) {
        // 기존 renderDetail 함수가 모듈 내부 — DOM 의 atlas-item 클릭으로 우회
        const item = document.querySelector(`.sdd-atlas-item[data-cafe-id="${cafe.id}"]`);
        if (item) {
            item.click();
            // detail 페이지 마운트 후 메타데이터 영역 추가
            setTimeout(() => augmentDetailWithMetadata(cafe), 50);
            return;
        }
        // atlas 가 LIST 로 안 그려져 있으면 — atlas reload 후 재시도
        if (window.SAUDADE_ATLAS && window.SAUDADE_ATLAS.reload) {
            window.SAUDADE_ATLAS.reload();
            setTimeout(() => {
                const it = document.querySelector(`.sdd-atlas-item[data-cafe-id="${cafe.id}"]`);
                if (it) {
                    it.click();
                    setTimeout(() => augmentDetailWithMetadata(cafe), 50);
                }
            }, 200);
        }
    }

    // ─── §8.8 메타데이터 — atlas detail 페이지에 추가 렌더 ────
    // augmentDetailWithMetadata — 상세 화면에 편의시설/태그/편집장 노트 영역을 덧붙인다.
    function augmentDetailWithMetadata(cafe) {
        const detail = document.getElementById('sddAtlasDetail');
        if (!detail) return;
        // 이미 추가했으면 skip (중복 방지)
        if (detail.querySelector('.sdd-atlas-d-amen-pool')) return;

        const amenKeys = Array.isArray(cafe.amenities_keys) ? cafe.amenities_keys : null;
        const bestFor  = Array.isArray(cafe.best_for)  ? cafe.best_for  : null;
        const knownFor = Array.isArray(cafe.known_for) ? cafe.known_for : null;
        const notFor   = Array.isArray(cafe.not_for)   ? cafe.not_for   : null;
        const editorNote = typeof cafe.editor_note === 'string' ? cafe.editor_note : null;

        if (!amenKeys && !bestFor && !knownFor && !notFor && !editorNote) return;

        const labelBest = L({ en: 'BEST FOR',  ko: '추천',     ja: 'おすすめ',     pt: 'IDEAL PARA', es: 'IDEAL PARA' });
        const labelKnown= L({ en: 'KNOWN FOR', ko: '알려진 점',ja: '知られる点',   pt: 'CONHECIDO POR','es': 'CONOCIDO POR' });
        const labelNot  = L({ en: 'NOT FOR',   ko: '비추',     ja: '不向き',       pt: 'EVITAR PARA',  es: 'NO IDEAL PARA' });
        const labelSig  = L({ en: '— EDITOR.', ko: '— 편집장.', ja: '— 編集長。',   pt: '— EDITOR.',    es: '— EDITOR.' });

        const sec = document.createElement('section');
        sec.className = 'sdd-atlas-d-amen-pool';
        sec.innerHTML = '';

        // amenities (sentence-style mono caps · separator)
        if (amenKeys && amenKeys.length) {
            const phrases = amenKeys.map(k => phraseOf('amenity_phrases', k)).filter(Boolean);
            const p = document.createElement('p');
            p.style.margin = '0 0 12px';
            p.textContent = phrases.join('. ') + '.';
            sec.appendChild(p);
        }

        // 3 태그
        const rows = [
            { label: labelBest,  group: 'best_for',  list: bestFor },
            { label: labelKnown, group: 'known_for', list: knownFor },
            { label: labelNot,   group: 'not_for',   list: notFor }
        ];
        rows.forEach(r => {
            if (!r.list || !r.list.length) return;
            const div = document.createElement('div');
            div.className = 'sdd-atlas-d-tag-row';
            const labelEl = document.createElement('span');
            labelEl.className = 'sdd-atlas-d-tag-label';
            labelEl.textContent = r.label;
            const listEl = document.createElement('span');
            listEl.className = 'sdd-atlas-d-tag-list';
            listEl.textContent = r.list.map(k => phraseOf(r.group, k)).join(' · ');
            div.appendChild(labelEl);
            div.appendChild(listEl);
            sec.appendChild(div);
        });

        if (editorNote) {
            const note = document.createElement('p');
            note.className = 'sdd-atlas-d-editor-note';
            note.textContent = editorNote;
            const sig = document.createElement('span');
            sig.className = 'sdd-atlas-d-editor-sig';
            sig.textContent = labelSig;
            note.appendChild(sig);
            sec.appendChild(note);
        }

        // 기존 actions 직전 삽입
        const actions = detail.querySelector('.sdd-atlas-d-actions');
        if (actions) actions.parentNode.insertBefore(sec, actions);
        else detail.appendChild(sec);
    }

    // ─── 데이터 로드 + 마커 트리거 ────────────────────────────
    // Loads cafés from all five city files in parallel. Each file holds
    // only the cafés that have been verified against Google Places (lat/
    // lng, real rating). Unverified candidates live in cafes-{city}.
    // candidates.json and are NOT loaded here.
    const CAFE_CITY_FILES = [
        'cafes-seoul.json',
        'cafes-da-nang.json',
        'cafes-bali.json',
        'cafes-tokyo.json',
        'cafes-lisbon.json'
    ];
    // loadCafes — 5개 도시 카페 파일을 병렬로 로드해 하나의 배열로 합친다(검증된 카페만).
    function loadCafes() {
        return Promise.all(CAFE_CITY_FILES.map(f =>
            fetch(`./data/${f}`, { cache: 'force-cache' })
                .then(r => r.ok ? r.json() : [])
                .then(d => Array.isArray(d) ? d : [])
                .catch(() => [])
        )).then(arrs => arrs.flat());
    }

    // applyMarkers — 카페와 어휘를 함께 로드한 뒤 마커를 그린다.
    function applyMarkers() {
        Promise.all([loadCafes(), loadVocabulary()]).then(([cafes]) => {
            renderMarkers(cafes);
        });
    }

    // watchMap — 지도와 아틀라스가 준비되면 마커를 심고, MAP 뷰 진입마다 재확인.
    function watchMap() {
        // map 준비 + atlas 가 MAP 뷰일 때만 마커 표시
        const iv = setInterval(() => {
            const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
            const atlas = document.getElementById('sddAtlas');
            if (map && atlas) {
                clearInterval(iv);
                if (map.isStyleLoaded()) {
                    applyMarkers();
                } else {
                    map.once('load', applyMarkers);
                }
                // atlas data-view 변경 시 — MAP 진입 때마다 마커 재확인
                const mo = new MutationObserver(() => {
                    if (atlas.getAttribute('data-view') === 'map' && _markers.length === 0) {
                        applyMarkers();
                    }
                });
                mo.observe(atlas, { attributes: true, attributeFilter: ['data-view'] });
            }
        }, 200);
    }

    function watchEdition() {
        const mo = new MutationObserver(() => {
            // edition 변경 — 이미 렌더된 detail 의 phrase 가 stale. 다음 detail 진입 시 augment 다시.
            // 마커는 숫자만이라 edition 영향 X.
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    // init — 모듈 시동: 스타일 주입 + 어휘 선로드 + 지도/에디션 감시 시작.
    function init() {
        injectStyles();
        loadVocabulary();
        watchMap();
        watchEdition();
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시(150ms 지연으로 지도 모듈 뒤).
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150));
    } else {
        setTimeout(init, 150);
    }

    // 전역 공개 API — 마커 재로딩/제거 + 어휘 조회.
    window.SAUDADE_ATLAS_CAFES = {
        reloadMarkers: applyMarkers,
        clearMarkers,
        phraseOf,
        loadVocabulary
    };
})();
