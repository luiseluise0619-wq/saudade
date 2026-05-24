// SAUDADE · § 02 ATLAS — Paper Map (v7 §8.1 GPS 정책 + §8.7 paper map)
//
// PR1 / 5 — 지도 베이스. MapLibre + OSM raster, paper-tone 스타일.
// 이 PR 에선 GPS 호출 0줄, 동심원 0개, 카페 마커 0개.
// PR2 (§8.2/§8.3/§8.5), PR3 (§8.4), PR4 (§8.6/§8.8) 에서 추가.
//
// v7 §8.1 GPS 정책 (코드 적용은 PR2):
//   - GPS 는 Atlas 동심원 + 카페 거리 계산에만. 도시 매칭에는 X.
//   - 클라이언트 only · 서버 전송 0건.
//   - 갱신: 15초 + 30m 임계값.
//
// v7 §8.7 paper map 타일 (정정 — v1/v2 분리, 사용자 결정 후):
//   v1 (현재): OSM raster + CSS filter — 운영비 0 우선. 솔로 파운더 시간 우선.
//     - MapLibre + OSM raster (무료, 키 없음)
//     - paper tone: 배경 paper-d 근사 (CSS filter)
//     - Mapbox/Maptiler X (유료, §13 위배)
//     - trade-off 인정: 도로·라벨 §17.5 정밀 통과 X (paper × road 1.05~1.16:1)
//   v2 (Y2+, 사용자 5,000명+ 후): vector style 도입 검토.
//     - 옵션: 자체 pmtiles 호스팅 R2 + Maputnik 또는 OSM Bright fork
//     - 운영비 추정: R2 도시 단위 ($0~$0.5/월)
//     - PR3 자체검수 B 항목 → v2 백로그 이동 (사용자 결정).
//
// Lazy load: MapLibre CDN 은 사용자가 MAP 토글 클릭하는 시점에만 로드.
// (검수 항목 A — atlas 진입 자체는 부담 X)
'use strict';

(function() {
    if (window.SAUDADE_ATLAS_MAP) return;

    let _map = null;
    let _ml  = null;
    let _loadPromise = null;
    let _markers = [];
    let _noticeEl = null;

    // unpkg CDN — 키 X, 무료. 버전 핀.
    const ML_VERSION = '4.7.1';
    const ML_JS_URL  = `https://unpkg.com/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.js`;
    const ML_CSS_URL = `https://unpkg.com/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.css`;

    // 기본 중심: Seoul (cafes-seoul.json 기반). 카페 마커 추가 (PR4) 시
    // 자동 fitBounds 로 변경 가능.
    const DEFAULT_CENTER = [126.9780, 37.5665];
    const DEFAULT_ZOOM   = 13;

    // OSM standard tile. attribution 필수 (검수 항목 E).
    const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const OSM_ATTR  = '© OpenStreetMap contributors';

    // MapLibre style spec — raster only. 단일 레이어.
    // (vector style 전환은 PR3 — Maputnik/OSM Bright fork)
    const PAPER_RASTER_STYLE = {
        version: 8,
        sources: {
            osm: {
                type: 'raster',
                tiles: [OSM_TILES],
                tileSize: 256,
                attribution: OSM_ATTR,
                minzoom: 0,
                maxzoom: 19
            }
        },
        layers: [
            { id: 'osm-raster', type: 'raster', source: 'osm' }
        ]
    };

    function loadMapLibre() {
        if (_ml) return Promise.resolve(_ml);
        if (_loadPromise) return _loadPromise;
        // CSS 먼저
        if (!document.querySelector(`link[data-sdd-ml]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = ML_CSS_URL;
            link.setAttribute('data-sdd-ml', '1');
            document.head.appendChild(link);
        }
        _loadPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = ML_JS_URL;
            s.async = true;
            s.onload = () => {
                if (window.maplibregl) {
                    _ml = window.maplibregl;
                    resolve(_ml);
                } else {
                    reject(new Error('MapLibre loaded but window.maplibregl undefined'));
                }
            };
            s.onerror = () => reject(new Error('MapLibre CDN load failed'));
            document.head.appendChild(s);
        });
        return _loadPromise;
    }

    function injectStyles() {
        if (document.getElementById('sddAtlasMapStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddAtlasMapStyles';
        s.textContent = `
/* v7 §8.7 — atlas map 컨테이너. data-view="list" 일 땐 숨김. */
.sdd-atlas-map {
    width: 100%;
    height: calc(100vh - 240px);
    min-height: 360px;
    position: relative;
    background: var(--paper-d);
    border: 0.5px solid var(--rule);
    margin: clamp(12px, 2vw, 20px) 0 clamp(20px, 3vw, 32px);
    overflow: hidden;
}
.sdd-atlas[data-view="list"] .sdd-atlas-map { display: none; }
.sdd-atlas[data-view="map"]  .sdd-atlas-list,
.sdd-atlas[data-view="map"]  .sdd-atlas-search,
.sdd-atlas[data-view="map"]  .sdd-atlas-foot,
.sdd-atlas[data-view="map"]  .sdd-atlas-note,
.sdd-atlas[data-view="map"]  .sdd-atlas-empty-state { display: none; }
/* MAP 뷰에선 지도가 화면 대부분을 차지 — empty state 가 위에 떠서 지도 가리던 문제 정정 */

/* v7 §8.7 — paper tone. CSS filter 임시 (PR3 안에 vector style 로 교체).
   목표 근사: bg ≈ paper-d, 도로 ≈ bone. 디지털 잡지 종이 톤. */
.sdd-atlas-map .maplibregl-canvas {
    filter: grayscale(1) contrast(0.92) brightness(1.06) sepia(0.18);
}

/* MapLibre 컨트롤 잡지 톤 재스타일 (v7 검토 정정) — 둥근/그림자 X, +/− 텍스트 명시 */
.sdd-atlas-map .maplibregl-ctrl-group {
    background: var(--paper);
    border: 0.5px solid var(--rule);
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
}
.sdd-atlas-map .maplibregl-ctrl-group button {
    background: var(--paper);
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    width: 36px;
    height: 36px;
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 18px;
    line-height: 1;
    text-align: center;
    cursor: pointer;
    position: relative;
}
.sdd-atlas-map .maplibregl-ctrl-group button:last-child { border-bottom: 0; }
.sdd-atlas-map .maplibregl-ctrl-group button:hover     { background: var(--paper-d); }
.sdd-atlas-map .maplibregl-ctrl-group button:focus     { outline: 0.5px solid var(--ink); outline-offset: -3px; }

/* SVG 아이콘 숨기고 명확한 +/− 글리프로 교체 (mock-up "|" "·" 알아보기 X 정정) */
.sdd-atlas-map .maplibregl-ctrl-icon { display: none; }
.sdd-atlas-map .maplibregl-ctrl-zoom-in::before  { content: '+'; }
.sdd-atlas-map .maplibregl-ctrl-zoom-out::before { content: '−'; }
.sdd-atlas-map .maplibregl-ctrl-zoom-in::before,
.sdd-atlas-map .maplibregl-ctrl-zoom-out::before {
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 20px;
    line-height: 36px;
    display: block;
}

/* attribution — 항상 노출 (검수 항목 E, OSM TOS) */
.sdd-atlas-map .maplibregl-ctrl-attrib {
    background: var(--paper);
    border: 0.5px solid var(--rule);
    border-radius: 0;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    padding: 4px 8px;
    margin: 0;
    box-shadow: none;
}
.sdd-atlas-map .maplibregl-ctrl-attrib.maplibregl-compact {
    min-height: 24px;
    padding: 4px 24px 4px 8px;
}
.sdd-atlas-map .maplibregl-ctrl-attrib a {
    color: var(--bone-d);
    text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-atlas-map .maplibregl-ctrl-attrib a:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-atlas-map .maplibregl-ctrl-attrib-button {
    background-color: var(--paper);
    border: 0.5px solid var(--rule);
}

/* MAP/LIST 토글 페어 — 두 라벨 모두 노출, 현재 모드 강조 (v7 검토 정정).
   global button:not(...) 규칙이 box border 강제하므로 !important 명시. */
.sdd-atlas-view-pair {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    margin-left: 16px;
}
.sdd-atlas-view-btn {
    background: transparent !important;
    border: 0 !important;
    border-bottom: 1px solid transparent !important;
    color: var(--bone-d) !important;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 6px 4px !important;
    min-height: 44px;
    border-radius: 0 !important;
    transition: color .12s, border-color .12s;
}
.sdd-atlas-view-btn:hover { color: var(--ink) !important; border-color: transparent !important; }
.sdd-atlas-view-btn:focus { outline: 0.5px solid var(--ink); outline-offset: 2px; }
.sdd-atlas-view-btn[aria-selected="true"] {
    color: var(--ink) !important;
    border-bottom: 1px solid var(--rust) !important;
}
.sdd-atlas-view-sep {
    color: var(--bone-d);
    font-family: var(--mono);
    font-size: 11px;
    opacity: 0.5;
    user-select: none;
}

/* 로드 실패 안내 — 잡지 톤 */
.sdd-atlas-map-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    padding: 24px;
    text-align: center;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
}

/* 좌표 데이터 부재 안내 — 지도는 뜨지만 마커 0개일 때.
   잡지 톤 카드. 지도 위에 떠서 사용자가 '왜 비었나' 혼란 막음. */
.sdd-atlas-map-notice {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    max-width: 360px;
    background: var(--paper);
    border: 0.5px solid var(--rule);
    padding: 12px 14px;
    z-index: 5;
    pointer-events: none;
}
.sdd-atlas-map-notice__h {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
    margin: 0 0 4px;
}
.sdd-atlas-map-notice__p {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-meta);
    color: var(--bone-d);
    margin: 0;
}

/* 카페 마커 — 종이 톤 점. JADE (visited) vs BONE (vetted) 구분. */
.sdd-atlas-marker {
    width: 12px;
    height: 12px;
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 50%;
    cursor: pointer;
    transition: transform .12s ease;
}
.sdd-atlas-marker.is-jade { background: var(--jade); border-color: var(--jade); }
.sdd-atlas-marker:hover   { transform: scale(1.5); }

/* MapLibre popup 잡지 톤 재스타일 */
.sdd-atlas-map .maplibregl-popup-content {
    background: var(--paper);
    border: 0.5px solid var(--rule);
    border-radius: 0;
    box-shadow: none;
    padding: 10px 12px;
    font-family: var(--mono);
    font-size: 10px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    color: var(--ink);
    text-transform: uppercase;
}
.sdd-atlas-map .maplibregl-popup-tip { display: none; }
.sdd-atlas-map .maplibregl-popup-close-button {
    color: var(--bone-d);
    font-family: var(--mono);
    font-size: 14px;
    padding: 2px 6px;
}

@media (max-width: 768px) {
    .sdd-atlas-map { height: calc(100vh - 200px); }
    /* 모바일은 핀치 줌 우선 — 컨트롤 제거로 화면 정리 (v7 검토 정정) */
    .sdd-atlas-map .maplibregl-ctrl-top-right { display: none !important; }
}

/* 검수 항목 F — 인쇄 시 LIST 강제. 지도 무력화. */
@media print {
    .sdd-atlas-map { display: none !important; }
    .sdd-atlas-view-pair { display: none !important; }
    .sdd-atlas[data-view="map"] .sdd-atlas-list,
    .sdd-atlas[data-view="map"] .sdd-atlas-search,
    .sdd-atlas[data-view="map"] .sdd-atlas-foot,
    .sdd-atlas[data-view="map"] .sdd-atlas-note { display: revert !important; }
}
`;
        document.head.appendChild(s);
    }

    // initMap(container, opts?) — 컨테이너 element 받아 map 생성/재사용.
    // 같은 컨테이너로 두 번 호출하면 기존 인스턴스 그대로 반환.
    async function initMap(container, opts) {
        if (!container) throw new Error('container required');
        opts = opts || {};
        await loadMapLibre();
        // 이미 같은 컨테이너에 마운트된 map 이 있으면 그대로
        if (_map && _map.getContainer() === container) {
            _map.resize();
            return _map;
        }
        // 다른 컨테이너 (혹은 처음) — 기존 인스턴스 정리
        if (_map) { try { _map.remove(); } catch (e) {} _map = null; }
        const center = opts.center || DEFAULT_CENTER;
        const zoom   = Number.isFinite(opts.zoom) ? opts.zoom : DEFAULT_ZOOM;
        _map = new _ml.Map({
            container,
            style: PAPER_RASTER_STYLE,
            center,
            zoom,
            attributionControl: false,   // 잡지 톤 attribution 별도 추가
            cooperativeGestures: false,
            dragRotate: false,           // 회전 X — 종이 지도 톤
            pitchWithRotate: false,
            touchPitch: false
        });
        _map.touchZoomRotate?.disableRotation?.();
        _map.addControl(new _ml.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
        _map.addControl(new _ml.AttributionControl({ compact: true }), 'bottom-right');
        // 컨테이너가 늦게 보일 수도 있어 한 번 resize 유도
        setTimeout(() => { try { _map?.resize(); } catch (e) {} }, 50);
        return _map;
    }

    function getMap() { return _map; }

    function clearMarkers() {
        _markers.forEach(m => { try { m.remove(); } catch (e) {} });
        _markers = [];
    }

    function clearNotice() {
        if (_noticeEl && _noticeEl.parentNode) {
            _noticeEl.parentNode.removeChild(_noticeEl);
        }
        _noticeEl = null;
    }

    function showNotice(container, lang) {
        clearNotice();
        if (!container) return;
        const COPY = {
            en: { h: 'Coordinates pending.', p: 'Cafés below are vetted; map coordinates land in the next data refresh.' },
            ko: { h: '좌표 데이터 준비 중.', p: '아래 카페는 검수된 곳. 지도 좌표는 다음 데이터 갱신에 들어옵니다.' },
            ja: { h: '座標データ準備中。', p: 'カフェは検証済み。地図上の座標は次回のデータ更新で反映されます。' },
            pt: { h: 'Coordenadas pendentes.', p: 'Cafés abaixo verificados; coordenadas chegam na próxima atualização.' },
            es: { h: 'Coordenadas pendientes.', p: 'Cafés abajo verificados; coordenadas llegan en la próxima actualización.' }
        };
        const c = COPY[lang] || COPY.en;
        const el = document.createElement('aside');
        el.className = 'sdd-atlas-map-notice';
        el.innerHTML = `<p class="sdd-atlas-map-notice__h">${c.h}</p><p class="sdd-atlas-map-notice__p">${c.p}</p>`;
        container.appendChild(el);
        _noticeEl = el;
    }

    // setCafes(cafes, opts?) — 좌표 있는 카페만 마커. 0개면 안내 카드.
    function setCafes(cafes, opts) {
        if (!_map || !_ml) return;
        opts = opts || {};
        clearMarkers();
        clearNotice();
        const list = Array.isArray(cafes) ? cafes : [];
        const withCoords = list.filter(c =>
            typeof c.lat === 'number' && typeof c.lng === 'number' &&
            Number.isFinite(c.lat) && Number.isFinite(c.lng)
        );

        if (withCoords.length === 0) {
            const container = _map.getContainer();
            const lang = (window.state && window.state.lang) || 'en';
            showNotice(container, lang);
            return;
        }

        const bounds = new _ml.LngLatBounds();
        withCoords.forEach(c => {
            const el = document.createElement('div');
            const isJade = (c.visited_at && c.visited_at !== '');
            el.className = 'sdd-atlas-marker' + (isJade ? ' is-jade' : '');
            el.setAttribute('aria-label', c.name || '');
            const popupHtml =
                `<strong>${(c.name || '').replace(/[<>&"]/g, '')}</strong>` +
                (c.neighborhood ? `<br/>${c.neighborhood.replace(/[<>&"]/g, '')}` : '') +
                (typeof c.rating === 'number' ? `<br/>★ ${c.rating.toFixed(1)}` : '') +
                (c.google_url ? `<br/><a href="${c.google_url.replace(/["<>]/g, '')}" target="_blank" rel="noopener">↗ MAPS</a>` : '');
            const popup = new _ml.Popup({ offset: 10, closeButton: true })
                .setHTML(popupHtml);
            const marker = new _ml.Marker({ element: el })
                .setLngLat([c.lng, c.lat])
                .setPopup(popup)
                .addTo(_map);
            _markers.push(marker);
            bounds.extend([c.lng, c.lat]);
        });

        if (!opts.skipFit && withCoords.length > 1) {
            _map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
        } else if (withCoords.length === 1) {
            _map.setCenter([withCoords[0].lng, withCoords[0].lat]);
            _map.setZoom(14);
        }
    }

    function init() {
        injectStyles();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_ATLAS_MAP = {
        loadMapLibre,
        initMap,
        getMap,
        setCafes,
        // 추후 PR2/3/4 에서 사용할 hook
        DEFAULT_CENTER,
        DEFAULT_ZOOM
    };
})();
