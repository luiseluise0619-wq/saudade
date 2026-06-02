/*! saudade · saudade.editorial.js · built 2026-05-05T10:42:17Z · https://saudade.app — concatenated IIFE modules, see /scripts/build-bundle.js */

/* ── saudade-cover.js ──────────────────────────────────────────────────── */
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

    function detectCity(ed) {
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
        // Per-edition notional desk city — matches each edition's audience
        // home and (for EN) the editor's actual location per credits.html
        // "Issue 03 was edited from Seoul". Was unconditional 'Lisbon'.
        const PER_EDITION_DESK = {
            en: 'Seoul', ko: 'Seoul', ja: 'Tokyo', pt: 'Lisbon', es: 'Madrid'
        };
        return PER_EDITION_DESK[ed] || 'Seoul';
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
    pointer-events: none;
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

/* Theme color picker — round button at the top of the cover, popping
   a panel of skin swatches. Sits to the LEFT of the existing EN▼
   edition dropdown (saudade-skin.css: .sdd-cover-edition is fixed
   top: 16-24px / right: 16-24px) so the two don't overlap. Labels
   match the existing legal-strip theme switch (saudade-theme-switch.js):
   AUTO / PAPER / COVER / NIGHT — same skins, brand-consistent names. */
.sdd-cover-theme {
    position: fixed;
    top: clamp(16px, 2vw, 24px);
    /* leave room for EN▼ (~40px) + 12px gap to the right */
    right: calc(clamp(16px, 2vw, 24px) + 40px + 12px);
    z-index: var(--z-cover, 4);
    pointer-events: auto;
}
body.section-active .sdd-cover-theme,
body.cafe-mode .sdd-cover-theme,
body.listening-active .sdd-cover-theme { display: none !important; }
.sdd-cover-theme-toggle {
    width: 44px; height: 44px;
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
.sdd-cover-theme-toggle-mark {
    display: block;
    width: 24px; height: 24px;
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
    background: #F2EEE3;
    color: #16151A;
    border: 0.5px solid #16151A;
    box-shadow: 0 8px 24px rgba(0,0,0,.12);
    padding: 8px;
    display: grid;
    gap: 4px;
    min-width: 188px;
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
    color: #16151A;
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
.sdd-cover-theme-opt[aria-current="true"] { background: rgba(22,21,26,.10); }
.sdd-cover-theme-opt[aria-current="true"] .label::before {
    content: '· '; color: var(--rust, #9A3324);
}
.sdd-cover-theme-opt .swatch {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 0.5px solid #16151A;
}
.sdd-cover-theme-opt .swatch.swatch-auto {
    background: linear-gradient(135deg, #F2EEE3 0 49%, #15130E 51% 100%);
}
.sdd-cover-theme-opt .swatch.swatch-paper     { background: #F2EEE3; }
.sdd-cover-theme-opt .swatch.swatch-saturated { background: var(--accent, #B8442D); }
.sdd-cover-theme-opt .swatch.swatch-dark      { background: #15130E; }

/* Floating LISTENING ROOM CTA used to be a fixed bottom-right button.
   It overlapped the cover Today / nav content. Now that § 05 sits in
   the cover-nav alongside §01-04 (and the dock already exposes
   LISTENING), the floating CTA is redundant. Hide it. */
.sdd-cover-listen-cta { display: none !important; }

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
    /* v8 fine-magazine — double rule beneath the wordmark.
       NYT/Le Monde masthead tradition (two thin parallel lines).
       Was a single 0.5px hairline. */
    height: 5px;
    border-top: 0.5px solid var(--ink);
    border-bottom: 0.5px solid var(--ink);
    background: none;
    margin: clamp(8px, 1.2vw, 14px) auto;
    width: clamp(140px, 22vw, 260px);
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
/* Tagline — small italic serif beneath the date line, NYT-masthead
   tradition. One-line answer to "what is this?" before the hero. */
.sdd-cover-mast-tagline {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13px, 1.3vw, 16px);
    line-height: 1.35;
    color: var(--bone-d);
    margin: clamp(8px, 1vw, 12px) auto 0;
    max-width: 38ch;
    text-wrap: balance;
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

/* Cover hero — today's three dispatch headlines, front-page style.
   Big serif italic, like a newspaper lead. Clicking jumps to §03. */
.sdd-cover-heads {
    margin: 0 auto clamp(28px, 4vw, 48px);
    max-width: 640px;
    width: 100%;
    pointer-events: auto;
}
.sdd-cover-heads-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 clamp(14px, 2vw, 22px);
    padding-bottom: clamp(8px, 1.2vw, 12px);
    border-bottom: 0.5px solid var(--rule);
}
/* Staleness chip appended to the eyebrow when filed_at > 1 day old.
   "1 DAY AGO" stays muted; >2 days flips to rust to make the cron
   pause obvious from the cover. */
.sdd-cover-heads-stale {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--bone-d);
    margin-left: 8px;
}
.sdd-cover-heads-stale.is-warn { color: var(--rust); }
.sdd-cover-heads-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.sdd-cover-head {
    padding: clamp(14px, 2vw, 20px) 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-cover-head:last-child { border-bottom: 0; }
/* Drop cap on the lead story — newspaper convention. ::first-letter
   on the headline gives a 3-line drop, rust-tinted, that announces
   "this is the lead" without an explicit label. Browser support:
   Chrome / Safari / Firefox all support ::first-letter; only Safari +
   recent Chrome support initial-letter for true newspaper sinking.
   Use both — initial-letter if available, font-size + float fallback
   everywhere else. */
.sdd-cover-head.is-lead .headline::first-letter {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 400;
    color: var(--rust);
    -webkit-initial-letter: 2;
    initial-letter: 2;
    /* Fallback for browsers without initial-letter support. */
    font-size: 2.6em;
    line-height: 0.85;
    float: left;
    margin-right: 0.08em;
    margin-top: 0.04em;
    padding-right: 0.04em;
}
@supports (initial-letter: 2) or (-webkit-initial-letter: 2) {
    .sdd-cover-head.is-lead .headline::first-letter {
        font-size: inherit;
        line-height: inherit;
        float: none;
        margin: 0;
        padding: 0;
    }
}
.sdd-cover-head a {
    display: grid;
    grid-template-columns: 1fr;
    row-gap: clamp(6px, 0.8vw, 10px);
    color: inherit;
    text-decoration: none;
    transition: color .12s;
}
.sdd-cover-head a:hover .headline,
.sdd-cover-head a:focus-visible .headline { color: var(--rust); }
.sdd-cover-head .city {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--rust);
}
.sdd-cover-head .headline {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.18;
    color: var(--ink);
    letter-spacing: -0.005em;
    text-wrap: pretty;
}
.sdd-cover-head .lede {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.4vw, 17px);
    line-height: 1.45;
    color: var(--bone-d);
    text-wrap: pretty;
    max-width: 56ch;
}
.sdd-cover-head .source {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--bone-d);
    opacity: 0.7;
    margin-top: 2px;
}
.sdd-cover-head--pending .dots {
    display: inline-block;
    font-family: var(--serif);
    font-style: italic;
    color: var(--bone-d);
    opacity: 0.55;
    font-size: clamp(20px, 2.4vw, 30px);
}
/* Sunday silence + empty-state messages — single-row hero copy when
   there are no headlines to show (KST Sunday per §9.1, or the cron
   hasn't filed yet). Same vertical stack as a real headline so the
   layout doesn't reflow. */
.sdd-cover-head--rest,
.sdd-cover-head--pending-msg {
    display: grid;
    grid-template-columns: 1fr;
    row-gap: clamp(6px, 0.8vw, 10px);
    padding: clamp(20px, 3vw, 28px) 0;
}
.sdd-cover-head--rest .headline,
.sdd-cover-head--pending-msg .headline {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.18;
    color: var(--ink);
    letter-spacing: -0.005em;
    text-wrap: pretty;
}
.sdd-cover-head--rest .lede,
.sdd-cover-head--pending-msg .lede {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.4vw, 17px);
    line-height: 1.45;
    color: var(--bone-d);
}

/* Secondary 'today' counters — demoted now that dispatch headlines own
   the hero. Keep them quietly visible: smaller, ink-soft, single row. */
.sdd-cover-today--secondary {
    border-top: 0.5px dashed var(--rule);
    border-bottom: 0.5px dashed var(--rule);
    padding: clamp(10px, 1.5vw, 16px) 0;
}
.sdd-cover-today--secondary .sdd-cover-today-list {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(12px, 2vw, 24px);
    justify-content: center;
}
.sdd-cover-today--secondary .sdd-cover-today-item {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-cover-today--secondary .sdd-cover-today-item::before { content: ''; }

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
    .sdd-cover { justify-content: flex-start; padding: 88px 24px calc(var(--dock-h, 56px) + 64px); }
    /* On mobile the bottom dock already exposes all 5 sections — the
       cover-nav repeats the same links and just lengthens the scroll.
       Hide it; desktop (where there's no dock) keeps it. */
    .sdd-cover-nav { display: none; }
    /* Issue lede + personal block are quiet on mobile so the dispatch
       hero stays the lead story. */
    .sdd-cover-issue { margin: clamp(16px, 3vw, 24px) 0; }
    .sdd-cover-issue-lede { font-size: 15px; line-height: 1.4; opacity: 0.85; }
    /* Dispatch hero gets a touch more breathing room as the actual lead. */
    .sdd-cover-heads { margin-bottom: clamp(20px, 3vw, 32px); }
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
    const ISSUE_LEDE_5 = {
        en: 'Three cities, filed daily. Edited from $editorCity.',
        ko: '세 도시, 매일 발행. $editorCity에서 편집.',
        ja: '三つの街、毎日発行。$editorCityで編集。',
        pt: 'Três cidades, publicadas diariamente. Editada a partir de $editorCity.',
        es: 'Tres ciudades, publicadas a diario. Editada desde $editorCity.'
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
        const ed = currentEdition();
        const city = detectCity(ed);
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

        const currentSkinPref = (window.SAUDADE_EDITION?.skinPref?.()) || 'auto';
        // Labels mirror saudade-theme-switch.js (the legal-strip switcher).
        // Per-edition translations keep the brand voice consistent.
        const skinLabelEd = (key) => {
            const lookup = {
                auto:      { en: 'AUTO',    ko: '자동',  ja: '自動',     pt: 'AUTO',   es: 'AUTO' },
                paper:     { en: 'PAPER',   ko: '종이',  ja: '紙',       pt: 'PAPEL',  es: 'PAPEL' },
                saturated: { en: 'COVER',   ko: '표지',  ja: '表紙',     pt: 'CAPA',   es: 'TAPA' },
                dark:      { en: 'NIGHT',   ko: '밤',    ja: '夜',       pt: 'NOITE',  es: 'NOCHE' }
            };
            return (lookup[key] && (lookup[key][ed] || lookup[key].en)) || key.toUpperCase();
        };
        const SKIN_ORDER = ['auto', 'paper', 'saturated', 'dark'];
        const themeOptsHtml = SKIN_ORDER.map(k => `
            <button type="button"
                    class="sdd-cover-theme-opt"
                    data-skin="${k}"
                    aria-current="${k === currentSkinPref ? 'true' : 'false'}"
                    aria-label="Theme: ${skinLabelEd(k)}">
                <span class="swatch swatch-${k}" aria-hidden="true"></span>
                <span class="label">${skinLabelEd(k)}</span>
            </button>`).join('');

        cover.innerHTML = `
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
                <!-- Tagline beneath the masthead — NYT-style "All the News
                     That's Fit to Print" position. Answers "what is this?"
                     in one line before the visitor scrolls to the hero. -->
                <p class="sdd-cover-mast-tagline">${escapeHtml(issueLede)}</p>
            </header>

            <!-- v8 cover hero — today's three dispatch headlines, front-page
                 style. Promoted above masthead-issue/personal so the first
                 paint on mobile is the news, not the funding model copy.
                 Filled async from data/dispatches.<ed>.json after cover
                 renders. Falls back to a pending state if fetch fails. -->
            <section class="sdd-cover-heads">
                <p class="sdd-cover-heads-eyebrow">${escapeHtml((TODAY_LABEL[ed] || 'TODAY') + ' · § 03')}</p>
                <ol class="sdd-cover-heads-list" id="sddCoverHeads">
                    <li class="sdd-cover-head sdd-cover-head--pending"><span class="dots">…</span></li>
                    <li class="sdd-cover-head sdd-cover-head--pending"><span class="dots">…</span></li>
                    <li class="sdd-cover-head sdd-cover-head--pending"><span class="dots">…</span></li>
                </ol>
            </section>

            <!-- Issue eyebrow only — the lede was promoted into the
                 masthead as the tagline above. -->
            <section class="sdd-cover-issue">
                <p class="sdd-cover-issue-eyebrow">${escapeHtml(QUARTER_LABEL[ed] || 'THIS ISSUE')} · ${escapeHtml(quarter)}</p>
            </section>

            <!-- v641 — personal block. Empathy layer that turns the user's
                 four-calculator data into italic sentences in the saudade
                 voice ("184 days since you last sat in a Seoul café"). When
                 there is no data, the block becomes the empty-state empathy
                 hook with shortcuts to set home cities or load demo data. -->
            <div id="sddCoverPersonal"></div>

            <!-- Secondary counters (Ledger / Atlas / Listening). Demoted
                 from hero now that dispatch headlines own the cover. -->
            <section class="sdd-cover-today sdd-cover-today--secondary">
                <ul class="sdd-cover-today-list">${todayHtml}</ul>
            </section>

            <nav class="sdd-cover-nav">
                <a href="#section-01" data-sdd-jump="visa"><span class="sdd-mark">§ 01</span>LEDGER</a>
                <a href="#section-02" data-sdd-jump="cafe"><span class="sdd-mark">§ 02</span>ATLAS</a>
                <a href="#section-03" data-sdd-jump="tz"><span class="sdd-mark">§ 03</span>DISPATCHES</a>
                <a href="#section-04" data-sdd-jump="trip"><span class="sdd-mark">§ 04</span>THE DESK</a>
                <a href="#section-05" data-sdd-jump="listening"><span class="sdd-mark">§ 05</span>LISTENING ROOM</a>
            </nav>

            <!-- v644 — direct path to the issue archive + per-issue PDF download.
                 Earlier the only entry was via the footer rule, which is too quiet. -->
            <p class="sdd-cover-archive">
                <a href="/issues/" class="sdd-cover-archive-link">
                    READ THE WEEK · DOWNLOAD AS PDF →
                </a>
            </p>
        `;

        // nav 클릭 시 기존 dock 버튼으로 위임. § 05 LISTENING 은 별도 모듈로 직접 진입.
        cover.querySelectorAll('[data-sdd-jump]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const cat = a.getAttribute('data-sdd-jump');
                if (cat === 'listening') {
                    try { window.SAUDADE_LISTENING?.open?.(); } catch (err) {}
                    return;
                }
                const btn = document.querySelector(`.dock-btn[data-cat="${cat}"]`);
                if (btn) {
                    btn.click();
                    document.body.classList.add('section-active');
                }
            });
        });

        // Theme switcher — round button reveals a popover of skin swatches.
        // Popover background + labels are hard-coded paper/ink so contrast
        // stays readable on any active skin.
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
                        themePop.querySelectorAll('[data-skin]').forEach(o => {
                            o.setAttribute('aria-current', o === opt ? 'true' : 'false');
                        });
                    }
                    closePop();
                });
            });
            document.addEventListener('click', (e) => {
                if (!themePop.hidden && !themePop.contains(e.target) && e.target !== themeToggle) {
                    closePop();
                }
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closePop();
            });
        }

        // v641 — paint the personal block. SAUDADE_PERSONAL falls back to
        // the empty-state empathy hook when there is no data.
        try {
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
                window.SAUDADE_PERSONAL.render('#sddCoverPersonal');
            }
        } catch (e) {}

        // v649 — let bootstrap.js know we're rendered so it can fade the
        // loading overlay immediately. Without app.js around, this used to
        // wait for a 12-second backstop.
        try { window.dispatchEvent(new CustomEvent('sdd-cover-rendered')); }
        catch (e) {}

        // v8 cover hero — load today's three dispatch headlines and replace
        // the pending placeholder. One headline per city, top of each list.
        loadDispatchHeads(ed);
    }

    // Constitution §9.1 — Saudade does not publish on Sundays. The
    // dispatches page already handles this (saudade-dispatches.js:654),
    // but the cover hero used to fetch yesterday's headlines anyway and
    // show them with a "1 DAY AGO" chip — making intentional silence
    // look like a missed cron. Detect KST Sunday on the cover and show
    // the silence message instead of the stale headlines.
    function isSundayKST() {
        // KST is UTC+9. Build a Date for "now in KST" and check getDay().
        const utcMs = Date.now();
        const kstMs = utcMs + 9 * 60 * 60 * 1000;
        const kst = new Date(kstMs);
        return kst.getUTCDay() === 0;
    }

    function loadDispatchHeads(ed) {
        if (isSundayKST()) {
            renderCoverHeadsSunday(ed);
            return;
        }
        const file = ed === 'en' ? 'dispatches.json' : `dispatches.${ed}.json`;
        const release = (typeof window !== 'undefined' && window.SAUDADE_RELEASE) || 'v0';
        fetch(`./data/${file}?v=${release}`, { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                const heads = pickCoverHeads(d);
                if (heads.length) {
                    renderCoverHeads(heads, ed);
                } else {
                    renderCoverHeadsPending(ed);
                }
                surfaceFreshness(d, ed);
            })
            .catch(() => renderCoverHeadsPending(ed));
    }

    function renderCoverHeadsSunday(ed) {
        const root = document.getElementById('sddCoverHeads');
        if (!root) return;
        const COPY = {
            en: { line1: 'Saudade does not publish on Sundays.',
                  line2: 'Dispatches resume Monday at 06:00 KST.' },
            ko: { line1: 'Saudade는 일요일에 발행하지 않는다.',
                  line2: '월요일 새벽 6시(KST) 디스패치 재개.' },
            ja: { line1: 'Saudadeは日曜日に発行しない。',
                  line2: '月曜日 朝6時(KST)に通信を再開する。' },
            pt: { line1: 'Saudade não publica aos domingos.',
                  line2: 'Os despachos recomeçam segunda às 06:00 KST.' },
            es: { line1: 'Saudade no publica los domingos.',
                  line2: 'Los despachos vuelven el lunes a las 06:00 KST.' }
        };
        const c = COPY[ed] || COPY.en;
        root.innerHTML = `
            <li class="sdd-cover-head sdd-cover-head--rest">
                <span class="headline">${escapeHtml(c.line1)}</span>
                <span class="lede">${escapeHtml(c.line2)}</span>
            </li>
        `;
    }

    function renderCoverHeadsPending(ed) {
        const root = document.getElementById('sddCoverHeads');
        if (!root) return;
        const COPY = {
            en: { line1: 'Tomorrow morning, three city dispatches land here.',
                  line2: 'Filed daily at 06:00 KST.' },
            ko: { line1: '내일 아침, 세 도시의 디스패치가 여기에 도착한다.',
                  line2: '매일 KST 06:00 발행.' },
            ja: { line1: '明朝、三つの街から通信が届く。',
                  line2: '毎日 KST 6:00 に発行。' },
            pt: { line1: 'Amanhã de manhã, três despachos chegam aqui.',
                  line2: 'Publicado todos os dias às 06:00 KST.' },
            es: { line1: 'Mañana, tres despachos llegan aquí.',
                  line2: 'Publicado todos los días a las 06:00 KST.' }
        };
        const c = COPY[ed] || COPY.en;
        root.innerHTML = `
            <li class="sdd-cover-head sdd-cover-head--pending-msg">
                <span class="headline">${escapeHtml(c.line1)}</span>
                <span class="lede">${escapeHtml(c.line2)}</span>
            </li>
        `;
    }

    // Surface the dispatch file's filed_at age in the cover hero eyebrow.
    // Daily filing per §9.5; anything older than 1 day means the cron has
    // missed — readers see the lag, founder gets an immediate signal
    // ("cron paused"). Was hidden in the existing per-page staleness chip
    // on §03 Dispatches; pulling it to the cover makes the failure
    // obvious from the front door.
    function surfaceFreshness(d, ed) {
        if (!d || !d.filed_at) return;
        const eyebrow = document.querySelector('.sdd-cover-heads-eyebrow');
        if (!eyebrow) return;
        const filed = new Date(d.filed_at).getTime();
        if (!Number.isFinite(filed)) return;
        const days = Math.floor((Date.now() - filed) / 86400000);
        if (days < 1) return;   // fresh — eyebrow stays as-is
        // Localized labels mirror saudade-dispatches.js staleness chip.
        const LABELS = {
            en: (n) => `${n} ${n === 1 ? 'DAY' : 'DAYS'} AGO`,
            ko: (n) => `${n}일 전`,
            ja: (n) => `${n}日前`,
            pt: (n) => `HÁ ${n} ${n === 1 ? 'DIA' : 'DIAS'}`,
            es: (n) => `HACE ${n} ${n === 1 ? 'DÍA' : 'DÍAS'}`
        };
        const label = (LABELS[ed] || LABELS.en)(days);
        const warn = days > 2 ? ' is-warn' : '';
        const chip = document.createElement('span');
        chip.className = 'sdd-cover-heads-stale' + warn;
        chip.textContent = '· ' + label;
        // Replace any prior chip so re-renders don't stack.
        const prior = eyebrow.querySelector('.sdd-cover-heads-stale');
        if (prior) prior.remove();
        eyebrow.appendChild(chip);
    }

    function pickCoverHeads(d) {
        if (!d || !Array.isArray(d.cities)) return [];
        const out = [];
        for (const c of d.cities) {
            const items = Array.isArray(c.items) ? c.items : [];
            const first = items.find(it => it && it.headline);
            if (first) out.push({
                city:        c.city || '',
                headline:    first.headline,
                lede:        first.lede || '',
                source:      first.source || '',
                source_date: first.source_date || ''
            });
            if (out.length >= 3) break;
        }
        return out;
    }

    // Per-edition city-desk suffix — "SEOUL DESK" / "서울 데스크" / etc.
    // (Existing DESK_SUFFIX uses 책상 in KO which is furniture-desk; the
    // newspaper sense in Korean is 데스크 — used here so the cover hero
    // reads like a city's local newspaper byline.)
    const COVER_DESK_LABEL = {
        en: 'DESK', ko: '데스크', ja: 'デスク', pt: 'REDAÇÃO', es: 'MESA'
    };

    function renderCoverHeads(heads, ed) {
        const root = document.getElementById('sddCoverHeads');
        if (!root || !heads.length) return;
        const deskLabel = COVER_DESK_LABEL[ed] || COVER_DESK_LABEL.en;
        root.innerHTML = heads.map((h, i) => {
            const cityUp = (h.city || '').toUpperCase();
            const ledeHtml = h.lede
                ? `<span class="lede">${escapeHtml(h.lede)}</span>`
                : '';
            // Semantic <time datetime="…"> for the source date — screen
            // readers parse it, Google understands the article date.
            const srcHtml = h.source || h.source_date
                ? `<span class="source">${escapeHtml(h.source || '')}${h.source && h.source_date ? ' · ' : ''}${
                        h.source_date
                            ? `<time datetime="${escapeHtml(h.source_date)}">${escapeHtml(h.source_date)}</time>`
                            : ''
                    }</span>`
                : '';
            // Each headline is a real <article> for semantic correctness +
            // search engines + screen readers. First item gets `is-lead`
            // so CSS can apply the drop-cap on the lead story (newspaper
            // convention). Wrapped in <li> so the outer <ol> still
            // numbers them semantically.
            return `
            <li class="sdd-cover-head${i === 0 ? ' is-lead' : ''}">
                <article>
                    <a href="#section-03" data-sdd-jump="tz">
                        <span class="city">${escapeHtml(cityUp)} ${escapeHtml(deskLabel)}</span>
                        <span class="headline">${escapeHtml(h.headline || '')}</span>
                        ${ledeHtml}
                        ${srcHtml}
                    </a>
                </article>
            </li>`;
        }).join('');
        // The newly-rendered <a data-sdd-jump="tz"> links need the same
        // click delegation as the cover-nav. Hook them now.
        root.querySelectorAll('[data-sdd-jump]').forEach(a => {
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

/* ── saudade-cover-edition.js ──────────────────────────────────────────────────── */
// SAUDADE · v8 §02 — Cover edition switcher (top-right discrete dropdown)
// 5 에디션 (en/ko/ja/pt/es). Cover 에서만 노출 — 섹션 진입 시 hide.
// SAUDADE_EDITION 모듈을 호출하여 전환 — 기존 Desk 의 Editions 섹션과 동일 source.
'use strict';

(function() {
    if (window.SAUDADE_COVER_EDITION) return;

    const EDITIONS = [
        { code: 'en', label: 'English' },
        { code: 'ko', label: '한국어' },
        { code: 'ja', label: '日本語' },
        { code: 'pt', label: 'Português' },
        { code: 'es', label: 'Español' }
    ];

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function currentEd() {
        return (window.SAUDADE_EDITION?.get?.() || 'en').toLowerCase();
    }

    let _el = null;
    function ensureEl() {
        if (_el && document.body.contains(_el)) return _el;
        _el = document.createElement('details');
        _el.className = 'sdd-cover-edition';
        _el.setAttribute('aria-label', 'Edition');
        document.body.appendChild(_el);
        return _el;
    }

    function render() {
        const ed = currentEd();
        const cur = EDITIONS.find(e => e.code === ed) || EDITIONS[0];
        const el = ensureEl();
        el.innerHTML = `
            <summary>${escapeHtml(cur.code.toUpperCase())}</summary>
            <ul class="sdd-cover-edition-list">
                ${EDITIONS.map(e => `
                    <li><button type="button" class="sdd-cover-edition-opt"
                                data-cover-ed="${escapeHtml(e.code)}"
                                aria-current="${e.code === ed}">${escapeHtml(e.label)}</button></li>
                `).join('')}
            </ul>
        `;
        el.querySelectorAll('[data-cover-ed]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-cover-ed');
                if (window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
                el.removeAttribute('open');
                render();
            });
        });
    }

    function init() {
        render();
        // edition 변경 (다른 곳에서) 감지
        const mo = new MutationObserver(() => render());
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_COVER_EDITION = { render };
})();

/* ── saudade-masthead.js ──────────────────────────────────────────────────── */
// SAUDADE · MASTHEAD + SECTION ROUTER (헌법 §0.5-5 신규 컴포넌트)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
//
// 역할:
// 1. dock-btn 클릭 → body.section-active + body[data-section="01..04"] 세팅
// 2. § 마다 다른 마스트헤드 ("§ 01 · THE LEDGER · ISSUE 03 · P.04") 자동 렌더
// 3. ESC / saudade 워드마크 클릭 → 표지로 복귀
'use strict';

(function() {
    if (window.SAUDADE_MASTHEAD) return;

    // dock data-cat → § 정보 (Handoff v2 §4 — tz/trip 재매핑)
    const SECTIONS = {
        visa: { num: '01', name: 'THE LEDGER',     ko: '레저',      page: 'P. 04' },
        cafe: { num: '02', name: 'THE ATLAS',      ko: '아틀라스',   page: 'P. 08' },
        tz:   { num: '03', name: 'DISPATCHES',     ko: '디스패치',   page: 'P. 13' },
        trip: { num: '04', name: 'THE DESK',       ko: '데스크',     page: 'P. 18' }
    };

    function injectStyles() {
        if (document.getElementById('sddMastheadStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddMastheadStyles';
        s.textContent = `
.sdd-masthead {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: clamp(20px, 3vw, 40px) clamp(24px, 6vw, 80px) clamp(12px, 1.5vw, 18px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    z-index: 6;
    pointer-events: none;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--ink);
}
body:not(.section-active) .sdd-masthead { display: none; }
body.cafe-mode .sdd-masthead { display: none; }
.sdd-mast-left, .sdd-mast-right {
    display: flex; gap: clamp(12px, 2vw, 32px); align-items: baseline;
    pointer-events: auto;
}
.sdd-mast-num     { color: var(--rust); }
.sdd-mast-name    { color: var(--ink); font-weight: 500; }
.sdd-mast-issue,
.sdd-mast-page    { color: var(--bone-d); font-weight: 400; letter-spacing: var(--tr-mono-meta); }
/* Wordmark on the masthead — small italic serif. Existing
   [data-sdd-wordmark] click handler already calls backToCover(); this
   just gives users a visible logo to tap from any section. */
.sdd-mast-wordmark {
    background: transparent;
    border: 0;
    padding: 0;
    margin-right: clamp(8px, 1.5vw, 16px);
    color: var(--ink);
    font-family: var(--serif);
    font-weight: 300;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: color .12s;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
}
.sdd-mast-wordmark em { font-style: italic; }
.sdd-mast-wordmark:hover,
.sdd-mast-wordmark:focus-visible { color: var(--rust); outline: none; }
.sdd-mast-back {
    background: transparent;
    border: 0;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 0;
}
.sdd-mast-back:hover { color: var(--rust); }
.sdd-mast-back::before { content: '← '; }

/* 섹션 스테이지 — § 화면 진입 시 paper 위 콘텐츠 영역 */
body.section-active .sdd-cover { display: none !important; }
body.section-active::before { content: none !important; }

/* 모바일 마스트헤드 단축 */
@media (max-width: 768px) {
    .sdd-masthead {
        padding: 14px 16px 8px;
        font-size: 9px;
        flex-wrap: wrap;
        gap: 6px;
    }
    .sdd-mast-issue, .sdd-mast-page { display: none; }
}
`;
        document.head.appendChild(s);
    }

    function ensureMasthead() {
        let m = document.getElementById('sddMasthead');
        if (m) return m;
        m = document.createElement('header');
        m.id = 'sddMasthead';
        m.className = 'sdd-masthead';
        m.innerHTML = `
            <div class="sdd-mast-left">
                <button type="button" class="sdd-mast-wordmark" data-sdd-wordmark
                        aria-label="saudade — back to cover"><em>saudade</em></button>
                <span class="sdd-mast-num"></span>
                <span class="sdd-mast-name"></span>
            </div>
            <div class="sdd-mast-right">
                <span class="sdd-mast-issue">ISSUE 03</span>
                <span class="sdd-mast-page"></span>
                <button type="button" class="sdd-mast-back" data-sdd-back>BACK TO COVER</button>
            </div>
        `;
        document.body.appendChild(m);

        m.querySelector('[data-sdd-back]').addEventListener('click', () => {
            backToCover();
        });
        return m;
    }

    function applyMasthead(cat) {
        const sec = SECTIONS[cat];
        if (!sec) return;
        const m = ensureMasthead();
        const ko = window.state && window.state.lang === 'ko';
        m.querySelector('.sdd-mast-num').textContent  = '§ ' + sec.num;
        m.querySelector('.sdd-mast-name').textContent = ko ? sec.ko : sec.name;
        m.querySelector('.sdd-mast-page').textContent = sec.page;
    }

    function setSection(cat) {
        document.body.classList.add('section-active');
        document.body.setAttribute('data-section', SECTIONS[cat] ? SECTIONS[cat].num : '');
        applyMasthead(cat);
        // 헌법 §9 — saudade.last.screen
        try { localStorage.setItem('saudade.last.screen', cat); } catch (e) {}
        // saudade-rings 도 macro → meso 로 재마운트 (§ 화면은 안쪽으로)
        try { window.SAUDADE_RINGS?.unmount?.(); window.SAUDADE_RINGS?.mount?.('meso', 'top-right'); } catch (e) {}
    }

    function backToCover() {
        document.body.classList.remove('section-active');
        document.body.removeAttribute('data-section');
        try { localStorage.setItem('saudade.last.screen', 'cover'); } catch (e) {}
        try { window.SAUDADE_RINGS?.unmount?.(); window.SAUDADE_RINGS?.mount?.('macro', 'bottom-right'); } catch (e) {}
        try { window.SAUDADE_COVER?.render?.(); } catch (e) {}
    }

    // v607 — 새로고침 시 마지막 § 복원 (자동 진입). 표지면 복원 안 함.
    function restoreLastScreen() {
        try {
            const last = localStorage.getItem('saudade.last.screen');
            if (last && SECTIONS[last]) {
                // dock-btn 의 click 핸들러도 호출되어야 기존 모듈 (visa-tracker 등) 의
                // 모달이 작동할 수 있도록 — 단 §62 에서 이미 모달 hide 됐으므로 setSection 만.
                setSection(last);
            }
        } catch (e) {}
    }

    // dock-btn 클릭 hook — JS 함수 손 안 대고 click 이벤트 capturing 으로 감지
    function watchDock() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.dock-btn');
            if (!btn) return;
            const cat = btn.getAttribute('data-cat');
            if (cat && SECTIONS[cat]) {
                setSection(cat);
            }
        }, true);

        // ESC = back to cover
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('section-active')) {
                e.stopPropagation();
                backToCover();
            }
        });

        // saudade 워드마크 클릭 = back to cover (있으면)
        document.addEventListener('click', (e) => {
            const wm = e.target.closest('.brand-stack, [data-sdd-wordmark]');
            if (wm && document.body.classList.contains('section-active')) {
                backToCover();
            }
        });
    }

    function init() {
        injectStyles();
        ensureMasthead();
        watchDock();
        // v7 검토 정정 — 사용자 "두 번 들어가는" 체감 정정.
        // 이전엔 setTimeout 200ms → cover 가 잠깐 보였다가 section 으로 점프 = 두 번 진입 느낌.
        // 이제 init 에서 동기적으로 attribute 만 설정 → cover 자체가 한 번도 안 보임.
        // 각 § 모듈의 MutationObserver 가 attribute 변경 감지하여 콘텐츠 렌더 (마이크로태스크).
        restoreLastScreen();
        window.SAUDADE_MASTHEAD = { setSection, backToCover, restoreLastScreen, SECTIONS };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ── saudade-edition.js ──────────────────────────────────────────────────── */
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
        applySkin(pickSkin());
    }

    // ── Theme skin (paper / saturated / dark) ─────────────────────────
    // Ported from the (dead) saudade-edition.js. When the standalone file
    // was bundled into this editorial.js the skin API got dropped on the
    // floor — window.SAUDADE_EDITION.setSkin was undefined, so every
    // theme-switch click in saudade-theme-switch.js + the cover theme
    // button silently no-op'd. Restored here.
    const SKINS = ['paper', 'saturated', 'dark'];
    const KEY_SKIN = 'saudade.skin';
    function isoWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (date.getUTCDay() + 6) % 7;
        date.setUTCDate(date.getUTCDate() - dayNum + 3);
        const firstThursday = date.valueOf();
        date.setUTCMonth(0, 1);
        if (date.getUTCDay() !== 4) date.setUTCMonth(0, 1 + ((4 - date.getUTCDay()) + 7) % 7);
        return 1 + Math.ceil((firstThursday - date) / 604800000);
    }
    function getSkinPref() {
        try {
            const v = localStorage.getItem(KEY_SKIN);
            return v && (SKINS.includes(v) || v === 'auto') ? v : 'auto';
        } catch (e) { return 'auto'; }
    }
    function saveSkinPref(v) {
        try { localStorage.setItem(KEY_SKIN, v); } catch (e) {}
    }
    function pickSkin() {
        const pref = getSkinPref();
        if (pref !== 'auto') return pref;
        const mm = (typeof matchMedia === 'function') ? matchMedia : null;
        if (!mm) return 'paper';
        if (mm('(prefers-reduced-motion: reduce)').matches) return 'paper';
        if (mm('(prefers-color-scheme: dark)').matches) return 'dark';
        const week = isoWeekNumber(new Date());
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

    // v621 — body 가 있을 때 한 번 + DOMContentLoaded 이후 한 번 더 (race 방지).
    // 이렇게 하면 lang attr 은 가능한 빨리, body class 는 body 있을 때 안전하게.
    init();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 이미 로드됨 → init() 한 번 더 (body 있을 것)
        init();
    }

    window.SAUDADE_EDITION = {
        set,
        get: () => getEdition() || DEFAULT,
        SUPPORTED, META,
        // Skin API — restored from the dead standalone saudade-edition.js.
        // Required by saudade-theme-switch.js and the cover theme button.
        setSkin,
        skin: () => document.documentElement.getAttribute('data-skin') || 'paper',
        skinPref: getSkinPref,
        SKINS
    };

    // v622 — 글로벌 i18n 헬퍼. 컴포넌트들이 self-내장 COPY 정의할 필요 없이 호출.
    // 사용: SAUDADE_T({ en: 'Cafés', ko: '카페', ja: 'カフェ', pt: 'Cafés', es: 'Cafés' })
    // 누락된 에디션은 en fallback.
    window.SAUDADE_T = function(strings) {
        if (!strings || typeof strings !== 'object') return '';
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        return strings[ed] || strings.en || Object.values(strings)[0] || '';
    };
})();
