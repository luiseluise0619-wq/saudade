// SAUDADE · v7 §13 — Magic Link auth (client) + Tour mode
// 신규. 가입 모달 (이메일 1줄), magic link 검증 (URL ?token=), localStorage 세션,
// "Browse without signing in" 둘러보기 모드.
//
// 의존: window.AURA_SERVER (worker URL).
// API:
//   window.SAUDADE_AUTH.openModal()        — 가입 모달 표시
//   window.SAUDADE_AUTH.signOut()          — 세션 폐기
//   window.SAUDADE_AUTH.getUser()          — { id, email, edition, tier } | null
//   window.SAUDADE_AUTH.isSignedIn()       — boolean
//   window.SAUDADE_AUTH.startTour()        — 둘러보기 모드 진입 (no signup)
// ═══════════════════════════════════════════════════════════════════════
// [파일 역할 배너 — 초보자 안내]
// saudade-auth.js = 브라우저(클라이언트) 쪽 로그인 담당. 백엔드의 매직 링크와 짝을 이룬다.
//   - 가입 모달(이메일 한 줄) 표시 → 서버 /auth/request 로 링크 요청
//   - 주소에 ?token=... 이 있으면 /auth/verify 로 검증해 로그인 확정
//   - 로그인 정보/세션 토큰을 localStorage 에 보관
//   - "가입 없이 둘러보기(Tour)" 모드 제공
// 다른 모듈은 window.SAUDADE_AUTH.getUser() 등으로 이 기능을 쓴다(전역 네임스페이스).
// ═══════════════════════════════════════════════════════════════════════
// SAUDADE · v7 §13 — Magic Link auth (client) + Tour mode 관련은 위 원문 주석 참고.
'use strict';

// IIFE(즉시 실행 함수) — 모듈 내부 변수를 전역에서 숨긴다.
(function() {
    // 중복 로드 방지 가드: 이미 SAUDADE_AUTH 가 있으면 즉시 종료(두 번 실행돼도 안전).
    if (window.SAUDADE_AUTH) return;

    // localStorage 에 쓸 키 이름들(사용자/둘러보기여부/세션토큰).
    const KEY_USER    = 'saudade.auth.user';
    const KEY_TOUR    = 'saudade.auth.tour';
    const KEY_SESSION = 'saudade.auth.session';   // opaque server session token (revocable)

    // 열려 있는 모달 DOM 요소를 기억하는 변수(없으면 null).
    let _modalEl = null;

    // L: 현재 판(언어)에 맞는 문구를 고르는 도우미. 없으면 영어.
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function copy() {
        return {
            modalLabel: L({
                en: 'Sign in to Saudade.',  ko: 'Saudade 로 로그인.',
                ja: 'Saudade にサインイン。',  pt: 'Entre na Saudade.',  es: 'Inicia sesión en Saudade.'
            }),
            modalIntro: L({
                en: 'One line. We send a sign-in link to your inbox. No password.',
                ko: '한 줄. 이메일로 로그인 링크를 보낸다. 비밀번호 없음.',
                ja: '一行。メールにサインインリンクを送る。パスワードなし。',
                pt: 'Uma linha. Enviamos um link para a sua caixa de entrada. Sem palavra-passe.',
                es: 'Una línea. Enviamos un enlace al correo. Sin contraseña.'
            }),
            fEmail:   L({ en: 'EMAIL', ko: '이메일', ja: 'メール', pt: 'EMAIL', es: 'CORREO' }),
            btnSend:  L({ en: 'SEND THE LINK', ko: '링크 받기', ja: 'リンクを送る', pt: 'ENVIAR O LINK', es: 'ENVIAR EL ENLACE' }),
            btnTour:  L({ en: 'BROWSE WITHOUT SIGNING IN', ko: '가입 없이 둘러보기', ja: '登録せずに見る', pt: 'NAVEGAR SEM REGISTO', es: 'NAVEGAR SIN REGISTRO' }),
            btnCancel:L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }),
            sentMsg:  L({
                en: 'Link sent. Check your inbox in a minute.',
                ko: '링크를 보냈다. 1분 안에 받은편지함을 확인하라.',
                ja: 'リンクを送った。一分以内に受信箱を確認。',
                pt: 'Link enviado. Verifique a sua caixa de entrada dentro de um minuto.',
                es: 'Enlace enviado. Revise su bandeja de entrada en un minuto.'
            }),
            sentInline: L({
                en: 'Link ready (inline mode):',
                ko: '링크 준비됨 (인라인 모드):',
                ja: 'リンク準備完了 (インラインモード):',
                pt: 'Link pronto (modo inline):',
                es: 'Enlace listo (modo inline):'
            }),
            failGeneric: L({
                en: 'Could not send. Please try again.',
                ko: '전송에 실패했다. 잠시 후 다시 시도하라.',
                ja: '送信できなかった。少し時間を置いて再試行。',
                pt: 'Não foi possível enviar. Tente novamente.',
                es: 'No se pudo enviar. Inténtelo de nuevo.'
            }),
            failClosed: L({
                en: 'Sign-in is not yet open. Try again later.',
                ko: '아직 로그인 창구가 열려 있지 않다. 잠시 후 다시 시도하라.',
                ja: 'サインインはまだ開いていない。後ほど再試行。',
                pt: 'O início de sessão ainda não está disponível. Tente mais tarde.',
                es: 'El inicio de sesión aún no está disponible. Inténtelo más tarde.'
            }),
            verifying: L({
                en: 'Verifying…', ko: '확인 중…', ja: '確認中…',
                pt: 'A verificar…', es: 'Verificando…'
            }),
            welcome: L({
                en: 'Welcome.', ko: '환영합니다.', ja: 'ようこそ。',
                pt: 'Bem-vindo.', es: 'Bienvenido.'
            })
        };
    }

    // escapeHtml: 사용자 입력을 화면에 넣기 전에 특수문자를 안전한 형태로 바꿈(XSS 방지).
    // 예: < 를 &lt; 로. 그래야 입력이 태그로 해석되어 스크립트가 실행되는 걸 막는다.
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // getUser: 저장된 로그인 사용자 정보를 읽음(JSON 파싱). 없거나 깨졌으면 null.
    function getUser() {
        // localStorage 접근/파싱은 실패할 수 있어 try/catch 필수.
        try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); }
        catch (e) { return null; }
    }
    // setUser: 사용자 정보 저장(u 가 있으면 저장, 없으면 삭제 = 로그아웃).
    function setUser(u) {
        try {
            if (u) localStorage.setItem(KEY_USER, JSON.stringify(u));
            else localStorage.removeItem(KEY_USER);
        } catch (e) {}
    }
    // getSessionToken: 서버 세션 토큰 읽기(이후 요청 인증에 씀).
    function getSessionToken() {
        try { return localStorage.getItem(KEY_SESSION) || null; } catch (e) { return null; }
    }
    // setSessionToken: 세션 토큰 저장/삭제.
    function setSessionToken(t) {
        try {
            if (t) localStorage.setItem(KEY_SESSION, t);
            else localStorage.removeItem(KEY_SESSION);
        } catch (e) {}
    }
    // authHeaders: 서버 요청에 붙일 헤더를 만든다. 세션 토큰이 있으면 Authorization 추가.
    // 이 헤더가 백엔드의 authedUser 가 읽는 "Bearer <토큰>" 이다.
    function authHeaders(extra) {
        // 기존 헤더에 얕은 복사로 합침(원본 훼손 방지).
        const h = Object.assign({}, extra || {});
        const t = getSessionToken();
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }
    // isSignedIn: 로그인 여부. !! = 값을 true/false 로 변환.
    function isSignedIn() { return !!getUser(); }
    // isTour: "가입 없이 둘러보기" 모드인지.
    function isTour() { try { return localStorage.getItem(KEY_TOUR) === '1'; } catch (e) { return false; } }
    // startTour: 둘러보기 모드 진입 — 플래그 저장 + 화면 표시 + 모달 닫기.
    function startTour() {
        try { localStorage.setItem(KEY_TOUR, '1'); } catch (e) {}
        // body 에 data-tour 속성을 달아 CSS/다른 코드가 둘러보기 상태를 알게.
        document.body.setAttribute('data-tour', '1');
        closeModal();
    }
    function endTour() {
        try { localStorage.removeItem(KEY_TOUR); } catch (e) {}
        document.body.removeAttribute('data-tour');
    }

    function injectStyles() {
        if (document.getElementById('sddAuthStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddAuthStyles';
        s.textContent = `
.sdd-auth-modal {
    position: fixed; inset: 0;
    /* z-9000 ladder: auth(9980) < account(9990) < welcome(9999).
       Sits above any in-page chrome (which lives ≤2000) and below toasts. */
    z-index: var(--z-modal-auth);
    background: var(--paper);
    color: var(--ink);
    display: none;
    align-items: center;
    justify-content: center;
    padding: clamp(40px, 8vw, 96px);
    overflow-y: auto;
}
.sdd-auth-modal.active { display: flex; }
.sdd-auth-inner { max-width: 480px; width: 100%; }
.sdd-auth-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 clamp(20px, 3vw, 28px);
    padding-bottom: clamp(12px, 2vw, 16px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-auth-intro {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    line-height: 1.55;
    color: var(--bone-d);
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 0 14px;
    border-top: 0.5px solid var(--rule);
}
.sdd-auth-field label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-auth-field input {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--serif);
    font-weight: 300;
    font-size: 18px;
    line-height: 1.5;
    padding: 6px 0;
    border-radius: 0;
    min-height: 36px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
}
.sdd-auth-field input:focus { border-bottom-color: var(--ink); }
.sdd-auth-actions {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-top: 0.5px solid var(--rule);
    margin-top: clamp(20px, 3vw, 28px);
}
.sdd-auth-btn {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    cursor: pointer;
    padding: 18px 4px;
    text-align: left;
    border-radius: 0;
    min-height: 44px;
    transition: color .12s, background .12s;
}
.sdd-auth-btn:hover    { color: var(--rust); background: var(--paper-d); }
.sdd-auth-btn.tour     { color: var(--bone-d); font-weight: 400; }
.sdd-auth-btn.tour:hover { color: var(--rust); }
.sdd-auth-btn.cancel   { color: var(--bone-d); font-weight: 400; }
.sdd-auth-status {
    margin-top: clamp(20px, 3vw, 28px);
    padding-top: clamp(12px, 2vw, 16px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--bone-d);
    display: none;
    word-break: break-all;
}
.sdd-auth-status.active { display: block; }
.sdd-auth-status.error  { color: var(--rust); }
.sdd-auth-status.ok     { color: var(--ink); }
.sdd-auth-status a {
    color: var(--rust);
    border-bottom: 0.5px solid var(--rule);
    text-decoration: none;
}

/* 둘러보기 모드 인디케이터 — cover 우상단 작은 mono 라벨 */
body[data-tour="1"] .sdd-cover::before {
    content: 'TOUR';
    position: absolute;
    top: 60px;
    right: clamp(24px, 6vw, 80px);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast, .32em);
    text-transform: uppercase;
    color: var(--bone-d);
    border: 0.5px solid var(--rule);
    padding: 4px 8px;
}

@media print {
    .sdd-auth-modal { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    function ensureModal() {
        if (_modalEl) return _modalEl;
        const c = copy();
        _modalEl = document.createElement('div');
        _modalEl.className = 'sdd-auth-modal';
        _modalEl.setAttribute('role', 'dialog');
        _modalEl.setAttribute('aria-modal', 'true');
        _modalEl.innerHTML = `
            <form class="sdd-auth-inner" data-auth-form>
                <p class="sdd-auth-label" data-l-label>${escapeHtml(c.modalLabel)}</p>
                <p class="sdd-auth-intro" data-l-intro>${escapeHtml(c.modalIntro)}</p>
                <div class="sdd-auth-field">
                    <label for="sddAuthEmail" data-l-email>${escapeHtml(c.fEmail)}</label>
                    <input id="sddAuthEmail" name="email" type="email" required maxlength="200" autocomplete="email" />
                </div>
                <div class="sdd-auth-actions">
                    <button type="submit" class="sdd-auth-btn"        data-l-send>${escapeHtml(c.btnSend)}</button>
                    <button type="button" class="sdd-auth-btn tour"   data-tour-btn data-l-tour>${escapeHtml(c.btnTour)}</button>
                    <button type="button" class="sdd-auth-btn cancel" data-cancel data-l-cancel>${escapeHtml(c.btnCancel)}</button>
                </div>
                <p class="sdd-auth-status" data-status></p>
            </form>
        `;
        document.body.appendChild(_modalEl);
        _modalEl.querySelector('[data-cancel]').addEventListener('click', closeModal);
        _modalEl.querySelector('[data-tour-btn]').addEventListener('click', startTour);
        _modalEl.querySelector('[data-auth-form]').addEventListener('submit', onSubmit);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _modalEl.classList.contains('active')) closeModal();
        });
        return _modalEl;
    }

    function openModal() {
        ensureModal().classList.add('active');
        const status = _modalEl.querySelector('[data-status]');
        status.classList.remove('active', 'error', 'ok');
        status.textContent = '';
        const first = _modalEl.querySelector('input[name="email"]');
        if (first) setTimeout(() => first.focus(), 50);
    }
    function closeModal() {
        if (_modalEl) _modalEl.classList.remove('active');
    }

    // onSubmit: 이메일 폼 제출 시 서버에 로그인 링크를 요청한다.
    async function onSubmit(e) {
        // 기본 폼 전송(페이지 새로고침)을 막고 우리가 fetch 로 처리.
        e.preventDefault();
        const form = e.target;
        // FormData 로 입력값을 읽는다.
        const fd = new FormData(form);
        const email = (fd.get('email') || '').toString().trim();
        // 상태 표시줄/전송 버튼 DOM 을 찾음.
        const status = _modalEl.querySelector('[data-status]');
        const sendBtn = _modalEl.querySelector('[data-l-send]');
        // 중복 전송 방지로 버튼 비활성 + "..." 표시.
        sendBtn.disabled = true;
        status.classList.remove('error', 'ok');
        status.classList.add('active');
        status.textContent = '...';
        const c = copy();

        // 백엔드 주소(끝 슬래시 제거). 없으면 아직 로그인 창구가 안 열린 것.
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) {
            status.classList.add('error');
            status.textContent = c.failClosed;
            sendBtn.disabled = false;
            return;
        }

        try {
            // POST /auth/request 로 이메일 전송. body 는 JSON 문자열, credentials:'omit' = 쿠키 안 보냄.
            const r = await fetch(base + '/auth/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'omit'
            });
            // 응답 JSON 파싱(실패하면 null).
            const j = await r.json().catch(() => null);
            // 성공 처리.
            if (r.ok && j && j.ok) {
                status.classList.add('ok');
                // inline 모드(개발용)면 링크를 화면에 직접 보여준다.
                if (j.mode === 'inline' && j.link) {
                    // 베타 / 솔로 fallback — link 직접 노출
                    status.innerHTML = escapeHtml(c.sentInline) + ' <a href="' + escapeHtml(j.link) + '">OPEN</a>';
                } else {
                    status.textContent = c.sentMsg;
                }
            } else if (r.status === 503) {
                status.classList.add('error');
                status.textContent = c.failClosed;
            } else {
                status.classList.add('error');
                status.textContent = (j && j.error) || c.failGeneric;
            }
        } catch (err) {
            status.classList.add('error');
            status.textContent = c.failGeneric;
        } finally {
            sendBtn.disabled = false;
        }
    }

    // processVerifyToken: 메일 링크로 들어와 주소에 ?token= 이 있으면 자동으로 검증한다.
    // URL ?token=XXX 진입 — 자동 verify
    async function processVerifyToken() {
        const u = new URL(location.href);
        // 주소에서 token 값을 꺼냄.
        const token = u.searchParams.get('token');
        // 길이 64가 아니면(우리 토큰 형식 아님) 무시.
        if (!token || token.length !== 64) return;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return;

        try {
            // GET /auth/verify?token=... 호출. encodeURIComponent 로 URL 안전하게 인코딩.
            const r = await fetch(base + '/auth/verify?token=' + encodeURIComponent(token), {
                method: 'GET', credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            // 성공하면 사용자/세션을 저장하고 로그인 확정.
            if (r.ok && j && j.ok && j.user) {
                setUser(j.user);
                if (j.session && j.session.token) setSessionToken(j.session.token);
                endTour();   // 가입 완료 → tour 모드 해제
            }
        } catch (e) {}
        // 보안/미관상 주소창에서 token 을 지운다(뒤로가기·공유로 재사용 안 되게).
        // URL 정리 — token 파라미터 제거
        try {
            u.searchParams.delete('token');
            // replaceState: 페이지 새로고침 없이 주소만 조용히 교체.
            history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
        } catch (e) {}
    }

    // signOut: 로그아웃. opts.everywhere=true 면 모든 기기, 아니면 이 기기만.
    async function signOut(opts) {
        const all = !!(opts && opts.everywhere);
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const token = getSessionToken();
        // Best-effort server revoke. Ignore network errors so the user always gets logged out locally.
        // 서버 세션도 취소 시도(실패해도 로컬 로그아웃은 무조건 진행).
        if (base && token) {
            try {
                await fetch(base + (all ? '/auth/signout-all' : '/auth/signout'), {
                    method: 'POST',
                    headers: authHeaders({ 'Content-Type': 'application/json' }),
                    body: '{}',
                    credentials: 'omit'
                });
            } catch (e) {}
        }
        setUser(null);
        setSessionToken(null);
        endTour();
    }

    async function exportData() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const token = getSessionToken();
        if (!base || !token) throw new Error('not_signed_in');
        const r = await fetch(base + '/auth/export', {
            method: 'GET',
            headers: authHeaders(),
            credentials: 'omit'
        });
        if (!r.ok) throw new Error('export_failed_' + r.status);
        return await r.json();
    }

    async function deleteAccount(opts) {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const token = getSessionToken();
        if (!base || !token) throw new Error('not_signed_in');
        const r = await fetch(base + '/auth/delete', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ confirm: 'DELETE', reason: (opts && opts.reason) || null }),
            credentials: 'omit'
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || !j.ok) throw new Error('delete_failed_' + r.status);
        setUser(null);
        setSessionToken(null);
        endTour();
        return j;
    }

    async function listSessions() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const token = getSessionToken();
        if (!base || !token) return { ok: false, sessions: [] };
        try {
            const r = await fetch(base + '/auth/sessions', {
                method: 'GET',
                headers: authHeaders(),
                credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            if (!r.ok || !j) return { ok: false, sessions: [] };
            return j;
        } catch (e) { return { ok: false, sessions: [] }; }
    }

    async function logConsent(category, granted) {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        if (!base) return false;
        try {
            await fetch(base + '/auth/consent', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ category, granted: !!granted, edition: ed, policy_ver: '2026-04-30' }),
                credentials: 'omit'
            });
            return true;
        } catch (e) { return false; }
    }

    function watchEdition() {
        const mo = new MutationObserver(() => {
            if (!_modalEl) return;
            const c = copy();
            _modalEl.querySelector('[data-l-label]').textContent  = c.modalLabel;
            _modalEl.querySelector('[data-l-intro]').textContent  = c.modalIntro;
            _modalEl.querySelector('[data-l-email]').textContent  = c.fEmail;
            _modalEl.querySelector('[data-l-send]').textContent   = c.btnSend;
            _modalEl.querySelector('[data-l-tour]').textContent   = c.btnTour;
            _modalEl.querySelector('[data-l-cancel]').textContent = c.btnCancel;
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    // init: 모듈 시작점 — 스타일 주입 + 상태 복원 + 토큰 검증 + 언어 변화 감시.
    function init() {
        injectStyles();
        // tour 모드 복원
        if (isTour() && !isSignedIn()) document.body.setAttribute('data-tour', '1');
        // verify token 처리
        processVerifyToken();
        watchEdition();
    }

    // DOM 이 아직 로딩 중이면 완료 이벤트를 기다렸다 init, 이미 준비됐으면 바로 init.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 공개 API — 다른 모듈이 window.SAUDADE_AUTH.xxx 로 호출하는 창구.
    window.SAUDADE_AUTH = {
        openModal,
        closeModal,
        signOut,
        getUser,
        getSessionToken,
        authHeaders,
        isSignedIn,
        isTour,
        startTour,
        endTour,
        exportData,
        deleteAccount,
        listSessions,
        logConsent
    };
})();
