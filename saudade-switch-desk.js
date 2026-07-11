// SAUDADE · v7 §5.4 — Switch the Desk (임시 도시 모드)
//
// "Switch the desk to Berlin" 버튼 → 3일간 Dispatches 만 변경.
// Atlas + Ledger 는 정착 도시 (home) 유지.
// 3일 후 자동 복귀. "Returning to Lisbon in 3 days" 표시.
// "Keep me on Berlin permanently" → 정착 도시 자체 변경.
//
// 클라이언트 only. localStorage 만 사용. 서버 전송 0.
// API:
//   window.SAUDADE_DESK_SWITCH.switchTo(city)        — 임시 전환 (3일)
//   window.SAUDADE_DESK_SWITCH.makePermanent()       — home 자체 변경
//   window.SAUDADE_DESK_SWITCH.revert()              — 즉시 복귀
//   window.SAUDADE_DESK_SWITCH.getActive()           — { from, to, until } | null
//   window.SAUDADE_DESK_SWITCH.getDispatchCity()     — Dispatches 가 사용할 도시
//   window.SAUDADE_DESK_SWITCH.getHomeCity()         — Atlas/Ledger 정착 도시
'use strict';

// IIFE — 로드 즉시 실행. "데스크를 임시로 다른 도시로 3일간 전환"하는 클라이언트 전용 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_DESK_SWITCH) return;

    // KEY_HOME: 정착 도시. KEY_SWITCH: 임시 전환 상태(from/to/until). 전환 유지 기간 3일.
    const KEY_HOME   = 'saudade.home.city';        // 정착 도시
    const KEY_SWITCH = 'saudade.desk.switch';      // 임시 전환 { from, to, until }
    const SWITCH_DAYS = 3;
    const SWITCH_MS   = SWITCH_DAYS * 86400 * 1000;

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // getStored/setStored — localStorage 읽기/쓰기 얇은 래퍼(실패해도 조용히 통과).
    function getStored(k)    { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function setStored(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }

    // getHomeCity — 정착 도시(없으면 기본 Lisbon).
    function getHomeCity() {
        return getStored(KEY_HOME) || 'Lisbon';   // default per spec example
    }
    // setHomeCity — 정착 도시를 저장(공백 제거).
    function setHomeCity(city) {
        setStored(KEY_HOME, String(city || '').trim());
    }

    // getActive — 유효한 임시 전환 상태를 반환. 만료됐으면 자동 청소 후 null.
    function getActive() {
        try {
            const raw = getStored(KEY_SWITCH);
            if (!raw) return null;
            const a = JSON.parse(raw);
            if (!a || !a.until || a.until < Date.now()) {
                // 만료 → 자동 청소
                setStored(KEY_SWITCH, null);
                return null;
            }
            return a;
        } catch (e) { return null; }
    }

    // switchTo — 대상 도시로 3일간 임시 전환(정착 도시와 같으면 무시).
    function switchTo(city) {
        const home = getHomeCity();
        const target = String(city || '').trim();
        if (!target || target === home) return false;
        const sw = { from: home, to: target, until: Date.now() + SWITCH_MS };
        setStored(KEY_SWITCH, JSON.stringify(sw));
        notifyChange();
        return true;
    }

    // makePermanent — 임시 전환 대상을 아예 정착 도시로 굳힌다.
    function makePermanent() {
        const a = getActive();
        if (!a) return false;
        setHomeCity(a.to);
        setStored(KEY_SWITCH, null);
        notifyChange();
        return true;
    }

    // revert — 임시 전환을 즉시 취소하고 정착 도시로 복귀.
    function revert() {
        setStored(KEY_SWITCH, null);
        notifyChange();
        return true;
    }

    // getDispatchCity — 디스패치가 쓸 도시(전환 중이면 대상, 아니면 정착 도시).
    // Dispatches 가 사용할 도시 (switch 활성 시 to, 아니면 home)
    function getDispatchCity() {
        const a = getActive();
        return a ? a.to : getHomeCity();
    }

    // notifyChange — 전환 상태를 body 속성 + 커스텀 이벤트로 알리고 배너를 갱신.
    // 변경 알림 — body data attr + custom event
    function notifyChange() {
        const a = getActive();
        const home = getHomeCity();
        const dispatchCity = getDispatchCity();
        if (a) {
            document.body.setAttribute('data-desk-switched', '1');
            document.body.setAttribute('data-desk-to', a.to);
        } else {
            document.body.removeAttribute('data-desk-switched');
            document.body.removeAttribute('data-desk-to');
        }
        try {
            window.dispatchEvent(new CustomEvent('saudade:desk-switched', {
                detail: { home, dispatchCity, switch: a }
            }));
        } catch (e) {}
        renderBanner();
    }

    // daysRemaining — 전환 만료까지 남은 일수(올림).
    function daysRemaining() {
        const a = getActive();
        if (!a) return 0;
        return Math.max(0, Math.ceil((a.until - Date.now()) / 86400000));
    }

    // ─── 배너: "Returning to Lisbon in 3 days" ────────────────
    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddDeskSwitchStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDeskSwitchStyles';
        s.textContent = `
.sdd-desk-switch-banner {
    position: fixed;
    top: 36px;
    left: 0; right: 0;
    z-index: 9;
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    padding: 8px clamp(24px, 6vw, 80px);
    display: none;
    align-items: baseline;
    gap: 16px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--bone-d);
}
body[data-desk-switched="1"] .sdd-desk-switch-banner { display: flex; }
.sdd-desk-switch-banner .label { color: var(--rust); }
.sdd-desk-switch-banner .body em {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 300;
    font-size: 13px;
    text-transform: none;
    color: var(--ink);
    letter-spacing: 0;
}
.sdd-desk-switch-banner .actions {
    display: flex;
    gap: 12px;
    margin-left: auto;
}
.sdd-desk-switch-banner button {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 0;
}
.sdd-desk-switch-banner button:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-desk-switch-banner button.ghost { color: var(--bone-d); }

@media (max-width: 768px) {
    .sdd-desk-switch-banner { padding: 6px 16px; font-size: 9px; flex-wrap: wrap; gap: 8px; }
    .sdd-desk-switch-banner .body em { font-size: 11px; }
}
@media print {
    .sdd-desk-switch-banner { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    // ensureBanner — "N일 후 복귀" 배너 요소를 한 번만 만들고 버튼 핸들러를 건다.
    function ensureBanner() {
        let b = document.getElementById('sddDeskSwitchBanner');
        if (b) return b;
        b = document.createElement('aside');
        b.id = 'sddDeskSwitchBanner';
        b.className = 'sdd-desk-switch-banner';
        b.setAttribute('aria-live', 'polite');
        b.innerHTML = `
            <span class="label" data-l-label></span>
            <span class="body" data-l-body></span>
            <span class="actions">
                <button type="button" data-make-permanent></button>
                <button type="button" class="ghost" data-revert></button>
            </span>
        `;
        document.body.appendChild(b);
        b.querySelector('[data-make-permanent]').addEventListener('click', () => {
            if (makePermanent()) { /* banner 사라짐 */ }
        });
        b.querySelector('[data-revert]').addEventListener('click', () => { revert(); });
        return b;
    }

    // renderBanner — 전환 중일 때 배너 문구(복귀 D-day, 유지/복귀 버튼 라벨)를 채운다.
    function renderBanner() {
        const a = getActive();
        if (!a) return;
        const b = ensureBanner();
        const days = daysRemaining();
        b.querySelector('[data-l-label]').textContent = L({
            en: 'DESK SWITCHED',  ko: '데스크 전환',  ja: 'デスク移動',
            pt: 'MESA TROCADA',   es: 'MESA CAMBIADA'
        });
        const bodyTpl = L({
            en: `<em>Returning to ${a.from} in ${days} ${days === 1 ? 'day' : 'days'}.</em>`,
            ko: `<em>${a.from} 으로 ${days}일 후 복귀.</em>`,
            ja: `<em>${a.from} へ ${days}日後に復帰。</em>`,
            pt: `<em>A regressar a ${a.from} em ${days} dia${days === 1 ? '' : 's'}.</em>`,
            es: `<em>Regreso a ${a.from} en ${days} día${days === 1 ? '' : 's'}.</em>`
        });
        b.querySelector('[data-l-body]').innerHTML = bodyTpl;
        b.querySelector('[data-make-permanent]').textContent = L({
            en: `KEEP ME ON ${a.to.toUpperCase()}`,
            ko: `${a.to} 에 계속 두기`,
            ja: `${a.to} に留める`,
            pt: `MANTER EM ${a.to.toUpperCase()}`,
            es: `QUEDARSE EN ${a.to.toUpperCase()}`
        });
        b.querySelector('[data-revert]').textContent = L({
            en: 'REVERT NOW',  ko: '지금 복귀',  ja: 'いま戻す',
            pt: 'REVERTER JÁ', es: 'REVERTIR YA'
        });
    }

    // watchEdition — 언어가 바뀌면 배너 문구를 다시 채운다.
    function watchEdition() {
        const mo = new MutationObserver(() => renderBanner());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    // startExpiryWatch — 1분마다 만료를 확인해 지나면 자동 복귀, 아니면 D-day 갱신.
    // 매 분 만료 체크 — 자동 복귀
    function startExpiryWatch() {
        setInterval(() => {
            const a = getActive();
            if (!a) return;
            if (a.until < Date.now()) notifyChange();
            else renderBanner();   // days 카운터 갱신
        }, 60 * 1000);
    }

    // init — 모듈 시동: 스타일 주입 + 부팅 시 상태 동기화 + 감시 시작.
    function init() {
        injectStyles();
        notifyChange();   // 부팅 시 banner 상태 동기화
        watchEdition();
        startExpiryWatch();
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 전역 공개 API — 전환/복귀/정착 도시 관리 + 디스패치 도시 조회.
    window.SAUDADE_DESK_SWITCH = {
        switchTo,
        makePermanent,
        revert,
        getActive,
        getHomeCity,
        setHomeCity,
        getDispatchCity,
        daysRemaining
    };
})();
