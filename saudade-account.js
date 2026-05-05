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
