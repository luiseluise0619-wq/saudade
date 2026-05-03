// SAUDADE · § 02 ATLAS — GPS · 사전 모달 · 핀 fallback · 위치 마커
// v7 §8 PR2 / 5
//   §8.1 — GPS 정책 코드 적용 (클라이언트 only · 15s/30m · 서버 전송 0)
//   §8.2 — 권한 사전 잡지 톤 모달 (5 에디션)
//   §8.3 — Skip → 핀 박기 fallback (localStorage)
//   §8.5 — 사용자 위치 마커 (1.5px ink outline 8px 원 + 1px 점, 펄스 X)
//
// 의존: saudade-atlas-map.js (PR1) — initMap / getMap / loadMapLibre.
// PR3 walkring 이 subscribe() 로 center 변경 구독.
'use strict';

(function() {
    if (window.SAUDADE_ATLAS_GPS) return;

    // ─── localStorage 키 ────────────────────────────────────────
    const KEY_GRANTED  = 'saudade.atlas.gps.granted';
    const KEY_DECLINED = 'saudade.atlas.gps.declined';
    const KEY_PIN      = 'saudade.atlas.pin';

    // ─── §8.1 갱신 임계값 ──────────────────────────────────────
    const UPDATE_INTERVAL_MS = 15 * 1000;
    const UPDATE_THRESHOLD_M = 30;

    // ─── 상태 ─────────────────────────────────────────────────
    let _watchId = null;
    let _lastPublished = null;     // { lat, lng, t }
    let _currentCenter = null;     // { lat, lng, source: 'gps' | 'pin' }
    let _pinPending = false;
    let _marker = null;
    let _modalEl = null;
    let _pinPromptEl = null;
    const _subscribers = new Set();

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // ─── 카피 (5 에디션, 평어체) ───────────────────────────────
    function copy() {
        return {
            modalLabel: L({
                en: 'A note before we ask.',
                ko: '묻기 전, 메모.',
                ja: '尋ねる前の覚書。',
                pt: 'Uma nota antes de perguntarmos.',
                es: 'Una nota antes de preguntar.'
            }),
            modalBody: L({
                en: 'Atlas uses your location only to draw walking circles around you on the map. We never store it, never share it, never see it ourselves.',
                ko: '아틀라스는 당신의 위치를 지도 위 도보 동심원을 그리는 데에만 쓴다. 저장하지 않고, 공유하지 않고, 우리도 보지 않는다.',
                ja: 'アトラスはあなたの位置を地図上に徒歩の同心円を描くためだけに使う。保存しない、共有しない、私たちも見ない。',
                pt: 'O Atlas usa a sua localização apenas para traçar círculos a pé ao seu redor no mapa. Nunca a armazenamos, nunca a partilhamos, nunca a vemos.',
                es: 'El Atlas usa tu ubicación solo para dibujar círculos a pie a tu alrededor en el mapa. Nunca la almacenamos, nunca la compartimos, nunca la vemos.'
            }),
            modalNote: L({
                en: 'The next dialog is from your phone, not from us.',
                ko: '다음 창은 당신 휴대폰이 띄우는 것이지, 우리가 띄우는 게 아니다.',
                ja: '次の確認は端末が出すもの。私たちではない。',
                pt: 'O próximo diálogo é do seu telemóvel, não de nós.',
                es: 'El siguiente diálogo es de tu teléfono, no nuestro.'
            }),
            btnContinue: L({
                en: 'CONTINUE', ko: '계속', ja: '続ける',
                pt: 'CONTINUAR', es: 'CONTINUAR'
            }),
            btnSkip: L({
                en: "SKIP — I'll drop a pin instead",
                ko: '건너뛰기 — 핀을 직접 박는다',
                ja: 'スキップ — ピンを自分で置く',
                pt: 'SALTAR — coloco um alfinete',
                es: 'OMITIR — pongo un alfiler'
            }),
            pinPrompt: L({
                en: 'Drop a pin where you sleep this month.',
                ko: '이번 달 잠자리에 핀을 박아 주십시오.',
                ja: '今月のねぐらにピンを置いてください。',
                pt: 'Coloque um alfinete onde dorme este mês.',
                es: 'Coloca un alfiler donde duermes este mes.'
            }),
            pinCancel: L({
                en: 'CANCEL', ko: '취소', ja: 'キャンセル',
                pt: 'CANCELAR', es: 'CANCELAR'
            })
        };
    }

    // ─── 헬퍼 ─────────────────────────────────────────────────
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function getStored(k) {
        try { return localStorage.getItem(k); } catch (e) { return null; }
    }
    function setStored(k, v) {
        try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {}
    }
    function isGranted()  { return getStored(KEY_GRANTED)  === '1'; }
    function isDeclined() { return getStored(KEY_DECLINED) === '1'; }

    function getPin() {
        try {
            const raw = getStored(KEY_PIN);
            if (!raw) return null;
            const p = JSON.parse(raw);
            if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return null;
            return p;
        } catch (e) { return null; }
    }
    function savePin(lat, lng) {
        setStored(KEY_PIN, JSON.stringify({ lat, lng, ts: Date.now() }));
    }

    // 거리 (m) — Haversine. 갱신 임계값 판정용.
    function distanceM(a, b) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const s1 = Math.sin(dLat / 2);
        const s2 = Math.sin(dLng / 2);
        const x = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
        return 2 * R * Math.asin(Math.sqrt(x));
    }

    // ─── §8.1 Geolocation watch ───────────────────────────────
    function startWatch() {
        if (_watchId !== null || !('geolocation' in navigator)) return;
        try {
            _watchId = navigator.geolocation.watchPosition(
                onPosition,
                onPositionError,
                { enableHighAccuracy: false, maximumAge: 5000, timeout: 30000 }
            );
        } catch (e) { _watchId = null; }
    }

    function stopWatch() {
        if (_watchId !== null) {
            try { navigator.geolocation.clearWatch(_watchId); } catch (e) {}
            _watchId = null;
        }
    }

    function onPosition(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const t = Date.now();
        const candidate = { lat, lng, t };
        // §8.1 — 15s + 30m 임계값 (둘 다 미달이면 무시)
        if (_lastPublished) {
            const dt = t - _lastPublished.t;
            const dm = distanceM(_lastPublished, candidate);
            if (dt < UPDATE_INTERVAL_MS && dm < UPDATE_THRESHOLD_M) return;
        }
        _lastPublished = candidate;
        _currentCenter = { lat, lng, source: 'gps' };
        publishUpdate();
    }

    function onPositionError(_err) {
        // 거부/실패 — 자동 핀 모드 진입 X (사용자 명시 선택만 신뢰)
        // 권한 마커 reset (다음번 모달 띄우기 위해)
        setStored(KEY_GRANTED, null);
    }

    // ─── §8.2 사전 모달 ───────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('sddAtlasGpsStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddAtlasGpsStyles';
        s.textContent = `
.sdd-gps-modal {
    position: fixed; inset: 0;
    z-index: 100;
    background: var(--paper);
    color: var(--ink);
    display: none;
    align-items: center;
    justify-content: center;
    padding: clamp(40px, 8vw, 96px);
}
.sdd-gps-modal.active { display: flex; }
.sdd-gps-modal-inner { max-width: 520px; width: 100%; }
.sdd-gps-modal-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 clamp(20px, 3vw, 28px);
    padding-bottom: clamp(12px, 2vw, 16px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-gps-modal-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(18px, 1.8vw, 22px);
    line-height: 1.5;
    letter-spacing: var(--tr-fraunces-body-d);
    color: var(--ink);
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-gps-modal-note {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    line-height: 1.5;
    color: var(--bone-d);
    margin: 0 0 clamp(28px, 4vw, 40px);
}
.sdd-gps-modal-actions {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-gps-modal-btn {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 18px 4px;
    text-align: left;
    border-radius: 0;
    min-height: 44px;
    transition: color .12s, background .12s;
}
.sdd-gps-modal-btn:hover    { color: var(--rust); background: var(--paper-d); }
.sdd-gps-modal-btn:focus    { outline: 1px dotted var(--ink); outline-offset: -3px; }
.sdd-gps-modal-btn.skip     { color: var(--bone-d); font-weight: 400; }
.sdd-gps-modal-btn.skip:hover { color: var(--rust); }

/* §8.3 핀 prompt — 지도 하단 fixed bar */
.sdd-gps-pin-prompt {
    position: fixed;
    bottom: clamp(80px, 12vw, 120px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9;
    background: var(--paper);
    border: 0.5px solid var(--rule-2);
    padding: 14px 20px;
    display: none;
    align-items: center;
    gap: 16px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-gps-pin-prompt.active { display: flex; }
.sdd-gps-pin-prompt-cancel {
    background: transparent;
    border: 0;
    border-left: 0.5px solid var(--rule);
    padding: 6px 0 6px 16px;
    margin: 0;
    color: var(--bone-d);
    font: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
    cursor: pointer;
}
.sdd-gps-pin-prompt-cancel:hover { color: var(--rust); }

/* §8.5 사용자 위치 마커 — 가시성 정정 (사용자 "내 위치 안 떠"):
   16px ring + 4px center dot, ink 2px outline + paper halo (지도 어디든 대비). */
.sdd-gps-marker {
    position: relative;
    width: 22px;
    height: 22px;
    pointer-events: none;
}
.sdd-gps-marker::before {
    content: '';
    position: absolute;
    left: 1px; top: 1px;
    width: 16px; height: 16px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: rgba(242,238,227,.4);
    box-sizing: content-box;
    box-shadow: 0 0 0 1px var(--paper);
}
.sdd-gps-marker::after {
    content: '';
    position: absolute;
    left: 50%; top: 50%;
    width: 4px; height: 4px;
    background: var(--rust);
    border-radius: 50%;
    transform: translate(-50%, -50%);
}

/* 핀 모드 — 지도 커서 crosshair */
.sdd-atlas[data-pin-mode="1"] .maplibregl-canvas { cursor: crosshair !important; }

/* v7 검토 정정 — GPS 상태 배지 (MAP 뷰 좌상단). 사용자가 위치 표시 여부를 알 수 있게.
   states: locating | located | pin | denied | unsupported */
.sdd-gps-status {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 5;
    background: var(--paper);
    border: 0.5px solid var(--rule);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    pointer-events: none;
}
.sdd-gps-status::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--bone);
    flex-shrink: 0;
}
.sdd-gps-status[data-state="located"]::before    { background: var(--rust); }
.sdd-gps-status[data-state="located"]            { color: var(--ink); }
.sdd-gps-status[data-state="pin"]::before        { background: var(--ink); }
.sdd-gps-status[data-state="pin"]                { color: var(--ink); }
.sdd-gps-status[data-state="locating"]::before   { background: var(--signal); }
.sdd-gps-status[data-state="denied"]::before     { background: var(--bone); }
.sdd-gps-status-btn {
    background: transparent !important;
    border: 0 !important;
    border-bottom: 0.5px solid currentColor !important;
    color: var(--rust) !important;
    font: inherit !important;
    text-transform: inherit !important;
    letter-spacing: inherit !important;
    padding: 2px 0 !important;
    min-height: 0 !important;
    cursor: pointer;
    pointer-events: auto;
    border-radius: 0 !important;
}
.sdd-gps-status-btn:hover { color: var(--ink) !important; }
.sdd-atlas[data-view="list"] .sdd-gps-status { display: none; }

@media print {
    .sdd-gps-modal, .sdd-gps-pin-prompt, .sdd-gps-status { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    function ensureModal() {
        if (_modalEl) return _modalEl;
        const c = copy();
        _modalEl = document.createElement('div');
        _modalEl.className = 'sdd-gps-modal';
        _modalEl.setAttribute('role', 'dialog');
        _modalEl.setAttribute('aria-modal', 'true');
        _modalEl.innerHTML = `
            <div class="sdd-gps-modal-inner">
                <p class="sdd-gps-modal-label" data-modal-label>${escapeHtml(c.modalLabel)}</p>
                <p class="sdd-gps-modal-body"  data-modal-body>${escapeHtml(c.modalBody)}</p>
                <p class="sdd-gps-modal-note"  data-modal-note>${escapeHtml(c.modalNote)}</p>
                <div class="sdd-gps-modal-actions">
                    <button type="button" class="sdd-gps-modal-btn"      data-modal-continue>${escapeHtml(c.btnContinue)}</button>
                    <button type="button" class="sdd-gps-modal-btn skip" data-modal-skip>${escapeHtml(c.btnSkip)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(_modalEl);
        _modalEl.querySelector('[data-modal-continue]').addEventListener('click', onContinue);
        _modalEl.querySelector('[data-modal-skip]').addEventListener('click', onSkip);
        return _modalEl;
    }

    function showModal() { ensureModal().classList.add('active'); }
    function hideModal() { if (_modalEl) _modalEl.classList.remove('active'); }

    function onContinue() {
        hideModal();
        if (!('geolocation' in navigator)) return;
        // OS 모달이 다음에 뜸
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setStored(KEY_GRANTED, '1');
                setStored(KEY_DECLINED, null);
                onPosition(pos);
                startWatch();
                centerMapOnUser();
            },
            () => {
                // OS 거부 — 권한 marker 미설정. 다음에 또 모달 노출됨.
                setStored(KEY_GRANTED, null);
            }
        );
    }

    function onSkip() {
        hideModal();
        setStored(KEY_DECLINED, '1');
        setStored(KEY_GRANTED, null);
        enterPinMode();
    }

    // ─── §8.3 핀 박기 모드 ────────────────────────────────────
    function ensurePinPrompt() {
        if (_pinPromptEl) return _pinPromptEl;
        const c = copy();
        _pinPromptEl = document.createElement('div');
        _pinPromptEl.className = 'sdd-gps-pin-prompt';
        _pinPromptEl.innerHTML = `
            <span data-pin-prompt>${escapeHtml(c.pinPrompt)}</span>
            <button type="button" class="sdd-gps-pin-prompt-cancel" data-pin-cancel>${escapeHtml(c.pinCancel)}</button>
        `;
        document.body.appendChild(_pinPromptEl);
        _pinPromptEl.querySelector('[data-pin-cancel]').addEventListener('click', cancelPinMode);
        return _pinPromptEl;
    }

    function enterPinMode() {
        _pinPending = true;
        const atlas = document.getElementById('sddAtlas');
        if (!atlas) return;
        // MAP 뷰 강제 (v7 검토 정정 — pair toggle 로 selector 변경됨)
        if (atlas.getAttribute('data-view') !== 'map') {
            const mapBtn = atlas.querySelector('[data-view-set="map"]');
            if (mapBtn) mapBtn.click();
        }
        atlas.setAttribute('data-pin-mode', '1');
        ensurePinPrompt().classList.add('active');
        // 지도 준비 후 클릭 핸들러 부착 — initMap 이 비동기라 폴링
        let attempts = 0;
        const iv = setInterval(() => {
            const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap();
            if (map && _pinPending) {
                map.once('click', onMapClickForPin);
                clearInterval(iv);
            }
            if (++attempts > 50 || !_pinPending) clearInterval(iv);
        }, 200);
    }

    function onMapClickForPin(e) {
        if (!_pinPending) return;
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        savePin(lat, lng);
        _currentCenter = { lat, lng, source: 'pin' };
        cancelPinMode();
        publishUpdate();
        centerMapOnUser();
    }

    function cancelPinMode() {
        _pinPending = false;
        const atlas = document.getElementById('sddAtlas');
        if (atlas) atlas.removeAttribute('data-pin-mode');
        if (_pinPromptEl) _pinPromptEl.classList.remove('active');
    }

    // ─── §8.5 사용자 위치 마커 ────────────────────────────────
    function ensureMarker() {
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map || !window.maplibregl) return null;
        if (_marker) return _marker;
        const el = document.createElement('div');
        el.className = 'sdd-gps-marker';
        _marker = new window.maplibregl.Marker({ element: el, anchor: 'center' });
        return _marker;
    }

    function updateMarker() {
        if (!_currentCenter) return;
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map) return;
        const m = ensureMarker();
        if (!m) return;
        m.setLngLat([_currentCenter.lng, _currentCenter.lat]);
        if (!m._added) { m.addTo(map); m._added = true; }
    }

    function centerMapOnUser() {
        if (!_currentCenter) return;
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap();
        if (!map) return;
        map.easeTo({ center: [_currentCenter.lng, _currentCenter.lat], duration: 500 });
    }

    // ─── 통합 흐름 ────────────────────────────────────────────
    function publishUpdate() {
        updateMarker();
        renderStatusBadge();
        _subscribers.forEach(fn => { try { fn(_currentCenter); } catch (e) {} });
    }

    function bootstrap() {
        // 우선순위: GPS granted > pin > 없음
        const pin = getPin();
        if (pin) _currentCenter = { lat: pin.lat, lng: pin.lng, source: 'pin' };
        if (isGranted()) startWatch();
    }

    function onMapOpened() {
        ensureStatusBadge();
        renderStatusBadge();
        // v7 검토 정정 — map 이 아직 init/load 안 됐을 수 있음 → 대기 후 진행 (사용자 "내 위치 안 떠")
        waitForMapReady(() => {
            if (_currentCenter) {
                updateMarker();
                centerMapOnUser();
                return;
            }
            // 권한 있으면 즉시 위치 요청 (sticky permission 활용)
            if (isGranted() && 'geolocation' in navigator) {
                renderStatusBadge();   // LOCATING…
                navigator.geolocation.getCurrentPosition(
                    (pos) => { onPosition(pos); startWatch(); centerMapOnUser(); },
                    () => { setStored(KEY_GRANTED, null); renderStatusBadge(); }
                );
                return;
            }
            // 권한도 핀도 없음 — 사전 모달
            if (!isGranted() && !getPin()) showModal();
        });
    }
    function waitForMapReady(cb, attempts = 0) {
        const map = window.SAUDADE_ATLAS_MAP && window.SAUDADE_ATLAS_MAP.getMap && window.SAUDADE_ATLAS_MAP.getMap();
        if (map && map.loaded && map.loaded()) { cb(); return; }
        if (map && map.once) { map.once('load', cb); return; }
        if (attempts > 50) { cb(); return; }   // 10s timeout — 무리하지 않음
        setTimeout(() => waitForMapReady(cb, attempts + 1), 200);
    }

    // v7 검토 정정 — 좌상단 GPS 상태 배지 (사용자가 위치 표시 여부 인지)
    let _statusEl = null;
    function ensureStatusBadge() {
        if (_statusEl && document.body.contains(_statusEl)) return _statusEl;
        const mapContainer = document.getElementById('sddAtlasMap');
        if (!mapContainer) return null;
        _statusEl = document.createElement('div');
        _statusEl.className = 'sdd-gps-status';
        _statusEl.setAttribute('aria-live', 'polite');
        mapContainer.appendChild(_statusEl);
        return _statusEl;
    }
    function statusCopy(state) {
        const T = {
            locating:    L({ en: 'LOCATING…',     ko: '위치 찾는 중…',  ja: '位置確認中…',     pt: 'A LOCALIZAR…',  es: 'LOCALIZANDO…' }),
            located:     L({ en: 'LOCATED',        ko: '위치 표시 중',    ja: '位置表示中',       pt: 'LOCALIZADO',     es: 'LOCALIZADO' }),
            pin:         L({ en: 'PIN SET',        ko: '핀 설정됨',       ja: 'ピン設定済',       pt: 'ALFINETE FIXO',  es: 'ALFILER FIJO' }),
            denied:      L({ en: 'LOCATION OFF',   ko: '위치 꺼짐',       ja: '位置情報オフ',     pt: 'LOCALIZAÇÃO DESLIGADA', es: 'UBICACIÓN APAGADA' }),
            unsupported: L({ en: 'NOT SUPPORTED',  ko: '미지원',          ja: '非対応',           pt: 'NÃO SUPORTADO',  es: 'NO COMPATIBLE' }),
            retry:       L({ en: 'TAP TO LOCATE',  ko: '눌러서 위치',     ja: 'タップで位置',     pt: 'TOQUE PARA LOCALIZAR', es: 'TOCAR PARA LOCALIZAR' })
        };
        return T[state] || '';
    }
    function renderStatusBadge() {
        const el = ensureStatusBadge();
        if (!el) return;
        let state;
        if (!('geolocation' in navigator)) state = 'unsupported';
        else if (_currentCenter && _currentCenter.source === 'gps') state = 'located';
        else if (_currentCenter && _currentCenter.source === 'pin') state = 'pin';
        else if (isDeclined()) state = 'denied';
        else state = 'retry';
        el.setAttribute('data-state', state);
        // 'denied' 또는 'retry' 일 땐 클릭으로 재요청 가능
        const canRetry = (state === 'denied' || state === 'retry');
        el.innerHTML = canRetry
            ? `<span>${escapeHtml(statusCopy(state))}</span><button type="button" class="sdd-gps-status-btn" data-gps-retry>${escapeHtml(statusCopy('retry'))}</button>`
            : `<span>${escapeHtml(statusCopy(state))}</span>`;
        const retryBtn = el.querySelector('[data-gps-retry]');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                setStored(KEY_DECLINED, null);   // 거부 마커 초기화
                showModal();
            });
        }
    }

    function watchAtlasState() {
        // atlas root 의 data-view 변경 감지 — 첫 로드 시 root 가 늦게 생길 수 있어 폴링
        let observed = false;
        const startObs = setInterval(() => {
            const atlas = document.getElementById('sddAtlas');
            if (!atlas || observed) return;
            const mo = new MutationObserver(() => {
                if (atlas.getAttribute('data-view') === 'map') {
                    setTimeout(onMapOpened, 200);
                }
            });
            mo.observe(atlas, { attributes: true, attributeFilter: ['data-view'] });
            observed = true;
            // 이미 map 뷰면 즉시 트리거
            if (atlas.getAttribute('data-view') === 'map') {
                setTimeout(onMapOpened, 200);
            }
            clearInterval(startObs);
        }, 300);
    }

    function watchEdition() {
        const mo = new MutationObserver(() => {
            if (_modalEl) {
                const c = copy();
                _modalEl.querySelector('[data-modal-label]').textContent = c.modalLabel;
                _modalEl.querySelector('[data-modal-body]').textContent  = c.modalBody;
                _modalEl.querySelector('[data-modal-note]').textContent  = c.modalNote;
                _modalEl.querySelector('[data-modal-continue]').textContent = c.btnContinue;
                _modalEl.querySelector('[data-modal-skip]').textContent     = c.btnSkip;
            }
            if (_pinPromptEl) {
                const c = copy();
                _pinPromptEl.querySelector('[data-pin-prompt]').textContent = c.pinPrompt;
                _pinPromptEl.querySelector('[data-pin-cancel]').textContent = c.pinCancel;
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    function init() {
        injectStyles();
        bootstrap();
        watchAtlasState();
        watchEdition();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_ATLAS_GPS = {
        getCenter: () => _currentCenter,
        showModal,
        enterPinMode,
        cancelPinMode,
        // PR3 walkring 이 구독할 hook — center 변경 시 호출됨
        subscribe: (fn) => { _subscribers.add(fn); return () => _subscribers.delete(fn); },
        // 디버그/리셋 (사용자가 결정 변경 시)
        reset: () => {
            setStored(KEY_GRANTED,  null);
            setStored(KEY_DECLINED, null);
            setStored(KEY_PIN,      null);
            stopWatch();
            cancelPinMode();
            if (_marker && _marker._added) {
                try { _marker.remove(); } catch (e) {}
                _marker._added = false;
                _marker = null;
            }
            _currentCenter = null;
            _lastPublished = null;
        }
    };
})();
