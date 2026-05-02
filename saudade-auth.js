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

    const KEY_USER = 'saudade.auth.user';
    const KEY_TOUR = 'saudade.auth.tour';

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
                ko: '링크를 보냈다. 1분 안에 받은편지함 확인.',
                ja: 'リンクを送った。1分以内に受信箱を確認。',
                pt: 'Link enviado. Verifique a caixa em um minuto.',
                es: 'Enlace enviado. Revisa tu bandeja en un minuto.'
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
                ko: '전송 실패. 다시 시도 바람.',
                ja: '送信できなかった。再度お試しを。',
                pt: 'Não foi possível enviar. Tente novamente.',
                es: 'No se pudo enviar. Inténtalo de nuevo.'
            }),
            failClosed: L({
                en: 'Auth not yet open. Try again later.',
                ko: '아직 가입 창구가 열리지 않았다.',
                ja: '認証窓口はまだ開いていない。',
                pt: 'O registo ainda não está aberto.',
                es: 'El registro aún no está abierto.'
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
    z-index: 100;
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
                endTour();   // 가입 완료 → tour 모드 해제
            }
        } catch (e) {}
        // URL 정리 — token 파라미터 제거
        try {
            u.searchParams.delete('token');
            history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
        } catch (e) {}
    }

    function signOut() {
        setUser(null);
        endTour();
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
        isSignedIn,
        isTour,
        startTour,
        endTour
    };
})();
