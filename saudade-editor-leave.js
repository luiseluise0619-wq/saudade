// SAUDADE · v6 §9.10 EDITOR-ON-LEAVE AUTO-PAUSE (client adapter)
// Worker /editor/leave-status 에서 stage 받아 body[data-leave-stage] 세팅.
// 적용 범위: § 03 일간 디스패치 + Cover. 분기/Ledger/Atlas 영향 X (헌법 §9.10).
//
// Stage:
//   active        — 정상 (UI 변경 없음)
//   soft (≥7d)    — 일간 dispatch item 마다 UNEDITED 라벨 표시 (계속 발행)
//   hard (≥14d)   — 일간 dispatch 본문 숨김 + 정지 메시지 + 상단 배너 + Cover 메시지
//   subscription  — hard 동작 + 구독 자동 일시중지 카피 추가 (Stripe 부활 후 동작)
//
// 워커 미바인딩/오프라인 시 stage='active' 폴백 — 무해.
'use strict';

// IIFE — 로드 즉시 실행. "편집장 휴직 자동 정지"를 클라이언트에 반영하는 어댑터.
// Worker 가 준 stage 를 body[data-leave-stage] 로 세팅 → CSS 가 UI 변화를 담당.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_LEAVE) return;

    // CACHE_TTL_MS: 상태 캐시 유효기간(10분). _status: 현재 단계 캐시.
    // _fetchedAt: 마지막 로드 시각. _fetching: 진행 중 fetch Promise(중복 요청 방지).
    const CACHE_TTL_MS = 10 * 60 * 1000;
    let _status = { stage: 'active', days_idle: null, last_activity: null };
    let _fetchedAt = 0;
    let _fetching = null;

    // load — Worker 에서 편집장 휴직 단계를 가져온다(force 로 캐시 무시 가능).
    function load(force) {
        // 캐시가 아직 신선하면 네트워크 없이 반환.
        if (!force && _fetchedAt && (Date.now() - _fetchedAt) < CACHE_TTL_MS) {
            return Promise.resolve(_status);
        }
        // 이미 로드 중이면 그 Promise 를 재사용.
        if (_fetching) return _fetching;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        // 서버 주소가 없으면 stage='active' 로 폴백(무해).
        if (!base) {
            _fetchedAt = Date.now();
            applyState();
            return Promise.resolve(_status);
        }
        // GET /editor/leave-status — 편집장 활동 유휴 상태와 단계를 받는다.
        _fetching = fetch(base + '/editor/leave-status', {
            cache: 'no-cache',
            credentials: 'omit'
        })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                _status = d && d.stage ? d : { stage: 'active', days_idle: null };
                _fetchedAt = Date.now();
                _fetching = null;
                applyState();
                return _status;
            })
            .catch(() => {
                _status = { stage: 'active', days_idle: null };
                _fetchedAt = Date.now();
                _fetching = null;
                applyState();
                return _status;
            });
        return _fetching;
    }

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // copy — 배너/정지 메시지 문구를 현재 언어로 묶어 반환.
    function copy() {
        return {
            head: L({
                en: 'EDITOR ON LEAVE',
                ko: '편집장 휴직 중',
                ja: '編集長 休暇中',
                pt: 'EDITOR DE LICENÇA',
                es: 'EDITOR DE BAJA'
            }),
            paused: L({
                en: 'Daily dispatches paused.',
                ko: '일간 디스패치 정지.',
                ja: '日刊通信 停止。',
                pt: 'Despachos diários pausados.',
                es: 'Despachos diarios pausados.'
            }),
            unedited: L({
                en: 'UNEDITED',
                ko: '미편집',
                ja: '未編集',
                pt: 'NÃO REVISTO',
                es: 'SIN REVISAR'
            }),
            sinceTpl: function(days) {
                const n = Math.max(0, days | 0);
                return L({
                    en: `${n} ${n === 1 ? 'DAY' : 'DAYS'} IDLE`,
                    ko: `${n}일째 활동 없음`,
                    ja: `${n}日 動きなし`,
                    pt: `${n} ${n === 1 ? 'DIA' : 'DIAS'} SEM ATIVIDADE`,
                    es: `${n} ${n === 1 ? 'DÍA' : 'DÍAS'} SIN ACTIVIDAD`
                });
            },
            subPaused: L({
                en: 'Subscriptions auto-paused.',
                ko: '구독 자동 일시중지.',
                ja: '購読 自動停止。',
                pt: 'Subscrições pausadas automaticamente.',
                es: 'Suscripciones pausadas automáticamente.'
            }),
            pausedHead: L({
                en: 'DISPATCHES PAUSED',
                ko: '디스패치 정지',
                ja: '通信停止',
                pt: 'DESPACHOS PAUSADOS',
                es: 'DESPACHOS PAUSADOS'
            }),
            resume: L({
                en: 'Filing resumes when the editor returns.',
                ko: '편집장 복귀 시 발행 재개.',
                ja: '編集長の復帰とともに発行再開。',
                pt: 'A publicação retoma com o regresso do editor.',
                es: 'La publicación se reanuda al regresar el editor.'
            })
        };
    }

    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입. body[data-leave-stage] 값별 규칙.
    function injectStyles() {
        if (document.getElementById('sddLeaveStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddLeaveStyles';
        s.textContent = `
.sdd-leave-banner {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 11;
    background: var(--paper-d);
    border-bottom: 0.5px solid var(--rule-2);
    padding: 8px clamp(24px, 6vw, 80px);
    display: none;
    gap: 16px;
    align-items: baseline;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--signal);
    pointer-events: none;
}
body[data-leave-stage="hard"] .sdd-leave-banner,
body[data-leave-stage="subscription"] .sdd-leave-banner { display: flex; }
body[data-leave-stage="subscription"] .sdd-leave-banner { color: var(--rust); }
.sdd-leave-banner .sdd-leave-head { color: var(--rust); white-space: nowrap; }
.sdd-leave-banner .sdd-leave-body em {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 300;
    font-size: 13px;
    text-transform: none;
    color: var(--ink);
    letter-spacing: 0;
}

/* 마스트헤드를 배너 아래로 밀기 — 마스트헤드 z-index 가 더 낮으므로 top 보정만 */
body[data-leave-stage="hard"] .sdd-masthead,
body[data-leave-stage="subscription"] .sdd-masthead,
body[data-leave-stage="hard"] .sdd-qdisp-mast,
body[data-leave-stage="subscription"] .sdd-qdisp-mast { top: 36px; }

/* SOFT — § 03 일간 dispatch item 마다 UNEDITED 라벨 (CSS pseudo) */
body[data-leave-stage="soft"] .sdd-disp-item .sdd-disp-body { position: relative; }
body[data-leave-stage="soft"] .sdd-disp-item .sdd-disp-body::before {
    content: var(--sdd-leave-unedited-label, 'UNEDITED');
    display: inline-block;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--signal);
    padding: 2px 6px;
    border: 0.5px solid var(--signal);
    margin: 0 0 8px;
    align-self: flex-start;
}

/* HARD / SUBSCRIPTION — § 03 일간 dispatch 본문 숨기고 정지 메시지 표시 */
body[data-leave-stage="hard"] .sdd-disp-today,
body[data-leave-stage="hard"] .sdd-disp-archive,
body[data-leave-stage="hard"] .sdd-disp-sunday,
body[data-leave-stage="subscription"] .sdd-disp-today,
body[data-leave-stage="subscription"] .sdd-disp-archive,
body[data-leave-stage="subscription"] .sdd-disp-sunday { display: none; }

.sdd-disp-paused {
    margin: clamp(40px, 6vw, 80px) 0;
    padding: clamp(40px, 6vw, 80px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    text-align: center;
    display: none;
}
body[data-leave-stage="hard"] .sdd-disp-paused,
body[data-leave-stage="subscription"] .sdd-disp-paused { display: block; }
.sdd-disp-paused-head {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 12px;
}
.sdd-disp-paused-body {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(20px, 2.4vw, 28px);
    line-height: 1.4;
    color: var(--ink);
    margin: 0;
}
.sdd-disp-paused-sub {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 12px 0 0;
}

/* COVER 메시지 — section-active 아닐 때만 표시 (cover 위) */
.sdd-leave-cover-msg {
    position: fixed;
    top: 56px;
    right: clamp(24px, 6vw, 80px);
    z-index: 7;
    pointer-events: none;
    max-width: 280px;
    text-align: right;
    display: none;
}
body[data-leave-stage="hard"] .sdd-leave-cover-msg,
body[data-leave-stage="subscription"] .sdd-leave-cover-msg { display: block; }
body.section-active .sdd-leave-cover-msg,
body.cafe-mode      .sdd-leave-cover-msg,
body.qdispatch-active .sdd-leave-cover-msg { display: none !important; }
.sdd-leave-cover-msg .head {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 4px;
}
.sdd-leave-cover-msg .body {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: 14px;
    line-height: 1.4;
    color: var(--ink);
    margin: 0;
}

@media (max-width: 768px) {
    .sdd-leave-banner { padding: 6px 16px; font-size: 9px; gap: 8px; flex-wrap: wrap; }
    .sdd-leave-banner .sdd-leave-body em { font-size: 11px; }
    .sdd-leave-cover-msg { display: none !important; }
    body[data-leave-stage="hard"] .sdd-masthead,
    body[data-leave-stage="subscription"] .sdd-masthead,
    body[data-leave-stage="hard"] .sdd-qdisp-mast,
    body[data-leave-stage="subscription"] .sdd-qdisp-mast { top: 28px; }
}

@media print {
    .sdd-leave-banner, .sdd-leave-cover-msg { display: none !important; }
}
`;
        document.head.appendChild(s);
    }

    // ensureBanner — 상단 "편집장 휴직" 배너 요소를 한 번만 만든다(aria-live 로 알림).
    function ensureBanner() {
        let b = document.getElementById('sddLeaveBanner');
        if (b) return b;
        b = document.createElement('aside');
        b.id = 'sddLeaveBanner';
        b.className = 'sdd-leave-banner';
        b.setAttribute('aria-live', 'polite');
        b.innerHTML = '<span class="sdd-leave-head"></span><span class="sdd-leave-body"></span>';
        document.body.appendChild(b);
        return b;
    }

    // ensureCoverMsg — 표지 위에 뜨는 "휴직" 안내 메시지 요소를 한 번만 만든다.
    function ensureCoverMsg() {
        let m = document.getElementById('sddLeaveCoverMsg');
        if (m) return m;
        m = document.createElement('aside');
        m.id = 'sddLeaveCoverMsg';
        m.className = 'sdd-leave-cover-msg';
        m.innerHTML = '<p class="head"></p><p class="body"></p>';
        document.body.appendChild(m);
        return m;
    }

    // ensureDispatchPaused — § 03 디스패치 화면 안에 "정지" 안내 블록을 한 번만 삽입.
    function ensureDispatchPaused() {
        const root = document.getElementById('sddDispatches');
        if (!root) return null;
        let el = root.querySelector('.sdd-disp-paused');
        if (el) return el;
        el = document.createElement('section');
        el.className = 'sdd-disp-paused';
        el.innerHTML = '<p class="sdd-disp-paused-head"></p><p class="sdd-disp-paused-body"></p><p class="sdd-disp-paused-sub"></p>';
        const foot = root.querySelector('.sdd-disp-foot');
        if (foot) root.insertBefore(el, foot);
        else root.appendChild(el);
        return el;
    }

    // applyEditionVar — SOFT 단계의 "UNEDITED" 라벨 문구를 CSS 변수로 넘긴다(::before content).
    function applyEditionVar() {
        const c = copy();
        // CSS string 안전 escape — 작은따옴표는 백슬래시 처리
        const safe = String(c.unedited).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        document.documentElement.style.setProperty('--sdd-leave-unedited-label', `'${safe}'`);
    }

    // renderBanner — hard/subscription 단계에서만 상단 배너 문구를 채운다(그 외엔 비운다).
    function renderBanner() {
        const stage = (_status && _status.stage) || 'active';
        const b = ensureBanner();
        if (stage !== 'hard' && stage !== 'subscription') {
            b.querySelector('.sdd-leave-head').textContent = '';
            b.querySelector('.sdd-leave-body').textContent = '';
            return;
        }
        const c = copy();
        const days = (_status && Number.isFinite(_status.days_idle)) ? _status.days_idle : 0;
        const isSub = stage === 'subscription';
        const sub = isSub ? ' · ' + c.subPaused : '';
        b.querySelector('.sdd-leave-head').textContent = c.head;
        b.querySelector('.sdd-leave-body').innerHTML =
            `<em>${escapeHtml(c.paused)}</em> ${escapeHtml(c.sinceTpl(days))}${escapeHtml(sub)}`;
    }

    // renderDispatchPause — hard/subscription 단계에서 § 03 정지 블록 문구를 채운다.
    function renderDispatchPause() {
        const stage = (_status && _status.stage) || 'active';
        if (stage !== 'hard' && stage !== 'subscription') return;
        const el = ensureDispatchPaused();
        if (!el) return;
        const c = copy();
        el.querySelector('.sdd-disp-paused-head').textContent = c.pausedHead;
        el.querySelector('.sdd-disp-paused-body').textContent = c.paused;
        el.querySelector('.sdd-disp-paused-sub').textContent = c.resume;
    }

    // renderCoverMsg — hard/subscription 단계에서 표지 안내 메시지 문구를 채운다.
    function renderCoverMsg() {
        const stage = (_status && _status.stage) || 'active';
        if (stage !== 'hard' && stage !== 'subscription') return;
        const m = ensureCoverMsg();
        const c = copy();
        m.querySelector('.head').textContent = c.head;
        m.querySelector('.body').textContent = c.paused;
    }

    // applyState — 현재 단계를 body 속성에 반영하고 배너/정지/표지 문구를 모두 갱신.
    function applyState() {
        const stage = (_status && _status.stage) || 'active';
        document.body.setAttribute('data-leave-stage', stage);
        applyEditionVar();
        renderBanner();
        renderDispatchPause();
        renderCoverMsg();
    }

    // init — 모듈 시동: 스타일 주입 + 초기 active 세팅 + 상태 로드 + 변화 감시 + 주기적 재로딩.
    function init() {
        injectStyles();
        // 첫 진입 — body 속성 미리 active 로
        document.body.setAttribute('data-leave-stage', 'active');
        applyEditionVar();
        load();
        // 에디션/섹션 속성이 바뀌면 문구를 다시 채우고 정지 블록을 재주입.
        // edition / section 변경 시 카피 갱신 + paused element 재주입
        const mo = new MutationObserver(() => applyState());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition', 'data-section'] });
        // saudade-dispatches 가 § 03 진입 시 root 를 다시 그리면 paused element 가 빠질 수 있음
        const inner = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '03') renderDispatchPause();
        });
        inner.observe(document.body, { childList: true, subtree: true });
        // 30분마다 백그라운드 재로딩 — 편집자 활동이 stage 를 active 로 되돌리는 즉시 반영하지는
        // 못하지만 (캐시 10분), 다음 호출에서 따라잡음.
        setInterval(() => load(true), 30 * 60 * 1000);
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 현재 상태/단계 조회, 강제 새로고침, 문구 접근.
    window.SAUDADE_LEAVE = {
        getStatus: () => _status,
        getStage:  () => (_status && _status.stage) || 'active',
        reload: () => { _fetchedAt = 0; return load(true); },
        copy
    };
})();
