// SAUDADE · § 02b QUARTERLY DISPATCH (헌법 §0.5 잡지 톤)
// 부록 페이지. 분기 1회 발행. 도시당 3건, 3 도시. No more.
// data/quarterly-dispatch.json fetch → 매거진 페이지 렌더.
// 카드 X · 1px rule · mono 번호 + Fraunces 헤드 + italic lede + mono 출처.
// "BREAKING / 추천 / 방금 / Top stories" 어휘 0건. 빨간 점·뱃지·"New" 라벨 없음.
'use strict';

(function() {
    if (window.SAUDADE_QUARTERLY) return;

    const HASH = '#02b';
    const STATE_KEY = 'saudade.last.screen';
    let _cache = {};

    function currentEdition() {
        return (window.SAUDADE_EDITION?.get?.() || 'en');
    }

    function load() {
        const ed = currentEdition();
        if (_cache[ed]) return Promise.resolve(_cache[ed]);
        const url = ed === 'en'
            ? './data/quarterly-dispatch.json'
            : `./data/quarterly-dispatch.${ed}.json`;
        return fetch(url, { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) { _cache[ed] = d; return d; }
                return fetch('./data/quarterly-dispatch.json', { cache: 'force-cache' })
                    .then(r => r.ok ? r.json() : null)
                    .then(d2 => { _cache[ed] = d2 || { cities: [] }; return _cache[ed]; });
            })
            .catch(() => { _cache[ed] = { cities: [] }; return _cache[ed]; });
    }

    function injectStyles() {
        if (document.getElementById('sddQdispStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddQdispStyles';
        s.textContent = `
.sdd-qdisp {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.qdispatch-active .sdd-qdisp { display: block; }
body.qdispatch-active .sdd-masthead { display: none; }

.sdd-qdisp-mast {
    position: fixed;
    top: 0; left: 0; right: 0;
    padding: clamp(20px, 3vw, 40px) clamp(24px, 6vw, 80px) clamp(12px, 1.5vw, 18px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--paper);
    border-bottom: 0.5px solid var(--rule);
    z-index: 9;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-qdisp-mast-left,
.sdd-qdisp-mast-right {
    display: flex;
    gap: clamp(12px, 2vw, 32px);
    align-items: baseline;
}
.sdd-qdisp-mast-num   { color: var(--rust); }
.sdd-qdisp-mast-name  { color: var(--ink); font-weight: 500; }
.sdd-qdisp-mast-page,
.sdd-qdisp-mast-issue { color: var(--bone-d); font-weight: 400; letter-spacing: var(--tr-mono-meta); }
.sdd-qdisp-mast-back {
    background: transparent;
    border: 0;
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 8px;
}
.sdd-qdisp-mast-back:hover { color: var(--rust); }
.sdd-qdisp-mast-back::before { content: '← '; }

.sdd-qdisp-head {
    margin: 0 0 clamp(28px, 4vw, 56px);
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-qdisp-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-qdisp-h2 .it { font-style: italic; display: inline; }
.sdd-qdisp-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 12px 0 0;
}
.sdd-qdisp-sub em {
    font-style: italic;
    color: var(--ink);
}
.sdd-qdisp-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 12px 0 0;
}

/* v6 §10.6 — 분기 D-14 발행 락 배지. 카드 X, 1px rule + signal 컬러. */
.sdd-qdisp-lock {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--signal);
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 0.5px solid var(--rule);
}
.sdd-qdisp-lock strong {
    font-weight: 500;
    color: var(--signal);
    margin-right: 8px;
}
.sdd-qdisp-lock.overdue,
.sdd-qdisp-lock.overdue strong { color: var(--rust); }
.sdd-qdisp-lock-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13px, 1.2vw, 15px);
    letter-spacing: var(--tr-fraunces-body-d);
    text-transform: none;
    color: var(--bone-d);
    margin: 4px 0 0;
}

/* v6 §9.5 — 편집자 30% 재작성 카운터. body[data-editor="1"] 일 때만 표시. */
.sdd-qdisp-editor {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--jade);
    margin: 10px 0 0;
    padding-top: 10px;
    border-top: 0.5px solid var(--rule);
    display: none;
}
body[data-editor="1"] .sdd-qdisp-editor { display: block; }
.sdd-qdisp-editor strong {
    font-weight: 500;
    color: var(--jade);
    margin-right: 8px;
}
.sdd-qdisp-editor.below,
.sdd-qdisp-editor.below strong { color: var(--rust); }

.sdd-qdisp-rewrite-tag {
    display: none;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    line-height: 1.4;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    margin: 0 0 4px;
}
body[data-editor="1"] .sdd-qdisp-rewrite-tag { display: inline-block; }
.sdd-qdisp-rewrite-tag.rewritten { color: var(--jade); }
.sdd-qdisp-rewrite-tag.draft     { color: var(--signal); }

.sdd-qdisp-city {
    margin: clamp(28px, 4vw, 56px) 0 0;
    padding-top: clamp(20px, 3vw, 32px);
    border-top: 0.5px solid var(--rule);
}
.sdd-qdisp-city-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(16px, 2vw, 24px);
}
.sdd-qdisp-city-name {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 3.5vw, 40px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
}
.sdd-qdisp-city-name .season {
    font-style: normal;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-left: 12px;
}
.sdd-qdisp-city-count {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}

.sdd-qdisp-item {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(14px, 2vw, 20px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-qdisp-item:last-child { border-bottom: 0.5px solid var(--rule); }

.sdd-qdisp-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    padding-top: 4px;
}
.sdd-qdisp-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.sdd-qdisp-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(17px, 1.7vw, 22px);
    line-height: 1.35;
    letter-spacing: var(--tr-fraunces-body-d);
    color: var(--ink);
    margin: 0;
}
.sdd-qdisp-lede {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 0;
}
.sdd-qdisp-source {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 8px 0 0;
}
.sdd-qdisp-source a {
    color: var(--bone-d);
    text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-qdisp-source a:hover {
    color: var(--rust);
    border-bottom-color: var(--rust);
}

.sdd-qdisp-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-qdisp-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
}
.sdd-qdisp-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}
.sdd-qdisp-empty {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
    padding: clamp(40px, 6vw, 80px) 0;
}

/* § 02 ATLAS 페이지에서 § 02b 진입 링크 — 1px rule 만, 카드 X */
.sdd-qdisp-entry {
    display: block;
    margin: clamp(40px, 6vw, 80px) 0 0;
    padding: clamp(20px, 3vw, 32px) 0 clamp(8px, 1.5vw, 14px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    text-decoration: none;
    cursor: pointer;
    background: transparent;
    border-left: 0; border-right: 0; border-bottom: 0;
    text-align: left;
    width: 100%;
}
.sdd-qdisp-entry:hover { color: var(--rust); }
.sdd-qdisp-entry .num  { color: var(--rust); margin-right: 12px; }
.sdd-qdisp-entry .arr  { float: right; color: var(--bone-d); letter-spacing: 0; }
.sdd-qdisp-entry:hover .arr { color: var(--rust); }
.sdd-qdisp-entry-sub {
    display: block;
    margin-top: 6px;
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13px, 1.2vw, 15px);
    letter-spacing: var(--tr-fraunces-body-d);
    text-transform: none;
    color: var(--bone-d);
}

@media (max-width: 768px) {
    .sdd-qdisp { padding: 72px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-qdisp-mast { padding: 14px 16px 8px; font-size: 9px; flex-wrap: wrap; gap: 6px; }
    .sdd-qdisp-mast-issue, .sdd-qdisp-mast-page { display: none; }
    .sdd-qdisp-item { grid-template-columns: 32px 1fr; gap: 12px; }
    .sdd-qdisp-city-head { flex-direction: column; align-items: flex-start; gap: 4px; }
}

@media print {
    .sdd-qdisp-mast-back { display: none; }
    .sdd-qdisp { position: static; padding: 24px; }
}
`;
        document.head.appendChild(s);
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
    // v7 검토 정정 — italic 헤드라인 마침표 regular 분리
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }

    function safeUrl(u) {
        if (!u || typeof u !== 'string') return null;
        try {
            const url = new URL(u);
            return /^https?:$/.test(url.protocol) ? url.toString() : null;
        } catch (e) { return null; }
    }

    function fmtFiledKst(iso) {
        try {
            const d = new Date(iso);
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            // KST = UTC+9. iso 가 +09:00 이라 시간 부분만 직접 잘라 KST 로 표기
            const hm = String(iso).slice(11, 16);
            return `${y}-${m}-${day} AT ${hm} KST`;
        } catch (e) { return ''; }
    }

    function fmtIsoDate(iso) {
        try { return new Date(iso).toISOString().slice(0, 10); }
        catch (e) { return ''; }
    }

    // v6 §10.6 — 분기 D-14 발행 락. next_filing 이 14일 이내면 편집 창구 닫힘.
    // 음수면 발행일 지남 (overdue) — 편집자가 분기를 놓친 상태.
    function daysUntilFiling(data) {
        const iso = data && data.next_filing;
        if (!iso) return null;
        const ts = new Date(iso).getTime();
        if (!Number.isFinite(ts)) return null;
        return Math.floor((ts - Date.now()) / 86400000);
    }
    function lockState(data) {
        const d = daysUntilFiling(data);
        if (d === null)   return { state: 'open',    days: null };
        if (d < 0)        return { state: 'overdue', days: -d   };
        if (d <= 14)      return { state: 'lock',    days: d    };
        return                   { state: 'open',    days: d    };
    }

    // v6 §9.5 — 30% 인간 재작성 카운터 (편집자 전용 UI).
    // 데이터의 각 item.human_rewritten boolean → 분기 비율 산출.
    // 30% 미만이면 BELOW THRESHOLD 경고. 헌법 §0.5: AI 보조 작성 후 사람 편집장이 다시 쓴다.
    const REWRITE_THRESHOLD = 0.30;
    const EDITOR_KEY = 'saudade.editor';

    function isEditorMode() {
        try { return localStorage.getItem(EDITOR_KEY) === '1'; }
        catch (e) { return false; }
    }
    function setEditorMode(on) {
        try { localStorage.setItem(EDITOR_KEY, on ? '1' : '0'); } catch (e) {}
    }
    function rewriteRatio(data) {
        const cities = (data && data.cities) || [];
        let total = 0, rewritten = 0;
        for (const city of cities) {
            for (const it of clamp3(city.items)) {
                total++;
                if (it && it.human_rewritten === true) rewritten++;
            }
        }
        const ratio = total ? rewritten / total : 0;
        return {
            rewritten, total, ratio,
            threshold: REWRITE_THRESHOLD,
            passes: ratio >= REWRITE_THRESHOLD
        };
    }

    // 헌법 §0.5 — 도시당 3건, 3 도시. 그 이상은 잡지 페이지가 아님.
    function clamp3(arr) { return Array.isArray(arr) ? arr.slice(0, 3) : []; }

    function L(strings) {
        const ed = currentEdition();
        return strings[ed] || strings.en;
    }

    function copy() {
        const V = window.SAUDADE_VOICE;
        const _vEd = currentEdition();
        return {
            mastName: L({
                en: 'DISPATCHES',
                ko: '디스패치',
                ja: '通信',
                pt: 'DESPACHOS',
                es: 'DESPACHOS'
            }),
            mastBack: L({
                en: 'BACK TO ATLAS',
                ko: '아틀라스로',
                ja: 'アトラスへ',
                pt: 'VOLTAR AO ATLAS',
                es: 'VOLVER AL ATLAS'
            }),
            head1: (V && V.get('dispatchesHead', _vEd))   || 'The wires,',
            head2: (V && V.get('dispatchesEdited', _vEd)) || 'edited.',
            sub:   (V && V.get('quarterlySubtitle', _vEd)) || 'Three from each city.',
            line: L({
                en: 'Three items per city. Three cities. No more.',
                ko: '도시당 세 편. 세 도시. 그 이상은 없음.',
                ja: '都市ごとに三本。三都市。それ以上はなし。',
                pt: 'Três itens por cidade. Três cidades. Nada mais.',
                es: 'Tres por ciudad. Tres ciudades. Nada más.'
            }),
            filedLabel: L({
                en: 'FILED', ko: '발행', ja: '発行',
                pt: 'PUBLICADO', es: 'PUBLICADO'
            }),
            nextLabel: L({
                en: 'NEXT FILING', ko: '다음 발행', ja: '次回発行',
                pt: 'PRÓXIMA EDIÇÃO', es: 'PRÓXIMA EDICIÓN'
            }),
            itemsLabel: L({
                en: 'ITEMS', ko: '편', ja: '本',
                pt: 'ITENS', es: 'ARTÍCULOS'
            }),
            noteTitle: L({
                en: 'A note on sources.',
                ko: '출처에 대한 메모.',
                ja: '出典についての覚書。',
                pt: 'Uma nota sobre as fontes.',
                es: 'Una nota sobre las fuentes.'
            }),
            noteBody: L({
                en: 'Each dispatch is rewritten in our own words from the source listed. We quote no more than twenty-five words. We link to the original. Quarterly only — we do not chase the wire.',
                ko: '각 디스패치는 명시된 출처에서 우리의 언어로 다시 쓴다. 인용은 25 단어를 넘지 않는다. 원문 링크를 단다. 분기 발행만 — 속보를 쫓지 않는다.',
                ja: '各通信は明示された出典から自らの言葉で書き直す。引用は二十五語以内。出典リンクを付ける。四半期発行のみ — 速報は追わない。',
                pt: 'Cada despacho é reescrito em nossas próprias palavras a partir da fonte listada. Citamos no máximo vinte e cinco palavras. Ligamos ao original. Apenas trimestral — não corremos atrás do telegrama.',
                es: 'Cada despacho se reescribe con nuestras propias palabras a partir de la fuente indicada. Citamos no más de veinticinco palabras. Enlazamos al original. Solo trimestral — no perseguimos el teletipo.'
            }),
            empty: L({
                en: 'No dispatches filed for this quarter yet.',
                ko: '이번 분기 발행된 디스패치가 아직 없다.',
                ja: '今四半期の通信はまだない。',
                pt: 'Ainda não há despachos para este trimestre.',
                es: 'Aún no hay despachos para este trimestre.'
            }),
            entryHead: L({
                en: 'DISPATCHES · QUARTERLY',
                ko: '디스패치 · 분기 발행',
                ja: '通信 · 四半期発行',
                pt: 'DESPACHOS · TRIMESTRAL',
                es: 'DESPACHOS · TRIMESTRAL'
            }),
            entrySub: L({
                en: 'Three items per city. Three cities. Filed once per quarter.',
                ko: '도시당 세 편. 세 도시. 분기당 한 번 발행.',
                ja: '都市ごとに三本、三都市。四半期に一度。',
                pt: 'Três itens por cidade. Três cidades. Publicado uma vez por trimestre.',
                es: 'Tres por ciudad. Tres ciudades. Publicado una vez por trimestre.'
            }),
            // v6 §10.6 — 분기 D-14 락 표시
            lockedHead: L({
                en: 'FILING WINDOW LOCKED',
                ko: '발행 창구 닫힘',
                ja: '発行ウィンドウ閉鎖',
                pt: 'JANELA DE PUBLICAÇÃO FECHADA',
                es: 'VENTANA DE PUBLICACIÓN CERRADA'
            }),
            lockedSub: L({
                en: 'No edits until next filing.',
                ko: '다음 발행일까지 편집 정지.',
                ja: '次回発行まで編集停止。',
                pt: 'Sem edições até a próxima publicação.',
                es: 'Sin ediciones hasta la próxima publicación.'
            }),
            overdueHead: L({
                en: 'FILING WINDOW PASSED',
                ko: '발행 기한 지남',
                ja: '発行期限超過',
                pt: 'PRAZO DE PUBLICAÇÃO ULTRAPASSADO',
                es: 'PLAZO DE PUBLICACIÓN VENCIDO'
            }),
            overdueDays: function(n) {
                return L({
                    en: `OVERDUE BY ${n} ${n === 1 ? 'DAY' : 'DAYS'}`,
                    ko: `${n}일 초과`,
                    ja: `${n}日超過`,
                    pt: `ATRASO DE ${n} ${n === 1 ? 'DIA' : 'DIAS'}`,
                    es: `RETRASO DE ${n} ${n === 1 ? 'DÍA' : 'DÍAS'}`
                });
            },
            // v6 §9.5 — 편집자 카운터
            editorHead: L({
                en: 'EDITOR', ko: '편집자', ja: '編集者',
                pt: 'EDITOR', es: 'EDITOR'
            }),
            rewriteCount: function(n, total, pct) {
                return L({
                    en: `${n}/${total} REWRITTEN · ${pct}%`,
                    ko: `${total}편 중 ${n}편 재작성 · ${pct}%`,
                    ja: `${total}本中${n}本 書き直し済 · ${pct}%`,
                    pt: `${n}/${total} REESCRITOS · ${pct}%`,
                    es: `${n}/${total} REESCRITOS · ${pct}%`
                });
            },
            aboveThreshold: L({
                en: 'ABOVE 30% THRESHOLD',
                ko: '30% 기준선 통과',
                ja: '30%しきい値クリア',
                pt: 'ACIMA DO LIMITE DE 30%',
                es: 'POR ENCIMA DEL UMBRAL DEL 30%'
            }),
            belowThreshold: L({
                en: 'BELOW 30% THRESHOLD',
                ko: '30% 기준선 미달',
                ja: '30%しきい値未達',
                pt: 'ABAIXO DO LIMITE DE 30%',
                es: 'POR DEBAJO DEL UMBRAL DEL 30%'
            }),
            tagRewritten: L({
                en: 'REWRITTEN', ko: '재작성', ja: '書き直し済',
                pt: 'REESCRITO', es: 'REESCRITO'
            }),
            tagDraft: L({
                en: 'AI DRAFT', ko: 'AI 초고', ja: 'AI 草稿',
                pt: 'RASCUNHO IA', es: 'BORRADOR IA'
            })
        };
    }

    function renderItem(it, c) {
        const safeSrc = safeUrl(it.source_url);
        const srcLine = `${escapeHtml(it.source || '')}${it.source_date ? ' · ' + escapeHtml(it.source_date) : ''}`;
        const srcAnchor = safeSrc
            ? `<a href="${safeSrc}" target="_blank" rel="noopener noreferrer">${srcLine}</a>`
            : srcLine;
        // v6 §9.5 — body[data-editor="1"] 시 CSS 가 자동 표시. 데이터에 플래그 없으면 default DRAFT.
        const rewritten = it && it.human_rewritten === true;
        const tagClass = rewritten ? 'rewritten' : 'draft';
        const tagText  = rewritten ? c.tagRewritten : c.tagDraft;
        return `
            <article class="sdd-qdisp-item">
                <span class="sdd-qdisp-num">${escapeHtml(it.n || '')}</span>
                <div class="sdd-qdisp-body">
                    <span class="sdd-qdisp-rewrite-tag ${tagClass}">${escapeHtml(tagText)}</span>
                    <h3 class="sdd-qdisp-headline">${escapeHtml(it.headline || '')}</h3>
                    <p class="sdd-qdisp-lede">${escapeHtml(it.lede || '')}</p>
                    <p class="sdd-qdisp-source">${srcAnchor}</p>
                </div>
            </article>
        `;
    }

    function renderCity(city, c) {
        const items = clamp3(city.items).map(it => renderItem(it, c)).join('');
        const seasonHtml = city.season
            ? `<span class="season">${escapeHtml(city.season)}</span>`
            : '';
        return `
            <section class="sdd-qdisp-city">
                <header class="sdd-qdisp-city-head">
                    <h3 class="sdd-qdisp-city-name">
                        ${escapeHtml(city.city || '')}${seasonHtml}
                    </h3>
                    <span class="sdd-qdisp-city-count">${String(clamp3(city.items).length).padStart(2, '0')} ${escapeHtml(c.itemsLabel)}</span>
                </header>
                ${items}
            </section>
        `;
    }

    function render(data) {
        let root = document.getElementById('sddQuarterlyDispatch');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddQuarterlyDispatch';
            root.className = 'sdd-qdisp';
            document.body.appendChild(root);
        }

        const c = copy();
        const cities = clamp3(data && data.cities);
        const filed = data && data.filed_at ? fmtFiledKst(data.filed_at) : '';
        const next  = data && data.next_filing ? fmtIsoDate(data.next_filing) : '';
        const issue = (data && data.issue) || '2026 · Q2';
        const page  = (data && data.page) || 'P. 13';

        const head = `
            <header class="sdd-qdisp-mast">
                <div class="sdd-qdisp-mast-left">
                    <span class="sdd-qdisp-mast-num">§ 02b</span>
                    <span class="sdd-qdisp-mast-name">${escapeHtml(c.mastName)}</span>
                </div>
                <div class="sdd-qdisp-mast-right">
                    <span class="sdd-qdisp-mast-issue">${escapeHtml(issue)}</span>
                    <span class="sdd-qdisp-mast-page">${escapeHtml(page)}</span>
                    <button type="button" class="sdd-qdisp-mast-back" data-qdisp-back>${escapeHtml(c.mastBack)}</button>
                </div>
            </header>
        `;

        // v6 §10.6 — 분기 D-14 발행 락 배지
        const lock = lockState(data);
        let lockHtml = '';
        if (lock.state === 'lock') {
            lockHtml = `
                <p class="sdd-qdisp-lock">
                    <strong>${escapeHtml(c.lockedHead)}</strong>D-${lock.days}
                </p>
                <p class="sdd-qdisp-lock-sub">${escapeHtml(c.lockedSub)}</p>
            `;
        } else if (lock.state === 'overdue') {
            lockHtml = `
                <p class="sdd-qdisp-lock overdue">
                    <strong>${escapeHtml(c.overdueHead)}</strong>${escapeHtml(c.overdueDays(lock.days))}
                </p>
            `;
        }

        // v6 §9.5 — 30% 인간 재작성 카운터 (편집자 모드에서만 가시화)
        const rw = rewriteRatio(data);
        const pct = Math.round(rw.ratio * 100);
        const editorLine = rw.passes ? c.aboveThreshold : c.belowThreshold;
        const editorHtml = `
            <p class="sdd-qdisp-editor ${rw.passes ? 'above' : 'below'}">
                <strong>${escapeHtml(c.editorHead)}</strong>${escapeHtml(c.rewriteCount(rw.rewritten, rw.total, pct))} · ${escapeHtml(editorLine)}
            </p>
        `;

        const intro = `
            <header class="sdd-qdisp-head">
                <h2 class="sdd-qdisp-h2">
                    ${dropItalicPunct(c.head1)}
                    <span class="it">${dropItalicPunct(c.head2)}</span>
                </h2>
                <p class="sdd-qdisp-sub">${escapeHtml(c.line)} <em>${escapeHtml(c.sub)}</em></p>
                <p class="sdd-qdisp-meta">${escapeHtml(c.filedLabel)} ${escapeHtml(filed)} · ${escapeHtml(c.nextLabel)} ${escapeHtml(next)}</p>
                ${lockHtml}
                ${editorHtml}
            </header>
        `;

        const body = cities.length
            ? cities.map(city => renderCity(city, c)).join('')
            : `<p class="sdd-qdisp-empty">${escapeHtml(c.empty)}</p>`;

        const foot = `
            <footer class="sdd-qdisp-foot">
                <p class="sdd-qdisp-disclaimer">
                    <strong>${escapeHtml(c.noteTitle)}</strong>
                    ${escapeHtml(c.noteBody)}
                </p>
            </footer>
        `;

        root.innerHTML = head + intro + body + foot;

        const back = root.querySelector('[data-qdisp-back]');
        if (back) back.addEventListener('click', close);
    }

    function open() {
        document.body.classList.add('qdispatch-active');
        try { localStorage.setItem(STATE_KEY, '02b'); } catch (e) {}
        load().then(render);
        // Hash 동기화 (한 번만)
        if (location.hash !== HASH) {
            try { history.replaceState(null, '', HASH); } catch (e) {}
        }
        // 페이지 상단으로
        const root = document.getElementById('sddQuarterlyDispatch');
        if (root) root.scrollTop = 0;
    }

    function close() {
        document.body.classList.remove('qdispatch-active');
        // ATLAS 로 돌아가기 — § 02 가 활성 상태이면 그대로, 아니면 cover 로
        const sec = document.body.getAttribute('data-section');
        if (sec === '02') {
            // 이미 ATLAS 활성 → 별도 작업 불필요
        } else {
            try { localStorage.setItem(STATE_KEY, 'cover'); } catch (e) {}
        }
        try {
            if (location.hash === HASH) history.replaceState(null, '', location.pathname + location.search);
        } catch (e) {}
    }

    // § 02 ATLAS 페이지 하단에 부록 진입 링크 한 번만 주입.
    // saudade-atlas.js 한 줄도 수정 안 함 — DOM 관찰자로 마운트 후 append.
    function injectAtlasEntry() {
        const root = document.getElementById('sddAtlas');
        if (!root) return false;
        if (root.querySelector('.sdd-qdisp-entry')) return true;
        const c = copy();
        const a = document.createElement('button');
        a.type = 'button';
        a.className = 'sdd-qdisp-entry';
        a.setAttribute('data-qdisp-open', '1');
        a.innerHTML = `
            <span class="num">§ 02b</span>${escapeHtml(c.entryHead)}
            <span class="arr">→</span>
            <span class="sdd-qdisp-entry-sub">${escapeHtml(c.entrySub)}</span>
        `;
        a.addEventListener('click', (e) => { e.preventDefault(); open(); });
        root.appendChild(a);
        return true;
    }

    function watchAtlas() {
        // ATLAS 가 다시 렌더되면 entry 가 사라질 수 있음 → MutationObserver 로 재주입.
        const tryInject = () => {
            if (document.body.getAttribute('data-section') === '02') {
                injectAtlasEntry();
            }
        };
        tryInject();
        const mo = new MutationObserver(() => {
            tryInject();
            // edition 변경 시 진입 링크 텍스트도 갱신 (제거 후 재주입)
            const root = document.getElementById('sddAtlas');
            const entry = root && root.querySelector('.sdd-qdisp-entry');
            if (entry && entry.parentElement !== root) entry.remove();
        });
        mo.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-section', 'data-edition'],
            childList: true,
            subtree: true
        });
    }

    function watchHash() {
        const sync = () => {
            if (location.hash === HASH) {
                if (!document.body.classList.contains('qdispatch-active')) open();
            } else if (document.body.classList.contains('qdispatch-active')) {
                close();
            }
        };
        window.addEventListener('hashchange', sync);
        sync();   // 초기 진입 시
    }

    function watchKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('qdispatch-active')) {
                e.stopPropagation();
                close();
            }
            // v6 §9.5 — Ctrl+Shift+E 로 편집자 모드 토글 (편집자 전용 UI)
            if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
                e.preventDefault();
                const next = !isEditorMode();
                setEditorMode(next);
                applyEditorBodyAttr();
                // 페이지 열려 있으면 재렌더 (배지/카운터 가시화)
                if (document.body.classList.contains('qdispatch-active')) {
                    load().then(render);
                }
            }
        });
    }

    function applyEditorBodyAttr() {
        if (isEditorMode()) document.body.setAttribute('data-editor', '1');
        else document.body.removeAttribute('data-editor');
    }

    function init() {
        injectStyles();
        applyEditorBodyAttr();
        // 사전 로딩 (force-cache)
        load();
        watchAtlas();
        watchHash();
        watchKeys();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_QUARTERLY = {
        open, close,
        reload: () => { _cache = {}; load().then(render); },
        // v6 §10.6 — 다른 모듈이 락 상태 조회 가능하도록 노출
        lockState: () => load().then(lockState),
        daysUntilFiling: () => load().then(daysUntilFiling),
        // v6 §9.5 — 편집자 모드 토글 + 카운터 조회
        rewriteRatio: () => load().then(rewriteRatio),
        isEditorMode,
        setEditorMode: (on) => {
            setEditorMode(on);
            applyEditorBodyAttr();
            if (document.body.classList.contains('qdispatch-active')) load().then(render);
        }
    };
})();
