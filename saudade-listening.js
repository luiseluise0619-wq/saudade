// SAUDADE · § 05 THE LISTENING ROOM (Handoff v2 §5.5)
// 분기 발행. 도시 사운드 1시간 트랙 (3~4곡). 음악 X — 자연 + 기계 소리만.
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
    // v6 §11.2 — Work session timer (50 min work + 10 min rest)
    let _sessionStart = null;   // ms timestamp 세션 시작
    let _sessionPhase = 'idle'; // 'idle' | 'work' | 'rest'
    let _sessionTickIv = null;  // setInterval id (1s tick)
    const SESSION_WORK_MIN = 50;
    const SESSION_REST_MIN = 10;
    const SESSION_KEY = 'saudade.listening.sessions';   // 헌법 §9 키

    function load() {
        if (_data) return Promise.resolve(_data);
        return fetch('./data/listening.json', { cache: 'force-cache' })
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
    background: var(--ink);          /* Listening Room = Skin B (Ink) 자동 */
    color: var(--paper);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.listening-active .sdd-listen { display: block; }

.sdd-listen-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid rgba(242,238,227,.18);
}
.sdd-listen-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--paper);
    margin: 0;
}
.sdd-listen-h2 .it { font-style: italic; display: block; }

.sdd-listen-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: rgba(242,238,227,.55);
    margin: 12px 0 0;
}

.sdd-listen-back {
    position: fixed;
    top: 24px; left: 24px;
    z-index: calc(var(--z-section-page, 8) + 1);
    background: transparent;
    border: 0.5px solid rgba(242,238,227,.32);
    color: rgba(242,238,227,.85);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    padding: 10px 14px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 4px;
    transition: color .12s, border-color .12s;
}
.sdd-listen-back:hover { color: var(--paper); border-color: var(--paper); }
.sdd-listen-back::before { content: '← '; }

.sdd-listen-track {
    display: grid;
    grid-template-columns: 80px 1fr 100px;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid rgba(242,238,227,.18);
    align-items: baseline;
    cursor: pointer;
    transition: background .12s;
}
.sdd-listen-track:last-child { border-bottom: 0.5px solid rgba(242,238,227,.18); }
.sdd-listen-track:hover { background: rgba(242,238,227,.04); }
.sdd-listen-track[aria-current="true"] { background: rgba(242,238,227,.06); }

.sdd-listen-num {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: rgba(242,238,227,.55);
}
.sdd-listen-num .marker {
    display: inline-block;
    margin-right: 6px;
    color: rgba(242,238,227,.4);
}
.sdd-listen-track[aria-current="true"] .sdd-listen-num .marker { color: var(--paper); }
.sdd-listen-track[aria-current="true"] .sdd-listen-num .marker::before { content: '\\25B6 '; }

.sdd-listen-body { display: flex; flex-direction: column; gap: 6px; }
.sdd-listen-city {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 3.5vw, 40px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--paper);
}
.sdd-listen-title {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.45;
    color: rgba(242,238,227,.85);
}
.sdd-listen-license {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: rgba(242,238,227,.45);
    margin-top: 4px;
}
.sdd-listen-license a {
    color: rgba(242,238,227,.65);
    border-bottom: 0.5px solid rgba(242,238,227,.18);
    text-decoration: none;
}
.sdd-listen-license a:hover { color: var(--paper); }

.sdd-listen-duration {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: rgba(242,238,227,.65);
    text-align: right;
    white-space: nowrap;
}

.sdd-listen-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid rgba(242,238,227,.18);
}
.sdd-listen-foot p {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: rgba(242,238,227,.55);
    max-width: 60ch;
    margin: 0;
}
.sdd-listen-foot p strong {
    font-weight: 500;
    color: var(--paper);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
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
    background: rgba(15,14,18,.92);
    border: 0.5px solid rgba(242,238,227,.32);
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    z-index: calc(var(--z-section-page, 8) + 1);
    border-radius: 0;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: rgba(242,238,227,.85);
}
.sdd-listen-ctl {
    background: transparent;
    border: 0;
    color: rgba(242,238,227,.85);
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
.sdd-listen-ctl:hover { color: var(--paper); }
.sdd-listen-ctl[aria-pressed="true"] { color: var(--paper); }
.sdd-listen-ctl-sep { color: rgba(242,238,227,.35); }
.sdd-listen-vol-label {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta);
    color: rgba(242,238,227,.55);
}
.sdd-listen-vol {
    -webkit-appearance: none;
    appearance: none;
    width: 100px;
    height: 1px;
    background: rgba(242,238,227,.3);
    outline: none;
    cursor: pointer;
}
.sdd-listen-vol::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 8px;
    height: 8px;
    background: var(--paper);
    border-radius: 50%;
    cursor: pointer;
}
.sdd-listen-vol::-moz-range-thumb {
    width: 8px;
    height: 8px;
    background: var(--paper);
    border-radius: 50%;
    border: 0;
    cursor: pointer;
}
.sdd-listen-vol-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-data);
    color: rgba(242,238,227,.65);
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
    color: rgba(242,238,227,.85);
    min-width: 80px;
    text-align: right;
}
.sdd-listen-session-state.work { color: var(--paper); }
.sdd-listen-session-state.rest { color: rgba(242,238,227,.55); }

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
    color: rgba(242,238,227,.4);
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
    .sdd-listen { padding: 88px 16px calc(var(--dock-h, 56px) + 80px); }
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
body.listening-active { background: var(--ink) !important; }

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

    function startSession() {
        if (_sessionPhase === 'work') return;
        _sessionStart = Date.now();
        _sessionPhase = 'work';
        bumpSessionsToday();
        if (_sessionTickIv) clearInterval(_sessionTickIv);
        _sessionTickIv = setInterval(tickSession, 1000);
        renderSessionState();
    }
    function pauseSession() {
        // 일시정지 = phase 유지, tick 만 멈춤. 재개 시 elapsed 보존 위해 _pausedAt 저장.
        if (_sessionTickIv) { clearInterval(_sessionTickIv); _sessionTickIv = null; }
    }
    function endSession() {
        _sessionPhase = 'idle';
        _sessionStart = null;
        if (_sessionTickIv) { clearInterval(_sessionTickIv); _sessionTickIv = null; }
        renderSessionState();
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
            // 끝나면 자연스럽게 다음 도시로 (헌법 §5.5.1) — 단순 다음 idx
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
                        city: _data?.tracks?.[_activeIdx]?.city || '',
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
        });
        return _audio;
    }

    function playTrack(idx) {
        const tracks = _data?.tracks || [];
        if (idx < 0 || idx >= tracks.length) return;
        const t = tracks[idx];
        if (!t.audio_url) return;
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
            // autoplay 차단 또는 audio file 없음 — UI 만 업데이트, 사용자 다시 클릭 유도
            _isPlaying = false;
            syncControlState();
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
    function safeUrl(u) {
        if (!u || typeof u !== 'string') return null;
        try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? url.toString() : null; }
        catch (e) { return null; }
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
        const issue = data?.issue || 3;
        const season = data?.season || 'Spring 2026';

        const tracksHtml = tracks.map((t, i) => {
            const dur = t.duration_minutes ? `${t.duration_minutes} MIN` : '';
            const licenseUrl = safeUrl(t.license_url);
            const licenseLine = licenseUrl
                ? `<a href="${licenseUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.license || '')}</a>`
                : escapeHtml(t.license || '');
            return `
                <article class="sdd-listen-track"
                         data-track-idx="${i}"
                         tabindex="0" role="button"
                         aria-label="${escapeHtml(t.city)} — ${escapeHtml(t.title)}">
                    <span class="sdd-listen-num"><span class="marker">  </span>${String(i + 1).padStart(2, '0')}</span>
                    <div class="sdd-listen-body">
                        <h3 class="sdd-listen-city">${escapeHtml(t.city)}</h3>
                        <p class="sdd-listen-title">${escapeHtml(t.title)}</p>
                        <p class="sdd-listen-license">${licenseLine}${t.credits ? ' · ' + escapeHtml(t.credits) : ''}</p>
                    </div>
                    <span class="sdd-listen-duration">${dur}</span>
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
        const issueLabel = T({
            en: 'ISSUE', ko: '호', ja: '号', pt: 'EDIÇÃO', es: 'EDICIÓN'
        });

        root.innerHTML = `
            <button class="sdd-listen-back" data-listen-back>${escapeHtml(backLabel)}</button>
            <header class="sdd-listen-head">
                <h2 class="sdd-listen-h2">
                    ${escapeHtml(headLabel)}
                    <span class="it">${escapeHtml(headItalic)}</span>
                </h2>
                <p class="sdd-listen-meta">${escapeHtml(issueLabel)} ${String(issue).padStart(2, '0')} · ${escapeHtml(season)} · ${escapeHtml(tracksLabel)}</p>
            </header>
            ${tracksHtml}
            <footer class="sdd-listen-foot">
                <p>
                    <strong>A note on sound.</strong>
                    Each track is recorded in person or licensed under Creative
                    Commons from Freesound.org. No music. No conversation.
                    The full license list is at saudade.app/listening-room/credits.
                </p>
            </footer>
            <!-- 컨트롤 바 — 직선 + 점만 (헌법 §5.5 둥근 버튼 X) + v6 §11.2 work session timer -->
            <div class="sdd-listen-controls">
                <button class="sdd-listen-ctl" data-listen-play aria-pressed="false">PLAY</button>
                <span class="sdd-listen-ctl-sep">·</span>
                <label class="sdd-listen-vol-label" for="sddListenVol">VOL</label>
                <input type="range" id="sddListenVol" class="sdd-listen-vol"
                       min="0" max="1" step="0.05" value="${initialVolume}"
                       aria-label="Volume" />
                <span class="sdd-listen-vol-num" data-vol-num>${Math.round(initialVolume * 100)}</span>
                <span class="sdd-listen-ctl-sep">·</span>
                <span class="sdd-listen-session-state" data-session-state></span>
            </div>
            <!-- 사용자만 보이는 sessions today 카운터 (공유 X — 헌법 §11.2) -->
            <p class="sdd-listen-session-counter" data-session-counter></p>
        `;

        root.querySelector('[data-listen-back]')?.addEventListener('click', () => close());

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

    function ensureCoverCTA() {
        if (document.getElementById('sddCoverListenCta')) return;
        const btn = document.createElement('button');
        btn.id = 'sddCoverListenCta';
        btn.className = 'sdd-cover-listen-cta';
        btn.type = 'button';
        btn.textContent = 'LISTENING ROOM';
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_LISTENING = { open, close, render, reload: () => { _data = null; init(); } };
})();
