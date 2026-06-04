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
            title:    L({ en: 'Your Schengen log.', ko: '솅겐 입국 기록.', ja: 'シェンゲン入国記録。', pt: 'O seu registo Schengen.', es: 'Su registro Schengen.' }, lang),
            help:     L({
                en: 'Type each Schengen entry and exit. We never send this anywhere — it stays in your browser.',
                ko: '솅겐 입국과 출국을 한 줄씩 입력하라. 어디에도 전송하지 않는다 — 브라우저 안에만 머문다.',
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
