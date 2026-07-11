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

// IIFE — 로드 즉시 실행. 지도 중심에 도보 거리 동심원(200m/500m/1km)을 그리는 모듈.
(function() {
    // 중복 로드 방어(멱등).
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

    // 모듈 상태: 라벨 요소들 / 라벨 컨테이너 / 레이어 추가됨 / 이벤트 바인딩됨 / 현재 중심 / 구독 해제 함수.
    let _labels = null;
    let _container = null;
    let _added = false;
    let _bound = false;
    let _currentCenter = null;
    let _unsubscribe = null;

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // minLabel — 분 수를 언어별 라벨로("12 MIN" / "12분").
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

    // minutesFor — 거리(m)를 도보 분으로 환산(반올림).
    function minutesFor(meters) {
        return Math.round(meters / WALKING_SPEED_M_PER_MIN);
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
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
    // geoCircle — 중심 좌표 + 반경(m)으로 원을 이루는 LineString GeoJSON 을 만든다(평면 근사).
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

    // labelPoint — 라벨을 놓을 좌표(중심에서 정북쪽 radius 만큼, 12시 방향).
    // 라벨 위치 — 중심에서 정북 radius. (12시 방향)
    function labelPoint(lng, lat, radiusMeters) {
        const earthRadius = 6371000;
        const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
        return { lat: lat + dLat, lng: lng };
    }

    // ensureLabelContainer — 지도 위에 라벨을 담을 오버레이 div 를 한 번만 만든다.
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

    // ensureLabels — 원별 라벨 요소를 만들고(1회) 매번 현재 언어 텍스트로 갱신.
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

    // updateLabelsPosition — 지도 좌표를 화면 픽셀로 변환해 라벨을 배치(화면 밖이면 숨김).
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

    // addLayers — 세 원마다 GeoJSON 소스 + 라인 레이어를 지도에 추가(1회, bone 색 stroke).
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

    // updateCircles — 현재 중심으로 각 원의 GeoJSON 데이터를 다시 계산해 갱신.
    function updateCircles(map) {
        if (!_currentCenter || !_added) return;
        for (const r of RINGS) {
            const feature = geoCircle(_currentCenter.lng, _currentCenter.lat, r.meters);
            const source = map.getSource(`walkring-${r.id}`);
            if (source) source.setData({ type: 'FeatureCollection', features: [feature] });
        }
    }

    // clearCircles — 원과 라벨을 모두 비운다(중심이 없어졌을 때).
    function clearCircles(map) {
        for (const r of RINGS) {
            const source = map.getSource(`walkring-${r.id}`);
            if (source) source.setData({ type: 'FeatureCollection', features: [] });
        }
        if (_labels) _labels.forEach(el => { el.style.display = 'none'; });
    }

    // bindMapEvents — 지도 이동/줌/리사이즈 시 라벨 위치를 다시 잡도록 이벤트 연결(1회).
    function bindMapEvents(map) {
        if (_bound) return;
        map.on('move',   updateLabelsPosition);
        map.on('zoom',   updateLabelsPosition);
        map.on('resize', updateLabelsPosition);
        _bound = true;
    }

    // applyToMap — 스타일이 준비되면 레이어/이벤트를 붙이고 현재 중심으로 원·라벨을 그린다.
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

    // onCenterUpdate — GPS/디버그가 중심을 알려주면 원을 그린다(중심이 null 이면 지운다).
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

    // waitForMap — 지도가 준비될 때까지 폴링하다 준비되면 붙인다(최대 12초).
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

    // watchEdition — 언어가 바뀌면 라벨 텍스트를 다시 채운다.
    function watchEdition() {
        const mo = new MutationObserver(() => {
            if (_labels) ensureLabels();   // 텍스트 갱신
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    // init — 스타일 주입 + GPS 중심 구독 + 지도 대기 + 에디션 감시.
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

    // 전역 공개 API — 원 정의 조회 + 거리→분 변환 + (테스트용)강제 중심 세팅.
    window.SAUDADE_ATLAS_WALKRING = {
        getRings: () => RINGS.slice(),
        minutesFor,
        // 디버그/테스트 — 강제 중심
        setCenter: (lat, lng) => onCenterUpdate({ lat, lng, source: 'debug' })
    };
})();
