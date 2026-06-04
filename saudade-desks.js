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
            title:    L({ en: 'File a dispatch.', ko: '디스패치 보내기.', ja: 'ディスパッチを送る。', pt: 'Enviar um despacho.', es: 'Enviar un despacho.' }, lang),
            lede:     L({
                en: 'Your post will be reviewed before publication. The masthead is one rust thread above your name; treat it gently.',
                ko: '게시 전에 편집장이 검토한다. 마스트헤드는 당신의 이름 위에 한 줄로 놓인다. 정중히 다루기를.',
                ja: '掲載前に編集長が確認する。マストヘッドは君の名前の上に一本の糸として置かれる。丁寧に扱うこと。',
                pt: 'O texto será revisto antes da publicação. O cabeçalho fica um fio acima do seu nome; trate-o com cuidado.',
                es: 'El texto será revisado antes de publicarse. La cabecera queda un hilo sobre su nombre; trátela con cuidado.'
            }, lang),
            close:    L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, lang),
            lblSlug:  L({ en: 'YOUR DESK', ko: '당신의 데스크', ja: 'あなたのデスク', pt: 'A SUA REDAÇÃO', es: 'SU REDACCIÓN' }, lang),
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
            title:  L({ en: 'The desks.', ko: '데스크.', ja: 'デスク。', pt: 'As redações.', es: 'Las redacciones.' }, ed),
            lede:   L({
                en: 'Stringers writing under the saudade masthead, one city each. Cadence varies — the editor invites slowly.',
                ko: '도시별 통신원이 saudade 마스트헤드 아래에서 쓴다. 주기는 데스크마다 다름 — 편집장은 천천히 초대한다.',
                ja: 'saudadeのマストヘッド下、都市ごとの通信員。頻度はデスク毎に異なる — 編集長はゆっくり招く。',
                pt: 'Correspondentes a escrever sob o cabeçalho da saudade, uma cidade por cada. A cadência varia — o editor convida devagar.',
                es: 'Corresponsales bajo la cabecera de saudade, una ciudad cada uno. La cadencia varía — el editor invita despacio.'
            }, ed),
            apply:  L({ en: 'Become a stringer →', ko: '통신원 지원 →', ja: '通信員に応募 →', pt: 'Candidatar-se →', es: 'Presentar candidatura →' }, ed),
            none:   L({ en: 'No active desks yet. The first will be invited soon.', ko: '아직 활동 중인 데스크가 없다. 곧 첫 통신원이 초대된다.', ja: 'まだ稼働中のデスクはない。最初の通信員はまもなく。', pt: 'Ainda sem redações activas. A primeira será convidada em breve.', es: 'Aún sin redacciones activas. La primera será invitada pronto.' }, ed),
            since:  L({ en: 'SINCE',  ko: '시작',  ja: '開始',  pt: 'DESDE',  es: 'DESDE' }, ed),
            last:   L({ en: 'LAST FILED', ko: '최근 디스패치', ja: '直近', pt: 'ÚLTIMO', es: 'ÚLTIMO' }, ed)
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
