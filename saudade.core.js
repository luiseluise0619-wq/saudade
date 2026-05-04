/*! saudade · saudade.core.js · built 2026-05-04T03:26:13.301Z · https://saudade.app — concatenated IIFE modules, see /scripts/build-bundle.js */

/* ── saudade-auth.js ──────────────────────────────────────────────────── */
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
'use strict';

(function() {
    if (window.SAUDADE_AUTH) return;

    const KEY_USER    = 'saudade.auth.user';
    const KEY_TOUR    = 'saudade.auth.tour';
    const KEY_SESSION = 'saudade.auth.session';   // opaque server session token (revocable)

    let _modalEl = null;

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

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function getUser() {
        try { return JSON.parse(localStorage.getItem(KEY_USER) || 'null'); }
        catch (e) { return null; }
    }
    function setUser(u) {
        try {
            if (u) localStorage.setItem(KEY_USER, JSON.stringify(u));
            else localStorage.removeItem(KEY_USER);
        } catch (e) {}
    }
    function getSessionToken() {
        try { return localStorage.getItem(KEY_SESSION) || null; } catch (e) { return null; }
    }
    function setSessionToken(t) {
        try {
            if (t) localStorage.setItem(KEY_SESSION, t);
            else localStorage.removeItem(KEY_SESSION);
        } catch (e) {}
    }
    function authHeaders(extra) {
        const h = Object.assign({}, extra || {});
        const t = getSessionToken();
        if (t) h['Authorization'] = 'Bearer ' + t;
        return h;
    }
    function isSignedIn() { return !!getUser(); }
    function isTour() { try { return localStorage.getItem(KEY_TOUR) === '1'; } catch (e) { return false; } }
    function startTour() {
        try { localStorage.setItem(KEY_TOUR, '1'); } catch (e) {}
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
    z-index: 9980;
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

    async function onSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const email = (fd.get('email') || '').toString().trim();
        const status = _modalEl.querySelector('[data-status]');
        const sendBtn = _modalEl.querySelector('[data-l-send]');
        sendBtn.disabled = true;
        status.classList.remove('error', 'ok');
        status.classList.add('active');
        status.textContent = '...';
        const c = copy();

        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) {
            status.classList.add('error');
            status.textContent = c.failClosed;
            sendBtn.disabled = false;
            return;
        }

        try {
            const r = await fetch(base + '/auth/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            if (r.ok && j && j.ok) {
                status.classList.add('ok');
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

    // URL ?token=XXX 진입 — 자동 verify
    async function processVerifyToken() {
        const u = new URL(location.href);
        const token = u.searchParams.get('token');
        if (!token || token.length !== 64) return;
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return;

        try {
            const r = await fetch(base + '/auth/verify?token=' + encodeURIComponent(token), {
                method: 'GET', credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            if (r.ok && j && j.ok && j.user) {
                setUser(j.user);
                if (j.session && j.session.token) setSessionToken(j.session.token);
                endTour();   // 가입 완료 → tour 모드 해제
            }
        } catch (e) {}
        // URL 정리 — token 파라미터 제거
        try {
            u.searchParams.delete('token');
            history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
        } catch (e) {}
    }

    async function signOut(opts) {
        const all = !!(opts && opts.everywhere);
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const token = getSessionToken();
        // Best-effort server revoke. Ignore network errors so the user always gets logged out locally.
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

    function init() {
        injectStyles();
        // tour 모드 복원
        if (isTour() && !isSignedIn()) document.body.setAttribute('data-tour', '1');
        // verify token 처리
        processVerifyToken();
        watchEdition();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

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

/* ── saudade-account.js ──────────────────────────────────────────────────── */
// saudade · account & permissions panel
//   Lets the signed-in user:
//     • see active sessions
//     • sign out (this device) / sign out everywhere (revoke + burn magic links)
//     • export data (GDPR Art.20 / PIPA §35)
//     • delete account (GDPR Art.17 / PIPA §36)
//     • toggle / revoke consent categories (analytics, marketing, ai, functional)
//
// API: window.SAUDADE_ACCOUNT.openPanel()
'use strict';

(function() {
    if (window.SAUDADE_ACCOUNT) return;

    const KEY_CONSENT = 'saudade.consent.v1';   // { analytics, marketing, ai, functional }
    const POLICY_VER  = '2026-04-30';

    let _panelEl = null;

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function copy() {
        return {
            title:    L({ en: 'Account & permissions.', ko: '계정 및 권한.', ja: 'アカウントと権限。', pt: 'Conta e permissões.', es: 'Cuenta y permisos.' }),
            close:    L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }),
            sectIdent:L({ en: 'IDENTITY', ko: '계정', ja: 'アカウント', pt: 'IDENTIDADE', es: 'IDENTIDAD' }),
            sectSess: L({ en: 'ACTIVE SESSIONS', ko: '활성 세션', ja: 'アクティブセッション', pt: 'SESSÕES ATIVAS', es: 'SESIONES ACTIVAS' }),
            sectCons: L({ en: 'CONSENT', ko: '동의 항목', ja: '同意項目', pt: 'CONSENTIMENTO', es: 'CONSENTIMIENTO' }),
            sectData: L({ en: 'YOUR DATA', ko: '내 데이터', ja: '自分のデータ', pt: 'OS SEUS DADOS', es: 'TUS DATOS' }),
            sectDang: L({ en: 'DANGER ZONE', ko: '위험 구역', ja: '危険ゾーン', pt: 'ZONA DE PERIGO', es: 'ZONA DE PELIGRO' }),
            outOne:   L({ en: 'SIGN OUT (THIS DEVICE)', ko: '이 기기에서 로그아웃', ja: 'この端末からサインアウト', pt: 'SAIR (ESTE DISPOSITIVO)', es: 'CERRAR SESIÓN (ESTE DISPOSITIVO)' }),
            outAll:   L({ en: 'SIGN OUT EVERYWHERE', ko: '모든 기기에서 로그아웃', ja: 'すべての端末からサインアウト', pt: 'SAIR DE TODOS', es: 'CERRAR EN TODAS PARTES' }),
            outAllH:  L({ en: 'Revokes every session and burns every unused sign-in link tied to your email.',
                          ko: '모든 세션을 폐기하고 이메일로 발송된 미사용 로그인 링크를 즉시 무효화합니다.',
                          ja: 'すべてのセッションを失効させ、メール送信済みの未使用リンクを即時無効化します。',
                          pt: 'Revoga todas as sessões e queima cada link de início de sessão por usar enviado para o seu email.',
                          es: 'Revoca todas las sesiones e invalida cada enlace de acceso no usado enviado a tu correo.' }),
            export:   L({ en: 'EXPORT MY DATA', ko: '내 데이터 내보내기', ja: 'データをエクスポート', pt: 'EXPORTAR OS MEUS DADOS', es: 'EXPORTAR MIS DATOS' }),
            exportH:  L({ en: 'Downloads a JSON file with everything we hold linked to your account.',
                          ko: '계정과 연결된 모든 데이터를 JSON 파일로 내려받습니다.',
                          ja: 'アカウントに紐づくすべてのデータをJSONファイルでダウンロードします。',
                          pt: 'Descarrega um ficheiro JSON com tudo o que mantemos associado à sua conta.',
                          es: 'Descarga un archivo JSON con todo lo que tenemos vinculado a tu cuenta.' }),
            del:      L({ en: 'DELETE MY ACCOUNT', ko: '계정 영구 삭제', ja: 'アカウントを完全削除', pt: 'APAGAR A MINHA CONTA', es: 'ELIMINAR MI CUENTA' }),
            delH:     L({ en: 'Permanent. Removes your user row, sessions, magic tokens, café submissions, follows, and listening log.',
                          ko: '영구 삭제. 사용자 정보·세션·매직 토큰·카페 제출·팔로잉·청취 기록이 즉시 제거됩니다.',
                          ja: '完全削除。ユーザー情報・セッション・マジックトークン・カフェ投稿・フォロー・リスニング履歴を即時削除します。',
                          pt: 'Permanente. Remove o seu utilizador, sessões, tokens, submissões de café, seguidores e histórico.',
                          es: 'Permanente. Elimina su usuario, sesiones, tokens, envíos de cafés, seguimientos y registro.' }),
            confirmDel: L({ en: 'Type DELETE to confirm.', ko: '확인하려면 DELETE 를 입력하세요.', ja: '確認するには DELETE と入力。', pt: 'Escreva DELETE para confirmar.', es: 'Escribe DELETE para confirmar.' }),
            reasonPh:   L({ en: 'Reason (optional)', ko: '사유 (선택)', ja: '理由（任意）', pt: 'Motivo (opcional)', es: 'Motivo (opcional)' }),
            cAnalytics: L({ en: 'Analytics — anonymous usage stats.',  ko: '분석 — 익명 사용 통계.',  ja: '分析 — 匿名使用統計。',  pt: 'Análise — estatísticas anónimas.',  es: 'Análisis — estadísticas anónimas.' }),
            cMarketing: L({ en: 'Marketing — newsletter opt-in.',     ko: '마케팅 — 뉴스레터 수신.', ja: 'マーケティング — ニュースレター。', pt: 'Marketing — newsletter.',          es: 'Marketing — boletín.' }),
            cAi:        L({ en: 'AI — let AI rewrite city dispatches.', ko: 'AI — 도시 디스패치 재작성에 AI 사용.', ja: 'AI — 都市ディスパッチの書き換えに使用。', pt: 'IA — usar IA para rescrever despachos.', es: 'IA — usar IA para reescribir despachos.' }),
            cFunc:      L({ en: 'Functional — required, cannot be disabled.', ko: '기능성 — 필수. 비활성화 불가.', ja: '機能性 — 必須。無効化不可。', pt: 'Funcional — obrigatório.', es: 'Funcional — obligatorio.' }),
            notSigned:  L({ en: 'Sign in to manage your account.', ko: '계정을 관리하려면 로그인하세요.', ja: 'アカウント管理にはサインインが必要です。', pt: 'Inicie sessão para gerir a sua conta.', es: 'Inicia sesión para gestionar tu cuenta.' }),
            signinBtn:  L({ en: 'SIGN IN', ko: '로그인', ja: 'サインイン', pt: 'ENTRAR', es: 'ENTRAR' }),
            current:    L({ en: 'this device', ko: '이 기기', ja: 'この端末', pt: 'este dispositivo', es: 'este dispositivo' }),
            doneOut:    L({ en: 'Signed out.', ko: '로그아웃되었습니다.', ja: 'サインアウトしました。', pt: 'Sessão terminada.', es: 'Sesión cerrada.' }),
            doneOutAll: L({ en: 'Signed out on every device. Pending email links cancelled.',
                            ko: '모든 기기에서 로그아웃됨. 대기 중인 이메일 링크 취소.',
                            ja: 'すべての端末からサインアウト。保留中のリンクをキャンセル。',
                            pt: 'Saiu de todos os dispositivos. Links pendentes cancelados.',
                            es: 'Cerrado en todos los dispositivos. Enlaces pendientes cancelados.' }),
            doneDel:    L({ en: 'Account deleted. Goodbye.', ko: '계정 삭제 완료. 안녕히.', ja: 'アカウントを削除しました。さようなら。', pt: 'Conta apagada. Adeus.', es: 'Cuenta eliminada. Adiós.' }),
            err:        L({ en: 'Something went wrong. Try again.', ko: '문제가 발생했습니다. 다시 시도하세요.', ja: 'エラーが発生しました。再度お試しください。', pt: 'Algo correu mal. Tente de novo.', es: 'Algo salió mal. Inténtalo de nuevo.' })
        };
    }

    function getConsent() {
        try { return JSON.parse(localStorage.getItem(KEY_CONSENT) || '{}'); }
        catch (e) { return {}; }
    }
    function setConsent(c) {
        try { localStorage.setItem(KEY_CONSENT, JSON.stringify(c)); } catch (e) {}
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function fmtDate(ms) {
        if (!ms) return '—';
        try { return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
        catch (e) { return '—'; }
    }

    function injectStyles() {
        if (document.getElementById('sddAcctStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddAcctStyles';
        s.textContent = `
.sdd-acct-modal {
    position: fixed; inset: 0; z-index: 9990;
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-acct-modal.active { display: flex; }
.sdd-acct-inner { max-width: 720px; width: 100%; }
.sdd-acct-inner h1 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 4vw, 44px);
    margin: 0 0 clamp(20px, 3vw, 32px);
    line-height: 1.05;
}
.sdd-acct-section {
    border-top: 0.5px solid var(--rule);
    padding: clamp(18px, 3vw, 28px) 0 clamp(12px, 2vw, 18px);
}
.sdd-acct-section h2 {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 clamp(12px, 2vw, 16px);
}
.sdd-acct-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 8px 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-size: 12px;
}
.sdd-acct-row:last-child { border-bottom: 0; }
.sdd-acct-row .meta { color: var(--bone-d); font-size: 10px; letter-spacing: 0.06em; }
.sdd-acct-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); cursor: pointer; padding: 14px 4px; text-align: left;
    width: 100%; min-height: 44px;
    transition: color .12s, background .12s;
}
.sdd-acct-btn:hover { color: var(--rust); background: var(--paper-d); }
.sdd-acct-btn.danger { color: var(--rust); }
.sdd-acct-help {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; color: var(--bone-d);
    line-height: 1.55; margin: 4px 0 12px;
}
.sdd-acct-input {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule); border-radius: 0;
    color: var(--ink); font-family: var(--serif); font-weight: 300;
    font-size: 16px; padding: 6px 0; width: 100%;
    outline: none; box-sizing: border-box;
}
.sdd-acct-input:focus { border-bottom-color: var(--ink); }
.sdd-acct-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    padding: 12px 0; color: var(--bone-d);
}
.sdd-acct-status.ok { color: var(--ink); }
.sdd-acct-status.error { color: var(--rust); }
.sdd-acct-toggle {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 0; border-bottom: 0.5px solid var(--rule);
    font-family: var(--serif); font-size: 14px; font-weight: 300;
}
.sdd-acct-toggle input[type=checkbox] {
    width: 18px; height: 18px; accent-color: var(--rust);
    flex-shrink: 0;
}
.sdd-acct-close {
    position: sticky; top: 0; align-self: flex-end;
    margin-bottom: 12px;
}
@media print { .sdd-acct-modal { display: none !important; } }
        `;
        document.head.appendChild(s);
    }

    function ensurePanel() {
        if (_panelEl) return _panelEl;
        _panelEl = document.createElement('div');
        _panelEl.className = 'sdd-acct-modal';
        _panelEl.setAttribute('role', 'dialog');
        _panelEl.setAttribute('aria-modal', 'true');
        document.body.appendChild(_panelEl);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _panelEl.classList.contains('active')) closePanel();
        });
        return _panelEl;
    }

    function renderSignedOut() {
        const c = copy();
        ensurePanel().innerHTML = `
            <div class="sdd-acct-inner">
                <button type="button" class="sdd-acct-btn sdd-acct-close" data-close>${escapeHtml(c.close)}</button>
                <h1>${escapeHtml(c.title)}</h1>
                <div class="sdd-acct-section">
                    <p class="sdd-acct-help">${escapeHtml(c.notSigned)}</p>
                    <button type="button" class="sdd-acct-btn" data-signin>${escapeHtml(c.signinBtn)}</button>
                </div>
            </div>
        `;
        _panelEl.querySelector('[data-close]').addEventListener('click', closePanel);
        _panelEl.querySelector('[data-signin]').addEventListener('click', () => {
            closePanel();
            if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.openModal) window.SAUDADE_AUTH.openModal();
        });
    }

    async function renderSignedIn() {
        const c = copy();
        const u = (window.SAUDADE_AUTH && window.SAUDADE_AUTH.getUser && window.SAUDADE_AUTH.getUser()) || {};
        const consent = Object.assign({ analytics: false, marketing: false, ai: true, functional: true }, getConsent());

        ensurePanel().innerHTML = `
            <div class="sdd-acct-inner">
                <button type="button" class="sdd-acct-btn sdd-acct-close" data-close>${escapeHtml(c.close)}</button>
                <h1>${escapeHtml(c.title)}</h1>

                <section class="sdd-acct-section">
                    <h2>${escapeHtml(c.sectIdent)}</h2>
                    <div class="sdd-acct-row"><span>EMAIL</span><span class="meta">${escapeHtml(u.email || '—')}</span></div>
                    <div class="sdd-acct-row"><span>USER ID</span><span class="meta">${escapeHtml(u.id || '—')}</span></div>
                    <div class="sdd-acct-row"><span>TIER</span><span class="meta">${escapeHtml(u.tier || 'free')}</span></div>
                    <div class="sdd-acct-row"><span>EDITION</span><span class="meta">${escapeHtml(u.edition || 'en')}</span></div>
                </section>

                <section class="sdd-acct-section" data-sessions>
                    <h2>${escapeHtml(c.sectSess)}</h2>
                    <p class="sdd-acct-help">…</p>
                </section>

                <section class="sdd-acct-section">
                    <h2>${escapeHtml(c.sectCons)}</h2>
                    <label class="sdd-acct-toggle">
                        <input type="checkbox" data-consent="analytics" ${consent.analytics ? 'checked' : ''} />
                        <span>${escapeHtml(c.cAnalytics)}</span>
                    </label>
                    <label class="sdd-acct-toggle">
                        <input type="checkbox" data-consent="marketing" ${consent.marketing ? 'checked' : ''} />
                        <span>${escapeHtml(c.cMarketing)}</span>
                    </label>
                    <label class="sdd-acct-toggle">
                        <input type="checkbox" data-consent="ai" ${consent.ai ? 'checked' : ''} />
                        <span>${escapeHtml(c.cAi)}</span>
                    </label>
                    <label class="sdd-acct-toggle">
                        <input type="checkbox" checked disabled />
                        <span>${escapeHtml(c.cFunc)}</span>
                    </label>
                </section>

                <section class="sdd-acct-section">
                    <h2>${escapeHtml(c.sectData)}</h2>
                    <p class="sdd-acct-help">${escapeHtml(c.exportH)}</p>
                    <button type="button" class="sdd-acct-btn" data-export>${escapeHtml(c.export)}</button>
                    <p class="sdd-acct-help">${escapeHtml(c.outAllH)}</p>
                    <button type="button" class="sdd-acct-btn" data-out>${escapeHtml(c.outOne)}</button>
                    <button type="button" class="sdd-acct-btn" data-out-all>${escapeHtml(c.outAll)}</button>
                </section>

                <section class="sdd-acct-section">
                    <h2>${escapeHtml(c.sectDang)}</h2>
                    <p class="sdd-acct-help">${escapeHtml(c.delH)}</p>
                    <input type="text" class="sdd-acct-input" data-del-reason placeholder="${escapeHtml(c.reasonPh)}" maxlength="500" />
                    <input type="text" class="sdd-acct-input" data-del-confirm placeholder="${escapeHtml(c.confirmDel)}" maxlength="20" autocomplete="off" />
                    <button type="button" class="sdd-acct-btn danger" data-del>${escapeHtml(c.del)}</button>
                </section>

                <p class="sdd-acct-status" data-status></p>
            </div>
        `;

        _panelEl.querySelector('[data-close]').addEventListener('click', closePanel);

        // Consent toggles — local + server log.
        _panelEl.querySelectorAll('input[data-consent]').forEach(el => {
            el.addEventListener('change', () => {
                const next = Object.assign({}, getConsent(), { [el.dataset.consent]: el.checked });
                setConsent(next);
                if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.logConsent) {
                    window.SAUDADE_AUTH.logConsent(el.dataset.consent, el.checked);
                }
            });
        });

        const status = _panelEl.querySelector('[data-status]');
        const setStatus = (msg, kind) => {
            status.className = 'sdd-acct-status ' + (kind || '');
            status.textContent = msg || '';
        };

        _panelEl.querySelector('[data-export]').addEventListener('click', async () => {
            try {
                setStatus('…');
                const data = await window.SAUDADE_AUTH.exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'saudade-export.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setStatus('OK', 'ok');
            } catch (e) { setStatus(c.err, 'error'); }
        });

        _panelEl.querySelector('[data-out]').addEventListener('click', async () => {
            try {
                await window.SAUDADE_AUTH.signOut({ everywhere: false });
                setStatus(c.doneOut, 'ok');
                setTimeout(closePanel, 600);
            } catch (e) { setStatus(c.err, 'error'); }
        });

        _panelEl.querySelector('[data-out-all]').addEventListener('click', async () => {
            try {
                await window.SAUDADE_AUTH.signOut({ everywhere: true });
                setStatus(c.doneOutAll, 'ok');
                setTimeout(closePanel, 1200);
            } catch (e) { setStatus(c.err, 'error'); }
        });

        _panelEl.querySelector('[data-del]').addEventListener('click', async () => {
            const confirm = (_panelEl.querySelector('[data-del-confirm]').value || '').trim();
            const reason  = (_panelEl.querySelector('[data-del-reason]').value || '').trim();
            if (confirm !== 'DELETE') { setStatus(c.confirmDel, 'error'); return; }
            try {
                setStatus('…');
                await window.SAUDADE_AUTH.deleteAccount({ reason });
                setStatus(c.doneDel, 'ok');
                setTimeout(() => { closePanel(); location.reload(); }, 1500);
            } catch (e) { setStatus(c.err, 'error'); }
        });

        // Async session list.
        try {
            const r = await window.SAUDADE_AUTH.listSessions();
            const root = _panelEl.querySelector('[data-sessions]');
            if (!root) return;
            root.innerHTML = `<h2>${escapeHtml(c.sectSess)}</h2>` + (r.sessions || []).map(s => `
                <div class="sdd-acct-row">
                    <span>${escapeHtml(s.label)}${s.is_current ? ' · <em>' + escapeHtml(c.current) + '</em>' : ''}</span>
                    <span class="meta">${escapeHtml(fmtDate(s.last_used_at))}</span>
                </div>
            `).join('') || `<p class="sdd-acct-help">—</p>`;
        } catch (e) {}
    }

    function openPanel() {
        injectStyles();
        ensurePanel().classList.add('active');
        const signedIn = (window.SAUDADE_AUTH && window.SAUDADE_AUTH.isSignedIn && window.SAUDADE_AUTH.isSignedIn()) || false;
        if (signedIn) renderSignedIn();
        else renderSignedOut();
    }
    function closePanel() {
        if (_panelEl) _panelEl.classList.remove('active');
    }

    function init() {
        injectStyles();
        // URL hash hook — let any page link to #account to deep-open the panel.
        if (location.hash === '#account') {
            setTimeout(openPanel, 120);
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
        window.addEventListener('hashchange', () => {
            if (location.hash === '#account') openPanel();
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    window.SAUDADE_ACCOUNT = { openPanel, closePanel, getConsent, setConsent };
})();

/* ── saudade-schengen.js ──────────────────────────────────────────────────── */
// saudade · Schengen 90/180 rolling calculator
//
// The Schengen short-stay rule: in any rolling 180-day window, you may not
// spend more than 90 days inside Schengen. Days are counted **including**
// the day of entry and the day of exit (Reg. (EU) 610/2013, Art.6(1)).
//
// This module does pure math. No advice. The output is a calendar.
//
// API:
//   window.SAUDADE_SCHENGEN.calc({ stays, ref })
//     stays = [{ in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD' (open if missing), country?: 'PT' }]
//     ref   = 'YYYY-MM-DD' (defaults to today UTC)
//   →  {
//        ref, used_in_window, remaining, max,
//        window_start, window_end, currently_inside,
//        days_until_full_reset,   // when used_in_window will reach 0 again
//        next_safe_entry_after,   // earliest ref date you could enter and still have ≥1 day
//        timeline: [ { date, used } ... 181 entries ]
//      }
//
//   window.SAUDADE_SCHENGEN.render(container, { stays, ref, lang })
//     Paints a compact panel into `container`.
'use strict';

(function() {
    if (window.SAUDADE_SCHENGEN) return;

    const MAX = 90;
    const WINDOW = 180;
    const MS_DAY = 86400000;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function toUTCDate(s) {
        if (!s) return null;
        if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function fmt(d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function addDays(d, n) { return new Date(d.getTime() + n * MS_DAY); }
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY); }

    // Build a per-day Set of dates the traveller was inside Schengen.
    // Open stays (no `out`) end at `ref` if `in <= ref`.
    function expandStays(stays, ref) {
        const set = new Set();
        for (const s of (stays || [])) {
            const a = toUTCDate(s.in);
            if (!a) continue;
            const b = toUTCDate(s.out) || ref;
            if (b < a) continue;
            // Include both endpoints.
            for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                set.add(fmt(d));
            }
        }
        return set;
    }

    function calc(opts) {
        opts = opts || {};
        const ref = toUTCDate(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const stays = Array.isArray(opts.stays) ? opts.stays : [];
        const set = expandStays(stays, ref);

        // Window is the 180 days ending on ref (inclusive). EU practice: ref counts.
        const start = addDays(ref, -(WINDOW - 1));
        let used = 0;
        const timeline = [];
        for (let i = 0; i < WINDOW; i++) {
            const d = addDays(start, i);
            const inside = set.has(fmt(d));
            if (inside) used++;
            timeline.push({ date: fmt(d), inside });
        }
        const remaining = Math.max(0, MAX - used);
        const todayInside = set.has(fmt(ref));

        // Roll forward to find when used drops to 0 (full reset) and the next safe-entry date.
        // Optimisation cap: don't roll more than 365 days.
        let nextSafeEntry = null;
        let fullReset = null;
        let cur = used;
        const insideByDay = new Map();
        for (let i = 0; i < WINDOW; i++) {
            insideByDay.set(fmt(addDays(start, i)), set.has(fmt(addDays(start, i))) ? 1 : 0);
        }
        for (let off = 1; off <= 365; off++) {
            const dropDate = addDays(start, off - 1);
            const addDate  = addDays(ref,   off);
            const dropping = insideByDay.get(fmt(dropDate)) || 0;
            const adding = set.has(fmt(addDate)) ? 1 : 0;   // future stays user may have entered
            cur = cur - dropping + adding;
            insideByDay.set(fmt(addDate), adding);
            if (cur < MAX && nextSafeEntry === null) {
                nextSafeEntry = fmt(addDate);
            }
            if (cur === 0 && fullReset === null) {
                fullReset = fmt(addDate);
                break;
            }
        }

        return {
            ref: fmt(ref),
            window_start: fmt(start),
            window_end: fmt(ref),
            max: MAX,
            window_days: WINDOW,
            used_in_window: used,
            remaining,
            currently_inside: todayInside,
            days_until_full_reset: fullReset ? diffDays(toUTCDate(fullReset), ref) : null,
            next_safe_entry_after: nextSafeEntry,
            timeline
        };
    }

    function copy(lang) {
        return {
            title:   L({ en: 'Schengen 90/180.', ko: '셰겐 90/180.', ja: 'シェンゲン 90/180。', pt: 'Schengen 90/180.', es: 'Schengen 90/180.' }, lang),
            usedLab: L({ en: 'DAYS USED',    ko: '사용 일수',  ja: '使用日数',    pt: 'DIAS USADOS',  es: 'DÍAS USADOS' }, lang),
            remLab:  L({ en: 'DAYS REMAINING', ko: '남은 일수', ja: '残り日数',   pt: 'DIAS RESTANTES', es: 'DÍAS RESTANTES' }, lang),
            window:  L({ en: 'IN THE 180 DAYS ENDING', ko: '기준일 직전 180일', ja: '基準日までの180日間', pt: 'NOS 180 DIAS ATÉ', es: 'EN LOS 180 DÍAS HASTA' }, lang),
            insideY: L({ en: 'You are inside Schengen on the reference date.', ko: '기준일 현재 셰겐 안에 있다.', ja: '基準日現在シェンゲン圏内にいる。', pt: 'Está dentro de Schengen na data de referência.', es: 'Está dentro de Schengen en la fecha de referencia.' }, lang),
            insideN: L({ en: 'You are outside Schengen on the reference date.', ko: '기준일 현재 셰겐 밖에 있다.', ja: '基準日現在シェンゲン圏外にいる。', pt: 'Está fora de Schengen na data de referência.', es: 'Está fuera de Schengen en la fecha de referencia.' }, lang),
            full:    L({ en: 'WINDOW FULLY RESETS', ko: '윈도우 완전 초기화', ja: 'ウィンドウ完全リセット', pt: 'JANELA REINICIA POR COMPLETO', es: 'VENTANA SE REINICIA POR COMPLETO' }, lang),
            safe:    L({ en: 'NEXT SAFE ENTRY ≥ 1 DAY', ko: '다음 입국 가능 (≥1일)', ja: '次に入国可能 (≥1日)', pt: 'PRÓXIMA ENTRADA SEGURA (≥1 DIA)', es: 'PRÓXIMA ENTRADA SEGURA (≥1 DÍA)' }, lang),
            note:    L({ en: 'A calendar, not advice. Verify with your consulate.', ko: '계산기가 아니라 달력. 영사관에 확인하라.', ja: 'これは計算機ではなく暦。領事館に確認を。', pt: 'Um calendário, não um conselho. Confirme com o seu consulado.', es: 'Un calendario, no un consejo. Confirme con su consulado.' }, lang),
            empty:   L({ en: 'Add at least one Schengen entry above.', ko: '셰겐 입국 기록을 하나 이상 추가하라.', ja: '少なくとも一回のシェンゲン入国を追加してください。', pt: 'Adicione pelo menos uma entrada Schengen acima.', es: 'Añada al menos una entrada Schengen arriba.' }, lang)
        };
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function render(root, opts) {
        if (!root) return;
        const stays = (opts && opts.stays) || [];
        const lang  = opts && opts.lang;
        if (!stays.length) {
            root.innerHTML = `<p class="sdd-sch-empty">${escapeHtml(copy(lang).empty)}</p>`;
            return;
        }
        const r = calc({ stays, ref: opts && opts.ref });
        const c = copy(lang);
        const danger = r.used_in_window >= MAX;
        const warn   = r.used_in_window >= 75 && !danger;
        const cls = danger ? 'danger' : warn ? 'warn' : 'ok';

        root.innerHTML = `
            <section class="sdd-sch-panel ${escapeHtml(cls)}">
                <h3 class="sdd-sch-h">${escapeHtml(c.title)}</h3>
                <div class="sdd-sch-grid">
                    <div class="sdd-sch-cell">
                        <p class="sdd-sch-label">${escapeHtml(c.usedLab)}</p>
                        <p class="sdd-sch-num">${r.used_in_window}<span class="sdd-sch-of"> / ${r.max}</span></p>
                    </div>
                    <div class="sdd-sch-cell">
                        <p class="sdd-sch-label">${escapeHtml(c.remLab)}</p>
                        <p class="sdd-sch-num">${r.remaining}</p>
                    </div>
                </div>
                <p class="sdd-sch-window">${escapeHtml(c.window)} ${escapeHtml(r.window_end)}</p>
                <p class="sdd-sch-status">${escapeHtml(r.currently_inside ? c.insideY : c.insideN)}</p>
                <dl class="sdd-sch-meta">
                    ${r.next_safe_entry_after ? `<dt>${escapeHtml(c.safe)}</dt><dd>${escapeHtml(r.next_safe_entry_after)}</dd>` : ''}
                    ${r.days_until_full_reset !== null ? `<dt>${escapeHtml(c.full)}</dt><dd>${escapeHtml(String(r.days_until_full_reset))} d</dd>` : ''}
                </dl>
                <p class="sdd-sch-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddSchStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddSchStyles';
        s.textContent = `
.sdd-sch-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-sch-panel.warn  { background: linear-gradient(transparent 60%, rgba(178,103,46,.06)); }
.sdd-sch-panel.danger { background: linear-gradient(transparent 60%, rgba(178,53,40,.10)); }
.sdd-sch-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-sch-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: clamp(16px, 4vw, 48px);
    align-items: end;
}
.sdd-sch-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-sch-num {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(56px, 9vw, 110px); line-height: 1;
    color: var(--ink); margin: 0;
}
.sdd-sch-panel.danger .sdd-sch-num { color: var(--rust); }
.sdd-sch-of {
    font-size: 0.35em; color: var(--bone-d);
    font-style: normal; letter-spacing: 0.06em;
}
.sdd-sch-window, .sdd-sch-status {
    font-family: var(--mono); font-weight: 400; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--bone-d); margin: 14px 0 0;
}
.sdd-sch-meta {
    display: grid; grid-template-columns: auto 1fr; column-gap: 16px;
    font-family: var(--mono); font-size: 11px;
    margin: 14px 0 0; padding-top: 12px;
    border-top: 0.5px solid var(--rule);
}
.sdd-sch-meta dt { color: var(--bone-d); letter-spacing: 0.18em; text-transform: uppercase; }
.sdd-sch-meta dd { color: var(--ink); margin: 0 0 4px; }
.sdd-sch-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; color: var(--bone-d); margin: 14px 0 0;
}
.sdd-sch-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectStyles);
        } else { injectStyles(); }
    }

    window.SAUDADE_SCHENGEN = { calc, render };
})();

/* ── saudade-schengen-form.js ──────────────────────────────────────────────────── */
// saudade · Schengen 90/180 entry form
//
// Tiny, paper-flavoured form that lets a user type their Schengen entries
// and instantly see the rolling-window calculation. Stays go to localStorage
// (saudade.schengen.stays) — never to the server.
//
// API:
//   window.SAUDADE_SCHENGEN_FORM.mount(container, { lang? })
//   window.SAUDADE_SCHENGEN_FORM.getStays()
'use strict';

(function() {
    if (window.SAUDADE_SCHENGEN_FORM) return;
    const KEY = 'saudade.schengen.stays';

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function getStays() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function setStays(arr) {
        try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
    }

    // 27 Schengen-area countries (incl. observers as of 2026 — Bulgaria,
    // Romania, Croatia all in. Cyprus pending — left out).
    const COUNTRIES = ['AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH'];

    function copy(lang) {
        return {
            title:    L({ en: 'Your Schengen log.', ko: '셰겐 입국 기록.', ja: 'シェンゲン入国記録。', pt: 'O seu registo Schengen.', es: 'Su registro Schengen.' }, lang),
            help:     L({
                en: 'Type each Schengen entry and exit. We never send this anywhere — it stays in your browser.',
                ko: '셰겐 입국과 출국을 한 줄씩 입력하라. 어디에도 전송하지 않는다 — 브라우저 안에만 머문다.',
                ja: 'シェンゲンの入国と出国を一行ずつ入力。どこにも送信しない — ブラウザ内に留まる。',
                pt: 'Adicione cada entrada e saída Schengen. Não enviamos para nenhum servidor — fica no seu browser.',
                es: 'Añada cada entrada y salida Schengen. No lo enviamos a ningún servidor — se queda en su navegador.'
            }, lang),
            colIn:    L({ en: 'IN',  ko: '입국',  ja: '入国',  pt: 'ENTRADA', es: 'ENTRADA' }, lang),
            colOut:   L({ en: 'OUT (or empty if still inside)', ko: '출국 (현재 안에 있으면 비워두기)', ja: '出国 (まだ滞在中なら空欄)', pt: 'SAÍDA (vazio = ainda dentro)', es: 'SALIDA (vacío = aún dentro)' }, lang),
            colCty:   L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            add:      L({ en: 'ADD ENTRY', ko: '기록 추가', ja: '入国を追加', pt: 'ADICIONAR', es: 'AÑADIR' }, lang),
            remove:   L({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }, lang),
            none:     L({ en: 'No entries yet.', ko: '아직 입력된 기록이 없다.', ja: 'まだ記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang)
        };
    }

    function injectStyles() {
        if (document.getElementById('sddSchFormStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddSchFormStyles';
        s.textContent = `
.sdd-schf {
    border-top: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 28px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-schf__h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 8px;
}
.sdd-schf__help {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 13px; color: var(--bone-d);
    margin: 0 0 16px;
}
.sdd-schf__cols {
    display: grid;
    grid-template-columns: 1.2fr 1.2fr 0.7fr auto;
    gap: 8px;
    font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d);
    padding: 6px 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-schf__row {
    display: grid;
    grid-template-columns: 1.2fr 1.2fr 0.7fr auto;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-schf__row input,
.sdd-schf__row select {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono); font-size: 13px;
    letter-spacing: 0.04em;
    padding: 6px 0;
    border-radius: 0;
    min-height: 36px;
    width: 100%;
    box-sizing: border-box;
    outline: none;
}
.sdd-schf__row input:focus,
.sdd-schf__row select:focus {
    border-bottom-color: var(--ink);
}
.sdd-schf__rm {
    background: transparent; border: 0; border-bottom: 0.5px solid transparent;
    color: var(--bone-d); cursor: pointer;
    font-family: var(--serif); font-style: italic; font-size: 18px;
    line-height: 1; padding: 4px 8px; min-height: 36px;
}
.sdd-schf__rm:hover { color: var(--rust); }
.sdd-schf__add {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px;
    transition: color .15s;
}
.sdd-schf__add:hover { color: var(--rust); }
.sdd-schf__add::before {
    content: "+"; color: var(--rust); margin-right: 12px;
    font-family: var(--serif); font-style: italic; font-size: 18px;
}
.sdd-schf__none {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d);
    padding: 14px 0; border-bottom: 0.5px solid var(--rule);
}
@media (max-width: 620px) {
    .sdd-schf__cols { grid-template-columns: 1fr 1fr; }
    .sdd-schf__cols span:nth-child(3),
    .sdd-schf__cols span:nth-child(4) { display: none; }
    .sdd-schf__row {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;
    }
    .sdd-schf__row .country { grid-column: 1 / 2; }
    .sdd-schf__row .rm      { grid-column: 2 / 3; justify-self: end; }
}
        `;
        document.head.appendChild(s);
    }

    function paint(host, lang) {
        const c = copy(lang);
        const stays = getStays();
        host.innerHTML = `
            <section class="sdd-schf">
                <p class="sdd-schf__h">${escapeHtml(c.title)}</p>
                <p class="sdd-schf__help">${escapeHtml(c.help)}</p>
                <div class="sdd-schf__cols">
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span>${escapeHtml(c.colCty)}</span>
                    <span></span>
                </div>
                <div data-rows>
                    ${stays.length ? stays.map((s, i) => row(s, i, c)).join('') :
                        `<p class="sdd-schf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-schf__add" data-add>${escapeHtml(c.add)}</button>
            </section>
        `;
        host.querySelector('[data-add]').addEventListener('click', () => {
            const next = stays.concat([{ in: '', out: '', country: '' }]);
            setStays(next);
            paint(host, lang);
            renderCalc();
            // focus the new row's IN input
            setTimeout(() => {
                const inputs = host.querySelectorAll('.sdd-schf__row input[type=date]');
                if (inputs.length) inputs[inputs.length - 2].focus();
            }, 0);
        });
        host.querySelectorAll('.sdd-schf__row').forEach(rowEl => {
            const idx = +rowEl.dataset.idx;
            rowEl.querySelector('[data-field=in]').addEventListener('input', e => {
                const cur = getStays(); cur[idx].in = e.target.value; setStays(cur); renderCalc();
            });
            rowEl.querySelector('[data-field=out]').addEventListener('input', e => {
                const cur = getStays(); cur[idx].out = e.target.value; setStays(cur); renderCalc();
            });
            rowEl.querySelector('[data-field=country]').addEventListener('change', e => {
                const cur = getStays(); cur[idx].country = e.target.value; setStays(cur); renderCalc();
            });
            rowEl.querySelector('[data-rm]').addEventListener('click', () => {
                const cur = getStays(); cur.splice(idx, 1); setStays(cur);
                paint(host, lang); renderCalc();
            });
        });
    }

    function row(s, i, c) {
        return `
            <div class="sdd-schf__row" data-idx="${i}">
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}" />
                <select class="country" data-field="country">
                    <option value="">—</option>
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co}</option>`).join('')}
                </select>
                <button type="button" class="sdd-schf__rm rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }

    function renderCalc() {
        // Surface the calc panel into #sddSchPanel if present (the ledger
        // already creates this container).
        const panel = document.getElementById('sddSchPanel');
        if (!panel || !window.SAUDADE_SCHENGEN) return;
        const stays = getStays().filter(s => s.in);
        window.SAUDADE_SCHENGEN.render(panel, { stays });
    }

    function mount(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        paint(host, opts && opts.lang);
        renderCalc();
    }

    window.SAUDADE_SCHENGEN_FORM = { mount, getStays };
})();

/* ── saudade-empty.js ──────────────────────────────────────────────────── */
// saudade · unified empty-state component
//
// Editor's-note flavoured empty states for every section. One look, five
// editions. Replaces the section-specific empty-state markup that was
// scattered across ledger / atlas / cover / dispatches.
//
// API:
//   window.SAUDADE_EMPTY.render(targetEl, {
//       eyebrow:  'A LEDGER, IN FOUR COLUMNS.',
//       headline: 'Nothing on the ledger yet.',
//       lede:     'Add a visa, a tax-residency entry…',
//       actions:  [{ label, onClick, kind: 'primary'|undefined, hint: 'Cmd+E' }],
//       note:     'We never store your data on a server.'
//   })
//
//   window.SAUDADE_EMPTY.text(section)   →  pre-translated copy bundle
//                                            for sections: ledger / atlas /
//                                            cover / dispatches / listening
'use strict';

(function() {
    if (window.SAUDADE_EMPTY) return;

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    const EDITOR_LABEL = {
        en: "Editor's note", ko: '편집장의 메모', ja: '編集長より',
        pt: 'Nota do editor', es: 'Nota del editor'
    };

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function render(target, opts) {
        if (!target) return null;
        opts = opts || {};
        const eyebrow  = opts.eyebrow  || '';
        const headline = opts.headline || '';
        const lede     = opts.lede     || '';
        const actions  = Array.isArray(opts.actions) ? opts.actions : [];
        const note     = opts.note     || '';

        const root = document.createElement('section');
        root.className = 'sdd-empty';
        root.setAttribute('data-editor-note-label', L(EDITOR_LABEL));
        root.innerHTML = `
            ${eyebrow ? `<p class="sdd-empty__eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
            ${headline ? `<h3 class="sdd-empty__h">${escapeHtml(headline)}</h3>` : ''}
            ${lede ? `<p class="sdd-empty__lede">${lede /* lede may include <em>/<strong> */}</p>` : ''}
            ${actions.length ? `<ul class="sdd-empty__actions" role="list">
                ${actions.map((a, i) => `
                    <li>
                        <button type="button"
                                class="sdd-empty__action ${a.kind === 'primary' ? 'is-primary' : ''}"
                                data-action-idx="${i}">
                            ${escapeHtml(a.label || '')}
                            ${a.hint ? `<small>${escapeHtml(a.hint)}</small>` : ''}
                        </button>
                    </li>`).join('')}
            </ul>` : ''}
            ${note ? `<p class="sdd-empty__note">${escapeHtml(note)}</p>` : ''}
        `;

        // Wire actions
        root.querySelectorAll('.sdd-empty__action').forEach(btn => {
            const idx = parseInt(btn.dataset.actionIdx, 10);
            const a = actions[idx];
            if (a && typeof a.onClick === 'function') {
                btn.addEventListener('click', a.onClick);
            } else if (a && a.href) {
                btn.addEventListener('click', () => { window.location.href = a.href; });
            }
        });

        // If `target` is a selector, replace its children with our element.
        const el = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!el) return root;
        el.innerHTML = '';
        el.appendChild(root);
        return root;
    }

    // ─── Pre-translated copy banks, per section ─────────────────────────
    function text(section) {
        switch (section) {
            case 'ledger':
                return {
                    eyebrow: L({ en: 'A LEDGER, IN FOUR COLUMNS.', ko: '네 칸짜리 장부.', ja: '四つの欄の台帳。', pt: 'UM LIVRO, EM QUATRO COLUNAS.', es: 'UN LIBRO, EN CUATRO COLUMNAS.' }),
                    headline: L({ en: 'Nothing on the ledger yet.', ko: '장부에 아직 아무것도 없다.', ja: '台帳にまだ何もない。', pt: 'Ainda nada no livro.', es: 'Todavía nada en el libro.' }),
                    lede: L({
                        en: 'Add a visa, a tax-residency entry, a health-insurance pause, or a pension filing. <em>Each entry is a row this newspaper will count from tomorrow morning.</em>',
                        ko: '비자·세금 거주일·건강보험 정지·연금 신고를 추가하라. <em>각 항목은 이 신문이 내일 아침부터 헤아릴 한 줄이 된다.</em>',
                        ja: 'ビザ、税居住、健康保険の停止、年金届出のいずれかを加える。<em>一つひとつが、明朝からこの新聞が数える一行になる。</em>',
                        pt: 'Adicione um visto, uma entrada fiscal, uma pausa de seguro, ou um registo de pensão. <em>Cada entrada é uma linha que este jornal contará a partir de amanhã.</em>',
                        es: 'Añada un visado, una residencia fiscal, una pausa de seguro o un registro de pensión. <em>Cada entrada es una línea que este periódico contará desde mañana.</em>'
                    }),
                    note: L({
                        en: 'We never store your visa data on a server. It lives on this device only — clear your browser, and it disappears with you.',
                        ko: '비자 데이터는 서버에 저장하지 않는다. 이 기기에만 머문다 — 브라우저를 비우면 함께 사라진다.',
                        ja: 'ビザ情報はサーバーに保存しない。この端末だけにある — ブラウザを消せば、ともに消える。',
                        pt: 'Nunca guardamos os seus dados num servidor. Vivem apenas neste dispositivo — limpe o navegador, e desaparecem consigo.',
                        es: 'Nunca guardamos sus datos en un servidor. Viven sólo en este dispositivo — limpie el navegador, y desaparecen con usted.'
                    })
                };
            case 'atlas':
                return {
                    eyebrow: L({ en: 'CAFÉS, VERIFIED.', ko: '확인된 카페.', ja: '確認済みカフェ。', pt: 'CAFÉS, VERIFICADOS.', es: 'CAFÉS, VERIFICADOS.' }),
                    headline: L({ en: 'No café visited yet.', ko: '아직 들른 카페가 없다.', ja: 'まだ訪れたカフェがない。', pt: 'Ainda não visitou nenhum café.', es: 'Todavía no ha visitado ningún café.' }),
                    lede: L({
                        en: 'Open a café from the list and tap <strong>I sat here</strong>. Each visit becomes a tiny row in your saudade — a record of where you actually wrote, not where the algorithm thought you should.',
                        ko: '목록에서 카페를 열고 <strong>여기 앉았다</strong> 를 눌러라. 방문 하나하나가 saudade 의 작은 한 줄이 된다 — 알고리즘이 추천한 곳이 아니라 실제로 글을 쓴 곳의 기록.',
                        ja: 'リストからカフェを開いて <strong>ここに座った</strong> を押す。訪問の一つひとつが saudade の小さな行になる — アルゴリズムが勧めた場所ではなく、実際に書いた場所の記録。',
                        pt: 'Abra um café da lista e toque <strong>Sentei-me aqui</strong>. Cada visita torna-se uma pequena linha na sua saudade — um registo de onde escreveu de facto, não onde o algoritmo achou que devia.',
                        es: 'Abra un café de la lista y pulse <strong>Me senté aquí</strong>. Cada visita se convierte en una pequeña línea de su saudade — un registro de dónde escribió de verdad, no de dónde el algoritmo creyó que debía.'
                    }),
                    note: L({
                        en: 'A note from the desk. We test outlets, noise, and Wi-Fi ourselves. We do not list a café we have not sat in.',
                        ko: '편집부의 메모. 콘센트·소음·와이파이는 우리가 직접 시험한다. 앉아보지 않은 카페는 등록하지 않는다.',
                        ja: '編集部より。コンセント・騒音・Wi-Fi は自分たちで試す。座ったことのないカフェは載せない。',
                        pt: 'Uma nota da redacção. Testamos as tomadas, o ruído e o Wi-Fi. Não listamos um café onde não nos sentámos.',
                        es: 'Una nota de la redacción. Probamos enchufes, ruido y Wi-Fi. No incluimos un café donde no nos hayamos sentado.'
                    })
                };
            case 'dispatches':
                return {
                    eyebrow: L({ en: 'THE WIRES, EDITED.', ko: '편집된 통신문.', ja: '編まれた電信。', pt: 'OS DESPACHOS, EDITADOS.', es: 'LOS DESPACHOS, EDITADOS.' }),
                    headline: L({ en: 'No dispatch ready.', ko: '아직 도착한 디스패치가 없다.', ja: 'まだディスパッチがない。', pt: 'Ainda não há despachos.', es: 'Todavía no hay despachos.' }),
                    lede: L({
                        en: 'The desk files three city items, six days a week. <em>Sunday is silence — by design.</em>',
                        ko: '편집부는 일주일에 엿새, 도시당 세 항목을 보낸다. <em>일요일은 침묵 — 의도된.</em>',
                        ja: '編集部は週六日、都市ごとに三本を送る。<em>日曜は沈黙 — 意図されたもの。</em>',
                        pt: 'A redacção arquiva três itens por cidade, seis dias por semana. <em>Domingo é silêncio — propositado.</em>',
                        es: 'La redacción archiva tres elementos por ciudad, seis días por semana. <em>El domingo es silencio — intencionado.</em>'
                    }),
                    note: L({
                        en: 'Dispatches are AI-assisted and reviewed by a human editor. Sources are quoted at most twenty-five words.',
                        ko: '디스패치는 AI 보조로 작성되고 사람 편집장이 다시 본다. 인용은 25 단어를 넘지 않는다.',
                        ja: 'ディスパッチは AI 補助で書き、人間の編集長が手を入れる。引用は二十五語を超えない。',
                        pt: 'Os despachos são assistidos por IA e revistos por um editor humano. Citamos no máximo vinte e cinco palavras.',
                        es: 'Los despachos son asistidos por IA y revisados por un editor humano. Citamos como máximo veinticinco palabras.'
                    })
                };
            case 'cover':
                return {
                    eyebrow: L({ en: 'TODAY.', ko: '오늘.', ja: '今日。', pt: 'HOJE.', es: 'HOY.' }),
                    headline: L({ en: 'Three cities, no schedule.', ko: '세 도시, 정해진 시간 없음.', ja: '三つの都市、時刻表なし。', pt: 'Três cidades, sem horário.', es: 'Tres ciudades, sin horario.' }),
                    lede: L({
                        en: 'Edited from Lisbon. <em>A slow newspaper for digital nomads.</em>',
                        ko: '리스본에서 편집. <em>디지털 노마드를 위한 느린 신문.</em>',
                        ja: 'リスボン編集。<em>デジタルノマドのための、ゆっくりとした新聞。</em>',
                        pt: 'Editado em Lisboa. <em>Um jornal lento para nómadas digitais.</em>',
                        es: 'Editado desde Lisboa. <em>Un periódico lento para nómadas digitales.</em>'
                    }),
                    note: ''
                };
            case 'listening':
                return {
                    eyebrow: L({ en: 'THE LISTENING ROOM.', ko: '청취실.', ja: 'リスニングルーム。', pt: 'A SALA DE ESCUTA.', es: 'LA SALA DE ESCUCHA.' }),
                    headline: L({ en: 'Choose a city to listen.', ko: '들을 도시를 고르라.', ja: '聞く都市を選ぶ。', pt: 'Escolha uma cidade para ouvir.', es: 'Elija una ciudad para escuchar.' }),
                    lede: L({
                        en: 'Field-recorded. One ambient track per city. <em>Headphones recommended; not required.</em>',
                        ko: '현장 녹음. 도시당 한 트랙. <em>이어폰 권장; 필수 아님.</em>',
                        ja: '現場録音。都市につき一トラック。<em>イヤホン推奨。必須ではない。</em>',
                        pt: 'Gravado no terreno. Uma faixa por cidade. <em>Auscultadores recomendados; não obrigatórios.</em>',
                        es: 'Grabado en el lugar. Una pista por ciudad. <em>Auriculares recomendados; no obligatorios.</em>'
                    }),
                    note: L({
                        en: 'Every track declares its licence and credits. CONTENT-LICENSE.md §3.',
                        ko: '모든 트랙은 라이선스와 크레딧을 명시한다. CONTENT-LICENSE.md §3.',
                        ja: '全トラックがライセンスとクレジットを明記。CONTENT-LICENSE.md §3。',
                        pt: 'Cada faixa declara a sua licença e créditos. CONTENT-LICENSE.md §3.',
                        es: 'Cada pista declara su licencia y créditos. CONTENT-LICENSE.md §3.'
                    })
                };
            default:
                return { eyebrow: '', headline: '', lede: '', note: '' };
        }
    }

    window.SAUDADE_EMPTY = { render, text };
})();

/* ── saudade-welcome.js ──────────────────────────────────────────────────── */
// saudade · first-run welcome
//
// A three-card welcome that runs once per device. Sets the tone: this is a
// newspaper, not a dashboard. Skippable (Esc / Skip / Don't show again).
//
// Trigger:
//   • shown automatically the first time the cover loads on a fresh device
//   • re-openable via window.SAUDADE_WELCOME.open() or #welcome hash
'use strict';

(function() {
    if (window.SAUDADE_WELCOME) return;
    const KEY = 'saudade.welcome.seen';

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function copy() {
        return [
            {
                eyebrow:  L({ en: 'WELCOME TO SAUDADE.', ko: 'SAUDADE 에 어서 오라.', ja: 'SAUDADE へようこそ。', pt: 'BEM-VINDO À SAUDADE.', es: 'BIENVENIDO A SAUDADE.' }),
                headline: L({
                    en: 'A slow newspaper for people who keep moving.',
                    ko: '계속 움직이는 사람들을 위한 느린 신문.',
                    ja: '動き続ける人のための、ゆっくりとした新聞。',
                    pt: 'Um jornal lento para quem continua a mover-se.',
                    es: 'Un periódico lento para quienes siguen moviéndose.'
                }),
                body: L({
                    en: '<em>saudade</em> is Portuguese for the longing you carry for places you can’t return to. We file three city items, six days a week. Sunday is silence — by design.',
                    ko: '<em>saudade</em> 는 돌아갈 수 없는 장소에 대한 그리움이라는 뜻의 포르투갈어. 우리는 일주일에 엿새, 도시당 세 항목을 보낸다. 일요일은 침묵 — 의도된 것.',
                    ja: '<em>saudade</em> は、戻れない場所への切なさを意味するポルトガル語。週六日、都市ごとに三本を届ける。日曜は沈黙 — 意図されたもの。',
                    pt: '<em>saudade</em> em português é a ausência de algo a que não se pode regressar. Arquivamos três itens por cidade, seis dias por semana. Domingo é silêncio — propositado.',
                    es: '<em>saudade</em> en portugués significa la añoranza por los lugares a los que no se puede volver. Archivamos tres elementos por ciudad, seis días por semana. El domingo es silencio — intencionado.'
                })
            },
            {
                eyebrow:  L({ en: 'FOUR SECTIONS.', ko: '네 개의 섹션.', ja: '四つのセクション。', pt: 'QUATRO SECÇÕES.', es: 'CUATRO SECCIONES.' }),
                headline: L({
                    en: 'A ledger, an atlas, dispatches, and the desk.',
                    ko: '장부, 지도, 디스패치, 그리고 편집부.',
                    ja: '台帳、地図、ディスパッチ、編集部。',
                    pt: 'Um livro-razão, um atlas, despachos, e a redacção.',
                    es: 'Un libro mayor, un atlas, despachos, y la redacción.'
                }),
                body: L({
                    en: '<strong>§01 Ledger</strong> counts visa days, tax-residency days, insurance pauses, pension filings. <strong>§02 Atlas</strong> is verified work cafés. <strong>§03 Dispatches</strong> is policy news. <strong>§04 The Desk</strong> shows the daily filing pipeline.',
                    ko: '<strong>§01 Ledger</strong> 는 비자·세금·보험·연금 일수를 헤아린다. <strong>§02 Atlas</strong> 는 검증된 작업용 카페. <strong>§03 Dispatches</strong> 는 정책 뉴스. <strong>§04 The Desk</strong> 는 일일 발행 파이프라인.',
                    ja: '<strong>§01 Ledger</strong> はビザ・税・保険・年金の日数を数える。<strong>§02 Atlas</strong> は検証済みの作業向けカフェ。<strong>§03 Dispatches</strong> は政策ニュース。<strong>§04 The Desk</strong> は日次入稿パイプライン。',
                    pt: '<strong>§01 Ledger</strong> conta dias de visto, residência fiscal, pausas de seguro, pensões. <strong>§02 Atlas</strong> são cafés de trabalho verificados. <strong>§03 Dispatches</strong> é notícia de política. <strong>§04 The Desk</strong> mostra o pipeline diário.',
                    es: '<strong>§01 Ledger</strong> cuenta días de visado, residencia fiscal, pausas de seguro, pensiones. <strong>§02 Atlas</strong> son cafés de trabajo verificados. <strong>§03 Dispatches</strong> son noticias de política. <strong>§04 The Desk</strong> muestra el pipeline diario.'
                })
            },
            {
                eyebrow:  L({ en: 'BEFORE YOU READ.', ko: '읽기 전에.', ja: '読む前に。', pt: 'ANTES DE LER.', es: 'ANTES DE LEER.' }),
                headline: L({
                    en: 'Sign in, or browse without.',
                    ko: '로그인하거나, 그냥 둘러보라.',
                    ja: 'サインインするか、そのまま読む。',
                    pt: 'Entre, ou navegue sem registar.',
                    es: 'Inicie sesión, o navegue sin registrarse.'
                }),
                body: L({
                    en: 'Magic-link only — no password, no tracker. Your visa data lives on this device. Whatever we do hold, you can export, delete, or revoke from <code>#account</code> at any time.',
                    ko: '매직 링크만 사용 — 비밀번호도, 추적도 없다. 비자 데이터는 이 기기에만 머문다. 우리가 보관하는 것은 무엇이든 <code>#account</code> 에서 언제든 내보내기·삭제·회수 가능.',
                    ja: 'マジックリンクのみ — パスワードも追跡もなし。ビザ情報はこの端末だけにある。我々が保持するものは <code>#account</code> でいつでもエクスポート・削除・取消できる。',
                    pt: 'Apenas magic-link — sem palavra-passe, sem rastreamento. Os dados de visto vivem neste dispositivo. O que tivermos, pode exportar, apagar, ou revogar em <code>#account</code> a qualquer momento.',
                    es: 'Sólo magic-link — sin contraseña, sin rastreo. Sus datos de visado viven en este dispositivo. Lo que conservemos, puede exportar, borrar o revocar en <code>#account</code> en cualquier momento.'
                })
            }
        ];
    }

    function btnCopy() {
        return {
            next:  L({ en: 'CONTINUE', ko: '계속', ja: '次へ', pt: 'CONTINUAR', es: 'CONTINUAR' }),
            back:  L({ en: 'BACK', ko: '뒤로', ja: '戻る', pt: 'VOLTAR', es: 'VOLVER' }),
            done:  L({ en: 'BEGIN READING', ko: '읽기 시작', ja: '読みはじめる', pt: 'COMEÇAR A LER', es: 'EMPEZAR A LEER' }),
            skip:  L({ en: 'SKIP', ko: '건너뛰기', ja: 'スキップ', pt: 'SALTAR', es: 'OMITIR' })
        };
    }

    function injectStyles() {
        if (document.getElementById('sddWelcomeStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWelcomeStyles';
        s.textContent = `
.sdd-welcome {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--paper);
    color: var(--ink);
    display: none;
    align-items: center;
    justify-content: center;
    padding: clamp(40px, 8vw, 96px);
    overflow-y: auto;
    animation: sddWelcomeFade .35s ease both;
}
.sdd-welcome.active { display: flex; }
@keyframes sddWelcomeFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.sdd-welcome__inner {
    width: 100%; max-width: 560px;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(28px, 4vw, 48px) 0;
}
.sdd-welcome__step {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(14px, 2vw, 18px);
    display: flex; gap: 6px;
}
.sdd-welcome__step span {
    display: inline-block; width: 14px; height: 1px; background: var(--rule);
}
.sdd-welcome__step span.active { background: var(--rust); height: 2px; }
.sdd-welcome__eyebrow {
    font-family: var(--mono); font-weight: 500;
    font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 clamp(14px, 2vw, 20px);
}
.sdd-welcome__h {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(34px, 4.5vw, 52px); line-height: 1.02;
    letter-spacing: -0.025em;
    color: var(--ink); margin: 0 0 clamp(20px, 3vw, 28px);
    text-wrap: balance;
}
.sdd-welcome__body {
    font-family: var(--serif); font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px); line-height: 1.6;
    color: var(--ink); margin: 0 0 clamp(28px, 4vw, 40px);
    max-width: 48ch;
}
.sdd-welcome__body em { font-style: italic; color: var(--rust); }
.sdd-welcome__body strong { font-weight: 400; color: var(--rust); }
.sdd-welcome__body code {
    font-family: var(--mono); font-size: 12px;
    padding: 1px 6px; background: var(--paper-d); border: 0.5px solid var(--rule);
}
.sdd-welcome__nav {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 0.5px solid var(--rule);
    padding-top: clamp(16px, 2vw, 22px);
    gap: 16px;
}
.sdd-welcome__btn {
    background: transparent; border: 0;
    font-family: var(--mono); font-weight: 500;
    font-size: 12px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); cursor: pointer; padding: 12px 4px;
    transition: color .15s;
    min-height: 44px;
}
.sdd-welcome__btn:hover { color: var(--rust); }
.sdd-welcome__btn.is-quiet { color: var(--bone-d); }
.sdd-welcome__btn[disabled] { opacity: 0.3; pointer-events: none; }
.sdd-welcome__skip {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0;
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); cursor: pointer;
}
.sdd-welcome__skip:hover { color: var(--rust); }

@media (prefers-reduced-motion: reduce) {
    .sdd-welcome { animation: none; }
}
@media print { .sdd-welcome { display: none !important; } }
        `;
        document.head.appendChild(s);
    }

    let _root = null;
    let _step = 0;

    function ensureRoot() {
        if (_root) return _root;
        _root = document.createElement('div');
        _root.className = 'sdd-welcome';
        _root.setAttribute('role', 'dialog');
        _root.setAttribute('aria-modal', 'true');
        _root.setAttribute('aria-label', 'Welcome to saudade');
        document.body.appendChild(_root);
        document.addEventListener('keydown', (e) => {
            if (!_root.classList.contains('active')) return;
            if (e.key === 'Escape') close(true);
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft')  prev();
        });
        return _root;
    }

    function paint() {
        const cards = copy();
        const step = cards[_step];
        const b = btnCopy();
        const dots = cards.map((_, i) => `<span class="${i <= _step ? 'active' : ''}"></span>`).join('');
        ensureRoot().innerHTML = `
            <button type="button" class="sdd-welcome__skip" data-skip>${escapeHtml(b.skip)}</button>
            <div class="sdd-welcome__inner">
                <div class="sdd-welcome__step">${dots}</div>
                <p class="sdd-welcome__eyebrow">${escapeHtml(step.eyebrow)}</p>
                <h1 class="sdd-welcome__h">${escapeHtml(step.headline)}</h1>
                <p class="sdd-welcome__body">${step.body /* trusted: from in-file copy bank */}</p>
                <div class="sdd-welcome__nav">
                    <button type="button" class="sdd-welcome__btn is-quiet" data-back ${_step === 0 ? 'disabled' : ''}>${escapeHtml(b.back)}</button>
                    <button type="button" class="sdd-welcome__btn" data-next>${escapeHtml(_step === cards.length - 1 ? b.done : b.next)}</button>
                </div>
            </div>
        `;
        _root.querySelector('[data-skip]').addEventListener('click', () => close(true));
        _root.querySelector('[data-back]').addEventListener('click', prev);
        _root.querySelector('[data-next]').addEventListener('click', next);
    }

    function next() {
        const len = copy().length;
        if (_step < len - 1) { _step++; paint(); }
        else { close(true); }
    }
    function prev() {
        if (_step > 0) { _step--; paint(); }
    }

    function open() {
        injectStyles();
        _step = 0;
        paint();
        ensureRoot().classList.add('active');
    }
    function close(seen) {
        if (_root) _root.classList.remove('active');
        if (seen) try { localStorage.setItem(KEY, '1'); } catch (e) {}
        if (location.hash === '#welcome') {
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }

    function maybeAutoOpen() {
        try {
            if (localStorage.getItem(KEY) === '1') return;
        } catch (e) { return; }
        // Don't show on top of magic-link verify or already-deep-linked panels.
        if (location.search && /token=/.test(location.search)) return;
        if (location.hash && location.hash !== '#welcome') return;
        // 600 ms delay so the cover painting finishes first.
        setTimeout(open, 600);
    }

    function init() {
        injectStyles();
        if (location.hash === '#welcome') { open(); return; }
        maybeAutoOpen();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    window.SAUDADE_WELCOME = { open, close };
})();

/* ── saudade-footer-rule.js ──────────────────────────────────────────────────── */
// SAUDADE · FOOTER RULE (헌법 §0.5-5)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
// dock 위에 항상 떠 있는 룰 + 카피라인. 메인 / 섹션 모두 동일한 구조.
// "PG 04 OF 12 · § 01 · LEDGER · saudade" 식.
'use strict';

(function() {
    if (window.SAUDADE_FOOTER) return;

    function injectStyles() {
        if (document.getElementById('sddFooterStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddFooterStyles';
        s.textContent = `
.sdd-footer-rule {
    position: fixed;
    bottom: var(--dock-h, 56px);
    left: 0; right: 0;
    padding: clamp(8px, 1vw, 12px) clamp(20px, 5vw, 64px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 0.5px solid var(--rule);
    background: var(--paper);
    z-index: 5;
    pointer-events: none;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-meta, .18em);
    text-transform: uppercase;
    color: var(--bone-d);
}
body.cafe-mode .sdd-footer-rule { display: none; }

.sdd-footer-r .sdd-footer-copy {
    color: inherit;
    text-decoration: none;
    border-bottom: 0.5px solid transparent;
    transition: color .15s, border-color .15s;
}
.sdd-footer-r .sdd-footer-copy:hover {
    color: var(--rust);
    border-bottom-color: var(--rust);
}
.sdd-footer-l, .sdd-footer-r {
    display: flex; gap: clamp(8px, 1.5vw, 24px); align-items: center;
}

@media (max-width: 768px) {
    .sdd-footer-rule {
        padding: 6px 12px;
        font-size: 8.5px;
        gap: 6px;
    }
    .sdd-footer-r .sdd-footer-copy { display: none; }
}

/* dock 위 v600 의 .bottom-dock::before 푸터는 영구 hide (이 컴포넌트로 대체) */
body:not(.cafe-mode) .bottom-dock::before { content: none !important; display: none !important; }
`;
        document.head.appendChild(s);
    }

    function ensureFooter() {
        let f = document.getElementById('sddFooter');
        if (f) return f;
        f = document.createElement('footer');
        f.id = 'sddFooter';
        f.className = 'sdd-footer-rule';
        f.innerHTML = `
            <div class="sdd-footer-l">
                <span class="sdd-footer-page"></span>
                <span class="sdd-footer-section"></span>
            </div>
            <div class="sdd-footer-r">
                <a class="sdd-footer-copy" href="etymology.html"
                   title="saudade /sɐwˈðaðɨ/ — read the etymology">saudade · a longing for what cannot return</a>
                <span class="sdd-footer-issue">© 2026</span>
            </div>
        `;
        document.body.appendChild(f);
        return f;
    }

    function update() {
        const f = ensureFooter();
        const sec = document.body.getAttribute('data-section');
        const SECTIONS = window.SAUDADE_MASTHEAD?.SECTIONS;
        if (sec && SECTIONS) {
            const matched = Object.values(SECTIONS).find(s => s.num === sec);
            if (matched) {
                f.querySelector('.sdd-footer-page').textContent = matched.page + ' OF 12';
                f.querySelector('.sdd-footer-section').textContent = '§ ' + matched.num + ' · ' + matched.name;
                return;
            }
        }
        f.querySelector('.sdd-footer-page').textContent = 'P. 01 OF 12';
        f.querySelector('.sdd-footer-section').textContent = '§ 00 · ISSUE COVER';
    }

    function init() {
        injectStyles();
        ensureFooter();
        update();
        // body class 변경 시 (section-active 토글) 자동 갱신
        const mo = new MutationObserver(update);
        mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-section'] });
        window.SAUDADE_FOOTER = { update };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
