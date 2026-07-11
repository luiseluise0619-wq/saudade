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

// IIFE — 로드 즉시 실행. "편집장에게 보내는 편지"(제출 모달 + 공개된 편지 목록) 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_LETTERS) return;

    // L — 여러 언어 문자열 중 현재 에디션 선택(없으면 영어).
    function L(strings, lang) {
        const ed = lang || (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // 제출 모달 DOM 캐시(한 번 만들어 재사용).
    let _modal = null;

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
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

    // copyM — 제출 모달의 모든 문구를 현재 언어로 묶어 반환.
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

    // ensureModal — 제출 모달 컨테이너를 한 번만 만들고 ESC 닫기를 건다(접근성).
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

    // openModal — 편지 작성 모달을 열고 입력/글자수/전송 핸들러를 건다.
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

        // 입력할 때마다 글자수를 갱신하고 700/800 근처에서 경고 색으로.
        bodyEl.addEventListener('input', () => {
            const n = bodyEl.value.length;
            countEl.textContent = `${n} / 800`;
            countEl.className = 'sdd-let-count' + (n > 800 ? ' is-over' : n > 700 ? ' is-warn' : '');
        });

        // 닫기/취소 버튼.
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
        // 전송 — 서명 분리 + 길이 검증 후 Worker 에 POST.
        _modal.querySelector('[data-send]').addEventListener('click', async () => {
            // Single 'Name, City' field — split on the last comma so names with
            // commas in them survive (e.g. "Lee, Jaejin, Lisbon").
            const sign = _modal.querySelector('[data-sign]').value.trim();
            const lastComma = sign.lastIndexOf(',');
            const name = lastComma > 0 ? sign.slice(0, lastComma).trim() : sign;
            const city = lastComma > 0 ? sign.slice(lastComma + 1).trim() : '';
            const body = bodyEl.value.trim();
            // 30~800자 범위를 벗어나면 전송하지 않고 안내.
            if (body.length < 30) { setStat(c.tooShort, 'error'); return; }
            if (body.length > 800) { setStat(c.tooLong,  'error'); return; }
            const base = (window.AURA_SERVER || '').replace(/\/$/, '');
            if (!base) { setStat(c.failClosed, 'error'); return; }
            try {
                setStat('…');
                // 로그인 상태면 인증 헤더를 함께 실어 편지에 사용자를 연결.
                const headers = { 'Content-Type': 'application/json' };
                if (window.SAUDADE_AUTH && window.SAUDADE_AUTH.authHeaders) {
                    Object.assign(headers, window.SAUDADE_AUTH.authHeaders());
                }
                // POST /letters/submit — 편지를 검수 큐에 넣는다(즉시 공개 아님).
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
    // closeModal — 모달을 숨긴다.
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // ─── Read-only block: published letters ──────────────────────────────
    // renderRecent — 같은 에디션에서 공개된 편지들을 읽기 전용 블록으로 그린다(async).
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

        // GET /letters/list — 에디션/디스패치별 공개 편지를 조회(서버 없으면 빈 목록).
        let letters = [];
        if (base) {
            try {
                // URLSearchParams 로 edition/limit/dispatch_ref 쿼리 파라미터를 안전하게 붙인다.
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

    // handleHash — URL 이 #letter 이면 작성 모달을 열고 해시를 지운다(딥링크 트리거).
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

    // 전역 공개 API — 모달 열기/닫기 + 공개 편지 목록 렌더.
    window.SAUDADE_LETTERS = { openModal, closeModal, renderRecent };
})();
