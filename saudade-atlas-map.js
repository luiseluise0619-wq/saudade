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
// v7 §8.7 paper map 타일:
//   - MapLibre + OSM raster (무료, 키 없음).
//   - paper tone: 배경 paper-d · 도로 bone · 강·바다 paper 보다 진한 회색 · 라벨 ink Fraunces italic · 액센트 0.
//   - Mapbox/Maptiler X (유료).
//
// ⚠ TODO (PR3): 지금 paper tone 은 OSM raster 위 CSS filter 로 임시 근사.
//    PR3 안에 Maputnik 또는 OSM Bright fork 의 vector style 로 영구 교체.
//    CSS filter 영구 X. (검수 항목 B)
//
// Lazy load: MapLibre CDN 은 사용자가 MAP 토글 클릭하는 시점에만 로드.
// (검수 항목 A — atlas 진입 자체는 부담 X)
'use strict';

(function() {
    if (window.SAUDADE_ATLAS_MAP) return;

    let _map = null;
    let _ml  = null;
    let _loadPromise = null;

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
.sdd-atlas[data-view="map"]  .sdd-atlas-note { display: none; }

/* v7 §8.7 — paper tone. CSS filter 임시 (PR3 안에 vector style 로 교체).
   목표 근사: bg ≈ paper-d, 도로 ≈ bone. 디지털 잡지 종이 톤. */
.sdd-atlas-map .maplibregl-canvas {
    filter: grayscale(1) contrast(0.92) brightness(1.06) sepia(0.18);
}

/* MapLibre 컨트롤 잡지 톤 재스타일 (검수 항목 D) — 둥근 모서리 X, 그림자 X */
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
}
.sdd-atlas-map .maplibregl-ctrl-group button:last-child { border-bottom: 0; }
.sdd-atlas-map .maplibregl-ctrl-group button:hover     { background: var(--paper-d); }
.sdd-atlas-map .maplibregl-ctrl-group button:focus     { outline: 1px dotted var(--ink); outline-offset: -3px; }
.sdd-atlas-map .maplibregl-ctrl-icon {
    /* 기본 + 아이콘 색을 ink 로 강제 — paper 위 ink 11:1 */
    filter: brightness(0);
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

/* MAP/LIST 토글 버튼 — 잡지 톤. 둥근 X, 그림자 X. */
.sdd-atlas-view-toggle {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 6px 10px;
    margin-left: 16px;
    min-height: 44px;
    border-radius: 0;
}
.sdd-atlas-view-toggle:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-atlas-view-toggle:focus { outline: 1px dotted var(--ink); outline-offset: 2px; }

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

@media (max-width: 768px) {
    .sdd-atlas-map { height: calc(100vh - 200px); }
}

/* 검수 항목 F — 인쇄 시 LIST 강제. 지도 무력화. */
@media print {
    .sdd-atlas-map { display: none !important; }
    .sdd-atlas-view-toggle { display: none !important; }
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
        // 추후 PR2/3/4 에서 사용할 hook
        DEFAULT_CENTER,
        DEFAULT_ZOOM
    };
})();
