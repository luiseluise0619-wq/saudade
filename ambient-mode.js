// AURA — AMBIENT MODE (감성 중심 글로벌 앰비언트 모드)
'use strict';
(function() {

    const STORAGE = {
        MODE: 'aura_mode_v1',
        SOUND_ON: 'aura_sound_on',
        VOLUME: 'aura_volume',
        FAVORITES: 'aura_fav_cities',
        LAST_CITY: 'aura_last_city'
    };

    const state = {
        mode: 'ambient',  // ambient | insight
        currentCity: null,
        soundOn: true,    // 사용자 요청: 도시 클릭 시 음악 자동 재생 (default ON)
        volume: 0.5,
        favorites: [],
        videoPlayer: null,
        soundPlayer: null
    };

    // ─── 저장/복원 ───
    function load() {
        try {
            state.mode = localStorage.getItem(STORAGE.MODE) || 'ambient';
            state.soundOn = localStorage.getItem(STORAGE.SOUND_ON) === '1';
            state.volume = parseFloat(localStorage.getItem(STORAGE.VOLUME)) || 0.5;
            state.favorites = JSON.parse(localStorage.getItem(STORAGE.FAVORITES) || '[]');
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    }
    function save() {
        try {
            localStorage.setItem(STORAGE.MODE, state.mode);
            localStorage.setItem(STORAGE.SOUND_ON, state.soundOn ? '1' : '0');
            localStorage.setItem(STORAGE.VOLUME, String(state.volume));
            localStorage.setItem(STORAGE.FAVORITES, JSON.stringify(state.favorites));
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
    }

    // ─── GA Tracking ───
    function track(event, params = {}) {
        if (window.AURA_GA) window.AURA_GA.track(event, params);
    }

    // ─── 스타일 ───
    function injectStyles() {
        if (document.getElementById('ambientStyles')) return;
        const s = document.createElement('style');
        s.id = 'ambientStyles';
        s.textContent = `
/* ─── Mode toggle (top right) ─── */
.amb-mode-toggle {
    display: none !important;  /* 카페 모드 통합 - 토글 제거 */
}
.amb-mode-btn {
    padding: 7px 16px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: rgba(255,255,255,.6);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: all .2s;
}
.amb-mode-btn.active {
    background: rgba(255,255,255,.95);
    color: #0a0e14;
}

/* ─── City experience overlay (when city is selected) ─── */
.amb-city-panel {
    position: fixed;
    bottom: 80px;  /* dock 위 */
    left: 0;
    width: min(420px, 60vw);
    z-index: 50;
    padding: 18px 20px;
    background: linear-gradient(0deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 70%, rgba(0,0,0,0) 100%);
    color: #fff;
    transform: translateY(100%);
    transition: transform .5s cubic-bezier(.4,0,.2,1);
    pointer-events: none;
    border-radius: 0 14px 0 0;
}
@media (max-width: 700px) {
    .amb-city-panel {
        width: 100vw;
        bottom: 80px;
    }
}
.amb-city-panel.active {
    transform: translateY(0);
    pointer-events: auto;
}
.amb-city-name {
    font-family: var(--font-display, 'Orbitron', sans-serif);
    font-size: clamp(28px, 5vw, 52px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-shadow: 0 4px 24px rgba(0,0,0,.8);
    margin-bottom: 4px;
}
.amb-city-status {
    font-family: var(--font-body, sans-serif);
    font-size: 14px;
    color: rgba(255,255,255,.7);
    letter-spacing: 0.02em;
    margin-bottom: 14px;
}
.amb-city-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}
.amb-ctrl-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(255,255,255,.1);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 999px;
    color: #fff;
    font-family: var(--font-ui, sans-serif);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: all .2s;
}
.amb-ctrl-btn:hover {
    background: rgba(255,255,255,.18);
}
.amb-ctrl-btn.on {
    background: rgba(74,222,128,.2);
    border-color: rgba(74,222,128,.5);
}
.amb-volume-slider {
    -webkit-appearance: none;
    width: 100px;
    height: 4px;
    background: rgba(255,255,255,.2);
    border-radius: 999px;
    outline: none;
}
.amb-volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
}
.amb-close {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0,0,0,.6);
    border: 1px solid rgba(255,255,255,.2);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    backdrop-filter: blur(8px);
}
.amb-close:hover { background: rgba(0,0,0,.85); }

/* ─── 도시 뷰 컨테이너 — 풀스크린 (사용자 요청: 우하단 작은 창 없애기) ─── */
.amb-video-container {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    z-index: 95;          /* topbar / dock 보다 아래 → 컨트롤 가능 */
    pointer-events: auto;
    opacity: 0;
    transition: opacity .5s ease;
    border: none;
    border-radius: 0;
    background: #000;
}
.amb-video-container.show {
    opacity: 1;
}
.amb-video-container iframe,
.amb-video-container video {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
    object-fit: cover;
}
@media (max-width: 700px) {
    .amb-video-container { inset: 0; }
}

/* ─── AMBIENT 모드: 좌측 drawer만 숨김 (우측 뉴스 패널은 살림 — 사용자 요청) ─── */
body.ambient-mode .left-drawer,
body.ambient-mode #signalsBoard {
    display: none !important;
}
body.ambient-mode .scene { padding: 0; }

/* ─── 도시 영상 재생 중: 모든 floating UI 페이드 아웃 (사용자 요청) ─── */
/*    상단 검색창 / 우상단 fav widget / 우하단 SC 박스까지 전부 숨김.    */
/*    화면 아래 80px 안으로 마우스 들어오면 도크 + 음악 컨트롤만 다시 표시 */
body.amb-has-video .bottom-dock,
body.amb-has-video .news-top-toggle,
body.amb-has-video .control-bar,
body.amb-has-video .topbar,
body.amb-has-video .stage-footer,
body.amb-has-video #musicControl,
body.amb-has-video #scPlayerContainer,
body.amb-has-video .sc-player-container,
body.amb-has-video .fav-widget,
body.amb-has-video .mlp,
body.amb-has-video .mlp-toggle-btn,
body.amb-has-video .amb-cat,
body.amb-has-video #ambCat {
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity .35s ease;
}
/* 도시 영상 재생 중엔 카페 모드 토글까지 가도 고양이 박스 안 뜸 (사용자 보고: SVG 고양이 빈 박스) */
body.amb-has-video.cafe-mode .amb-cat,
body.amb-has-video.cafe-mode #ambCat {
    display: none !important;
}
/* 사용자 보고: "맨 아래 호버도 영상중에는 안나오게" — amb-near-bottom override 폐기 */
body.amb-has-video.amb-near-bottom .topbar {
    opacity: .7 !important;
    pointer-events: auto !important;
}

/* dock는 무조건 보여야 함 (ambient + insight 모두) */
.bottom-dock {
    z-index: 100 !important;
    display: block !important;
}
body.ambient-mode .bottom-dock {
    z-index: 100 !important;
    display: block !important;
}
body.ambient-mode .dock-stats {
    display: grid !important;
}

/* INSIGHT 모드: 5개만 노출 (signals top bar) */
.amb-insights {
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(15,18,22,.9);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    backdrop-filter: blur(14px);
    max-width: 90vw;
    overflow-x: auto;
    scrollbar-width: none;
    pointer-events: none;
    opacity: 0;
    transition: opacity .3s;
}
body.insight-mode .amb-insights { opacity: 1; pointer-events: auto; }
body.ambient-mode .amb-insights { display: none; }
.amb-insights::-webkit-scrollbar { display: none; }
.amb-signal {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 11px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 8px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: #fff;
    flex-shrink: 0;
    cursor: pointer;
    transition: background .15s;
}
.amb-signal:hover { background: rgba(255,255,255,.12); }
.amb-signal-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* ─── Favorites bar (top center) ─── */
.amb-favs {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    display: flex;
    gap: 6px;
    pointer-events: auto;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 60vw;
}
body.insight-mode .amb-favs { display: none; }
body.ambient-mode .amb-favs { display: flex; }
.amb-fav-chip {
    padding: 6px 12px;
    background: rgba(15,18,22,.85);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 999px;
    color: #fff;
    font-family: var(--font-ui, sans-serif);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: all .15s;
}
.amb-fav-chip:hover {
    background: rgba(255,255,255,.12);
    border-color: rgba(255,255,255,.3);
}

@media (max-width: 700px) {
    .amb-mode-toggle { top: 10px; right: 10px; }
    .amb-city-panel { padding: 16px; }
    .amb-city-name { font-size: 28px; }
    .amb-favs { top: 70px; }
}
        `;
        document.head.appendChild(s);
    }

    // ─── Mode toggle UI ───
    function buildModeToggle() {
        const wrap = document.createElement('div');
        wrap.className = 'amb-mode-toggle';
        wrap.id = 'ambModeToggle';

        ['ambient', 'insight'].forEach(m => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'amb-mode-btn' + (state.mode === m ? ' active' : '');
            btn.textContent = m.toUpperCase();
            btn.dataset.mode = m;
            btn.addEventListener('click', () => setMode(m));
            wrap.appendChild(btn);
        });

        document.body.appendChild(wrap);
    }

    function setMode(mode) {
        state.mode = mode;
        document.body.classList.toggle('ambient-mode', mode === 'ambient');
        document.body.classList.toggle('insight-mode', mode === 'insight');
        document.querySelectorAll('.amb-mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        save();
        track('mode_change', { mode });

        // 지구본 자동회전 - ambient에선 ON
        if (window.globeInstance) {
            try {
                window.globeInstance.controls().autoRotate = (mode === 'ambient');
                window.globeInstance.controls().autoRotateSpeed = 0.4;
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }
    }

    // ─── Video container ───
    function ensureVideoContainer() {
        let v = document.getElementById('ambVideoContainer');
        if (v) {
            // 이전에 stopVideo로 숨겨진 경우 복원
            v.style.display = '';
            v.style.pointerEvents = '';
            return v;
        }
        v = document.createElement('div');
        v.id = 'ambVideoContainer';
        v.className = 'amb-video-container';

        // 카페모드(확대) 버튼 — 가장 위 가장자리 (사용자 요청: "아예 위로")
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.id = 'ambVideoExpand';
        expand.title = '카페 모드 (전체화면)';
        expand.textContent = '⛶';
        expand.style.cssText = 'position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.3);color:#fff;cursor:pointer;font-size:16px;z-index:11;backdrop-filter:blur(8px);box-shadow:0 4px 16px rgba(0,0,0,.6)';
        expand.addEventListener('click', () => {
            if (window.AURA_CAFE?.toggle) window.AURA_CAFE.toggle();
        });
        v.appendChild(expand);

        // 다음 장면 버튼 — 사용자가 한 영상에 갇혀 있으면 손으로 넘기게
        const skip = document.createElement('button');
        skip.type = 'button';
        skip.id = 'ambVideoSkip';
        skip.title = '다음 장면';
        skip.textContent = '⏭';
        skip.style.cssText = 'position:absolute;bottom:12px;left:12px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.85);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;font-size:14px;z-index:10;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.5)';
        skip.addEventListener('click', () => {
            if (typeof window.AURA_VIDEO_SKIP === 'function') window.AURA_VIDEO_SKIP();
        });
        v.appendChild(skip);

        // 닫기 버튼 — 아래 (확대 버튼과 분리해서 잘못 클릭 방지)
        const x = document.createElement('button');
        x.type = 'button';
        x.id = 'ambVideoClose';
        x.textContent = '✕';
        x.style.cssText = 'position:absolute;bottom:12px;right:12px;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.85);border:1px solid rgba(255,255,255,.2);color:#fff;cursor:pointer;font-size:13px;z-index:10;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.5)';
        x.addEventListener('click', () => {
            stopVideo();
            stopSound();
            // 카페 모드 active면 같이 disable (사용자: ✕ 눌렀는데 풀화면 유지되는 문제)
            if (window.AURA_CAFE?.isActive?.()) window.AURA_CAFE.disable();
        });
        v.appendChild(x);

        document.body.appendChild(v);
        return v;
    }

    // YouTube oEmbed로 영상 임베드 가능 여부 사전 검증 (Error 153 사전 차단)
    // ─── 검증된 안전 영상 ID 화이트리스트 ───
    // 이 영상들은 임베드 허용된 24/7 라이브 채널. 절대 안 막힘.
    const SAFE_VIDEO_IDS = new Set([
        'jfKfPfyJRdk',  // Lofi Girl - Beats to Relax (가장 안정적)
        '4xDzrJKXOOY',  // Synthwave Radio - 24/7
        'rUxyKA_-grg',  // Chillhop Radio - 24/7
        'DWcJFNfaw9c',  // Lofi Hip Hop Radio - 24/7
        'MVPTGNGiI-4',  // Coffee Shop Music - 24/7
        '28KRPhVzCus'   // Bossa Nova Cafe - 24/7
    ]);

    // 도시 태그 → 안전 YouTube 라디오 (검증된 6개 ID + 새 태그 폴백)
    // 사용자 보고: 음악 버그 → unverified ID 제거, 검증된 것만 분위기 매칭
    function getSafeVideoForTag(tag) {
        const map = {
            'kpop':       'jfKfPfyJRdk',  // Lofi Girl
            'lofi':       'jfKfPfyJRdk',
            'jazz':       '28KRPhVzCus',  // Bossa Nova / Jazz Cafe
            'electronic': '4xDzrJKXOOY',  // Synthwave
            'hiphop':     'DWcJFNfaw9c',  // Lofi Hip Hop
            'chill':      'rUxyKA_-grg',
            'cinematic':  'MVPTGNGiI-4',  // Coffee Shop
            'samba':      '28KRPhVzCus',
            'tango':      '28KRPhVzCus',
            'tropical':   'rUxyKA_-grg',
            'thai-pop':   'jfKfPfyJRdk',
            'bollywood':  '4xDzrJKXOOY',
            'ambient':    'rUxyKA_-grg',
            // 새 태그 (city-videos.js v7+)
            'cityPop':    '4xDzrJKXOOY',
            'classical':  'jfKfPfyJRdk',
            'latin':      '28KRPhVzCus'
        };
        return map[tag] || 'jfKfPfyJRdk';  // 디폴트: Lofi Girl (가장 안정)
    }

    // ─── Play YouTube video - 검증된 ID만 사용해 Error 153 100% 차단 ───
    // 알려진 invalid SoundCloud URL 패턴 — 사용자 description의 "fake URL" 케이스
    function isInvalidScUrl(u) {
        return !u || /soundcloud\.com\/lofi-girl\/sets\//.test(u);
    }

    // ─── playVideo: 그라디언트+도시명 베이스 + Pexels 영상 + 음악 즉시 재생 (사용자: 노래 바로바로) ───
    function playVideo(videos, idx) {
        let gifUrl = null;
        if (Array.isArray(videos) && videos[0]) {
            gifUrl = videos[0].gif || videos[0].gifUrl;
        }
        showCityGif(gifUrl || 'about:blank');

        // 음악 즉시 재생 — 도시 분위기 태그 → 검증된 YouTube radio
        // (사용자 요청: 노래 바로바로 나오게끔)
        if (state.soundOn) {
            try {
                const c = window.AURA_CITY_VIDEOS?.getCity?.(state.currentCity);
                const ytId = getSafeVideoForTag(c?.tag);
                if (ytId) playSound(ytId);
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }

        document.body.classList.add('amb-has-video');
        track('city_view', { city: state.currentCity || 'unknown' });
    }

    // 도시별 분위기 색상 (그라디언트 베이스)
    const CITY_TINT = {
        'Seoul':'#ff5d50', 'Tokyo':'#a855f7', 'New York':'#3b82f6', 'London':'#64748b',
        'Paris':'#f59e0b', 'Hong Kong':'#ef4444', 'Singapore':'#10b981', 'Bangkok':'#f97316',
        'Dubai':'#eab308', 'Sydney':'#06b6d4', 'Los Angeles':'#ec4899', 'San Francisco':'#f43f5e',
        'Berlin':'#6366f1', 'Rome':'#dc2626', 'Bali':'#14b8a6', 'Mumbai':'#f97316',
        'Mexico City':'#84cc16', 'Rio de Janeiro':'#22c55e', 'Buenos Aires':'#0ea5e9', 'Cape Town':'#8b5cf6'
    };

    // 풀스크린 도시 뷰 — 항상 보이는 그라디언트 + 도시명 베이스 위에 GIF/영상 오버레이
    function showCityGif(gifUrl) {
        const c = ensureVideoContainer();
        const closeBtn = c.querySelector('#ambVideoClose');
        const expandBtn = c.querySelector('#ambVideoExpand');
        const skipBtn = c.querySelector('#ambVideoSkip');
        while (c.firstChild) c.removeChild(c.firstChild);
        if (expandBtn) c.appendChild(expandBtn);
        if (skipBtn) c.appendChild(skipBtn);
        if (closeBtn) c.appendChild(closeBtn);

        const cityInfo = window.AURA_CITY_VIDEOS?.getCity?.(state.currentCity);
        const isKo = window.state?.lang === 'ko';
        const cityName = state.currentCity ? (isKo ? (cityInfo?.ko || state.currentCity) : state.currentCity) : '—';
        const cityStatus = cityInfo ? (isKo ? cityInfo.status?.ko : cityInfo.status?.en) : '';
        const tint = CITY_TINT[state.currentCity] || '#ff5d50';

        // 1) 베이스 그라디언트 + 도시명 — wrap을 부모 강제 채움 (사용자: "걍 시꺼멈")
        // position: absolute + inset:0 으로 부모 사이즈 무관 항상 채움
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            position:absolute;inset:0;
            display:flex;align-items:flex-end;justify-content:flex-start;
            overflow:hidden;
            background:
                radial-gradient(ellipse at 30% 20%, ${tint}cc, transparent 65%),
                radial-gradient(ellipse at 75% 80%, ${tint}88, transparent 55%),
                linear-gradient(135deg, ${tint}55 0%, #1a0f1f 70%, #050608 100%);
        `;

        // 도시명 라벨 (좌하단 큰 글씨) — 더 큼, 항상 잘 보이게
        const label = document.createElement('div');
        label.style.cssText = `
            position:absolute; bottom:24px; left:24px; z-index:3;
            color:#fff;
            text-shadow: 0 2px 14px rgba(0,0,0,.8), 0 0 30px ${tint};
            font-family: var(--font-display,'Orbitron',sans-serif);
            pointer-events:none;
        `;
        label.innerHTML = `
            <div style="font-size:54px;font-weight:800;letter-spacing:.02em;line-height:1.0;color:#fff">${cityName}</div>
            <div style="font-size:14px;margin-top:8px;opacity:.95;font-family:var(--font-mono);letter-spacing:.12em;color:${tint};font-weight:700">${cityStatus}</div>
        `;
        wrap.appendChild(label);

        // 화면 우상단 작은 디버그 status (사용자가 무슨 일 일어나는지 바로 보이게)
        const status = document.createElement('div');
        status.id = 'cafeVideoStatus';
        status.style.cssText = `
            position:absolute; top:10px; left:10px; z-index:4;
            font-family: var(--font-mono,monospace); font-size:10px;
            color: rgba(255,255,255,.7); background: rgba(0,0,0,.55);
            padding: 5px 9px; border-radius: 6px; backdrop-filter: blur(6px);
            pointer-events: none;
        `;
        status.textContent = '🎬 Loading...';
        wrap.appendChild(status);
        function setStatus(txt, color) {
            status.textContent = txt;
            if (color) status.style.color = color;
        }

        // ─── 사용자 요청: 영상 기다리는 시간 → Wikipedia 도시 사진 즉시 표시 ───
        // Wikipedia REST API 는 키 불필요. 영상이 로드되면 fade-out.
        const poster = document.createElement('img');
        poster.alt = state.currentCity || '';
        poster.style.cssText = `
            position:absolute;inset:0;width:100%;height:100%;
            object-fit:cover;z-index:0;
            opacity:0;transition:opacity .6s ease;
            filter:brightness(.78) saturate(1.05);
        `;
        wrap.appendChild(poster);
        // ─── 사용자 요청: 영상 로딩 전 사진은 도시뷰만 (국기/땅 X) ───
        // 1순위: Pexels Photo API "city cityscape" — 100% 도시뷰
        // 2순위: Wikipedia 메인 이미지 (가끔 국기/지도/인물 나옴 — 그래서 후순위)
        // 3순위: 그라디언트 폴백 (지금 wrap에 깔린 색)
        (async () => {
            const cacheKey = `city_poster:${state.currentCity}`;
            let url = sessionStorage.getItem(cacheKey);
            // 이전 세션에서 wikipedia/wikimedia URL 이 캐시됐으면 폐기 (사용자 정책 변경)
            if (url && (/wikipedia\.org/.test(url) || /wikimedia\.org/.test(url))) {
                try { sessionStorage.removeItem(cacheKey); } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
                url = null;
            }
            if (!url) {
                // ── Pexels Photo (이미지 검색) ──
                const pexKey = (() => {
                    try { return localStorage.getItem('aura_pexels_key') || window.AURA_PEXELS_KEY || ''; }
                    catch { return ''; }
                })();
                const proxy = (typeof window.AURA_SERVER === 'string' && window.AURA_SERVER) ? window.AURA_SERVER : '';
                async function fetchPexelsPhoto() {
                    try {
                        const q = encodeURIComponent(state.currentCity + ' cityscape');
                        let res;
                        if (pexKey) {
                            res = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=10&orientation=landscape`,
                                              { headers: { Authorization: pexKey } });
                        } else if (proxy) {
                            // Worker는 아직 photo endpoint 없음 → 일단 키 있을 때만 photo, 없으면 Wikipedia
                            return null;
                        } else { return null; }
                        if (!res.ok) return null;
                        const data = await res.json();
                        const photos = data?.photos || [];
                        if (!photos.length) return null;
                        const pick = photos[Math.floor(Math.random() * Math.min(5, photos.length))];
                        return pick?.src?.large2x || pick?.src?.large || pick?.src?.original;
                    } catch (e) { return null; }
                }
                url = await fetchPexelsPhoto();

                // Wikipedia 폴백 제거 — 사용자 요청 (국기/지도/인물/SVG 노출 위험으로 정책상 X).
                // → Pexels 사진이 없으면 그라디언트 배경 그대로 둠 (영상 로드되면 어차피 덮음).

                if (url) try { sessionStorage.setItem(cacheKey, url); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
            }
            if (url) {
                poster.src = url;
                poster.onload = () => { poster.style.opacity = '1'; };
                poster.onerror = () => { try { sessionStorage.removeItem(cacheKey); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); } };
            }
        })();

        // ─── 사용자 요청: "잘못된 도시?" 신고 버튼 → localStorage 블록리스트 ───
        const reportBtn = document.createElement('button');
        reportBtn.type = 'button';
        reportBtn.id = 'cafeReportWrongCity';
        reportBtn.title = isKo ? '이 영상이 이 도시 아님' : 'This video isn\'t this city';
        reportBtn.style.cssText = `
            position:absolute;top:10px;right:108px;z-index:4;
            padding:5px 10px;border-radius:6px;
            background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);
            color:rgba(255,255,255,.75);font-family:var(--font-mono,monospace);font-size:10px;
            cursor:pointer;backdrop-filter:blur(6px);
            transition:background .15s,color .15s;
        `;
        reportBtn.innerHTML = isKo ? '⚠️ 잘못된 도시?' : '⚠️ Wrong city?';
        reportBtn.addEventListener('mouseenter', () => { reportBtn.style.background = 'rgba(252,165,165,.3)'; reportBtn.style.color = '#fff'; });
        reportBtn.addEventListener('mouseleave', () => { reportBtn.style.background = 'rgba(0,0,0,.55)'; reportBtn.style.color = 'rgba(255,255,255,.75)'; });
        reportBtn.addEventListener('click', () => reportCurrentVideo());
        wrap.appendChild(reportBtn);

        // Pixabay 풀 제거 — 운영자 키 없음 (사용자 요청). 추후 키 발급되면 git history 에서 복원.

        // ─── Coverr 폴백 (시네마틱 무료) ───
        // 우선순위:
        //   1. window.AURA_SERVER 의 /coverr-videos 프록시 (운영자 키, 키 노출 X, IP rate-limit)
        //   2. 사용자가 자기 키 입력했으면 client 직접 호출 (개발자 모드)
        //   3. 둘 다 없으면 skip
        async function fetchCoverrFallback(city) {
            const proxy = (typeof window.AURA_SERVER === 'string' && window.AURA_SERVER) ? window.AURA_SERVER : '';
            const userKey = (() => {
                try { return localStorage.getItem('aura_coverr_key') || window.AURA_COVERR_KEY || ''; }
                catch { return ''; }
            })();
            if (!proxy && !userKey) return [];

            // 도시뷰 전용 (night/bare city 제거 — 사용자 요청)
            const queries = [
                city + ' aerial', city + ' skyline',
                city + ' cityscape', city + ' drone'
            ];
            const all = [];
            await Promise.all(queries.map(async q => {
                try {
                    let url, init = {};
                    if (proxy) {
                        // 운영자 worker 프록시 (키 server-side, IP rate-limit, 캐시)
                        url = `${proxy}/coverr-videos?q=${encodeURIComponent(q)}`;
                    } else {
                        // 사용자 본인 키 직접 (개발/디버그용)
                        url = `https://api.coverr.co/videos?query=${encodeURIComponent(q)}&page_size=20&urls=true`;
                        init = { headers: { 'Authorization': `Bearer ${userKey}` } };
                    }
                    const r = await fetch(url, init);
                    if (!r.ok) return;
                    const data = await r.json();
                    (data?.hits || []).forEach(h => {
                        const u = h?.urls?.mp4 || h?.urls?.poster_video;
                        if (u && typeof u === 'string') all.push(u);
                    });
                } catch (e) { window.AURA?.dbgWarn?.('coverr fetch ' + q, e); }
            }));
            const uniq = Array.from(new Set(all));
            return uniq.sort(() => Math.random() - 0.5).slice(0, 200);
        }

        // Wikimedia Commons 풀 제거 — 사용자 요청 (저화질·5~30개 위주, 정리).

        // 2) Pexels 영상 직접 시도 — 여러 영상 회전 + UHD/HD 우선화질
        async function tryPexelsVideo() {
            if (!state.currentCity) {
                setStatus('⚠ no city', 'rgba(255,180,80,.95)');
                return false;
            }
            const key = (() => {
                try { return localStorage.getItem('aura_pexels_key') || window.AURA_PEXELS_KEY || ''; }
                catch { return ''; }
            })();
            const hasOwnKey = !!(key && key.length >= 20);
            const proxyBase = (typeof window.AURA_SERVER === 'string' && window.AURA_SERVER) ? window.AURA_SERVER : '';
            if (!hasOwnKey && !proxyBase) {
                setStatus('🔑 Pexels 키 없음 — 음악 컨트롤에서 설정', 'rgba(252,165,165,.95)');
                return false;
            }

            // 도시별 캐시 — 여러 영상 링크를 배열로 저장 (한 영상 반복 X)
            // v5: 24개 쿼리 + 페이지네이션 확대 + 500cap. 구버전 키는 일괄 삭제
            const CACHE_KEY = 'aura_pexels_cache_v5';
            const TTL = 24 * 60 * 60 * 1000;
            try {
                ['v1', 'v2', 'v3', 'v4'].forEach(v => localStorage.removeItem('aura_pexels_cache_' + v));
            } catch (e) { window.AURA?.dbgWarn?.('cache prune', e); }
            let cache = {};
            try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
            let videoLinks = [];

            // 자체 호스팅 클립 우선 (city-videos.js 에 selfHosted 배열 있으면)
            // 사용자 요청: "내가 다운받아서 파일에 넣는게 나을지" → 인기 도시는 자체 호스팅 추천
            const cityData = window.AURA_CITY_VIDEOS?.getCity?.(state.currentCity);
            const selfHosted = Array.isArray(cityData?.selfHosted) ? cityData.selfHosted : [];

            const cached = cache[state.currentCity];
            if (cached && (Date.now() - cached.ts) < TTL && Array.isArray(cached.links) && cached.links.length) {
                // selfHosted 가 새로 추가된 경우 캐시 앞에 끼움
                videoLinks = selfHosted.concat(cached.links.filter(l => !selfHosted.includes(l)));
            } else if (selfHosted.length >= 5 && !hasOwnKey && !proxyBase) {
                // 자체 호스팅만 있어도 충분 (Pexels 키/Worker 없을 때)
                videoLinks = selfHosted.slice();
            } else {
                setStatus(hasOwnKey ? '🌐 Fetching 1h pool...' : '🌐 Fetching via proxy...', 'rgba(160,200,255,.9)');
                // 본인 키 있으면 Pexels 직접 호출, 없으면 Cloudflare Worker 프록시 경유
                // (프록시는 KV로 24h 캐시 → 같은 도시는 다른 사용자도 0req로 응답)
                async function fetchOne(query, page = 1) {
                    try {
                        const q = encodeURIComponent(query);
                        if (hasOwnKey) {
                            const url = `https://api.pexels.com/videos/search?query=${q}&per_page=80&orientation=landscape&size=large&page=${page}`;
                            const res = await fetch(url, { headers: { Authorization: key } });
                            if (!res.ok) return [];
                            const data = await res.json();
                            return data?.videos || [];
                        }
                        // Worker 프록시 (키 보호 + 공유 캐시)
                        const url = `${proxyBase}/pexels-videos?q=${q}&page=${page}&city=${encodeURIComponent(state.currentCity || '')}`;
                        const res = await fetch(url);
                        if (!res.ok) return [];
                        const data = await res.json();
                        return data?.videos || [];
                    } catch { return []; }
                }

                // 사용자 보고: "도로뷰" 같은 대시캠/차량 POV 영상이 자주 섞임 → URL/유저명에서 제외
                // 도시뷰 외 콘텐츠 차단 — 사용자 요청 "영상들 다시 재검토 도시뷰 말고 이상한거".
                // 카테고리:
                //   1) 차량 POV / 운전
                //   2) 음식·요리·식당 인테리어
                //   3) 인물 클로즈업·portrait·패션
                //   4) 공연·콘서트·댄스·결혼식
                //   5) 운동·요가·gym 인테리어
                //   6) 반려동물·야생동물
                //   7) 의료·임상
                //   8) 자연 풍경 (숲·해변·산만 — 도시뷰 아님)
                //   9) 일상 활동 (요리·청소·쇼핑·놀이)
                //  10) 종교 의례·기도·기념식
                const ROAD_BLOCKLIST = [
                    // 1) 차량 POV
                    'dashcam', 'dash-cam', 'dashboard', 'driving', 'car-pov', 'pov-car', 'first-person',
                    'highway-pov', 'windshield', 'windscreen', 'wiper',
                    'inside-car', 'in-car', 'car-interior',
                    'pov-driving', 'road-trip', 'on-the-road', 'truck-pov', 'biker-pov',
                    // 2) 음식 / 식당
                    'food', 'cooking', 'kitchen', 'restaurant-interior', 'cafe-interior',
                    'plate', 'meal', 'sushi-platter', 'pasta-cooking', 'eating',
                    'serving', 'chef', 'barista', 'pour-coffee', 'stir-fry', 'noodles-bowl',
                    // 3) 인물 / 패션
                    'portrait', 'face-closeup', 'face-close-up', 'close-up-face',
                    'model-walk', 'selfie', 'makeup', 'beauty-shoot', 'fashion-shoot',
                    'studio-shoot', 'photoshoot', 'glamour',
                    // 4) 공연·이벤트
                    'concert', 'stage-performance', 'band-performance', 'singer', 'singing',
                    'dance-floor', 'choreography', 'dancing-couple', 'rehearsal',
                    'fireworks-show', 'parade-marching', 'festival-crowd', 'crowd-cheering',
                    'speech', 'press-conference', 'rally', 'protest', 'demonstration',
                    // 5) 운동
                    'gym', 'workout', 'yoga-mat', 'yoga-pose', 'fitness', 'pilates',
                    'crossfit', 'running-track', 'treadmill', 'lifting-weight',
                    // 6) 동물
                    'cat-video', 'dog-video', 'pet-', '-pet', 'puppies', 'kittens',
                    'bird-flying', 'animal-portrait', 'wildlife', 'zoo-animal',
                    'aquarium', 'underwater-fish',
                    // 7) 의료
                    'hospital', 'doctor', 'nurse', 'medical', 'surgery', 'patient',
                    'lab-coat', 'stethoscope',
                    // 8) 비도시 자연
                    'forest-trail', 'jungle-walk', 'mountain-hike', 'desert-dune',
                    'beach-people', 'tropical-beach',
                    // 9) 일상 활동
                    'shopping', 'cleaning', 'laundry', 'kids-playing', 'baby-crawling',
                    'family-dinner', 'birthday-party',
                    // 10) 의례
                    'prayer', 'wedding-ceremony', 'birthday-cake', 'baby-shower',
                    'funeral', 'religious-procession'
                ];
                function isRoadView(v) {
                    const url = (v.url || '').toLowerCase();
                    const author = (v.user?.name || '').toLowerCase();
                    const tags = (v.tags || []).map(t => String(t).toLowerCase()).join(' ');
                    const haystack = url + ' | ' + author + ' | ' + tags;
                    return ROAD_BLOCKLIST.some(k => haystack.includes(k));
                }

                // ─── 사용자 요청: "도시 영상 맞는지 검증" ───────────────
                // Pexels는 검색 키워드 기반이라 'Tokyo'로 검색해도 'Texas Tokyo'나 generic 도시 영상이 섞임.
                // → 영상 페이지 URL slug + 작가 + 메타에서 도시명/별칭 매칭되는 것만 통과.
                // 매칭 0개면 fallback (generic 'cityscape' 결과는 fallback 모드로만)
                const CITY_ALIASES = {
                    'New York': ['new-york', 'nyc', 'manhattan', 'brooklyn', 'queens', 'bronx', 'times-square'],
                    'Los Angeles': ['los-angeles', 'la', 'hollywood', 'venice-beach', 'santa-monica'],
                    'San Francisco': ['san-francisco', 'sf', 'golden-gate', 'lombard'],
                    'Tokyo': ['tokyo', 'shibuya', 'shinjuku', 'akihabara', 'harajuku', 'ginza', 'asakusa'],
                    'Osaka': ['osaka', 'dotonbori', 'umeda', 'namba'],
                    'Kyoto': ['kyoto', 'fushimi', 'arashiyama'],
                    'Seoul': ['seoul', 'gangnam', 'myeongdong', 'hongdae', 'itaewon', 'namsan', 'han-river'],
                    'Busan': ['busan', 'haeundae', 'gwangalli'],
                    'Hong Kong': ['hong-kong', 'hk', 'kowloon', 'victoria-harbour'],
                    'Beijing': ['beijing', 'forbidden-city', 'tiananmen', 'great-wall'],
                    'Shanghai': ['shanghai', 'pudong', 'bund'],
                    'Bangkok': ['bangkok', 'thailand'],
                    'Singapore': ['singapore', 'marina-bay', 'sentosa'],
                    'Bali': ['bali', 'ubud', 'kuta', 'seminyak', 'indonesia'],
                    'Dubai': ['dubai', 'burj-khalifa', 'palm-jumeirah', 'uae'],
                    'Istanbul': ['istanbul', 'bosphorus', 'hagia-sophia'],
                    'London': ['london', 'thames', 'tower-bridge', 'big-ben', 'westminster'],
                    'Paris': ['paris', 'eiffel', 'louvre', 'seine', 'montmartre', 'champs-elysees'],
                    'Rome': ['rome', 'colosseum', 'vatican', 'trevi'],
                    'Barcelona': ['barcelona', 'sagrada-familia', 'park-guell', 'gaudi'],
                    'Madrid': ['madrid', 'plaza-mayor'],
                    'Lisbon': ['lisbon', 'lisboa', 'porto', 'tagus'],
                    'Berlin': ['berlin', 'brandenburg'],
                    'Amsterdam': ['amsterdam', 'netherlands', 'canals'],
                    'Prague': ['prague', 'praha', 'charles-bridge', 'czech'],
                    'Vienna': ['vienna', 'wien', 'austria', 'schonbrunn'],
                    'Athens': ['athens', 'acropolis', 'parthenon', 'greece'],
                    'Mumbai': ['mumbai', 'bombay', 'india'],
                    'Delhi': ['delhi', 'new-delhi'],
                    'Cairo': ['cairo', 'pyramids', 'giza', 'egypt'],
                    'Marrakesh': ['marrakesh', 'marrakech', 'morocco', 'medina', 'sahara'],
                    'Mexico City': ['mexico-city', 'cdmx', 'mexico'],
                    'Buenos Aires': ['buenos-aires', 'argentina'],
                    'Rio': ['rio', 'rio-de-janeiro', 'copacabana', 'ipanema', 'brazil'],
                    'São Paulo': ['sao-paulo', 'são-paulo', 'brazil'],
                    'Sydney': ['sydney', 'opera-house', 'harbour-bridge', 'bondi'],
                    'Melbourne': ['melbourne'],
                    'Cape Town': ['cape-town', 'table-mountain', 'south-africa']
                };
                function getCityKeywords(cityName) {
                    const aliases = CITY_ALIASES[cityName] || [];
                    const cityKey = cityName.toLowerCase().replace(/\s+/g, '-');
                    const cityWords = cityName.toLowerCase().split(/\s+/);
                    return [...new Set([cityKey, ...cityWords, ...aliases])];
                }
                const cityKeywords = getCityKeywords(state.currentCity);
                // 도시 매칭 점수: URL slug에 들어있으면 강한 가산점, 태그/작가는 약한 가산점
                function relevanceScore(v) {
                    if (!cityKeywords.length) return 0;
                    const url = (v.url || '').toLowerCase();
                    const author = (v.user?.name || '').toLowerCase();
                    const tags = (v.tags || []).map(t => (t || '').toLowerCase()).join(' ');
                    let score = 0;
                    cityKeywords.forEach(kw => {
                        if (kw.length < 3) return;
                        if (url.includes(kw)) score += 10;     // URL slug = 강력 (Pexels가 도시명 박은 케이스)
                        if (tags.includes(kw)) score += 3;
                        if (author.includes(kw)) score += 2;
                    });
                    return score;
                }
                function isRelevantToCity(v) { return relevanceScore(v) >= 3; }
                try {
                    // 사용자 요청 "도시뷰만 아닌거 싹빼" — 도시뷰 키워드 필터로 강제.
                    // landmark/festival/market/people/cafe 등 비도시뷰 쿼리는 모두 폐기.
                    const CITYVIEW_RX = /\b(cityscape|aerial|skyline|drone|timelapse|panorama|downtown|architecture|rooftop|skyscraper|urban|metropolis|night view|city lights|sunset skyline|sunrise skyline)\b/i;
                    let cityCustom = [];
                    try {
                        const cv = window.AURA_CITY_VIDEOS;
                        if (cv && cv.getCity) {
                            const cd = cv.getCity(state.currentCity);
                            if (cd && Array.isArray(cd.customQueries)) {
                                // 도시뷰 키워드 들어있는 customQuery 만 사용
                                cityCustom = cd.customQueries.filter(q => CITYVIEW_RX.test(q));
                            }
                        }
                        // 랜드마크/축제 helper 는 사용자 정책상 제외 (비도시뷰 영상 발생 원인)
                    } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
                    // 도시뷰 전용 fallback — 모두 도시 전경/스카이라인/항공 키워드 포함
                    const fallbackQueries = [
                        state.currentCity + ' cityscape 4k',
                        state.currentCity + ' aerial drone 4k',
                        state.currentCity + ' drone footage',
                        state.currentCity + ' timelapse',
                        state.currentCity + ' skyline night',
                        state.currentCity + ' skyline day',
                        state.currentCity + ' architecture',
                        state.currentCity + ' downtown aerial',
                        state.currentCity + ' city lights night',
                        state.currentCity + ' rooftop view',
                        state.currentCity + ' panorama',
                        state.currentCity + ' urban skyline',
                        state.currentCity + ' skyscraper drone',
                        state.currentCity + ' aerial sunset',
                        state.currentCity + ' aerial sunrise'
                    ];
                    // customQueries (필터됨) + fallback = 최대 18 쿼리.
                    const baseQueries = (cityCustom.length ? cityCustom.concat(fallbackQueries.slice(0, 18 - cityCustom.length)) : fallbackQueries).slice(0, 18);
                    const requests = [];
                    baseQueries.forEach((q, i) => {
                        requests.push(fetchOne(q, 1));
                        if (i < 12) requests.push(fetchOne(q, 2));
                        if (i < 6)  requests.push(fetchOne(q, 3));
                    });
                    const results = await Promise.all(requests);
                    const allVideos = results.flat();

                    // 중복 제거 + 도로뷰 차단 (도시 매칭은 *필터* 가 아닌 *랭킹* 으로만 사용)
                    // 사용자 보고: "영상이 너무 적어" → 필터링 폐기, 모든 unique 영상 살리고 매칭만 우선 정렬
                    const seen = new Set();
                    const dedupClean = allVideos.filter(v => {
                        if (seen.has(v.id)) return false;
                        seen.add(v.id);
                        if (isRoadView(v)) return false;
                        return true;
                    });
                    // 매칭 점수 높은 영상이 앞으로 (URL slug 매칭 = 10점, 태그 = 3점, 작가 = 2점)
                    const videos = dedupClean.slice().sort((a, b) => relevanceScore(b) - relevanceScore(a));
                    if (window.__DEBUG) {
                        const rcount = dedupClean.filter(isRelevantToCity).length;
                        console.log('[CITY VIDEO]', state.currentCity, 'total:', videos.length, 'city-matched:', rcount);
                    }

                    // 영상별 최고 화질 file 선정 — SD 완전 배제, FHD(1920+) / UHD(3840+) 우선.
                    // 사용자 요청 "영상 질 좀 더 높혀봐":
                    //   - 720p 미만 (1280 width) 차단 → 절대 SD 안 나옴
                    //   - UHD(4K) 가장 우선, FHD(1920+) 다음, HD(1280+) 안전망
                    //   - Cafe(풀스크린) 모드 감지되면 UHD 가중치 ↑↑ (대형 화면 = 4K 빛남)
                    // v567 발열: 모바일은 HD (720~1280) 가 최적. UHD/FHD 는 GPU
                    // 디코딩 부하 + 셀룰러 데이터 낭비 → SD/HD 만 사용.
                    const isMobile = window.innerWidth <= 768;
                    const MIN_WIDTH = isMobile ? 640  : 1280;   // 모바일은 SD 부터 허용
                    const FHD_WIDTH = isMobile ? 1280 : 1920;   // 모바일은 HD 가 최대 격
                    const UHD_WIDTH = isMobile ? 1920 : 3840;   // 모바일은 FHD 까지만
                    const MAX_WIDTH = isMobile ? 1280 : 99999;  // 1280 초과 영상 폐기 (모바일)
                    const isCafeFullscreen = !!(document.body && document.body.classList && document.body.classList.contains('cafe-mode'));

                    function fileScore(f) {
                        const w = f.width || 0;
                        // 모바일: 너무 큰 영상 대폭 페널티 (디코딩 GPU 낭비)
                        if (isMobile && w > MAX_WIDTH) return -w;
                        const isUhd = (f.quality === 'uhd') || w >= UHD_WIDTH;
                        const isFhd = (f.quality === 'hd') || w >= FHD_WIDTH;
                        let score = w;
                        if (isUhd) score += isCafeFullscreen ? 12000 : 6000;
                        else if (isFhd) score += 3000;
                        return score;
                    }

                    const ranked = videos.map(v => {
                        const files = (v.video_files || []).slice()
                            .filter(f => f.file_type === 'video/mp4' || (!f.file_type && f.link?.includes('.mp4')))
                            .filter(f => (f.width || 0) >= MIN_WIDTH)   // SD 완전 차단
                            .sort((a, b) => fileScore(b) - fileScore(a));
                        return files[0] ? { link: files[0].link, width: files[0].width || 0, quality: files[0].quality } : null;
                    }).filter(Boolean);

                    // 풀 전체에서도 UHD/FHD 영상이 앞쪽으로 (재생 시 처음 몇 분이 가장 인상에 남음)
                    ranked.sort((a, b) => fileScore(b) - fileScore(a));
                    if (window.__DEBUG) {
                        const uhdCount = ranked.filter(r => (r.width || 0) >= UHD_WIDTH).length;
                        const fhdCount = ranked.filter(r => (r.width || 0) >= FHD_WIDTH && (r.width || 0) < UHD_WIDTH).length;
                        const hdCount  = ranked.filter(r => (r.width || 0) >= MIN_WIDTH && (r.width || 0) < FHD_WIDTH).length;
                        console.log(`[CITY VIDEO] Quality breakdown — UHD:${uhdCount} FHD:${fhdCount} HD:${hdCount}`);
                    }
                    // 풀 구성: UHD → FHD → HD 순서 유지하되 각 등급 안에서만 셔플 (다양성 + 화질 보장).
                    // 첫 사이클 동안 가장 좋은 화질부터 보이게 됨.
                    function gradeOf(r) {
                        const w = r.width || 0;
                        if (w >= UHD_WIDTH) return 0;   // UHD 먼저
                        if (w >= FHD_WIDTH) return 1;
                        return 2;
                    }
                    const buckets = [[], [], []];
                    ranked.forEach(r => buckets[gradeOf(r)].push(r));
                    buckets.forEach(b => b.sort(() => Math.random() - 0.5));   // 각 등급 안에서 셔플
                    const ordered = buckets[0].concat(buckets[1], buckets[2]);
                    videoLinks = ordered.slice(0, 1000).map(x => x.link);
                    if (selfHosted.length) videoLinks = selfHosted.concat(videoLinks);

                    // 보강 풀: Coverr 만 (Pixabay 키 없음 / Wikimedia 제거됨 — 사용자 요청)
                    try {
                        const coverrVideos = await fetchCoverrFallback(state.currentCity).catch(() => []);
                        const seenLinks = new Set(videoLinks);
                        let coverrAdded = 0;
                        coverrVideos.forEach(l => { if (!seenLinks.has(l)) { videoLinks.push(l); seenLinks.add(l); coverrAdded++; } });
                        if (window.__DEBUG) console.log(`[AMBIENT] Coverr added: ${coverrAdded}, total pool ${videoLinks.length}`);
                    } catch (e) { window.AURA?.dbgWarn?.('fallback merge', e); }

                    if (!videoLinks.length) {
                        setStatus(`✗ no video for "${state.currentCity}"`, 'rgba(252,165,165,.95)');
                        return false;
                    }
                    cache[state.currentCity] = { links: videoLinks, ts: Date.now() };
                    try {
                        if (window.AURA?.safeStorageSetGuarded) {
                            window.AURA.safeStorageSetGuarded(CACHE_KEY, cache);
                        } else {
                            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                        }
                    } catch (e) { window.AURA?.dbgWarn?.('pexels cache write', e); }
                } catch (e) {
                    setStatus(`✗ ${e.message || 'fetch error'}`, 'rgba(252,165,165,.95)');
                    return false;
                }
            }
            if (!videoLinks.length) return false;

            // 사용자 신고된 잘못된 영상은 즉시 제거 (도시당 별도 블록리스트)
            const BLOCK_KEY = 'aura_wrong_city_videos_v1';
            function loadBlockList() {
                try { return JSON.parse(localStorage.getItem(BLOCK_KEY) || '{}'); } catch { return {}; }
            }
            function saveBlockList(b) {
                if (window.AURA?.safeStorageSetGuarded) window.AURA.safeStorageSetGuarded(BLOCK_KEY, b);
                else { try { localStorage.setItem(BLOCK_KEY, JSON.stringify(b)); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); } }
            }
            const blocked = loadBlockList();
            const blockedForCity = new Set(blocked[state.currentCity] || []);
            videoLinks = videoLinks.filter(u => !blockedForCity.has(u));
            if (!videoLinks.length) return false;

            // 다중 영상 순환 재생 — 자연 종료 + 90초 강제 회전.
            // 사용자 보고 "3분도 안 나옴" → 30초 회전 + retries 누적으로 6 cycle 만에 pool 소진.
            // 수정 (2026-04):
            //   - MAX_SCENE_MS 30s → 90s (1시간 동안 ~40번 전환, 덜 산만)
            //   - retries 카운터를 onloadeddata 성공 시 0 으로 reset (한번이라도 성공하면 누적 X)
            //   - 단일 영상 pool 시 v.loop = true 명시
            //   - 모든 영상 실패 → 30초 후 re-fetch + 재시도 (영원히 정지 X)
            let idx = Math.floor(Math.random() * videoLinks.length);
            let passCount = 0;   // 풀을 몇 번 돌았는지
            let currentVideo = null;
            let forceRotateTimer = null;
            const MAX_SCENE_MS = 90000;  // 한 장면 최대 90초

            // 사용자 요청: "같은 영상 안 나오게" — 최근 본 영상 트래킹 (FIFO, 풀의 최대 50%).
            // playOne 의 link picker 가 이 Set 안에 있는 영상은 건너뜀 (몇 번 시도 후 포기).
            const recentlyPlayed = [];
            function recentCap() { return Math.max(5, Math.min(20, Math.floor(videoLinks.length / 2))); }
            function rememberPlayed(url) {
                if (!url) return;
                const i = recentlyPlayed.indexOf(url);
                if (i >= 0) recentlyPlayed.splice(i, 1);
                recentlyPlayed.push(url);
                while (recentlyPlayed.length > recentCap()) recentlyPlayed.shift();
            }

            function nextIdx() {
                idx++;
                if (idx >= videoLinks.length) {
                    idx = 0;
                    passCount++;
                    // 자체 호스팅(앞쪽 고정) 제외하고 나머지만 셔플
                    const fixed = selfHosted.filter(u => videoLinks.includes(u));
                    const rest = videoLinks.filter(u => !fixed.includes(u));
                    rest.sort(() => Math.random() - 0.5);
                    // A. 새 사이클 첫 영상이 직전 마지막 영상과 같으면 swap (연속 중복 100% 차단)
                    if (rest.length > 1 && currentVideo) {
                        const lastUrl = currentVideo.querySelector('source')?.src;
                        if (rest[0] === lastUrl) [rest[0], rest[1]] = [rest[1], rest[0]];
                    }
                    videoLinks = fixed.concat(rest);
                    if (window.__DEBUG) console.log(`[CITY VIDEO] Pool pass #${passCount}, reshuffled ${rest.length}`);
                }
            }

            // B. 최근 N개 회피하면서 link 선택. 풀의 절반 시도 후에도 다 본 거뿐이면 그냥 idx 자리 사용.
            function pickFreshLink() {
                if (videoLinks.length === 0) return null;
                if (videoLinks.length <= 2) return videoLinks[idx % videoLinks.length];
                let attempts = 0;
                const maxAttempts = Math.min(videoLinks.length - 1, 10);
                while (attempts < maxAttempts) {
                    const candidate = videoLinks[idx % videoLinks.length];
                    if (!recentlyPlayed.includes(candidate)) return candidate;
                    nextIdx();
                    attempts++;
                }
                // 모든 후보 모두 최근에 본 것 — 어쩔 수 없이 idx 자리 영상 사용
                return videoLinks[idx % videoLinks.length];
            }

            // 백그라운드 lazy 확장 — 풀 절반 소비할 때마다 page=N+1 fetch (반복 방지)
            let lazyPage = 4;     // 초기 fetch 가 page 1-3 사용했으니 page 4 부터
            let lazyFetching = false;
            async function lazyExpandPool() {
                if (lazyFetching || lazyPage > 10) return;     // Pexels max page 10
                if (idx < videoLinks.length / 2) return;        // 절반 안 썼으면 skip
                lazyFetching = true;
                try {
                    const cv = window.AURA_CITY_VIDEOS;
                    const cd = cv?.getCity?.(state.currentCity);
                    const CV_RX = /\b(cityscape|aerial|skyline|drone|timelapse|panorama|downtown|architecture|rooftop|skyscraper|urban)\b/i;
                    const customQ = (cd?.customQueries || []).filter(q => CV_RX.test(q)).slice(0, 4);
                    const qList = customQ.length ? customQ : [
                        state.currentCity + ' cityscape 4k',
                        state.currentCity + ' aerial drone 4k',
                        state.currentCity + ' downtown aerial',
                        state.currentCity + ' timelapse'
                    ];
                    const results = await Promise.all(qList.map(q => fetchOne(q, lazyPage)));
                    const newVids = results.flat();
                    const seenLinks = new Set(videoLinks);
                    let added = 0;
                    newVids.forEach(v => {
                        if (isRoadView(v)) return;
                        // 화질 강화: HD(1280+) 이상만 + 최고화질 파일 선정 (이전: 첫 mp4 아무거나)
                        const candidates = (v.video_files || [])
                            .filter(f => (f.file_type === 'video/mp4' || /\.mp4(\?|$)/i.test(f.link)) && (f.width || 0) >= 1280)
                            .sort((a, b) => (b.width || 0) - (a.width || 0));
                        const file = candidates[0];
                        if (file?.link && !seenLinks.has(file.link)) {
                            videoLinks.push(file.link);
                            seenLinks.add(file.link);
                            added++;
                        }
                    });
                    if (window.__DEBUG && added) console.log(`[CITY VIDEO] Lazy page ${lazyPage}: +${added}, total ${videoLinks.length}`);
                    lazyPage++;
                } catch (e) { window.AURA?.dbgWarn?.('lazy expand', e); }
                lazyFetching = false;
            }

            // 사용자가 "잘못된 도시?" 신고 시 호출
            // 1) 로컬 블록 — 본인은 즉시 안 보임
            // 2) Worker 로 신고 POST — 임계치(3건) 초과 시 모든 사용자에게 안 보임 (crowdsourced)
            window.reportCurrentVideo = function() {
                if (!currentVideo?.querySelector('source')?.src) return;
                const url = currentVideo.querySelector('source').src;
                const b = loadBlockList();
                if (!b[state.currentCity]) b[state.currentCity] = [];
                if (!b[state.currentCity].includes(url)) b[state.currentCity].push(url);
                saveBlockList(b);
                blockedForCity.add(url);

                // Worker 에 신고 (있으면)
                if (window.AURA_SERVER) {
                    fetch(window.AURA_SERVER + '/report-wrong-city', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ city: state.currentCity, url })
                    }).then(r => r.json()).then(data => {
                        if (data?.blocked && window.showToast) {
                            window.showToast(window.state?.lang === 'ko' ? '✅ 이 영상이 모든 사용자에게 차단됐어요' : '✅ Blocked for everyone', 'ok', 2500);
                        }
                    }).catch(e => window.AURA?.dbgWarn?.('report-wrong-city', e));
                }

                // 풀에서 제거 + 다음으로 즉시
                const i = videoLinks.indexOf(url);
                if (i >= 0) videoLinks.splice(i, 1);
                if (window.showToast) window.showToast(window.state?.lang === 'ko' ? '🚫 이 영상 차단됨' : '🚫 Video blocked', 'ok', 2000);
                if (videoLinks.length) playOne();
            };
            // "전체 실패" 라벨 후 영원히 정지하던 버그 복구.
            //   - 1차 30초 후 retry. 성공하면 attempt 0 으로 reset.
            //   - 연속 실패 시 백오프(30·60·120·240·480초). 8회 후 중단(=4시간 내내 실패하면 포기).
            //   - 풀이 비어있으면 (사용자 신고로 모두 차단 등) Pexels 재fetch 시도.
            let allFailedRetryTimer = null;
            let allFailedAttempt = 0;
            const MAX_RETRY_ATTEMPTS = 8;
            function scheduleAllFailedRetry() {
                if (allFailedRetryTimer) clearTimeout(allFailedRetryTimer);
                if (allFailedAttempt >= MAX_RETRY_ATTEMPTS) {
                    setStatus('✗ giving up — refresh page to retry', 'rgba(252,165,165,.95)');
                    return;
                }
                const delay = Math.min(30000 * Math.pow(2, allFailedAttempt), 480000);  // 30s → 480s 백오프
                allFailedAttempt++;
                allFailedRetryTimer = setTimeout(async () => {
                    if (window.__DEBUG) console.log(`[CITY VIDEO] Retry attempt ${allFailedAttempt} (next delay if fails: ${Math.min(30000 * Math.pow(2, allFailedAttempt), 480000)/1000}s)`);
                    if (!videoLinks.length) {
                        // Pool 비어있으면 (사용자 신고 등) Pexels 재fetch
                        if (window.__DEBUG) console.log('[CITY VIDEO] Pool empty — refetching Pexels');
                        try {
                            const cv = window.AURA_CITY_VIDEOS;
                            const cd = cv?.getCity?.(state.currentCity);
                            const CV_RX = /\b(cityscape|aerial|skyline|drone|timelapse|panorama|downtown|architecture|rooftop|skyscraper|urban)\b/i;
                            const customQ = (cd?.customQueries || []).filter(q => CV_RX.test(q)).slice(0, 3);
                            const qList = customQ.length ? customQ : [state.currentCity + ' aerial 4k', state.currentCity + ' skyline drone', state.currentCity + ' cityscape'];
                            const results = await Promise.all(qList.map(q => fetchOne(q, 1)));
                            const newVids = results.flat();
                            const blocked = blockedForCity || new Set();
                            newVids.forEach(v => {
                                if (isRoadView(v)) return;
                                // 화질 강화: HD+ 만 + 최고화질 파일 선정
                                const candidates = (v.video_files || [])
                                    .filter(f => (f.file_type === 'video/mp4' || /\.mp4(\?|$)/i.test(f.link)) && (f.width || 0) >= 1280)
                                    .sort((a, b) => (b.width || 0) - (a.width || 0));
                                const file = candidates[0];
                                if (file?.link && !blocked.has(file.link) && !videoLinks.includes(file.link)) {
                                    videoLinks.push(file.link);
                                }
                            });
                        } catch (e) { window.AURA?.dbgWarn?.('refetch on empty', e); }
                    }
                    if (videoLinks.length) playOne(0);
                    else scheduleAllFailedRetry();   // 여전히 비어있으면 다음 백오프
                }, delay);
            }
            // 한 번이라도 영상이 정상 재생되면 백오프 카운터 리셋 (재발 시 30초부터 다시)
            function resetAllFailedAttempt() { allFailedAttempt = 0; }

            function playOne(retries = 0) {
                if (allFailedRetryTimer) { clearTimeout(allFailedRetryTimer); allFailedRetryTimer = null; }
                if (!videoLinks.length) {
                    setStatus('✗ pool empty — retrying soon', 'rgba(252,165,165,.95)');
                    scheduleAllFailedRetry();
                    return;
                }
                // B. 최근 N개 회피하며 link 선택
                const link = pickFreshLink();
                if (!link) { scheduleAllFailedRetry(); return; }
                rememberPlayed(link);
                nextIdx();
                lazyExpandPool();   // 백그라운드: 풀 반 이상 소비 시 page+1 가져옴
                const v = document.createElement('video');
                v.autoplay = true;
                v.loop = true;
                v.muted = true;
                v.playsInline = true;
                // v567 발열: preload auto → metadata (영상 전체 미리 다운로드 X)
                v.preload = 'metadata';
                v.dataset.saudadeVideo = '1';   // visibilitychange 핸들러가 추적
                // 모바일 + viewport 작으면 inline scale (network/decoder ↓)
                try {
                    if (window.innerWidth <= 768) v.setAttribute('disableremoteplayback', '');
                } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
                v.style.cssText = `position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;min-width:100%;min-height:100%;object-fit:cover;z-index:1;opacity:0;transition:opacity .8s;background:#000;display:block`;

                const source = document.createElement('source');
                source.src = link;
                source.type = 'video/mp4';
                v.appendChild(source);

                let timedOut = false;
                const timeout = setTimeout(() => {
                    if (!v.readyState || v.readyState < 2) {
                        timedOut = true;
                        console.warn('[CITY VIDEO] Timeout:', link.slice(0, 60));
                        v.remove();
                        if (retries < videoLinks.length - 1) playOne(retries + 1);
                        else { setStatus('✗ all timed out — retrying in 30s', 'rgba(252,165,165,.95)'); scheduleAllFailedRetry(); }
                    }
                }, 8000);

                v.onloadeddata = () => {
                    if (timedOut) return;
                    clearTimeout(timeout);
                    resetAllFailedAttempt();   // 한번이라도 성공 → 백오프 카운터 0 으로
                    v.style.opacity = '1';
                    if (currentVideo && currentVideo !== v) {
                        currentVideo.style.opacity = '0';
                        setTimeout(() => currentVideo.remove(), 800);
                    }
                    currentVideo = v;
                    setStatus(`✓ HD · ${idx}/${videoLinks.length}`, 'rgba(120,255,180,.95)');
                    setTimeout(() => status.style.opacity = '0', 2000);

                    // 강제 회전 타이머 — 90초 지나면 다음 장면으로 (단일 영상은 loop 로 처리)
                    if (forceRotateTimer) clearTimeout(forceRotateTimer);
                    if (videoLinks.length > 1) {
                        forceRotateTimer = setTimeout(() => {
                            if (currentVideo === v) playOne(0);   // retries 0 으로 reset (한번이라도 성공한 풀이라 카운터 누적 의미 X)
                        }, MAX_SCENE_MS);
                    }
                };
                v.addEventListener('ended', () => {
                    // v.loop=true 이므로 보통 안 터짐. 어떤 이유로(브라우저 버그/코덱) 터지면
                    // 강제로 다시 처음부터 재생 — 절대 freeze 시키지 않는다. 다음 장면은 90초 타이머가 처리.
                    v.currentTime = 0;
                    const p = v.play();
                    if (p && p.catch) p.catch(() => { setTimeout(() => v.play().catch(() => {}), 500); });
                });
                // 사용자 보고: "영상 갑자기 개느려짐" — stalled watchdog 너무 공격적이라 정상 버퍼링도 영상 교체로 인식 → 끊임없는 reload 루프.
                // 'suspend'(정상 일시중단) / 'waiting'(정상 버퍼링) 에서 빼고 진짜 'stalled' 만, 시간도 5s → 15s로 완화.
                let stallTimer = null;
                v.addEventListener('stalled', () => {
                    if (stallTimer) clearTimeout(stallTimer);
                    stallTimer = setTimeout(() => {
                        // readyState < HAVE_CURRENT_DATA(2) → 데이터 정말 못 받는 경우만 advance
                        if (currentVideo === v && v.readyState < 2 && videoLinks.length > 1) {
                            console.warn('[CITY VIDEO] True stall — advancing');
                            playOne();
                        }
                    }, 15000);
                });
                v.addEventListener('playing', () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } });
                v.addEventListener('progress', () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } });
                v.onerror = (e) => {
                    clearTimeout(timeout);
                    console.warn('[CITY VIDEO] Load error:', link.slice(0, 60), v.error?.message);
                    v.remove();
                    if (retries < videoLinks.length - 1) playOne(retries + 1);
                    else { setStatus('✗ all failed — retrying in 30s', 'rgba(252,165,165,.95)'); scheduleAllFailedRetry(); }
                };
                wrap.insertBefore(v, label);
                v.load();
            }
            playOne();

            // 사용자 수동 스킵 — 다음 영상으로 즉시
            window.AURA_VIDEO_SKIP = function() {
                if (forceRotateTimer) { clearTimeout(forceRotateTimer); forceRotateTimer = null; }
                playOne();
            };
            return true;
        }

        // 3) Tenor GIF 시도 (gifUrl이 있는 경우에만 — 보통 city-videos.js의 hardcoded URL)
        const hasValidGif = gifUrl && gifUrl !== 'about:blank' && gifUrl.startsWith('http');
        if (hasValidGif) {
            const img = document.createElement('img');
            img.src = gifUrl;
            img.alt = 'city vibe';
            img.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;opacity:0;transition:opacity .5s`;
            img.onload = () => { img.style.opacity = '1'; };
            img.onerror = () => { img.remove(); tryPexelsVideo(); };  // GIF 실패 → Pexels
            wrap.insertBefore(img, label);
        } else {
            // GIF 없음 → 즉시 Pexels 시도 (이게 정상 경로 — city-videos.js의 깨진 URL 다 제거됨)
            tryPexelsVideo();
        }

        c.appendChild(wrap);
        requestAnimationFrame(() => c.classList.add('show'));
    }

    // ─── SoundCloud Widget (API key 불필요) ───
    let scContainer = null;
    function playSoundCloud(scTrackUrl) {
        if (!state.soundOn) return;
        if (!scContainer) {
            scContainer = document.createElement('div');
            scContainer.id = 'scPlayerContainer';
            scContainer.className = 'sc-player-container';
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'sc-player-close';
            close.textContent = '✕';
            close.title = '음악 끄기';
            close.addEventListener('click', stopSoundCloud);
            scContainer.appendChild(close);
            document.body.appendChild(scContainer);
        }
        // 기존 iframe 제거 (close 버튼 제외)
        Array.from(scContainer.querySelectorAll('iframe')).forEach(n => n.remove());

        const iframe = document.createElement('iframe');
        iframe.scrolling = 'no';
        iframe.frameBorder = 'no';
        iframe.allow = 'autoplay';
        // SoundCloud widget URL - API key 불필요!
        const params = new URLSearchParams({
            url: scTrackUrl,
            auto_play: 'true',
            hide_related: 'true',
            show_comments: 'false',
            show_user: 'false',
            show_reposts: 'false',
            show_teaser: 'false',
            visual: 'true'
        });
        iframe.src = `https://w.soundcloud.com/player/?${params.toString()}`;
        scContainer.appendChild(iframe);
        requestAnimationFrame(() => scContainer.classList.add('show'));
        if (window.__DEBUG) console.log('[AMBIENT] SoundCloud 재생:', scTrackUrl);
    }

    function stopSoundCloud() {
        if (scContainer) {
            scContainer.classList.remove('show');
            setTimeout(() => {
                Array.from(scContainer.querySelectorAll('iframe')).forEach(n => n.remove());
            }, 300);
        }
    }

    // 도시별 분위기 기반 기본 SoundCloud 트랙 (검증된 인기 lofi/chill)
    function getDefaultSoundCloud(city) {
        const c = window.AURA_CITY_VIDEOS?.getCity?.(city);
        const tag = c?.tag || 'lofi';
        // 태그별 SoundCloud 인기 mix/playlist URL (auto_play 가능)
        const map = {
            'kpop':       'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'lofi':       'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'jazz':       'https://soundcloud.com/lofi-girl/sets/jazz-cafe-vol-1',
            'electronic': 'https://soundcloud.com/lofi-girl/sets/synthwave-radio',
            'hiphop':     'https://soundcloud.com/lofi-girl/sets/lofi-hip-hop',
            'chill':      'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'cinematic':  'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'samba':      'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'tango':      'https://soundcloud.com/lofi-girl/sets/jazz-cafe-vol-1',
            'tropical':   'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'thai-pop':   'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study',
            'bollywood':  'https://soundcloud.com/lofi-girl/sets/synthwave-radio',
            'ambient':    'https://soundcloud.com/lofi-girl/sets/lofi-radio-beats-to-relax-study'
        };
        return map[tag] || map['lofi'];
    }

    // 댄싱 고양이 풀스크린 GIF 폴백 (YouTube 영상 모두 막히면 사용)
    const FALLBACK_CAT_GIFS = [
        'https://media.giphy.com/media/AHkPaqiu2vzj2/giphy.gif',     // dancing cat
        'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',    // vibing cat
        'https://media.giphy.com/media/SqmkZ5IdwzTH2/giphy.gif',    // bongo cat
        'https://media.giphy.com/media/12vJgj7zMN3jPy/giphy.gif',   // happy cat
        'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',    // spinning cat
        'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',    // dancing cat 2
        'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',   // cute cat
        'https://media.giphy.com/media/o0vwzuFwCGAFO/giphy.gif',    // funny cat
        'https://media.giphy.com/media/3orifgF2vjjLnANIuY/giphy.gif',
        'https://media.giphy.com/media/lJNoBCvQYp7nq/giphy.gif',    // groove cat
    ];

    function showVideoError() {
        const c = ensureVideoContainer();
        const closeBtn = c.querySelector('#ambVideoClose');
        const expandBtn = c.querySelector('#ambVideoExpand');
        const skipBtn = c.querySelector('#ambVideoSkip');
        while (c.firstChild) c.removeChild(c.firstChild);
        if (expandBtn) c.appendChild(expandBtn);
        if (skipBtn) c.appendChild(skipBtn);
        if (closeBtn) c.appendChild(closeBtn);

        // 풀스크린 댄싱 고양이 GIF (랜덤)
        const gif = FALLBACK_CAT_GIFS[Math.floor(Math.random() * FALLBACK_CAT_GIFS.length)];
        const wrap = document.createElement('div');
        wrap.style.cssText = `
            display:flex;align-items:center;justify-content:center;
            width:100%;height:100%;background:#0a0a14;overflow:hidden;
        `;
        const img = document.createElement('img');
        img.src = gif;
        img.alt = 'dancing cat';
        img.style.cssText = `
            max-width:100%;max-height:100%;object-fit:contain;
            image-rendering:auto;
        `;
        wrap.appendChild(img);

        // 안내 텍스트 (작게, 우하단)
        const hint = document.createElement('div');
        hint.style.cssText = `
            position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
            font-size:10px;color:#94a3b8;background:rgba(0,0,0,0.6);
            padding:4px 10px;border-radius:10px;font-family:sans-serif;
            pointer-events:none;letter-spacing:0.3px;
        `;
        hint.textContent = '🐱 영상 대신 댄싱 고양이';
        wrap.appendChild(hint);

        c.appendChild(wrap);
        c.classList.add('show');
        document.body.classList.add('amb-has-video');
    }

    function stopVideo() {
        const c = document.getElementById('ambVideoContainer');
        if (c) {
            c.classList.remove('show');
            c.style.pointerEvents = 'none';
            setTimeout(() => {
                while (c.firstChild) c.removeChild(c.firstChild);
                c.style.display = 'none';
            }, 800);
        }
        // SoundCloud도 같이 정지
        stopSoundCloud();
        document.body.classList.remove('amb-has-video');
    }

    // 영상 다시 재생할 때 display 복원 (ensureVideoContainer 보강)

    // ─── Sound (separate iframe for ASMR/lo-fi) ───
    let soundIframe = null;

    // 항상 작동하는 디폴트 라디오 (YT ID가 invalid 일 때 폴백)
    const SAFE_RADIO_FALLBACK = 'jfKfPfyJRdk';  // Lofi Girl 24/7

    function playSound(soundId) {
        if (!state.soundOn) return;
        // 안정 채널이 아니면(검증된 6 ID 외) Lofi Girl로 강제 매핑
        // (사용자 보고: "노래가 안나와" — 가끔 unverified ID 가 들어와서 실패)
        const VERIFIED = new Set(['jfKfPfyJRdk','rUxyKA_-grg','28KRPhVzCus','4xDzrJKXOOY','DWcJFNfaw9c','MVPTGNGiI-4']);
        if (!VERIFIED.has(soundId)) soundId = SAFE_RADIO_FALLBACK;
        if (!soundIframe) {
            soundIframe = document.createElement('iframe');
            soundIframe.id = 'ambSoundFrame';
            soundIframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
            soundIframe.allow = 'autoplay; encrypted-media';
            soundIframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            document.body.appendChild(soundIframe);
        }
        // mute=0 + enablejsapi=1 + origin 명시 → postMessage 작동
        const origin = encodeURIComponent(location.origin || 'https://localhost');
        const buildSrc = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=0&loop=1&playlist=${id}&controls=0&enablejsapi=1&playsinline=1&origin=${origin}`;
        soundIframe.src = buildSrc(soundId);

        let triedFallback = false;

        // iframe 로드 후 볼륨 설정 + 재생 상태 검증
        soundIframe.onload = () => {
            setTimeout(() => {
                try {
                    const vol = Math.round(state.volume * 100);
                    soundIframe.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }),
                        '*'
                    );
                    soundIframe.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                        '*'
                    );
                    // 재생 상태 polling (3초 후에도 PLAYING 안 되면 폴백)
                    soundIframe.contentWindow?.postMessage(
                        JSON.stringify({ event: 'listening', id: 'aura-' + soundId }),
                        '*'
                    );
                } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
            }, 1000);
        };

        // YouTube 임베드 직접 onerror는 발화 안 함 — 대신 message listener로 에러 감지
        const ytErrorListener = (e) => {
            try {
                const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                // YouTube가 'onError' 이벤트로 알려줌: 2(invalid), 5(html5 error), 100(removed), 101/150(embed disabled)
                if (data?.event === 'onError' || data?.info?.errorCode) {
                    const code = data?.info?.errorCode || data?.errorCode;
                    if ([2, 5, 100, 101, 150].includes(code) && !triedFallback && soundId !== SAFE_RADIO_FALLBACK) {
                        triedFallback = true;
                        console.warn('[MUSIC] YT', soundId, 'failed (code', code, '), falling back to Lofi Girl');
                        soundIframe.src = buildSrc(SAFE_RADIO_FALLBACK);
                    }
                }
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        };
        // 한번만 등록 (중복 방지)
        if (!playSound._listenerAttached) {
            window.addEventListener('message', ytErrorListener);
            playSound._listenerAttached = true;
        }

        // 자동재생 차단 브라우저 보강: 첫 사용자 제스처(클릭/터치/키)에 강제 play 명령 1회 송출
        if (!playSound._gestureBound) {
            playSound._gestureBound = true;
            const unlock = () => {
                try {
                    soundIframe?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                        '*'
                    );
                    soundIframe?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                        '*'
                    );
                } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
            };
            ['click', 'touchstart', 'keydown'].forEach(ev => {
                document.addEventListener(ev, unlock, { once: true, passive: true });
            });
        }
    }

    function stopSound() {
        if (soundIframe) {
            soundIframe.src = 'about:blank';
        }
    }

    function toggleSound() {
        state.soundOn = !state.soundOn;
        save();
        track('sound_toggle', { on: state.soundOn });
        if (state.soundOn && state.currentCity) {
            const c = window.AURA_CITY_VIDEOS?.getCity(state.currentCity);
            const ytId = getSafeVideoForTag(c?.tag);
            if (ytId) playSound(ytId);
        } else {
            stopSound();
        }
        renderCityPanel();
    }

    // ─── City panel ───
    function buildCityPanel() {
        const p = document.createElement('div');
        p.className = 'amb-city-panel';
        p.id = 'ambCityPanel';

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'amb-close';
        close.textContent = '✕';
        close.addEventListener('click', closeCity);
        p.appendChild(close);

        document.body.appendChild(p);
    }

    function renderCityPanel() {
        const p = document.getElementById('ambCityPanel');
        if (!p) return;
        // 닫기 버튼 외 다 비우고 다시
        const closeBtn = p.querySelector('.amb-close');
        while (p.firstChild) p.removeChild(p.firstChild);
        if (closeBtn) p.appendChild(closeBtn);

        if (!state.currentCity) {
            p.classList.remove('active');
            return;
        }

        const c = window.AURA_CITY_VIDEOS?.getCity(state.currentCity);
        if (!c) return;

        const isKo = window.state?.lang === 'ko';
        const name = document.createElement('div');
        name.className = 'amb-city-name';
        name.textContent = isKo ? (c.ko || state.currentCity) : state.currentCity;
        p.appendChild(name);

        const status = document.createElement('div');
        status.className = 'amb-city-status';
        status.textContent = isKo ? c.status.ko : c.status.en;
        p.appendChild(status);

        // ─── 노마드 6대 지표 패널 (사용자 요청: 비자/인터넷/안전/예산/코워킹/시간대) ───
        const nomad = window.AURA_NOMAD?.get?.(state.currentCity);
        if (nomad) {
            const score = window.AURA_NOMAD.score(state.currentCity);
            const grid = document.createElement('div');
            grid.className = 'amb-nomad-grid';
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px;margin:10px 0 14px;font-size:11px;font-family:var(--font-mono,monospace);background:rgba(0,0,0,.35);padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.08)';

            const visa = window.AURA_NOMAD.formatVisa(nomad.visaFreeDays);
            const safety = window.AURA_NOMAD.formatSafety(nomad.safety);
            const overlap = window.AURA_NOMAD.timeOverlap(nomad.tz);

            // v583 사용자 보고 '예산/coworking/overlap 무슨 기준인지 모르겠음' →
            // 라벨에 단위/기준 명시 + title tooltip.
            const metrics = [
                { icon: '🛂', label: isKo ? '비자' : 'Visa',                  value: isKo ? visa.text : visa.textEn,    color: visa.color,      tip: isKo ? '한국 여권 무비자/비자 필요 일수' : 'Days visa-free for Korean passport' },
                { icon: '📡', label: isKo ? '인터넷' : 'Internet',            value: nomad.internetMbps + ' Mbps',     color: nomad.internetMbps >= 80 ? '#34d399' : nomad.internetMbps >= 40 ? '#fcd34d' : '#fca5a5', tip: isKo ? '평균 다운로드 속도' : 'Avg download speed' },
                { icon: '🛡️', label: isKo ? '안전도' : 'Safety',              value: (isKo ? safety.label : safety.labelEn) + ' · ' + nomad.safety, color: safety.color, tip: isKo ? 'Numbeo 안전 지수 0-100' : 'Numbeo safety index 0-100' },
                { icon: '💵', label: isKo ? '월 1인 생활비' : 'Cost / month',  value: '$' + nomad.budget.toLocaleString(), color: nomad.budget <= 1500 ? '#34d399' : nomad.budget <= 2500 ? '#fcd34d' : '#fca5a5', tip: isKo ? '월세+식사+교통+인터넷 (1인 평균, USD)' : 'Rent + food + transit + internet (1 person, USD)' },
                { icon: '☕', label: isKo ? '코워킹 수' : 'Coworking',         value: nomad.coworking + (isKo ? '곳' : ' spaces'), color: nomad.coworking >= 50 ? '#34d399' : nomad.coworking >= 20 ? '#fcd34d' : '#fca5a5', tip: isKo ? '도시 내 등록된 코워킹 스페이스 수' : 'Registered coworking spaces in city' },
                { icon: '🕒', label: isKo ? 'KST 겹침' : 'KST overlap',       value: overlap + (isKo ? '시간' : 'h'),    color: overlap >= 5 ? '#34d399' : overlap >= 2 ? '#fcd34d' : '#fca5a5', tip: isKo ? '한국 09-18시와 그 도시 09-18시가 겹치는 시간' : 'Hours overlapping with KST 09-18 work hours' }
            ];
            metrics.forEach(m => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:6px';
                row.title = m.tip || '';
                row.innerHTML = `<span aria-hidden="true">${m.icon}</span><span style="color:rgba(255,255,255,.55);min-width:64px">${m.label}</span><span style="color:${m.color};font-weight:700">${m.value}</span>`;
                grid.appendChild(row);
            });

            // 노마드 점수 뱃지 (top right)
            const scoreBadge = document.createElement('div');
            scoreBadge.className = 'amb-nomad-score';
            scoreBadge.style.cssText = `position:absolute;top:14px;right:60px;padding:6px 10px;border-radius:999px;background:rgba(15,18,22,.92);border:1px solid rgba(255,255,255,.15);font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:.05em;color:${score >= 75 ? '#34d399' : score >= 55 ? '#fcd34d' : '#fca5a5'}`;
            scoreBadge.textContent = `🌐 ${score}/100`;
            scoreBadge.title = isKo ? '노마드 친화도 (인터넷·안전·예산·비자·코워킹 가중)' : 'Nomad-friendliness (internet, safety, budget, visa, coworking)';
            p.appendChild(scoreBadge);

            p.appendChild(grid);
        }

        const ctrls = document.createElement('div');
        ctrls.className = 'amb-city-controls';

        // v583 사용자: 'Sound off는 없애기'. music-control 패널에 음소거 이미 있음 → 중복 제거.

        // Favorite toggle
        const isFav = state.favorites.includes(state.currentCity);
        const favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'amb-ctrl-btn' + (isFav ? ' on' : '');
        favBtn.textContent = isFav
            ? '⭐ ' + (isKo ? '즐겨찾기됨' : 'Favorited')
            : '☆ ' + (isKo ? '즐겨찾기' : 'Favorite');
        favBtn.addEventListener('click', () => {
            const idx = state.favorites.indexOf(state.currentCity);
            if (idx >= 0) {
                state.favorites.splice(idx, 1);
            } else {
                state.favorites.unshift(state.currentCity);
                state.favorites = state.favorites.slice(0, 5);
                track('favorite_city_add', { city: state.currentCity });
            }
            save();
            renderCityPanel();
            renderFavorites();
        });
        ctrls.appendChild(favBtn);

        // ─── Travel CTAs (호텔/항공권/물가) ───
        const travelRow = document.createElement('div');
        travelRow.className = 'amb-city-controls';
        travelRow.style.marginTop = '8px';

        // v566: Hotels / Flights / Cost 버튼 제거 — 의존 모듈 (hotel-search,
        // flight-search, cost-compare UI) v561 에서 모두 삭제됨. dead UI 였음.
        // 사용자 보고 스샷에서 Nairobi 카드 위 잔존 버튼 발견 → 완전 제거.

        ctrls.appendChild(document.createElement('br'));
        p.appendChild(ctrls);
        p.appendChild(travelRow);
        p.classList.add('active');
    }

    // ─── Open city ───
    function openCity(cityName) {
        const c = window.AURA_CITY_VIDEOS?.getCity(cityName);
        if (!c) return;

        state.currentCity = cityName;
        try { localStorage.setItem(STORAGE.LAST_CITY, cityName); } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        track('city_click', { city: cityName });

        // body[data-tag] — style-color.css가 이 attribute로 액센트 색상 전환
        // (음악 패널 글로우, 카페 모드 비네트, 탭 active 등)
        try { document.body.dataset.tag = c.tag || 'lofi'; } catch (e) { window.AURA?.dbgWarn?.("silent",e); }

        // 도시 변경 시 고아 iframe 정리 (사운드 믹싱 방지 + 메모리 누수 차단)
        // ambSoundFrame은 재사용되니 그대로 두고, scPlayerContainer 안의 stale iframe만 제거
        try {
            const sc = document.getElementById('scPlayerContainer');
            if (sc) Array.from(sc.querySelectorAll('iframe')).forEach(f => f.remove());
            // 누적된 다른 youtube embed iframe (정상 외)도 제거
            document.querySelectorAll('iframe[src*="youtube"]').forEach(f => {
                if (f.id !== 'ambSoundFrame') f.remove();
            });
        } catch (e) { window.AURA?.dbgWarn?.("silent",e); }

        // 지구본 카메라 이동
        if (window.globeInstance) {
            try {
                window.globeInstance.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.4 }, 1400);
                window.globeInstance.controls().autoRotate = false;
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }

        // 영상 재생 — videos 필드 유무 상관없이 항상 호출 (gradient+도시명 베이스 + Pexels)
        // city-videos.js v7부터 videos 필드 제거됨 → playVideo가 빈 배열 받아서 Pexels로 직접 가야 함
        playVideo(c.videos || []);

        // 사운드 (사용자가 ON 상태일 때) — city-videos.js v7부터 sounds 필드 제거.
        // tag 기반 검증된 YouTube radio ID로 폴백 (Lofi Girl 24/7 등 안정 채널)
        if (state.soundOn) {
            const ytId = getSafeVideoForTag(c.tag);
            if (ytId) playSound(ytId);
        }

        renderCityPanel();
    }

    function closeCity() {
        state.currentCity = null;
        stopVideo();
        stopSound();
        renderCityPanel();
        if (window.globeInstance && state.mode === 'ambient') {
            try {
                window.globeInstance.controls().autoRotate = true;
            } catch (e) { window.AURA?.dbgWarn?.("silent",e); }
        }
    }

    // ─── Favorites bar ───
    function buildFavorites() {
        let bar = document.getElementById('ambFavs');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'ambFavs';
            bar.className = 'amb-favs';
            document.body.appendChild(bar);
        }
        renderFavorites();
    }

    function renderFavorites() {
        const bar = document.getElementById('ambFavs');
        if (!bar) return;
        while (bar.firstChild) bar.removeChild(bar.firstChild);
        const isKo = window.state?.lang === 'ko';
        state.favorites.forEach(name => {
            const c = window.AURA_CITY_VIDEOS?.getCity(name);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'amb-fav-chip';
            chip.textContent = '⭐ ' + (isKo ? (c?.ko || name) : name);
            chip.addEventListener('click', () => openCity(name));
            bar.appendChild(chip);
        });
    }

    // ─── Globe city markers (ADDITIVE - never override existing markers) ───
    let cityMarkersAttached = false;
    function attachCityMarkers() {
        if (cityMarkersAttached) return;
        // 글로브 + city-videos 모두 준비될 때까지 폴링 (AURA.waitFor 사용)
        if (!window.globeInstance || !window.AURA_CITY_VIDEOS) {
            if (window.AURA?.waitFor) {
                window.AURA.waitFor(
                    () => !!window.globeInstance && !!window.AURA_CITY_VIDEOS,
                    () => { if (!cityMarkersAttached) attachCityMarkers(); },
                    { maxAttempts: 10, delay: 1000, label: 'attachCityMarkers' }
                );
            }
            return;
        }
        // 사용자 요청: "빨간 country 마커도 노란 도시처럼 박힘" → 통합 레이어로 위임
        // app.js 의 refreshGlobeLabels 가 city + country 합쳐서 single labelsData 로 그림.
        cityMarkersAttached = true;
        if (typeof window.refreshGlobeLabels === 'function') {
            window.refreshGlobeLabels();
        }
    }

    // ─── Init ───
    // 영상 재생 중 마우스 하단 근처(80px 안) 감지 → 도크 노출
    function bindNearBottomDetect() {
        if (bindNearBottomDetect._bound) return;
        bindNearBottomDetect._bound = true;
        let lastY = -1;
        document.addEventListener('mousemove', e => {
            // 영상 재생 중일 때만
            if (!document.body.classList.contains('amb-has-video')) return;
            const fromBottom = window.innerHeight - e.clientY;
            const near = fromBottom < 90;
            if (near !== (lastY < 90 && lastY >= 0)) {
                document.body.classList.toggle('amb-near-bottom', near);
            }
            lastY = fromBottom;
        }, { passive: true });
        // 모바일: 화면 하단 swipe-up 으로 잠시 노출
        let touchStartY = 0;
        document.addEventListener('touchstart', e => { touchStartY = e.touches[0]?.clientY || 0; }, { passive: true });
        document.addEventListener('touchend', e => {
            if (!document.body.classList.contains('amb-has-video')) return;
            const dy = touchStartY - (e.changedTouches[0]?.clientY || touchStartY);
            const fromBottomStart = window.innerHeight - touchStartY;
            if (dy > 30 && fromBottomStart < 120) {
                document.body.classList.add('amb-near-bottom');
                clearTimeout(bindNearBottomDetect._t);
                bindNearBottomDetect._t = setTimeout(() => document.body.classList.remove('amb-near-bottom'), 3000);
            }
        }, { passive: true });
    }

    function init() {
        load();
        injectStyles();
        buildModeToggle();
        buildCityPanel();
        buildFavorites();
        bindNearBottomDetect();

        document.body.classList.toggle('ambient-mode', state.mode === 'ambient');
        document.body.classList.toggle('insight-mode', state.mode === 'insight');

        // 지구본 자동회전 (Ambient) — AURA.waitFor 로 통합
        setTimeout(() => {
            if (state.mode === 'ambient' && window.AURA?.waitFor) {
                window.AURA.waitFor(
                    () => !!(window.globeInstance && window.globeInstance.controls),
                    () => {
                        try {
                            const ctrl = window.globeInstance.controls();
                            ctrl.autoRotate = true;
                            ctrl.autoRotateSpeed = 0.4;
                        } catch (e) { window.AURA?.dbgWarn?.('autoRotate', e); }
                    },
                    { maxAttempts: 15, delay: 800, label: 'autoRotate' }
                );
            }
            attachCityMarkers();
        }, 2500);

        // ─── ESC 키로 영상/도시 닫기 ───
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                // 카페 모드면 카페 모드 끄기 우선
                if (document.body.classList.contains('cafe-mode')) {
                    if (window.AURA_CAFE?.disable) window.AURA_CAFE.disable();
                    return;
                }
                // 다른 모달이 열려있으면 무시 (그 모달이 처리)
                const modalOpen = document.querySelector('.cat-modal.open, .charts-modal.open, .fx-bd.open, .fl-bd.open, .cost-bd.open');
                if (modalOpen) return;
                // 도시 패널이 열려있으면 닫기
                if (state.currentCity) {
                    closeCity();
                }
            }
        });

        track('page_view', { mode: state.mode });
    }

    window.AURA_AMBIENT = {
        openCity,
        closeCity,
        setMode,
        toggleSound,
        getState: () => ({ ...state })
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
