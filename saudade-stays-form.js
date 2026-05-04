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
                ko: '한 줄에 한 체류. 같은 데이터로 셰겐 90/180 과 세금 183 을 함께 계산한다 — 두 번 입력하지 않아도 된다.',
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
            sch:     L({ en: 'SCHENGEN', ko: '셰겐', ja: 'シェンゲン', pt: 'SCHENGEN', es: 'SCHENGEN' }, lang),
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
        host.innerHTML = `
            <section class="sdd-stays">
                <p class="sdd-stays__h">${escapeHtml(c.title)}</p>
                <p class="sdd-stays__help">${escapeHtml(c.help)}</p>
                <div class="sdd-stays__cols">
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows>
                    ${stays.length ? stays.map((s, i) => row(s, i, c)).join('') : `<p class="sdd-stays__none">${escapeHtml(c.none)}</p>`}
                </div>
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
