// AURA — CAFE LOUNGE MODE (카페에서 일/공부 위해 풀스크린 영상 + 뉴스 티커)
'use strict';
(function() {

    const STORAGE_KEY = 'aura_cafe_mode_v1';
    let isCafeMode = false;
    let tickerInterval = null;
    let tickerIndex = 0;
    let idleTimer = null;

    // ─── i18n (사용자 요청: 카페모드 번역 영어/다른 언어로) ────────────────
    const I18N = {
        ko: {
            searchCity: '도시 검색...',
            noMatches: '결과 없음',
            pickCity: '도시를 선택하세요',
            loadingNews: '뉴스 수집 중...',
            loadingFx: '환율 데이터 로딩 중',
            cafeMode: '카페 모드',
            exit: '나가기',
            esc: 'ESC 로 종료',
            playMusic: '음악',
            mute: '음소거',
            cityList: '도시 목록',
            news: '뉴스',
            weather: '날씨',
            airQuality: '대기질',
            time: '시간',
            volume: '볼륨'
        },
        en: {
            searchCity: 'Search city...',
            noMatches: 'No matches',
            pickCity: 'Pick a city',
            loadingNews: 'Loading news...',
            loadingFx: 'FX loading',
            cafeMode: 'Café Mode',
            exit: 'Exit',
            esc: 'ESC to exit',
            playMusic: 'Music',
            mute: 'Mute',
            cityList: 'Cities',
            news: 'News',
            weather: 'Weather',
            airQuality: 'Air',
            time: 'Time',
            volume: 'Volume'
        },
        ja: {
            searchCity: '都市を検索...',
            noMatches: '該当なし',
            pickCity: '都市を選んでください',
            loadingNews: 'ニュース読み込み中...',
            loadingFx: '為替読み込み中',
            cafeMode: 'カフェモード',
            exit: '終了',
            esc: 'ESCで終了',
            playMusic: '音楽',
            mute: 'ミュート',
            cityList: '都市一覧',
            news: 'ニュース',
            weather: '天気',
            airQuality: '空気',
            time: '時刻',
            volume: '音量'
        },
        zh: {
            searchCity: '搜索城市...',
            noMatches: '无结果',
            pickCity: '选择城市',
            loadingNews: '新闻加载中...',
            loadingFx: '汇率加载中',
            cafeMode: '咖啡馆模式',
            exit: '退出',
            esc: '按ESC退出',
            playMusic: '音乐',
            mute: '静音',
            cityList: '城市',
            news: '新闻',
            weather: '天气',
            airQuality: '空气',
            time: '时间',
            volume: '音量'
        },
        es: {
            searchCity: 'Buscar ciudad...',
            noMatches: 'Sin resultados',
            pickCity: 'Elige una ciudad',
            loadingNews: 'Cargando noticias...',
            loadingFx: 'Cargando divisas',
            cafeMode: 'Modo Café',
            exit: 'Salir',
            esc: 'ESC para salir',
            playMusic: 'Música',
            mute: 'Silenciar',
            cityList: 'Ciudades',
            news: 'Noticias',
            weather: 'Clima',
            airQuality: 'Aire',
            time: 'Hora',
            volume: 'Volumen'
        },
        fr: {
            searchCity: 'Rechercher une ville...',
            noMatches: 'Aucun résultat',
            pickCity: 'Choisissez une ville',
            loadingNews: 'Chargement des actualités...',
            loadingFx: 'Chargement des devises',
            cafeMode: 'Mode Café',
            exit: 'Quitter',
            esc: 'ECHAP pour sortir',
            playMusic: 'Musique',
            mute: 'Muet',
            cityList: 'Villes',
            news: 'Actualités',
            weather: 'Météo',
            airQuality: 'Air',
            time: 'Heure',
            volume: 'Volume'
        },
        ar: {
            searchCity: 'ابحث عن مدينة...',
            noMatches: 'لا توجد نتائج',
            pickCity: 'اختر مدينة',
            loadingNews: 'جارٍ تحميل الأخبار...',
            loadingFx: 'جارٍ تحميل أسعار الصرف',
            cafeMode: 'وضع المقهى',
            exit: 'خروج',
            esc: 'ESC للخروج',
            playMusic: 'موسيقى',
            mute: 'كتم',
            cityList: 'المدن',
            news: 'أخبار',
            weather: 'الطقس',
            airQuality: 'الهواء',
            time: 'الوقت',
            volume: 'الصوت'
        }
    };
    function L(key) {
        const lang = window.state?.lang || 'en';
        return I18N[lang]?.[key] || I18N.en[key] || key;
    }

    function injectStyles() {
        if (document.getElementById('cafeStyles')) return;
        const s = document.createElement('style');
        s.id = 'cafeStyles';
        s.textContent = `
/* ─── CAFE MODE 활성화 시 적용 ─── */
body.cafe-mode .topbar,
body.cafe-mode .control-bar,
body.cafe-mode .right-drawer,
body.cafe-mode .left-drawer,
body.cafe-mode .bottom-dock,
body.cafe-mode #signalsBoard,
body.cafe-mode .amb-mode-toggle,
body.cafe-mode .amb-favs,
body.cafe-mode .amb-city-panel,
body.cafe-mode .mlp,
body.cafe-mode .mlp-toggle-btn,
body.cafe-mode .fresh-badge,
body.cafe-mode .hero-tag {
    transition: opacity .8s ease;
    opacity: 0;
    pointer-events: none;
}
body.cafe-mode.cafe-show-ui .topbar,
body.cafe-mode.cafe-show-ui .control-bar,
body.cafe-mode.cafe-show-ui .bottom-dock,
body.cafe-mode.cafe-show-ui .amb-mode-toggle,
body.cafe-mode.cafe-show-ui .amb-favs,
body.cafe-mode.cafe-show-ui .mlp,
body.cafe-mode.cafe-show-ui .fresh-badge {
    opacity: 1;
    pointer-events: auto;
}

/* 영상 풀스크린 — base CSS의 max-height/max-width override 필수 (사용자 보고: 반쪽만 나옴) */
body.cafe-mode .amb-video-container {
    bottom: 0 !important;
    right: 0 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    z-index: 30 !important;
}

/* 카페 모드 — 지구본/마커/레이어/HUD 숨김 (영상 뒤로 비치는 거 방지) */
body.cafe-mode .layer-controls,
body.cafe-mode .stage-hud,
body.cafe-mode .lock-indicator {
    opacity: 0 !important;
    pointer-events: none !important;
    transition: opacity .6s ease;
}
/* #globe는 style.css의 display:none이 처리 */

/* 카페 모드 토글 transition guard — 빠른 클릭 시 ghost 상태 방지 */
body.cafe-mode-transitioning .cafe-toggle {
    pointer-events: none !important;
    opacity: 0.6;
}

/* 카페 모드 토글 버튼 (항상 노출) */
.cafe-toggle {
    position: fixed;
    /* 사용자 요청: "오른쪽 위로 올려" — 우상단 코너 */
    top: 90px;
    right: 14px;
    left: auto;
    z-index: var(--z-modal, 9000);
    padding: 9px 16px;
    background: rgba(15,18,22,.92);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 999px;
    color: #fff;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    cursor: pointer;
    backdrop-filter: blur(14px);
    transition: all .25s;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 14px rgba(0,0,0,.3);
}
.cafe-toggle:hover { background: rgba(255,255,255,.12); }
.cafe-toggle.active {
    background: linear-gradient(135deg, #ff8a4c, #ffb627);
    border-color: transparent;
    color: #1a0a00;
}

/* 모바일 — iOS FAB 풍 (우측 하단, 64px round, gradient orange→red, shadow-fab) */
/* v564 — Linear hairline + shadow-fab 토큰 (orange→red 유지). 5탭 dock 위에 위치. */
@media (max-width: 768px) {
    .cafe-toggle {
        top: auto !important;
        right: 14px !important;
        bottom: calc(78px + env(safe-area-inset-bottom, 0px)) !important;
        width: 56px !important;
        height: 56px !important;
        padding: 0 !important;
        border-radius: 999px !important;
        background: linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%) !important;
        border: 0.5px solid rgba(255, 255, 255, 0.18) !important;
        color: #fff !important;
        font-size: 22px !important;
        line-height: 1 !important;
        box-shadow: var(--shadow-fab,
            0 0 0 1px rgba(255,255,255,.06) inset,
            0 4px 12px rgba(255, 69, 58, 0.32),
            0 12px 28px rgba(0, 0, 0, 0.55)
        ) !important;
        gap: 0 !important;
        z-index: var(--z-fab, 250) !important;
        transition:
            transform 0.12s var(--ease-linear, cubic-bezier(.4,0,.2,1)),
            box-shadow 0.18s var(--ease-linear) !important;
    }
    .cafe-toggle:active {
        transform: scale(0.94) !important;
    }
    .cafe-toggle.active {
        background: linear-gradient(135deg, #BF5AF2 0%, #5E6AD2 100%) !important;
        color: #fff !important;
        box-shadow:
            0 0 0 1px rgba(255,255,255,.08) inset,
            0 4px 16px rgba(94, 106, 210, 0.4),
            0 12px 28px rgba(0, 0, 0, 0.55) !important;
    }
    /* 모바일 FAB 의 텍스트 라벨 숨김 — 아이콘만 (☕) */
    .cafe-toggle > .cafe-toggle-label { display: none !important; }
}

/* 뉴스 티커 (카페 모드 하단) */
.cafe-ticker {
    display: none !important;  /* 영구 제거 - 사용자 요청 */
}
body.cafe-mode .cafe-ticker { display: none !important; }

.cafe-ticker-label {
    flex-shrink: 0;
    padding: 0 18px;
    height: 100%;
    display: flex;
    align-items: center;
    background: rgba(var(--accent-rgb, 255,138,76), 0.18);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.15em;
    border-right: 1px solid rgba(255,255,255,.1);
}
.cafe-ticker-label::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
    margin-right: 8px;
    box-shadow: 0 0 10px #ef4444;
    animation: tickerBlink 1.6s ease-in-out infinite;
}
@keyframes tickerBlink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }

.cafe-ticker-track {
    flex: 1;
    overflow: hidden;
    height: 100%;
    position: relative;
}
.cafe-ticker-strip {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 28px;
    white-space: nowrap;
    animation: tickerScroll 90s linear infinite;
    padding-left: 100%;
}
@keyframes tickerScroll {
    0%   { transform: translateY(-50%) translateX(0); }
    100% { transform: translateY(-50%) translateX(-100%); }
}
.cafe-ticker-strip:hover { animation-play-state: paused; }

.cafe-ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #fff;
    font-family: var(--font-body, system-ui);
    font-size: 14px;
    font-weight: 500;
}
.cafe-ticker-flag { font-size: 16px; }
.cafe-ticker-source {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255,255,255,.5);
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 3px 7px;
    background: rgba(255,255,255,.08);
    border-radius: 4px;
}
.cafe-ticker-sep {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255,255,255,.3);
}

/* 카페 모드 - 도시 정보 (좌상단 미니멀) */
.cafe-info {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: var(--z-modal, 9000);
    color: #fff;
    display: none;
    pointer-events: none;
}
body.cafe-mode .cafe-info { display: block; }
.cafe-info-city {
    font-family: var(--font-display, 'Orbitron', sans-serif);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 16px rgba(0,0,0,.8);
}
.cafe-info-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,.7);
    letter-spacing: 0.06em;
    margin-top: 2px;
    text-shadow: 0 1px 6px rgba(0,0,0,.8);
}

/* 사운드 컨트롤 (우하단 미니) — 사용자 요청: 음악 컨트롤 패널과 중복 → 비활성화 */
.cafe-sound { display: none !important; }
.cafe-sound-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}
.cafe-sound-slider {
    -webkit-appearance: none;
    width: 80px;
    height: 4px;
    background: rgba(255,255,255,.25);
    border-radius: 999px;
    outline: none;
}
.cafe-sound-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
}

/* 도시 빠른 전환 (우상단 - 토글 옆) */
.cafe-city-switcher {
    position: fixed;
    top: 60px;
    right: 14px;
    z-index: var(--z-modal, 9000);
    display: none;
    flex-direction: column;
    gap: 4px;
    max-height: 60vh;
    overflow-y: auto;
    padding: 8px;
    background: rgba(15,18,22,.92);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px;
    backdrop-filter: blur(14px);
    width: 180px;
    scrollbar-width: thin;
}
body.cafe-mode.cafe-show-ui .cafe-city-switcher { display: flex; }
.cafe-city-item {
    padding: 7px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: rgba(255,255,255,.85);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    transition: all .15s;
}
.cafe-city-item:hover { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); }
.cafe-city-item.active {
    background: rgba(var(--accent-rgb, 255,138,76), 0.18);
    color: #fff;
    border-color: rgba(var(--accent-rgb, 255,138,76), 0.35);
}

@media (max-width: 700px) {
    .cafe-info-city { font-size: 18px; }
    .cafe-ticker { height: 48px; }
    .cafe-ticker-item { font-size: 12px; }
    .cafe-city-switcher { width: 140px; right: 10px; }
}

/* ─── 모바일 카페모드 폴리싱 (iOS Now Playing / Lock Screen 느낌) ─── */
@media (max-width: 768px) {
    /* 영상 위 상단 그라디언트 — 도시 정보 가독성 + Apple 무드 */
    body.cafe-mode::before {
        content: '';
        position: fixed; top: 0; left: 0; right: 0; height: 220px;
        background: linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.18) 60%, rgba(0,0,0,0) 100%);
        z-index: 35; pointer-events: none;
        opacity: 0; transition: opacity .6s cubic-bezier(.4,0,.2,1);
    }
    body.cafe-mode::after {
        content: '';
        position: fixed; bottom: 0; left: 0; right: 0; height: 180px;
        background: linear-gradient(0deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.18) 60%, rgba(0,0,0,0) 100%);
        z-index: 35; pointer-events: none;
        opacity: 0; transition: opacity .6s cubic-bezier(.4,0,.2,1);
    }
    body.cafe-mode::before, body.cafe-mode::after { opacity: 1; }
    /* cafe-info 위치 + 타이포 (Apple Lock Screen 스타일 — 큰 시간, 작은 도시명) */
    body.cafe-mode .cafe-info {
        top: calc(20px + env(safe-area-inset-top, 0px)) !important;
        left: 18px !important;
        z-index: var(--z-modal, 9000);
    }
    .cafe-info-time {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
        font-size: 56px;
        font-weight: 200;
        letter-spacing: -0.04em;
        line-height: 1;
        color: #fff;
        text-shadow: 0 2px 24px rgba(0,0,0,.55);
        margin-bottom: 6px;
    }
    body.cafe-mode .cafe-info-city {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif !important;
        font-size: 22px !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
        line-height: 1.15;
        text-shadow: 0 2px 14px rgba(0,0,0,.6);
    }
    body.cafe-mode .cafe-info-meta {
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif !important;
        font-size: 13px !important;
        letter-spacing: 0 !important;
        font-weight: 500;
        color: rgba(255,255,255,.78);
        margin-top: 3px;
    }
    /* 카페 모드 음악 컨트롤 — iOS pill 강화 (블러 ↑, 라운드 ↑) */
    body.cafe-mode .music-control {
        background: rgba(20,20,28,.42) !important;
        border-radius: 22px !important;
        border: 0.5px solid rgba(255,255,255,.16) !important;
        backdrop-filter: blur(28px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
        box-shadow: 0 12px 40px rgba(0,0,0,.45) !important;
    }
    /* 카페 토글 ☕ 활성 — iOS Liquid Glass 느낌, 더 부드럽게 */
    body.cafe-mode .cafe-toggle {
        background: rgba(20,20,28,.42) !important;
        border: 0.5px solid rgba(255,255,255,.22) !important;
        backdrop-filter: blur(28px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
        box-shadow: 0 10px 30px rgba(0,0,0,.45);
        transition: transform .25s cubic-bezier(.4,0,.2,1), background .3s, box-shadow .3s;
    }
    body.cafe-mode .cafe-toggle:active { transform: scale(.92); }
    body.cafe-mode .cafe-toggle.active {
        background: linear-gradient(135deg, rgba(255,138,76,.94), rgba(255,182,39,.94)) !important;
        box-shadow: 0 12px 36px rgba(255,138,76,.45);
        border-color: transparent !important;
    }
    /* 영상 컨테이너 — 부드러운 fade-in */
    body.cafe-mode .amb-video-container {
        animation: cafeFadeIn .9s cubic-bezier(.4,0,.2,1) both;
    }
    @keyframes cafeFadeIn {
        from { opacity: 0; transform: scale(1.02); }
        to   { opacity: 1; transform: scale(1); }
    }
}
        `;
        document.head.appendChild(s);
    }

    // ─── 토글 버튼 빌드 ───
    function buildToggle() {
        if (document.getElementById('cafeToggle')) return;
        const btn = document.createElement('button');
        btn.id = 'cafeToggle';
        btn.className = 'cafe-toggle';
        // v588 사용자: '카페 버튼 비행기 모형' — ☕ → ✈️
        btn.innerHTML = '<span class="cafe-toggle-icon" aria-hidden="true">✈️</span><span class="cafe-toggle-label">CAFÉ</span>';
        btn.addEventListener('click', () => {
            // 햅틱 진동 (iPhone 느낌, Android 만 작동 — iOS Safari 는 정책상 무음)
            try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { window.AURA?.dbgWarn?.("caught", e); }
            // v588 사용자: '영상 풀스크린 시 가로 자동 회전' — orientation lock landscape
            try {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            } catch (e) {}
            toggle();
        });
        document.body.appendChild(btn);
    }

    function buildTicker() {
        if (document.getElementById('cafeTicker')) return;
        const ticker = document.createElement('div');
        ticker.id = 'cafeTicker';
        ticker.className = 'cafe-ticker';

        const label = document.createElement('div');
        label.className = 'cafe-ticker-label';
        label.textContent = 'LIVE';
        ticker.appendChild(label);

        const track = document.createElement('div');
        track.className = 'cafe-ticker-track';
        const strip = document.createElement('div');
        strip.className = 'cafe-ticker-strip';
        strip.id = 'cafeTickerStrip';
        track.appendChild(strip);
        ticker.appendChild(track);

        document.body.appendChild(ticker);
    }

    function buildInfo() {
        if (document.getElementById('cafeInfo')) return;
        const info = document.createElement('div');
        info.id = 'cafeInfo';
        info.className = 'cafe-info';
        document.body.appendChild(info);
    }

    function buildSound() {
        if (document.getElementById('cafeSound')) return;
        const wrap = document.createElement('div');
        wrap.id = 'cafeSound';
        wrap.className = 'cafe-sound';

        const btn = document.createElement('button');
        btn.className = 'cafe-sound-btn';
        btn.id = 'cafeSoundBtn';
        btn.textContent = '🔇';
        btn.addEventListener('click', () => {
            if (window.AURA_AMBIENT?.toggleSound) window.AURA_AMBIENT.toggleSound();
            updateSoundUI();
        });
        wrap.appendChild(btn);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.05';
        slider.value = '0.5';
        slider.className = 'cafe-sound-slider';
        slider.addEventListener('input', e => {
            const vol = parseFloat(e.target.value);
            try {
                localStorage.setItem('aura_volume', String(vol));
                const sframe = document.getElementById('ambSoundFrame');
                if (sframe?.contentWindow) {
                    sframe.contentWindow.postMessage(
                        JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(vol * 100)] }),
                        '*'
                    );
                }
            } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        });
        wrap.appendChild(slider);

        document.body.appendChild(wrap);
    }

    function buildCitySwitcher() {
        if (document.getElementById('cafeCitySwitcher')) return;
        const wrap = document.createElement('div');
        wrap.id = 'cafeCitySwitcher';
        wrap.className = 'cafe-city-switcher';
        document.body.appendChild(wrap);
        renderCitySwitcher();
    }

    let citySearchQuery = '';
    function renderCitySwitcher() {
        const wrap = document.getElementById('cafeCitySwitcher');
        if (!wrap || !window.AURA_CITY_VIDEOS) return;
        while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
        const isKo = window.state?.lang === 'ko';

        // 검색 박스 (도시 92개 → 검색 필요) — 사용자 요청: 도시 더 늘려
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.value = citySearchQuery;
        searchInput.placeholder = L('searchCity');
        searchInput.style.cssText = `
            background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.15);
            border-radius: 6px; padding: 6px 10px; color: #fff;
            font-family: var(--font-mono,monospace); font-size: 11px;
            outline: none; margin-bottom: 4px;
        `;
        searchInput.addEventListener('input', e => {
            citySearchQuery = e.target.value.toLowerCase();
            renderCitySwitcher();
            const fresh = document.querySelector('#cafeCitySwitcher input[type=text]');
            if (fresh) {
                fresh.focus();
                fresh.setSelectionRange(citySearchQuery.length, citySearchQuery.length);
            }
        });
        wrap.appendChild(searchInput);

        const cities = window.AURA_CITY_VIDEOS.getCityList();
        const current = window.AURA_AMBIENT?.getState?.()?.currentCity;
        const q = citySearchQuery;
        const filtered = q
            ? cities.filter(c => c.name.toLowerCase().includes(q) || (c.ko || '').toLowerCase().includes(q))
            : cities;
        filtered.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cafe-city-item' + (c.name === current ? ' active' : '');
            btn.textContent = `${c.name === current ? '▶ ' : ''}${isKo ? c.ko : c.name}`;
            btn.addEventListener('click', () => {
                if (window.AURA_AMBIENT?.openCity) window.AURA_AMBIENT.openCity(c.name);
                // 카페 모드 도시 선택 기억 (다음 진입 시 복원용)
                try { localStorage.setItem('aura_cafe_last_city', c.name); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
                updateInfo();
                renderCitySwitcher();
            });
            wrap.appendChild(btn);
        });
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:8px;color:rgba(255,255,255,.4);font-size:11px;text-align:center';
            empty.textContent = L('noMatches');
            wrap.appendChild(empty);
        }
    }

    function updateInfo() {
        const info = document.getElementById('cafeInfo');
        if (!info) return;
        const isKo = window.state?.lang === 'ko';
        const ambState = window.AURA_AMBIENT?.getState?.();
        const cityName = ambState?.currentCity;
        if (!cityName) {
            info.innerHTML = `<div class="cafe-info-city">${L('pickCity')}</div>`;
            return;
        }
        const city = window.AURA_CITY_VIDEOS?.getCity(cityName);
        if (!city) return;

        // 날씨: cityWeather 객체에서 lat,lng 키로 조회
        const w = window.state?.cityWeather?.[`${city.lat},${city.lng}`];
        const tempStr = w?.temp ? `${Math.round(w.temp)}°` : '';

        // 도시 이름 정리
        const displayName = isKo ? (city.ko || cityName) : cityName;
        const status = (isKo ? city.status?.ko : city.status?.en) || '';

        // 도시 현지 시간 (Apple Lock Screen 느낌). 도시 lat/lng 으로 IANA 추정 어렵지 → 사용자 로컬 시간 표시.
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        info.innerHTML = `
            <div class="cafe-info-time">${timeStr}</div>
            <div class="cafe-info-city">${displayName}</div>
            <div class="cafe-info-meta">${status}${tempStr ? ' · ' + tempStr : ''}</div>
        `;
    }

    function updateSoundUI() {
        const btn = document.getElementById('cafeSoundBtn');
        if (!btn) return;
        const ambState = window.AURA_AMBIENT?.getState?.();
        btn.textContent = ambState?.soundOn ? '🔊' : '🔇';
    }

    // ─── 뉴스 티커 갱신 ───
    function updateTicker() {
        const strip = document.getElementById('cafeTickerStrip');
        if (!strip) return;

        // 핵심만: 최근 뉴스 30개
        const articles = (window.state?.allArticles || [])
            .filter(a => a && a.title && a.publishedAt)
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .slice(0, 30);

        if (articles.length === 0) {
            // 폴백: 환율/날씨/시간
            const isKo = window.state?.lang === 'ko';
            strip.innerHTML = `
                <span class="cafe-ticker-item">📰 ${L('loadingNews')}</span>
                <span class="cafe-ticker-sep"></span>
                <span class="cafe-ticker-item">💵 ${L('loadingFx')}</span>
            `;
            return;
        }

        while (strip.firstChild) strip.removeChild(strip.firstChild);
        // 2번 반복으로 부드러운 무한 스크롤
        for (let rep = 0; rep < 2; rep++) {
            articles.forEach((a, i) => {
                const item = document.createElement('span');
                item.className = 'cafe-ticker-item';

                // 출처 칩
                if (a.source) {
                    const src = document.createElement('span');
                    src.className = 'cafe-ticker-source';
                    src.textContent = a.source.slice(0, 14);
                    item.appendChild(src);
                }
                // 제목
                const text = document.createTextNode(' ' + (a.title.length > 90 ? a.title.slice(0, 88) + '…' : a.title));
                item.appendChild(text);

                strip.appendChild(item);

                if (i < articles.length - 1) {
                    const sep = document.createElement('span');
                    sep.className = 'cafe-ticker-sep';
                    strip.appendChild(sep);
                }
            });
        }
    }

    // ─── 마우스/키보드 이동 시 UI 노출 → 5초 idle 후 fade ───
    function showUI() {
        document.body.classList.add('cafe-show-ui');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            document.body.classList.remove('cafe-show-ui');
        }, 5000);
    }

    function bindIdle() {
        ['mousemove', 'keydown', 'touchstart', 'click'].forEach(ev => {
            document.addEventListener(ev, () => {
                if (isCafeMode) showUI();
            });
        });
    }

    // ─── 토글 ───
    function enable() {
        isCafeMode = true;
        document.body.classList.add('cafe-mode');
        document.getElementById('cafeToggle')?.classList.add('active');
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }

        // 도시 선택 안 된 상태로 카페 모드 진입 → 마지막 도시 복원 (사용자 요청) → 없으면 기본
        const ambState = window.AURA_AMBIENT?.getState?.();
        if (!ambState?.currentCity && window.AURA_AMBIENT?.openCity && window.AURA_CITY_VIDEOS) {
            const cities = window.AURA_CITY_VIDEOS.getCityList?.() || [];
            const isKo = window.state?.lang === 'ko';
            // 1순위: localStorage 저장된 마지막 카페 도시
            let pick = null;
            try {
                const last = localStorage.getItem('aura_cafe_last_city');
                if (last && cities.find(c => c.name === last)) pick = { name: last };
            } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
            // 2순위: 한국어면 Seoul / 그외는 첫 도시
            if (!pick) pick = isKo ? (cities.find(c => c.name === 'Seoul') || cities[0]) : cities[0];
            if (pick?.name) window.AURA_AMBIENT.openCity(pick.name);
        }
        // 카페 진입 후 도시 변경 시 last_city 자동 저장 (renderCitySwitcher 클릭에서 수행)
        if (ambState?.currentCity) {
            try { localStorage.setItem('aura_cafe_last_city', ambState.currentCity); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        }

        updateTicker();
        updateInfo();
        updateSoundUI();
        renderCitySwitcher();
        showUI();

        // 1분마다 티커 갱신
        if (tickerInterval) clearInterval(tickerInterval);
        tickerInterval = setInterval(() => {
            updateTicker();
            updateInfo();
        }, 60000);

        if (window.AURA_GA) window.AURA_GA.track('cafe_mode_on');
    }

    function disable() {
        isCafeMode = false;
        document.body.classList.remove('cafe-mode');
        document.body.classList.remove('cafe-show-ui');
        document.getElementById('cafeToggle')?.classList.remove('active');
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        if (tickerInterval) { clearInterval(tickerInterval); tickerInterval = null; }
        if (window.AURA_GA) window.AURA_GA.track('cafe_mode_off');
    }

    let toggling = false;
    function toggle() {
        if (toggling) return; // 중복 클릭 무시 (transition 진행 중)
        toggling = true;
        document.body.classList.add('cafe-mode-transitioning');
        if (isCafeMode) disable();
        else enable();
        // 0.85s = transition .8s + safety
        setTimeout(() => {
            toggling = false;
            document.body.classList.remove('cafe-mode-transitioning');
        }, 850);
    }

    // ─── Init ───
    function init() {
        injectStyles();
        buildToggle();
        buildTicker();
        buildInfo();
        buildSound();
        buildCitySwitcher();
        bindIdle();

        // 페이지 진입 시 cafe-mode 클래스 강제 제거 (이전 세션 잔존 방어)
        document.body.classList.remove('cafe-mode');
        document.body.classList.remove('cafe-show-ui');
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { if (window.AURA && window.AURA.dbgWarn) window.AURA.dbgWarn('caught', e); }
        isCafeMode = false;
    }

    window.AURA_CAFE = {
        enable, disable, toggle,
        isActive: () => isCafeMode,
        updateTicker, updateInfo, updateSoundUI,
        renderCitySwitcher
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
