// SAUDADE · § 02 ATLAS — Cafe Submission Form (v7 §8.9)
// PR5 — 사용자 카페 제출 → D1 → 분기 검수.
// "Submit a café" 링크 (atlas footer) → 모달 → POST /cafe/submit.
'use strict';

// IIFE — 로드 즉시 실행. "카페 제보" 모달을 담당하는 독립 모듈.
(function() {
    // 중복 로드 방어.
    if (window.SAUDADE_ATLAS_SUBMIT) return;

    // 제보 모달 DOM. 한 번 만들면 재사용(ensureModal 이 캐시).
    let _modalEl = null;

    // 현재 에디션 언어에 맞는 문구를 고른다(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function copy() {
        return {
            triggerLabel: L({
                en: 'SUBMIT A CAFÉ →', ko: '카페 제출 →', ja: 'カフェを推薦する →',
                pt: 'PROPOR UM CAFÉ →', es: 'PROPONER UN CAFÉ →'
            }),
            modalLabel: L({
                en: 'Submit a café.',  ko: '카페 제출.',  ja: 'カフェの推薦。',
                pt: 'Propor um café.', es: 'Proponer un café.'
            }),
            modalIntro: L({
                en: 'A few lines for the editor. We review submissions at the end of each quarter. We accept no payment for inclusion.',
                ko: '편집장에게 몇 줄. 매 분기 말 검수. 입점료는 받지 않는다.',
                ja: '編集長へ数行。四半期末に検討。掲載料は受け取らない。',
                pt: 'Algumas linhas para o editor. Revisamos no fim de cada trimestre. Não aceitamos pagamento.',
                es: 'Unas líneas para el editor. Revisamos al final de cada trimestre. No aceptamos pago.'
            }),
            fName:    L({ en: 'CAFÉ NAME',     ko: '카페 이름',  ja: 'カフェ名',     pt: 'NOME DO CAFÉ',  es: 'NOMBRE DEL CAFÉ' }),
            fCity:    L({ en: 'CITY',          ko: '도시',        ja: '都市',         pt: 'CIDADE',        es: 'CIUDAD' }),
            fNeigh:   L({ en: 'NEIGHBORHOOD',  ko: '동네',        ja: '街',           pt: 'BAIRRO',        es: 'BARRIO' }),
            fNote:    L({ en: 'A SHORT NOTE',  ko: '짧은 메모',  ja: '短い覚書',     pt: 'BREVE NOTA',    es: 'NOTA BREVE' }),
            fEmail:   L({ en: 'EMAIL (optional)', ko: '이메일 (선택)', ja: 'メール (任意)', pt: 'EMAIL (opcional)', es: 'CORREO (opcional)' }),
            btnSubmit: L({ en: 'SUBMIT',  ko: '제출',  ja: '送信',  pt: 'ENVIAR',   es: 'ENVIAR' }),
            btnCancel: L({ en: 'CANCEL',  ko: '취소',  ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }),
            success: L({
                en: 'Submitted, queued for next issue.',
                ko: '제출됐다. 다음 호에 검토한다.',
                ja: '受け付けた。次号で検討する。',
                pt: 'Enviado, em fila para a próxima edição.',
                es: 'Enviado, en cola para la próxima edición.'
            }),
            failGeneric: L({
                en: 'Could not submit. Please try again.',
                ko: '제출 실패. 다시 시도 바람.',
                ja: '送信できなかった。再度お試しを。',
                pt: 'Não foi possível enviar. Tente novamente.',
                es: 'No se pudo enviar. Inténtalo de nuevo.'
            }),
            failClosed: L({
                en: 'Submissions are not yet open. Try again later.',
                ko: '아직 제출 창구가 열리지 않았다. 나중에 다시 시도 바람.',
                ja: '投稿窓口はまだ開いていない。後ほど再度どうぞ。',
                pt: 'O envio ainda não está aberto. Tente mais tarde.',
                es: 'Aún no está abierto. Inténtalo más tarde.'
            })
        };
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function injectStyles() {
        if (document.getElementById('sddCafeSubmitStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCafeSubmitStyles';
        s.textContent = `
.sdd-atlas-submit-link {
    display: inline-block;
    margin-top: clamp(20px, 3vw, 28px);
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 6px 0;
    border-radius: 0;
}
.sdd-atlas-submit-link:hover  { color: var(--rust); border-bottom-color: var(--rust); }
.sdd-atlas-submit-link:focus  { outline: 1px dotted var(--ink); outline-offset: 2px; }

.sdd-cafe-submit-modal {
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
.sdd-cafe-submit-modal.active { display: flex; }
.sdd-cafe-submit-inner { max-width: 520px; width: 100%; }
.sdd-cafe-submit-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--rust);
    margin: 0 0 clamp(20px, 3vw, 28px);
    padding-bottom: clamp(12px, 2vw, 16px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-cafe-submit-intro {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    line-height: 1.55;
    color: var(--bone-d);
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-cafe-submit-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-cafe-submit-field:first-of-type { border-top: 0; }
.sdd-cafe-submit-field label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-cafe-submit-field input,
.sdd-cafe-submit-field textarea {
    background: transparent;
    border: 0;
    border-bottom: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--serif);
    font-weight: 300;
    font-size: 16px;
    line-height: 1.5;
    padding: 6px 0;
    border-radius: 0;
    min-height: 36px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
}
.sdd-cafe-submit-field input:focus,
.sdd-cafe-submit-field textarea:focus { border-bottom-color: var(--ink); }
.sdd-cafe-submit-actions {
    display: flex;
    gap: 0;
    margin-top: clamp(20px, 3vw, 28px);
    border-top: 0.5px solid var(--rule);
}
.sdd-cafe-submit-btn {
    flex: 1;
    background: transparent;
    border: 0;
    border-right: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    padding: 18px 4px;
    text-align: left;
    border-radius: 0;
    min-height: 44px;
    transition: color .12s, background .12s;
}
.sdd-cafe-submit-btn:last-child { border-right: 0; }
.sdd-cafe-submit-btn:hover  { color: var(--rust); background: var(--paper-d); }
.sdd-cafe-submit-btn.ghost  { color: var(--bone-d); font-weight: 400; }
.sdd-cafe-submit-status {
    margin-top: clamp(20px, 3vw, 28px);
    padding-top: clamp(12px, 2vw, 16px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    display: none;
}
.sdd-cafe-submit-status.active { display: block; }
.sdd-cafe-submit-status.error  { color: var(--rust); }
.sdd-cafe-submit-status.ok     { color: var(--ink); }

@media print {
    .sdd-atlas-submit-link, .sdd-cafe-submit-modal { display: none !important; }
}
        `;
        document.head.appendChild(s);
    }

    function ensureModal() {
        if (_modalEl) return _modalEl;
        const c = copy();
        _modalEl = document.createElement('div');
        _modalEl.className = 'sdd-cafe-submit-modal';
        _modalEl.setAttribute('role', 'dialog');
        _modalEl.setAttribute('aria-modal', 'true');
        _modalEl.innerHTML = `
            <form class="sdd-cafe-submit-inner" data-submit-form>
                <p class="sdd-cafe-submit-label" data-label>${escapeHtml(c.modalLabel)}</p>
                <p class="sdd-cafe-submit-intro" data-intro>${escapeHtml(c.modalIntro)}</p>
                <div class="sdd-cafe-submit-field">
                    <label for="sddCsName"  data-l-name>${escapeHtml(c.fName)}</label>
                    <input id="sddCsName"  name="name"  type="text" required maxlength="200" autocomplete="off" />
                </div>
                <div class="sdd-cafe-submit-field">
                    <label for="sddCsCity" data-l-city>${escapeHtml(c.fCity)}</label>
                    <input id="sddCsCity" name="city" type="text" required maxlength="100" autocomplete="off" />
                </div>
                <div class="sdd-cafe-submit-field">
                    <label for="sddCsNeigh" data-l-neigh>${escapeHtml(c.fNeigh)}</label>
                    <input id="sddCsNeigh" name="neighborhood" type="text" maxlength="100" autocomplete="off" />
                </div>
                <div class="sdd-cafe-submit-field">
                    <label for="sddCsNote" data-l-note>${escapeHtml(c.fNote)}</label>
                    <textarea id="sddCsNote" name="note" rows="3" maxlength="500"></textarea>
                </div>
                <div class="sdd-cafe-submit-field">
                    <label for="sddCsEmail" data-l-email>${escapeHtml(c.fEmail)}</label>
                    <input id="sddCsEmail" name="submitter" type="email" maxlength="200" autocomplete="email" />
                </div>
                <div class="sdd-cafe-submit-actions">
                    <button type="button" class="sdd-cafe-submit-btn ghost" data-cancel>${escapeHtml(c.btnCancel)}</button>
                    <button type="submit" class="sdd-cafe-submit-btn"        data-submit>${escapeHtml(c.btnSubmit)}</button>
                </div>
                <p class="sdd-cafe-submit-status" data-status></p>
            </form>
        `;
        document.body.appendChild(_modalEl);
        _modalEl.querySelector('[data-cancel]').addEventListener('click', closeModal);
        _modalEl.querySelector('[data-submit-form]').addEventListener('submit', onSubmit);
        // ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _modalEl.classList.contains('active')) closeModal();
        });
        return _modalEl;
    }

    function openModal() {
        ensureModal().classList.add('active');
        // reset 상태
        const status = _modalEl.querySelector('[data-status]');
        status.classList.remove('active', 'error', 'ok');
        status.textContent = '';
        // 첫 input focus
        const first = _modalEl.querySelector('input[name="name"]');
        if (first) setTimeout(() => first.focus(), 50);
    }
    function closeModal() {
        if (_modalEl) _modalEl.classList.remove('active');
    }

    async function onSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const status = _modalEl.querySelector('[data-status]');
        const submitBtn = _modalEl.querySelector('[data-submit]');
        submitBtn.disabled = true;
        status.classList.remove('error', 'ok');
        status.classList.add('active');
        status.textContent = '...';

        const c = copy();
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) {
            status.classList.add('error');
            status.textContent = c.failClosed;
            submitBtn.disabled = false;
            return;
        }

        const body = {
            name:         (fd.get('name')         || '').toString().trim(),
            city:         (fd.get('city')         || '').toString().trim(),
            neighborhood: (fd.get('neighborhood') || '').toString().trim() || null,
            note:         (fd.get('note')         || '').toString().trim() || null,
            submitter:    (fd.get('submitter')    || '').toString().trim() || null
        };

        try {
            const r = await fetch(base + '/cafe/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'omit'
            });
            const j = await r.json().catch(() => null);
            if (r.ok && j && j.ok) {
                status.classList.add('ok');
                status.textContent = c.success;
                form.reset();
                setTimeout(closeModal, 2400);
            } else if (r.status === 503) {
                status.classList.add('error');
                status.textContent = c.failClosed;
            } else {
                status.classList.add('error');
                status.textContent = c.failGeneric;
            }
        } catch (err) {
            status.classList.add('error');
            status.textContent = c.failGeneric;
        } finally {
            submitBtn.disabled = false;
        }
    }

    function ensureTriggerLink() {
        const atlas = document.getElementById('sddAtlas');
        if (!atlas) return;
        if (atlas.querySelector('.sdd-atlas-submit-link')) return;
        const note = atlas.querySelector('.sdd-atlas-note');
        const c = copy();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sdd-atlas-submit-link';
        btn.textContent = c.triggerLabel;
        btn.addEventListener('click', openModal);
        if (note) note.appendChild(btn);
        else atlas.appendChild(btn);
    }

    function watchAtlas() {
        const iv = setInterval(() => {
            if (document.getElementById('sddAtlas')) {
                ensureTriggerLink();
            }
        }, 500);
        // atlas 가 다시 렌더되면 link 도 재주입
        const mo = new MutationObserver(() => ensureTriggerLink());
        mo.observe(document.body, { attributes: true, childList: true, subtree: true,
                                     attributeFilter: ['data-section', 'data-edition'] });
    }

    function watchEdition() {
        const mo = new MutationObserver(() => {
            const c = copy();
            const link = document.querySelector('.sdd-atlas-submit-link');
            if (link) link.textContent = c.triggerLabel;
            if (_modalEl) {
                _modalEl.querySelector('[data-label]').textContent = c.modalLabel;
                _modalEl.querySelector('[data-intro]').textContent = c.modalIntro;
                _modalEl.querySelector('[data-l-name]').textContent  = c.fName;
                _modalEl.querySelector('[data-l-city]').textContent  = c.fCity;
                _modalEl.querySelector('[data-l-neigh]').textContent = c.fNeigh;
                _modalEl.querySelector('[data-l-note]').textContent  = c.fNote;
                _modalEl.querySelector('[data-l-email]').textContent = c.fEmail;
                _modalEl.querySelector('[data-cancel]').textContent  = c.btnCancel;
                _modalEl.querySelector('[data-submit]').textContent  = c.btnSubmit;
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-edition'] });
    }

    function init() {
        injectStyles();
        watchAtlas();
        watchEdition();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
    } else {
        setTimeout(init, 200);
    }

    window.SAUDADE_ATLAS_SUBMIT = { open: openModal, close: closeModal };
})();
