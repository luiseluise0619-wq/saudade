// saudade · health-insurance and pension input form
//
// Two stacked editors. Insurance rows feed saudade-coverage.renderInsurance,
// pension rows feed saudade-coverage.renderPension. Stored separately in
// localStorage:
//   saudade.insurance.policies = [{ provider, country, in, out }]
//   saudade.pension.filings    = [{ scheme, country, in, out }]
//
// API:
//   window.SAUDADE_COVERAGE_FORM.mount(container, { lang? })
//   window.SAUDADE_COVERAGE_FORM.getInsurance()
//   window.SAUDADE_COVERAGE_FORM.getPension()
'use strict';

// IIFE — 로드 즉시 실행. 건강보험 + 연금 입력 폼(두 개의 편집기)을 그리는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_COVERAGE_FORM) return;
    // KEY_INS/KEY_PEN — 보험/연금 기록을 각각 저장하는 localStorage 키.
    const KEY_INS = 'saudade.insurance.policies';
    const KEY_PEN = 'saudade.pension.filings';

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
    // get/set — 키별 기록 읽기/쓰기(깨져 있으면 빈 배열).
    function get(key) {
        try { const r = localStorage.getItem(key); if (!r) return []; const a = JSON.parse(r); return Array.isArray(a) ? a : []; }
        catch (e) { return []; }
    }
    function set(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} }

    const COUNTRIES = ['','AE','AT','AU','BE','BR','CA','CH','CN','DE','DK','ES','FI','FR','GB','GR','HK','HR','HU','ID','IE','IL','IN','IS','IT','JP','KR','MX','MY','NL','NO','NZ','PH','PL','PT','RO','SE','SG','TH','TW','US','VN','ZA','GLOBAL'];

    const KNOWN_INSURERS = ['SafetyWing','Genki','IMG','Cigna Global','Allianz','AXA','GeoBlue','William Russell','InsuredNomads','Bupa','National (KR NHI)','National (PT SNS)','National (FR Sécu)','National (UK NHS)','Other'];
    const KNOWN_SCHEMES  = ['KR-NPS','UK-NIC','PT-SocSeg','US-SS','DE-DRV','JP-NenKin','CA-CPP','AU-Super','FR-Carsat','ES-SegSocial','Other'];

    function copy(lang) {
        return {
            insTitle: L({ en: 'Health insurance windows.', ko: '건강보험 가입 구간.', ja: '健康保険の加入期間。', pt: 'Janelas de seguro de saúde.', es: 'Ventanas de seguro de salud.' }, lang),
            insHelp:  L({ en: 'Add each policy. Gaps between policies are flagged in the panel above.', ko: '보험 가입 구간을 입력하라. 구간 사이의 공백은 위 패널에서 표시된다.', ja: '加入期間を入力。期間の空白は上のパネルで表示される。', pt: 'Adicione cada apólice. Lacunas entre apólices aparecem no painel acima.', es: 'Añada cada póliza. Las lagunas se muestran arriba.' }, lang),
            penTitle: L({ en: 'Pension contribution windows.', ko: '연금 납입 구간.', ja: '年金納付期間。', pt: 'Janelas de contribuição de pensão.', es: 'Ventanas de contribución de pensión.' }, lang),
            penHelp:  L({ en: 'Add each scheme and the months you contributed. The counter sums whole calendar months.', ko: '제도와 납입 구간을 입력하라. 카운터는 달력 월 단위로 합산한다.', ja: '制度と納付期間を入力。カウンターは暦月で合算する。', pt: 'Adicione cada sistema e os meses que contribuiu. Soma por mês civil.', es: 'Añada cada sistema y los meses cotizados. Suma por mes civil.' }, lang),
            colProv:  L({ en: 'PROVIDER', ko: '보험사', ja: '保険会社', pt: 'SEGURADORA', es: 'ASEGURADORA' }, lang),
            colSch:   L({ en: 'SCHEME', ko: '제도', ja: '制度', pt: 'SISTEMA', es: 'SISTEMA' }, lang),
            colCty:   L({ en: 'COUNTRY', ko: '국가', ja: '国', pt: 'PAÍS', es: 'PAÍS' }, lang),
            colIn:    L({ en: 'FROM', ko: '시작', ja: '開始', pt: 'DESDE', es: 'DESDE' }, lang),
            colOut:   L({ en: 'TO (or empty if active)', ko: '종료 (현재 유지 중이면 비워두기)', ja: '終了 (継続中なら空欄)', pt: 'ATÉ (vazio = activo)', es: 'HASTA (vacío = activo)' }, lang),
            addIns:   L({ en: 'ADD POLICY', ko: '보험 추가', ja: '保険を追加', pt: 'ADICIONAR APÓLICE', es: 'AÑADIR PÓLIZA' }, lang),
            addPen:   L({ en: 'ADD PENSION FILING', ko: '연금 신고 추가', ja: '年金記録を追加', pt: 'ADICIONAR PENSÃO', es: 'AÑADIR PENSIÓN' }, lang),
            remove:   L({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }, lang),
            none:     L({ en: 'No entries yet.', ko: '아직 기록 없음.', ja: 'まだ記録なし。', pt: 'Sem registos.', es: 'Sin registros.' }, lang)
        };
    }

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddCovFormStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddCovFormStyles';
        s.textContent = `
.sdd-covf {
    border-top: 0.5px solid var(--rule);
    padding: clamp(20px, 3vw, 28px) 0;
    margin: clamp(16px, 3vw, 28px) 0;
}
.sdd-covf__h { font-family: var(--mono); font-weight: 500; font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--rust); margin: 0 0 8px; }
.sdd-covf__help { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 13px; color: var(--bone-d); margin: 0 0 16px; }
.sdd-covf__cols, .sdd-covf__row {
    display: grid; grid-template-columns: 1.1fr 0.5fr 1fr 1fr auto;
    gap: 8px; align-items: center;
}
.sdd-covf__cols { font-family: var(--mono); font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--bone-d); padding: 6px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-covf__row { padding: 8px 0; border-bottom: 0.5px solid var(--rule); }
.sdd-covf__row input, .sdd-covf__row select {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    color: var(--ink); font-family: var(--mono); font-size: 12px; letter-spacing: 0.04em;
    padding: 6px 0; min-height: 36px; width: 100%; box-sizing: border-box; outline: none; border-radius: 0;
}
.sdd-covf__row input:focus, .sdd-covf__row select:focus { border-bottom-color: var(--ink); }
.sdd-covf__rm { background: transparent; border: 0; color: var(--bone-d); cursor: pointer; font-family: var(--serif); font-style: italic; font-size: 18px; line-height: 1; padding: 4px 8px; min-height: 36px; }
.sdd-covf__rm:hover { color: var(--rust); }
.sdd-covf__add {
    background: transparent; border: 0; border-bottom: 0.5px solid var(--rule);
    font-family: var(--mono); font-weight: 500; font-size: 12px;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); padding: 14px 4px; cursor: pointer;
    width: 100%; text-align: left; min-height: 44px; transition: color .15s;
}
.sdd-covf__add:hover { color: var(--rust); }
.sdd-covf__add::before { content: "+"; color: var(--rust); margin-right: 12px; font-family: var(--serif); font-style: italic; font-size: 18px; }
.sdd-covf__none { font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 14px; color: var(--bone-d); padding: 14px 0; border-bottom: 0.5px solid var(--rule); }
@media (max-width: 720px) {
    .sdd-covf__cols, .sdd-covf__row { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto auto; }
    .sdd-covf__cols span:nth-child(3), .sdd-covf__cols span:nth-child(4), .sdd-covf__cols span:nth-child(5) { display: none; }
    .sdd-covf__row > * { grid-row: auto; }
}
        `;
        document.head.appendChild(s);
    }

    // rowIns — 보험 한 줄(보험사/국가 select + 시작/종료 date + 삭제 버튼) HTML.
    function rowIns(s, i, c) {
        return `
            <div class="sdd-covf__row" data-idx="${i}">
                <select data-field="provider">
                    <option value="">—</option>
                    ${KNOWN_INSURERS.map(p => `<option value="${escapeHtml(p)}" ${s.provider === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                </select>
                <select data-field="country">
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co || '—'}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}" />
                <button type="button" class="sdd-covf__rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }
    // rowPen — 연금 한 줄(제도/국가 select + 시작/종료 date + 삭제 버튼) HTML.
    function rowPen(s, i, c) {
        return `
            <div class="sdd-covf__row" data-idx="${i}">
                <select data-field="scheme">
                    <option value="">—</option>
                    ${KNOWN_SCHEMES.map(p => `<option value="${escapeHtml(p)}" ${s.scheme === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                </select>
                <select data-field="country">
                    ${COUNTRIES.map(co => `<option value="${co}" ${s.country === co ? 'selected' : ''}>${co || '—'}</option>`).join('')}
                </select>
                <input type="date" data-field="in"  value="${escapeHtml(s.in || '')}" />
                <input type="date" data-field="out" value="${escapeHtml(s.out || '')}" />
                <button type="button" class="sdd-covf__rm" data-rm aria-label="${escapeHtml(c.remove)}">×</button>
            </div>
        `;
    }

    // paint — 보험/연금 두 섹션을 그리고 각각에 추가/수정/삭제 이벤트를 배선(wire).
    function paint(host, lang) {
        const c = copy(lang);
        const ins = get(KEY_INS);
        const pen = get(KEY_PEN);
        host.innerHTML = `
            <section class="sdd-covf" data-section="ins">
                <p class="sdd-covf__h">${escapeHtml(c.insTitle)}</p>
                <p class="sdd-covf__help">${escapeHtml(c.insHelp)}</p>
                <div class="sdd-covf__cols">
                    <span>${escapeHtml(c.colProv)}</span>
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows-ins>
                    ${ins.length ? ins.map((s, i) => rowIns(s, i, c)).join('') : `<p class="sdd-covf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-covf__add" data-add-ins>${escapeHtml(c.addIns)}</button>
            </section>
            <section class="sdd-covf" data-section="pen">
                <p class="sdd-covf__h">${escapeHtml(c.penTitle)}</p>
                <p class="sdd-covf__help">${escapeHtml(c.penHelp)}</p>
                <div class="sdd-covf__cols">
                    <span>${escapeHtml(c.colSch)}</span>
                    <span>${escapeHtml(c.colCty)}</span>
                    <span>${escapeHtml(c.colIn)}</span>
                    <span>${escapeHtml(c.colOut)}</span>
                    <span></span>
                </div>
                <div data-rows-pen>
                    ${pen.length ? pen.map((s, i) => rowPen(s, i, c)).join('') : `<p class="sdd-covf__none">${escapeHtml(c.none)}</p>`}
                </div>
                <button type="button" class="sdd-covf__add" data-add-pen>${escapeHtml(c.addPen)}</button>
            </section>
        `;
        wire(host, KEY_INS, '[data-section="ins"]', '[data-add-ins]', lang);
        wire(host, KEY_PEN, '[data-section="pen"]', '[data-add-pen]', lang);
    }

    // wire — 한 섹션(보험 또는 연금)의 추가 버튼과 각 행 입력/삭제에 핸들러를 건다.
    function wire(host, key, sectionSel, addSel, lang) {
        host.querySelector(addSel).addEventListener('click', () => {
            const cur = get(key);
            const blank = key === KEY_INS ? { provider:'', country:'', in:'', out:'' }
                                          : { scheme:'',   country:'', in:'', out:'' };
            set(key, cur.concat([blank]));
            paint(host, lang); renderCalc();
        });
        host.querySelectorAll(`${sectionSel} .sdd-covf__row`).forEach(rowEl => {
            const idx = +rowEl.dataset.idx;
            rowEl.querySelectorAll('[data-field]').forEach(input => {
                const ev = (input.tagName === 'SELECT') ? 'change' : 'input';
                input.addEventListener(ev, e => {
                    const cur = get(key); cur[idx][input.dataset.field] = e.target.value; set(key, cur); renderCalc();
                });
            });
            rowEl.querySelector('[data-rm]').addEventListener('click', () => {
                const cur = get(key); cur.splice(idx, 1); set(key, cur);
                paint(host, lang); renderCalc();
            });
        });
    }

    // renderCalc — 현재 입력으로 보험 공백/연금 개월 패널을 다시 그린다(패널이 있을 때만).
    function renderCalc() {
        if (!window.SAUDADE_COVERAGE) return;
        const insPanel = document.getElementById('sddInsPanel');
        const penPanel = document.getElementById('sddPenPanel');
        if (insPanel) {
            const policies = get(KEY_INS).filter(p => p.in);
            window.SAUDADE_COVERAGE.renderInsurance(insPanel, { policies });
        }
        if (penPanel) {
            const filings = get(KEY_PEN).filter(p => p.in && p.scheme);
            window.SAUDADE_COVERAGE.renderPension(penPanel, { filings });
        }
    }

    // mount — 폼을 host 에 장착: 스타일 주입 + 렌더 + 계산기 초기 실행.
    function mount(target, opts) {
        injectStyles();
        const host = (typeof target === 'string') ? document.querySelector(target) : target;
        if (!host) return;
        paint(host, opts && opts.lang);
        renderCalc();
    }

    // 전역 공개 API — 폼 장착 + 보험/연금 기록 조회.
    window.SAUDADE_COVERAGE_FORM = { mount, getInsurance: () => get(KEY_INS), getPension: () => get(KEY_PEN) };
})();
