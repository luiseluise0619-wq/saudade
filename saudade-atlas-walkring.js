// SAUDADE · § 02 ATLAS — Walkring 동심원 (v7 §8.4)
// PR3 / 5 — 사용자 위치(또는 핀) 중심 동심원 3개: 200m / 500m / 1km.
//
// 헌법 §8 절대 규칙:
//   - 운동 트래커 X · 경로 저장 X · GPX export X · 히스토리 X
//   - 단순 시각화 도구: "이 카페가 도보 몇 분 거리에 있나"
//   - 정적 — 펄스 X · 애니메이션 X
//
// 의존: saudade-atlas-map.js (PR1) · saudade-atlas-gps.js (PR2)
'use strict';

(function() {
    if (window.SAUDADE_ATLAS_WALKRING) return;

    // §8.4 — 도보 시속 4.3 km/h ≈ 71.67 m/min
    const WALKING_SPEED_M_PER_MIN = 4300 / 60;

    // 동심원 정의 — id / 반경 / 단위 라벨 / 투명도
    const RINGS = [
        { id: 'r-200',  meters: 200,  unit: '200M', opacity: 1.0 },
        { id: 'r-500',  meters: 500,  unit: '500M', opacity: 0.7 },
        { id: 'r-1000', meters: 1000, unit: '1KM',  opacity: 0.4 }
    ];

    // bone hex 직참조 — MapLibre paint 가 CSS var 바인딩 X.
    // 토큰 변경 시 이 값과 saudade-tokens.css/edition-tokens.css 의 --bone 동기화 필요.
    // PR1.5 §4.1 명문화: bone 은 비-텍스트 데코 전용 — 라인 stroke 정확히 그 용도.
    const BONE_HEX = '#6F6A60';

    let _labels = null;
    let _container = null;
    let _added = false;
    let _bound = false;
    let _currentCenter = null;
    let _unsubscribe = null;

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // 분 단위 라벨 — 5 에디션 (en/pt/es 는 'MIN', ko/ja 는 자국어 단위)
    function minLabel(minutes) {
        return L({
            en: `${minutes} MIN`,
            ko: `${minutes}분`,
            ja: `${minutes}分`,
            pt: `${minutes} MIN`,
            es: `${minutes} MIN`
        });
    }

    function minutesFor(meters) {
        return Math.round(meters / WALKING_SPEED_M_PER_MIN);
    }

    function injectStyles() {
        if (document.getElementById('sddWalkringStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWalkringStyles';
        s.textContent = `
.sdd-walkring-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
}
.sdd-walkring-label {
    position: absolute;
    transform: translate(-50%, -100%);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);                 /* paper×bone-d = 8.17:1 ≥7 ✓ */
    background: var(--paper);
    padding: 2px 6px;
    border: 0.5px solid var(--rule);
    white-space: nowrap;
    display: none;                         /* center 없을 때 숨김 */
}
@media print {
    .sdd-walkring-labels { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    // 지구 표면 위 동심원 — LineString (65 points 닫힘).
    // 작은 반경 (200~1000m) + 도시 위도라 간단한 평면 근사로 충분.
    function geoCircle(lng, lat, radiusMeters, points) {
        points = points || 64;
        const earthRadius = 6371000;
        const dLatBase = (radiusMeters / earthRadius) * (180 / Math.PI);
        const cosLat   = Math.cos(lat * Math.PI / 180) || 1e-6;
        const dLngBase = dLatBase / cosLat;
        const coords = [];
        for (let i = 0; i <= points; i++) {
            const a = (i / points) * 2 * Math.PI;
            const cLat = lat + dLatBase * Math.sin(a);
            const cLng = lng + dLngBase * Math.cos(a);
            coords.push([cLng, cLat]);
        }
        return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
    }

    // 라벨 위치 — 중심에서 정북 radius. (12시 방향)
    function labelPoint(lng, lat, radiusMeters) {
        const earthRadius = 6371000;
        const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
        return { lat: lat + dLat, lng: lng };
    }

    function ensureLabelContainer() {
        if (_container && _container.isConnected) return _container;
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map) return null;
        const mapDiv = map.getContainer();
        _container = document.createElement('div');
        _container.className = 'sdd-walkring-labels';
        mapDiv.appendChild(_container);
        return _container;
    }

    function ensureLabels() {
        // 기존 라벨 있으면 재사용 (edition 변경은 텍스트 업데이트로)
        const c = ensureLabelContainer();
        if (!c) return null;
        if (!_labels) {
            _labels = RINGS.map(r => {
                const el = document.createElement('div');
                el.className = 'sdd-walkring-label';
                el.dataset.ring = r.id;
                el.style.opacity = String(r.opacity);
                c.appendChild(el);
                return el;
            });
        }
        // 텍스트는 매 호출 시 업데이트 (edition 반영)
        _labels.forEach((el, i) => {
            const r = RINGS[i];
            el.textContent = `${r.unit} · ${minLabel(minutesFor(r.meters))}`;
        });
        return _labels;
    }

    function updateLabelsPosition() {
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map || !_currentCenter || !_labels) return;
        const canvas = map.getCanvas();
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        for (let i = 0; i < RINGS.length; i++) {
            const r = RINGS[i];
            const pt = labelPoint(_currentCenter.lng, _currentCenter.lat, r.meters);
            const px = map.project([pt.lng, pt.lat]);
            const el = _labels[i];
            el.style.left = px.x + 'px';
            el.style.top  = px.y + 'px';
            const inView = px.x >= -40 && px.x <= w + 40 && px.y >= -20 && px.y <= h + 20;
            el.style.display = inView ? 'block' : 'none';
        }
    }

    function addLayers(map) {
        if (_added) return;
        if (!map.isStyleLoaded()) return;
        for (const r of RINGS) {
            const sourceId = `walkring-${r.id}`;
            const layerId  = `walkring-${r.id}-line`;
            try {
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
                map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                        'line-color': BONE_HEX,
                        'line-width': 1,
                        'line-opacity': r.opacity
                    }
                });
            } catch (e) { /* 이미 등록 */ }
        }
        _added = true;
    }

    function updateCircles(map) {
        if (!_currentCenter || !_added) return;
        for (const r of RINGS) {
            const feature = geoCircle(_currentCenter.lng, _currentCenter.lat, r.meters);
            const source = map.getSource(`walkring-${r.id}`);
            if (source) source.setData({ type: 'FeatureCollection', features: [feature] });
        }
    }

    function clearCircles(map) {
        for (const r of RINGS) {
            const source = map.getSource(`walkring-${r.id}`);
            if (source) source.setData({ type: 'FeatureCollection', features: [] });
        }
        if (_labels) _labels.forEach(el => { el.style.display = 'none'; });
    }

    function bindMapEvents(map) {
        if (_bound) return;
        map.on('move',   updateLabelsPosition);
        map.on('zoom',   updateLabelsPosition);
        map.on('resize', updateLabelsPosition);
        _bound = true;
    }

    function applyToMap(map) {
        if (!map) return;
        if (!map.isStyleLoaded()) {
            map.once('load', () => applyToMap(map));
            return;
        }
        addLayers(map);
        bindMapEvents(map);
        if (_currentCenter) {
            ensureLabels();
            updateCircles(map);
            updateLabelsPosition();
        }
    }

    function onCenterUpdate(center) {
        _currentCenter = center;
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map) return;   // 지도 init 후 다시 처리됨 (waitForMap)
        if (!center) {
            clearCircles(map);
            return;
        }
        applyToMap(map);
    }

    function waitForMap() {
        let attempts = 0;
        const iv = setInterval(() => {
            const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
            if (map) {
                clearInterval(iv);
                applyToMap(map);
            }
            if (++attempts > 60) clearInterval(iv);
        }, 200);
    }

    function watchEdition() {
        const mo = new MutationObserver(() => {
            if (_labels) ensureLabels();   // 텍스트 갱신
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    function init() {
        injectStyles();
        // GPS 모듈 구독
        if (window.SAUDADE_ATLAS_GPS && window.SAUDADE_ATLAS_GPS.subscribe) {
            const initial = window.SAUDADE_ATLAS_GPS.getCenter && window.SAUDADE_ATLAS_GPS.getCenter();
            if (initial) _currentCenter = initial;
            _unsubscribe = window.SAUDADE_ATLAS_GPS.subscribe(onCenterUpdate);
        }
        waitForMap();
        watchEdition();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }

    window.SAUDADE_ATLAS_WALKRING = {
        getRings: () => RINGS.slice(),
        minutesFor,
        // 디버그/테스트 — 강제 중심
        setCenter: (lat, lng) => onCenterUpdate({ lat, lng, source: 'debug' })
    };
})();
