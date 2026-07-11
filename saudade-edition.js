// SAUDADE · EDITION SYSTEM
// 5 별쇄 — en / ko / ja / pt / es. body[data-edition] 토글로 다른 잡지 입장.
// 실시간 번역 X — 사용자가 명시적 선택. 각 에디션은 자기 도시·자기 voice.
// localStorage: saudade.edition.
// ═══════════════════════════════════════════════════════════════════════
// [파일 역할 배너 — 초보자 안내]
// saudade-edition.js = "판(edition)" 전환 시스템. 이 신문은 5개 언어판(en/ko/ja/pt/es)이
// 각각 다른 도시·다른 목소리를 가진 별개 잡지다(자동 번역 아님). 사용자가 판을 고르면
// body 의 data-edition 속성을 바꾸고, 각 섹션 모듈을 새 판으로 다시 그린다.
// 또한 "스킨(skin: paper/saturated/dark)" 을 이번 주(ISO week) 기준으로 정해
// 같은 주엔 모든 독자가 같은 표지를 보게 한다(잡지의 "이번 호" 개념).
// 선택은 localStorage 'saudade.edition' 에 저장된다.
// ═══════════════════════════════════════════════════════════════════════
// SAUDADE · EDITION SYSTEM 원문 주석은 위/아래 참고.
'use strict';

// IIFE + 중복 로드 가드.
(function() {
    if (window.SAUDADE_EDITION) return;

    // KEY = 저장 키, SUPPORTED = 지원 언어, DEFAULT = 기본 언어, SKINS = 표지 테마 종류.
    const KEY        = 'saudade.edition';
    const SUPPORTED  = ['en', 'ko', 'ja', 'pt', 'es'];
    const DEFAULT    = 'en';
    const SKINS      = ['paper', 'saturated', 'dark'];

    // Static fallback meta. The full editions config lives in
    // data/editions.json — loaded async. Modules that need cities/voice
    // data should await SAUDADE_EDITION.config(ed) instead of using META.
    const META = {
        en: { name: 'English',   loading: 'Opening English edition…' },
        ko: { name: '한국어',    loading: '한국어판을 펼치는 중…' },
        ja: { name: '日本語',    loading: '日本語版をひらいている…' },
        pt: { name: 'Português', loading: 'A abrir a edição portuguesa…' },
        es: { name: 'Español',   loading: 'Abriendo la edición en español…' }
    };

    // SEO + OG meta per edition. index.html ships a static EN/KO mix
    // (og:locale was hardcoded ko_KR even on EN visits). syncMetaTags()
    // rewrites the <meta> tags after applyEdition() so each edition's
    // share card matches what readers actually see.
    const META_SEO = {
        en: {
            locale: 'en_US',
            title:  'Saudade — a slow newspaper for digital nomads',
            desc:   'Visa ledger, café atlas, dispatches, listening room. Quiet by design.'
        },
        ko: {
            locale: 'ko_KR',
            title:  '사우다지 — 디지털 노마드를 위한 느린 신문',
            desc:   '비자 장부 · 카페 지도 · 통신 · 청취실. 조용히, 천천히.'
        },
        ja: {
            locale: 'ja_JP',
            title:  'サウダージ — デジタルノマドのための、ゆっくりとした新聞',
            desc:   'ビザ帳簿・カフェ地図・通信・リスニングルーム。静かに、ゆっくりと。'
        },
        pt: {
            locale: 'pt_PT',
            title:  'Saudade — um jornal lento para nómadas digitais',
            desc:   'Livro-razão de vistos, atlas de cafés, despachos, sala de escuta. Calmo por escolha.'
        },
        es: {
            locale: 'es_ES',
            title:  'Saudade — un periódico lento para nómadas digitales',
            desc:   'Libro mayor de visas, atlas de cafés, despachos, sala de escucha. Tranquilo por elección.'
        }
    };

    function setMeta(selector, attr, value) {
        const el = document.head.querySelector(selector);
        if (el) el.setAttribute(attr, value);
    }
    function syncMetaTags(ed) {
        const m = META_SEO[ed] || META_SEO.en;
        // <title> + description
        document.title = m.title;
        setMeta('meta[name="description"]', 'content', m.desc);
        // OG
        setMeta('meta[property="og:title"]',       'content', m.title);
        setMeta('meta[property="og:description"]', 'content', m.desc);
        setMeta('meta[property="og:locale"]',      'content', m.locale);
        // Twitter
        setMeta('meta[name="twitter:title"]',       'content', m.title);
        setMeta('meta[name="twitter:description"]', 'content', m.desc);
    }

    // _config = 불러온 editions.json 데이터, _configP = 그 로딩 약속(Promise). 한 번만 받게 캐싱.
    let _config = null;     // editions.json once loaded
    let _configP = null;    // promise

    // loadConfig: 판별 상세 설정(도시/목소리)을 한 번만 불러온다.
    function loadConfig() {
        // 이미 로딩을 시작했으면 그 약속을 재사용(중복 요청 방지).
        if (_configP) return _configP;
        // cache:'force-cache' = 가능하면 캐시에서(네트워크 아낌). 실패해도 앱은 계속.
        _configP = fetch('./data/editions.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _config = d; return d; })
            .catch(() => null);
        return _configP;
    }

    // getEdition: 저장된 판을 읽음(지원 목록에 있을 때만). 없으면 null.
    function getEdition() {
        try { const v = localStorage.getItem(KEY); return SUPPORTED.includes(v) ? v : null; }
        catch (e) { return null; }
    }
    // saveEdition: 선택한 판을 저장.
    function saveEdition(v) {
        try { localStorage.setItem(KEY, v); } catch (e) {}
    }

    // ─── Skin rotation (per-issue, not per-user) ──────────────────────
    // Three rotations per edition: paper / saturated / dark.
    // Selected deterministically from ISO week so every reader sees the
    // same cover this week — that's the whole point of an "issue".
    function isoWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (date.getUTCDay() + 6) % 7;
        date.setUTCDate(date.getUTCDate() - dayNum + 3);
        const firstThursday = date.valueOf();
        date.setUTCMonth(0, 1);
        if (date.getUTCDay() !== 4) date.setUTCMonth(0, 1 + ((4 - date.getUTCDay()) + 7) % 7);
        return 1 + Math.ceil((firstThursday - date) / 604800000);
    }
    // Theme override key — user picks "auto" / "paper" / "saturated" / "dark".
    // "auto" defers to the ISO-week rotation below + prefers-color-scheme.
    const KEY_SKIN = 'saudade.skin';
    function getSkinPref() {
        try { const v = localStorage.getItem(KEY_SKIN);
              return v && (SKINS.includes(v) || v === 'auto') ? v : 'auto'; }
        catch { return 'auto'; }
    }
    function saveSkinPref(v) { try { localStorage.setItem(KEY_SKIN, v); } catch {} }

    // pickSkin: 지금 보여줄 표지 테마를 결정.
    function pickSkin() {
        const pref = getSkinPref();
        // 사용자가 직접 골랐으면 그대로.
        if (pref !== 'auto') return pref;
        if (!matchMedia) return 'paper';
        // 움직임 최소화를 선호하면 차분한 paper.
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'paper';
        // 기기가 다크 모드면 dark.
        if (matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        // 그 외엔 이번 주 번호로 결정(같은 주 = 같은 표지).
        const week = isoWeekNumber(new Date());
        // 5-week rotation when auto: paper × 3, saturated, dark.
        const cycle = ['paper', 'paper', 'paper', 'saturated', 'dark'];
        return cycle[week % cycle.length];
    }
    function applySkin(skin) {
        const s = SKINS.includes(skin) ? skin : 'paper';
        document.documentElement.setAttribute('data-skin', s);
        return s;
    }
    function setSkin(v) {
        if (v !== 'auto' && !SKINS.includes(v)) return;
        saveSkinPref(v);
        applySkin(pickSkin());
    }

    let _pinged = false;
    function pingOnce(ed) {
        // One anonymous counter call per session ("did anyone visit").
        // Worker /api/ping increments a KV counter keyed by date+edition.
        // No identifier, no UA, no IP logging.
        if (_pinged) return;
        _pinged = true;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return;
        try {
            fetch(base + '/api/ping?e=session_start&ed=' + encodeURIComponent(ed),
                  { method: 'GET', mode: 'cors', credentials: 'omit', keepalive: true })
                .catch(() => {});
        } catch (e) {}
    }

    // applyEdition: 실제로 화면을 이 판으로 바꾼다(속성/클래스/언어/메타 반영).
    function applyEdition(ed) {
        // 알 수 없는 판이면 기본값으로.
        if (!SUPPORTED.includes(ed)) ed = DEFAULT;
        // body 없을 때 (script in <head>) skip — init re-runs after DOMContentLoaded
        if (!document.body) {
            document.documentElement.setAttribute('lang', ed);
            return;
        }
        // body 에 현재 판을 표시(CSS 가 이걸로 판별 스타일 적용).
        document.body.setAttribute('data-edition', ed);
        // 이전 판 클래스들을 모두 지우고(스프레드로 펼침) 현재 판 클래스만 추가.
        document.body.classList.remove(...SUPPORTED.map(c => 'edition-' + c));
        document.body.classList.add('edition-' + ed);
        document.documentElement.setAttribute('lang', ed);
        // 전역 상태(window.state)에도 언어 기록(다른 코드 참조용).
        if (!window.state) window.state = {};
        try { window.state.lang = ed; } catch (e) {}
        // SEO/공유카드 메타 태그를 이 판에 맞게 갱신.
        syncMetaTags(ed);
        // 익명 방문 카운터 1회 전송.
        pingOnce(ed);
    }

    function showLoadingFlash(toEd) {
        const m = META[toEd] || META.en;
        const el = document.createElement('div');
        el.id = 'sddEditionFlash';
        el.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:var(--z-system)',
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

    // set: 사용자가 판을 바꿀 때의 공개 진입점. 로딩 연출 후 적용 + 모든 섹션 다시 그림.
    function set(ed, opts) {
        if (!SUPPORTED.includes(ed)) return;
        const cur = getEdition() || DEFAULT;
        // 같은 판이고 연출 생략 옵션이면 바로 적용.
        if (cur === ed && opts?.skipFlash) {
            applyEdition(ed);
            return;
        }
        // "판을 펼치는 중…" 전체화면 안내를 띄운다.
        const flash = showLoadingFlash(ed);
        // 잠깐 뒤(600ms) 실제 전환. ?.()= 그 모듈이 있을 때만 호출(옵셔널).
        setTimeout(() => {
            applyEdition(ed);
            saveEdition(ed);
            // Reload all section modules — each rebuilds against the new edition
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

    // init: 시작 시 저장된 판/스킨을 적용하고 설정 파일을 미리 불러온다.
    function init() {
        const ed = getEdition() || DEFAULT;
        applyEdition(ed);
        applySkin(pickSkin());
        loadConfig();
    }

    // 먼저 한 번 실행(가능한 빨리 lang/skin 반영), DOM 준비 후 다시 한 번(body 확보).
    init();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── Latin digit normaliser ──────────────────────────────────────
    // 헌법: numerals are ALWAYS Latin digits (47, 06, 1.2 km), never
    // "사십칠" or "四十七". This helper converts any string written with
    // Korean / Japanese / Arabic-Indic numerals back to Latin so cover/
    // dispatch headlines that AI-drafted in non-Latin form get fixed
    // before render.
    const NUM_MAPS = [
        // CJK numerals
        { from: ['零','〇','〇'], to: '0' },
        { from: ['一','壹'], to: '1' },
        { from: ['二','貳','弐'], to: '2' },
        { from: ['三','參','参'], to: '3' },
        { from: ['四','肆'], to: '4' },
        { from: ['五','伍'], to: '5' },
        { from: ['六','陸'], to: '6' },
        { from: ['七','柒'], to: '7' },
        { from: ['八','捌'], to: '8' },
        { from: ['九','玖'], to: '9' }
    ];
    // Full-width digits 0-9 → ASCII
    function toLatinDigits(s) {
        if (typeof s !== 'string' || !s) return s;
        // Full-width 0-9 (U+FF10..FF19)
        s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        // Arabic-Indic 0-9
        s = s.replace(/[٠-٩]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 48));
        s = s.replace(/[۰-۹]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x06F0 + 48));
        // CJK simple numerals — best-effort. Only swap when isolated digit
        // (avoids breaking compound kanji words like 三日).
        for (const m of NUM_MAPS) {
            for (const ch of m.from) {
                s = s.split(ch).join(m.to);   // best-effort; constitution wants Latin
            }
        }
        return s;
    }

    // 공개 API — 다른 모듈이 판/스킨/설정에 접근하는 창구.
    window.SAUDADE_EDITION = {
        set,
        get: () => getEdition() || DEFAULT,
        skin: () => document.documentElement.getAttribute('data-skin') || 'paper',
        setSkin,                            // 'auto' | 'paper' | 'saturated' | 'dark'
        skinPref: getSkinPref,              // returns current pref ('auto' or named)
        config: async (ed) => {
            await loadConfig();
            return _config?.[ed || (getEdition() || DEFAULT)] || null;
        },
        configSync: (ed) => _config?.[ed || (getEdition() || DEFAULT)] || null,
        toLatinDigits,
        SUPPORTED,
        SKINS,
        META
    };

    // Global i18n helper. Components: SAUDADE_T({ en, ko, ja, pt, es })
    // Missing edition → en fallback.
    // SAUDADE_T: 어디서든 쓰는 번역 도우미. 현재 판의 문자열을, 없으면 영어를 반환.
    window.SAUDADE_T = function(strings) {
        if (!strings || typeof strings !== 'object') return '';
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return strings[ed] || strings.en || Object.values(strings)[0] || '';
    };
// IIFE 끝 — 파일이 로드되면 위 전체가 자동 실행된다.
})();
