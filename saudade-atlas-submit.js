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

    // copy — 모달에 쓰이는 모든 문구를 현재 에디션 언어로 한 번에 뽑아 객체로 돌려준다.
    // 각 항목마다 L(...) 로 5개 언어(en/ko/ja/pt/es) 중 하나를 고른다.
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

    // escapeHtml — 사용자 입력/문구를 innerHTML 에 넣기 전에 위험한 5글자를 이스케이프한다.
    // & < > " ' 를 각각 HTML 엔티티로 바꿔 XSS(스크립트 주입)를 막는다.
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // injectStyles — 이 모듈 전용 CSS 를 <style> 태그로 <head> 에 한 번만 주입한다.
    // 이미 주입돼 있으면(id 존재) 즉시 반환해 중복을 막는다.
    // 색/여백은 하드코딩 hex 대신 전역 CSS 변수(var(--paper) 등)를 사용한다.
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

    // ensureModal — 제보 모달 DOM 을 처음 한 번만 만들고 이후엔 캐시(_modalEl)를 재사용.
    // role="dialog" + aria-modal 로 스크린리더에 "모달 대화상자"임을 알린다(접근성).
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
        // 완성된 모달을 body 에 붙이고, 취소 버튼/폼 제출에 핸들러를 연결한다.
        document.body.appendChild(_modalEl);
        _modalEl.querySelector('[data-cancel]').addEventListener('click', closeModal);
        _modalEl.querySelector('[data-submit-form]').addEventListener('submit', onSubmit);
        // ESC 키를 누르고 모달이 열려 있으면(active) 닫는다 — 키보드 접근성.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && _modalEl.classList.contains('active')) closeModal();
        });
        return _modalEl;
    }

    // openModal — 모달을 만들고(.active) 화면에 띄운다.
    function openModal() {
        ensureModal().classList.add('active');
        // 이전에 남아 있던 상태 메시지(성공/실패)를 지워 깨끗한 상태로 연다.
        const status = _modalEl.querySelector('[data-status]');
        status.classList.remove('active', 'error', 'ok');
        status.textContent = '';
        // 첫 입력칸(카페 이름)에 포커스를 준다 — 살짝 지연(50ms)은 표시 애니메이션 뒤 포커스 안정화.
        const first = _modalEl.querySelector('input[name="name"]');
        if (first) setTimeout(() => first.focus(), 50);
    }
    // closeModal — .active 클래스를 떼서 모달을 숨긴다(display:none).
    function closeModal() {
        if (_modalEl) _modalEl.classList.remove('active');
    }

    // onSubmit — 폼 제출 핸들러(async). 입력값을 모아 Worker 의 /cafe/submit 로 POST 한다.
    async function onSubmit(e) {
        // 브라우저 기본 제출(페이지 새로고침)을 막는다 — SPA 답게 fetch 로 처리.
        e.preventDefault();
        const form = e.target;
        // FormData — 폼 안 name 속성별 입력값을 손쉽게 읽는 표준 API.
        const fd = new FormData(form);
        const status = _modalEl.querySelector('[data-status]');
        const submitBtn = _modalEl.querySelector('[data-submit]');
        // 중복 제출 방지: 전송 중엔 버튼을 잠그고 "..." 로딩 표시를 켠다.
        submitBtn.disabled = true;
        status.classList.remove('error', 'ok');
        status.classList.add('active');
        status.textContent = '...';

        const c = copy();
        // AURA_SERVER — Worker(백엔드) 베이스 URL. 끝의 슬래시를 제거해 경로를 붙이기 쉽게.
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        // 서버 주소가 없으면 아직 제출 창구가 닫힌 것 — 실패 안내 후 중단.
        if (!base) {
            status.classList.add('error');
            status.textContent = c.failClosed;
            submitBtn.disabled = false;
            return;
        }

        // 서버로 보낼 JSON 본문. 빈 선택 항목은 null 로 정규화한다(trim 으로 공백 제거).
        const body = {
            name:         (fd.get('name')         || '').toString().trim(),
            city:         (fd.get('city')         || '').toString().trim(),
            neighborhood: (fd.get('neighborhood') || '').toString().trim() || null,
            note:         (fd.get('note')         || '').toString().trim() || null,
            submitter:    (fd.get('submitter')    || '').toString().trim() || null
        };

        try {
            // POST /cafe/submit — 카페 제보를 D1(SQL) 큐에 넣는 요청.
            // credentials:'omit' — 쿠키/인증정보 없이 익명 제출(로그인 불필요).
            const r = await fetch(base + '/cafe/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'omit'
            });
            // 응답 JSON 파싱. 형식이 깨져도 앱이 죽지 않도록 catch 로 null 처리.
            const j = await r.json().catch(() => null);
            // 성공(2xx + ok:true): 성공 문구 → 폼 비우기 → 2.4초 뒤 자동 닫기.
            if (r.ok && j && j.ok) {
                status.classList.add('ok');
                status.textContent = c.success;
                form.reset();
                setTimeout(closeModal, 2400);
            // 503 Service Unavailable — 서버가 제출 창구를 일시적으로 닫은 상태.
            } else if (r.status === 503) {
                status.classList.add('error');
                status.textContent = c.failClosed;
            // 그 밖의 실패 — 일반 오류 안내.
            } else {
                status.classList.add('error');
                status.textContent = c.failGeneric;
            }
        // 네트워크 예외(오프라인 등)도 일반 오류로 안내.
        } catch (err) {
            status.classList.add('error');
            status.textContent = c.failGeneric;
        // 성공/실패와 무관하게 버튼 잠금을 반드시 해제(finally).
        } finally {
            submitBtn.disabled = false;
        }
    }

    // ensureTriggerLink — 아틀라스 섹션 안에 "카페 제출 →" 버튼을 한 번만 심는다.
    function ensureTriggerLink() {
        const atlas = document.getElementById('sddAtlas');
        // 아틀라스가 아직 없거나 버튼이 이미 있으면 아무것도 하지 않는다(중복 방지).
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

    // watchAtlas — 아틀라스 섹션이 나타날 때마다 제출 버튼을 보장한다.
    function watchAtlas() {
        // 0.5초마다 폴링: 아틀라스가 있으면 버튼을 심는다(초기 등장 대비).
        const iv = setInterval(() => {
            if (document.getElementById('sddAtlas')) {
                ensureTriggerLink();
            }
        }, 500);
        // MutationObserver — DOM 변화를 감시. 아틀라스가 다시 렌더되면 버튼을 재주입.
        const mo = new MutationObserver(() => ensureTriggerLink());
        mo.observe(document.body, { attributes: true, childList: true, subtree: true,
                                     attributeFilter: ['data-section', 'data-edition'] });
    }

    // watchEdition — 에디션(언어)이 바뀌면 버튼/모달 안 모든 문구를 새 언어로 갱신.
    function watchEdition() {
        // body 의 data-edition 속성 변화를 감시해 문구를 다시 채운다.
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

    // init — 모듈 시동: 스타일 주입 + 아틀라스/에디션 감시 시작.
    function init() {
        injectStyles();
        watchAtlas();
        watchEdition();
    }

    // 문서가 아직 로딩 중이면 DOMContentLoaded 후, 이미 끝났으면 바로 실행.
    // setTimeout 200ms — 다른 아틀라스 모듈이 먼저 그릴 시간을 준다.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
    } else {
        setTimeout(init, 200);
    }

    // 전역 노출 — 다른 모듈에서 모달을 열고/닫을 수 있게 공개 API 제공.
    window.SAUDADE_ATLAS_SUBMIT = { open: openModal, close: closeModal };
})();
