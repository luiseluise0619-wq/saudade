/*! saudade · saudade.core.js · built 2026-05-05T10:42:17Z · https://saudade.app — concatenated IIFE modules, see /scripts/build-bundle.js */

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
    position: fixed; inset: 0; z-index: var(--z-modal-account);
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
            title:   L({ en: 'Schengen 90/180.', ko: '솅겐 90/180.', ja: 'シェンゲン 90/180。', pt: 'Schengen 90/180.', es: 'Schengen 90/180.' }, lang),
            usedLab: L({ en: 'DAYS USED',    ko: '사용 일수',  ja: '使用日数',    pt: 'DIAS USADOS',  es: 'DÍAS USADOS' }, lang),
            remLab:  L({ en: 'DAYS REMAINING', ko: '남은 일수', ja: '残り日数',   pt: 'DIAS RESTANTES', es: 'DÍAS RESTANTES' }, lang),
            window:  L({ en: 'IN THE 180 DAYS ENDING', ko: '기준일 직전 180일', ja: '基準日までの180日間', pt: 'NOS 180 DIAS ATÉ', es: 'EN LOS 180 DÍAS HASTA' }, lang),
            insideY: L({ en: 'You are inside Schengen on the reference date.', ko: '기준일 현재 솅겐 안에 있다.', ja: '基準日現在シェンゲン圏内にいる。', pt: 'Está dentro de Schengen na data de referência.', es: 'Está dentro de Schengen en la fecha de referencia.' }, lang),
            insideN: L({ en: 'You are outside Schengen on the reference date.', ko: '기준일 현재 솅겐 밖에 있다.', ja: '基準日現在シェンゲン圏外にいる。', pt: 'Está fora de Schengen na data de referência.', es: 'Está fuera de Schengen en la fecha de referencia.' }, lang),
            full:    L({ en: 'WINDOW FULLY RESETS', ko: '윈도우 완전 초기화', ja: 'ウィンドウ完全リセット', pt: 'JANELA REINICIA POR COMPLETO', es: 'VENTANA SE REINICIA POR COMPLETO' }, lang),
            safe:    L({ en: 'NEXT SAFE ENTRY ≥ 1 DAY', ko: '다음 입국 가능 (≥1일)', ja: '次に入国可能 (≥1日)', pt: 'PRÓXIMA ENTRADA SEGURA (≥1 DIA)', es: 'PRÓXIMA ENTRADA SEGURA (≥1 DÍA)' }, lang),
            note:    L({ en: 'A calendar, not advice. Verify with your consulate.', ko: '계산기가 아니라 달력. 영사관에 확인하라.', ja: 'これは計算機ではなく暦。領事館に確認を。', pt: 'Um calendário, não um conselho. Confirme com o seu consulado.', es: 'Un calendario, no un consejo. Confirme con su consulado.' }, lang),
            empty:   L({ en: 'Add at least one Schengen entry above.', ko: '솅겐 입국 기록을 하나 이상 추가하라.', ja: '少なくとも一回のシェンゲン入国を追加してください。', pt: 'Adicione pelo menos uma entrada Schengen acima.', es: 'Añada al menos una entrada Schengen arriba.' }, lang)
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
                        <p class="sdd-sch-num">${Math.min(r.used_in_window, r.max)}<span class="sdd-sch-of"> / ${r.max}</span>${r.used_in_window > r.max ? `<span class="sdd-sch-over"> · +${r.used_in_window - r.max} OVER</span>` : ''}</p>
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
.sdd-sch-over {
    font-size: 0.30em; color: var(--rust);
    font-style: normal; letter-spacing: 0.32em;
    font-family: var(--mono); font-weight: 500;
    text-transform: uppercase;
    margin-left: 8px;
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

/* ── saudade-tax.js ──────────────────────────────────────────────────── */
// saudade · tax-residency day counter
//
// Counts presence days per country per tax-year window. The 183-day rule is
// the universal anchor — if you spend more than 183 days of a country's tax
// year inside that country, you almost certainly become a tax resident.
//
// What this is: a calendar of presence, summed by country. We do NOT
// claim tax residency conclusions — different jurisdictions have different
// extras (UK Statutory Residence Test ties, USA substantial-presence weighting,
// Spain centre-of-life, Korea calendar-year vs Portugal calendar-year+).
// Surface the data; let the user think.
//
// API:
//   window.SAUDADE_TAX.calc({ stays, year?, ref? })
//     stays = [{ country, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD' }]
//     year  = 'YYYY' (default: year of ref). Country tax-years that don't
//             align with calendar — UK 6 Apr→5 Apr, India Apr 1→Mar 31, etc. —
//             are TODO; v1 uses Jan 1 → Dec 31 with a country-specific override
//             table for the major exceptions.
//   →  {
//        year, ref,
//        per_country: [{ country, days_in_year, days_total, last_seen, near_threshold, over_threshold }]
//      }
//
//   window.SAUDADE_TAX.render(container, { stays, lang, year? })
//
// Caveat displayed inline: "We are not your accountant."
'use strict';

(function() {
    if (window.SAUDADE_TAX) return;

    const THRESHOLD = 183;
    const NEAR      = 150;       // amber warning when close
    const MS_DAY    = 86400000;

    // Country tax years where the rule is not Jan 1 → Dec 31.
    // Key = ISO-3166 alpha-2, value = [startMonth, startDay] (1-indexed).
    const TAX_YEAR_START = {
        GB: [4, 6],     // United Kingdom: 6 April
        IN: [4, 1],     // India:           1 April
        AU: [7, 1],     // Australia:       1 July
        NZ: [4, 1],     // New Zealand:     1 April
        ZA: [3, 1],     // South Africa:    1 March
        // All others fall back to Jan 1.
    };

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function toUTC(s) {
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
    function clamp(d, min, max) {
        if (d < min) return new Date(min);
        if (d > max) return new Date(max);
        return new Date(d);
    }

    function taxYearWindow(country, year) {
        const cfg = TAX_YEAR_START[country];
        if (!cfg) {
            return [
                new Date(Date.UTC(year, 0, 1)),
                new Date(Date.UTC(year, 11, 31))
            ];
        }
        const [m, d] = cfg;
        const start = new Date(Date.UTC(year, m - 1, d));
        const end   = new Date(start.getTime() + 365 * MS_DAY - MS_DAY);
        return [start, end];
    }

    function calc(opts) {
        opts = opts || {};
        const stays = Array.isArray(opts.stays) ? opts.stays : [];
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const year = opts.year ? +opts.year : ref.getUTCFullYear();

        // Group stays by country.
        const byCountry = {};
        for (const s of stays) {
            const country = (s.country || '').toUpperCase().slice(0, 3);
            if (!country) continue;
            const a = toUTC(s.in);
            if (!a) continue;
            const b = toUTC(s.out) || ref;
            if (b < a) continue;
            (byCountry[country] = byCountry[country] || []).push([a, b]);
        }

        const per_country = Object.keys(byCountry).sort().map(country => {
            const ranges = byCountry[country];
            const [winStart, winEnd] = taxYearWindow(country, year);
            // Days inside the tax-year window for this country.
            // Both endpoints inclusive — same convention as Schengen.
            const setYear = new Set();
            const setTotal = new Set();
            let lastSeen = null;
            for (const [a, b] of ranges) {
                for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                    const k = fmt(d);
                    setTotal.add(k);
                    if (d >= winStart && d <= winEnd) setYear.add(k);
                    if (!lastSeen || d > lastSeen) lastSeen = new Date(d);
                }
            }
            const days_in_year = setYear.size;
            const days_total   = setTotal.size;
            return {
                country,
                tax_year_start: fmt(winStart),
                tax_year_end:   fmt(winEnd),
                days_in_year,
                days_total,
                last_seen: lastSeen ? fmt(lastSeen) : null,
                near_threshold: days_in_year >= NEAR && days_in_year < THRESHOLD,
                over_threshold: days_in_year >= THRESHOLD
            };
        });

        return { year, ref: fmt(ref), per_country, threshold: THRESHOLD };
    }

    function copy(lang) {
        return {
            title:   L({ en: 'Tax-residency days.', ko: '세금 거주일.', ja: '税居住日。', pt: 'Dias de residência fiscal.', es: 'Días de residencia fiscal.' }, lang),
            year:    L({ en: 'TAX YEAR', ko: '과세년도', ja: '税年度', pt: 'ANO FISCAL', es: 'AÑO FISCAL' }, lang),
            country: L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            days:    L({ en: 'DAYS IN YEAR', ko: '연내 일수', ja: '年内日数', pt: 'DIAS NO ANO', es: 'DÍAS EN EL AÑO' }, lang),
            window:  L({ en: 'WINDOW', ko: '윈도우', ja: 'ウィンドウ', pt: 'JANELA', es: 'VENTANA' }, lang),
            none:    L({ en: 'No tax-residency entries yet.', ko: '아직 입력된 세금 거주일 기록이 없다.', ja: 'まだ税居住日の記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang),
            note:    L({
                en: 'A calendar, not advice. Different countries weight ties beyond presence days. Consult a tax adviser before filing.',
                ko: '계산기가 아니라 달력. 국가마다 거주성 판단에 거주일 외의 연결고리도 본다. 신고 전에 세무사 상담 필수.',
                ja: '計算機ではなく暦。国によっては居住日数以外の紐帯も考慮する。申告前に税理士へ。',
                pt: 'Um calendário, não um conselho. Cada país pondera laços para além dos dias. Consulte um contabilista antes de declarar.',
                es: 'Un calendario, no un consejo. Cada país pondera vínculos más allá de los días. Consulte a un asesor antes de declarar.'
            }, lang),
            over:    L({ en: 'OVER 183', ko: '183 초과', ja: '183超過', pt: 'ACIMA DE 183', es: 'POR ENCIMA DE 183' }, lang),
            near:    L({ en: 'NEAR 183', ko: '183에 근접', ja: '183に接近', pt: 'PERTO DE 183', es: 'CERCA DE 183' }, lang)
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
        const c = copy(lang);
        if (!stays.length) {
            root.innerHTML = `<p class="sdd-tax-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = calc({ stays, year: opts && opts.year, ref: opts && opts.ref });
        const rows = r.per_country.map(p => {
            const cls = p.over_threshold ? 'is-over' : p.near_threshold ? 'is-near' : '';
            const tag = p.over_threshold ? c.over : p.near_threshold ? c.near : '';
            return `
                <tr class="sdd-tax-row ${escapeHtml(cls)}">
                    <td class="sdd-tax-c">${escapeHtml(p.country)}</td>
                    <td class="sdd-tax-d">${p.days_in_year}<span class="of"> / ${r.threshold}</span></td>
                    <td class="sdd-tax-w">${escapeHtml(p.tax_year_start)} → ${escapeHtml(p.tax_year_end)}</td>
                    <td class="sdd-tax-t">${tag ? escapeHtml(tag) : ''}</td>
                </tr>
            `;
        }).join('');
        root.innerHTML = `
            <section class="sdd-tax-panel">
                <h3 class="sdd-tax-h">${escapeHtml(c.title)}</h3>
                <table class="sdd-tax-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(c.country)}</th>
                            <th>${escapeHtml(c.days)}</th>
                            <th>${escapeHtml(c.window)}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="sdd-tax-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddTaxStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddTaxStyles';
        s.textContent = `
.sdd-tax-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-tax-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-tax-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 12px;
}
.sdd-tax-table th {
    font-family: var(--mono); font-weight: 500;
    font-size: 9px; letter-spacing: 0.32em;
    text-transform: uppercase;
    text-align: left;
    color: var(--bone-d);
    padding: 8px 12px 8px 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-tax-table td {
    padding: 12px 12px 12px 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink); vertical-align: baseline;
}
.sdd-tax-c {
    font-weight: 500; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink);
}
.sdd-tax-d {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 24px; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums;
}
.sdd-tax-d .of { font-size: 0.45em; color: var(--bone-d); font-style: normal; letter-spacing: 0.06em; margin-left: 4px; }
.sdd-tax-row.is-near .sdd-tax-d { color: var(--signal); }
.sdd-tax-row.is-over .sdd-tax-d { color: var(--rust); }
.sdd-tax-w { color: var(--bone-d); font-size: 11px; }
.sdd-tax-t {
    font-family: var(--mono); font-weight: 500; font-size: 9px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust);
    text-align: right; white-space: nowrap;
}
.sdd-tax-row.is-near .sdd-tax-t { color: var(--signal); }
.sdd-tax-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; line-height: 1.55;
    color: var(--bone-d); margin: 16px 0 0;
}
.sdd-tax-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}
@media (max-width: 540px) {
    .sdd-tax-table { font-size: 11px; }
    .sdd-tax-w { display: none; }
    .sdd-tax-table th:nth-child(3) { display: none; }
    .sdd-tax-table td:nth-child(3) { display: none; }
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_TAX = { calc, render, THRESHOLD };
})();

/* ── saudade-coverage.js ──────────────────────────────────────────────────── */
// saudade · coverage gaps — health insurance & pension filings
//
// Two related calendars:
//   1. Health insurance — given a list of policy windows, find days the
//      traveller had NO valid policy. SafetyWing / IMG / national schemes
//      go in here; gap days are flagged so the user sees uninsured travel.
//   2. Pension contribution windows — same shape, surfaced as "months
//      contributed" rather than "days uninsured" because pension entitlement
//      typically vests on whole-month thresholds (KR NPS 10y/120mo,
//      UK NIC qualifying weeks, etc.).
//
// Same shape as saudade-schengen.js / saudade-tax.js — pure calc + render
// + paper-flavoured panel. Editor-voice caveat about not being an adviser.
//
// API:
//   window.SAUDADE_COVERAGE.insurance({ policies, ref?, year? })
//     policies = [{ provider, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD', country?: 'PT' }]
//     →  {
//          year, ref,
//          covered_days, gap_days, longest_gap_days,
//          gaps: [{ from, to, days }]   // each contiguous uninsured stretch
//        }
//
//   window.SAUDADE_COVERAGE.pension({ filings, ref? })
//     filings = [{ scheme, in: 'YYYY-MM-DD', out?: 'YYYY-MM-DD', country?: 'KR' }]
//     →  {
//          ref,
//          per_scheme: [{ scheme, country, months_contributed, last_filed,
//                          to_120_months, to_240_months }]
//        }
//
//   window.SAUDADE_COVERAGE.renderInsurance(container, { policies, lang })
//   window.SAUDADE_COVERAGE.renderPension(container, { filings, lang })
'use strict';

(function() {
    if (window.SAUDADE_COVERAGE) return;

    const MS_DAY  = 86400000;
    const NPS_MIN = 120;     // KR NPS minimum qualifying months for retirement (10 years)

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function toUTC(s) {
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
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY) + 1; }

    // ─── Health insurance ───────────────────────────────────────────────
    function insurance(opts) {
        opts = opts || {};
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();
        const year = opts.year ? +opts.year : ref.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const yearEnd   = new Date(Date.UTC(year, 11, 31));
        // Reference cap for "to date" in the running year:
        const cap = ref < yearEnd ? ref : yearEnd;

        const policies = (opts.policies || [])
            .map(p => ({ ...p, _a: toUTC(p.in), _b: toUTC(p.out) || ref }))
            .filter(p => p._a && p._b >= p._a)
            .sort((a, b) => a._a - b._a);

        // Mark every day in year as covered/uncovered.
        const covered = new Set();
        for (const p of policies) {
            const a = p._a < yearStart ? yearStart : p._a;
            const b = p._b > cap       ? cap      : p._b;
            if (b < a) continue;
            for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
                covered.add(fmt(d));
            }
        }

        // Compute gaps by walking yearStart → cap.
        let coveredDays = 0;
        let gapDays = 0;
        let longestGap = 0;
        const gaps = [];
        let gapStart = null;
        let curGap = 0;

        for (let d = new Date(yearStart); d <= cap; d = addDays(d, 1)) {
            if (covered.has(fmt(d))) {
                coveredDays++;
                if (gapStart) {
                    const to = addDays(d, -1);
                    gaps.push({ from: fmt(gapStart), to: fmt(to), days: curGap });
                    if (curGap > longestGap) longestGap = curGap;
                    gapStart = null;
                    curGap = 0;
                }
            } else {
                gapDays++;
                if (!gapStart) { gapStart = new Date(d); curGap = 0; }
                curGap++;
            }
        }
        if (gapStart) {
            gaps.push({ from: fmt(gapStart), to: fmt(cap), days: curGap });
            if (curGap > longestGap) longestGap = curGap;
        }

        return {
            year, ref: fmt(ref),
            covered_days: coveredDays,
            gap_days: gapDays,
            longest_gap_days: longestGap,
            gaps
        };
    }

    // ─── Pension ────────────────────────────────────────────────────────
    function pension(opts) {
        opts = opts || {};
        const ref = toUTC(opts.ref) || (function () {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        })();

        // Group by scheme key (e.g. "KR-NPS", "UK-NIC", "PT-SocSeg").
        const byScheme = {};
        for (const f of (opts.filings || [])) {
            const a = toUTC(f.in);
            if (!a) continue;
            const b = toUTC(f.out) || ref;
            if (b < a) continue;
            const key = (f.scheme || `${f.country || '??'}-?`).toString().toUpperCase();
            (byScheme[key] = byScheme[key] || []).push({ a, b, country: f.country || null });
        }

        const per_scheme = Object.entries(byScheme).map(([scheme, ranges]) => {
            // Count whole calendar months in which the user contributed at any
            // point — that's the typical pension counting model.
            const months = new Set();
            let lastFiled = null;
            let country = null;
            for (const r of ranges) {
                country = country || r.country;
                let cur = new Date(Date.UTC(r.a.getUTCFullYear(), r.a.getUTCMonth(), 1));
                while (cur <= r.b) {
                    months.add(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`);
                    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
                }
                if (!lastFiled || r.b > lastFiled) lastFiled = r.b;
            }
            const m = months.size;
            return {
                scheme, country,
                months_contributed: m,
                last_filed: lastFiled ? fmt(lastFiled) : null,
                to_120_months: Math.max(0, 120 - m),
                to_240_months: Math.max(0, 240 - m)
            };
        });

        return { ref: fmt(ref), per_scheme };
    }

    // ─── Render ─────────────────────────────────────────────────────────
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function copyInsurance(lang) {
        return {
            title:    L({ en: 'Insurance, in days.', ko: '보험, 일수로.', ja: '保険、日数で。', pt: 'Seguro, em dias.', es: 'Seguro, en días.' }, lang),
            covered:  L({ en: 'COVERED',   ko: '가입',   ja: '加入',   pt: 'COBERTO',  es: 'CUBIERTO' }, lang),
            gap:      L({ en: 'UNINSURED', ko: '공백',   ja: '未加入', pt: 'SEM COB.', es: 'SIN COB.' }, lang),
            longest:  L({ en: 'LONGEST GAP', ko: '최장 공백', ja: '最長空白', pt: 'MAIOR LACUNA', es: 'MAYOR HUECO' }, lang),
            gapsHead: L({ en: 'GAPS THIS YEAR', ko: '올해 공백 구간', ja: '今年の空白', pt: 'LACUNAS NO ANO', es: 'HUECOS DEL AÑO' }, lang),
            note:     L({
                en: 'A calendar, not advice. Some countries require continuous coverage as a condition of residency. We are not your broker.',
                ko: '계산기가 아니라 달력. 일부 국가는 거주 조건으로 연속 가입을 요구한다. 보험설계사가 아니다.',
                ja: '計算機ではなく暦。継続加入を居住条件とする国もある。保険代理人ではない。',
                pt: 'Um calendário, não um conselho. Alguns países exigem cobertura contínua para residência. Não somos o seu corretor.',
                es: 'Un calendario, no un consejo. Algunos países exigen cobertura continua. No somos su corredor.'
            }, lang),
            none:     L({ en: 'No policies recorded yet.', ko: '아직 입력된 보험이 없다.', ja: 'まだ保険記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang)
        };
    }

    function copyPension(lang) {
        return {
            title:    L({ en: 'Pension, in months.', ko: '연금, 개월수로.', ja: '年金、月数で。', pt: 'Pensão, em meses.', es: 'Pensión, en meses.' }, lang),
            scheme:   L({ en: 'SCHEME',    ko: '제도',     ja: '制度',     pt: 'SISTEMA',  es: 'SISTEMA' }, lang),
            months:   L({ en: 'MONTHS PAID', ko: '납입 개월', ja: '納付月数', pt: 'MESES PAGOS', es: 'MESES PAGADOS' }, lang),
            to120:    L({ en: 'TO 120',    ko: '120까지',  ja: '120まで',  pt: 'ATÉ 120',  es: 'A 120' }, lang),
            last:     L({ en: 'LAST FILED', ko: '최근 신고', ja: '直近申告', pt: 'ÚLTIMO REG.', es: 'ÚLTIMO REG.' }, lang),
            note:     L({
                en: 'Pension entitlement vests on different thresholds in every system. KR NPS minimum is 120 months. We are not your accountant.',
                ko: '제도마다 수급 기준이 다르다. 한국 국민연금 최저 120개월. 회계사가 아니다.',
                ja: '受給要件は制度ごとに異なる。韓国NPSの最低は120か月。会計士ではない。',
                pt: 'Os direitos vencem em limiares diferentes em cada sistema. KR NPS = 120 meses. Não somos o seu contabilista.',
                es: 'Los derechos consolidan a umbrales distintos en cada sistema. KR NPS = 120 meses. No somos su contador.'
            }, lang),
            none:     L({ en: 'No pension filings yet.', ko: '아직 입력된 연금 신고가 없다.', ja: 'まだ年金記録がない。', pt: 'Ainda sem registos.', es: 'Aún sin registros.' }, lang)
        };
    }

    function renderInsurance(root, opts) {
        if (!root) return;
        const policies = (opts && opts.policies) || [];
        const c = copyInsurance(opts && opts.lang);
        if (!policies.length) {
            root.innerHTML = `<p class="sdd-cov-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = insurance({ policies, ref: opts && opts.ref, year: opts && opts.year });
        const danger = r.gap_days > 0;
        const gapsHtml = r.gaps.length ? `
            <div class="sdd-cov-gaps">
                <p class="sdd-cov-sub">${escapeHtml(c.gapsHead)}</p>
                <ul>
                    ${r.gaps.map(g => `
                        <li>
                            <time>${escapeHtml(g.from)} → ${escapeHtml(g.to)}</time>
                            <span class="d">${g.days} d</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        root.innerHTML = `
            <section class="sdd-cov-panel ${danger ? 'is-danger' : ''}">
                <h3 class="sdd-cov-h">${escapeHtml(c.title)}</h3>
                <div class="sdd-cov-grid">
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.covered)}</p>
                        <p class="sdd-cov-num">${r.covered_days}</p>
                    </div>
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.gap)}</p>
                        <p class="sdd-cov-num is-danger">${r.gap_days}</p>
                    </div>
                    <div class="sdd-cov-cell">
                        <p class="sdd-cov-label">${escapeHtml(c.longest)}</p>
                        <p class="sdd-cov-num">${r.longest_gap_days}</p>
                    </div>
                </div>
                ${gapsHtml}
                <p class="sdd-cov-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function renderPension(root, opts) {
        if (!root) return;
        const filings = (opts && opts.filings) || [];
        const c = copyPension(opts && opts.lang);
        if (!filings.length) {
            root.innerHTML = `<p class="sdd-cov-empty">${escapeHtml(c.none)}</p>`;
            return;
        }
        const r = pension({ filings, ref: opts && opts.ref });
        const rows = r.per_scheme.map(p => {
            const cls = p.months_contributed >= NPS_MIN ? 'is-vested' : (p.months_contributed >= NPS_MIN * 0.75 ? 'is-near' : '');
            return `
                <tr class="sdd-pen-row ${escapeHtml(cls)}">
                    <td class="sdd-pen-s">${escapeHtml(p.scheme)}</td>
                    <td class="sdd-pen-m">${p.months_contributed}<span class="of"> / 120</span></td>
                    <td class="sdd-pen-t">${p.to_120_months > 0 ? p.to_120_months : '✓'}</td>
                    <td class="sdd-pen-l">${escapeHtml(p.last_filed || '—')}</td>
                </tr>
            `;
        }).join('');

        root.innerHTML = `
            <section class="sdd-cov-panel">
                <h3 class="sdd-cov-h">${escapeHtml(c.title)}</h3>
                <table class="sdd-pen-table">
                    <thead>
                        <tr>
                            <th>${escapeHtml(c.scheme)}</th>
                            <th>${escapeHtml(c.months)}</th>
                            <th>${escapeHtml(c.to120)}</th>
                            <th>${escapeHtml(c.last)}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p class="sdd-cov-note">${escapeHtml(c.note)}</p>
            </section>
        `;
    }

    function injectStyles() {
        if (document.getElementById('sddCovStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCovStyles';
        s.textContent = `
.sdd-cov-panel {
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 32px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-cov-panel.is-danger {
    background: linear-gradient(transparent 60%, rgba(178,53,40,.06));
}
.sdd-cov-h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 16px;
}
.sdd-cov-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: clamp(16px, 4vw, 48px); align-items: end;
}
.sdd-cov-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-cov-num {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(40px, 7vw, 84px); line-height: 1;
    color: var(--ink); margin: 0;
    font-variant-numeric: tabular-nums;
}
.sdd-cov-num.is-danger { color: var(--rust); }
.sdd-cov-sub {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 18px 0 8px;
    padding-top: 12px; border-top: 0.5px solid var(--rule);
}
.sdd-cov-gaps ul { list-style: none; margin: 0; padding: 0; }
.sdd-cov-gaps li {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 6px 0; border-bottom: 0.5px dotted var(--rule);
    font-family: var(--mono); font-size: 12px;
    letter-spacing: 0.06em;
}
.sdd-cov-gaps time { color: var(--ink); }
.sdd-cov-gaps .d { color: var(--rust); font-weight: 500; }
.sdd-cov-note {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; line-height: 1.55;
    color: var(--bone-d); margin: 16px 0 0;
}
.sdd-cov-empty {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 16px 0;
}

/* Pension table */
.sdd-pen-table {
    width: 100%; border-collapse: collapse;
    font-family: var(--mono); font-size: 12px;
}
.sdd-pen-table th {
    font-family: var(--mono); font-weight: 500; font-size: 9px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); text-align: left;
    padding: 8px 12px 8px 0; border-bottom: 0.5px solid var(--rule);
}
.sdd-pen-table td {
    padding: 12px 12px 12px 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); vertical-align: baseline;
}
.sdd-pen-s { font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
.sdd-pen-m {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 22px; line-height: 1; color: var(--ink);
    font-variant-numeric: tabular-nums;
}
.sdd-pen-m .of { font-size: 0.45em; color: var(--bone-d); font-style: normal; letter-spacing: 0.06em; margin-left: 4px; }
.sdd-pen-row.is-vested .sdd-pen-m { color: var(--jade); }
.sdd-pen-row.is-near .sdd-pen-m { color: var(--signal); }
.sdd-pen-t { color: var(--rust); font-weight: 500; }
.sdd-pen-row.is-vested .sdd-pen-t { color: var(--jade); }
.sdd-pen-l { color: var(--bone-d); font-size: 11px; }

@media (max-width: 540px) {
    .sdd-cov-grid { grid-template-columns: 1fr; gap: 18px; }
    .sdd-pen-table { font-size: 11px; }
    .sdd-pen-l { display: none; }
    .sdd-pen-table th:nth-child(4), .sdd-pen-table td:nth-child(4) { display: none; }
}
        `;
        document.head.appendChild(s);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_COVERAGE = { insurance, pension, renderInsurance, renderPension };
})();

/* ── saudade-coverage-form.js ──────────────────────────────────────────────────── */
// saudade · health-insurance and pension input form
//
// Two stacked editors. Insurance rows feed saudade-coverage.renderInsurance,
// pension rows feed saudade-coverage.renderPension. Stored separately in
// localStorage:
//   saudade.insurance.policies = [{ provider, country, in, out }]
//   saudade.pension.filings    = [{ scheme, country, in, out }]
//
// API:
//   window.SAUDADE_COVERAGE_FORM.mount(container, { lang? })
//   window.SAUDADE_COVERAGE_FORM.getInsurance()
//   window.SAUDADE_COVERAGE_FORM.getPension()
'use strict';

(function() {
    if (window.SAUDADE_COVERAGE_FORM) return;
    const KEY_INS = 'saudade.insurance.policies';
    const KEY_PEN = 'saudade.pension.filings';

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function get(key) {
        try { const r = localStorage.getItem(key); if (!r) return []; const a = JSON.parse(r); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function set(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} }

    const COUNTRIES = ['','AE','AT','AU','BE','BR','CA','CH','CN','DE','DK','ES','FI','FR','GB','GR','HK','HR','HU','ID','IE','IL','IN','IS','IT','JP','KR','MX','MY','NL','NO','NZ','PH','PL','PT','RO','SE','SG','TH','TW','US','VN','ZA','GLOBAL'];

    const KNOWN_INSURERS = ['SafetyWing','Genki','IMG','Cigna Global','Allianz','AXA','GeoBlue','William Russell','InsuredNomads','Bupa','National (KR NHI)','National (PT SNS)','National (FR Sécu)','National (UK NHS)','Other'];
    const KNOWN_SCHEMES  = ['KR-NPS','UK-NIC','PT-SocSeg','US-SS','DE-DRV','JP-NenKin','CA-CPP','AU-Super','FR-Carsat','ES-SegSocial','Other'];

    function copy(lang) {
        return {
            insTitle: L({ en: 'Health insurance windows.', ko: '건강보험 가입 구간.', ja: '健康保険の加入期間。', pt: 'Janelas de seguro de saúde.', es: 'Ventanas de seguro de salud.' }, lang),
            insHelp:  L({ en: 'Add each policy. Gaps between policies are flagged in the panel above.', ko: '보험 가입 구간을 입력하라. 구간 사이의 공백은 위 패널에서 표시된다.', ja: '加入期間を入力。期間の空白は上のパネルで表示される。', pt: 'Adicione cada apólice. Lacunas entre apólices aparecem no painel acima.', es: 'Añada cada póliza. Las lagunas se muestran arriba.' }, lang),
            penTitle: L({ en: 'Pension contribution windows.', ko: '연금 납입 구간.', ja: '年金納付期間。', pt: 'Janelas de contribuição de pensão.', es: 'Ventanas de contribución de pensión.' }, lang),
            penHelp:  L({ en: 'Add each scheme and the months you contributed. The counter sums whole calendar months.', ko: '제도와 납입 구간을 입력하라. 카운터는 달력 월 단위로 합산한다.', ja: '制度と納付期間を入力。カウンターは暦月で合算する。', pt: 'Adicione cada sistema e os meses que contribuiu. Soma por mês civil.', es: 'Añada cada sistema y los meses cotizados. Suma por mes civil.' }, lang),
            colProv:  L({ en: 'PROVIDER', ko: '보험사', ja: '保険会社', pt: 'SEGURADORA', es: 'ASEGURADORA' }, lang),
            colSch:   L({ en: 'SCHEME', ko: '제도', ja: '制度', pt: 'SISTEMA', es: 'SISTEMA' }, lang),
            colCty:   L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            colIn:    L({ en: 'FROM', ko: '시작', ja: '開始', pt: 'DESDE', es: 'DESDE' }, lang),
            colOut:   L({ en: 'TO (or empty if active)', ko: '종료 (현재 유지 중이면 비워두기)', ja: '終了 (継続中なら空欄)', pt: 'ATÉ (vazio = activo)', es: 'HASTA (vacío = activo)' }, lang),
            addIns:   L({ en: 'ADD POLICY', ko: '보험 추가', ja: '保険を追加', pt: 'ADICIONAR APÓLICE', es: 'AÑADIR PÓLIZA' }, lang),
            addPen:   L({ en: 'ADD PENSION FILING', ko: '연금 신고 추가', ja: '年金記録を追加', pt: 'ADICIONAR PENSÃO', es: 'AÑADIR PENSIÓN' }, lang),
            remove:   L({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }, lang),
            none:     L({ en: 'No entries yet.', ko: '아직 기록 없음.', ja: 'まだ記録なし。', pt: 'Sem registos.', es: 'Sin registros.' }, lang)
        };
    }

    function injectStyles() {
        if (document.getElementById('sddCovFormStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCovFormStyles';
        s.textContent = `
.sdd-covf {
    border-top: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 28px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-covf__h { font-family: var(--mono); font-weight: 500; font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); margin: 0 0 8px; }
.sdd-covf__help { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 13px; color: var(--bone-d); margin: 0 0 16px; }
.sdd-covf__cols, .sdd-covf__row {
    display: grid; grid-template-columns: 1.1fr 0.5fr 1fr 1fr auto;
    gap: 8px; align-items: center;
}
.sdd-covf__cols { font-family: var(--mono); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d); padding: 6px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-covf__row { padding: 8px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-covf__row input, .sdd-covf__row select {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em;
    padding: 6px 0; min-height: 36px; width: 100%; box-sizing: border-box; outline: none; border-radius: 0;
}
.sdd-covf__row input:focus, .sdd-covf__row select:focus { border-bottom-color: var(--ink); }
.sdd-covf__rm { background: transparent; border: 0; color: var(--bone-d); cursor: pointer; font-family: var(--serif); font-style: italic; font-size: 18px; line-height: 1; padding: 4px 8px; min-height: 36px; }
.sdd-covf__rm:hover { color: var(--rust); }
.sdd-covf__add {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-covf__add:hover { color: var(--rust); }
.sdd-covf__add::before { content: "+"; color: var(--rust); margin-right: 12px; font-family: var(--serif); font-style: italic; font-size: 18px; }
.sdd-covf__none { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 14px; color: var(--bone-d); padding: 14px 0; border-bottom: 0.5px solid var(--rule); }
@media (max-width: 720px) {
    .sdd-covf__cols, .sdd-covf__row { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto auto; }
    .sdd-covf__cols span:nth-child(3), .sdd-covf__cols span:nth-child(4), .sdd-covf__cols span:nth-child(5) { display: none; }
    .sdd-covf__row > * { grid-row: auto; }
}
        `;
        document.head.appendChild(s);
    }

    function rowIns(s, i, c) {
        return `
            <div class="sdd-covf__row" data-idx="${i}">
                <select data-field="provider">
                    <option value="">—</option>
                    ${KNOWN_INSURERS.map(p => `<option value="${escapeHtml(p)}" ${s.provider === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                </select>
                <select data-field="country">
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co || '—'}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}" />
                <button type="button" class="sdd-covf__rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }
    function rowPen(s, i, c) {
        return `
            <div class="sdd-covf__row" data-idx="${i}">
                <select data-field="scheme">
                    <option value="">—</option>
                    ${KNOWN_SCHEMES.map(p => `<option value="${escapeHtml(p)}" ${s.scheme === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                </select>
                <select data-field="country">
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co || '—'}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}" />
                <button type="button" class="sdd-covf__rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }

    function paint(host, lang) {
        const c = copy(lang);
        const ins = get(KEY_INS);
        const pen = get(KEY_PEN);
        host.innerHTML = `
            <section class="sdd-covf" data-section="ins">
                <p class="sdd-covf__h">${escapeHtml(c.insTitle)}</p>
                <p class="sdd-covf__help">${escapeHtml(c.insHelp)}</p>
                <div class="sdd-covf__cols">
                    <span>${escapeHtml(c.colProv)}</span>
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows-ins>
                    ${ins.length ? ins.map((s, i) => rowIns(s, i, c)).join('') : `<p class="sdd-covf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-covf__add" data-add-ins>${escapeHtml(c.addIns)}</button>
            </section>
            <section class="sdd-covf" data-section="pen">
                <p class="sdd-covf__h">${escapeHtml(c.penTitle)}</p>
                <p class="sdd-covf__help">${escapeHtml(c.penHelp)}</p>
                <div class="sdd-covf__cols">
                    <span>${escapeHtml(c.colSch)}</span>
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows-pen>
                    ${pen.length ? pen.map((s, i) => rowPen(s, i, c)).join('') : `<p class="sdd-covf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-covf__add" data-add-pen>${escapeHtml(c.addPen)}</button>
            </section>
        `;
        wire(host, KEY_INS, '[data-section="ins"]', '[data-add-ins]', lang);
        wire(host, KEY_PEN, '[data-section="pen"]', '[data-add-pen]', lang);
    }

    function wire(host, key, sectionSel, addSel, lang) {
        host.querySelector(addSel).addEventListener('click', () => {
            const cur = get(key);
            const blank = key === KEY_INS ? { provider:'', country:'', in:'', out:'' }
                                          : { scheme:'',   country:'', in:'', out:'' };
            set(key, cur.concat([blank]));
            paint(host, lang); renderCalc();
        });
        host.querySelectorAll(`${sectionSel} .sdd-covf__row`).forEach(rowEl => {
            const idx = +rowEl.dataset.idx;
            rowEl.querySelectorAll('[data-field]').forEach(input => {
                const ev = (input.tagName === 'SELECT') ? 'change' : 'input';
                input.addEventListener(ev, e => {
                    const cur = get(key); cur[idx][input.dataset.field] = e.target.value; set(key, cur); renderCalc();
                });
            });
            rowEl.querySelector('[data-rm]').addEventListener('click', () => {
                const cur = get(key); cur.splice(idx, 1); set(key, cur);
                paint(host, lang); renderCalc();
            });
        });
    }

    function renderCalc() {
        if (!window.SAUDADE_COVERAGE) return;
        const insPanel = document.getElementById('sddInsPanel');
        const penPanel = document.getElementById('sddPenPanel');
        if (insPanel) {
            const policies = get(KEY_INS).filter(p => p.in);
            window.SAUDADE_COVERAGE.renderInsurance(insPanel, { policies });
        }
        if (penPanel) {
            const filings = get(KEY_PEN).filter(p => p.in && p.scheme);
            window.SAUDADE_COVERAGE.renderPension(penPanel, { filings });
        }
    }

    function mount(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        paint(host, opts && opts.lang);
        renderCalc();
    }

    window.SAUDADE_COVERAGE_FORM = { mount, getInsurance: () => get(KEY_INS), getPension: () => get(KEY_PEN) };
})();

/* ── saudade-stays-form.js ──────────────────────────────────────────────────── */
// saudade · unified stays form
//
// One source of truth for "where I was, when". A single row drives both
// Schengen 90/180 and Tax 183 — Schengen is the same data filtered to
// the 27 Schengen-area countries.
//
// Replaces saudade-schengen-form.js + saudade-tax-form.js for the user-
// facing input. The two older forms still load (bundle-compatible) but
// the Ledger no longer mounts them — it mounts this one instead.
//
// Storage:
//   saudade.stays = [{ country, in, out }]   ← master
//   saudade.schengen.stays / saudade.tax.stays are mirrored on every save
//   so the calculators (which still read those keys) keep working without
//   changes.
//
// Migration: on first load, if saudade.stays is empty but tax/schengen
// keys have data, merge with country|in|out dedupe.
//
// API:
//   window.SAUDADE_STAYS_FORM.mount(container, { lang? })
//   window.SAUDADE_STAYS_FORM.getStays()
'use strict';

(function() {
    if (window.SAUDADE_STAYS_FORM) return;

    const KEY      = 'saudade.stays';
    const KEY_SCH  = 'saudade.schengen.stays';
    const KEY_TAX  = 'saudade.tax.stays';

    // Schengen Area as of 2026 — Bulgaria, Romania, Croatia in; Cyprus pending.
    const SCHENGEN_27 = new Set([
        'AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT',
        'LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH'
    ]);

    // Country list for the select — alpha sorted, Schengen + common nomad.
    const COUNTRIES = [
        'AE','AR','AT','AU','BE','BG','BR','CA','CH','CL','CN','CO','CY','CZ',
        'DE','DK','EE','ES','FI','FR','GB','GE','GR','HR','HU','ID','IE','IL',
        'IN','IS','IT','JP','KH','KR','LT','LU','LV','MA','MT','MX','MY','NL',
        'NO','NZ','PA','PE','PH','PL','PT','RO','RS','SE','SG','SI','SK','TH',
        'TR','UA','US','UY','VN','ZA'
    ];

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function safeRead(k) {
        try { const r = localStorage.getItem(k); if (!r) return []; const a = JSON.parse(r); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function safeWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    // ─── One-shot migration ─────────────────────────────────────────────
    function migrateOnce() {
        const stays = safeRead(KEY);
        if (stays.length) return;            // already in the new model
        const tax = safeRead(KEY_TAX);
        const sch = safeRead(KEY_SCH);
        if (!tax.length && !sch.length) return;
        const seen = new Set();
        const merged = [];
        for (const r of [...tax, ...sch]) {
            if (!r || !r.in) continue;
            const country = (r.country || '').toUpperCase().slice(0, 3);
            if (!country) continue;
            const key = `${country}|${r.in}|${r.out || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({ country, in: r.in, out: r.out || '' });
        }
        if (merged.length) safeWrite(KEY, merged);
    }

    function getStays() { return safeRead(KEY); }
    function setStays(arr) {
        safeWrite(KEY, arr);
        // Mirror into the calculator-specific keys so saudade-tax + saudade-schengen
        // (which read those keys) keep working without modification.
        safeWrite(KEY_TAX, arr.slice());
        safeWrite(KEY_SCH, arr.filter(s => SCHENGEN_27.has((s.country || '').toUpperCase())));
    }

    function copy(lang) {
        return {
            title: L({
                en: 'Where you were, when.',
                ko: '어디에, 언제 있었나.',
                ja: 'いつ、どこにいたか。',
                pt: 'Onde esteve, quando.',
                es: 'Dónde estuvo, cuándo.'
            }, lang),
            help:  L({
                en: 'One row per stay. We compute Schengen 90/180 and tax 183 from the same data — no need to enter twice.',
                ko: '한 줄에 한 체류. 같은 데이터로 솅겐 90/180 과 세금 183 을 함께 계산한다 — 두 번 입력하지 않아도 된다.',
                ja: '一行に一滞在。同じデータからシェンゲン 90/180 と税 183 を一緒に計算する — 二度入力しなくていい。',
                pt: 'Uma linha por estadia. Calculamos Schengen 90/180 e fiscal 183 a partir dos mesmos dados — sem precisar repetir.',
                es: 'Una fila por estancia. Calculamos Schengen 90/180 y fiscal 183 a partir de los mismos datos — sin repetir.'
            }, lang),
            colCty:  L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            colIn:   L({ en: 'IN',  ko: '입국',  ja: '入国',  pt: 'ENTRADA', es: 'ENTRADA' }, lang),
            colOut:  L({ en: 'OUT', ko: '출국',  ja: '出国',  pt: 'SAÍDA',   es: 'SALIDA' }, lang),
            colDrives: L({ en: 'FEEDS', ko: '계산기', ja: '計算機', pt: 'ALIMENTA', es: 'ALIMENTA' }, lang),
            add:     L({ en: 'ADD STAY', ko: '체류 추가', ja: '滞在を追加', pt: 'ADICIONAR', es: 'AÑADIR' }, lang),
            none:    L({ en: 'No stays yet. Add the most recent first.', ko: '아직 체류 기록이 없다. 가장 최근부터 입력하라.', ja: 'まだ滞在記録がない。直近から追加。', pt: 'Sem estadias ainda. Comece pela mais recente.', es: 'Sin estancias aún. Empiece por la más reciente.' }, lang),
            remove:  L({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }, lang),
            empty:   L({ en: 'still there', ko: '체류 중', ja: '滞在中', pt: 'ainda lá', es: 'aún ahí' }, lang),
            sch:     L({ en: 'SCHENGEN', ko: '솅겐', ja: 'シェンゲン', pt: 'SCHENGEN', es: 'SCHENGEN' }, lang),
            tax:     L({ en: 'TAX', ko: '세금', ja: '税', pt: 'FISCAL', es: 'FISCAL' }, lang)
        };
    }

    function injectStyles() {
        if (document.getElementById('sddStaysFormStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddStaysFormStyles';
        s.textContent = `
.sdd-stays {
    border-top: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 28px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-stays__h { font-family: var(--mono); font-weight: 500; font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); margin: 0 0 8px; }
.sdd-stays__help { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 13px; color: var(--bone-d); margin: 0 0 16px; max-width: 56ch; }
.sdd-stays__cols, .sdd-stays__row {
    display: grid;
    grid-template-columns: 0.7fr 1fr 1fr auto;
    gap: 8px; align-items: center;
}
.sdd-stays__cols {
    font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); padding: 6px 0; border-bottom: 0.5px solid var(--rule);
}
.sdd-stays__row { padding: 8px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-stays__row input, .sdd-stays__row select {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); font-family: var(--mono); font-size: 13px;
    letter-spacing: 0.04em; padding: 6px 0; min-height: 36px; width: 100%;
    box-sizing: border-box; outline: none; border-radius: 0;
}
.sdd-stays__row input:focus, .sdd-stays__row select:focus { border-bottom-color: var(--ink); }
.sdd-stays__row.is-invalid input[data-field="out"] {
    border-bottom-color: var(--rust);
    color: var(--rust);
}
.sdd-stays__row.is-invalid::before {
    content: '⚠ check the dates';
    grid-column: 1 / -1;
    font-family: var(--mono); font-weight: 500; font-size: 9px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--rust);
    padding: 4px 0;
}
.sdd-stays__rm { background: transparent; border: 0; color: var(--bone-d); cursor: pointer;
    font-family: var(--serif); font-style: italic; font-size: 18px; line-height: 1; padding: 4px 8px; min-height: 36px; }
.sdd-stays__rm:hover { color: var(--rust); }
.sdd-stays__add {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-stays__add:hover { color: var(--rust); }
.sdd-stays__add::before { content: "+"; color: var(--rust); margin-right: 12px; font-family: var(--serif); font-style: italic; font-size: 18px; }
.sdd-stays__none { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 14px; color: var(--bone-d); padding: 14px 0; border-bottom: 0.5px solid var(--rule); }
@media (max-width: 720px) {
    .sdd-stays__cols, .sdd-stays__row {
        grid-template-columns: 0.7fr 1fr 1fr auto;
    }
}
        `;
        document.head.appendChild(s);
    }

    function isInvalid(s) {
        return s && s.in && s.out && s.out < s.in;   // ISO date strings sort lexically
    }

    function row(s, i, c) {
        const invalid = isInvalid(s);
        return `
            <div class="sdd-stays__row ${invalid ? 'is-invalid' : ''}" data-idx="${i}">
                <select data-field="country">
                    <option value="">—</option>
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}"
                       placeholder="${escapeHtml(c.empty)}" />
                <button type="button" class="sdd-stays__rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }

    function paint(host, lang) {
        const c = copy(lang);
        const stays = getStays();
        // v647 — when there are no stays, hide the column headers (COUNTRY /
        // IN / OUT) entirely. An empty table with hairline-thin column heads
        // and one tiny italic line read as "broken UI". Show only the title
        // + help + a single inviting button.
        host.innerHTML = `
            <section class="sdd-stays">
                <p class="sdd-stays__h">${escapeHtml(c.title)}</p>
                <p class="sdd-stays__help">${escapeHtml(c.help)}</p>
                ${stays.length ? `
                    <div class="sdd-stays__cols">
                        <span>${escapeHtml(c.colCty)}</span>
                        <span>${escapeHtml(c.colIn)}</span>
                        <span>${escapeHtml(c.colOut)}</span>
                        <span></span>
                    </div>
                    <div data-rows>${stays.map((s, i) => row(s, i, c)).join('')}</div>
                ` : `<div data-rows><p class="sdd-stays__none">${escapeHtml(c.none)}</p></div>`}
                <button type="button" class="sdd-stays__add" data-add>${escapeHtml(c.add)}</button>
            </section>
        `;
        host.querySelector('[data-add]').addEventListener('click', () => {
            setStays(getStays().concat([{ country: '', in: '', out: '' }]));
            paint(host, lang); rerunCalcs();
        });
        host.querySelectorAll('.sdd-stays__row').forEach(rowEl => {
            const idx = +rowEl.dataset.idx;
            function syncValid() {
                rowEl.classList.toggle('is-invalid', isInvalid(getStays()[idx]));
            }
            rowEl.querySelector('[data-field="country"]').addEventListener('change', e => {
                const cur = getStays(); cur[idx].country = e.target.value; setStays(cur);
                syncValid(); rerunCalcs();
            });
            rowEl.querySelectorAll('input[data-field]').forEach(input => {
                input.addEventListener('input', e => {
                    const cur = getStays(); cur[idx][input.dataset.field] = e.target.value; setStays(cur);
                    syncValid(); rerunCalcs();
                });
            });
            rowEl.querySelector('[data-rm]').addEventListener('click', () => {
                const cur = getStays(); cur.splice(idx, 1); setStays(cur);
                paint(host, lang); rerunCalcs();
            });
        });
    }

    function rerunCalcs() {
        const stays = getStays().filter(s => s.country && s.in);
        try {
            if (window.SAUDADE_SCHENGEN) {
                const schPanel = document.getElementById('sddSchPanel');
                if (schPanel) {
                    const filtered = stays.filter(s => SCHENGEN_27.has((s.country || '').toUpperCase()));
                    window.SAUDADE_SCHENGEN.render(schPanel, { stays: filtered });
                }
            }
            if (window.SAUDADE_TAX) {
                const taxPanel = document.getElementById('sddTaxPanel');
                if (taxPanel) window.SAUDADE_TAX.render(taxPanel, { stays });
            }
            // Personal block on the cover, if mounted.
            if (window.SAUDADE_PERSONAL) {
                const cov = document.getElementById('sddCoverPersonal');
                if (cov && window.SAUDADE_PERSONAL.render) window.SAUDADE_PERSONAL.render(cov);
            }
        } catch (e) {}
    }

    function mount(target, opts) {
        injectStyles();
        migrateOnce();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        paint(host, opts && opts.lang);
        rerunCalcs();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', migrateOnce);
        } else { migrateOnce(); }
    }

    window.SAUDADE_STAYS_FORM = { mount, getStays, setStays };
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
                        en: 'Dispatches are AI-drafted and AI-reviewed against the magazine’s constitution. Sources are quoted at most twenty-five words.',
                        ko: '디스패치는 AI 가 초안을 작성하고, 발행 전 AI 가 매거진 헌법에 맞는지 다시 검수한다. 인용은 25 단어를 넘지 않는다.',
                        ja: 'ディスパッチは AI が起草し、発行前に AI がもう一度、本誌憲法に照らして検閲する。引用は二十五語を超えない。',
                        pt: 'Os despachos são redigidos por IA e revistos por uma segunda passagem de IA contra a constituição editorial. Citamos no máximo vinte e cinco palavras.',
                        es: 'Los despachos los redacta una IA y los revisa una segunda pasada de IA frente a la constitución editorial. Citamos como máximo veinticinco palabras.'
                    })
                };
            case 'cover':
                return {
                    eyebrow: L({ en: 'TODAY.', ko: '오늘.', ja: '今日。', pt: 'HOJE.', es: 'HOY.' }),
                    headline: L({ en: 'Three cities, filed daily.', ko: '세 도시, 매일 발행.', ja: '三つの都市、毎日発行。', pt: 'Três cidades, publicadas diariamente.', es: 'Tres ciudades, publicadas a diario.' }),
                    lede: L({
                        en: 'Edited from Seoul. <em>A slow newspaper for digital nomads.</em>',
                        ko: '서울에서 편집. <em>디지털 노마드를 위한 느린 신문.</em>',
                        ja: 'ソウル編集。<em>デジタルノマドのための、ゆっくりとした新聞。</em>',
                        pt: 'Editado em Seul. <em>Um jornal lento para nómadas digitais.</em>',
                        es: 'Editado desde Seúl. <em>Un periódico lento para nómadas digitales.</em>'
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
        // v640 — collapsed from 3 cards to 1. The previous deck was the
        // first thing every visitor saw and read like a brochure on top of
        // the cover. A single italic headline + one paragraph + one action
        // is enough to set tone without robbing the cover of its first
        // impression. Etymology and section overview moved to /etymology.html
        // and /sitemap.html, which are linked from the cover footer.
        return [
            {
                eyebrow:  L({ en: 'WELCOME.', ko: '어서 오라.', ja: 'ようこそ。', pt: 'BEM-VINDO.', es: 'BIENVENIDO.' }),
                headline: L({
                    en: 'A slow newspaper. Three cities, filed daily.',
                    ko: '느린 신문. 세 도시, 매일 발행.',
                    ja: 'ゆっくりとした新聞。三つの都市、毎日発行。',
                    pt: 'Um jornal lento. Três cidades, publicadas diariamente.',
                    es: 'Un periódico lento. Tres ciudades, publicadas a diario.'
                }),
                body: L({
                    en: '<em>saudade</em> is Portuguese for the longing you carry for places you cannot return to. We file three city items, six days a week. Sunday is silence — by design. Read on, or sign in to track the days you have left.',
                    ko: '<em>saudade</em> 는 돌아갈 수 없는 장소에 대한 그리움이라는 뜻의 포르투갈어. 일주일에 엿새, 도시당 세 항목. 일요일은 침묵 — 의도된 것. 그냥 읽어도 좋고, 로그인하면 남은 일수를 헤아려준다.',
                    ja: '<em>saudade</em> は戻れない場所への切なさを意味するポルトガル語。週六日、都市ごとに三本。日曜は沈黙 — 意図されたもの。そのまま読むも良し、サインインすれば残り日数を数える。',
                    pt: '<em>saudade</em> em português é a ausência de algo a que não se pode regressar. Três itens por cidade, seis dias por semana. Domingo é silêncio — propositado. Continue a ler, ou entre para contar os dias.',
                    es: '<em>saudade</em> en portugués significa la añoranza por los lugares a los que no se puede volver. Tres elementos por ciudad, seis días por semana. El domingo es silencio — intencionado. Siga leyendo, o entre para contar los días.'
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
    position: fixed; inset: 0; z-index: var(--z-modal-welcome);
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

/* ── saudade-demo.js ──────────────────────────────────────────────────── */
// saudade · demo data
//
// Loads a realistic example traveller's stays into the four calculators so
// a fresh visitor can see what saudade does in 0.3s instead of staring at
// empty forms. Triggered from the empty-state of any calculator section
// or from #demo URL hash.
//
// Persona: "Inês, Lisbon-based remote engineer who spent Q1 in Schengen,
// travelled to Seoul in May, took a 3-month break in Bali (uninsured for
// 2 weeks between policies), pays into KR-NPS and PT Segurança Social."
//
// API:
//   window.SAUDADE_DEMO.load()    populate localStorage with the persona
//   window.SAUDADE_DEMO.clear()   wipe demo data (keeps real user data
//                                  if any was already there — refuses to
//                                  clear when keys look user-edited)
//   window.SAUDADE_DEMO.isLoaded()
'use strict';

(function() {
    if (window.SAUDADE_DEMO) return;
    const FLAG = 'saudade.demo.loaded';

    // ─── The persona ─────────────────────────────────────────────────────
    const SCHENGEN_STAYS = [
        { in: '2026-01-08', out: '2026-02-21', country: 'PT' },   // 45 days Lisbon
        { in: '2026-03-12', out: '2026-04-02', country: 'ES' },   // 22 days Madrid
        { in: '2026-04-18', out: '2026-04-30', country: 'IT' }    // 13 days Rome
    ];
    const TAX_STAYS = [
        { country: 'PT', in: '2026-01-08', out: '2026-02-21' },
        { country: 'ES', in: '2026-03-12', out: '2026-04-02' },
        { country: 'IT', in: '2026-04-18', out: '2026-04-30' },
        { country: 'KR', in: '2026-05-08', out: '2026-05-22' },
        { country: 'ID', in: '2026-06-01', out: '2026-08-30' },
        { country: 'PT', in: '2026-09-15', out: '2026-12-15' }
    ];
    const INS_POLICIES = [
        { provider: 'SafetyWing', country: 'GLOBAL', in: '2026-01-08', out: '2026-05-31' },
        // Two-week gap in Bali — the calculator should flag it.
        { provider: 'Genki',      country: 'GLOBAL', in: '2026-06-15', out: '2026-08-30' },
        { provider: 'National (PT SNS)', country: 'PT', in: '2026-09-15', out: '2026-12-31' }
    ];
    const PEN_FILINGS = [
        { scheme: 'KR-NPS',     country: 'KR', in: '2014-03-01', out: '2018-12-31' },
        { scheme: 'PT-SocSeg',  country: 'PT', in: '2024-01-01', out: '2026-12-31' }
    ];

    // The persona carries Lisbon (where she is editing the paper from), Seoul
    // (where she lived through her 20s — KR-NPS roots) and Bali (where she
    // spent the most days last summer). These drive the personal block on
    // the cover: "184 days since you last sat in a Seoul café."
    const HOMES = ['LIS', 'SEL', 'DPS'];

    function load(opts) {
        opts = opts || {};
        // v644 — refuse to overwrite real user data unless explicitly forced.
        // Detect any pre-existing non-empty entries; if we find one, ask
        // the user via a native confirm() before stomping it.
        if (!opts.force) {
            const keys = ['saudade.stays', 'saudade.schengen.stays',
                          'saudade.tax.stays', 'saudade.insurance.policies',
                          'saudade.pension.filings', 'saudade.homes'];
            const hasReal = keys.some(k => {
                try { const v = localStorage.getItem(k); if (!v) return false; const a = JSON.parse(v); return Array.isArray(a) ? a.length > 0 : true; } catch (e) { return false; }
            });
            const flagged = (function () { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } })();
            if (hasReal && !flagged) {
                const ok = (typeof confirm === 'function') && confirm(
                    'You have your own data in saudade.\n\n' +
                    'Loading the demo replaces it with a sample year. Your real data will be lost.\n\n' +
                    'Continue?'
                );
                if (!ok) return false;
            }
        }
        try {
            localStorage.setItem('saudade.stays',              JSON.stringify(TAX_STAYS));
            localStorage.setItem('saudade.schengen.stays',     JSON.stringify(SCHENGEN_STAYS));
            localStorage.setItem('saudade.tax.stays',          JSON.stringify(TAX_STAYS));
            localStorage.setItem('saudade.insurance.policies', JSON.stringify(INS_POLICIES));
            localStorage.setItem('saudade.pension.filings',    JSON.stringify(PEN_FILINGS));
            localStorage.setItem('saudade.homes',              JSON.stringify(HOMES));
            localStorage.setItem(FLAG, '1');
        } catch (e) { return false; }
        // Re-render the calculator forms if mounted.
        if (window.SAUDADE_STAYS_FORM)     refreshForm(window.SAUDADE_STAYS_FORM);
        if (window.SAUDADE_SCHENGEN_FORM)  refreshForm(window.SAUDADE_SCHENGEN_FORM);
        if (window.SAUDADE_TAX_FORM)       refreshForm(window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_COVERAGE_FORM)  refreshForm(window.SAUDADE_COVERAGE_FORM);
        // Repaint the cover personal block so the saudade meter populates.
        if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
            const target = document.getElementById('sddCoverPersonal');
            if (target) window.SAUDADE_PERSONAL.render(target);
        }
        return true;
    }

    function refreshForm(mod) {
        // Re-paint the form by remounting it onto its current host.
        const sel = (mod === window.SAUDADE_STAYS_FORM)     ? '#sddStaysForm'
                  : (mod === window.SAUDADE_SCHENGEN_FORM)  ? '#sddSchForm'
                  : (mod === window.SAUDADE_TAX_FORM)       ? '#sddTaxForm'
                  : (mod === window.SAUDADE_COVERAGE_FORM)  ? '#sddCoverageForm'
                  : null;
        if (!sel) return;
        const host = document.querySelector(sel);
        if (host && mod.mount) mod.mount(host);
    }

    function clear() {
        if (!isLoaded()) return false;
        try {
            ['saudade.schengen.stays', 'saudade.tax.stays',
             'saudade.insurance.policies', 'saudade.pension.filings',
             'saudade.homes'].forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(FLAG);
        } catch (e) { return false; }
        if (window.SAUDADE_SCHENGEN_FORM)  refreshForm(window.SAUDADE_SCHENGEN_FORM);
        if (window.SAUDADE_TAX_FORM)       refreshForm(window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_COVERAGE_FORM)  refreshForm(window.SAUDADE_COVERAGE_FORM);
        if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
            const target = document.getElementById('sddCoverPersonal');
            if (target) window.SAUDADE_PERSONAL.render(target);
        }
        return true;
    }

    function isLoaded() {
        try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
    }

    // ─── Hash trigger ────────────────────────────────────────────────────
    function handleHash() {
        if (location.hash === '#demo') {
            load();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
            // Jump to Ledger so the user sees the populated panels immediately.
            try { document.body.setAttribute('data-section', '01'); } catch (e) {}
        } else if (location.hash === '#demo-clear') {
            clear();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_DEMO = { load, clear, isLoaded };
})();

/* ── saudade-import.js ──────────────────────────────────────────────────── */
// saudade · stamp import / export
//
// Lets a power user import a year of travel from a CSV or JSON file, and
// export the same as backup. Recognised formats:
//
//   CSV with header row:     country,in,out
//                            PT,2026-01-08,2026-02-21
//
//   CSV without header:      first column ISO-2, then YYYY-MM-DD, YYYY-MM-DD
//
//   JSON:                    [{ country, in, out }, ...]
//                            { schengen: [...], tax: [...], insurance: [...], pension: [...] }
//
// On import the rows feed into:
//   • saudade.tax.stays      (always; tax is the superset)
//   • saudade.schengen.stays (rows whose country is in the Schengen 27)
//
// API:
//   window.SAUDADE_IMPORT.parseCSV(text)       → [{country,in,out}]
//   window.SAUDADE_IMPORT.parseJSON(text)      → object or array
//   window.SAUDADE_IMPORT.applyStays(rows)     → { added: n, schengen: n }
//   window.SAUDADE_IMPORT.exportAll()          → string (JSON dump of all 4 calc inputs)
//   window.SAUDADE_IMPORT.openModal()          → file picker UI
'use strict';

(function() {
    if (window.SAUDADE_IMPORT) return;

    const SCHENGEN_ISO = new Set([
        'AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH'
    ]);

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // ─── Parsers ─────────────────────────────────────────────────────────
    function parseCSV(text) {
        if (!text) return [];
        // Strip BOM + normalise line endings.
        text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (!lines.length) return [];
        // Detect header.
        const first = lines[0].toLowerCase();
        const hasHeader = /country|iso|cca/.test(first) && /in|from|entry/.test(first);
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const rows = [];
        for (const line of dataLines) {
            const cols = line.split(/[,;\t]/).map(s => s.trim().replace(/^"(.*)"$/, '$1'));
            if (cols.length < 2) continue;
            const country = (cols[0] || '').toUpperCase().slice(0, 3);
            const ind = cols[1];
            const out = cols[2] || '';
            if (!country || !/^\d{4}-\d{2}-\d{2}$/.test(ind)) continue;
            rows.push({ country, in: ind, out: /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : '' });
        }
        return rows;
    }

    function parseJSON(text) {
        if (!text) return [];
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { return []; }
        if (Array.isArray(parsed)) {
            return parsed.filter(r => r && r.country && r.in)
                         .map(r => ({ country: String(r.country).toUpperCase().slice(0, 3),
                                      in: r.in, out: r.out || '' }));
        }
        if (parsed && typeof parsed === 'object') {
            // bundle form { tax: [...], schengen: [...] } — return tax as the superset.
            const list = parsed.tax || parsed.schengen || [];
            if (!Array.isArray(list)) return [];
            return list.filter(r => r && r.country && r.in)
                       .map(r => ({ country: String(r.country).toUpperCase().slice(0, 3),
                                    in: r.in, out: r.out || '' }));
        }
        return [];
    }

    function applyStays(rows) {
        if (!Array.isArray(rows) || !rows.length) return { added: 0, schengen: 0 };
        // Merge with existing tax stays (don't overwrite — append + dedupe by country+in+out).
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem('saudade.tax.stays') || '[]'); } catch (e) {}
        const seen = new Set(existing.map(r => `${r.country}|${r.in}|${r.out || ''}`));
        let added = 0;
        for (const r of rows) {
            const key = `${r.country}|${r.in}|${r.out || ''}`;
            if (seen.has(key)) continue;
            existing.push(r);
            seen.add(key);
            added++;
        }
        try { localStorage.setItem('saudade.tax.stays', JSON.stringify(existing)); } catch (e) {}

        // Schengen subset.
        const schengenSubset = rows.filter(r => SCHENGEN_ISO.has(r.country));
        let schExisting = [];
        try { schExisting = JSON.parse(localStorage.getItem('saudade.schengen.stays') || '[]'); } catch (e) {}
        const schSeen = new Set(schExisting.map(r => `${r.country}|${r.in}|${r.out || ''}`));
        let addedSch = 0;
        for (const r of schengenSubset) {
            const key = `${r.country}|${r.in}|${r.out || ''}`;
            if (schSeen.has(key)) continue;
            schExisting.push(r);
            schSeen.add(key);
            addedSch++;
        }
        try { localStorage.setItem('saudade.schengen.stays', JSON.stringify(schExisting)); } catch (e) {}

        // Trigger live re-render of any mounted form.
        if (window.SAUDADE_TAX_FORM)      remount('#sddTaxForm', window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_SCHENGEN_FORM) remount('#sddSchForm', window.SAUDADE_SCHENGEN_FORM);

        return { added, schengen: addedSch };
    }
    function remount(sel, mod) {
        const host = document.querySelector(sel);
        if (host && mod && mod.mount) mod.mount(host);
    }

    function exportAll() {
        const out = {
            format: 'saudade.calc-stays.v1',
            generated_at: new Date().toISOString(),
            tax:       safeRead('saudade.tax.stays'),
            schengen:  safeRead('saudade.schengen.stays'),
            insurance: safeRead('saudade.insurance.policies'),
            pension:   safeRead('saudade.pension.filings')
        };
        return JSON.stringify(out, null, 2);
    }
    function safeRead(k) {
        try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; }
    }

    // ─── Modal UI ────────────────────────────────────────────────────────
    let _modal = null;
    function injectStyles() {
        if (document.getElementById('sddImportStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddImportStyles';
        s.textContent = `
.sdd-imp-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-imp-modal.active { display: flex; }
.sdd-imp-inner { width: 100%; max-width: 560px; }
.sdd-imp-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    margin: 0 0 24px;
}
.sdd-imp-section {
    border-top: 0.5px solid var(--rule);
    padding: 18px 0;
}
.sdd-imp-section h3 {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 10px;
}
.sdd-imp-section p {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; color: var(--bone-d); margin: 0 0 12px;
}
.sdd-imp-textarea {
    width: 100%; min-height: 140px; box-sizing: border-box;
    background: var(--paper-d); color: var(--ink);
    border: 0.5px solid var(--rule);
    font-family: var(--mono); font-size: 12px; line-height: 1.5;
    padding: 10px; outline: none; resize: vertical; border-radius: 0;
}
.sdd-imp-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px;
    transition: color .15s;
    margin-top: 8px;
}
.sdd-imp-btn:hover { color: var(--rust); }
.sdd-imp-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); padding: 12px 0;
    border-top: 0.5px solid var(--rule); margin-top: 12px;
    min-height: 1em;
}
.sdd-imp-status.ok    { color: var(--ink); }
.sdd-imp-status.error { color: var(--rust); }
.sdd-imp-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-imp-close:hover { color: var(--rust); }
        `;
        document.head.appendChild(s);
    }

    function openModal() {
        injectStyles();
        if (!_modal) {
            _modal = document.createElement('div');
            _modal.className = 'sdd-imp-modal';
            _modal.setAttribute('role', 'dialog');
            _modal.setAttribute('aria-modal', 'true');
            document.body.appendChild(_modal);
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
            });
        }
        const c = {
            title:  L({ en: 'Import / export your stays.', ko: '여행 기록 가져오기 / 내보내기.', ja: '滞在記録のインポート/エクスポート。', pt: 'Importar / exportar estadias.', es: 'Importar / exportar estancias.' }),
            close:  L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }),
            impH:   L({ en: 'PASTE CSV OR JSON', ko: 'CSV 또는 JSON 붙여넣기', ja: 'CSV または JSON を貼り付け', pt: 'COLE CSV OU JSON', es: 'PEGUE CSV O JSON' }),
            impHelp:L({
                en: 'CSV header (optional): country,in,out — ISO-2 country, then two YYYY-MM-DD dates. JSON: array of {country,in,out} or the bundle form.',
                ko: 'CSV 헤더(선택): country,in,out — ISO-2 국가, YYYY-MM-DD 두 개. JSON: {country,in,out} 배열 또는 번들 형식.',
                ja: 'CSV ヘッダー(任意): country,in,out — ISO-2 国コードと YYYY-MM-DD 二つ。JSON: {country,in,out} の配列。',
                pt: 'Cabeçalho CSV (opcional): country,in,out — ISO-2 e duas datas YYYY-MM-DD. JSON: array de {country,in,out}.',
                es: 'Cabecera CSV (opcional): country,in,out — ISO-2 y dos fechas YYYY-MM-DD. JSON: matriz de {country,in,out}.'
            }),
            impBtn: L({ en: 'IMPORT', ko: '가져오기', ja: 'インポート', pt: 'IMPORTAR', es: 'IMPORTAR' }),
            expH:   L({ en: 'EXPORT EVERYTHING', ko: '전체 내보내기', ja: 'すべてエクスポート', pt: 'EXPORTAR TUDO', es: 'EXPORTAR TODO' }),
            expHelp:L({
                en: 'Downloads a JSON backup of all four calculators (Schengen, tax, insurance, pension).',
                ko: '4개 계산기 입력값을 JSON 백업으로 받는다.',
                ja: '4つの計算機の入力をJSONバックアップとしてダウンロード。',
                pt: 'Descarrega um JSON com os quatro calculadores.',
                es: 'Descarga un JSON con los cuatro cálculos.'
            }),
            expBtn: L({ en: 'DOWNLOAD JSON', ko: 'JSON 다운로드', ja: 'JSONをダウンロード', pt: 'DESCARREGAR JSON', es: 'DESCARGAR JSON' }),
            err:    L({ en: 'No valid rows found.', ko: '유효한 행이 없다.', ja: '有効な行が見つからない。', pt: 'Sem linhas válidas.', es: 'Sin filas válidas.' })
        };
        _modal.innerHTML = `
            <button type="button" class="sdd-imp-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-imp-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <section class="sdd-imp-section">
                    <h3>${escapeHtml(c.impH)}</h3>
                    <p>${escapeHtml(c.impHelp)}</p>
                    <textarea class="sdd-imp-textarea" data-imp-text placeholder="country,in,out&#10;PT,2026-01-08,2026-02-21&#10;..."></textarea>
                    <button type="button" class="sdd-imp-btn" data-imp-btn>${escapeHtml(c.impBtn)}</button>
                </section>
                <section class="sdd-imp-section">
                    <h3>${escapeHtml(c.expH)}</h3>
                    <p>${escapeHtml(c.expHelp)}</p>
                    <button type="button" class="sdd-imp-btn" data-exp-btn>${escapeHtml(c.expBtn)}</button>
                </section>
                <p class="sdd-imp-status" data-status></p>
            </div>
        `;
        const status = _modal.querySelector('[data-status]');
        const setStatus = (m, k) => { status.className = 'sdd-imp-status ' + (k || ''); status.textContent = m || ''; };
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelector('[data-imp-btn]').addEventListener('click', () => {
            const text = _modal.querySelector('[data-imp-text]').value;
            const trimmed = (text || '').trim();
            const rows = trimmed.startsWith('{') || trimmed.startsWith('[')
                ? parseJSON(trimmed) : parseCSV(trimmed);
            if (!rows.length) { setStatus(c.err, 'error'); return; }
            const r = applyStays(rows);
            setStatus(`+ ${r.added} TAX · + ${r.schengen} SCHENGEN`, 'ok');
        });
        _modal.querySelector('[data-exp-btn]').addEventListener('click', () => {
            const blob = new Blob([exportAll()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'saudade-stays.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 800);
            setStatus('OK', 'ok');
        });

        _modal.classList.add('active');
    }
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // Hash trigger.
    function handleHash() { if (location.hash === '#import') { openModal(); try { history.replaceState(null,'',location.pathname+location.search); } catch(e){} } }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_IMPORT = { parseCSV, parseJSON, applyStays, exportAll, openModal, closeModal };
})();

/* ── saudade-personal.js ──────────────────────────────────────────────────── */
// saudade · personal moments
//
// The empathy layer. Reads the user's localStorage data (visa stays,
// insurance, pension, and a "home cities" list) and turns the numbers into
// short italic sentences in the saudade voice — the kind of line a
// thoughtful editor would write to a single reader, not a dashboard.
//
// Example output:
//   "184 days since you last sat in a Seoul café."
//   "Your Schengen window resets in 47 days."
//   "On this day, last year, you were in Lisbon."
//   "Insurance lapses in 12 days."
//
// API:
//   window.SAUDADE_PERSONAL.compute()  →  [{ kind, line, weight }]
//   window.SAUDADE_PERSONAL.render(target, { lang, max })
//   window.SAUDADE_PERSONAL.setHomes(['SEL', 'LIS'])  → up to 3
//   window.SAUDADE_PERSONAL.getHomes()
'use strict';

(function() {
    if (window.SAUDADE_PERSONAL) return;
    const KEY_HOMES = 'saudade.homes';

    const MS_DAY = 86400000;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function safeRead(k, fallback) {
        try { const r = localStorage.getItem(k); if (!r) return fallback; const a = JSON.parse(r); return Array.isArray(a) || (a && typeof a === 'object') ? a : fallback; }
        catch (e) { return fallback; }
    }
    function safeWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function toUTC(s) {
        if (!s) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
        if (!m) return null;
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
        return isNaN(d.getTime()) ? null : d;
    }
    function todayUTC() {
        const n = new Date();
        return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    }
    function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / MS_DAY); }

    // ─── Curated home-city dictionary ────────────────────────────────────
    // 3-letter IATA-ish keys. Names per edition. The point of this small
    // dictionary is so 'LIS' renders as "Lisbon" / "리스본" / "リスボン" etc.,
    // not as a raw code. Free to extend.
    const CITIES = {
        SEL: { en: 'Seoul',      ko: '서울',     ja: 'ソウル',    pt: 'Seul',       es: 'Seúl' },
        LIS: { en: 'Lisbon',     ko: '리스본',   ja: 'リスボン',  pt: 'Lisboa',     es: 'Lisboa' },
        OPO: { en: 'Porto',      ko: '포르투',   ja: 'ポルト',    pt: 'Porto',      es: 'Oporto' },
        TYO: { en: 'Tokyo',      ko: '도쿄',     ja: '東京',      pt: 'Tóquio',     es: 'Tokio' },
        BCN: { en: 'Barcelona',  ko: '바르셀로나', ja: 'バルセロナ', pt: 'Barcelona',  es: 'Barcelona' },
        MAD: { en: 'Madrid',     ko: '마드리드', ja: 'マドリード', pt: 'Madrid',     es: 'Madrid' },
        BER: { en: 'Berlin',     ko: '베를린',   ja: 'ベルリン',  pt: 'Berlim',     es: 'Berlín' },
        DPS: { en: 'Bali',       ko: '발리',     ja: 'バリ',      pt: 'Bali',       es: 'Bali' },
        BKK: { en: 'Bangkok',    ko: '방콕',     ja: 'バンコク',  pt: 'Banguecoque',es: 'Bangkok' },
        CNX: { en: 'Chiang Mai', ko: '치앙마이', ja: 'チェンマイ', pt: 'Chiang Mai', es: 'Chiang Mai' },
        MEX: { en: 'Mexico City',ko: '멕시코시티', ja: 'メキシコシティ', pt: 'Cidade do México', es: 'Ciudad de México' },
        DAD: { en: 'Da Nang',    ko: '다낭',     ja: 'ダナン',    pt: 'Da Nang',    es: 'Da Nang' },
        TBS: { en: 'Tbilisi',    ko: '트빌리시', ja: 'トビリシ',  pt: 'Tbilisi',    es: 'Tiflis' },
        MED: { en: 'Medellín',   ko: '메데인',   ja: 'メデジン',  pt: 'Medellín',   es: 'Medellín' },
        BUE: { en: 'Buenos Aires', ko: '부에노스아이레스', ja: 'ブエノスアイレス', pt: 'Buenos Aires', es: 'Buenos Aires' }
    };
    function cityName(code, ed) { const c = CITIES[code]; return (c && c[ed]) || (c && c.en) || code; }

    // Map ISO-2 country codes to a representative home city when the user
    // imports stays — best-guess only, the user can override via setHomes.
    const ISO_TO_HOME = {
        KR: 'SEL', PT: 'LIS', JP: 'TYO', ES: 'MAD', DE: 'BER',
        ID: 'DPS', TH: 'CNX', MX: 'MEX', VN: 'DAD', GE: 'TBS',
        CO: 'MED', AR: 'BUE'
    };

    // ─── Per-source readers ──────────────────────────────────────────────
    function readSchengen() { return safeRead('saudade.schengen.stays', []); }
    function readTax()      { return safeRead('saudade.tax.stays', []); }
    function readIns()      { return safeRead('saudade.insurance.policies', []); }
    function readPen()      { return safeRead('saudade.pension.filings', []); }

    function lastSeenInCountry(country) {
        // Most recent date the user was inside `country`, drawn from tax stays.
        const stays = readTax().filter(s => s.country === country);
        if (!stays.length) return null;
        let latest = null;
        for (const s of stays) {
            const b = toUTC(s.out) || todayUTC();
            if (!latest || b > latest) latest = b;
        }
        return latest;
    }

    function setHomes(arr) {
        const cleaned = (Array.isArray(arr) ? arr : []).filter(c => CITIES[c]).slice(0, 3);
        safeWrite(KEY_HOMES, cleaned);
        return cleaned;
    }
    function getHomes() {
        const stored = safeRead(KEY_HOMES, null);
        if (Array.isArray(stored) && stored.length) return stored;
        // Auto-derive from tax stays — most days = home.
        const stays = readTax();
        if (!stays.length) return [];
        const days = {};
        for (const s of stays) {
            const a = toUTC(s.in); const b = toUTC(s.out) || todayUTC();
            if (!a || b < a) continue;
            const n = diffDays(b, a) + 1;
            days[s.country] = (days[s.country] || 0) + n;
        }
        const sorted = Object.entries(days).sort(([,a],[,b]) => b - a).slice(0, 3);
        return sorted.map(([iso]) => ISO_TO_HOME[iso]).filter(Boolean);
    }

    // ─── Sentence generators ────────────────────────────────────────────
    function compute(opts) {
        opts = opts || {};
        const ed = opts.lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const today = todayUTC();
        const moments = [];

        // 1. Saudade meter — days since last visit per home city.
        const homes = getHomes();
        for (const code of homes) {
            const iso = Object.entries(ISO_TO_HOME).find(([k, v]) => v === code);
            if (!iso) continue;
            const last = lastSeenInCountry(iso[0]);
            if (!last) continue;
            const days = diffDays(today, last);
            if (days <= 0) continue;
            const name = cityName(code, ed);
            moments.push({
                kind: 'saudade',
                weight: 80,
                line: L({
                    en: `${days} days since you last sat in a ${name} café.`,
                    ko: `마지막으로 ${name} 카페에 앉은 지 ${days}일.`,
                    ja: `最後に ${name} のカフェに座ってから ${days} 日。`,
                    pt: `${days} dias desde a última vez num café em ${name}.`,
                    es: `${days} días desde la última vez en un café de ${name}.`
                }, ed)
            });
        }

        // 2. Schengen window status (if any data).
        if (window.SAUDADE_SCHENGEN) {
            const stays = readSchengen();
            if (stays.length) {
                const r = window.SAUDADE_SCHENGEN.calc({ stays });
                if (r.used_in_window > 0) {
                    if (r.used_in_window >= 75) {
                        moments.push({
                            kind: 'schengen-warn',
                            weight: 95,
                            line: L({
                                en: `Schengen: ${r.used_in_window} of 90 used. ${r.remaining} left.`,
                                ko: `솅겐 ${r.used_in_window}/90 사용. 남은 ${r.remaining}일.`,
                                ja: `シェンゲン ${r.used_in_window}/90 使用。残り ${r.remaining} 日。`,
                                pt: `Schengen: ${r.used_in_window} de 90 usados. ${r.remaining} restantes.`,
                                es: `Schengen: ${r.used_in_window} de 90 usados. ${r.remaining} restantes.`
                            }, ed)
                        });
                    } else if (r.next_safe_entry_after && r.remaining < 30) {
                        moments.push({
                            kind: 'schengen-info',
                            weight: 60,
                            line: L({
                                en: `Your Schengen clock has ${r.remaining} days of room.`,
                                ko: `솅겐 시계에 ${r.remaining}일 여유.`,
                                ja: `シェンゲンの余裕は ${r.remaining} 日。`,
                                pt: `O seu relógio Schengen tem ${r.remaining} dias.`,
                                es: `Su reloj Schengen tiene ${r.remaining} días.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 3. Insurance gap proximity.
        if (window.SAUDADE_COVERAGE) {
            const policies = readIns();
            if (policies.length) {
                // Find the policy that ends soonest in the future.
                let nextEnd = null;
                let nextProvider = null;
                for (const p of policies) {
                    const end = toUTC(p.out);
                    if (!end || end < today) continue;
                    if (!nextEnd || end < nextEnd) { nextEnd = end; nextProvider = p.provider || ''; }
                }
                if (nextEnd) {
                    const days = diffDays(nextEnd, today);
                    if (days <= 30) {
                        moments.push({
                            kind: 'ins-warn',
                            weight: 90,
                            line: L({
                                en: `Insurance lapses in ${days} days.`,
                                ko: `보험 만료까지 ${days}일.`,
                                ja: `保険終了まで ${days} 日。`,
                                pt: `O seguro termina em ${days} dias.`,
                                es: `El seguro vence en ${days} días.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 4. Tax-residency near threshold.
        if (window.SAUDADE_TAX) {
            const stays = readTax();
            if (stays.length) {
                const r = window.SAUDADE_TAX.calc({ stays });
                for (const p of r.per_country) {
                    if (p.over_threshold) {
                        moments.push({
                            kind: 'tax-over',
                            weight: 92,
                            line: L({
                                en: `${p.days_in_year} days in ${p.country} this year — likely a tax resident.`,
                                ko: `올해 ${p.country} ${p.days_in_year}일 — 세금 거주자 가능성.`,
                                ja: `今年 ${p.country} ${p.days_in_year} 日 — 税居住の可能性。`,
                                pt: `${p.days_in_year} dias em ${p.country} este ano — provavelmente residente fiscal.`,
                                es: `${p.days_in_year} días en ${p.country} este año — probablemente residente fiscal.`
                            }, ed)
                        });
                    } else if (p.near_threshold) {
                        moments.push({
                            kind: 'tax-near',
                            weight: 70,
                            line: L({
                                en: `${p.days_in_year} of 183 in ${p.country}. Watch the calendar.`,
                                ko: `${p.country} 거주 ${p.days_in_year}/183. 달력을 주의.`,
                                ja: `${p.country} ${p.days_in_year}/183。暦に注意。`,
                                pt: `${p.days_in_year} de 183 em ${p.country}. Atenção ao calendário.`,
                                es: `${p.days_in_year} de 183 en ${p.country}. Atención al calendario.`
                            }, ed)
                        });
                    }
                }
            }
        }

        // 5. On-this-day — anniversary of any past stay.
        const taxStays = readTax();
        const todayMD = `-${String(today.getUTCMonth() + 1).padStart(2,'0')}-${String(today.getUTCDate()).padStart(2,'0')}`;
        for (const s of taxStays) {
            if (!s.in || !s.in.includes(todayMD)) continue;
            const a = toUTC(s.in);
            if (!a) continue;
            const years = today.getUTCFullYear() - a.getUTCFullYear();
            if (years < 1 || years > 25) continue;
            const homeCode = ISO_TO_HOME[s.country];
            if (!homeCode) continue;
            const cityNm = cityName(homeCode, ed);
            moments.push({
                kind: 'memory',
                weight: 50 + Math.min(years * 5, 30),
                line: L({
                    en: `On this day, ${years} year${years > 1 ? 's' : ''} ago, you arrived in ${cityNm}.`,
                    ko: `${years}년 전 오늘, ${cityNm}에 도착했다.`,
                    ja: `${years} 年前の今日、${cityNm} に着いた。`,
                    pt: `Neste dia, há ${years} ano${years > 1 ? 's' : ''}, chegou a ${cityNm}.`,
                    es: `Hoy hace ${years} año${years > 1 ? 's' : ''}, llegó a ${cityNm}.`
                }, ed)
            });
        }

        // Sort by weight descending — strongest first.
        moments.sort((a, b) => b.weight - a.weight);
        const max = (opts.max != null) ? opts.max : 4;
        return moments.slice(0, max);
    }

    function injectStyles() {
        if (document.getElementById('sddPersonalStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddPersonalStyles';
        s.textContent = `
.sdd-personal {
    margin: clamp(20px, 3vw, 32px) 0;
    padding: clamp(16px, 2.5vw, 24px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    position: relative;
}
.sdd-personal__eyebrow {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--rust);
    margin: 0 0 12px;
    display: flex; gap: 8px; align-items: baseline;
}
/* v644 — eyebrow alone is enough; the "— for you" suffix was self-narration. */
.sdd-personal__line {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(15px, 1.4vw, 19px);
    line-height: 1.5;
    color: var(--ink);
    margin: 8px 0;
    padding: 4px 0;
    text-wrap: balance;
}
.sdd-personal__line.is-warn  { color: var(--signal); }
.sdd-personal__line.is-alert { color: var(--rust); }
.sdd-personal__line.is-memory { color: var(--bone-d); }
.sdd-personal__cta {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--bone-d);
    margin: 14px 0 0; padding-top: 12px;
    border-top: 0.5px dotted var(--rule);
}
.sdd-personal__cta a {
    color: inherit; text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
    margin: 0 12px 0 0;
    transition: color .12s, border-color .12s;
}
.sdd-personal__cta a:hover { color: var(--rust); border-bottom-color: var(--rust); }

/* Empty-state empathy hook for fresh visitors with no data. */
.sdd-personal--empty .sdd-personal__line {
    color: var(--bone-d);
    font-size: clamp(14px, 1.3vw, 17px);
}
.sdd-personal--empty .sdd-personal__line strong {
    color: var(--rust); font-weight: 400; font-style: italic;
}
        `;
        document.head.appendChild(s);
    }

    function render(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        const ed = (opts && opts.lang) || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const moments = compute({ lang: ed, max: (opts && opts.max) || 4 });

        const eyebrowLabel = L({
            en: 'NOTES FOR ONE READER',
            ko: '한 사람을 위한 메모',
            ja: '一人の読者へ',
            pt: 'NOTAS PARA UM LEITOR',
            es: 'NOTAS PARA UN LECTOR'
        }, ed);

        if (!moments.length) {
            // Fresh-visitor empathy hook.
            const emptyLine = L({
                en: 'You have not told us where you are. <strong>Set a home city</strong>, or <strong>see how this looks populated</strong>.',
                ko: '아직 어디에 있는지 알려주지 않았다. <strong>홈 도시를 설정하거나</strong>, <strong>예시 데이터로 본다</strong>.',
                ja: 'まだあなたの居場所を知らない。<strong>ホーム都市を設定する</strong>か、<strong>サンプルで見る</strong>。',
                pt: 'Ainda não nos disse onde está. <strong>Defina uma cidade-base</strong>, ou <strong>veja com dados de exemplo</strong>.',
                es: 'Aún no nos ha dicho dónde está. <strong>Defina una ciudad base</strong>, o <strong>vea con datos de ejemplo</strong>.'
            }, ed);
            const ctaSet  = L({ en: 'SET HOME CITIES', ko: '홈 도시 설정', ja: 'ホーム都市', pt: 'CIDADES-BASE', es: 'CIUDADES BASE' }, ed);
            const ctaDemo = L({ en: 'SHOW DEMO',       ko: '예시 보기',   ja: 'サンプル', pt: 'VER EXEMPLO', es: 'VER EJEMPLO' }, ed);
            host.innerHTML = `
                <section class="sdd-personal sdd-personal--empty" lang="${ed}">
                    <p class="sdd-personal__eyebrow">${escapeHtml(eyebrowLabel)}</p>
                    <p class="sdd-personal__line">${emptyLine /* trusted in-file copy */}</p>
                    <p class="sdd-personal__cta">
                        <a href="#homes">${escapeHtml(ctaSet)}</a>
                        <a href="#demo">${escapeHtml(ctaDemo)}</a>
                    </p>
                </section>
            `;
            return;
        }

        const lines = moments.map(m => {
            const cls = (m.kind === 'schengen-warn' || m.kind === 'tax-over') ? 'is-alert'
                      : (m.kind === 'ins-warn' || m.kind === 'tax-near')      ? 'is-warn'
                      : (m.kind === 'memory')                                  ? 'is-memory' : '';
            return `<p class="sdd-personal__line ${cls}">${escapeHtml(m.line)}</p>`;
        }).join('');

        host.innerHTML = `
            <section class="sdd-personal" lang="${ed}">
                <p class="sdd-personal__eyebrow">${escapeHtml(eyebrowLabel)}</p>
                ${lines}
            </section>
        `;
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectStyles);
        else injectStyles();
    }

    window.SAUDADE_PERSONAL = { compute, render, setHomes, getHomes, CITIES };
})();

/* ── saudade-homes.js ──────────────────────────────────────────────────── */
// saudade · home cities setting
//
// One screen, three lines: pick up to three "home" cities. The personal-
// moments engine uses them for the saudade meter ("X days since you last
// sat in a Lisbon café") and the on-this-day rubric.
//
// Triggered via #homes URL hash or window.SAUDADE_HOMES.openModal().
'use strict';

(function() {
    if (window.SAUDADE_HOMES) return;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    let _modal = null;

    function injectStyles() {
        if (document.getElementById('sddHomesStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddHomesStyles';
        s.textContent = `
.sdd-homes-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-homes-modal.active { display: flex; }
.sdd-homes-inner { width: 100%; max-width: 520px; }
.sdd-homes-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    letter-spacing: -0.02em; margin: 0 0 12px;
}
.sdd-homes-lede {
    font-family: var(--serif); font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px); line-height: 1.55;
    color: var(--bone-d); font-style: italic;
    margin: 0 0 24px; max-width: 44ch;
}
.sdd-homes-list {
    list-style: none; margin: 0 0 24px; padding: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-homes-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-size: 13px;
    color: var(--ink);
    cursor: pointer;
    transition: color .12s, padding .12s;
}
.sdd-homes-row:hover { color: var(--rust); padding-left: 4px; }
.sdd-homes-row .city {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 18px;
}
.sdd-homes-row .code {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; color: var(--bone-d);
}
.sdd-homes-row.is-selected .code { color: var(--rust); }
.sdd-homes-row.is-selected .city { color: var(--rust); }
.sdd-homes-row .pos {
    font-family: var(--mono); font-weight: 500; font-size: 18px;
    color: var(--rust); font-style: italic;
    font-family: var(--serif);
    margin-right: 12px;
}
.sdd-homes-actions {
    display: flex; flex-direction: column;
    border-top: 0.5px solid var(--rule);
    margin-top: 12px;
}
.sdd-homes-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 16px 4px; cursor: pointer;
    text-align: left; min-height: 44px;
    transition: color .15s;
}
.sdd-homes-btn:hover { color: var(--rust); }
.sdd-homes-btn.is-quiet { color: var(--bone-d); }
.sdd-homes-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-homes-close:hover { color: var(--rust); }
        `;
        document.head.appendChild(s);
    }

    function paint() {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const cities = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.CITIES) || {};
        const current = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.getHomes && window.SAUDADE_PERSONAL.getHomes()) || [];
        const c = {
            title: L({ en: 'Where are you from?', ko: '어디에서 왔나?', ja: 'どこから来ましたか？', pt: 'De onde é?', es: '¿De dónde es?' }, ed),
            lede:  L({
                en: 'Pick up to three cities you carry with you. We’ll count the days since you last sat in each.',
                ko: '품고 다니는 도시를 세 곳까지 고르라. 마지막으로 그곳에 앉은 날부터 헤아린다.',
                ja: '心に抱える街を最大三つ。最後にそこに座った日から数える。',
                pt: 'Escolha até três cidades que carrega consigo. Contamos os dias desde a última vez em cada uma.',
                es: 'Elija hasta tres ciudades que lleva consigo. Contamos los días desde la última vez en cada una.'
            }, ed),
            close: L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, ed),
            save:  L({ en: 'SAVE', ko: '저장', ja: '保存', pt: 'GUARDAR', es: 'GUARDAR' }, ed),
            clear: L({ en: 'CLEAR ALL', ko: '모두 지우기', ja: 'すべて消す', pt: 'LIMPAR TUDO', es: 'BORRAR TODO' }, ed),
            none:  L({ en: 'No cities selected yet.', ko: '아직 선택된 도시가 없다.', ja: 'まだ選んでいない。', pt: 'Sem cidades.', es: 'Sin ciudades.' }, ed)
        };
        const sel = current.slice();
        const codes = Object.keys(cities).sort((a, b) => {
            const ai = sel.indexOf(a), bi = sel.indexOf(b);
            if (ai !== -1 && bi === -1) return -1;
            if (bi !== -1 && ai === -1) return 1;
            if (ai !== -1 && bi !== -1) return ai - bi;
            return cities[a].en.localeCompare(cities[b].en);
        });
        _modal.innerHTML = `
            <button type="button" class="sdd-homes-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-homes-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-homes-lede">${escapeHtml(c.lede)}</p>
                <ul class="sdd-homes-list" data-list>
                    ${codes.map(code => {
                        const pos = sel.indexOf(code);
                        const cls = pos !== -1 ? 'is-selected' : '';
                        return `
                            <li class="sdd-homes-row ${cls}" data-code="${code}" tabindex="0">
                                <span><span class="pos">${pos !== -1 ? (pos + 1) : ''}</span><span class="city">${escapeHtml(cities[code][ed] || cities[code].en)}</span></span>
                                <span class="code">${code}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
                <div class="sdd-homes-actions">
                    <button type="button" class="sdd-homes-btn" data-save>${escapeHtml(c.save)}</button>
                    <button type="button" class="sdd-homes-btn is-quiet" data-clear>${escapeHtml(c.clear)}</button>
                </div>
            </div>
        `;
        let local = sel;
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelectorAll('.sdd-homes-row').forEach(row => {
            row.addEventListener('click', () => {
                const code = row.dataset.code;
                const idx = local.indexOf(code);
                if (idx !== -1) {
                    local.splice(idx, 1);
                } else if (local.length < 3) {
                    local.push(code);
                } else {
                    // Replace last selection so user can keep tapping cities
                    local[2] = code;
                }
                // Repaint with the new selection so the position number updates.
                if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                    // don't persist yet — that's what Save does
                }
                // Repaint just the list rows.
                const cities = (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.CITIES) || {};
                _modal.querySelectorAll('.sdd-homes-row').forEach(r => {
                    const code = r.dataset.code;
                    const pos = local.indexOf(code);
                    r.classList.toggle('is-selected', pos !== -1);
                    r.querySelector('.pos').textContent = pos !== -1 ? (pos + 1) : '';
                });
            });
        });
        _modal.querySelector('[data-save]').addEventListener('click', () => {
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                window.SAUDADE_PERSONAL.setHomes(local);
            }
            closeModal();
            // Repaint the cover personal block if mounted.
            const target = document.getElementById('sddCoverPersonal');
            if (target && window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.render) {
                window.SAUDADE_PERSONAL.render(target);
            }
        });
        _modal.querySelector('[data-clear]').addEventListener('click', () => {
            local = [];
            if (window.SAUDADE_PERSONAL && window.SAUDADE_PERSONAL.setHomes) {
                window.SAUDADE_PERSONAL.setHomes([]);
            }
            paint();
        });
    }

    function openModal() {
        injectStyles();
        if (!_modal) {
            _modal = document.createElement('div');
            _modal.className = 'sdd-homes-modal';
            _modal.setAttribute('role', 'dialog');
            _modal.setAttribute('aria-modal', 'true');
            document.body.appendChild(_modal);
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
            });
        }
        paint();
        _modal.classList.add('active');
    }
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    function handleHash() {
        if (location.hash === '#homes') {
            openModal();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_HOMES = { openModal, closeModal };
})();

/* ── saudade-letters.js ──────────────────────────────────────────────────── */
// saudade · letters to the editor
//
// Two surfaces:
//   1. A submit modal (#letter) — readers send a 30..800-char letter.
//      Letters go to a queue; nothing is publicly visible until an editor
//      reviews and publishes. No comment threads, no replies, no upvotes.
//   2. A read-only block (renderRecent) — published letters from the same
//      edition, italic, signed with display name + city, paper-flavoured.
//
// API:
//   window.SAUDADE_LETTERS.openModal({ dispatch_ref?, city_tag? })
//   window.SAUDADE_LETTERS.renderRecent(target, { edition?, dispatch_ref?, max? })
'use strict';

(function() {
    if (window.SAUDADE_LETTERS) return;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    let _modal = null;

    function injectStyles() {
        if (document.getElementById('sddLettersStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddLettersStyles';
        s.textContent = `
.sdd-let-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-let-modal.active { display: flex; }
.sdd-let-inner { width: 100%; max-width: 560px; }
.sdd-let-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    letter-spacing: -0.02em; margin: 0 0 12px;
}
.sdd-let-lede {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 14px; color: var(--bone-d);
    margin: 0 0 24px; max-width: 48ch;
}
.sdd-let-section { border-top: 0.5px solid var(--rule); padding: 16px 0; }
.sdd-let-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-let-input, .sdd-let-textarea {
    width: 100%; box-sizing: border-box;
    background: transparent; color: var(--ink);
    font-family: var(--serif); font-weight: 300; font-size: 16px;
    border: 0; border-bottom: 0.5px solid var(--rule);
    padding: 6px 0; outline: none; border-radius: 0;
    line-height: 1.5;
}
.sdd-let-input:focus, .sdd-let-textarea:focus { border-bottom-color: var(--ink); }
.sdd-let-textarea {
    min-height: 140px; resize: vertical;
    border: 0.5px solid var(--rule); padding: 12px;
    font-family: var(--serif); font-weight: 300; font-size: 17px;
    line-height: 1.6;
}
.sdd-let-count {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 4px 0 0;
    text-align: right;
}
.sdd-let-count.is-warn { color: var(--signal); }
.sdd-let-count.is-over { color: var(--rust); }
.sdd-let-actions {
    display: flex; flex-direction: column;
    border-top: 0.5px solid var(--rule); margin-top: 12px;
}
.sdd-let-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 16px 4px; cursor: pointer;
    text-align: left; min-height: 44px;
    transition: color .15s;
}
.sdd-let-btn:hover { color: var(--rust); }
.sdd-let-btn[disabled] { opacity: 0.3; pointer-events: none; }
.sdd-let-btn.is-quiet { color: var(--bone-d); }
.sdd-let-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    padding: 12px 0; color: var(--bone-d);
    min-height: 1em; margin-top: 12px;
    border-top: 0.5px solid var(--rule);
}
.sdd-let-status.ok    { color: var(--ink); }
.sdd-let-status.error { color: var(--rust); }
.sdd-let-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-let-close:hover { color: var(--rust); }

/* Recent letters block (read-only) */
.sdd-letters {
    margin: clamp(28px, 4vw, 48px) 0;
    padding: clamp(20px, 3vw, 28px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-letters__h {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 18px;
    display: flex; justify-content: space-between; align-items: baseline;
}
.sdd-letters__h a {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    color: var(--bone-d); text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-letters__h a:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-letter {
    padding: 18px 0;
    border-top: 0.5px dotted var(--rule);
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
}
.sdd-letter:first-child { border-top: 0; }
.sdd-letter blockquote {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.55;
    color: var(--ink); margin: 0;
    text-wrap: pretty;
    hanging-punctuation: first last;
}
.sdd-letter blockquote::before { content: '"'; color: var(--rust); font-size: 1.15em; margin-right: 0.05em; }
.sdd-letter blockquote::after  { content: '"'; color: var(--rust); margin-left: 0.05em; }
.sdd-letter cite {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); font-style: normal;
}
.sdd-letters__none {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d);
    padding: 12px 0;
}
        `;
        document.head.appendChild(s);
    }

    function copyM(lang) {
        return {
            title:   L({ en: 'Write to the editor.', ko: '편집장에게 편지.', ja: '編集長への手紙。', pt: 'Escrever ao editor.', es: 'Escribir al editor.' }, lang),
            lede:    L({
                en: 'Up to 800 characters. Read by a human editor before publication.',
                ko: '800자 이내. 편집장이 읽고 검토한 뒤 공개.',
                ja: '八百字以内。編集長の確認を経て公開。',
                pt: 'Até 800 caracteres. Lida por um editor antes de publicar.',
                es: 'Hasta 800 caracteres. Leída por un editor antes de publicar.'
            }, lang),
            close:   L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, lang),
            lblSign: L({ en: 'SIGNED AS', ko: '서명', ja: '署名', pt: 'ASSINADO POR', es: 'FIRMADO POR' }, lang),
            phSign:  L({ en: 'Laia, Barcelona', ko: '라이아, 바르셀로나', ja: 'ライア、バルセロナ', pt: 'Laia, Barcelona', es: 'Laia, Barcelona' }, lang),
            lblBody: L({ en: 'YOUR LETTER', ko: '편지 본문', ja: '本文', pt: 'A SUA CARTA', es: 'SU CARTA' }, lang),
            phBody:  L({
                en: 'Dear editor, …',
                ko: '편집장님께, …',
                ja: '編集長様、…',
                pt: 'Caro editor, …',
                es: 'Estimado editor, …'
            }, lang),
            send:    L({ en: 'SEND', ko: '보내기', ja: '送る', pt: 'ENVIAR', es: 'ENVIAR' }, lang),
            cancel:  L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, lang),
            ok:      L({ en: 'Letter received. The editor will read it before the next dispatch.', ko: '편지가 도착했다. 편집장이 다음 디스패치 전에 읽는다.', ja: '手紙を受け取った。次のディスパッチ前に編集長が読む。', pt: 'Carta recebida. O editor lerá antes do próximo despacho.', es: 'Carta recibida. El editor la leerá antes del próximo despacho.' }, lang),
            tooShort: L({ en: 'Too short. 30 characters minimum.', ko: '너무 짧다. 최소 30자.', ja: '短すぎる。最小三十字。', pt: 'Demasiado curta. 30 caracteres mínimo.', es: 'Demasiado corta. 30 caracteres mínimo.' }, lang),
            tooLong:  L({ en: 'Over 800 characters.', ko: '800자 초과.', ja: '八百字超過。', pt: 'Mais de 800 caracteres.', es: 'Más de 800 caracteres.' }, lang),
            err:      L({ en: 'Could not send. Try again.', ko: '전송 실패. 다시 시도하라.', ja: '送信できなかった。再試行。', pt: 'Não foi possível enviar. Tente de novo.', es: 'No se pudo enviar. Inténtelo de nuevo.' }, lang),
            failClosed: L({ en: 'Letters are not open yet.', ko: '편지함이 아직 열리지 않았다.', ja: '投書はまだ開いていない。', pt: 'As cartas ainda não estão abertas.', es: 'Las cartas aún no están abiertas.' }, lang)
        };
    }

    function ensureModal() {
        if (_modal) return _modal;
        injectStyles();
        _modal = document.createElement('div');
        _modal.className = 'sdd-let-modal';
        _modal.setAttribute('role', 'dialog');
        _modal.setAttribute('aria-modal', 'true');
        document.body.appendChild(_modal);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
        });
        return _modal;
    }

    function openModal(opts) {
        opts = opts || {};
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c = copyM(ed);
        ensureModal().innerHTML = `
            <button type="button" class="sdd-let-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-let-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-let-lede">${escapeHtml(c.lede)}</p>

                <section class="sdd-let-section">
                    <p class="sdd-let-label">${escapeHtml(c.lblSign)}</p>
                    <input type="text" class="sdd-let-input" data-sign maxlength="120"
                           placeholder="${escapeHtml(c.phSign)}"
                           value="${opts.city_tag ? ', ' + escapeHtml(opts.city_tag) : ''}" />
                </section>

                <section class="sdd-let-section">
                    <p class="sdd-let-label">${escapeHtml(c.lblBody)}</p>
                    <textarea class="sdd-let-textarea" data-body maxlength="800"
                              placeholder="${escapeHtml(c.phBody)}"></textarea>
                    <p class="sdd-let-count" data-count>0 / 800</p>
                </section>

                <div class="sdd-let-actions">
                    <button type="button" class="sdd-let-btn" data-send>${escapeHtml(c.send)}</button>
                    <button type="button" class="sdd-let-btn is-quiet" data-cancel>${escapeHtml(c.cancel)}</button>
                </div>
                <p class="sdd-let-status" data-status></p>
            </div>
        `;
        const status   = _modal.querySelector('[data-status]');
        const setStat  = (m, k) => { status.className = 'sdd-let-status ' + (k || ''); status.textContent = m || ''; };
        const bodyEl   = _modal.querySelector('[data-body]');
        const countEl  = _modal.querySelector('[data-count]');

        bodyEl.addEventListener('input', () => {
            const n = bodyEl.value.length;
            countEl.textContent = `${n} / 800`;
            countEl.className = 'sdd-let-count' + (n > 800 ? ' is-over' : n > 700 ? ' is-warn' : '');
        });

        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
        _modal.querySelector('[data-send]').addEventListener('click', async () => {
            // Single 'Name, City' field — split on the last comma so names with
            // commas in them survive (e.g. "Lee, Jaejin, Lisbon").
            const sign = _modal.querySelector('[data-sign]').value.trim();
            const lastComma = sign.lastIndexOf(',');
            const name = lastComma > 0 ? sign.slice(0, lastComma).trim() : sign;
            const city = lastComma > 0 ? sign.slice(lastComma + 1).trim() : '';
            const body = bodyEl.value.trim();
            if (body.length < 30) { setStat(c.tooShort, 'error'); return; }
            if (body.length > 800) { setStat(c.tooLong,  'error'); return; }
            const base = (window.AURA_SERVER || '').replace(/\/$/, '');
            if (!base) { setStat(c.failClosed, 'error'); return; }
            try {
                setStat('…');
                const headers = { 'Content-Type': 'application/json' };
                if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.authHeaders) {
                    Object.assign(headers, window.SAUDADE_AUTH.authHeaders());
                }
                const r = await fetch(base + '/letters/submit', {
                    method: 'POST', headers, credentials: 'omit',
                    body: JSON.stringify({
                        body, display_name: name, city_tag: city,
                        edition: ed,
                        dispatch_ref: opts.dispatch_ref || null
                    })
                });
                const j = await r.json().catch(() => null);
                if (!r.ok || !j || !j.ok) { setStat(c.err, 'error'); return; }
                setStat(c.ok, 'ok');
                bodyEl.value = '';
                setTimeout(closeModal, 1600);
            } catch (e) { setStat(c.err, 'error'); }
        });

        _modal.classList.add('active');
        setTimeout(() => bodyEl.focus(), 80);
    }
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // ─── Read-only block: published letters ──────────────────────────────
    async function renderRecent(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        opts = opts || {};
        const ed   = opts.edition || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const max  = opts.max || 6;
        const dRef = opts.dispatch_ref || '';
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        const c    = {
            title: L({ en: 'LETTERS TO THE EDITOR', ko: '편집장에게 보낸 편지', ja: '編集長への手紙', pt: 'CARTAS AO EDITOR', es: 'CARTAS AL EDITOR' }, ed),
            write: L({ en: 'Write your own', ko: '직접 쓰기', ja: '書く', pt: 'Escrever uma', es: 'Escribir una' }, ed),
            none:  L({ en: 'No letters published yet. Be the first.', ko: '아직 공개된 편지가 없다. 첫 편지가 되어 보라.', ja: 'まだ公開された手紙はない。最初の一通を。', pt: 'Ainda sem cartas publicadas. Seja o primeiro.', es: 'Aún sin cartas publicadas. Sea el primero.' }, ed)
        };

        let letters = [];
        if (base) {
            try {
                const u = new URL(base + '/letters/list');
                u.searchParams.set('edition', ed);
                u.searchParams.set('limit', String(max));
                if (dRef) u.searchParams.set('dispatch_ref', dRef);
                const r = await fetch(u.toString(), { credentials: 'omit' });
                const j = await r.json().catch(() => null);
                if (r.ok && j && Array.isArray(j.letters)) letters = j.letters;
            } catch (e) {}
        }

        const list = letters.length ? letters.map(l => {
            const sign = l.city ? `${escapeHtml(l.display_name)}, ${escapeHtml(l.city)}` : escapeHtml(l.display_name);
            return `
                <article class="sdd-letter">
                    <blockquote>${escapeHtml(l.body)}</blockquote>
                    <cite>— ${sign}</cite>
                </article>
            `;
        }).join('') : `<p class="sdd-letters__none">${escapeHtml(c.none)}</p>`;

        host.innerHTML = `
            <section class="sdd-letters">
                <p class="sdd-letters__h">
                    <span>${escapeHtml(c.title)}</span>
                    <a href="#letter">${escapeHtml(c.write)}</a>
                </p>
                ${list}
            </section>
        `;
    }

    // Hash trigger.
    function handleHash() {
        if (location.hash === '#letter') {
            openModal();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_LETTERS = { openModal, closeModal, renderRecent };
})();

/* ── saudade-desks.js ──────────────────────────────────────────────────── */
// saudade · stringer desks
//
// Surfaces:
//   • SAUDADE_DESKS.openApply()    — pitch yourself as a correspondent
//   • SAUDADE_DESKS.openSubmit()   — file a new post (signed-in stringers)
//   • SAUDADE_DESKS.renderIndex()  — list of active desks
//   • SAUDADE_DESKS.renderPosts()  — recent posts from a single desk
//
// URL hashes:
//   #desk-apply        → application modal
//   #desk-submit       → post submission modal (must be signed in)
'use strict';

(function() {
    if (window.SAUDADE_DESKS) return;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function fmtDate(ms) {
        if (!ms) return '—';
        try { return new Date(ms).toISOString().slice(0, 10); }
        catch (e) { return '—'; }
    }
    function authHeaders() {
        const h = { 'Content-Type': 'application/json' };
        if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.authHeaders) {
            Object.assign(h, window.SAUDADE_AUTH.authHeaders());
        }
        return h;
    }

    let _modal = null;

    function injectStyles() {
        if (document.getElementById('sddDesksStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDesksStyles';
        s.textContent = `
.sdd-desk-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-desk-modal.active { display: flex; }
.sdd-desk-inner { width: 100%; max-width: 640px; }
.sdd-desk-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 44px); line-height: 1.05;
    letter-spacing: -0.02em; margin: 0 0 12px;
}
.sdd-desk-lede {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 14px; color: var(--bone-d);
    margin: 0 0 24px; max-width: 52ch;
}
.sdd-desk-section { border-top: 0.5px solid var(--rule); padding: 16px 0; }
.sdd-desk-label {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 0 0 6px;
}
.sdd-desk-input, .sdd-desk-textarea, .sdd-desk-select {
    width: 100%; box-sizing: border-box;
    background: transparent; color: var(--ink);
    font-family: var(--serif); font-weight: 300; font-size: 16px;
    border: 0; border-bottom: 0.5px solid var(--rule);
    padding: 6px 0; outline: none; border-radius: 0;
    line-height: 1.5;
}
.sdd-desk-textarea {
    min-height: 200px; resize: vertical;
    border: 0.5px solid var(--rule); padding: 12px;
    font-family: var(--serif); font-weight: 300; font-size: 16px;
    line-height: 1.6;
}
.sdd-desk-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 540px) { .sdd-desk-grid2 { grid-template-columns: 1fr; } }
.sdd-desk-details { padding: 0; }
.sdd-desk-details > summary {
    list-style: none;
    cursor: pointer;
    padding: 16px 0;
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d);
    transition: color .15s;
}
.sdd-desk-details > summary::-webkit-details-marker { display: none; }
.sdd-desk-details > summary::before {
    content: "+";
    color: var(--rust);
    font-family: var(--serif); font-style: italic; font-size: 16px;
    margin-right: 12px; transition: transform .2s;
    display: inline-block;
}
.sdd-desk-details[open] > summary::before { transform: rotate(45deg); }
.sdd-desk-details > summary:hover { color: var(--ink); }
.sdd-desk-details[open] > summary { border-bottom: 0.5px dotted var(--rule); margin-bottom: 4px; }
.sdd-desk-count {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); margin: 4px 0 0; text-align: right;
}
.sdd-desk-count.is-warn { color: var(--signal); }
.sdd-desk-count.is-over { color: var(--rust); }
.sdd-desk-actions {
    display: flex; flex-direction: column;
    border-top: 0.5px solid var(--rule); margin-top: 12px;
}
.sdd-desk-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 16px 4px; cursor: pointer;
    text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-desk-btn:hover { color: var(--rust); }
.sdd-desk-btn.is-quiet { color: var(--bone-d); }
.sdd-desk-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    padding: 12px 0; color: var(--bone-d);
    min-height: 1em; margin-top: 12px;
    border-top: 0.5px solid var(--rule);
}
.sdd-desk-status.ok    { color: var(--ink); }
.sdd-desk-status.error { color: var(--rust); }
.sdd-desk-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-desk-close:hover { color: var(--rust); }

/* Index page (read-only). */
.sdd-desks-index { padding: clamp(20px, 3vw, 40px) 0; }
.sdd-desks-index h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(36px, 5vw, 64px); line-height: 0.95;
    letter-spacing: -0.03em;
    margin: 0 0 28px;
}
.sdd-desks-list { list-style: none; margin: 0; padding: 0; }
.sdd-desks-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    padding: 18px 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
}
.sdd-desks-row:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-desks-row a {
    color: inherit; text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
    padding-bottom: 1px;
}
.sdd-desks-row a:hover { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-desks-name {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(20px, 2vw, 28px); line-height: 1.1;
}
.sdd-desks-bio {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 14px; color: var(--bone-d);
    margin: 4px 0 0;
}
.sdd-desks-meta {
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); text-align: right; white-space: nowrap;
}
.sdd-desks-meta .city { color: var(--rust); display: block; margin-bottom: 4px; }
.sdd-desks-empty {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: 16px; color: var(--bone-d);
    padding: 32px 0; text-align: center;
}
        `;
        document.head.appendChild(s);
    }

    function ensureModal() {
        if (_modal) return _modal;
        injectStyles();
        _modal = document.createElement('div');
        _modal.className = 'sdd-desk-modal';
        _modal.setAttribute('role', 'dialog');
        _modal.setAttribute('aria-modal', 'true');
        document.body.appendChild(_modal);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
        });
        return _modal;
    }

    // ─── Apply modal ─────────────────────────────────────────────────────
    function copyApply(lang) {
        return {
            title:   L({ en: 'Become a stringer.', ko: '통신원으로 합류.', ja: '通信員になる。', pt: 'Tornar-se correspondente.', es: 'Hazte corresponsal.' }, lang),
            lede:    L({
                en: 'A column under the saudade masthead, signed with your name. We invite slowly — within two weeks if it fits.',
                ko: 'saudade 마스트헤드 아래 본인 이름의 칼럼. 천천히 초대한다 — 어울리면 2주 안에 답장.',
                ja: 'saudadeのマストヘッド下に自分の名前で。ゆっくり招く — 合えば二週間以内に返信。',
                pt: 'Uma coluna sob a cabeçalho da saudade, com o seu nome. Convidamos devagar — duas semanas se encaixar.',
                es: 'Una columna bajo la cabecera de saudade, con su nombre. Invitamos despacio — dos semanas si encaja.'
            }, lang),
            close:   L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, lang),
            lblName: L({ en: 'NAME', ko: '이름', ja: '名前', pt: 'NOME', es: 'NOMBRE' }, lang),
            phName:  L({ en: 'Inês Coutinho',     ko: '이네스 코티뇨', ja: 'イネス・コチーニョ', pt: 'Inês Coutinho', es: 'Inês Coutinho' }, lang),
            lblCity: L({ en: 'CITY', ko: '도시', ja: '都市', pt: 'CIDADE', es: 'CIUDAD' }, lang),
            phCity:  L({ en: 'lisbon',  ko: 'lisbon',  ja: 'lisbon',  pt: 'lisboa',  es: 'lisboa' }, lang),
            lblEmail:L({ en: 'EMAIL',   ko: '이메일', ja: 'メール',   pt: 'EMAIL',   es: 'CORREO' }, lang),
            lblBio:  L({ en: 'BIO (40 WORDS)',     ko: '약력 (40 단어)', ja: '略歴（40語）', pt: 'BIOGRAFIA (40 PALAVRAS)', es: 'BIO (40 PALABRAS)' }, lang),
            phBio:   L({ en: 'A line a reader of saudade would recognise.', ko: 'saudade 독자라면 알아볼 한 줄.', ja: 'saudade読者がうなずく一行。', pt: 'Uma linha que um leitor da saudade reconheceria.', es: 'Una línea que un lector de saudade reconocería.' }, lang),
            lblPitch:L({ en: 'YOUR PITCH', ko: '제안서', ja: '提案', pt: 'A SUA PROPOSTA', es: 'SU PROPUESTA' }, lang),
            phPitch: L({
                en: 'Why this city, what you would file in your first three months, what voice you write in. 200–800 words.',
                ko: '왜 이 도시인지, 첫 3개월에 무엇을 보낼지, 어떤 음성으로 쓰는지. 200~800자.',
                ja: 'なぜこの都市か、最初の三ヶ月で何を送るか、どんな声で書くか。二百〜八百字。',
                pt: 'Porquê esta cidade, o que enviaria nos primeiros três meses, em que voz escreve. 200–800 palavras.',
                es: 'Por qué esta ciudad, qué enviaría en los primeros tres meses, en qué voz escribe. 200–800 palabras.'
            }, lang),
            lblCadence: L({ en: 'CADENCE', ko: '주기', ja: '頻度', pt: 'CADÊNCIA', es: 'CADENCIA' }, lang),
            cadenceMonthly:   L({ en: 'Monthly',     ko: '월 1회',     ja: '月一回',     pt: 'Mensal',     es: 'Mensual' }, lang),
            cadenceBiweekly:  L({ en: 'Twice a month', ko: '월 2회',   ja: '月二回',     pt: 'Quinzenal',  es: 'Quincenal' }, lang),
            cadenceQuarterly: L({ en: 'Quarterly',   ko: '분기 1회',   ja: '四半期に一度', pt: 'Trimestral', es: 'Trimestral' }, lang),
            send:    L({ en: 'SEND PITCH', ko: '제안 보내기', ja: 'ピッチを送る', pt: 'ENVIAR PROPOSTA', es: 'ENVIAR PROPUESTA' }, lang),
            cancel:  L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, lang),
            ok:      L({
                en: 'Pitch received. The editor will read it before the next dispatch.',
                ko: '제안서가 도착했다. 편집장이 다음 디스패치 전에 읽는다.',
                ja: 'ピッチを受け取った。次のディスパッチ前に編集長が読む。',
                pt: 'Proposta recebida. O editor lerá antes do próximo despacho.',
                es: 'Propuesta recibida. El editor la leerá antes del próximo despacho.'
            }, lang),
            err:        L({ en: 'Could not send. Try again.', ko: '전송 실패. 다시 시도하라.', ja: '送信失敗。再試行。', pt: 'Não foi possível enviar.', es: 'No se pudo enviar.' }, lang),
            failClosed: L({ en: 'Applications are not open yet.', ko: '아직 지원이 열리지 않았다.', ja: '応募はまだ開いていない。', pt: 'As candidaturas ainda não estão abertas.', es: 'Las candidaturas aún no están abiertas.' }, lang),
            tooShort:   L({ en: 'Pitch too short. 80 characters min.', ko: '제안이 너무 짧다. 80자 이상.', ja: 'ピッチが短すぎる。八十字以上。', pt: 'Proposta demasiado curta.', es: 'Propuesta demasiado corta.' }, lang),
            badEmail:   L({ en: 'Email looks invalid.', ko: '이메일 형식이 잘못됐다.', ja: 'メールの形式が無効。', pt: 'Email inválido.', es: 'Correo inválido.' }, lang)
        };
    }

    function openApply() {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c = copyApply(ed);
        const root = ensureModal();
        const u = (window.SAUDADE_AUTH && window.SAUDADE_AUTH.getUser && window.SAUDADE_AUTH.getUser()) || {};
        root.innerHTML = `
            <button type="button" class="sdd-desk-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-desk-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-desk-lede">${escapeHtml(c.lede)}</p>

                <div class="sdd-desk-grid2">
                    <section class="sdd-desk-section">
                        <p class="sdd-desk-label">${escapeHtml(c.lblName)}</p>
                        <input class="sdd-desk-input" data-name maxlength="80"
                               placeholder="${escapeHtml(c.phName)}" />
                    </section>
                    <section class="sdd-desk-section">
                        <p class="sdd-desk-label">${escapeHtml(c.lblCity)}</p>
                        <input class="sdd-desk-input" data-city maxlength="32"
                               placeholder="${escapeHtml(c.phCity)}" />
                    </section>
                </div>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblEmail)}</p>
                    <input type="email" class="sdd-desk-input" data-email maxlength="200"
                           value="${escapeHtml(u.email || '')}" />
                </section>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblBio)}</p>
                    <input class="sdd-desk-input" data-bio maxlength="400"
                           placeholder="${escapeHtml(c.phBio)}" />
                </section>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblPitch)}</p>
                    <textarea class="sdd-desk-textarea" data-pitch maxlength="1500"
                              placeholder="${escapeHtml(c.phPitch)}"></textarea>
                    <p class="sdd-desk-count" data-count>0 / 1500</p>
                </section>

                <div class="sdd-desk-actions">
                    <button type="button" class="sdd-desk-btn" data-send>${escapeHtml(c.send)}</button>
                    <button type="button" class="sdd-desk-btn is-quiet" data-cancel>${escapeHtml(c.cancel)}</button>
                </div>
                <p class="sdd-desk-status" data-status></p>
            </div>
        `;
        const status = root.querySelector('[data-status]');
        const setStat = (m, k) => { status.className = 'sdd-desk-status ' + (k || ''); status.textContent = m || ''; };
        const pitch  = root.querySelector('[data-pitch]');
        const count  = root.querySelector('[data-count]');
        pitch.addEventListener('input', () => {
            const n = pitch.value.length;
            count.textContent = `${n} / 1500`;
            count.className = 'sdd-desk-count' + (n > 1500 ? ' is-over' : n > 1300 ? ' is-warn' : '');
        });
        root.querySelector('[data-close]').addEventListener('click', closeModal);
        root.querySelector('[data-cancel]').addEventListener('click', closeModal);
        root.querySelector('[data-send]').addEventListener('click', async () => {
            const name    = root.querySelector('[data-name]').value.trim();
            const city    = root.querySelector('[data-city]').value.trim();
            const email   = root.querySelector('[data-email]').value.trim();
            const bio     = root.querySelector('[data-bio]').value.trim();
            // Cadence kept default 'monthly' — most stringers pick this anyway.
            // We can re-introduce the choice later in the editor's onboarding flow.
            const cadence = 'monthly';
            const pitchTxt = pitch.value.trim();
            if (!name || !city) { setStat(c.tooShort, 'error'); return; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStat(c.badEmail, 'error'); return; }
            if (pitchTxt.length < 80) { setStat(c.tooShort, 'error'); return; }
            const base = (window.AURA_SERVER || '').replace(/\/$/, '');
            if (!base) { setStat(c.failClosed, 'error'); return; }
            try {
                setStat('…');
                const r = await fetch(base + '/desks/apply', {
                    method: 'POST',
                    headers: authHeaders(),
                    credentials: 'omit',
                    body: JSON.stringify({
                        display_name: name, city, email, bio,
                        application: pitchTxt, cadence, edition: ed
                    })
                });
                const j = await r.json().catch(() => null);
                if (!r.ok || !j || !j.ok) { setStat((j && j.error) || c.err, 'error'); return; }
                setStat(c.ok, 'ok');
                setTimeout(closeModal, 1800);
            } catch (e) { setStat(c.err, 'error'); }
        });
        root.classList.add('active');
    }

    // ─── Submit modal (signed-in stringers) ──────────────────────────────
    function copySubmit(lang) {
        return {
            title:    L({ en: 'File a dispatch.', ko: 'dispatch 보내기.', ja: 'ディスパッチを送る。', pt: 'Enviar um despacho.', es: 'Enviar un despacho.' }, lang),
            lede:     L({
                en: 'Your post will be reviewed before publication. The masthead is one rust thread above your name; treat it gently.',
                ko: '게시 전에 편집장이 검토한다. 마스트헤드는 당신의 이름 위에 한 줄로 놓인다. 정중히 다루기를.',
                ja: '掲載前に編集長が確認する。マストヘッドは君の名前の上に一本の糸として置かれる。丁寧に扱うこと。',
                pt: 'O texto será revisto antes da publicação. O cabeçalho fica um fio acima do seu nome; trate-o com cuidado.',
                es: 'El texto será revisado antes de publicarse. La cabecera queda un hilo sobre su nombre; trátela con cuidado.'
            }, lang),
            close:    L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, lang),
            lblSlug:  L({ en: 'YOUR DESK', ko: '당신의 데스크', ja: 'あなたの席', pt: 'A SUA REDAÇÃO', es: 'SU MESA' }, lang),
            lblTitle: L({ en: 'TITLE', ko: '제목', ja: '見出し', pt: 'TÍTULO', es: 'TITULAR' }, lang),
            lblLede:  L({ en: 'LEDE (ITALIC)', ko: '레드 (이탤릭)', ja: 'リード（イタリック）', pt: 'LEDE (ITÁLICO)', es: 'ENTRADILLA (CURSIVA)' }, lang),
            lblBody:  L({ en: 'BODY', ko: '본문', ja: '本文', pt: 'CORPO', es: 'CUERPO' }, lang),
            lblQuote: L({ en: 'PULL QUOTE (OPTIONAL)', ko: '인용구 (선택)', ja: '引用（任意）', pt: 'CITAÇÃO (OPCIONAL)', es: 'CITA (OPCIONAL)' }, lang),
            lblQS:    L({ en: 'QUOTE SOURCE', ko: '인용 출처', ja: '引用元', pt: 'FONTE DA CITAÇÃO', es: 'FUENTE DE LA CITA' }, lang),
            lblSrc:   L({ en: 'SOURCE URL', ko: '출처 URL', ja: '出典URL', pt: 'URL FONTE', es: 'URL FUENTE' }, lang),
            lblAi:    L({ en: 'AI ASSISTED?', ko: 'AI 보조?', ja: 'AI使用？', pt: 'IA ASSISTIDA?', es: '¿IA ASISTIDA?' }, lang),
            lblMore:  L({ en: 'PULL QUOTE, SOURCE & DISCLOSURE (OPTIONAL)', ko: '인용 · 출처 · AI 고지 (선택)', ja: '引用・出典・開示（任意）', pt: 'CITAÇÃO, FONTE E DIVULGAÇÃO (OPCIONAL)', es: 'CITA, FUENTE Y AVISO (OPCIONAL)' }, lang),
            send:     L({ en: 'SEND TO QUEUE', ko: '큐로 보내기', ja: 'キューへ送る', pt: 'ENVIAR PARA FILA', es: 'ENVIAR A LA COLA' }, lang),
            cancel:   L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, lang),
            ok:       L({ en: 'Filed. The editor will read it before the next issue.', ko: '제출됨. 편집장이 다음 호 전에 읽는다.', ja: '提出。次号前に編集長が読む。', pt: 'Enviado. Leitura antes do próximo número.', es: 'Enviado. Se leerá antes del próximo número.' }, lang),
            tooShort: L({ en: 'Body too short. 200 characters minimum.', ko: '본문이 너무 짧다. 200자 이상.', ja: '本文が短い。二百字以上。', pt: 'Corpo demasiado curto.', es: 'Cuerpo demasiado corto.' }, lang),
            err:      L({ en: 'Could not send. Try again.', ko: '전송 실패.', ja: '送信失敗。', pt: 'Falha ao enviar.', es: 'Falló el envío.' }, lang),
            needAuth: L({ en: 'Sign in first.', ko: '먼저 로그인.', ja: '先にサインイン。', pt: 'Inicie sessão primeiro.', es: 'Inicie sesión primero.' }, lang)
        };
    }

    function openSubmit(opts) {
        opts = opts || {};
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c  = copySubmit(ed);
        if (!(window.SAUDADE_AUTH && window.SAUDADE_AUTH.isSignedIn && window.SAUDADE_AUTH.isSignedIn())) {
            // Punt to sign-in.
            if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.openModal) window.SAUDADE_AUTH.openModal();
            return;
        }
        const root = ensureModal();
        root.innerHTML = `
            <button type="button" class="sdd-desk-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-desk-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-desk-lede">${escapeHtml(c.lede)}</p>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblSlug)}</p>
                    <input class="sdd-desk-input" data-slug maxlength="40"
                           placeholder="seoul-park" value="${escapeHtml(opts.slug || '')}" />
                </section>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblTitle)}</p>
                    <input class="sdd-desk-input" data-title maxlength="120" />
                </section>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblLede)}</p>
                    <input class="sdd-desk-input" data-postlede maxlength="220" />
                </section>

                <section class="sdd-desk-section">
                    <p class="sdd-desk-label">${escapeHtml(c.lblBody)}</p>
                    <textarea class="sdd-desk-textarea" data-body maxlength="6000"></textarea>
                    <p class="sdd-desk-count" data-count>0 / 6000</p>
                </section>

                <details class="sdd-desk-section sdd-desk-details">
                    <summary>${escapeHtml(c.lblMore)}</summary>
                    <div class="sdd-desk-grid2" style="margin-top: 12px">
                        <section>
                            <p class="sdd-desk-label">${escapeHtml(c.lblQuote)}</p>
                            <input class="sdd-desk-input" data-quote maxlength="220" />
                        </section>
                        <section>
                            <p class="sdd-desk-label">${escapeHtml(c.lblQS)}</p>
                            <input class="sdd-desk-input" data-qsource maxlength="120" />
                        </section>
                    </div>
                    <section style="margin-top: 12px">
                        <p class="sdd-desk-label">${escapeHtml(c.lblSrc)}</p>
                        <input class="sdd-desk-input" data-source maxlength="400" />
                    </section>
                    <section style="margin-top: 12px">
                        <p class="sdd-desk-label">${escapeHtml(c.lblAi)}</p>
                        <select class="sdd-desk-select" data-ai>
                            <option value="0">No — written by hand</option>
                            <option value="1">Yes — AI-assisted (labelled per AI Act §50)</option>
                        </select>
                    </section>
                </details>

                <div class="sdd-desk-actions">
                    <button type="button" class="sdd-desk-btn" data-send>${escapeHtml(c.send)}</button>
                    <button type="button" class="sdd-desk-btn is-quiet" data-cancel>${escapeHtml(c.cancel)}</button>
                </div>
                <p class="sdd-desk-status" data-status></p>
            </div>
        `;
        const status = root.querySelector('[data-status]');
        const setStat = (m, k) => { status.className = 'sdd-desk-status ' + (k || ''); status.textContent = m || ''; };
        const bodyEl  = root.querySelector('[data-body]');
        const cnt     = root.querySelector('[data-count]');
        bodyEl.addEventListener('input', () => {
            const n = bodyEl.value.length;
            cnt.textContent = `${n} / 6000`;
            cnt.className = 'sdd-desk-count' + (n > 6000 ? ' is-over' : n > 5000 ? ' is-warn' : '');
        });
        root.querySelector('[data-close]').addEventListener('click', closeModal);
        root.querySelector('[data-cancel]').addEventListener('click', closeModal);
        root.querySelector('[data-send]').addEventListener('click', async () => {
            const slug    = root.querySelector('[data-slug]').value.trim();
            const title   = root.querySelector('[data-title]').value.trim();
            const lede    = root.querySelector('[data-postlede]').value.trim();
            const txt     = bodyEl.value.trim();
            const quote   = root.querySelector('[data-quote]').value.trim();
            const qsource = root.querySelector('[data-qsource]').value.trim();
            const source  = root.querySelector('[data-source]').value.trim();
            const ai      = root.querySelector('[data-ai]').value === '1';
            if (!slug || !title || txt.length < 200) { setStat(c.tooShort, 'error'); return; }
            const base = (window.AURA_SERVER || '').replace(/\/$/, '');
            if (!base) { setStat(c.err, 'error'); return; }
            try {
                setStat('…');
                const r = await fetch(base + '/desks/submit', {
                    method: 'POST',
                    headers: authHeaders(),
                    credentials: 'omit',
                    body: JSON.stringify({
                        slug, title, lede, body: txt,
                        quote, quote_source: qsource, source_url: source,
                        ai_assisted: ai
                    })
                });
                const j = await r.json().catch(() => null);
                if (!r.ok || !j || !j.ok) { setStat((j && j.error) || c.err, 'error'); return; }
                setStat(c.ok, 'ok');
                setTimeout(closeModal, 1800);
            } catch (e) { setStat(c.err, 'error'); }
        });
        root.classList.add('active');
    }

    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // ─── Index page renderer ─────────────────────────────────────────────
    async function renderIndex(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        const ed = (opts && opts.edition) || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c  = {
            title:  L({ en: 'The desks.', ko: '책상들.', ja: '席。', pt: 'As redações.', es: 'Las mesas.' }, ed),
            lede:   L({
                en: 'Stringers writing under the saudade masthead, one city each. Cadence varies — the editor invites slowly.',
                ko: '도시별 통신원이 saudade 마스트헤드 아래에서 쓴다. 주기는 데스크마다 다름 — 편집장은 천천히 초대한다.',
                ja: 'saudadeのマストヘッド下、都市ごとの通信員。頻度はデスク毎に異なる — 編集長はゆっくり招く。',
                pt: 'Correspondentes a escrever sob o cabeçalho da saudade, uma cidade por cada. A cadência varia — o editor convida devagar.',
                es: 'Corresponsales bajo la cabecera de saudade, una ciudad cada uno. La cadencia varía — el editor invita despacio.'
            }, ed),
            apply:  L({ en: 'Become a stringer →', ko: '통신원 지원 →', ja: '通信員に応募 →', pt: 'Candidatar-se →', es: 'Postular →' }, ed),
            none:   L({ en: 'No active desks yet. The first will be invited soon.', ko: '아직 활동 중인 데스크가 없다. 곧 첫 통신원이 초대된다.', ja: 'まだ稼働中のデスクはない。最初の通信員はまもなく。', pt: 'Ainda sem redações activas. A primeira será convidada em breve.', es: 'Aún sin mesas activas. La primera será invitada pronto.' }, ed),
            since:  L({ en: 'SINCE',  ko: '시작',  ja: '開始',  pt: 'DESDE',  es: 'DESDE' }, ed),
            last:   L({ en: 'LAST FILED', ko: '최근 dispatch', ja: '直近', pt: 'ÚLTIMO', es: 'ÚLTIMO' }, ed)
        };

        let desks = [];
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (base) {
            try {
                const r = await fetch(base + '/desks/list?edition=' + ed, { credentials: 'omit' });
                const j = await r.json().catch(() => null);
                if (r.ok && j && Array.isArray(j.desks)) desks = j.desks;
            } catch (e) {}
        }

        const list = desks.length ? `
            <ul class="sdd-desks-list">
                ${desks.map(d => `
                    <li class="sdd-desks-row">
                        <div>
                            <a class="sdd-desks-name" href="/desks/${escapeHtml(d.slug)}">${escapeHtml(d.display_name)}</a>
                            ${d.bio ? `<p class="sdd-desks-bio">${escapeHtml(d.bio)}</p>` : ''}
                        </div>
                        <p class="sdd-desks-meta">
                            <span class="city">${escapeHtml(d.city || '—')}</span>
                            <span>${escapeHtml(c.last)} ${escapeHtml(fmtDate(d.last_post_at))}</span>
                        </p>
                    </li>
                `).join('')}
            </ul>
        ` : `<p class="sdd-desks-empty">${escapeHtml(c.none)}</p>`;

        host.innerHTML = `
            <section class="sdd-desks-index">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-desk-lede" style="margin-bottom: 28px">${escapeHtml(c.lede)}</p>
                ${list}
                <p style="margin-top: 28px">
                    <a href="#desk-apply" class="sdd-desk-btn" style="display:inline-block; max-width:280px;">${escapeHtml(c.apply)}</a>
                </p>
            </section>
        `;
    }

    // Hash triggers.
    function handleHash() {
        if (location.hash === '#desk-apply') {
            openApply();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        } else if (location.hash === '#desk-submit') {
            openSubmit();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_DESKS = { openApply, openSubmit, closeModal, renderIndex };
})();

/* ── saudade-contribute.js ──────────────────────────────────────────────────── */
// saudade · contribute UI (cafe submit + city request)
//
// Two small forms wrapped into a single module since they share the same
// modal scaffolding and the same submission shape. Both endpoints already
// exist in the worker; the front-ends were promised earlier and hadn't
// been built. This is them.
//
// API:
//   window.SAUDADE_CONTRIBUTE.openCafe()       → submit a café (Atlas)
//   window.SAUDADE_CONTRIBUTE.openCity()       → request a new city desk
// Hashes:
//   #cafe-submit   #city-request
'use strict';

(function () {
    if (window.SAUDADE_CONTRIBUTE) return;

    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }
    function authH() {
        const h = { 'Content-Type': 'application/json' };
        if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.authHeaders) {
            Object.assign(h, window.SAUDADE_AUTH.authHeaders());
        }
        return h;
    }

    let _modal = null;
    function injectStyles() {
        if (document.getElementById('sddContribStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddContribStyles';
        s.textContent = `
.sdd-cb-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-cb-modal.active { display: flex; }
.sdd-cb-inner { width: 100%; max-width: 520px; }
.sdd-cb-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    letter-spacing: -0.02em; margin: 0 0 12px;
}
.sdd-cb-lede {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 14px; color: var(--bone-d); margin: 0 0 24px; max-width: 48ch;
}
.sdd-cb-section { border-top: 0.5px solid var(--rule); padding: 16px 0; }
.sdd-cb-label { font-family: var(--mono); font-weight: 500; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d); margin: 0 0 6px; }
.sdd-cb-input, .sdd-cb-textarea {
    width: 100%; box-sizing: border-box;
    background: transparent; color: var(--ink);
    font-family: var(--serif); font-weight: 300; font-size: 16px;
    border: 0; border-bottom: 0.5px solid var(--rule);
    padding: 6px 0; outline: none; border-radius: 0;
}
.sdd-cb-textarea { min-height: 100px; border: 0.5px solid var(--rule); padding: 12px; line-height: 1.6; }
.sdd-cb-input:focus, .sdd-cb-textarea:focus { border-bottom-color: var(--ink); }
.sdd-cb-actions { display: flex; flex-direction: column; border-top: 0.5px solid var(--rule); margin-top: 12px; }
.sdd-cb-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 16px 4px; cursor: pointer;
    text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-cb-btn:hover { color: var(--rust); }
.sdd-cb-btn.is-quiet { color: var(--bone-d); }
.sdd-cb-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    padding: 12px 0; color: var(--bone-d);
    min-height: 1em; margin-top: 12px;
    border-top: 0.5px solid var(--rule);
}
.sdd-cb-status.ok    { color: var(--ink); }
.sdd-cb-status.error { color: var(--rust); }
.sdd-cb-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-cb-close:hover { color: var(--rust); }
        `;
        document.head.appendChild(s);
    }

    function ensureModal() {
        if (_modal) return _modal;
        injectStyles();
        _modal = document.createElement('div');
        _modal.className = 'sdd-cb-modal';
        _modal.setAttribute('role', 'dialog');
        _modal.setAttribute('aria-modal', 'true');
        document.body.appendChild(_modal);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
        });
        return _modal;
    }
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // ─── Cafe submit ────────────────────────────────────────────────────
    function openCafe() {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c = {
            title: L({ en: 'Suggest a café.', ko: '카페를 제안.', ja: 'カフェを提案。', pt: 'Sugerir um café.', es: 'Sugerir un café.' }, ed),
            lede:  L({ en: 'Tell the editor about a place worth visiting. We test outlets, noise, and Wi-Fi ourselves before listing.', ko: '들렀으면 하는 곳을 알려주라. 콘센트·소음·와이파이는 우리가 직접 시험한 뒤에야 목록에 오른다.', ja: '訪ねる価値のある場所を教えてほしい。コンセント・騒音・Wi-Fi を自分たちで試した上で掲載する。', pt: 'Conte ao editor de um lugar que vale a pena. Testamos tomadas, ruído e Wi-Fi antes de listar.', es: 'Cuente al editor de un lugar que valga la pena. Probamos enchufes, ruido y Wi-Fi antes de listar.' }, ed),
            close: L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, ed),
            lblName: L({ en: 'CAFÉ NAME', ko: '카페 이름', ja: 'カフェ名', pt: 'NOME DO CAFÉ', es: 'NOMBRE DEL CAFÉ' }, ed),
            lblNeigh: L({ en: 'NEIGHBOURHOOD / CITY', ko: '동네 / 도시', ja: '地区 / 都市', pt: 'BAIRRO / CIDADE', es: 'BARRIO / CIUDAD' }, ed),
            lblNotes: L({ en: 'WHY IT IS WORTH A VISIT', ko: '왜 가볼 만한가', ja: '訪ねる価値の理由', pt: 'PORQUE VALE A VISITA', es: 'POR QUÉ VALE LA VISITA' }, ed),
            phNotes: L({ en: 'Outlets per table, noise, Wi-Fi, hours, anything else.', ko: '테이블당 콘센트, 소음, 와이파이, 영업시간, 그 외.', ja: 'テーブル毎のコンセント、騒音、Wi-Fi、時間、その他。', pt: 'Tomadas, ruído, Wi-Fi, horas, qualquer outra coisa.', es: 'Enchufes, ruido, Wi-Fi, horas, cualquier otra cosa.' }, ed),
            send:  L({ en: 'SEND TO EDITOR', ko: '편집장에게 보내기', ja: '編集長へ送る', pt: 'ENVIAR AO EDITOR', es: 'ENVIAR AL EDITOR' }, ed),
            cancel: L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, ed),
            ok: L({ en: 'Suggestion received. The editor will visit before listing.', ko: '제안이 도착했다. 등록 전에 편집장이 직접 가본다.', ja: '提案を受け取った。掲載前に編集長が訪ねる。', pt: 'Sugestão recebida. O editor visitará antes de listar.', es: 'Sugerencia recibida. El editor visitará antes de listar.' }, ed),
            err: L({ en: 'Could not send. Try again.', ko: '전송 실패.', ja: '送信失敗。', pt: 'Falha ao enviar.', es: 'Falló el envío.' }, ed)
        };
        ensureModal().innerHTML = `
            <button type="button" class="sdd-cb-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-cb-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-cb-lede">${escapeHtml(c.lede)}</p>
                <section class="sdd-cb-section">
                    <p class="sdd-cb-label">${escapeHtml(c.lblName)}</p>
                    <input class="sdd-cb-input" data-name maxlength="80" />
                </section>
                <section class="sdd-cb-section">
                    <p class="sdd-cb-label">${escapeHtml(c.lblNeigh)}</p>
                    <input class="sdd-cb-input" data-neigh maxlength="80" />
                </section>
                <section class="sdd-cb-section">
                    <p class="sdd-cb-label">${escapeHtml(c.lblNotes)}</p>
                    <textarea class="sdd-cb-textarea" data-notes maxlength="800"
                              placeholder="${escapeHtml(c.phNotes)}"></textarea>
                </section>
                <div class="sdd-cb-actions">
                    <button type="button" class="sdd-cb-btn" data-send>${escapeHtml(c.send)}</button>
                    <button type="button" class="sdd-cb-btn is-quiet" data-cancel>${escapeHtml(c.cancel)}</button>
                </div>
                <p class="sdd-cb-status" data-status></p>
            </div>
        `;
        wire('cafe', c);
        _modal.classList.add('active');
    }

    // ─── City request ───────────────────────────────────────────────────
    function openCity() {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        const c = {
            title: L({ en: 'Ask the desk to open in a city.', ko: '데스크를 열어달라고 요청.', ja: 'デスクを開くよう要請。', pt: 'Pedir uma redação numa cidade.', es: 'Pedir una redacción en una ciudad.' }, ed),
            lede:  L({ en: 'When 100 readers ask for a city, we open the desk. Tell us where you live, and what an editor in that city should be paying attention to.', ko: '100명의 독자가 한 도시를 요청하면 데스크를 연다. 어디에 사는지, 그곳의 편집자가 무엇에 주의를 기울여야 할지 알려달라.', ja: '百人の読者が一つの都市を求めれば、デスクを開く。どこに住み、その都市の編集者が何に注意すべきか教えてほしい。', pt: 'Quando 100 leitores pedirem uma cidade, abrimos a redação. Diga-nos onde vive, e a que um editor dessa cidade deveria prestar atenção.', es: 'Cuando 100 lectores piden una ciudad, abrimos la redacción. Cuéntenos dónde vive, y a qué debería prestar atención un editor allí.' }, ed),
            close: L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, ed),
            lblCity: L({ en: 'CITY', ko: '도시', ja: '都市', pt: 'CIDADE', es: 'CIUDAD' }, ed),
            phCity:  L({ en: 'mexico-city, hanoi, marrakech, …', ko: 'mexico-city, hanoi, marrakech, …', ja: 'mexico-city, hanoi, marrakech, …', pt: 'mexico-city, hanoi, marrakech, …', es: 'mexico-city, hanoi, marrakech, …' }, ed),
            lblWhy: L({ en: 'WHY THIS CITY (OPTIONAL)', ko: '왜 이 도시인가 (선택)', ja: 'なぜこの都市か（任意）', pt: 'PORQUÊ ESTA CIDADE (OPCIONAL)', es: 'POR QUÉ ESTA CIUDAD (OPCIONAL)' }, ed),
            send: L({ en: 'SEND', ko: '보내기', ja: '送る', pt: 'ENVIAR', es: 'ENVIAR' }, ed),
            cancel: L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, ed),
            ok: L({ en: 'Recorded. We open a desk when 100 readers ask.', ko: '기록됨. 100명이 요청하면 데스크를 연다.', ja: '記録した。百人が求めればデスクを開く。', pt: 'Registado. Abrimos uma redação quando 100 leitores pedem.', es: 'Registrado. Abrimos una redacción cuando 100 lectores piden.' }, ed),
            err: L({ en: 'Could not send.', ko: '전송 실패.', ja: '送信失敗。', pt: 'Falha ao enviar.', es: 'Falló el envío.' }, ed),
            tooShort: L({ en: 'City required.', ko: '도시명을 입력하라.', ja: '都市が必要。', pt: 'Cidade obrigatória.', es: 'Ciudad obligatoria.' }, ed)
        };
        ensureModal().innerHTML = `
            <button type="button" class="sdd-cb-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-cb-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <p class="sdd-cb-lede">${escapeHtml(c.lede)}</p>
                <section class="sdd-cb-section">
                    <p class="sdd-cb-label">${escapeHtml(c.lblCity)}</p>
                    <input class="sdd-cb-input" data-city maxlength="64"
                           placeholder="${escapeHtml(c.phCity)}" />
                </section>
                <section class="sdd-cb-section">
                    <p class="sdd-cb-label">${escapeHtml(c.lblWhy)}</p>
                    <textarea class="sdd-cb-textarea" data-why maxlength="500"></textarea>
                </section>
                <div class="sdd-cb-actions">
                    <button type="button" class="sdd-cb-btn" data-send>${escapeHtml(c.send)}</button>
                    <button type="button" class="sdd-cb-btn is-quiet" data-cancel>${escapeHtml(c.cancel)}</button>
                </div>
                <p class="sdd-cb-status" data-status></p>
            </div>
        `;
        wire('city', c);
        _modal.classList.add('active');
    }

    function wire(kind, c) {
        const status = _modal.querySelector('[data-status]');
        const setStat = (m, k) => { status.className = 'sdd-cb-status ' + (k || ''); status.textContent = m || ''; };
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
        _modal.querySelector('[data-send]').addEventListener('click', async () => {
            const base = (window.AURA_SERVER || '').replace(/\/$/, '');
            if (!base) { setStat(c.err, 'error'); return; }
            try {
                setStat('…');
                let url, body;
                if (kind === 'cafe') {
                    const name  = _modal.querySelector('[data-name]').value.trim();
                    const neigh = _modal.querySelector('[data-neigh]').value.trim();
                    const notes = _modal.querySelector('[data-notes]').value.trim();
                    if (!name || !neigh) { setStat(c.tooShort || c.err, 'error'); return; }
                    url = base + '/cafe/submit';
                    body = JSON.stringify({ name, neighborhood: neigh, notes });
                } else {
                    const city = _modal.querySelector('[data-city]').value.trim().toLowerCase();
                    const why  = _modal.querySelector('[data-why]').value.trim();
                    if (!city) { setStat(c.tooShort, 'error'); return; }
                    const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
                    url = base + '/city/request';
                    body = JSON.stringify({ requested_city: city, why, edition: ed });
                }
                const r = await fetch(url, { method: 'POST', headers: authH(), credentials: 'omit', body });
                const j = await r.json().catch(() => null);
                if (!r.ok || !j || (j.error && !j.ok)) { setStat((j && j.error) || c.err, 'error'); return; }
                setStat(c.ok, 'ok');
                setTimeout(closeModal, 1600);
            } catch (e) { setStat(c.err, 'error'); }
        });
    }

    function handleHash() {
        if (location.hash === '#cafe-submit') {
            openCafe();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        } else if (location.hash === '#city-request') {
            openCity();
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_CONTRIBUTE = { openCafe, openCity, closeModal };
})();

/* ── saudade-focus.js ──────────────────────────────────────────────────── */
// saudade · modal focus trap (a11y)
//
// Watches every saudade modal class. When a modal becomes .active:
//   • record the previously-focused element
//   • move focus into the modal (first tabbable)
//   • intercept Tab / Shift+Tab so focus stays inside
// When the modal closes (.active removed) restore focus to the original.
//
// Selectors covered: every saudade-* modal class. New modals just need a
// .sdd-*-modal class with the .active toggle to opt in.
'use strict';

(function () {
    if (window.SAUDADE_FOCUS) return;

    const MODAL_SELECTOR = [
        '.sdd-auth-modal', '.sdd-acct-modal', '.sdd-welcome',
        '.sdd-homes-modal', '.sdd-let-modal', '.sdd-desk-modal',
        '.sdd-imp-modal', '.sdd-cb-modal'
    ].join(',');

    const TABBABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    let _previousFocus = null;
    let _activeModal = null;

    function tabbablesIn(el) {
        return Array.from(el.querySelectorAll(TABBABLE))
            .filter(n => n.offsetParent !== null || n === document.activeElement);
    }

    function trapHandler(e) {
        if (e.key !== 'Tab' || !_activeModal) return;
        const tabs = tabbablesIn(_activeModal);
        if (!tabs.length) { e.preventDefault(); return; }
        const first = tabs[0];
        const last  = tabs[tabs.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first || !_activeModal.contains(document.activeElement)) {
                e.preventDefault(); last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        }
    }

    function watch() {
        // Use a MutationObserver to detect class="active" toggles on any modal.
        const observer = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
                const el = m.target;
                if (!el.matches(MODAL_SELECTOR)) continue;
                if (el.classList.contains('active')) {
                    if (_activeModal !== el) onOpen(el);
                } else if (_activeModal === el) {
                    onClose();
                }
            }
        });
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

        // Also catch modals that were already .active on first paint (rare).
        document.querySelectorAll(MODAL_SELECTOR + '.active').forEach(onOpen);

        document.addEventListener('keydown', trapHandler);
    }

    function onOpen(el) {
        _previousFocus = document.activeElement;
        _activeModal = el;
        const tabs = tabbablesIn(el);
        // Prefer the first non-close button so a destructive close doesn't get
        // auto-focused; fall back to whatever is tabbable.
        const target = tabs.find(t => !/(\bclose\b|\bcancel\b|\bskip\b)/i.test(t.className + ' ' + (t.textContent || '')))
                    || tabs[0] || el;
        try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (ee) {} }
    }
    function onClose() {
        _activeModal = null;
        if (_previousFocus && typeof _previousFocus.focus === 'function') {
            try { _previousFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _previousFocus = null;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();

    window.SAUDADE_FOCUS = { _activeModal: () => _activeModal };
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

.sdd-footer-r .sdd-footer-copy,
.sdd-footer-r .sdd-footer-link {
    color: inherit;
    text-decoration: none;
    border-bottom: 0.5px solid transparent;
    transition: color .15s, border-color .15s;
}
.sdd-footer-r .sdd-footer-copy:hover,
.sdd-footer-r .sdd-footer-link:hover {
    color: var(--rust);
    border-bottom-color: var(--rust);
}
.sdd-footer-r .sdd-footer-link {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--bone-d);
    margin-right: 16px;
}
@media (max-width: 540px) {
    .sdd-footer-r .sdd-footer-link { display: none; }
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
                <a class="sdd-footer-link" href="/issues/" title="every issue we have filed">ARCHIVE</a>
                <a class="sdd-footer-link" href="desks.html" title="stringers writing under the saudade masthead">DESKS</a>
                <a class="sdd-footer-link" href="#letter" title="write a letter to the editor">LETTER</a>
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
