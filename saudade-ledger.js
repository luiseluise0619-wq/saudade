// SAUDADE · § 01 THE LEDGER (헌법 §4-2)
// 풀 구현. 비자 입국 기록 인라인 폼 (모달 X). D-day Fraunces italic 88px rust.
// 세금 거주일 단순 합산 (KR 47/183 등).
// 헌법 §9 키:
//   saudade.visa.entries = [{ country, type, days, entered, expiry }]
//   saudade.tax.entries = [{ country, days, year }]
'use strict';

(function() {
    if (window.SAUDADE_LEDGER) return;

    const KEY_VISA = 'saudade.visa.entries';   // legacy + visa records
    const KEY_TAX  = 'saudade.tax.entries';    // 자동 계산되므로 광범위 X

    // v6 §7 — 4 카운트다운 카테고리 (visa / tax / insurance / pension)
    // 데이터 schema: { id, type, country/iso, label, entered, expiry, source_url }
    // 기존 KEY_VISA 에 type 필드 추가 (default 'visa' — 하위 호환)

    // 비자 타입별 일수 (수동 큐레이션 — 알고리즘 X)
    const VISA_TYPES = [
        { code: 'k-eta',     label: 'K-ETA',           days: 90,  iso: 'KR' },
        { code: 'visa-free', label: 'Visa-free',       days: 90,  iso: '*'  },
        { code: 'visa-180',  label: 'Visa-free 180D',  days: 180, iso: '*' },
        { code: 'visa-365',  label: 'Visa-free 365D',  days: 365, iso: '*' },
        { code: 'd-2',       label: 'D-2 Student',     days: 365, iso: 'KR' },
        { code: 'd-10',      label: 'D-10 Job',        days: 180, iso: 'KR' },
        { code: 'd7-pt',     label: "Portugal D7 Visa", days: 365, iso: 'PT' },
        { code: 'shengen',   label: 'Schengen 90/180', days: 90,  iso: 'EU' },
        { code: 'other',     label: 'Other',           days: 30,  iso: '*' }
    ];

    // 4 카테고리 정의 (v6 §7.1)
    const CATEGORIES = [
        {
            type: 'visa',
            label: 'VISA',
            article: 'PORTUGAL D7, IN FIVE LINES.',
            articleBody: 'The visa permits remote workers earning over €820/mo to reside for one year, renewable. Verify with your consulate.',
            note: '<strong>A note from the desk.</strong> Visa policy changes without warning. Verify with the embassy of the country you are visiting. We do not guarantee accuracy.'
        },
        {
            type: 'tax',
            label: 'TAX RESIDENCY',
            article: 'A CALENDAR, NOT A CALCULATOR.',
            articleBody: 'You entered each country on the date listed. We count the days since. We do not calculate residency thresholds.',
            note: '<strong>A note from the desk.</strong> We are not your accountant. We do not file your taxes. This is a calendar, not advice. Verify with your tax authority before making any decision.'
        },
        {
            type: 'insurance',
            label: 'HEALTH INSURANCE',
            article: 'KOREA NHIS, ON PAUSE.',
            articleBody: 'Korean National Health Insurance can be paused while abroad. Restart on return. The countdown below is your own record.',
            note: '<strong>A note from the desk.</strong> Insurance enrolment is your responsibility. Confirm dates with NHIS or your local provider.'
        },
        {
            type: 'pension',
            label: 'PENSION',
            article: 'OVERSEAS RESIDENCY, FILED.',
            articleBody: 'Korean National Pension allows overseas residency notification (해외체류 신고). The date below is your own record.',
            note: '<strong>A note from the desk.</strong> Pension status is your responsibility. Verify with the National Pension Service.'
        }
    ];

    function getVisas() {
        try { return JSON.parse(localStorage.getItem(KEY_VISA) || '[]'); }
        catch (e) { return []; }
    }
    function setVisas(arr) {
        try { localStorage.setItem(KEY_VISA, JSON.stringify(arr)); } catch (e) {}
    }

    // 활성 비자 = expiry 가 오늘 이후 + 가장 가까운 expiry
    function activeVisa() {
        const v = getVisas();
        const today = Date.now();
        const active = v
            .map(e => ({ ...e, _ms: new Date(e.expiry).getTime() }))
            .filter(e => Number.isFinite(e._ms) && e._ms > today)
            .sort((a, b) => a._ms - b._ms);
        return active[0] || null;
    }

    function daysLeft(expiryStr) {
        const ms = new Date(expiryStr).getTime() - Date.now();
        return Math.ceil(ms / 86400000);
    }

    // 세금 거주일 자동 합산 — 비자 entries 의 나라별 days_in_country 단순 sum
    function taxResidency() {
        const v = getVisas();
        const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
        const result = {};   // ISO → days
        v.forEach(e => {
            if (!e.entered || !e.iso) return;
            const enteredMs = new Date(e.entered).getTime();
            if (!Number.isFinite(enteredMs)) return;
            const expiryMs = e.expiry ? new Date(e.expiry).getTime() : Date.now();
            const start = Math.max(enteredMs, yearStart);
            const end = Math.min(expiryMs, Date.now());
            if (end > start) {
                const days = Math.floor((end - start) / 86400000);
                result[e.iso] = (result[e.iso] || 0) + days;
            }
        });
        return result;
    }

    function injectStyles() {
        if (document.getElementById('sddLedgerStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddLedgerStyles';
        s.textContent = `
.sdd-ledger {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="01"] .sdd-ledger { display: block; }

.sdd-ld-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-ld-h2 .it { font-style: italic; display: block; }

/* D-day 큰 숫자 (헌법 §4-2: Fraunces italic 88px rust) */
.sdd-ld-dday {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: clamp(20px, 4vw, 48px);
    align-items: end;
    padding: clamp(32px, 5vw, 64px) 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-dday-info dt {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    line-height: 1.6;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-bottom: 4px;
}
.sdd-ld-dday-info dd {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 14px;
    line-height: 1;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
    margin: 0 0 14px 0;
}
.sdd-ld-dday-num {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(72px, 11vw, 144px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-data-num);
    color: var(--rust);
    text-align: right;
    margin: 0;
}
.sdd-ld-dday-num.warn { color: var(--signal); }
.sdd-ld-dday-num.expired { color: var(--bone); }
.sdd-ld-dday-unit {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: right;
    margin-top: 6px;
}

/* 세금 거주일 — KR 47/183 같은 표 */
.sdd-ld-tax {
    padding: clamp(20px, 3vw, 32px) 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-tax-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px 32px;
}
.sdd-ld-tax-row {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 13px;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-tax-iso {
    font-weight: 500;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-ld-tax-num { color: var(--ink); }
.sdd-ld-tax-num .resident { color: var(--rust); }

/* 입국 기록 리스트 */
.sdd-ld-entries {
    padding: clamp(20px, 3vw, 32px) 0;
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-entry {
    display: grid;
    grid-template-columns: 60px 1fr auto auto;
    gap: 12px;
    padding: 12px 0;
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
    align-items: baseline;
}
.sdd-ld-entry:first-child { border-top: 0; }
.sdd-ld-entry .iso {
    font-weight: 500;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-ld-entry .type { color: var(--bone-d); text-transform: uppercase; letter-spacing: var(--tr-mono-meta); }
.sdd-ld-entry .dates { color: var(--ink); white-space: nowrap; }
.sdd-ld-entry .rm {
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-size: 12px;
    width: 32px; height: 32px;
    cursor: pointer;
    border-radius: 4px;
    transition: color .12s, border-color .12s;
}
.sdd-ld-entry .rm:hover { color: var(--rust); border-color: var(--rust); }

/* 인라인 폼 (모달 X) — ADD A NEW ENTRY */
.sdd-ld-form {
    display: grid;
    grid-template-columns: 80px 1fr 140px 140px 80px;
    gap: 16px;
    padding: 24px 0 0;
    align-items: end;
}
.sdd-ld-form label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 9.5px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin-bottom: 6px;
    display: block;
}
.sdd-ld-form input, .sdd-ld-form select {
    background: var(--paper);
    border: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 12px;
    letter-spacing: var(--tr-mono-data);
    padding: 10px 12px;
    border-radius: 4px;
    min-height: 44px;
    width: 100%;
    box-sizing: border-box;
    text-transform: uppercase;
}
.sdd-ld-form button {
    background: transparent;
    border: 0.5px solid var(--ink);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    cursor: pointer;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 4px;
    transition: background .12s, color .12s;
}
.sdd-ld-form button:hover { background: var(--ink); color: var(--paper); }

/* v6 §7.1 — 4 카테고리 섹션 (visa/tax/insurance/pension) */
.sdd-ld-cat {
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-ld-cat-head {
    margin: 0 0 clamp(16px, 2vw, 24px);
}
.sdd-ld-cat-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(8px, 1vw, 12px);
}
.sdd-ld-cat-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.4vw, 32px);
    line-height: 1.15;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
    margin: 0 0 clamp(8px, 1vw, 14px);
}
.sdd-ld-cat-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
    max-width: 60ch;
}
.sdd-ld-cat-records {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: clamp(16px, 2vw, 24px) 0;
}
.sdd-ld-cat-note {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: clamp(12px, 1.5vw, 18px) 0 0;
}
.sdd-ld-cat-note strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 4px;
}
.sdd-ld-empty {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone);
    padding: 16px 0;
}

/* 단일 record 카드 */
.sdd-ld-record {
    padding: 14px 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-ld-record:last-child { border-bottom: 0.5px solid var(--rule); }
.sdd-ld-record-meta {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin: 0 0 8px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: var(--tr-mono-data);
}
.sdd-ld-record-meta .iso {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
}
.sdd-ld-record-meta .label {
    color: var(--bone-d);
    text-transform: uppercase;
    letter-spacing: var(--tr-mono-meta);
    flex: 1;
}
.sdd-ld-record-meta .rm {
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-size: 12px;
    width: 28px; height: 28px;
    cursor: pointer;
    transition: color .12s, border-color .12s;
    border-radius: 4px;
}
.sdd-ld-record-meta .rm:hover { color: var(--rust); border-color: var(--rust); }

/* tax 단순 카운트 (v6 §7.3) — 한 줄 산문 */
.sdd-ld-record-line {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
}
.sdd-ld-record-line strong { font-weight: 300; color: var(--accent, var(--rust)); font-style: italic; }

/* visa/insurance/pension D-day */
.sdd-ld-record-dday {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: clamp(12px, 2vw, 24px);
    align-items: baseline;
}
.sdd-ld-record-num {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(56px, 8vw, 88px);
    line-height: 1;
    letter-spacing: var(--tr-fraunces-data-num);
    color: var(--rust);
    margin: 0;
}
.sdd-ld-record-num.warn { color: var(--signal); }
.sdd-ld-record-num.expired { color: var(--bone); }
.sdd-ld-record-unit {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

/* v6 §7.2 — 기사 인트로 (Ledger 를 잡지 톤으로) */
.sdd-ld-article {
    padding: clamp(20px, 3vw, 32px) 0;
    border-bottom: 0.5px solid var(--rule);
    margin: 0 0 clamp(24px, 4vw, 40px);
}
.sdd-ld-article-eyebrow {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--accent, var(--rust));
    margin: 0 0 clamp(10px, 1.4vw, 16px);
}
.sdd-ld-article-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.55;
    color: var(--ink);
    margin: 0;
    max-width: 60ch;
}
.sdd-ld-article-body em {
    font-style: italic;
    color: var(--ink);
}

/* Notes from the desk (Handoff v2 §7.1) */
.sdd-ld-note {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
}
.sdd-ld-note-body {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
    margin: 0;
}
.sdd-ld-note-body strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

@media (max-width: 768px) {
    .sdd-ledger { padding: 88px 16px calc(var(--dock-h, 56px) + 80px); }
    .sdd-ld-dday { grid-template-columns: 1fr; gap: 16px; }
    .sdd-ld-dday-num { text-align: left; font-size: clamp(64px, 18vw, 96px); }
    .sdd-ld-dday-unit { text-align: left; }
    .sdd-ld-form { grid-template-columns: 1fr 1fr; }
    .sdd-ld-form button { grid-column: 1 / -1; }
    .sdd-ld-entry { grid-template-columns: 50px 1fr 32px; gap: 8px; }
    .sdd-ld-entry .dates { grid-column: 2; }
}
`;
        document.head.appendChild(s);
    }

    function fmtDate(s) {
        if (!s) return '—';
        try { return new Date(s).toISOString().slice(0, 10); } catch (e) { return s; }
    }

    function render() {
        let root = document.getElementById('sddLedger');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddLedger';
            root.className = 'sdd-ledger';
            document.body.appendChild(root);
        }

        const records = getVisas();   // unified ledger (각 record 에 type 필드)
        const today = new Date().toISOString().slice(0, 10);

        // category 별로 records 그룹 (v6 §7.1)
        // legacy 호환: typeCategory 없으면 모두 'visa' 로 (v617 이전 데이터).
        function recordsOf(category) {
            return records
                .map((r, i) => ({ ...r, _idx: i }))
                .filter(r => {
                    const cat = (r.typeCategory || 'visa').toLowerCase();
                    return cat === category;
                });
        }

        // 한 record 를 type 에 맞게 렌더 (visa/insurance/pension = D-day, tax = elapsed)
        function recordCard(r, cat) {
            const isTax = cat.type === 'tax';
            if (isTax) {
                // 단순 카운트만 (계산 X, 임계값 X — v6 §7.3)
                const enteredMs = new Date(r.entered).getTime();
                const elapsed = Number.isFinite(enteredMs)
                    ? Math.floor((Date.now() - enteredMs) / 86400000)
                    : 0;
                return `
                    <article class="sdd-ld-record">
                        <div class="sdd-ld-record-meta">
                            <span class="iso">${escapeHtml(r.iso || '—')}</span>
                            <span class="label">${escapeHtml(r.label || cat.label.toLowerCase())}</span>
                            <button class="rm" data-rm="${r._idx}" aria-label="Remove">×</button>
                        </div>
                        <p class="sdd-ld-record-line">
                            You entered <strong>${escapeHtml(r.iso || '—')}</strong> on
                            <strong>${fmtDate(r.entered)}</strong>.
                            That was <strong>${elapsed}</strong> day${elapsed === 1 ? '' : 's'} ago.
                        </p>
                    </article>
                `;
            }
            // visa / insurance / pension — D-day countdown
            const dleft = r.expiry ? daysLeft(r.expiry) : null;
            const cls = dleft == null ? 'expired'
                      : dleft < 7  ? 'expired'
                      : dleft < 15 ? 'warn'
                      : '';
            return `
                <article class="sdd-ld-record">
                    <div class="sdd-ld-record-meta">
                        <span class="iso">${escapeHtml(r.iso || '—')}</span>
                        <span class="label">${escapeHtml(r.type || r.label || '')}</span>
                        <button class="rm" data-rm="${r._idx}" aria-label="Remove">×</button>
                    </div>
                    <div class="sdd-ld-record-dday">
                        <p class="sdd-ld-record-num ${cls}">${dleft != null ? Math.max(0, dleft) : '—'}</p>
                        <p class="sdd-ld-record-unit">days left · expires ${fmtDate(r.expiry)}</p>
                    </div>
                </article>
            `;
        }

        // 4 카테고리 섹션 렌더 (헌법 §7.1)
        const categoriesHtml = CATEGORIES.map(cat => {
            const rows = recordsOf(cat.type);
            const cardsHtml = rows.length
                ? rows.map(r => recordCard(r, cat)).join('')
                : '<p class="sdd-ld-empty">No entries yet. Add below.</p>';
            return `
                <section class="sdd-ld-cat" data-cat="${cat.type}">
                    <header class="sdd-ld-cat-head">
                        <p class="sdd-ld-cat-eyebrow">§ ${escapeHtml(cat.label)}</p>
                        <h3 class="sdd-ld-cat-headline">${escapeHtml(cat.article)}</h3>
                        <p class="sdd-ld-cat-body">${escapeHtml(cat.articleBody)}</p>
                    </header>
                    <div class="sdd-ld-cat-records">${cardsHtml}</div>
                    <p class="sdd-ld-cat-note">${cat.note}</p>
                </section>
            `;
        }).join('');

        // ADD 폼 — type selector 추가 (4 카테고리)
        const typeOptions = CATEGORIES.map(cat =>
            `<option value="${cat.type}">${escapeHtml(cat.label)}</option>`
        ).join('');

        const formHtml = `
            <form class="sdd-ld-form" data-add-entry>
                <div>
                    <label for="ld-cat">Category</label>
                    <select id="ld-cat" name="cat" required>
                        ${typeOptions}
                    </select>
                </div>
                <div>
                    <label for="ld-iso">Country</label>
                    <input type="text" id="ld-iso" name="iso" placeholder="KR" maxlength="3" required />
                </div>
                <div>
                    <label for="ld-type">Sub-type</label>
                    <select id="ld-type" name="type" required>
                        ${VISA_TYPES.map(t => `<option value="${t.code}" data-days="${t.days}">${t.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="ld-entered">Entered</label>
                    <input type="date" id="ld-entered" name="entered" value="${today}" required />
                </div>
                <div data-expiry-wrap>
                    <label for="ld-expiry">Expiry</label>
                    <input type="date" id="ld-expiry" name="expiry" />
                </div>
                <div>
                    <label>&nbsp;</label>
                    <button type="submit">ADD</button>
                </div>
            </form>
        `;

        // v6 §7.2 — Ledger 기사 톤 (PORTUGAL D7, IN FIVE LINES) — 5 에디션 i18n
        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'How many days',  ko: '남은 날짜는',
            ja: 'のこされた日々',  pt: 'Quantos dias',
            es: 'Cuántos días'
        });
        const headItalic = T({
            en: 'remain.', ko: '얼마나 남았는가.', ja: 'いくつ。',
            pt: 'restam.', es: 'quedan.'
        });
        const introEyebrow = T({
            en: 'A LEDGER, IN FOUR COLUMNS.', ko: '네 칸의 장부.',
            ja: '四欄の台帳。', pt: 'UM LIVRO-RAZÃO, EM QUATRO COLUNAS.',
            es: 'UN LIBRO MAYOR, EN CUATRO COLUMNAS.'
        });
        const introBody = T({
            en: 'The four numbers a digital nomad watches each morning: <em>how many days the visa permits, how long since the last entry to a tax country, when health insurance pauses, when pension residency files.</em> This page is a calendar, not advice.',
            ko: '디지털 노마드가 매일 아침 들여다보는 네 가지 숫자입니다: <em>비자가 허용한 날짜, 가장 최근 입국 후 며칠 지났는가, 건강보험은 언제 정지되는가, 연금 해외체류 신고는 언제인가.</em> 이 페이지는 달력이지 조언이 아닙니다.',
            ja: 'デジタルノマドが毎朝確かめる四つの数字 — <em>ビザの許可する日数、最後の入国から何日たったか、健康保険がいつ止まるか、年金の海外居住届はいつか。</em>このページは暦であり、助言ではありません。',
            pt: 'Os quatro números que um nómada digital observa todas as manhãs: <em>quantos dias o visto permite, quanto tempo desde a última entrada num país fiscal, quando o seguro de saúde pausa, quando o registo de pensão é apresentado.</em> Esta página é um calendário, não um conselho.',
            es: 'Los cuatro números que un nómada digital mira cada mañana: <em>cuántos días permite el visado, cuánto tiempo desde la última entrada a un país fiscal, cuándo se pausa el seguro de salud, cuándo se presenta la residencia del pensión.</em> Esta página es un calendario, no un consejo.'
        });

        const articleIntro = `
            <article class="sdd-ld-article">
                <p class="sdd-ld-article-eyebrow">${escapeHtml(introEyebrow)}</p>
                <p class="sdd-ld-article-body">${introBody}</p>
            </article>
        `;

        root.innerHTML = `
            <header class="sdd-ld-head">
                <h2 class="sdd-ld-h2">
                    ${escapeHtml(headLabel)}
                    <span class="it">${escapeHtml(headItalic)}</span>
                </h2>
            </header>
            ${articleIntro}
            ${categoriesHtml}
            ${formHtml}
        `;

        // 폼 핸들러 — type 변경 시 expiry 자동 계산
        const form = root.querySelector('[data-add-entry]');
        if (form) {
            const enteredEl = form.querySelector('#ld-entered');
            const typeEl = form.querySelector('#ld-type');
            const expiryEl = form.querySelector('#ld-expiry');
            const recalc = () => {
                const enteredVal = enteredEl.value;
                const opt = typeEl.selectedOptions[0];
                const days = parseInt(opt?.dataset.days, 10) || 90;
                if (enteredVal) {
                    const exp = new Date(new Date(enteredVal).getTime() + days * 86400000);
                    expiryEl.value = exp.toISOString().slice(0, 10);
                }
            };
            enteredEl.addEventListener('change', recalc);
            typeEl.addEventListener('change', recalc);
            recalc();   // 초기 계산

            form.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const fd = new FormData(form);
                const opt = typeEl.selectedOptions[0];
                const isoRaw = String(fd.get('iso') || '').trim().toUpperCase();
                // 2-3자 letter only 검증
                if (!/^[A-Z]{2,3}$/.test(isoRaw)) {
                    const inp = form.querySelector('#ld-iso');
                    inp?.setAttribute('aria-invalid', 'true');
                    inp?.focus();
                    return;
                }
                const cat = String(fd.get('cat') || 'visa').toLowerCase();
                const entry = {
                    typeCategory: cat,                     // v6 — visa/tax/insurance/pension
                    iso: isoRaw,
                    type: opt?.textContent || String(fd.get('type') || ''),
                    days: parseInt(opt?.dataset.days, 10) || 90,
                    entered: String(fd.get('entered') || ''),
                    expiry: String(fd.get('expiry') || '')
                };
                // tax 는 expiry 불필요 — 단순 카운트 (v6 §7.3)
                if (!entry.iso || !entry.entered) return;
                if (cat !== 'tax' && !entry.expiry) return;
                const all = getVisas();
                all.push(entry);
                setVisas(all);
                render();
            });
            // 카테고리 변경 시 expiry 필드 visibility 토글
            const catEl = form.querySelector('#ld-cat');
            const expWrap = form.querySelector('[data-expiry-wrap]');
            const expEl = form.querySelector('#ld-expiry');
            const onCatChange = () => {
                const isTax = catEl.value === 'tax';
                if (expWrap) expWrap.style.display = isTax ? 'none' : '';
                if (expEl) expEl.required = !isTax;
            };
            catEl?.addEventListener('change', onCatChange);
            onCatChange();
        }

        // 삭제
        root.querySelectorAll('[data-rm]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-rm'), 10);
                const all = getVisas();
                all.splice(idx, 1);
                setVisas(all);
                render();
            });
        });
    }

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    function init() {
        injectStyles();
        render();
        // body section 변경 감지 — 01 진입 시 재렌더
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '01') render();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
        // 1분마다 D-day 갱신
        setInterval(() => {
            if (document.body.getAttribute('data-section') === '01') render();
        }, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_LEDGER = { render, getVisas, setVisas, activeVisa, daysLeft, taxResidency };
})();
