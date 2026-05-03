// SAUDADE · § 03 DISPATCHES (Handoff v2 §5.3)
// 일간 06:00 KST 발행. 9 quiet news (3 도시 × 3 items).
// data/dispatches.json fetch → 매거진 페이지 렌더.
// 카드 X — 1px rule + mono 번호 + Fraunces 헤드 + italic lede + mono 출처.
'use strict';

(function() {
    if (window.SAUDADE_DISPATCHES) return;

    let _cache = {};   // edition → data

    function currentEdition() {
        return (window.SAUDADE_EDITION?.get?.() || 'en');
    }

    function load() {
        const ed = currentEdition();
        if (_cache[ed]) return Promise.resolve(_cache[ed]);
        // ed-specific 파일 우선, 없으면 EN base fallback
        const url = ed === 'en' ? './data/dispatches.json' : `./data/dispatches.${ed}.json`;
        return fetch(url, { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) { _cache[ed] = d; return d; }
                // fallback to EN
                return fetch('./data/dispatches.json', { cache: 'force-cache' })
                    .then(r => r.ok ? r.json() : null)
                    .then(d2 => { _cache[ed] = d2 || { cities: [] }; return _cache[ed]; });
            })
            .catch(() => { _cache[ed] = { cities: [] }; return _cache[ed]; });
    }

    function injectStyles() {
        if (document.getElementById('sddDispatchStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDispatchStyles';
        s.textContent = `
.sdd-disp {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="03"] .sdd-disp { display: block; }

.sdd-disp-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    /* v7 검토 정정 — 이중선 방지: 다음 .sdd-disp-day-head / .sdd-disp-city 가 자체 border 가짐 */
}
.sdd-disp-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-disp-h2 .it { font-style: italic; display: inline; }

.sdd-disp-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 12px 0 0;
}
.sdd-disp-meta {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 12px 0 0;
}

.sdd-disp-city {
    margin: clamp(28px, 4vw, 56px) 0 0;
    padding-top: clamp(20px, 3vw, 32px);
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-city-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(16px, 2vw, 24px);
}
.sdd-disp-city-name {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(28px, 3.5vw, 40px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
}
.sdd-disp-city-name .season {
    font-style: normal;
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-left: 12px;
}
.sdd-disp-city-count {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    white-space: nowrap;
}

.sdd-disp-item {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: clamp(12px, 2vw, 24px);
    padding: clamp(14px, 2vw, 20px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-disp-item:last-child { border-bottom: 0.5px solid var(--rule); }

.sdd-disp-num {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    padding-top: 4px;
}
.sdd-disp-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.sdd-disp-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(17px, 1.7vw, 22px);
    line-height: 1.35;
    letter-spacing: var(--tr-fraunces-body-d);
    color: var(--ink);
    margin: 0;
}
.sdd-disp-lede {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.5;
    color: var(--ink-soft, var(--ink));
    margin: 0;
}
.sdd-disp-fulltext {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(13.5px, 1.25vw, 15px);
    line-height: 1.55;
    color: var(--ink);
    margin: 8px 0 0;
}
.sdd-disp-quote {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(14px, 1.4vw, 17px);
    line-height: 1.45;
    color: var(--rust);
    margin: 8px 0 0;
    padding-left: 12px;
    border-left: 0.5px solid var(--rule-2, var(--rule));
}
.sdd-disp-source {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 8px 0 0;
}
.sdd-disp-source a {
    color: var(--bone-d);
    text-decoration: none;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-disp-source a:hover { color: var(--rust); border-bottom-color: var(--rust); }

.sdd-disp-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
/* v7 검토 정정 — 면책 토글 (기본 접힘, 클릭 시 펼침). 콘텐츠가 압도되지 않게. */
.sdd-disp-disclaimer-toggle {
    list-style: none;
    cursor: pointer;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    padding: 6px 0;
    transition: color .12s;
    user-select: none;
}
.sdd-disp-disclaimer-toggle::-webkit-details-marker { display: none; }
.sdd-disp-disclaimer-toggle::marker { content: ''; }
.sdd-disp-disclaimer-toggle::after { content: ' →'; opacity: .6; }
.sdd-disp-foot[open] .sdd-disp-disclaimer-toggle::after { content: ' ↓'; opacity: 1; }
.sdd-disp-disclaimer-toggle:hover { color: var(--ink); }
.sdd-disp-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: clamp(12px, 1.5vw, 16px) 0 0;
}
.sdd-disp-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

/* v6 §9 — 일요일 휴간 + TODAY + ARCHIVE 섹션 */
.sdd-disp-sunday {
    padding: clamp(40px, 6vw, 80px) 0;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    text-align: center;
    margin: clamp(24px, 4vw, 48px) 0;
}
.sdd-disp-sunday-line {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(20px, 2.4vw, 28px);
    line-height: 1.4;
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-disp-sunday-sub {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

.sdd-disp-day-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0 0 clamp(12px, 1.5vw, 18px);
    margin: 0 0 clamp(16px, 2vw, 24px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-disp-day-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--accent, var(--rust));
}
.sdd-disp-day-section {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}

.sdd-disp-today { margin: clamp(20px, 3vw, 32px) 0 clamp(40px, 6vw, 80px); }

.sdd-disp-archive {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(20px, 3vw, 32px);
    border-top: 0.5px solid var(--rule-2, var(--rule));
}
.sdd-disp-archive-mast {
    margin: 0 0 clamp(12px, 1.5vw, 20px);
}
.sdd-disp-archive-day {
    margin: clamp(20px, 3vw, 32px) 0;
    padding-top: clamp(12px, 1.5vw, 18px);
    border-top: 0.5px solid var(--rule);
    opacity: 0.78;
}
.sdd-disp-archive-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0 0 clamp(12px, 1.5vw, 18px);
}
.sdd-disp-archive-date {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    color: var(--ink);
}
.sdd-disp-archive-section {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}

.sdd-disp-citytag {
    display: inline-block;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 6px;
}
.sdd-disp-empty {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
    padding: clamp(40px, 6vw, 80px) 0;
}

/* v7 §9.5 데일리 디스패치 30% 재작성 (편집자 모드 전용) */
.sdd-disp-editor {
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
body[data-editor="1"] .sdd-disp-editor { display: block; }
.sdd-disp-editor strong { font-weight: 500; color: var(--jade); margin-right: 8px; }
.sdd-disp-editor.below,
.sdd-disp-editor.below strong { color: var(--rust); }
.sdd-disp-rewrite-tag {
    display: none;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    margin: 0 0 4px;
}
body[data-editor="1"] .sdd-disp-rewrite-tag { display: inline-block; }
.sdd-disp-rewrite-tag.rewritten { color: var(--jade); }
.sdd-disp-rewrite-tag.draft     { color: var(--signal); }

/* v7 §9.9 retract placeholder */
.sdd-disp-retracted { opacity: 0.7; }
.sdd-disp-retract-msg {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    line-height: 1.5;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

@media (max-width: 768px) {
    .sdd-disp { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-disp-item { grid-template-columns: 32px 1fr; gap: 12px; }
    .sdd-disp-city-head { flex-direction: column; align-items: flex-start; gap: 4px; }
}
`;
        document.head.appendChild(s);
    }

    function fmtDate(iso) {
        try { return new Date(iso).toISOString().slice(0, 10); }
        catch (e) { return ''; }
    }
    function fmtDateTime(iso) {
        try {
            const d = new Date(iso);
            return d.toISOString().slice(0, 10) + ' AT ' +
                d.toISOString().slice(11, 16) + ' KST';
        } catch (e) { return ''; }
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }
    // v7 검토 정정 — italic 헤드라인 끝 마침표/쉼표는 regular 로 분리 (영문 잡지 표준)
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }
    function safeUrl(u) {
        if (!u || typeof u !== 'string') return null;
        try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? url.toString() : null; }
        catch (e) { return null; }
    }

    // v6 §9.2 — 요일별 섹션 (Mon=visa, Tue=museum, Wed=city hall, Thu=desk,
    // Fri=editor's photo, Sat=quiet news, Sun=NO PUBLISH)
    const WEEKDAY_SECTIONS = {
        en: {
            1: 'VISA & POLICY NOTES',
            2: 'MUSEUM & GALLERY',
            3: 'CITY HALL NOTICES',
            4: 'NEW ON THE DESK',
            5: "EDITOR'S PHOTOGRAPH",
            6: 'QUIET NEWS',
            sundayMsg: 'Saudade does not publish on Sundays.',
            sundaySub:  'Dispatches resume Monday at 06:00 KST.',
            todayLabel: 'TODAY',
            archiveLabel: 'PAST WEEK',
            empty: 'No dispatch filed yet today.'
        },
        ko: {
            1: '비자·정책', 2: '박물관·갤러리', 3: '시·구청 공지',
            4: '편집부 신간', 5: '편집장의 사진', 6: '단신',
            sundayMsg: 'Saudade는 일요일에 발행하지 않는다.',
            sundaySub:  '월요일 새벽 6시(KST) 디스패치 재개.',
            todayLabel: '오늘', archiveLabel: '지난 한 주', empty: '오늘 발행된 디스패치가 아직 없다.'
        },
        ja: {
            1: 'ビザ・政策', 2: '美術館・ギャラリー', 3: '市役所通知',
            4: '編集部の新着', 5: '編集長の写真', 6: '小さなニュース',
            sundayMsg: 'Saudadeは日曜日に発行しない。',
            sundaySub:  '月曜日 朝6時(KST)に通信を再開する。',
            todayLabel: '本日', archiveLabel: '今週', empty: '本日の通信はまだ届いていない。'
        },
        pt: {
            1: 'VISTOS & POLÍTICA', 2: 'MUSEUS & GALERIAS', 3: 'AVISOS MUNICIPAIS',
            4: 'NOVO NA REDAÇÃO', 5: 'A FOTOGRAFIA DO EDITOR', 6: 'NOTÍCIAS QUIETAS',
            sundayMsg: 'A Saudade não publica aos domingos.',
            sundaySub:  'Os despachos voltam segunda às 06h00 KST.',
            todayLabel: 'HOJE', archiveLabel: 'A SEMANA PASSADA', empty: 'Nenhum despacho publicado hoje.'
        },
        es: {
            1: 'VISADOS Y POLÍTICA', 2: 'MUSEO Y GALERÍA', 3: 'AVISOS DEL AYUNTAMIENTO',
            4: 'NUEVO EN LA MESA', 5: 'LA FOTOGRAFÍA DEL EDITOR', 6: 'NOTICIAS QUIETAS',
            sundayMsg: 'Saudade no publica los domingos.',
            sundaySub:  'Los despachos vuelven el lunes a las 06:00 KST.',
            todayLabel: 'HOY', archiveLabel: 'LA SEMANA PASADA', empty: 'Aún no hay despacho publicado hoy.'
        }
    };

    function todayWeekday() {
        return new Date().getDay();   // 0=Sun, 1=Mon, ..., 6=Sat
    }

    function isSundayToday() {
        return todayWeekday() === 0;
    }

    // v7 §9.9 — dispatch retracts (worker /dispatches/retracted)
    let _retracts = null;
    let _retractsAt = 0;
    const RETRACTS_TTL = 60 * 1000;
    function fetchRetracts() {
        const base = (window.AURA_SERVER || '').replace(/\/$/, '');
        if (!base) return Promise.resolve([]);
        if (_retracts && (Date.now() - _retractsAt) < RETRACTS_TTL) return Promise.resolve(_retracts);
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return fetch(base + '/dispatches/retracted?edition=' + encodeURIComponent(ed), { cache: 'no-cache', credentials: 'omit' })
            .then(r => r.ok ? r.json() : null)
            .then(j => { _retracts = (j && j.retracts) || []; _retractsAt = Date.now(); return _retracts; })
            .catch(() => { _retracts = []; _retractsAt = Date.now(); return _retracts; });
    }
    function dispatchIdFor(item) {
        const city = (item._city || '').toLowerCase().replace(/\s+/g, '-');
        return city + '-' + (item.n || '');
    }
    function isRetracted(item) {
        if (!_retracts) return null;
        const id = dispatchIdFor(item);
        return _retracts.find(r => r.dispatch_id === id);
    }
    const RETRACT_MSG = {
        en: 'This dispatch was retracted by the editor.',
        ko: '편집장이 이 디스패치를 철회했다.',
        ja: 'この通信は編集長により撤回された。',
        pt: 'Este despacho foi retirado pelo editor.',
        es: 'Este despacho fue retirado por el editor.'
    };


    function renderItem(it) {
        // v7 §9.9 retract check
        const retract = isRetracted(it);
        if (retract) {
            if (retract.age_minutes < 30) return '';   // 완전 hide
            const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
            const msg = RETRACT_MSG[ed] || RETRACT_MSG.en;
            return `
                <article class="sdd-disp-item sdd-disp-retracted">
                    <span class="sdd-disp-num">${escapeHtml(it.n || '')}</span>
                    <div class="sdd-disp-body">
                        <p class="sdd-disp-retract-msg">${escapeHtml(msg)}</p>
                    </div>
                </article>
            `;
        }
        const safeSrc = safeUrl(it.source_url);
        const fulltext = it.body ? `<p class="sdd-disp-fulltext">${escapeHtml(it.body)}</p>` : '';
        const quoteHtml = it.quote
            ? `<p class="sdd-disp-quote">&ldquo;${escapeHtml(it.quote)}&rdquo;${it.quote_source ? ' — ' + escapeHtml(it.quote_source) : ''}</p>`
            : '';
        const srcLine = `${escapeHtml(it.source || '')}${it.source_date ? ' · ' + escapeHtml(it.source_date) : ''}`;
        const srcAnchor = safeSrc
            ? `<a href="${safeSrc}" target="_blank" rel="noopener noreferrer">${srcLine}</a>`
            : srcLine;
        const cityTag = it._city
            ? `<span class="sdd-disp-citytag">${escapeHtml(it._city)}${it._adjacent ? ' · ADJACENT' : ''}</span>`
            : '';
        return `
            <article class="sdd-disp-item">
                <span class="sdd-disp-num">${escapeHtml(it.n || '')}</span>
                <div class="sdd-disp-body">
                    ${cityTag}
                    <span class="sdd-disp-rewrite-tag ${it.human_rewritten === true ? 'rewritten' : 'draft'}">${it.human_rewritten === true ? 'REWRITTEN' : 'AI DRAFT'}</span>
                    <h3 class="sdd-disp-headline">${escapeHtml(it.headline || '')}</h3>
                    <p class="sdd-disp-lede">${escapeHtml(it.lede || '')}</p>
                    ${fulltext}
                    ${quoteHtml}
                    <p class="sdd-disp-source">${srcAnchor}</p>
                </div>
            </article>
        `;
    }

    // 시드 JSON 의 cities × items 9개 → 요일별 3개로 분배.
    // 정착 도시 2 + 주변 도시 1 (v6 §5.3 노출 비율).
    function flattenForDay(data, weekdayIdx /* 1..6 */) {
        const cities = (data && data.cities) || [];
        if (!cities.length) return [];
        const home = cities[0];        // 첫 번째 = 정착 도시
        const adjacent = cities.slice(1);    // 나머지 = 주변
        const homeItems = (home.items || []).slice(0, 9);
        const adjIdx = (weekdayIdx - 1) % Math.max(1, adjacent.length);
        const adjCity = adjacent[adjIdx];
        const adjItem = adjCity?.items?.[0] || null;

        // weekdayIdx 별로 home 의 다른 2개 + adjacent 1개
        // weekday 1 (Mon) → home items 0,1 + adj 0
        // weekday 2 (Tue) → home items 2,3 + adj 1
        // ...
        const baseHome = ((weekdayIdx - 1) * 2) % Math.max(1, homeItems.length);
        const out = [];
        const item1 = homeItems[baseHome] && { ...homeItems[baseHome], n: '01', _city: home.city, _adjacent: false };
        const item2 = homeItems[(baseHome + 1) % homeItems.length] && { ...homeItems[(baseHome + 1) % homeItems.length], n: '02', _city: home.city, _adjacent: false };
        if (item1) out.push(item1);
        if (item2) out.push(item2);
        if (adjItem) out.push({ ...adjItem, n: '03', _city: adjCity.city, _adjacent: true });
        return out;
    }

    // 지난 6일치 (월~토 중 오늘 제외) — archive stack
    function flattenPastWeek(data, todayIdx) {
        const result = [];
        // 어제부터 6일 거슬러 (같은 요일 다시 안 보이게 max 6)
        for (let back = 1; back <= 6; back++) {
            const d = new Date();
            d.setDate(d.getDate() - back);
            const wd = d.getDay();
            if (wd === 0) continue;   // 일요일 skip
            const items = flattenForDay(data, wd);
            if (!items.length) continue;
            result.push({
                date: d.toISOString().slice(0, 10),
                weekdayIdx: wd,
                items
            });
            if (result.length >= 3) break;   // 표시 max 3 days
        }
        return result;
    }

    function render(data) {
        let root = document.getElementById('sddDispatches');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddDispatches';
            root.className = 'sdd-disp';
            document.body.appendChild(root);
        }

        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const W = WEEKDAY_SECTIONS[ed] || WEEKDAY_SECTIONS.en;
        const wdIdx = todayWeekday();
        const filed = data && data.filed_at ? fmtDateTime(data.filed_at) : '';
        const next  = data && data.next_filing ? fmtDate(data.next_filing) : '';

        // v622 — 5 에디션 자국어 헤더
        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'The wires,', ko: '통신,', ja: '通信、',
            pt: 'Os despachos,', es: 'Los despachos,'
        });
        const headEdited = T({
            en: 'edited.', ko: '편집된.', ja: '編集ずみ。',
            pt: 'editados.', es: 'editados.'
        });
        const headResting = T({
            en: 'resting.', ko: '휴간.', ja: '休刊。',
            pt: 'em descanso.', es: 'en descanso.'
        });
        const subTpl = T({
            en: `Three a day. Six days a week. ${'$section'}.`,
            ko: `매일 세 편. 주 엿새. ${'$section'}.`,
            ja: `日に三本、週に六日。${'$section'}。`,
            pt: `Três por dia. Seis dias por semana. ${'$section'}.`,
            es: `Tres al día. Seis días por semana. ${'$section'}.`
        });
        const filedLabel = T({
            en: 'FILED', ko: '발행', ja: '発行', pt: 'PUBLICADO', es: 'PUBLICADO'
        });
        const nextLabel = T({
            en: 'NEXT FILING', ko: '다음 발행', ja: '次回発行',
            pt: 'PRÓXIMA EDIÇÃO', es: 'PRÓXIMA EDICIÓN'
        });
        const noteTitle = T({
            en: 'A note on sources.', ko: '출처에 대한 메모.',
            ja: '出典についての覚書。', pt: 'Uma nota sobre as fontes.',
            es: 'Una nota sobre las fuentes.'
        });
        const noteBody = T({
            en: 'Each dispatch is rewritten in our own words from the source listed. We quote no more than twenty-five words. We link to the original. We do not republish AP, Reuters, or Bloomberg copy. We never use photographs we did not take ourselves. Dispatches are AI-assisted and reviewed by a human editor.',
            ko: '각 디스패치는 명시된 출처에서 우리의 언어로 다시 쓴다. 인용은 25 단어를 넘지 않는다. 원문 링크를 단다. AP·Reuters·Bloomberg 의 기사는 재배포하지 않는다. 본인이 촬영하지 않은 사진은 사용하지 않는다. 디스패치는 AI 보조 작성 후 사람 편집장이 다시 쓴다.',
            ja: '各通信は明示された出典から自らの言葉で書き直す。引用は二十五語以内。出典リンクを付ける。AP・Reuters・Bloomberg の記事は再配布しない。自身で撮影していない写真は使わない。通信はAIの補助で執筆し、人間の編集長が手を入れる。',
            pt: 'Cada despacho é reescrito em nossas próprias palavras a partir da fonte listada. Citamos no máximo vinte e cinco palavras. Ligamos ao original. Não republicamos AP, Reuters ou Bloomberg. Nunca usamos fotografias que não tirámos. Os despachos são assistidos por IA e revistos por um editor humano.',
            es: 'Cada despacho se reescribe con nuestras propias palabras a partir de la fuente indicada. Citamos no más de veinticinco palabras. Enlazamos al original. No reeditamos copia de AP, Reuters o Bloomberg. Nunca usamos fotografías que no tomamos nosotros. Los despachos son asistidos por IA y revisados por un editor humano.'
        });

        // v7 검토 정정 — 면책 라벨 (toggle summary)
        const noteToggleLabel = T({
            en: 'A note on sources', ko: '출처에 대한 메모',
            ja: '出典についての覚書', pt: 'Uma nota sobre as fontes',
            es: 'Una nota sobre las fuentes'
        });

        // 일요일 휴간 (v6 §9.1)
        if (isSundayToday()) {
            root.innerHTML = `
                <header class="sdd-disp-head">
                    <h2 class="sdd-disp-h2">
                        ${dropItalicPunct(headLabel)}
                        <span class="it">${dropItalicPunct(headResting)}</span>
                    </h2>
                </header>
                <section class="sdd-disp-sunday">
                    <p class="sdd-disp-sunday-line">${escapeHtml(W.sundayMsg)}</p>
                    <p class="sdd-disp-sunday-sub">${escapeHtml(W.sundaySub)}</p>
                </section>
                <details class="sdd-disp-foot">
                    <summary class="sdd-disp-disclaimer-toggle">${escapeHtml(noteToggleLabel)}</summary>
                    <p class="sdd-disp-disclaimer">
                        <strong>${escapeHtml(noteTitle)}</strong> ${escapeHtml(noteBody)}
                    </p>
                </details>
            `;
            return;
        }

        // 오늘의 3 dispatch (정착 2 + 주변 1)
        const todayItems = flattenForDay(data, wdIdx);
        const todaySection = W[wdIdx] || W[1];
        const todayHtml = todayItems.length
            ? todayItems.map(renderItem).join('')
            : `<p class="sdd-disp-empty">${escapeHtml(W.empty)}</p>`;

        // 지난 6일 archive stack
        const past = flattenPastWeek(data, wdIdx);
        const pastHtml = past.map(d => `
            <section class="sdd-disp-archive-day">
                <header class="sdd-disp-archive-head">
                    <span class="sdd-disp-archive-date">${escapeHtml(d.date)}</span>
                    <span class="sdd-disp-archive-section">${escapeHtml(W[d.weekdayIdx] || '')}</span>
                </header>
                ${d.items.map(renderItem).join('')}
            </section>
        `).join('');

        const subFilled = subTpl.replace('$section', todaySection);
        const headHtml = `
            <header class="sdd-disp-head">
                <h2 class="sdd-disp-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="it">${dropItalicPunct(headEdited)}</span>
                </h2>
                <p class="sdd-disp-sub">${escapeHtml(subFilled)}</p>
                <p class="sdd-disp-meta">${escapeHtml(filedLabel)} ${escapeHtml(filed)} · ${escapeHtml(nextLabel)} ${escapeHtml(next)}</p>
            </header>
        `;

        const todayBlock = `
            <section class="sdd-disp-today">
                <header class="sdd-disp-day-head">
                    <span class="sdd-disp-day-eyebrow">${escapeHtml(W.todayLabel)}</span>
                    <span class="sdd-disp-day-section">${escapeHtml(todaySection)}</span>
                </header>
                ${todayHtml}
            </section>
        `;

        const archiveBlock = past.length ? `
            <section class="sdd-disp-archive">
                <header class="sdd-disp-archive-mast">
                    <span class="sdd-disp-day-eyebrow">${escapeHtml(W.archiveLabel)}</span>
                </header>
                ${pastHtml}
            </section>
        ` : '';

        const disclaimer = `
            <details class="sdd-disp-foot">
                <summary class="sdd-disp-disclaimer-toggle">${escapeHtml(noteToggleLabel)}</summary>
                <p class="sdd-disp-disclaimer">
                    <strong>${escapeHtml(noteTitle)}</strong> ${escapeHtml(noteBody)}
                </p>
            </details>
        `;

        root.innerHTML = headHtml + todayBlock + archiveBlock + disclaimer;
    }

    function init() {
        injectStyles();
        // 두 fetch 다 끝나고 render — retract 리스트가 생겨야 필터링 정확
        Promise.all([load(), fetchRetracts()]).then(([d]) => render(d));
        // section 진입 + edition 변경 시 재로드
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '03') {
                load().then(render);
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_DISPATCHES = { reload: () => { _cache = {}; init(); } };
})();
