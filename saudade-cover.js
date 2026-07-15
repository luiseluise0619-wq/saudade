// SAUDADE · § 00 ISSUE COVER — 신규 화면 (헌법 §4-1)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
// 페이지 로드 시 메인 영역에 잡지 표지처럼 도시명 + lede + nav 렌더.
// CSS pseudo-element 만으로는 다중 라인 매거진 표지 한계 → 신규 컴포넌트로 별도 마운트.
'use strict';

(function() {
    if (window.SAUDADE_COVER) return;

    // 도시별 카피라인 (v1 한정 큐레이션 — 헌법 §4-1: AI 자동 생성 X, 손으로 짠 시드)
    // "City of X" 패턴 — 도시 + 명사 1개. 형용사·동사 금지.
    const COVER_COPY = {
        'Lisbon':       { noun: 'Tile.',     ko: '타일의 도시.' },
        'Porto':        { noun: 'Granite.',  ko: '화강암의 도시.' },
        'Seoul':        { noun: 'Granite.',  ko: '화강암의 도시.' },
        'Busan':        { noun: 'Tide.',     ko: '조수의 도시.' },
        'Tokyo':        { noun: 'Steam.',    ko: '증기의 도시.' },
        'Osaka':        { noun: 'Steel.',    ko: '강철의 도시.' },
        'Kyoto':        { noun: 'Cedar.',    ko: '삼나무의 도시.' },
        'Bangkok':      { noun: 'Smoke.',    ko: '연기의 도시.' },
        'Chiang Mai':   { noun: 'Smoke.',    ko: '연기의 도시.' },
        'Bali':         { noun: 'Rice.',     ko: '벼의 도시.' },
        'Mexico City':  { noun: 'Stone.',    ko: '돌의 도시.' },
        'Berlin':       { noun: 'Concrete.', ko: '콘크리트의 도시.' },
        'Barcelona':    { noun: 'Brick.',    ko: '벽돌의 도시.' },
        'Madrid':       { noun: 'Tile.',     ko: '타일의 도시.' },
        'Amsterdam':    { noun: 'Glass.',    ko: '유리의 도시.' },
        'London':       { noun: 'Iron.',     ko: '철의 도시.' },
        'Paris':        { noun: 'Limestone.', ko: '석회석의 도시.' },
        'Singapore':    { noun: 'Glass.',    ko: '유리의 도시.' },
        'Hong Kong':    { noun: 'Light.',    ko: '빛의 도시.' },
        'Taipei':       { noun: 'Tea.',      ko: '차의 도시.' },
        'Ho Chi Minh':  { noun: 'Smoke.',    ko: '연기의 도시.' },
        'Hanoi':        { noun: 'Lacquer.',  ko: '옻칠의 도시.' },
        'New York':     { noun: 'Steel.',    ko: '강철의 도시.' },
        'San Francisco':{ noun: 'Fog.',      ko: '안개의 도시.' },
        'Los Angeles':  { noun: 'Sun.',      ko: '햇빛의 도시.' },
        'Toronto':      { noun: 'Snow.',     ko: '눈의 도시.' },
        'Buenos Aires': { noun: 'Mate.',     ko: '마테차의 도시.' },
        'Medellín':     { noun: 'Spring.',   ko: '봄의 도시.' },
        'Cape Town':    { noun: 'Wind.',     ko: '바람의 도시.' },
        'Tbilisi':      { noun: 'Sulfur.',   ko: '유황의 도시.' },
        'Tallinn':      { noun: 'Pine.',     ko: '소나무의 도시.' },
        'Belgrade':     { noun: 'Brick.',    ko: '벽돌의 도시.' },
        'Sofia':        { noun: 'Stone.',    ko: '돌의 도시.' },
        'Athens':       { noun: 'Marble.',   ko: '대리석의 도시.' },
        'Prague':       { noun: 'Spires.',   ko: '첨탑의 도시.' },
        'Budapest':     { noun: 'Steam.',    ko: '증기의 도시.' },
        'Vienna':       { noun: 'Coffee.',   ko: '커피의 도시.' },
        'Istanbul':     { noun: 'Bridges.',  ko: '다리의 도시.' },
        'Marrakech':    { noun: 'Clay.',     ko: '점토의 도시.' },
        'Da Nang':      { noun: 'Sand.',     ko: '모래의 도시.' },
        'Tulum':        { noun: 'Coral.',    ko: '산호의 도시.' },
        'Lima':         { noun: 'Mist.',     ko: '안개의 도시.' },
        'Rio de Janeiro':{ noun: 'Granite.', ko: '화강암의 도시.' },
        'Dubai':        { noun: 'Glass.',    ko: '유리의 도시.' }
    };

    // Per-edition default editor city. KO opens in Seoul, JA in Tokyo, etc.
    // Used only when the reader has no explicit pick (no Switch-the-Desk +
    // no GeoIP). The English city name is the canonical key — cityIn(city, ed)
    // translates to the localised form before render.
    const EDITION_DEFAULT_CITY = {
        en: 'Lisbon', ko: 'Seoul', ja: 'Tokyo', pt: 'Lisbon', es: 'Madrid'
    };

    function detectCity() {
        // v6 §5 — 사용자 명시 home city + Switch the Desk 활성 시 임시 city
        // saudade-city.js 의 activeDeskCity() 가 우선 (사용자가 desk 에서 골랐을 것)
        try {
            const c = window.SAUDADE_CITY?.activeDeskCity?.();
            if (c) return c;
        } catch (e) {}
        // legacy fallback — GeoIP / location-alerts
        try {
            const la = JSON.parse(localStorage.getItem('aura_loc_alerts_v1') || '{}');
            if (la.city && COVER_COPY[la.city]) return la.city;
        } catch (e) {}
        try {
            const geo = JSON.parse(localStorage.getItem('aura_geoip_v1') || '{}');
            if (geo.city && COVER_COPY[geo.city]) return geo.city;
        } catch (e) {}
        // Edition-default — KO 가 리스본을 첫 화면으로 보면 안 된다.
        const ed = (window.SAUDADE_EDITION?.get?.()) ||
                   (window.state && window.state.lang) || 'en';
        return EDITION_DEFAULT_CITY[ed] || 'Lisbon';
    }

    function isKo() {
        return (window.state && window.state.lang === 'ko');
    }
    function currentEdition() {
        return (window.SAUDADE_EDITION?.get?.()) ||
               (window.state && window.state.lang) ||
               'en';
    }

    // v615 — 5 별쇄 카피 (ofLine / lede / eyebrow). 헌법 §2: 자국어로 조판.
    const COPY_5 = {
        en: {
            of: 'City of',
            sep: ',',
            ledeWithDays: (n) => `A quiet companion for the <strong>${n}</strong> days you have left here.`,
            ledeNoData:   'A quiet companion for what cannot return.',
            tax: 'TAX RESIDENCY',
            wires: "FROM TODAY'S WIRES"
        },
        ko: {
            of: '도시,',
            sep: '',
            ledeWithDays: (n) => `이곳에 남은 <strong>${n}</strong> 일을 위한 조용한 동반자.`,
            ledeNoData:   '돌아갈 수 없는 것을 위한 조용한 동반자.',
            tax: '세금 거주일',
            wires: '오늘 들어온 통신'
        },
        ja: {
            of: 'の街、',
            sep: '',
            ledeWithDays: (n) => `この街に残された <strong>${n}</strong> 日のための静かな道連れ。`,
            ledeNoData:   '帰れぬものへの静かな道連れ。',
            tax: '税務上の居住',
            wires: '本日の通信から'
        },
        pt: {
            of: 'Cidade de',
            sep: ',',
            ledeWithDays: (n) => `Um companheiro silencioso para os <strong>${n}</strong> dias que aqui restam.`,
            ledeNoData:   'Um companheiro silencioso para o que não pode voltar.',
            tax: 'RESIDÊNCIA FISCAL',
            wires: 'DOS DESPACHOS DE HOJE'
        },
        es: {
            of: 'Ciudad de',
            sep: ',',
            ledeWithDays: (n) => `Un compañero silencioso para los <strong>${n}</strong> días que te quedan aquí.`,
            ledeNoData:   'Un compañero silencioso para lo que no puede volver.',
            tax: 'RESIDENCIA FISCAL',
            wires: 'DESDE LOS DESPACHOS DE HOY'
        }
    };

    // 도시명 자체도 자국어로 (cover-titles.json 의 per-edition city / noun 가 우선)
    function cityIn(city, ed) {
        const entry = COVER_COPY[city];
        if (!entry) return city;
        // 신구 schema 동시 호환:
        // 신: { en: { city, noun }, ko: { city, noun }, ... }
        // 구: { noun, ko }
        if (entry[ed] && typeof entry[ed] === 'object') return entry[ed].city || city;
        return city;
    }
    function nounIn(city, ed) {
        const entry = COVER_COPY[city];
        if (!entry) return 'Saudade.';
        if (entry[ed] && typeof entry[ed] === 'object' && entry[ed].noun) return entry[ed].noun;
        // legacy fallback
        if (ed === 'ko' && entry.ko) return entry.ko;
        return entry.noun || 'Saudade.';
    }

    // 비자 D-day (있으면) — saudade.visa.entries 우선, fallback aura_visa_v1
    function visaDaysLeft() {
        try {
            const sdd = JSON.parse(localStorage.getItem('saudade.visa.entries') || '[]');
            if (Array.isArray(sdd) && sdd.length) {
                const today = Date.now();
                const active = sdd
                    .map(e => ({ ...e, _ms: new Date(e.expiry).getTime() }))
                    .filter(e => Number.isFinite(e._ms) && e._ms > today)
                    .sort((a, b) => a._ms - b._ms)[0];
                if (active) {
                    const days = Math.ceil((active._ms - today) / 86400000);
                    return Number.isFinite(days) && days > 0 ? days : null;
                }
            }
        } catch (e) {}
        try {
            const raw = localStorage.getItem('aura_visa_v1');
            if (!raw) return null;
            const v = JSON.parse(raw);
            if (!v || !v.expiry) return null;
            const ms = new Date(v.expiry).getTime() - Date.now();
            const days = Math.ceil(ms / 86400000);
            return Number.isFinite(days) && days > 0 ? days : null;
        } catch (e) { return null; }
    }

    // v607 — 세금 거주일 (saudade.visa.entries 의 ISO 별 days_in_year)
    function topTaxResidency() {
        try {
            const sdd = JSON.parse(localStorage.getItem('saudade.visa.entries') || '[]');
            if (!Array.isArray(sdd) || !sdd.length) return null;
            const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
            const result = {};
            sdd.forEach(e => {
                if (!e.entered || !e.iso) return;
                const enteredMs = new Date(e.entered).getTime();
                const expiryMs = e.expiry ? new Date(e.expiry).getTime() : Date.now();
                const start = Math.max(enteredMs, yearStart);
                const end = Math.min(expiryMs, Date.now());
                if (end > start) {
                    const days = Math.floor((end - start) / 86400000);
                    result[e.iso] = (result[e.iso] || 0) + days;
                }
            });
            const top = Object.entries(result).sort((a, b) => b[1] - a[1])[0];
            return top ? { iso: top[0], days: top[1] } : null;
        } catch (e) { return null; }
    }

    function injectStyles() {
        if (document.getElementById('saudadeCoverStyles')) return;
        const s = document.createElement('style');
        s.id = 'saudadeCoverStyles';
        s.textContent = `
/* v6 §12 — 신문 마스트헤드 톤 */
.sdd-cover {
    position: fixed;
    inset: 0;
    z-index: 4;
    /* v729 — was 'pointer-events: none' with selected children opting back
       in via 'pointer-events: auto'. Side effect: empty cover regions
       returned pointer-events:none to elementFromPoint, so wheel events
       in those regions passed straight through cover into body
       (body.overflow:hidden), and the cover stopped scrolling after a few
       ticks (stuck at scrollTop ≈ 600/1007 — readers reported the page
       "freezes when you scroll down").
       Cover needs to receive its own wheel so its overflow-y:auto works. */
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    padding: clamp(72px, 11vh, 120px) clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    color: var(--ink);
    background: transparent;
    overflow-y: auto;
}
body.cafe-mode .sdd-cover { display: none !important; }
body.section-active .sdd-cover { display: none !important; }

/* v644 — Archive entry under the cover nav. Mono uppercase row that
   sends curious readers to /issues/, where every past issue carries a
   DOWNLOAD PDF button at the top. */
.sdd-cover-archive {
    margin: clamp(28px, 4vw, 48px) 0 0;
    text-align: center;
}
.sdd-cover-archive-link {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--rust);
    text-decoration: none;
    border-bottom: 0.5px solid var(--rust);
    padding-bottom: 4px;
    transition: color .15s, border-color .15s, padding .15s;
}
.sdd-cover-archive-link:hover { color: var(--ink); border-bottom-color: var(--ink); padding-left: 4px; }

/* Edition switcher row at the top of the cover. Discreet mono row
   above the masthead; click any other code to switch. The current
   edition is jade-tinted; others fade. SAUDADE_EDITION.set handles
   the loading flash + reload chain. */
.sdd-cover-editions {
    display: flex;
    justify-content: center;
    gap: clamp(12px, 2vw, 20px);
    margin: 0 0 clamp(20px, 3vw, 32px);
    padding-bottom: clamp(8px, 1vw, 12px);
    border-bottom: 0.5px solid var(--rule, rgba(11,11,15,.12));
    flex-wrap: wrap;
}
.sdd-cover-ed-opt {
    background: transparent;
    border: 0;
    padding: 8px 4px;
    min-height: 44px;
    min-width: 44px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.28em;
    color: var(--bone-d);
    cursor: pointer;
    transition: color .12s, border-color .12s;
    border-bottom: 1.5px solid transparent;
}
.sdd-cover-ed-opt:hover,
.sdd-cover-ed-opt:focus-visible {
    color: var(--ink);
    outline: none;
}
.sdd-cover-ed-opt[aria-current="true"] {
    color: var(--ink);
    border-bottom-color: var(--rust, #9A3324);
}

/* Theme color picker — round button top-right of the cover that pops
   a panel of skin swatches. Each swatch shows the skin's actual
   primary color; the labels sit on a paper-tone strip so contrast
   stays readable on any background. */
.sdd-cover-theme {
    position: absolute;
    top: clamp(12px, 2vw, 20px);
    right: clamp(12px, 2vw, 20px);
    z-index: 5;
    pointer-events: auto;   /* parent .sdd-cover sets pointer-events: none */
}
.sdd-cover-theme-toggle {
    width: 40px; height: 40px;
    min-width: 44px; min-height: 44px;     /* mobile touch */
    border-radius: 50%;
    border: 1px solid var(--ink, #16151A);
    background: var(--paper, #F2EEE3);
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform .12s;
}
.sdd-cover-theme-toggle:hover { transform: scale(1.08); }
.sdd-cover-theme-toggle:focus-visible {
    outline: 2px solid var(--rust, #9A3324);
    outline-offset: 2px;
}
/* Inner mark — conic gradient through the three skins so the button
   itself previews what's behind the popover. */
.sdd-cover-theme-toggle-mark {
    display: block;
    width: 22px; height: 22px;
    border-radius: 50%;
    background:
        conic-gradient(
            #F2EEE3 0 33%,
            var(--accent, #B8442D) 33% 66%,
            #15130E 66% 100%
        );
    border: 0.5px solid var(--ink, #16151A);
}
.sdd-cover-theme-pop {
    position: absolute;
    top: 52px; right: 0;
    background: #F2EEE3;       /* always paper so labels read clean */
    color: #16151A;
    border: 0.5px solid #16151A;
    box-shadow: 0 8px 24px rgba(0,0,0,.08);
    padding: 8px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    min-width: 180px;
}
.sdd-cover-theme-pop[hidden] { display: none; }
.sdd-cover-theme-opt {
    background: transparent;
    border: 0;
    padding: 8px 12px;
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 12px;
    align-items: center;
    min-height: 44px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.28em;
    color: #16151A;             /* labels: ink on paper, always readable */
    cursor: pointer;
    text-align: left;
    transition: background .12s;
    border-radius: 2px;
}
.sdd-cover-theme-opt:hover,
.sdd-cover-theme-opt:focus-visible {
    background: rgba(22,21,26,.06);
    outline: none;
}
.sdd-cover-theme-opt[aria-current="true"] {
    background: rgba(22,21,26,.10);
}
.sdd-cover-theme-opt[aria-current="true"] .label::before {
    content: '· ';
    color: var(--rust, #9A3324);
}
.sdd-cover-theme-opt .swatch {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 0.5px solid #16151A;
}
.sdd-cover-theme-opt .swatch.swatch-auto {
    background:
        linear-gradient(135deg,
            #F2EEE3 0%, #F2EEE3 49%,
            #15130E 51%, #15130E 100%);
}
.sdd-cover-theme-opt .swatch.swatch-paper     { background: #F2EEE3; }
.sdd-cover-theme-opt .swatch.swatch-saturated { background: var(--accent, #B8442D); }
.sdd-cover-theme-opt .swatch.swatch-dark      { background: #15130E; }

/* 마스트헤드 — 신문 NYT/Guardian 식 */
.sdd-cover-mast {
    text-align: center;
    margin: 0 0 clamp(32px, 5vw, 64px);
    pointer-events: none;
}
.sdd-cover-wordmark {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(48px, 8vw, 96px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-cover);
    color: var(--ink);
    margin: 0 0 clamp(8px, 1.2vw, 14px);
    text-transform: lowercase;
}
.sdd-cover-mast-rule {
    height: 0;
    border-top: 0.5px solid var(--rule-2);
    margin: clamp(8px, 1.2vw, 14px) auto;
    width: clamp(120px, 20vw, 240px);
}
.sdd-cover-mast-date {
    font-family: var(--mono);
    font-weight: 500;
    font-size: clamp(11px, 1.1vw, 13px);
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
    margin: 0;
}

/* 분기 ISSUE 정보 */
.sdd-cover-issue {
    margin: 0 0 clamp(28px, 4vw, 48px);
    text-align: center;
    pointer-events: none;
}
.sdd-cover-issue-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(8px, 1.2vw, 14px);
}
.sdd-cover-issue-lede {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(16px, 1.8vw, 22px);
    line-height: 1.4;
    color: var(--ink);
    margin: 0;
    max-width: 540px;
    margin-left: auto;
    margin-right: auto;
}

/* TODAY 요약 — 신문 frontpage 의 'INSIDE TODAY' */
.sdd-cover-today {
    margin: 0 auto clamp(28px, 4vw, 48px);
    max-width: 480px;
    width: 100%;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(16px, 2vw, 24px) 0;
    pointer-events: none;
}
.sdd-cover-today-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(10px, 1.4vw, 16px);
    text-align: center;
}
.sdd-cover-today-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 0.8vw, 10px);
}
.sdd-cover-today-item {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 12px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
}

.sdd-cover-tax {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(16px, 2vw, 24px);
    pointer-events: none;
}

/* v609 cover dispatch teaser — 오늘 wires 의 top 1 */
.sdd-cover-dispatch {
    display: flex; flex-direction: column; gap: 4px;
    margin: 0 0 clamp(24px, 4vw, 56px);
    max-width: 480px;
    pointer-events: none;
    border-left: 0.5px solid var(--rule-2, var(--rule));
    padding-left: 14px;
}
.sdd-cover-dispatch-mark {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--accent, var(--rust));
}
.sdd-cover-dispatch-line {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.5vw, 18px);
    line-height: 1.45;
    color: var(--ink);
}
.sdd-cover-dispatch-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-top: 2px;
}

.sdd-cover-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(16px, 3vw, 40px);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--bone-d);
    pointer-events: auto;
    margin: 0 auto;
    max-width: 600px;
}
.sdd-cover-nav a {
    color: var(--bone-d);
    text-decoration: none;
    border-bottom: 0.5px solid transparent;
    padding-bottom: 2px;
    transition: color .15s, border-color .15s;
}
.sdd-cover-nav a:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-cover-nav a .sdd-mark { color: var(--bone-d); margin-right: 4px; font-weight: 400; }

@media (max-width: 768px) {
    .sdd-cover { justify-content: center; padding: 0 24px; }
    .sdd-cover-nav { gap: 14px; font-size: 10px; }
    .sdd-cover-nav a { padding: 4px 0; }
}
`;
        document.head.appendChild(s);
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    // v609 — 오늘 dispatch 의 top 1 헤드라인을 표지에 1회 fetch
    function loadTodayDispatch() {
        if (window._sddTodayDispatchLoaded) return Promise.resolve();
        window._sddTodayDispatchLoaded = true;
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const url = ed === 'en' ? './data/dispatches.json' : `./data/dispatches.${ed}.json`;
        return fetch(url, { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (!d || !d.cities || !d.cities.length) return;
                const firstCity = d.cities[0];
                const firstItem = firstCity.items && firstCity.items[0];
                if (firstItem) {
                    window._sddTodayDispatch = {
                        headline: firstItem.headline,
                        city: firstCity.city,
                        source: firstItem.source
                    };
                }
            })
            .catch(() => {});
    }

    // v6 §12 — 신문 마스트헤드 (FRIDAY · 02 MAY 2026 · LISBON DESK)
    const WEEKDAY_NAMES = {
        en: ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'],
        ko: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
        ja: ['日曜','月曜','火曜','水曜','木曜','金曜','土曜'],
        pt: ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'],
        es: ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO']
    };
    const MONTH_NAMES = {
        en: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],
        ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
        ja: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
        pt: ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'],
        es: ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
    };
    const DESK_SUFFIX = { en: 'DESK', ko: '책상', ja: 'デスク', pt: 'MESA', es: 'MESA' };
    const QUARTER_LABEL = {
        en: 'THIS ISSUE', ko: '이번 호', ja: '本号', pt: 'ESTA EDIÇÃO', es: 'ESTA EDICIÓN'
    };
    const TODAY_LABEL = {
        en: 'TODAY', ko: '오늘', ja: '本日', pt: 'HOJE', es: 'HOY'
    };
    // Cover nav — Section labels per edition. Each magazine should read
    // in its own language; English placeholders on non-EN editions were
    // a real i18n bug, not a design choice.
    const NAV_LABEL_LEDGER = {
        en: 'LEDGER',     ko: '장부',  ja: '帳簿',  pt: 'LIVRO-RAZÃO',  es: 'LIBRO MAYOR'
    };
    const NAV_LABEL_ATLAS = {
        en: 'ATLAS',      ko: '지도',  ja: '地図',  pt: 'ATLAS',        es: 'ATLAS'
    };
    const NAV_LABEL_DISPATCHES = {
        en: 'DISPATCHES', ko: '통신',  ja: '通信',  pt: 'DESPACHOS',    es: 'DESPACHOS'
    };
    const NAV_LABEL_DESK = {
        en: 'THE DESK',   ko: '데스크', ja: 'デスク', pt: 'A MESA',      es: 'LA MESA'
    };
    const ISSUE_LEDE_5 = {
        en: 'Three cities, no schedule. Edited from $editorCity.',
        ko: '세 도시, 일정 없음. $editorCity에서 편집.',
        ja: '三つの街、日程なし。$editorCityで編集。',
        pt: 'Três cidades, sem agenda. Editada a partir de $editorCity.',
        es: 'Tres ciudades, sin agenda. Editada desde $editorCity.'
    };

    function formatMastDate(ed) {
        const d = new Date();
        const wd = WEEKDAY_NAMES[ed] || WEEKDAY_NAMES.en;
        const mo = MONTH_NAMES[ed] || MONTH_NAMES.en;
        const dayName = wd[d.getDay()];
        const day = String(d.getDate()).padStart(2, '0');
        const month = mo[d.getMonth()];
        const year = d.getFullYear();
        if (ed === 'ja') return `${year}年${d.getMonth() + 1}月${d.getDate()}日（${wd[d.getDay()].replace('曜','')}）`;
        if (ed === 'ko') return `${year}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${dayName}`;
        return `${dayName} · ${day} ${month} ${year}`;
    }

    function quarterRange(ed) {
        // v7 §10.6 — 분기 발행일 3/6/9/12월 1일.
        // 3개월 범위: Mar–May / Jun–Aug / Sep–Nov / Dec–Feb.
        const d = new Date();
        const m = d.getMonth();          // 0-11
        const y = d.getFullYear();
        // 가장 최근 발행월 찾기 (Mar=2, Jun=5, Sep=8, Dec=11)
        const PUB_MONTHS = [2, 5, 8, 11];
        let startMonth = -1;
        for (const pm of PUB_MONTHS) { if (pm <= m) startMonth = pm; }
        let startYear = y;
        if (startMonth === -1) { startMonth = 11; startYear = y - 1; }   // Jan/Feb → 지난해 Dec
        const endMonth = (startMonth + 2) % 12;
        const endYear = endMonth < startMonth ? startYear + 1 : startYear;
        const mo = MONTH_NAMES[ed] || MONTH_NAMES.en;
        if (startYear === endYear) return `${mo[startMonth]}–${mo[endMonth]} ${endYear}`;
        return `${mo[startMonth]} ${startYear}–${mo[endMonth]} ${endYear}`;
    }

    // TODAY 요약 4줄 — 실제 데이터 조회
    function todaySummary(ed) {
        // Ledger OPEN / CLOSED
        let openN = 0, closedN = 0;
        try {
            const v = JSON.parse(localStorage.getItem('saudade.visa.entries') || '[]');
            const today = Date.now();
            v.forEach(e => {
                const ms = new Date(e.expiry).getTime();
                if (Number.isFinite(ms)) {
                    if (ms > today) openN++; else closedN++;
                }
            });
        } catch (e) {}

        // Atlas — 이번 주 visited
        let atlasNew = 0;
        try {
            const visited = JSON.parse(localStorage.getItem('saudade.atlas.visited') || '{}');
            const weekAgo = Date.now() - 7 * 86400000;
            atlasNew = Object.values(visited).filter(ts => ts > weekAgo).length;
        } catch (e) {}

        // Listening — Track N of 9
        let listenIdx = null, listenTotal = null;
        try {
            const pos = JSON.parse(localStorage.getItem('saudade.reading.position') || '{}');
            if (Number.isFinite(pos.idx)) listenIdx = pos.idx + 1;
            // total = 분기 9곡 (or 4 if data/listening.json 시드 그대로)
            listenTotal = 9;
        } catch (e) {}

        const labels = {
            en: { l: 'Ledger', d: 'Dispatches', a: 'Atlas', li: 'Listening',
                  open: 'OPEN', closed: 'CLOSED', new3: '3 new', cafe: 'this week', track: 'Track' },
            ko: { l: '레저', d: '디스패치', a: '아틀라스', li: '리스닝룸',
                  open: 'OPEN', closed: 'CLOSED', new3: '신규 3편', cafe: '이번 주', track: '트랙' },
            ja: { l: '台帳', d: '通信', a: '地図', li: 'リスニング',
                  open: 'OPEN', closed: 'CLOSED', new3: '新3本', cafe: '今週', track: 'トラック' },
            pt: { l: 'Livro', d: 'Despachos', a: 'Atlas', li: 'Sala',
                  open: 'ABERTO', closed: 'FECHADO', new3: '3 novos', cafe: 'esta semana', track: 'Faixa' },
            es: { l: 'Libro', d: 'Despachos', a: 'Atlas', li: 'Sala',
                  open: 'ABIERTO', closed: 'CERRADO', new3: '3 nuevos', cafe: 'esta semana', track: 'Pista' }
        };
        const L = labels[ed] || labels.en;

        const lines = [];
        lines.push(`${L.l}: ${openN} ${L.open}, ${closedN} ${L.closed}`);
        lines.push(`${L.d}: ${L.new3}`);
        if (atlasNew > 0) lines.push(`${L.a}: ${atlasNew} ${ed === 'en' ? 'cafés' : 'cafés'} ${L.cafe}`);
        if (listenIdx) lines.push(`${L.li}: ${L.track} ${listenIdx} / ${listenTotal}`);
        return lines;
    }

    function render() {
        const city = detectCity();
        const ed = currentEdition();
        const c = COPY_5[ed] || COPY_5.en;

        let cover = document.getElementById('sddCover');
        if (!cover) {
            cover = document.createElement('div');
            cover.id = 'sddCover';
            cover.className = 'sdd-cover';
            document.body.appendChild(cover);
        }

        const cityName = cityIn(city, ed);
        const mastDate = formatMastDate(ed);
        const deskLine = `${cityName.toUpperCase()} ${DESK_SUFFIX[ed] || 'DESK'}`;
        const quarter = quarterRange(ed);
        const issueLede = (ISSUE_LEDE_5[ed] || ISSUE_LEDE_5.en).replace('$editorCity', cityName);

        const todayLines = todaySummary(ed);
        const todayHtml = todayLines.map(l =>
            `<li class="sdd-cover-today-item">→ ${escapeHtml(l)}</li>`
        ).join('');

        const supported = (window.SAUDADE_EDITION?.SUPPORTED) || ['en','ko','ja','pt','es'];
        const editionsHtml = supported.map(code => `
            <button type="button"
                    class="sdd-cover-ed-opt"
                    data-edition="${code}"
                    aria-current="${code === ed ? 'true' : 'false'}"
                    aria-label="Switch to ${code.toUpperCase()} edition">${code.toUpperCase()}</button>`).join('');

        const currentSkinPref = (window.SAUDADE_EDITION?.skinPref?.()) || 'auto';
        const SKIN_LABEL = { auto: 'AUTO', paper: 'PAPER', saturated: 'SATURATED', dark: 'DARK' };
        const SKIN_ORDER = ['auto', 'paper', 'saturated', 'dark'];
        const themeOptsHtml = SKIN_ORDER.map(k => `
            <button type="button"
                    class="sdd-cover-theme-opt"
                    data-skin="${k}"
                    aria-current="${k === currentSkinPref ? 'true' : 'false'}"
                    aria-label="Theme: ${SKIN_LABEL[k]}">
                <span class="swatch swatch-${k}" aria-hidden="true"></span>
                <span class="label">${SKIN_LABEL[k]}</span>
            </button>`).join('');

        cover.innerHTML = `
            <nav class="sdd-cover-editions" aria-label="Edition">
                ${editionsHtml}
            </nav>

            <div class="sdd-cover-theme">
                <button type="button"
                        class="sdd-cover-theme-toggle"
                        data-sdd-theme-toggle
                        aria-label="Theme color"
                        aria-expanded="false">
                    <span class="sdd-cover-theme-toggle-mark" aria-hidden="true"></span>
                </button>
                <div class="sdd-cover-theme-pop" data-sdd-theme-pop role="menu" hidden>
                    ${themeOptsHtml}
                </div>
            </div>

            <header class="sdd-cover-mast">
                <h1 class="sdd-cover-wordmark">SAUDADE</h1>
                <div class="sdd-cover-mast-rule"></div>
                <p class="sdd-cover-mast-date">${escapeHtml(mastDate)} · ${escapeHtml(deskLine)}</p>
            </header>

            <section class="sdd-cover-issue">
                <p class="sdd-cover-issue-eyebrow">${escapeHtml(QUARTER_LABEL[ed] || 'THIS ISSUE')} · ${escapeHtml(quarter)}</p>
                <p class="sdd-cover-issue-lede">${escapeHtml(issueLede)}</p>
            </section>

            <!-- v641 — personal block. Empathy layer that turns the user's
                 four-calculator data into italic sentences in the saudade
                 voice ("184 days since you last sat in a Seoul café"). When
                 there is no data, the block becomes the empty-state empathy
                 hook with shortcuts to set home cities or load demo data. -->
            <div id="sddCoverPersonal"></div>

            <section class="sdd-cover-today">
                <p class="sdd-cover-today-eyebrow">${escapeHtml(TODAY_LABEL[ed] || 'TODAY')}</p>
                <ul class="sdd-cover-today-list">${todayHtml}</ul>
            </section>

            <nav class="sdd-cover-nav">
                <a href="#section-01" data-sdd-jump="visa"><span class="sdd-mark">§ 01</span>${escapeHtml(NAV_LABEL_LEDGER[ed] || NAV_LABEL_LEDGER.en)}</a>
                <a href="#section-02" data-sdd-jump="cafe"><span class="sdd-mark">§ 02</span>${escapeHtml(NAV_LABEL_ATLAS[ed] || NAV_LABEL_ATLAS.en)}</a>
                <a href="#section-03" data-sdd-jump="tz"><span class="sdd-mark">§ 03</span>${escapeHtml(NAV_LABEL_DISPATCHES[ed] || NAV_LABEL_DISPATCHES.en)}</a>
                <a href="#section-04" data-sdd-jump="trip"><span class="sdd-mark">§ 04</span>${escapeHtml(NAV_LABEL_DESK[ed] || NAV_LABEL_DESK.en)}</a>
            </nav>

            <!-- v644 — direct path to the issue archive + per-issue PDF download.
                 Earlier the only entry was via the footer rule, which is too quiet. -->
            <p class="sdd-cover-archive">
                <a href="/issues/" class="sdd-cover-archive-link">
                    READ THE WEEK · DOWNLOAD AS PDF →
                </a>
            </p>
        `;

        // nav 클릭 시 기존 dock 버튼으로 위임
        cover.querySelectorAll('[data-sdd-jump]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const cat = a.getAttribute('data-sdd-jump');
                const btn = document.querySelector(`.dock-btn[data-cat="${cat}"]`);
                if (btn) {
                    btn.click();
                    document.body.classList.add('section-active');
                }
            });
        });

        // Edition switch from the cover. Delegates to SAUDADE_EDITION.set —
        // which handles the loading flash, persisting the choice, and
        // reloading every section module against the new edition.
        cover.querySelectorAll('.sdd-cover-ed-opt[data-edition]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-edition');
                if (code && window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
            });
        });

        // Theme switcher — round button reveals a popover of skin swatches.
        // SAUDADE_EDITION.setSkin handles persistence + applies the new
        // <html data-skin="…"> attribute. Labels live on a paper-tone strip
        // so contrast stays readable regardless of which swatch is shown.
        const themeToggle = cover.querySelector('[data-sdd-theme-toggle]');
        const themePop    = cover.querySelector('[data-sdd-theme-pop]');
        if (themeToggle && themePop) {
            const closePop = () => {
                themePop.hidden = true;
                themeToggle.setAttribute('aria-expanded', 'false');
            };
            themeToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = themePop.hidden;
                themePop.hidden = !open;
                themeToggle.setAttribute('aria-expanded', String(open));
            });
            themePop.querySelectorAll('[data-skin]').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const k = opt.getAttribute('data-skin');
                    if (k && window.SAUDADE_EDITION?.setSkin) {
                        window.SAUDADE_EDITION.setSkin(k);
                        // refresh aria-current within the open popover
                        themePop.querySelectorAll('[data-skin]').forEach(o => {
                            o.setAttribute('aria-current', o === opt ? 'true' : 'false');
                        });
                    }
                    closePop();
                });
            });
            // Click outside closes the popover.
            document.addEventListener('click', (e) => {
                if (!themePop.hidden && !themePop.contains(e.target) && e.target !== themeToggle) {
                    closePop();
                }
            });
            // Escape closes.
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closePop();
            });
        }

        // v641 — paint the personal block. SAUDADE_PERSONAL falls back to
        // the empty-state empathy hook when there is no data.
        try {
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
                // stampVisit:true — only the real cover render records the
                // visit date that powers the "N days since you were last
                // here" greeting. Demo/homes re-renders must not stamp.
                window.SAUDADE_PERSONAL.render('#sddCoverPersonal', { stampVisit: true });
            }
        } catch (e) {}

        // v649 — let bootstrap.js know we're rendered so it can fade the
        // loading overlay immediately. Without app.js around, this used to
        // wait for a 12-second backstop.
        try { window.dispatchEvent(new CustomEvent('sdd-cover-rendered')); }
        catch (e) {}
    }

    // dock 버튼이 클릭되면 cover 숨김. 메인 표지로 돌아오는 hook 은 키보드 ESC 또는
    // saudade 워드마크 클릭 (추후 PR — 일단 ESC).
    function watchSection() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.classList.remove('section-active');
            }
        });
    }

    function init() {
        injectStyles();
        // v606 — cover-titles.json 우선 로드 (DRY). 실패하면 inline 시드 사용.
        // v609 — 오늘 dispatch top 1 도 같이 fetch (병렬).
        Promise.all([
            fetch('./data/cover-titles.json', { cache: 'force-cache' })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d && typeof d === 'object') Object.assign(COVER_COPY, d); })
                .catch(() => {}),
            loadTodayDispatch()
        ]).finally(() => {
            render();
            watchSection();
        });

        // 언어 변경 시 재렌더
        window.addEventListener('storage', (e) => {
            if (e.key && /lang|state/i.test(e.key)) render();
        });
        // 1분마다 D-day 갱신 (날짜 변경 대응).
        // v651 — wrap in pausableInterval so it auto-stops when the tab is
        // hidden. Reduces battery drain + phone heat on mobile.
        if (window.SAUDADE_BOOT && window.SAUDADE_BOOT.pausableInterval) {
            window.SAUDADE_BOOT.pausableInterval(render, 60000);
        } else {
            setInterval(render, 60000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_COVER = { render, detectCity, COPY: COVER_COPY };
})();
