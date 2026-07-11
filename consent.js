// ═══════════════════════════════════════════════════════════════════════
// [파일 역할 배너 — 초보자 안내]
// consent.js = 쿠키/저장소 사용 "동의" 관리(개인정보법 GDPR/ePrivacy/한국 PIPA 대응).
// 통계(Google Analytics)나 개인화 추적은 사용자가 명시적으로 허용해야만 켜진다.
// 지역 기본값: 유럽(EU/EEA/UK)은 기본 "거부", 그 외(한국/미국 등)는 기본 "허용"(opt-out 모델).
// 사용자의 선택은 localStorage 'aura_consent' 에 저장되고, 바뀌면 이벤트로 알린다.
// ═══════════════════════════════════════════════════════════════════════
// AURA — Cookie / Storage Consent (GDPR + ePrivacy + KR PIPA)
// 'analytics' 동의가 명시적으로 'granted' 가 되어야만 GA / 광고 추적이 켜짐.
// EU/EEA/UK 사용자는 default = denied. 그 외 지역은 default = granted (KR/US 등 opt-out 모델).
'use strict';
// IIFE — 내부 변수를 전역에서 숨긴다.
(function() {

    // KEY = 저장 키, VERSION = 저장 형식 버전(형식이 바뀌면 올려 옛 데이터 무시).
    const KEY = 'aura_consent';
    const VERSION = 1;

    // EU/EEA/UK + 스위스 + 아이슬란드/노르웨이/리히텐슈타인 timezone 일부.
    // 100% 정확하지 않지만 기본값 결정용. 사용자가 모달에서 결정 가능.
    const EU_TZ_PREFIXES = [
        'Europe/', 'Atlantic/Reykjavik', 'Atlantic/Faroe', 'Atlantic/Madeira',
        'Atlantic/Canary', 'Atlantic/Azores'
    ];

    // inEU: 브라우저의 시간대(timezone)로 유럽 거주 여부를 대략 추정(100% 정확하진 않음).
    function inEU() {
        try {
            // 예: "Europe/Lisbon". 사용자의 시간대 문자열을 얻는다.
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            // 유럽 접두어 중 하나로 시작하면 EU 로 본다.
            return EU_TZ_PREFIXES.some(p => tz === p || tz.startsWith(p));
        } catch (e) { return false; }
    }

    // load: 저장된 동의 상태를 읽음. 없거나 형식 버전이 다르면 null(→ 기본값 사용).
    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (o.version !== VERSION) return null;
            return o;
        } catch (e) { return null; }
    }
    function save(state) {
        try { localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...state, ts: Date.now() })); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
    }

    // Default state: EU = 모두 거부, 그 외 = analytics 허용 (KR/US opt-out 모델).
    function defaultState() {
        const eu = inEU();
        return {
            necessary: true,           // 항상 true (서비스 운영 필수)
            analytics: !eu,            // GA
            personalization: !eu,      // 추천 큐레이션, 도시 영상 학습
            decided: false             // 사용자가 명시적으로 결정했는가
        };
    }

    // 현재 상태 = 저장된 값이 있으면 그것, 없으면 기본값.
    let state = load() || defaultState();

    // get: 현재 상태의 복사본 반환(스프레드로 얕은 복사 — 바깥이 원본을 못 바꾸게).
    function get() { return { ...state }; }

    // set: 상태 일부를 바꾸고(사용자 결정으로 표시) 저장 + 알림.
    function set(partial) {
        state = { ...state, ...partial, decided: true };
        save(state);
        broadcast();
    }

    // broadcast: 동의 상태가 바뀌었음을 앱 전체(+GA)에 알린다.
    function broadcast() {
        try {
            // 커스텀 이벤트 발행 — 관심 있는 코드가 'aura:consent' 를 듣고 반응.
            window.dispatchEvent(new CustomEvent('aura:consent', { detail: get() }));
        } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        // gtag consent mode v2
        try {
            if (typeof window.gtag === 'function') {
                window.gtag('consent', 'update', {
                    analytics_storage: state.analytics ? 'granted' : 'denied',
                    ad_storage:        'denied',
                    ad_user_data:      'denied',
                    ad_personalization:'denied',
                    personalization_storage: state.personalization ? 'granted' : 'denied'
                });
            }
        } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
    }

    function showModal() {
        if (document.getElementById('aura-consent-modal')) return;
        const wrap = document.createElement('div');
        wrap.id = 'aura-consent-modal';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-label', 'Privacy preferences');
        wrap.style.cssText = [
            'position:fixed','left:16px','right:16px','bottom:16px',
            'max-width:560px','margin-left:auto','z-index:var(--z-system)',
            'background:#0a0d12','color:#e8eef5',
            'border:1px solid rgba(255,93,80,.45)','border-radius:10px',
            'padding:16px 18px','font:13px/1.55 system-ui,-apple-system,Segoe UI,sans-serif',
            'box-shadow:0 12px 48px rgba(0,0,0,.6)'
        ].join(';');
        const isKo = (navigator.language || '').toLowerCase().startsWith('ko');
        wrap.innerHTML = ''; // safe — no user input

        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:6px;color:#ff5d50;letter-spacing:.04em';
        title.textContent = isKo ? '쿠키 / 저장소 사용 안내' : 'Cookies & local storage';
        wrap.appendChild(title);

        const body = document.createElement('div');
        body.style.cssText = 'opacity:.88;margin-bottom:10px';
        body.textContent = isKo
            ? 'AURA는 서비스 운영에 필요한 항목 외에, 익명 통계(Google Analytics)와 추천 개인화를 위해 브라우저 저장소를 사용할 수 있습니다. 모두 허용 또는 필수만 사용 중 선택하세요.'
            : 'AURA may use cookies and local storage for analytics (Google Analytics) and personalisation in addition to strictly necessary items. Choose your preference.';
        wrap.appendChild(body);

        const links = document.createElement('div');
        links.style.cssText = 'font-size:11px;opacity:.7;margin-bottom:12px';
        const a1 = document.createElement('a');
        a1.href = 'privacy.html'; a1.target = '_blank'; a1.rel = 'noopener';
        a1.style.cssText = 'color:#9ad7ff;margin-right:10px';
        a1.textContent = isKo ? '개인정보처리방침' : 'Privacy';
        const a2 = document.createElement('a');
        a2.href = 'terms.html'; a2.target = '_blank'; a2.rel = 'noopener';
        a2.style.cssText = 'color:#9ad7ff';
        a2.textContent = isKo ? '이용약관' : 'Terms';
        links.appendChild(a1); links.appendChild(a2);
        wrap.appendChild(links);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
        function mkBtn(label, primary) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.style.cssText = [
                'flex:1 1 130px','min-width:130px',
                'padding:9px 12px','border-radius:6px',
                'font:600 12px ui-monospace,monospace','letter-spacing:.06em','cursor:pointer',
                primary
                    ? 'background:#ff5d50;color:#0a0d12;border:1px solid #ff5d50'
                    : 'background:transparent;color:#e8eef5;border:1px solid rgba(255,255,255,.25)'
            ].join(';');
            return b;
        }
        const accept = mkBtn(isKo ? '모두 허용' : 'ACCEPT ALL', true);
        const reject = mkBtn(isKo ? '필수만 사용' : 'NECESSARY ONLY', false);
        accept.addEventListener('click', () => { set({ analytics: true, personalization: true }); close(); });
        reject.addEventListener('click', () => { set({ analytics: false, personalization: false }); close(); });
        btnRow.appendChild(accept); btnRow.appendChild(reject);
        wrap.appendChild(btnRow);

        function close() { wrap.remove(); }
        document.body.appendChild(wrap);
    }

    // 첫 방문 + 미결정 + EU 거주 → 모달. 그 외 지역도 미결정이면 알리지만 default granted.
    function maybeShow() {
        if (state.decided) return;
        if (inEU()) {
            // EU: 결정 전엔 default denied 상태 유지 + 모달
            if (document.body) showModal();
            else document.addEventListener('DOMContentLoaded', showModal, { once: true });
        } else {
            // EU 외: default granted, 첫 방문 1회 자동 동의 처리(KR opt-out)
            set({ analytics: state.analytics, personalization: state.personalization });
        }
    }

    // 외부에서 강제 모달 (privacy 메뉴 등에서)
    function openSettings() {
        if (document.body) showModal();
    }

    // 즉시 broadcast (페이지 로드 시 GA 가 초기 상태 알도록)
    // setTimeout(…, 0): 지금 실행 흐름이 끝난 직후로 미뤄 GA 초기화 뒤 상태를 전달.
    setTimeout(broadcast, 0);
    // 필요하면 동의 모달 표시(EU 미결정 시) 또는 자동 처리.
    maybeShow();

    // 공개 API — privacy 메뉴 등에서 window.AURA_CONSENT.openSettings() 로 다시 열 수 있다.
    window.AURA_CONSENT = { get, set, openSettings, inEU };
})();
