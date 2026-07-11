// saudade · tax-residency entry form
//
// Mirror of saudade-schengen-form.js. Lets the user type one row per stay
// in any country. Stays go to localStorage (saudade.tax.stays) and feed
// the saudade-tax 183-day counter live.
//
// API:
//   window.SAUDADE_TAX_FORM.mount(container, { lang? })
//   window.SAUDADE_TAX_FORM.getStays()
'use strict';

// IIFE — 로드 즉시 실행. 세금 거주일 입력 폼(국가별 입/출국)을 그리는 모듈.
// (참고: 현재는 saudade-stays-form.js 로 대체돼 번들에서 빠졌지만 소스는 남아 있음.)
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_TAX_FORM) return;
    // KEY — 세금 체류 기록 저장 localStorage 키.
    const KEY = 'saudade.tax.stays';

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
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
    // getStays/setStays — 세금 체류 기록 읽기/쓰기(깨져 있으면 빈 배열).
    function getStays() {
        try { const r = localStorage.getItem(KEY); if (!r) return []; const a = JSON.parse(r); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function setStays(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {} }

    // 60+ tax-relevant ISO countries — alpha-sorted, common nomad destinations first.
    const COUNTRIES = [
        'AE','AR','AT','AU','BE','BG','BR','CA','CH','CL','CN','CO','CY','CZ','DE','DK','EE','ES','FI','FR',
        'GB','GE','GR','HR','HU','ID','IE','IL','IN','IS','IT','JP','KH','KR','LT','LU','LV','MA','MT','MX',
        'MY','NL','NO','NZ','PA','PE','PH','PL','PT','RO','RS','SE','SG','SI','SK','TH','TR','UA','US','UY','VN','ZA'
    ];

    function copy(lang) {
        return {
            title:    L({ en: 'Your tax days, by country.', ko: '국가별 거주일.', ja: '国別税居住日。', pt: 'Os seus dias fiscais, por país.', es: 'Sus días fiscales, por país.' }, lang),
            help:     L({
                en: 'Type each entry and exit by country. The counter shows whole days inside each tax year.',
                ko: '국가별 입국·출국을 입력하라. 카운터가 각 과세년도의 일수를 보여준다.',
                ja: '国別の入国と出国を入力。カウンターが各税年度の日数を表示する。',
                pt: 'Adicione cada entrada e saída por país. O contador mostra dias por ano fiscal.',
                es: 'Añada cada entrada y salida por país. El contador muestra días por año fiscal.'
            }, lang),
            colCty:   L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            colIn:    L({ en: 'IN', ko: '입국', ja: '入国', pt: 'ENTRADA', es: 'ENTRADA' }, lang),
            colOut:   L({ en: 'OUT (or empty if still there)', ko: '출국 (현재 거주 중이면 비워두기)', ja: '出国 (居住中なら空欄)', pt: 'SAÍDA (vazio = ainda lá)', es: 'SALIDA (vacío = aún ahí)' }, lang),
            add:      L({ en: 'ADD ENTRY', ko: '기록 추가', ja: '入国を追加', pt: 'ADICIONAR', es: 'AÑADIR' }, lang),
            remove:   L({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }, lang),
            none:     L({ en: 'No entries yet.', ko: '아직 기록 없음.', ja: 'まだ記録なし。', pt: 'Sem registos.', es: 'Sin registros.' }, lang)
        };
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddTaxFormStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddTaxFormStyles';
        s.textContent = `
.sdd-taxf {
    border-top: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 28px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-taxf__h { font-family: var(--mono); font-weight: 500; font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); margin: 0 0 8px; }
.sdd-taxf__help { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 13px; color: var(--bone-d); margin: 0 0 16px; }
.sdd-taxf__cols, .sdd-taxf__row {
    display: grid; grid-template-columns: 0.6fr 1.1fr 1.1fr auto;
    gap: 8px; align-items: center;
}
.sdd-taxf__cols {
    font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); padding: 6px 0; border-bottom: 0.5px solid var(--rule);
}
.sdd-taxf__row { padding: 8px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-taxf__row input, .sdd-taxf__row select {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); font-family: var(--mono); font-size: 13px;
    letter-spacing: 0.04em; padding: 6px 0; min-height: 36px; width: 100%;
    box-sizing: border-box; outline: none; border-radius: 0;
}
.sdd-taxf__row input:focus, .sdd-taxf__row select:focus { border-bottom-color: var(--ink); }
.sdd-taxf__rm { background: transparent; border: 0; color: var(--bone-d); cursor: pointer;
    font-family: var(--serif); font-style: italic; font-size: 18px; line-height: 1; padding: 4px 8px; min-height: 36px; }
.sdd-taxf__rm:hover { color: var(--rust); }
.sdd-taxf__add {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-taxf__add:hover { color: var(--rust); }
.sdd-taxf__add::before { content: "+"; color: var(--rust); margin-right: 12px; font-family: var(--serif); font-style: italic; font-size: 18px; }
.sdd-taxf__none { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 14px; color: var(--bone-d); padding: 14px 0; border-bottom: 0.5px solid var(--rule); }
@media (max-width: 620px) {
    .sdd-taxf__cols, .sdd-taxf__row { grid-template-columns: 1fr 1fr; }
    .sdd-taxf__cols span:nth-child(3), .sdd-taxf__cols span:nth-child(4) { display: none; }
    .sdd-taxf__row { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; }
    .sdd-taxf__row .out { grid-column: 1 / 2; }
    .sdd-taxf__row .rm  { grid-column: 2 / 3; justify-self: end; }
}
        `;
        document.head.appendChild(s);
    }

    // row — 체류 한 줄(국가 select + 입/출국 date + 삭제 버튼) HTML.
    function row(s, i, c) {
        return `
            <div class="sdd-taxf__row" data-idx="${i}">
                <select data-field="country" class="country">
                    <option value="">—</option>
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  class="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" class="out" value="${escapeHtml(s.out || '')}" />
                <button type="button" class="sdd-taxf__rm rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }

    // paint — 폼을 그리고 추가/수정/삭제 핸들러를 건다. 변경 시 저장 + 계산기 재실행.
    function paint(host, lang) {
        const c = copy(lang);
        const stays = getStays();
        host.innerHTML = `
            <section class="sdd-taxf">
                <p class="sdd-taxf__h">${escapeHtml(c.title)}</p>
                <p class="sdd-taxf__help">${escapeHtml(c.help)}</p>
                <div class="sdd-taxf__cols">
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows>
                    ${stays.length ? stays.map((s, i) => row(s, i, c)).join('') : `<p class="sdd-taxf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-taxf__add" data-add>${escapeHtml(c.add)}</button>
            </section>
        `;
        host.querySelector('[data-add]').addEventListener('click', () => {
            setStays(getStays().concat([{ country: '', in: '', out: '' }]));
            paint(host, lang); renderCalc();
        });
        host.querySelectorAll('.sdd-taxf__row').forEach(rowEl => {
            const idx = +rowEl.dataset.idx;
            rowEl.querySelectorAll('[data-field]').forEach(input => {
                input.addEventListener('input', e => {
                    const cur = getStays(); cur[idx][input.dataset.field] = e.target.value; setStays(cur); renderCalc();
                });
                if (input.tagName === 'SELECT') {
                    input.addEventListener('change', e => {
                        const cur = getStays(); cur[idx].country = e.target.value; setStays(cur); renderCalc();
                    });
                }
            });
            rowEl.querySelector('[data-rm]').addEventListener('click', () => {
                const cur = getStays(); cur.splice(idx, 1); setStays(cur);
                paint(host, lang); renderCalc();
            });
        });
    }

    // renderCalc — 현재 입력으로 세금 183일 계산 패널을 다시 그린다(패널이 있을 때만).
    function renderCalc() {
        const panel = document.getElementById('sddTaxPanel');
        if (!panel || !window.SAUDADE_TAX) return;
        const stays = getStays().filter(s => s.country && s.in);
        window.SAUDADE_TAX.render(panel, { stays });
    }

    // mount — 폼을 host 에 장착: 스타일 주입 + 렌더 + 계산기 초기 실행.
    function mount(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        paint(host, opts && opts.lang);
        renderCalc();
    }

    // 전역 공개 API — 폼 장착 + 체류 목록 조회.
    window.SAUDADE_TAX_FORM = { mount, getStays };
})();
