// SAUDADE · EDITION SYSTEM (Handoff v2 §2)
// 5 별쇄 — en / ko / ja / pt / es. body[data-edition] 토글로 다른 잡지 입장.
// 실시간 번역 X — 사용자가 명시적 선택.
// localStorage: saudade.edition.
'use strict';

(function() {
    if (window.SAUDADE_EDITION) return;

    const KEY = 'saudade.edition';
    const SUPPORTED = ['en', 'ko', 'ja', 'pt', 'es'];
    const DEFAULT = 'en';

    const META = {
        en: { name: 'English',   loading: 'Opening English edition…' },
        ko: { name: '한국어',    loading: '한국어판을 펼치는 중…' },
        ja: { name: '日本語',    loading: '日本語版をひらいている…' },
        pt: { name: 'Português', loading: 'A abrir a edição portuguesa…' },
        es: { name: 'Español',   loading: 'Abriendo la edición en español…' }
    };

    function getEdition() {
        try { const v = localStorage.getItem(KEY); return SUPPORTED.includes(v) ? v : null; }
        catch (e) { return null; }
    }
    function saveEdition(v) {
        try { localStorage.setItem(KEY, v); } catch (e) {}
    }

    function applyEdition(ed) {
        if (!SUPPORTED.includes(ed)) ed = DEFAULT;
        // v621 — body 없으면 (script in <head> 일 때) skip. init 이 DOMContentLoaded 후 다시 호출.
        if (!document.body) {
            document.documentElement.setAttribute('lang', ed);
            return;
        }
        document.body.setAttribute('data-edition', ed);
        document.body.classList.remove(...SUPPORTED.map(c => 'edition-' + c));
        document.body.classList.add('edition-' + ed);
        document.documentElement.setAttribute('lang', ed);
        // window.state.lang 도 동기화 (saudade-cover/atlas 등 lang 보는 곳)
        if (!window.state) window.state = {};
        try { window.state.lang = ed; } catch (e) {}
    }

    function showLoadingFlash(toEd) {
        const m = META[toEd] || META.en;
        const el = document.createElement('div');
        el.id = 'sddEditionFlash';
        el.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:var(--paper)', 'color:var(--ink)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'font-family:var(--serif)', 'font-weight:300', 'font-style:italic',
            'font-size:clamp(20px,2.4vw,28px)',
            'letter-spacing:var(--tr-fraunces-h3)',
            'pointer-events:none',
            'opacity:0', 'transition:opacity .2s ease-out'
        ].join(';') + ';';
        el.textContent = m.loading;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        return el;
    }

    function set(ed, opts) {
        if (!SUPPORTED.includes(ed)) return;
        const cur = getEdition() || DEFAULT;
        if (cur === ed && opts?.skipFlash) {
            applyEdition(ed);
            return;
        }
        const flash = showLoadingFlash(ed);
        setTimeout(() => {
            applyEdition(ed);
            saveEdition(ed);
            // 모든 saudade-* 모듈 reload
            try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
            try { window.SAUDADE_ATLAS?.reload?.(); } catch (e) {}
            try { window.SAUDADE_LEDGER?.render?.(); } catch (e) {}
            try { window.SAUDADE_DISPATCHES?.reload?.(); } catch (e) {}
            try { window.SAUDADE_DESK?.render?.(); } catch (e) {}
            try { window.SAUDADE_LISTENING?.reload?.(); } catch (e) {}
        }, 600);
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => flash.remove(), 300);
        }, 1200);
    }

    function init() {
        const ed = getEdition() || DEFAULT;
        applyEdition(ed);
    }

    // v621 — body 가 있을 때 한 번 + DOMContentLoaded 이후 한 번 더 (race 방지).
    // 이렇게 하면 lang attr 은 가능한 빨리, body class 는 body 있을 때 안전하게.
    init();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 이미 로드됨 → init() 한 번 더 (body 있을 것)
        init();
    }

    window.SAUDADE_EDITION = { set, get: () => getEdition() || DEFAULT, SUPPORTED, META };

    // v622 — 글로벌 i18n 헬퍼. 컴포넌트들이 self-내장 COPY 정의할 필요 없이 호출.
    // 사용: SAUDADE_T({ en: 'Cafés', ko: '카페', ja: 'カフェ', pt: 'Cafés', es: 'Cafés' })
    // 누락된 에디션은 en fallback.
    window.SAUDADE_T = function(strings) {
        if (!strings || typeof strings !== 'object') return '';
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return strings[ed] || strings.en || Object.values(strings)[0] || '';
    };
})();
