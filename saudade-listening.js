// SAUDADE · § 05 THE LISTENING ROOM (Handoff v2 §5.5 + v6 §11 simplify)
// ASMR 라이브러리. 카테고리별 30~50 트랙. 사용자가 직접 클릭해서 듣는다.
// 분기 매칭 X · 도시 자동 매칭 X · 발행 호수 X. work session timer 만 유지.
// 진입: § 00 표지 우하단 한 곳 (다른 화면 진입 X — 헌법 §4-6).
// 라이선스 트래커 필수 표시 (Freesound CC0/CC-BY · own recording).
'use strict';

(function() {
    if (window.SAUDADE_LISTENING) return;

    let _data = null;
    let _activeIdx = null;
    let _audio = null;          // HTML5 Audio element (singleton)
    let _wakeLock = null;       // Wake Lock sentinel
    let _isPlaying = false;
    // v7 §11 By City — 모드 + 활성 도시 (localStorage 영속)
    const KEY_MODE = 'saudade.listening.mode';     // 'city' | 'category'
    const KEY_CITY = 'saudade.listening.city';     // slug
    let _mode = (() => { try { return localStorage.getItem(KEY_MODE) || 'city'; } catch (e) { return 'city'; } })();
    let _activeCity = (() => { try { return localStorage.getItem(KEY_CITY); } catch (e) { return null; } })();
    // v7 검토 정정 — R2 셋업 전 404 트랙을 "AWAITING UPLOAD" 로 표시
    // v647 — track meta was repeating "OWNED RECORDING · SAUDADE · RECORDED
    // IN LISBON, AUGUST 2025." across all 38 tracks. That's visual noise.
    // Reduce common phrases to short tokens so each row reads at a glance.
    function shortenCredit(licenseHtml, credits) {
        if (!credits) return licenseHtml;
        let c = String(credits);
        c = c.replace(/Owned recording\s*·\s*Saudade/gi, 'OWN');
        c = c.replace(/Saudade\s*·\s*Field recording/gi, 'OWN-FIELD');
        c = c.replace(/Recorded in\s+([A-Za-zÀ-ÿ' -]+),\s*([A-Za-z]+)\s+(\d{4})/i,
                      (_, city, mon, yr) => `${city.trim()} ${yr}`);
        c = c.replace(/\s*\.\s*$/, '');                  // trailing period
        return licenseHtml + ' · ' + c.toUpperCase();
    }

    const _unavailable = new Set();
    function markTrackUnavailable(idx) {
        _unavailable.add(idx);
        const root = document.getElementById('sddListening');
        if (!root) return;
        const row = root.querySelector(`[data-track-idx="${idx}"]`);
        if (!row) return;
        row.classList.add('sdd-listen-track-unavail');
        row.setAttribute('aria-disabled', 'true');
        const durEl = row.querySelector('.sdd-listen-duration');
        // v640 — i18n the unavailable label so non-English readers see
        // a real explanation instead of the English fallback.
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        // v656 — softer than ALL-CAPS "AWAITING" — same row already has the
        // unavailable class, the duration column just whispers "no tape yet".
        const label = {
            en: 'no tape yet',
            ko: '테이프 없음',
            ja: 'テープなし',
            pt: 'sem registo',
            es: 'sin grabación'
        }[ed] || 'no tape yet';
        if (durEl) durEl.textContent = label;
    }
    // v6 §11.2 — Work session timer (50 min work + 10 min rest)
    let _sessionStart = null;   // ms timestamp 세션 시작
    let _sessionPhase = 'idle'; // 'idle' | 'work' | 'rest'
    let _sessionTickIv = null;  // setInterval id (1s tick)
    const SESSION_WORK_MIN = 50;
    const SESSION_REST_MIN = 10;
    const SESSION_KEY = 'saudade.listening.sessions';   // 헌법 §9 키

    function load() {
        if (_data) return Promise.resolve(_data);
        // Use default cache mode + a release-stamped query string so a
        // fresh listening.json (e.g. after a fetch-content PR) reaches the
        // user without a hard reload. The literal v665 below is rewritten
        // in lock-step with sw.js CACHE_VERSION by scripts/bump-cache.js.
        // (Earlier version read window.SAUDADE_RELEASE which was never
        // defined → always fell back to v0 → listening.json effectively
        // pinned forever. That bug is why fresh photos/audio sometimes
        // didn't reach readers after a fetch-content merge.)
        return fetch('./data/listening.json?v=v735')
            .then(r => r.ok ? r.json() : null)
            .then(d => { _data = d || { tracks: [] }; return _data; })
            .catch(() => { _data = { tracks: [] }; return _data; });
    }

    function injectStyles() {
        if (document.getElementById('sddListenStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddListenStyles';
        s.textContent = `
.sdd-listen {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);        /* v7 검토 정정 — paper 통일 (다른 § 와 톤 일치) */
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.listening-active .sdd-listen { display: block; }

.sdd-listen-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    /* v7 검토 정정 — 이중선 방지: catnav 가 자체 border-bottom 가짐 */
}
.sdd-listen-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-listen-h2 .it { font-style: italic; display: inline; }

.sdd-listen-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 12px 0 0;
}

.sdd-listen-back {
    position: fixed;
    top: 16px; left: 16px;
    z-index: calc(var(--z-section-page, 8) + 2);
    /* Was rgba(242,238,227,.85) — hardcoded paper bg. In dark skin
       --ink becomes paper-tone too, so text + bg collided → invisible.
       Use var(--paper) so bg flips with the skin in lock-step with --ink. */
    background: var(--paper);
    border: 0.5px solid var(--ink);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 12px 16px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 0;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: color .12s, border-color .12s, background .12s;
}
.sdd-listen-back:hover { color: var(--ink); border-color: var(--ink); }
.sdd-listen-back::before { content: '← '; }

.sdd-listen-track {
    display: grid;
    grid-template-columns: 80px 1fr 100px;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
    cursor: pointer;
    transition: background .12s;
}
.sdd-listen-track:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-listen-track:hover { background: var(--paper-d); }
.sdd-listen-track[aria-current="true"] { background: var(--paper-d); }

.sdd-listen-num {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-listen-num .marker {
    display: inline-block;
    margin-right: 6px;
    color: var(--bone);
}
.sdd-listen-track[aria-current="true"] .sdd-listen-num .marker { color: var(--ink); }
.sdd-listen-track[aria-current="true"] .sdd-listen-num .marker::before { content: '\\25B6 '; }

.sdd-listen-body { display: flex; flex-direction: column; gap: 6px; }

/* v6 §11 simplify — ASMR library category headers (mono caps, between groups) */
.sdd-listen-cat-head {
    margin: clamp(40px, 6vw, 72px) 0 clamp(8px, 1.5vw, 12px);
    padding-bottom: clamp(8px, 1vw, 12px);
    border-bottom: 0.5px solid var(--rule-2);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    scroll-margin-top: 88px;
}
.sdd-listen-cat-head:first-of-type { margin-top: clamp(20px, 3vw, 32px); }

/* v7 검토 정정 — 11 카테고리 anchor navigation (가로 스크롤) */
.sdd-listen-catnav {
    position: sticky;
    top: 0;
    z-index: 2;
    margin: 0 calc(clamp(24px, 6vw, 80px) * -1) clamp(20px, 3vw, 32px);
    padding: 12px clamp(24px, 6vw, 80px);
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    display: flex;
    gap: 18px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}
.sdd-listen-catnav::-webkit-scrollbar { display: none; }
.sdd-listen-catnav-link {
    flex: 0 0 auto;
    background: transparent;
    border: 0;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 14px 4px;
    min-height: 44px;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    text-decoration: none;
    white-space: nowrap;
    transition: color .12s, border-color .12s;
}
.sdd-listen-catnav-link:hover { color: var(--ink); }
.sdd-listen-catnav-link:focus { outline: none; }
.sdd-listen-catnav-link:focus-visible { outline: 1.5px solid var(--accent); outline-offset: 2px; }
.sdd-listen-catnav-link[aria-current="true"] {
    color: var(--ink);
    border-bottom-color: var(--rust);
}
@media (max-width: 768px) {
    .sdd-listen-catnav {
        margin: 0 -16px clamp(16px, 2vw, 24px);
        padding: 10px 16px;
        gap: 14px;
    }
}
.sdd-listen-cat-name {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-listen-cat-count {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}

.sdd-listen-title {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.45;
    color: var(--ink);
}
.sdd-listen-license {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone);
    margin-top: 4px;
}
.sdd-listen-license a {
    color: var(--bone-d);
    border-bottom: 0.5px solid var(--rule);
    text-decoration: none;
}
.sdd-listen-license a:hover { color: var(--ink); }

.sdd-listen-duration {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    text-align: right;
    white-space: nowrap;
}

/* v7 검토 정정 — 비가용 트랙 (R2 셋업 전 404) */
.sdd-listen-track-unavail {
    opacity: 0.5;
    cursor: not-allowed;
}
.sdd-listen-track-unavail:hover { background: transparent; }
.sdd-listen-track-unavail .sdd-listen-duration {
    color: var(--rust);
    font-style: italic;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
}

.sdd-listen-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-listen-foot p {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: 0;
}
.sdd-listen-foot p strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

/* v7 §11 By City — 도시별 시그니처 사진 + 트랙 (잡지 "이 도시의 소리" 코너 톤) */
.sdd-listen-mode {
    display: flex;
    gap: 18px;
    align-items: baseline;
    margin: 12px 0 clamp(20px, 3vw, 32px);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
}
.sdd-listen-mode-btn {
    background: transparent !important;
    border: 0 !important;
    border-bottom: 1px solid transparent !important;
    color: var(--bone-d) !important;
    font: inherit !important;
    text-transform: inherit !important;
    letter-spacing: inherit !important;
    padding: 14px 4px !important;
    min-height: 44px !important;
    cursor: pointer;
    border-radius: 0 !important;
    transition: color .12s, border-color .12s;
}
.sdd-listen-mode-btn:hover { color: var(--ink) !important; }
.sdd-listen-mode-btn[aria-current="true"] {
    color: var(--ink) !important;
    border-bottom-color: var(--rust) !important;
}
.sdd-listen-mode-sep { color: var(--bone-d); opacity: .5; user-select: none; }

/* 도시 선택 dropdown — 우상단, paper-d 1px hairline */
.sdd-listen-city-switcher {
    position: relative;
    display: inline-block;
    margin-left: auto;
}
.sdd-listen-city-switcher > summary {
    list-style: none;
    cursor: pointer;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
    padding: 6px 12px;
    border: 0.5px solid var(--rule);
    background: var(--paper-d);
    border-radius: 0;
    user-select: none;
}
.sdd-listen-city-switcher > summary::-webkit-details-marker { display: none; }
.sdd-listen-city-switcher > summary::after { content: ' \\25BE'; opacity: .6; }
.sdd-listen-city-switcher[open] > summary::after { content: ' \\25B4'; opacity: 1; }
.sdd-listen-city-switcher-list {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    list-style: none;
    margin: 0;
    padding: 0;
    background: var(--paper-d);
    border: 0.5px solid var(--rule);
    min-width: 160px;
    z-index: 3;
}
.sdd-listen-city-switcher-list li { border-top: 0.5px solid var(--rule); }
.sdd-listen-city-switcher-list li:first-child { border-top: 0; }
.sdd-listen-city-switcher-list button {
    background: transparent !important;
    border: 0 !important;
    width: 100% !important;
    text-align: left !important;
    font-family: var(--mono) !important;
    font-weight: 500 !important;
    font-size: 11px !important;
    letter-spacing: var(--tr-mono-mast) !important;
    text-transform: uppercase !important;
    color: var(--ink) !important;
    padding: 12px 14px !important;
    cursor: pointer;
    border-radius: 0 !important;
    min-height: 44px !important;
}
.sdd-listen-city-switcher-list button:hover { color: var(--rust) !important; background: var(--paper-d) !important; }
.sdd-listen-city-switcher-list button[aria-current="true"] { color: var(--rust) !important; }

/* 사진 헤더 — 화면 상단, 4px paper frame, 14px 여백 (풀블리드 X) */
.sdd-listen-city-photo {
    /* Anchor for the absolute-positioned .sdd-listen-city-photo-placeholder
       inside. Without this the placeholder escaped to the viewport on some
       layouts and the photo never stacked correctly above it. */
    position: relative;
    margin: 0 0 12px;
    padding: 4px;
    background: var(--paper);
    border: 0.5px solid var(--rule);
    aspect-ratio: 16 / 10;
    /* v644/647 — full-width 16:10 was filling the whole viewport (>900px tall
       on a desktop). v644 went to 56vh which felt too cramped per user
       feedback. v647 settles at 70vh / 620px which is generous but leaves
       room for the track list below the placeholder. */
    max-height: min(70vh, 620px);
    overflow: hidden;
    position: relative;
}
.sdd-listen-city-photo-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--paper-d);
    /* v636 — placeholder lives BEHIND the img by default; img only fades
       in when its onload fires. If the image 404s (or returns a 200 fallback
       page that fails to decode), the placeholder stays visible. */
    opacity: 0;
    transition: opacity .45s ease;
    position: relative;
    z-index: 1;
}
.sdd-listen-city-photo-img.is-loaded { opacity: 1; }
.sdd-listen-city-photo-placeholder {
    position: absolute;
    inset: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    /* Default: paper-d flat. Per-city blocks below override with a
       scenic sky → horizon → ground gradient evoking each location.
       Real Pexels photos overlay these once the workflow runs. */
    background: var(--paper-d);
    color: var(--bone-d);
    text-align: center;
    padding: 24px;
}

/* Per-city scenic gradients — sky / horizon / ground palette. Subtle
   enough that the city name + "awaiting photograph" line stays
   readable on top, evocative enough that an empty card no longer
   feels broken. */
.sdd-listen-city-photo-placeholder[data-city-slug="lisbon"]      { background: linear-gradient(180deg, #9CC6E6 0%, #E9C893 55%, #C66B47 100%); color: #2E1A12; }
.sdd-listen-city-photo-placeholder[data-city-slug="porto"]       { background: linear-gradient(180deg, #87B4D9 0%, #C9B894 60%, #8C3E26 100%); color: #2E1A12; }
.sdd-listen-city-photo-placeholder[data-city-slug="madrid"]      { background: linear-gradient(180deg, #E9C893 0%, #C77A4A 50%, #8B3A21 100%); color: #2A1411; }
.sdd-listen-city-photo-placeholder[data-city-slug="barcelona"]   { background: linear-gradient(180deg, #7AAEE0 0%, #C9B894 60%, #6B6356 100%); color: #1B2233; }
.sdd-listen-city-photo-placeholder[data-city-slug="berlin"]      { background: linear-gradient(180deg, #C7D0D9 0%, #A8AEB5 55%, #5B5A53 100%); color: #1A1815; }
.sdd-listen-city-photo-placeholder[data-city-slug="tokyo"]       { background: linear-gradient(180deg, #BFC2D4 0%, #7E889E 55%, #2A2F44 100%); color: #F2EEE3; }
.sdd-listen-city-photo-placeholder[data-city-slug="seoul"]       { background: linear-gradient(180deg, #B7CFE0 0%, #B0A790 55%, #5A4A3E 100%); color: #2A1F1A; }
.sdd-listen-city-photo-placeholder[data-city-slug="chiang-mai"]  { background: linear-gradient(180deg, #E7D08A 0%, #B8943E 40%, #4A6841 100%); color: #1F2D1F; }
.sdd-listen-city-photo-placeholder[data-city-slug="bali"]        { background: linear-gradient(180deg, #B4D89B 0%, #6FAA66 50%, #2D6B83 100%); color: #1F2D1F; }
.sdd-listen-city-photo-placeholder[data-city-slug="da-nang"]     { background: linear-gradient(180deg, #F2D89A 0%, #D2A55B 40%, #437694 100%); color: #2A1F12; }
.sdd-listen-city-photo-placeholder[data-city-slug="mexico-city"] { background: linear-gradient(180deg, #F2C6D6 0%, #E6A86C 50%, #6E4A7F 100%); color: #2A1F2F; }
.sdd-listen-city-photo-placeholder[data-city-slug="medellin"]    { background: linear-gradient(180deg, #A8C9E2 0%, #88B27A 55%, #4E7E51 100%); color: #1F2D1F; }
.sdd-listen-city-photo-placeholder[data-city-slug="buenos-aires"]{ background: linear-gradient(180deg, #B8D4E8 0%, #E8DEB5 60%, #8C7F50 100%); color: #2A2517; }
.sdd-listen-city-photo-placeholder[data-city-slug="tbilisi"]     { background: linear-gradient(180deg, #C7BDA8 0%, #A88B6E 55%, #5B3E2F 100%); color: #2A1F18; }
.sdd-listen-city-photo-placeholder .city {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1;
    /* Was var(--ink); now inherits from the placeholder so each city's
       scenic gradient picks the right text contrast (dark name on
       sunset palette, light name on dusk Tokyo, etc.). */
    color: inherit;
    text-shadow: 0 1px 2px rgba(11,11,15,.16);
}
.sdd-listen-city-photo-placeholder .note {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
}
.sdd-listen-city-caption {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13px, 1.2vw, 15px);
    line-height: 1.5;
    color: var(--bone-d);
    margin: 0 0 clamp(20px, 3vw, 32px);
    max-width: 60ch;
}

/* 도시 트랙 리스트 — 사진 아래 */
.sdd-listen-city-tracks { margin: 0; }
.sdd-listen-empty {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
    padding: clamp(40px, 6vw, 80px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
}

@media (max-width: 768px) {
    .sdd-listen-city-photo { aspect-ratio: 4 / 3; }
}

/* 컨트롤 바 — 직선 + 점만 (헌법 §5.5 둥근 버튼 금지) */
.sdd-listen-controls {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 18px;
    /* Was rgba(242,238,227,.92) — paper hardcoded. In dark skin --ink
       becomes paper-tone too, so player labels collided with bg →
       invisible. Use var(--paper) so bg flips with the skin in lock-
       step with --ink, mirroring the back-button fix from #120. */
    background: var(--paper);
    border: 0.5px solid var(--rule-2);
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    z-index: calc(var(--z-section-page, 8) + 1);
    border-radius: 0;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-listen-ctl {
    background: transparent;
    border: 0;
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 6px 10px;
    cursor: pointer;
    min-height: 44px;
    border-radius: 0;
    transition: color .12s;
}
.sdd-listen-ctl:hover { color: var(--ink); }
.sdd-listen-ctl[aria-pressed="true"] { color: var(--ink); }
.sdd-listen-ctl-sep { color: var(--rule-2); }
.sdd-listen-vol-label {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    color: var(--bone-d);
}
/* v7 §11.5 — 1px hairline 슬라이더. 브라우저 기본 fill·accent 강제 제거. */
.sdd-listen-vol {
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    appearance: none !important;
    background: transparent !important;
    accent-color: transparent;
    width: 100px;
    height: 16px;
    outline: none;
    cursor: pointer;
    border: 0;
    border-radius: 0;
    padding: 0;
    margin: 0 4px;
    box-sizing: border-box;
    /* 가운데 1px hairline 만 보이도록 inline gradient (브라우저 progress fill 무력화).
       color-mix → 다크 스킨 + 5 에디션 ink 색을 따라간다. */
    background-image: linear-gradient(
        to bottom,
        transparent 0,
        transparent 7.5px,
        color-mix(in srgb, var(--ink) 30%, transparent) 7.5px,
        color-mix(in srgb, var(--ink) 30%, transparent) 8.5px,
        transparent 8.5px,
        transparent 16px
    ) !important;
}
.sdd-listen-vol::-webkit-slider-runnable-track {
    -webkit-appearance: none !important;
    appearance: none !important;
    height: 1px;
    background: transparent !important;
    border: 0;
    border-radius: 0;
}
.sdd-listen-vol::-moz-range-track {
    height: 1px;
    background: color-mix(in srgb, var(--ink) 30%, transparent) !important;
    border: 0;
    border-radius: 0;
}
.sdd-listen-vol::-moz-range-progress {
    background: color-mix(in srgb, var(--ink) 30%, transparent) !important;
    height: 1px;
}
.sdd-listen-vol::-webkit-slider-thumb {
    -webkit-appearance: none !important;
    appearance: none !important;
    width: 8px;
    height: 8px;
    background: var(--ink);
    border-radius: 50%;
    cursor: pointer;
    margin-top: -3.5px;
    border: 0;
    box-shadow: none;
}
.sdd-listen-vol::-moz-range-thumb {
    width: 8px;
    height: 8px;
    background: var(--ink);
    border-radius: 50%;
    border: 0;
    cursor: pointer;
    box-shadow: none;
}
.sdd-listen-vol-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    min-width: 24px;
    text-align: right;
}

/* v6 §11.2 — Work session timer + sessions today counter */
.sdd-listen-session-state {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
    min-width: 80px;
    text-align: right;
}
.sdd-listen-session-state.work { color: var(--ink); }
.sdd-listen-session-state.rest { color: var(--bone-d); }

.sdd-listen-session-counter {
    position: fixed;
    bottom: 76px;
    left: 50%;
    transform: translateX(-50%);
    z-index: calc(var(--z-section-page, 8) + 1);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone);
    margin: 0;
    pointer-events: none;
    text-align: center;
}

@media (max-width: 768px) {
    .sdd-listen-controls {
        bottom: 16px;
        padding: 8px 14px;
        gap: 10px;
        font-size: 10px;
    }
    .sdd-listen-vol { width: 70px; }
}

@media (max-width: 768px) {
    .sdd-listen { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-listen-track {
        grid-template-columns: 60px 1fr;
        gap: 12px;
    }
    .sdd-listen-duration {
        grid-column: 2;
        text-align: left;
        margin-top: 4px;
    }
}

/* Body 톤 락 — Listening Room 자체 다크 */
body.listening-active { background: var(--paper) !important; }

/* § 00 cover 우하단 진입 링크 */
.sdd-cover-listen-cta {
    position: fixed;
    right: clamp(24px, 6vw, 80px);
    bottom: calc(var(--dock-h, 56px) + 24px);
    z-index: var(--z-cover, 4);
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 14px 18px;
    cursor: pointer;
    border-radius: 4px;
    min-height: 44px;
    transition: color .12s, border-color .12s;
    pointer-events: auto;
}
.sdd-cover-listen-cta:hover { color: var(--rust); border-color: var(--rust); }
.sdd-cover-listen-cta::after { content: ' \\2192'; }
body.section-active .sdd-cover-listen-cta,
body.cafe-mode .sdd-cover-listen-cta,
body.listening-active .sdd-cover-listen-cta,
body.colophon-active .sdd-cover-listen-cta { display: none !important; }

@media (max-width: 768px) {
    .sdd-cover-listen-cta {
        right: 16px;
        bottom: calc(var(--dock-h, 56px) + 16px);
        font-size: 9px;
        padding: 12px 14px;
    }
}
`;
        document.head.appendChild(s);
    }

    // ─── Work Session Timer (Handoff v6 §11.2) ──────────────────────────
    // 50 min work + 10 min rest. 트랙 재생 시작 = 세션 시작.
    // 끝나면 종소리 1회. 사용자만 보이는 'sessions today' 카운터 (공유 X).

    function getSessions() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function todayKey() { return new Date().toISOString().slice(0, 10); }
    function sessionsToday() {
        const all = getSessions();
        return all[todayKey()] || 0;
    }
    function bumpSessionsToday() {
        const all = getSessions();
        const k = todayKey();
        all[k] = (all[k] || 0) + 1;
        // 30일 이전 키는 정리
        const cutoff = Date.now() - 30 * 86400000;
        Object.keys(all).forEach(date => {
            if (new Date(date).getTime() < cutoff) delete all[date];
        });
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(all)); } catch (e) {}
    }

    let _sessionLogId = null;       // v8 §11 — worker INSERT 후 받는 row id
    function startSession() {
        if (_sessionPhase === 'work') return;
        _sessionStart = Date.now();
        _sessionPhase = 'work';
        bumpSessionsToday();
        if (_sessionTickIv) clearInterval(_sessionTickIv);
        _sessionTickIv = setInterval(tickSession, 1000);
        renderSessionState();
        // v8 §11 — 약한 연결 집계용 세션 로그 (worker · D1)
        logListeningSessionStart();
    }
    // v8 §11 — listening_sessions INSERT, row id 캡처 (UPDATE duration 용)
    function logListeningSessionStart() {
        _sessionLogId = null;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return;
        const tracks = _data?.tracks || [];
        const t = (_activeIdx != null) ? tracks[_activeIdx] : null;
        if (!t) return;
        const user = window.SAUDADE_AUTH?.getUser?.() || null;
        try {
            fetch(base + '/listening/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.id || null,
                    track_id: t.audio_url || t.title,
                    city: t.city || null,
                    started_at: _sessionStart
                }),
                credentials: 'omit'
            }).then(r => r.ok ? r.json() : null)
              .then(j => { if (j && j.id) _sessionLogId = j.id; })
              .catch(() => {});
        } catch (e) {}
    }
    // v8 §11 — duration_seconds UPDATE (세션 종료 시. 정확한 약한 연결 집계).
    function logListeningSessionEnd() {
        if (!_sessionLogId || !_sessionStart) return;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return;
        const duration = Math.max(0, Math.floor((Date.now() - _sessionStart) / 1000));
        try {
            fetch(base + '/listening/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: _sessionLogId, duration_seconds: duration }),
                credentials: 'omit',
                keepalive: true   // 페이지 떠나도 전송 보장
            }).catch(() => {});
        } catch (e) {}
        _sessionLogId = null;
    }
    function pauseSession() {
        // 일시정지 = phase 유지, tick 만 멈춤. 재개 시 elapsed 보존 위해 _pausedAt 저장.
        if (_sessionTickIv) { clearInterval(_sessionTickIv); _sessionTickIv = null; }
    }
    function endSession() {
        // v8 §11 — duration UPDATE 먼저 (start 값 살아있을 때)
        logListeningSessionEnd();
        _sessionPhase = 'idle';
        _sessionStart = null;
        if (_sessionTickIv) { clearInterval(_sessionTickIv); _sessionTickIv = null; }
        renderSessionState();
    }
    // v8 §11 — 페이지 종료 시 마지막 세션 duration UPDATE (keepalive 로 전송 보장)
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => { logListeningSessionEnd(); });
        window.addEventListener('beforeunload', () => { logListeningSessionEnd(); });
    }
    function tickSession() {
        if (_sessionPhase === 'idle' || !_sessionStart) return;
        const elapsedSec = Math.floor((Date.now() - _sessionStart) / 1000);
        const workSec = SESSION_WORK_MIN * 60;
        const restSec = SESSION_REST_MIN * 60;

        if (_sessionPhase === 'work' && elapsedSec >= workSec) {
            // work → rest transition + 종소리
            _sessionPhase = 'rest';
            _sessionStart = Date.now();
            playSessionCue();
        } else if (_sessionPhase === 'rest' && elapsedSec >= restSec) {
            // rest 끝 → 다음 work 자동? 헌법 §11.2 "트랙 끝나면 자연스럽게 정지" — 정지.
            endSession();
            return;
        }
        renderSessionState();
    }
    function fmtTimer(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    function renderSessionState() {
        const root = document.getElementById('sddListening');
        const stateEl = root?.querySelector('[data-session-state]');
        const counterEl = root?.querySelector('[data-session-counter]');
        if (!stateEl) return;
        if (_sessionPhase === 'idle') {
            stateEl.textContent = '';
            stateEl.className = 'sdd-listen-session-state';
        } else {
            const elapsed = Math.floor((Date.now() - _sessionStart) / 1000);
            const total = (_sessionPhase === 'work' ? SESSION_WORK_MIN : SESSION_REST_MIN) * 60;
            const remain = Math.max(0, total - elapsed);
            const label = _sessionPhase === 'work' ? 'WORK' : 'REST';
            stateEl.textContent = `${label} · ${fmtTimer(remain)}`;
            stateEl.className = 'sdd-listen-session-state ' + _sessionPhase;
        }
        if (counterEl) {
            const n = sessionsToday();
            counterEl.textContent = n === 0 ? '' : `${n} ${n === 1 ? 'SESSION' : 'SESSIONS'} TODAY`;
        }
    }

    // 작업→휴식 전환 시 종소리 — Web Audio API 로 짧은 sine ping (CC0 sample 없이도 작동)
    function playSessionCue() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = 880;
            o.type = 'sine';
            g.gain.value = 0;
            o.connect(g); g.connect(ctx.destination);
            const t = ctx.currentTime;
            g.gain.linearRampToValueAtTime(0.18, t + 0.01);
            g.gain.linearRampToValueAtTime(0,    t + 1.2);
            o.start(t);
            o.stop(t + 1.3);
            setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);
        } catch (e) {}
    }

    // ─── HTML5 Audio + Wake Lock (Handoff v3 §5.5) ───────────────────────
    function ensureAudio() {
        if (_audio) return _audio;
        _audio = new Audio();
        _audio.preload = 'metadata';
        _audio.crossOrigin = 'anonymous';
        // 초기 볼륨 복원
        try {
            const saved = parseFloat(localStorage.getItem('saudade.listening.volume'));
            _audio.volume = (Number.isFinite(saved) && saved >= 0 && saved <= 1) ? saved : 0.7;
        } catch (e) { _audio.volume = 0.7; }

        _audio.addEventListener('play',  () => {
            _isPlaying = true;
            syncControlState();
            requestWakeLock();
            startSession();         // v6 §11.2 — 트랙 재생 시작 = 세션 시작
        });
        _audio.addEventListener('pause', () => {
            _isPlaying = false;
            syncControlState();
            releaseWakeLock();
            pauseSession();         // tick 멈춤 (phase 유지)
        });
        _audio.addEventListener('ended', () => {
            _isPlaying = false;
            syncControlState();
            releaseWakeLock();
            // 끝나면 자연스럽게 다음 트랙으로 (v6 §11 simplify) — 단순 다음 idx
            if (_data && _data.tracks && _activeIdx != null) {
                const next = _activeIdx + 1;
                if (next < _data.tracks.length) {
                    playTrack(next);
                    return;
                }
            }
            endSession();   // 마지막 트랙 끝 = 세션 종료
        });
        _audio.addEventListener('timeupdate', () => {
            // 30초마다 saudade.reading.position 갱신
            try {
                if (Math.floor(_audio.currentTime) % 30 === 0) {
                    localStorage.setItem('saudade.reading.position', JSON.stringify({
                        idx: _activeIdx,
                        category: _data?.tracks?.[_activeIdx]?.category || '',
                        position: _audio.currentTime,
                        ts: Date.now()
                    }));
                }
            } catch (e) {}
        });
        _audio.addEventListener('error', () => {
            _isPlaying = false;
            syncControlState();
            releaseWakeLock();
            // v7 검토 정정 — 404 / decode 실패 시 트랙을 비가용으로 표시
            if (_activeIdx != null) markTrackUnavailable(_activeIdx);
        });
        return _audio;
    }

    function playTrack(idx) {
        const tracks = _data?.tracks || [];
        if (idx < 0 || idx >= tracks.length) return;
        if (_unavailable.has(idx)) return;   // 비가용 트랙은 재생 시도 X
        const t = tracks[idx];
        if (!t.audio_url) { markTrackUnavailable(idx); return; }
        const a = ensureAudio();
        _activeIdx = idx;
        a.src = t.audio_url;
        // 저장된 위치 있으면 seek (같은 트랙일 때만)
        try {
            const pos = JSON.parse(localStorage.getItem('saudade.reading.position') || '{}');
            if (pos.idx === idx && Number.isFinite(pos.position) && pos.position < (t.duration_minutes || 60) * 60) {
                a.currentTime = pos.position;
            }
        } catch (e) {}
        a.play().catch((err) => {
            // autoplay 차단 또는 audio file 없음 — UI 만 업데이트
            _isPlaying = false;
            syncControlState();
            // 자동 차단 (NotAllowedError) 은 사용자 제스처 부족 — 다시 클릭 유도
            // 그 외 (NotSupportedError 등) 는 비가용 트랙으로 표시
            if (err && err.name && err.name !== 'NotAllowedError') {
                markTrackUnavailable(idx);
            }
        });
        syncTrackHighlight();
    }

    function pauseAudio()  { if (_audio && !_audio.paused) _audio.pause(); }
    function resumeAudio() { if (_audio && _audio.paused && _audio.src) _audio.play().catch(() => {}); }

    async function requestWakeLock() {
        if (_wakeLock) return;
        if (!('wakeLock' in navigator)) return;
        try {
            _wakeLock = await navigator.wakeLock.request('screen');
            _wakeLock.addEventListener('release', () => { _wakeLock = null; });
        } catch (e) { /* user denied or unsupported */ }
    }
    function releaseWakeLock() {
        if (_wakeLock) {
            try { _wakeLock.release(); } catch (e) {}
            _wakeLock = null;
        }
    }

    // ─── 컨트롤 UI 동기화 (헌법: 직선 + 점만, 둥근 버튼 X) ────────────────
    function syncControlState() {
        const playBtn = document.querySelector('[data-listen-play]');
        if (playBtn) {
            playBtn.setAttribute('aria-pressed', String(_isPlaying));
            playBtn.textContent = _isPlaying ? 'PAUSE' : 'PLAY';
        }
    }
    function syncTrackHighlight() {
        const root = document.getElementById('sddListening');
        if (!root) return;
        root.querySelectorAll('[data-track-idx]').forEach(el => {
            el.setAttribute('aria-current', String(parseInt(el.dataset.trackIdx, 10) === _activeIdx));
        });
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
    // v7 검토 정정 — italic 헤드라인 마침표 regular 분리
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }
    function safeUrl(u) {
        if (!u || typeof u !== 'string') return null;
        try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? url.toString() : null; }
        catch (e) { return null; }
    }

    // v7 §11 By City — 도시 우선 모드 결정 (priority: 명시 > localStorage > home city > 첫 도시)
    function resolveActiveCity(data) {
        const cities = (data && data.cities) || [];
        if (!cities.length) return null;
        const has = (slug) => cities.some(c => c.slug === slug);
        if (_activeCity && has(_activeCity)) return _activeCity;
        // home city — Atlas / Desk 의 정착 도시 활용 (분리된 임시 모드, §5.4 와 별개)
        const home = window.SAUDADE_CITY?.persistentHomeCity?.();
        if (home) {
            const homeSlug = String(home).toLowerCase().replace(/\s+/g, '-');
            if (has(homeSlug)) return homeSlug;
        }
        // Prefer a city with a photo so the first landing isn't a placeholder
        // card when the user has no saved preference.
        const withPhoto = cities.find(c => c.default_photo_url || c.photo_url);
        return (withPhoto || cities[0]).slug;
    }

    function setMode(m) {
        _mode = m === 'category' ? 'category' : 'city';
        try { localStorage.setItem(KEY_MODE, _mode); } catch (e) {}
        render(_data);
    }
    function setActiveCity(slug) {
        _activeCity = slug;
        try { localStorage.setItem(KEY_CITY, slug); } catch (e) {}
        render(_data);
    }

    function render(data) {
        let root = document.getElementById('sddListening');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddListening';
            root.className = 'sdd-listen';
            document.body.appendChild(root);
        }

        const tracks = (data && data.tracks) || [];
        const cities = (data && data.cities) || [];

        // Photo-only city mode: cities that already carry a curated default
        // photo render the listening room visually while the Freesound fetch
        // workflow is still pending. Each photo is real (Pexels CC0 with
        // sidecars) and the per-city "no tracks yet" line preserves §3
        // honesty about audio still being awaited.
        const citiesWithPhoto = cities.filter(c => c.default_photo_url || c.photo_url);

        // v637 — full-room empty state. Only fall through when we have
        // neither tracks nor city photos; otherwise let the city mode
        // photo gallery carry the room.
        if (!tracks.length && !citiesWithPhoto.length && window.SAUDADE_EMPTY) {
            const t = window.SAUDADE_EMPTY.text('listening');
            window.SAUDADE_EMPTY.render(root, {
                eyebrow: t.eyebrow, headline: t.headline, lede: t.lede, note: t.note
            });
            return;
        }

        // 도시 모드 가능 여부 — tracks 가 있고 city 태그가 있거나, 사진만 있는 도시가 있어도 활성.
        const cityModeAvailable = cities.length > 0
            && (tracks.some(t => t.city) || citiesWithPhoto.length > 0);
        // tracks 가 비어있으면 category 모드는 표시할 게 없으니 city 모드 강제 — 사진 갤러리로 작동.
        const tracksEmpty = tracks.length === 0;
        const effectiveMode = (cityModeAvailable && (_mode === 'city' || tracksEmpty)) ? 'city' : 'category';

        // v6 §11 simplify — ASMR 라이브러리. 카테고리별 그룹 헤더 + 평면 인덱스로 클릭→재생.
        // 분기/도시 매칭 X. 발행 호수 X. 사용자가 카테고리 보고 직접 고름.
        const categoriesInOrder = [];
        const counts = {};
        for (const t of tracks) {
            const c = t.category || 'OTHER';
            if (!(c in counts)) categoriesInOrder.push(c);
            counts[c] = (counts[c] || 0) + 1;
        }

        const catSlug = (c) => 'cat-' + (c || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-');

        let lastCat = null;
        const tracksHtml = tracks.map((t, i) => {
            const dur = t.duration_minutes ? `${t.duration_minutes} MIN` : '';
            const licenseUrl = safeUrl(t.license_url);
            const licenseLine = licenseUrl
                ? `<a href="${licenseUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.license || '')}</a>`
                : escapeHtml(t.license || '');
            const cat = t.category || 'OTHER';
            let prefix = '';
            if (cat !== lastCat) {
                const n = counts[cat];
                prefix = `
                    <header class="sdd-listen-cat-head" id="${catSlug(cat)}">
                        <span class="sdd-listen-cat-name">${escapeHtml(cat)}</span>
                        <span class="sdd-listen-cat-count">${String(n).padStart(2, '0')} ${n === 1 ? 'TRACK' : 'TRACKS'}</span>
                    </header>
                `;
                lastCat = cat;
            }
            const isUnavail = _unavailable.has(i);
            const durDisplay = isUnavail ? '—' : dur;
            return prefix + `
                <article class="sdd-listen-track${isUnavail ? ' sdd-listen-track-unavail' : ''}"
                         data-track-idx="${i}"
                         tabindex="0" role="button"
                         ${isUnavail ? 'aria-disabled="true"' : ''}
                         aria-label="${escapeHtml(cat)} — ${escapeHtml(t.title)}">
                    <span class="sdd-listen-num"><span class="marker">  </span>${String(i + 1).padStart(2, '0')}</span>
                    <div class="sdd-listen-body">
                        <p class="sdd-listen-title">${escapeHtml(t.title)}</p>
                        <p class="sdd-listen-license">${shortenCredit(licenseLine, t.credits)}</p>
                    </div>
                    <span class="sdd-listen-duration">${durDisplay}</span>
                </article>
            `;
        }).join('');

        const initialVolume = (() => {
            try { const v = parseFloat(localStorage.getItem('saudade.listening.volume')); return Number.isFinite(v) ? v : 0.7; }
            catch (e) { return 0.7; }
        })();

        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'The', ko: '듣는', ja: '聴く',
            pt: 'A', es: 'La'
        });
        const headItalic = T({
            en: 'listening room.', ko: '방.', ja: '部屋。',
            pt: 'sala de escuta.', es: 'sala de escucha.'
        });
        const backLabel = T({
            en: 'BACK TO COVER', ko: '표지로 돌아가기', ja: '表紙へ',
            pt: 'VOLTAR À CAPA', es: 'VOLVER A LA PORTADA'
        });
        const tracksLabel = T({
            en: `${tracks.length} TRACKS`,
            ko: `트랙 ${tracks.length}개`,
            ja: `${tracks.length} トラック`,
            pt: `${tracks.length} FAIXAS`,
            es: `${tracks.length} PISTAS`
        });
        const catsCount = categoriesInOrder.length;
        const categoriesLabel = T({
            en: `${catsCount} CATEGORIES`,
            ko: `카테고리 ${catsCount}개`,
            ja: `${catsCount} カテゴリ`,
            pt: `${catsCount} CATEGORIAS`,
            es: `${catsCount} CATEGORÍAS`
        });
        const libraryLabel = T({
            en: 'ASMR LIBRARY',
            ko: 'ASMR 라이브러리',
            ja: '音の書架',
            pt: 'BIBLIOTECA ASMR',
            es: 'BIBLIOTECA ASMR'
        });

        // v7 검토 정정 — 11 카테고리 anchor nav (가로 스크롤) — category 모드에서만
        const catNavHtml = (effectiveMode === 'category' && categoriesInOrder.length > 1) ? `
            <nav class="sdd-listen-catnav" aria-label="${escapeHtml(T({ en: 'Jump to category', ko: '카테고리로 이동', ja: 'カテゴリーへ移動', pt: 'Saltar para a categoria', es: 'Saltar a la categoría' }))}">
                ${categoriesInOrder.map((cat, idx) => `
                    <button type="button" class="sdd-listen-catnav-link"
                            data-jump-cat="${catSlug(cat)}"
                            aria-current="${idx === 0}">${escapeHtml(cat)}</button>
                `).join('')}
            </nav>
        ` : '';

        // v7 §11 By City — 모드 토글 라벨
        const labelByCity = T({
            en: 'By city', ko: '도시별', ja: '街ごと',
            pt: 'Por cidade', es: 'Por ciudad'
        });
        const labelBrowseAll = T({
            en: 'Browse all tracks', ko: '전체 트랙',
            ja: '全トラック', pt: 'Todas as faixas',
            es: 'Todas las pistas'
        });
        const modeToggleHtml = cityModeAvailable ? `
            <div class="sdd-listen-mode" role="tablist" aria-label="${escapeHtml(T({ en: 'Listening mode', ko: '청취 모드', ja: 'リスニングモード', pt: 'Modo de escuta', es: 'Modo de escucha' }))}">
                <button type="button" class="sdd-listen-mode-btn"
                        data-set-mode="city" role="tab"
                        aria-current="${effectiveMode === 'city'}">${escapeHtml(labelByCity)}</button>
                <span class="sdd-listen-mode-sep" aria-hidden="true">·</span>
                <button type="button" class="sdd-listen-mode-btn"
                        data-set-mode="category" role="tab"
                        aria-current="${effectiveMode === 'category'}">${escapeHtml(labelBrowseAll)}</button>
            </div>
        ` : '';

        // v7 §11 By City — 도시 모드 전용 HTML (사진 + 캡션 + 도시 트랙 + 도시 dropdown)
        let cityModeHtml = '';
        let cityTrackIndices = [];   // tracks 의 원본 인덱스 (playTrack 호환)
        if (effectiveMode === 'city') {
            const activeSlug = resolveActiveCity(data);
            const activeCity = cities.find(c => c.slug === activeSlug) || cities[0];
            const activeName = activeCity?.names?.[(window.SAUDADE_EDITION?.get?.() || 'en')] || activeCity?.slug || '';
            const photoUrl = activeCity?.default_photo_url || '';
            const caption  = activeCity?.photo_caption?.[(window.SAUDADE_EDITION?.get?.() || 'en')] || '';

            // 도시 dropdown — cities 1개면 정적 텍스트, 그 외 details/summary
            const switcherLabel = T({
                en: 'Choose a city', ko: '도시 선택',
                ja: '街を選ぶ', pt: 'Escolher cidade',
                es: 'Elegir ciudad'
            });
            const switcherHtml = cities.length > 1 ? `
                <details class="sdd-listen-city-switcher">
                    <summary aria-label="${escapeHtml(switcherLabel)}">${escapeHtml(activeName)}</summary>
                    <ul class="sdd-listen-city-switcher-list">
                        ${cities.map(c => {
                            const cName = c.names?.[(window.SAUDADE_EDITION?.get?.() || 'en')] || c.slug;
                            return `<li><button type="button" data-set-city="${escapeHtml(c.slug)}" aria-current="${c.slug === activeSlug}">${escapeHtml(cName)}</button></li>`;
                        }).join('')}
                    </ul>
                </details>
            ` : '';

            // 사진 영역 — 4px paper frame + onerror placeholder fallback
            const placeholderText = T({
                en: 'Awaiting photograph.', ko: '사진을 기다리는 중.',
                ja: '写真を準備中。', pt: 'A aguardar fotografia.',
                es: 'Esperando fotografía.'
            });
            const photoHtml = photoUrl ? `
                <figure class="sdd-listen-city-photo">
                    <div class="sdd-listen-city-photo-placeholder" data-city-slug="${escapeHtml(activeSlug)}">
                        <p class="city">${escapeHtml(activeName)}</p>
                        <p class="note">${escapeHtml(placeholderText)}</p>
                    </div>
                    <img class="sdd-listen-city-photo-img"
                         data-sdd-city-photo
                         src="${escapeHtml(photoUrl)}"
                         alt="${escapeHtml(activeName)}"
                         loading="lazy"
                         decoding="async" />
                </figure>
            ` : `
                <figure class="sdd-listen-city-photo">
                    <div class="sdd-listen-city-photo-placeholder" data-city-slug="${escapeHtml(activeSlug)}">
                        <p class="city">${escapeHtml(activeName)}</p>
                        <p class="note">${escapeHtml(placeholderText)}</p>
                    </div>
                </figure>
            `;
            const captionHtml = caption ? `<p class="sdd-listen-city-caption">${escapeHtml(caption)}</p>` : '';

            // 활성 도시 트랙만 필터 + 원본 인덱스 보존 (재생 시 _data.tracks[idx] 참조)
            cityTrackIndices = tracks
                .map((t, i) => ({ t, i }))
                .filter(({ t }) => t.city === activeSlug)
                .map(({ i }) => i);

            const cityTracksHtml = cityTrackIndices.length
                ? cityTrackIndices.map(idx => {
                    const t = tracks[idx];
                    const dur = t.duration_minutes ? `${t.duration_minutes} MIN` : '';
                    const licenseUrl = safeUrl(t.license_url);
                    const licenseLine = licenseUrl
                        ? `<a href="${licenseUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.license || '')}</a>`
                        : escapeHtml(t.license || '');
                    const isUnavail = _unavailable.has(idx);
                    const durDisplay = isUnavail ? '—' : dur;
                    return `
                        <article class="sdd-listen-track${isUnavail ? ' sdd-listen-track-unavail' : ''}"
                                 data-track-idx="${idx}"
                                 tabindex="0" role="button"
                                 ${isUnavail ? 'aria-disabled="true"' : ''}
                                 aria-label="${escapeHtml(activeName)} — ${escapeHtml(t.title)}">
                            <span class="sdd-listen-num"><span class="marker">  </span>${String(idx + 1).padStart(2, '0')}</span>
                            <div class="sdd-listen-body">
                                <p class="sdd-listen-title">${escapeHtml(t.title)}</p>
                                <p class="sdd-listen-license">${shortenCredit(licenseLine, t.credits)}</p>
                            </div>
                            <span class="sdd-listen-duration">${durDisplay}</span>
                        </article>
                    `;
                }).join('')
                : `<p class="sdd-listen-empty">${escapeHtml(T({
                    en: 'No tracks for this city yet.',
                    ko: '이 도시에 등록된 트랙이 아직 없다.',
                    ja: 'この街にはまだ録音がない。',
                    pt: 'Ainda sem faixas para esta cidade.',
                    es: 'Sin pistas para esta ciudad aún.'
                  }))}</p>`;

            cityModeHtml = `
                <div class="sdd-listen-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
                    <h2 class="sdd-listen-h2" style="flex:1 1 auto">
                        ${dropItalicPunct(headLabel)}
                        <span class="it">${dropItalicPunct(headItalic)}</span>
                    </h2>
                    ${switcherHtml}
                </div>
                ${modeToggleHtml}
                ${photoHtml}
                ${captionHtml}
                <div class="sdd-listen-city-tracks">${cityTracksHtml}</div>
            `;
        }

        // 카테고리 모드 HTML — 기존 라이브러리 흐름
        const categoryModeHtml = effectiveMode === 'category' ? `
            <header class="sdd-listen-head">
                <h2 class="sdd-listen-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="it">${dropItalicPunct(headItalic)}</span>
                </h2>
                <p class="sdd-listen-meta">${escapeHtml(libraryLabel)} · ${escapeHtml(tracksLabel)} · ${escapeHtml(categoriesLabel)}</p>
            </header>
            ${modeToggleHtml}
            ${catNavHtml}
            ${tracksHtml}
        ` : '';

        root.innerHTML = `
            <button class="sdd-listen-back" data-listen-back>${escapeHtml(backLabel)}</button>
            ${cityModeHtml}
            ${categoryModeHtml}
            <footer class="sdd-listen-foot">
                <p>
                    <strong>${escapeHtml(T({ en: 'A note on sound.', ko: '소리에 대한 메모.', ja: '音についての覚書。', pt: 'Uma nota sobre o som.', es: 'Una nota sobre el sonido.' }))}</strong>
                    ${escapeHtml(T({
                        en: 'Each track is recorded in person or licensed under Creative Commons from Freesound.org. No music. No conversation. The full license list is on the credits page.',
                        ko: '모든 트랙은 직접 녹음했거나 Freesound.org 의 크리에이티브 커먼즈 라이선스로 받았다. 음악 없음. 대화 없음. 전체 라이선스 목록은 크레딧 페이지에 있다.',
                        ja: '全トラックは自ら録音したか、Freesound.org のクリエイティブ・コモンズ・ライセンスで取得した。音楽なし。会話なし。ライセンス一覧はクレジットページに。',
                        pt: 'Cada faixa é gravada pessoalmente ou licenciada sob Creative Commons em Freesound.org. Sem música. Sem conversa. A lista completa de licenças está na página de créditos.',
                        es: 'Cada pista se graba en persona o se obtiene bajo Creative Commons en Freesound.org. Sin música. Sin conversación. La lista completa de licencias está en la página de créditos.'
                    }))}
                </p>
            </footer>
            <!-- 컨트롤 바 — 직선 + 점만 (헌법 §5.5 둥근 버튼 X) + v6 §11.2 work session timer -->
            <div class="sdd-listen-controls">
                <button class="sdd-listen-ctl" data-listen-play aria-pressed="false">${escapeHtml(T({ en: 'PLAY', ko: '재생', ja: '再生', pt: 'TOCAR', es: 'TOCAR' }))}</button>
                <span class="sdd-listen-ctl-sep">·</span>
                <label class="sdd-listen-vol-label" for="sddListenVol">${escapeHtml(T({ en: 'VOL', ko: '볼륨', ja: '音量', pt: 'VOL', es: 'VOL' }))}</label>
                <input type="range" id="sddListenVol" class="sdd-listen-vol"
                       min="0" max="1" step="0.05" value="${initialVolume}"
                       aria-label="${escapeHtml(T({ en: 'Volume', ko: '볼륨', ja: '音量', pt: 'Volume', es: 'Volumen' }))}" />
                <span class="sdd-listen-vol-num" data-vol-num>${Math.round(initialVolume * 100)}</span>
                <span class="sdd-listen-ctl-sep">·</span>
                <span class="sdd-listen-session-state" data-session-state></span>
            </div>
            <!-- 사용자만 보이는 sessions today 카운터 (공유 X — 헌법 §11.2) -->
            <p class="sdd-listen-session-counter" data-session-counter></p>
        `;

        root.querySelector('[data-listen-back]')?.addEventListener('click', () => close());

        // City photo fade-in. Used to be set via inline onload="…" on the
        // <img> tag, but the page CSP (script-src 'self' https:, no
        // 'unsafe-inline') blocks inline event handlers — the photo loaded
        // but the .is-loaded class was never added, so it stayed at
        // opacity: 0 forever. Bind properly here instead.
        root.querySelectorAll('img[data-sdd-city-photo]').forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('is-loaded');
            } else {
                img.addEventListener('load',  () => img.classList.add('is-loaded'));
                img.addEventListener('error', () => img.remove());
            }
        });

        // v7 §11 By City — 모드 토글 + 도시 전환
        root.querySelectorAll('[data-set-mode]').forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.getAttribute('data-set-mode')));
        });
        root.querySelectorAll('[data-set-city]').forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveCity(btn.getAttribute('data-set-city'));
                // dropdown 닫기
                const det = btn.closest('details');
                if (det) det.removeAttribute('open');
            });
        });

        // v7 검토 정정 — 카테고리 anchor 점프
        root.querySelectorAll('[data-jump-cat]').forEach(link => {
            link.addEventListener('click', () => {
                const id = link.getAttribute('data-jump-cat');
                const target = id && root.querySelector('#' + CSS.escape(id));
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                root.querySelectorAll('[data-jump-cat]').forEach(l => l.setAttribute('aria-current', 'false'));
                link.setAttribute('aria-current', 'true');
            });
        });

        // 트랙 클릭 = 재생 시작
        root.querySelectorAll('[data-track-idx]').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-track-idx'), 10);
                playTrack(idx);
            });
        });

        // PLAY/PAUSE 토글
        root.querySelector('[data-listen-play]')?.addEventListener('click', () => {
            if (!_audio || !_audio.src) {
                // 트랙 0번 자동 재생
                playTrack(_activeIdx != null ? _activeIdx : 0);
            } else if (_isPlaying) {
                pauseAudio();
            } else {
                resumeAudio();
            }
        });

        // 볼륨 컨트롤
        const volEl = root.querySelector('#sddListenVol');
        const volNumEl = root.querySelector('[data-vol-num]');
        volEl?.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value) || 0;
            const a = ensureAudio();
            a.volume = v;
            if (volNumEl) volNumEl.textContent = String(Math.round(v * 100));
            try { localStorage.setItem('saudade.listening.volume', String(v)); } catch (err) {}
        });

        // 저장된 위치 복원
        try {
            const pos = JSON.parse(localStorage.getItem('saudade.reading.position') || '{}');
            if (Number.isFinite(pos.idx) && pos.idx < tracks.length) {
                _activeIdx = pos.idx;
                const target = root.querySelector(`[data-track-idx="${pos.idx}"]`);
                if (target) target.setAttribute('aria-current', 'true');
            }
        } catch (e) {}
    }

    const CTA_LABEL = {
        en: 'LISTENING ROOM',
        ko: '청취실',
        ja: 'リスニングルーム',
        pt: 'SALA DE ESCUTA',
        es: 'SALA DE ESCUCHA'
    };

    function ensureCoverCTA() {
        if (document.getElementById('sddCoverListenCta')) return;
        const ed = (window.state && window.state.lang) || 'en';
        const btn = document.createElement('button');
        btn.id = 'sddCoverListenCta';
        btn.className = 'sdd-cover-listen-cta';
        btn.type = 'button';
        btn.textContent = CTA_LABEL[ed] || CTA_LABEL.en;
        btn.addEventListener('click', () => open());
        document.body.appendChild(btn);
    }

    function open() {
        document.body.classList.remove('section-active', 'colophon-active');
        document.body.removeAttribute('data-section');
        document.body.classList.add('listening-active');
        try { localStorage.setItem('saudade.last.screen', 'listening'); } catch (e) {}
    }
    function close() {
        document.body.classList.remove('listening-active');
        try { localStorage.setItem('saudade.last.screen', 'cover'); } catch (e) {}
    }

    function watchEsc() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('listening-active')) {
                close();
            }
        });
    }

    function init() {
        injectStyles();
        ensureCoverCTA();
        load().then(render);
        watchEsc();
        // v7 §6 — � 05 dock 버튼 (5탭). cover CTA 와 병행.
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.dock-btn[data-cat="listen"]');
            if (btn) { e.preventDefault(); open(); }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_LISTENING = { open, close, render, reload: () => { _data = null; init(); } };
})();
