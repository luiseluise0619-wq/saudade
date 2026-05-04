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
    position: fixed; inset: 0; z-index: 9985;
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
            title: L({ en: 'Ask the desk to open in a city.', ko: '데스크를 열어달라고 요청.', ja: 'デスクを開くよう要請。', pt: 'Pedir uma redação numa cidade.', es: 'Pedir una mesa en una ciudad.' }, ed),
            lede:  L({ en: 'When 100 readers ask for a city, we open the desk. Tell us where you live, and what an editor in that city should be paying attention to.', ko: '100명의 독자가 한 도시를 요청하면 데스크를 연다. 어디에 사는지, 그곳의 편집자가 무엇에 주의를 기울여야 할지 알려달라.', ja: '百人の読者が一つの都市を求めれば、デスクを開く。どこに住み、その都市の編集者が何に注意すべきか教えてほしい。', pt: 'Quando 100 leitores pedirem uma cidade, abrimos a redação. Diga-nos onde vive, e a que um editor dessa cidade deveria prestar atenção.', es: 'Cuando 100 lectores piden una ciudad, abrimos la mesa. Cuéntenos dónde vive, y a qué debería prestar atención un editor allí.' }, ed),
            close: L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }, ed),
            lblCity: L({ en: 'CITY', ko: '도시', ja: '都市', pt: 'CIDADE', es: 'CIUDAD' }, ed),
            phCity:  L({ en: 'mexico-city, hanoi, marrakech, …', ko: 'mexico-city, hanoi, marrakech, …', ja: 'mexico-city, hanoi, marrakech, …', pt: 'mexico-city, hanoi, marrakech, …', es: 'mexico-city, hanoi, marrakech, …' }, ed),
            lblWhy: L({ en: 'WHY THIS CITY (OPTIONAL)', ko: '왜 이 도시인가 (선택)', ja: 'なぜこの都市か（任意）', pt: 'PORQUÊ ESTA CIDADE (OPCIONAL)', es: 'POR QUÉ ESTA CIUDAD (OPCIONAL)' }, ed),
            send: L({ en: 'SEND', ko: '보내기', ja: '送る', pt: 'ENVIAR', es: 'ENVIAR' }, ed),
            cancel: L({ en: 'CANCEL', ko: '취소', ja: 'キャンセル', pt: 'CANCELAR', es: 'CANCELAR' }, ed),
            ok: L({ en: 'Recorded. We open a desk when 100 readers ask.', ko: '기록됨. 100명이 요청하면 데스크를 연다.', ja: '記録した。百人が求めればデスクを開く。', pt: 'Registado. Abrimos uma redação quando 100 leitores pedem.', es: 'Registrado. Abrimos una mesa cuando 100 lectores piden.' }, ed),
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
