// saudade · stamp import / export
//
// Lets a power user import a year of travel from a CSV or JSON file, and
// export the same as backup. Recognised formats:
//
//   CSV with header row:     country,in,out
//                            PT,2026-01-08,2026-02-21
//
//   CSV without header:      first column ISO-2, then YYYY-MM-DD, YYYY-MM-DD
//
//   JSON:                    [{ country, in, out }, ...]
//                            { schengen: [...], tax: [...], insurance: [...], pension: [...] }
//
// On import the rows feed into:
//   • saudade.tax.stays      (always; tax is the superset)
//   • saudade.schengen.stays (rows whose country is in the Schengen 27)
//
// API:
//   window.SAUDADE_IMPORT.parseCSV(text)       → [{country,in,out}]
//   window.SAUDADE_IMPORT.parseJSON(text)      → object or array
//   window.SAUDADE_IMPORT.applyStays(rows)     → { added: n, schengen: n }
//   window.SAUDADE_IMPORT.exportAll()          → string (JSON dump of all 4 calc inputs)
//   window.SAUDADE_IMPORT.openModal()          → file picker UI
'use strict';

(function() {
    if (window.SAUDADE_IMPORT) return;

    const SCHENGEN_ISO = new Set([
        'AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','CH'
    ]);

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    // ─── Parsers ─────────────────────────────────────────────────────────
    function parseCSV(text) {
        if (!text) return [];
        // Strip BOM + normalise line endings.
        text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (!lines.length) return [];
        // Detect header.
        const first = lines[0].toLowerCase();
        const hasHeader = /country|iso|cca/.test(first) && /in|from|entry/.test(first);
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const rows = [];
        for (const line of dataLines) {
            const cols = line.split(/[,;\t]/).map(s => s.trim().replace(/^"(.*)"$/, '$1'));
            if (cols.length < 2) continue;
            const country = (cols[0] || '').toUpperCase().slice(0, 3);
            const ind = cols[1];
            const out = cols[2] || '';
            if (!country || !/^\d{4}-\d{2}-\d{2}$/.test(ind)) continue;
            rows.push({ country, in: ind, out: /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : '' });
        }
        return rows;
    }

    function parseJSON(text) {
        if (!text) return [];
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { return []; }
        if (Array.isArray(parsed)) {
            return parsed.filter(r => r && r.country && r.in)
                         .map(r => ({ country: String(r.country).toUpperCase().slice(0, 3),
                                      in: r.in, out: r.out || '' }));
        }
        if (parsed && typeof parsed === 'object') {
            // bundle form { tax: [...], schengen: [...] } — return tax as the superset.
            const list = parsed.tax || parsed.schengen || [];
            if (!Array.isArray(list)) return [];
            return list.filter(r => r && r.country && r.in)
                       .map(r => ({ country: String(r.country).toUpperCase().slice(0, 3),
                                    in: r.in, out: r.out || '' }));
        }
        return [];
    }

    function applyStays(rows) {
        if (!Array.isArray(rows) || !rows.length) return { added: 0, schengen: 0 };
        // Merge with existing tax stays (don't overwrite — append + dedupe by country+in+out).
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem('saudade.tax.stays') || '[]'); } catch (e) {}
        const seen = new Set(existing.map(r => `${r.country}|${r.in}|${r.out || ''}`));
        let added = 0;
        for (const r of rows) {
            const key = `${r.country}|${r.in}|${r.out || ''}`;
            if (seen.has(key)) continue;
            existing.push(r);
            seen.add(key);
            added++;
        }
        try { localStorage.setItem('saudade.tax.stays', JSON.stringify(existing)); } catch (e) {}

        // Schengen subset.
        const schengenSubset = rows.filter(r => SCHENGEN_ISO.has(r.country));
        let schExisting = [];
        try { schExisting = JSON.parse(localStorage.getItem('saudade.schengen.stays') || '[]'); } catch (e) {}
        const schSeen = new Set(schExisting.map(r => `${r.country}|${r.in}|${r.out || ''}`));
        let addedSch = 0;
        for (const r of schengenSubset) {
            const key = `${r.country}|${r.in}|${r.out || ''}`;
            if (schSeen.has(key)) continue;
            schExisting.push(r);
            schSeen.add(key);
            addedSch++;
        }
        try { localStorage.setItem('saudade.schengen.stays', JSON.stringify(schExisting)); } catch (e) {}

        // Trigger live re-render of any mounted form.
        if (window.SAUDADE_TAX_FORM)      remount('#sddTaxForm', window.SAUDADE_TAX_FORM);
        if (window.SAUDADE_SCHENGEN_FORM) remount('#sddSchForm', window.SAUDADE_SCHENGEN_FORM);

        return { added, schengen: addedSch };
    }
    function remount(sel, mod) {
        const host = document.querySelector(sel);
        if (host && mod && mod.mount) mod.mount(host);
    }

    function exportAll() {
        const out = {
            format: 'saudade.calc-stays.v1',
            generated_at: new Date().toISOString(),
            tax:       safeRead('saudade.tax.stays'),
            schengen:  safeRead('saudade.schengen.stays'),
            insurance: safeRead('saudade.insurance.policies'),
            pension:   safeRead('saudade.pension.filings')
        };
        return JSON.stringify(out, null, 2);
    }
    function safeRead(k) {
        try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; }
    }

    // ─── Modal UI ────────────────────────────────────────────────────────
    let _modal = null;
    function injectStyles() {
        if (document.getElementById('sddImportStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddImportStyles';
        s.textContent = `
.sdd-imp-modal {
    position: fixed; inset: 0; z-index: var(--z-modal-ugc);
    background: var(--paper); color: var(--ink);
    display: none; align-items: flex-start; justify-content: center;
    padding: clamp(40px, 8vw, 96px) clamp(24px, 6vw, 80px);
    overflow-y: auto;
}
.sdd-imp-modal.active { display: flex; }
.sdd-imp-inner { width: 100%; max-width: 560px; }
.sdd-imp-inner h2 {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: clamp(28px, 4vw, 42px); line-height: 1.05;
    margin: 0 0 24px;
}
.sdd-imp-section {
    border-top: 0.5px solid var(--rule);
    padding: 18px 0;
}
.sdd-imp-section h3 {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 10px;
}
.sdd-imp-section p {
    font-family: var(--serif); font-style: italic; font-weight: 300;
    font-size: 13px; color: var(--bone-d); margin: 0 0 12px;
}
.sdd-imp-textarea {
    width: 100%; min-height: 140px; box-sizing: border-box;
    background: var(--paper-d); color: var(--ink);
    border: 0.5px solid var(--rule);
    font-family: var(--mono); font-size: 12px; line-height: 1.5;
    padding: 10px; outline: none; resize: vertical; border-radius: 0;
}
.sdd-imp-btn {
    background: transparent; border: 0;
    border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px;
    transition: color .15s;
    margin-top: 8px;
}
.sdd-imp-btn:hover { color: var(--rust); }
.sdd-imp-status {
    font-family: var(--mono); font-weight: 500; font-size: 11px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); padding: 12px 0;
    border-top: 0.5px solid var(--rule); margin-top: 12px;
    min-height: 1em;
}
.sdd-imp-status.ok    { color: var(--ink); }
.sdd-imp-status.error { color: var(--rust); }
.sdd-imp-close {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0; cursor: pointer;
    font-family: var(--mono); font-weight: 500; font-size: 10px;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d);
}
.sdd-imp-close:hover { color: var(--rust); }
        `;
        document.head.appendChild(s);
    }

    function openModal() {
        injectStyles();
        if (!_modal) {
            _modal = document.createElement('div');
            _modal.className = 'sdd-imp-modal';
            _modal.setAttribute('role', 'dialog');
            _modal.setAttribute('aria-modal', 'true');
            document.body.appendChild(_modal);
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && _modal.classList.contains('active')) closeModal();
            });
        }
        const c = {
            title:  L({ en: 'Import / export your stays.', ko: '여행 기록 가져오기 / 내보내기.', ja: '滞在記録のインポート/エクスポート。', pt: 'Importar / exportar estadias.', es: 'Importar / exportar estancias.' }),
            close:  L({ en: 'CLOSE', ko: '닫기', ja: '閉じる', pt: 'FECHAR', es: 'CERRAR' }),
            impH:   L({ en: 'PASTE CSV OR JSON', ko: 'CSV 또는 JSON 붙여넣기', ja: 'CSV または JSON を貼り付け', pt: 'COLE CSV OU JSON', es: 'PEGUE CSV O JSON' }),
            impHelp:L({
                en: 'CSV header (optional): country,in,out — ISO-2 country, then two YYYY-MM-DD dates. JSON: array of {country,in,out} or the bundle form.',
                ko: 'CSV 헤더(선택): country,in,out — ISO-2 국가, YYYY-MM-DD 두 개. JSON: {country,in,out} 배열 또는 번들 형식.',
                ja: 'CSV ヘッダー(任意): country,in,out — ISO-2 国コードと YYYY-MM-DD 二つ。JSON: {country,in,out} の配列。',
                pt: 'Cabeçalho CSV (opcional): country,in,out — ISO-2 e duas datas YYYY-MM-DD. JSON: array de {country,in,out}.',
                es: 'Cabecera CSV (opcional): country,in,out — ISO-2 y dos fechas YYYY-MM-DD. JSON: matriz de {country,in,out}.'
            }),
            impBtn: L({ en: 'IMPORT', ko: '가져오기', ja: 'インポート', pt: 'IMPORTAR', es: 'IMPORTAR' }),
            expH:   L({ en: 'EXPORT EVERYTHING', ko: '전체 내보내기', ja: 'すべてエクスポート', pt: 'EXPORTAR TUDO', es: 'EXPORTAR TODO' }),
            expHelp:L({
                en: 'Downloads a JSON backup of all four calculators (Schengen, tax, insurance, pension).',
                ko: '4개 계산기 입력값을 JSON 백업으로 받는다.',
                ja: '4つの計算機の入力をJSONバックアップとしてダウンロード。',
                pt: 'Descarrega um JSON com os quatro calculadores.',
                es: 'Descarga un JSON con los cuatro cálculos.'
            }),
            expBtn: L({ en: 'DOWNLOAD JSON', ko: 'JSON 다운로드', ja: 'JSONをダウンロード', pt: 'DESCARREGAR JSON', es: 'DESCARGAR JSON' }),
            err:    L({ en: 'No valid rows found.', ko: '유효한 행이 없다.', ja: '有効な行が見つからない。', pt: 'Sem linhas válidas.', es: 'Sin filas válidas.' })
        };
        _modal.innerHTML = `
            <button type="button" class="sdd-imp-close" data-close>${escapeHtml(c.close)}</button>
            <div class="sdd-imp-inner">
                <h2>${escapeHtml(c.title)}</h2>
                <section class="sdd-imp-section">
                    <h3>${escapeHtml(c.impH)}</h3>
                    <p>${escapeHtml(c.impHelp)}</p>
                    <textarea class="sdd-imp-textarea" data-imp-text placeholder="country,in,out&#10;PT,2026-01-08,2026-02-21&#10;..."></textarea>
                    <button type="button" class="sdd-imp-btn" data-imp-btn>${escapeHtml(c.impBtn)}</button>
                </section>
                <section class="sdd-imp-section">
                    <h3>${escapeHtml(c.expH)}</h3>
                    <p>${escapeHtml(c.expHelp)}</p>
                    <button type="button" class="sdd-imp-btn" data-exp-btn>${escapeHtml(c.expBtn)}</button>
                </section>
                <p class="sdd-imp-status" data-status></p>
            </div>
        `;
        const status = _modal.querySelector('[data-status]');
        const setStatus = (m, k) => { status.className = 'sdd-imp-status ' + (k || ''); status.textContent = m || ''; };
        _modal.querySelector('[data-close]').addEventListener('click', closeModal);
        _modal.querySelector('[data-imp-btn]').addEventListener('click', () => {
            const text = _modal.querySelector('[data-imp-text]').value;
            const trimmed = (text || '').trim();
            const rows = trimmed.startsWith('{') || trimmed.startsWith('[')
                ? parseJSON(trimmed) : parseCSV(trimmed);
            if (!rows.length) { setStatus(c.err, 'error'); return; }
            const r = applyStays(rows);
            setStatus(`+ ${r.added} TAX · + ${r.schengen} SCHENGEN`, 'ok');
        });
        _modal.querySelector('[data-exp-btn]').addEventListener('click', () => {
            const blob = new Blob([exportAll()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'saudade-stays.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 800);
            setStatus('OK', 'ok');
        });

        _modal.classList.add('active');
    }
    function closeModal() { if (_modal) _modal.classList.remove('active'); }

    // Hash trigger.
    function handleHash() { if (location.hash === '#import') { openModal(); try { history.replaceState(null,'',location.pathname+location.search); } catch(e){} } }
    window.addEventListener('hashchange', handleHash);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', handleHash);
    else handleHash();

    window.SAUDADE_IMPORT = { parseCSV, parseJSON, applyStays, exportAll, openModal, closeModal };
})();
