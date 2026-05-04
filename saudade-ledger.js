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
    /* v7 검토 정정 — 이중선 방지: 다음 .sdd-ld-article 또는 empty-state 가 자체 border 가짐 */
}
.sdd-ld-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-ld-h2 .it { font-style: italic; display: inline; }

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
.sdd-ld-dday-num.expired { color: var(--bone-d); }
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
    color: var(--bone-d);
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
.sdd-ld-record-num.expired { color: var(--bone-d); }
.sdd-ld-record-unit {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 11px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0;
}

/* v7 검토 정정 — 편집부 배지 + 사용자 기록 라벨 */
.sdd-ld-editorial-badge {
    color: var(--rust);
    font-weight: 500;
    letter-spacing: var(--tr-mono-mast);
}
.sdd-ld-records-label {
    margin: clamp(20px, 3vw, 28px) 0 8px;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    padding-bottom: 6px;
    border-bottom: 0.5px solid var(--rule);
}

/* v7 검토 정정 — 빈 상태 (잡지의 빈 페이지처럼) */
.sdd-ld-empty-state {
    padding: clamp(24px, 4vw, 40px) 0;
    margin: 0 0 clamp(24px, 4vw, 40px);
    border-bottom: 0.5px solid var(--rule);
}
.sdd-ld-empty-h3 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.2;
    letter-spacing: var(--tr-fraunces-h3);
    color: var(--ink);
    margin: 0 0 12px;
}
.sdd-ld-empty-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-ld-empty-actions {
    list-style: none;
    margin: 0 0 clamp(20px, 3vw, 28px);
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.sdd-ld-empty-actions li {
    border-top: 0.5px solid var(--rule);
    margin: 0;
}
/* 마지막 항목 border-bottom 없음 — 잡지 리스트 분리선만 (박스 X) */
.sdd-ld-empty-btn {
    background: transparent;
    border: 0;
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    text-align: left;
    padding: 14px 0;
    width: 100%;
    cursor: pointer;
    border-radius: 0;
    transition: color .12s;
    min-height: 44px;
}
.sdd-ld-empty-btn:hover { color: var(--rust); }
.sdd-ld-empty-note {
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
    .sdd-ledger { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
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

        // v7 검토 정정 — i18n 헬퍼와 라벨은 categoriesHtml 평가 전에 선언해야 한다 (TDZ 방지).
        // 이전엔 const editorialBadge / yourRecordsLabel 가 .map() 콜백 뒤에 선언되어
        // ReferenceError 로 render() 자체가 throw → Ledger 가 빈 화면으로 보임.
        const T = window.SAUDADE_T || ((s) => s.en);
        const editorialBadge = T({
            en: 'EDITORIAL',  ko: '편집부',  ja: '編集部',
            pt: 'EDITORIAL',  es: 'EDITORIAL'
        });
        const yourRecordsLabel = T({
            en: 'YOUR RECORDS', ko: '내 기록',
            ja: 'あなたの記録',
            pt: 'OS SEUS REGISTOS', es: 'TUS REGISTROS'
        });

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
                            <button class="rm" data-rm="${r._idx}" aria-label="${escapeHtml(T({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }))}">×</button>
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
                        <button class="rm" data-rm="${r._idx}" aria-label="${escapeHtml(T({ en: 'Remove', ko: '삭제', ja: '削除', pt: 'Remover', es: 'Eliminar' }))}">×</button>
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
                        <p class="sdd-ld-cat-eyebrow">§ ${escapeHtml(cat.label)} · <span class="sdd-ld-editorial-badge">${escapeHtml(editorialBadge)}</span></p>
                        <h3 class="sdd-ld-cat-headline">${escapeHtml(cat.article)}</h3>
                        <p class="sdd-ld-cat-body">${escapeHtml(cat.articleBody)}</p>
                    </header>
                    ${rows.length ? `<p class="sdd-ld-records-label">${escapeHtml(yourRecordsLabel)}</p>` : ''}
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
        // (T / editorialBadge / yourRecordsLabel 는 위에서 이미 선언 — TDZ 방지)
        const headLabel = T({
            en: 'How many days',  ko: '며칠이',
            ja: 'のこされた日々',  pt: 'Quantos dias',
            es: 'Cuántos días'
        });
        const headItalic = T({
            en: 'remain.', ko: '남았는가.', ja: 'いくつ。',
            pt: 'restam.', es: 'quedan.'
        });
        const introEyebrow = T({
            en: 'A LEDGER, IN FOUR COLUMNS.', ko: '네 칸의 장부.',
            ja: '四欄の台帳。', pt: 'UM LIVRO-RAZÃO, EM QUATRO COLUNAS.',
            es: 'UN LIBRO MAYOR, EN CUATRO COLUMNAS.'
        });
        const introBody = T({
            en: 'The four numbers a digital nomad watches each morning: <em>how many days the visa permits, how long since the last entry to a tax country, when health insurance pauses, when pension residency files.</em> This page is a calendar, not advice.',
            ko: '디지털 노마드가 매일 아침 들여다보는 네 가지 숫자다: <em>비자가 허용한 날짜, 가장 최근 입국 후 며칠 지났는가, 건강보험은 언제 정지되는가, 연금 해외체류 신고는 언제인가.</em> 이 페이지는 달력이지 조언이 아니다.',
            ja: 'デジタルノマドが毎朝確かめる四つの数字 — <em>ビザの許可する日数、最後の入国から何日たったか、健康保険がいつ止まるか、年金の海外居住届はいつか。</em>このページは暦であり、助言ではない。',
            pt: 'Os quatro números que um nómada digital observa todas as manhãs: <em>quantos dias o visto permite, quanto tempo desde a última entrada num país fiscal, quando o seguro de saúde pausa, quando o registo de pensão é apresentado.</em> Esta página é um calendário, não um conselho.',
            es: 'Los cuatro números que un nómada digital mira cada mañana: <em>cuántos días permite el visado, cuánto tiempo desde la última entrada a un país fiscal, cuándo se pausa el seguro de salud, cuándo se presenta la residencia de pensión.</em> Esta página es un calendario, no un consejo.'
        });

        const articleIntro = `
            <article class="sdd-ld-article">
                <p class="sdd-ld-article-eyebrow">${escapeHtml(introEyebrow)}</p>
                <p class="sdd-ld-article-body">${introBody}</p>
            </article>
        `;

        // v7 검토 정정 — 전체 빈 상태 안내 (records 0일 때만)
        // 잡지의 빈 페이지처럼 — 추가 액션 4개 + 편집부 메모.
        const emptyHeadline = T({
            en: 'Nothing on the ledger yet.',
            ko: '아직 장부에 적힌 것이 없다.',
            ja: 'まだ台帳に何も書かれていない。',
            pt: 'Nada no livro-razão ainda.',
            es: 'Nada en el libro mayor todavía.'
        });
        const emptyBody = T({
            en: 'Add a visa, a tax-residency entry, a health-insurance pause, or a pension filing below. Each entry is a row this newspaper will count from tomorrow morning.',
            ko: '아래에서 비자·세금 거주일·건강보험 정지·연금 신고를 추가한다. 각 항목은 이 신문이 내일 아침부터 헤아릴 한 줄이 된다.',
            ja: '下のフォームからビザ・税居住日・健康保険の停止・年金届出を加える。一つひとつが、明朝からこの新聞が数える一行になる。',
            pt: 'Adicione um visto, uma entrada de residência fiscal, uma pausa de seguro de saúde ou um registo de pensão em baixo. Cada entrada é uma linha que este jornal contará a partir de amanhã de manhã.',
            es: 'Añade un visado, una entrada de residencia fiscal, una pausa de seguro de salud o un registro de pensión abajo. Cada entrada es una fila que este periódico contará desde mañana por la mañana.'
        });
        const addLabel = {
            visa:      T({ en: 'Add a visa',                ko: '비자 추가',          ja: 'ビザを追加',           pt: 'Adicionar um visto',                  es: 'Añadir un visado' }),
            tax:       T({ en: 'Add a tax-residency entry', ko: '세금 거주일 추가',    ja: '税居住日を追加',        pt: 'Adicionar entrada fiscal',            es: 'Añadir entrada fiscal' }),
            insurance: T({ en: 'Add a health-insurance entry', ko: '건강보험 항목 추가',  ja: '健康保険を追加',        pt: 'Adicionar entrada de seguro',         es: 'Añadir entrada de seguro' }),
            pension:   T({ en: 'Add a pension entry',       ko: '연금 항목 추가',      ja: '年金届出を追加',        pt: 'Adicionar entrada de pensão',         es: 'Añadir entrada de pensión' })
        };
        const editorNote = T({
            en: 'A note from the editor. We never store your visa data on a server. It lives on this device only — clear your browser, and it disappears with you.',
            ko: '편집장의 메모. 비자 데이터는 서버에 저장하지 않는다. 이 기기에만 머문다 — 브라우저를 비우면 함께 사라진다.',
            ja: '編集長より。ビザの情報はサーバーに保存しない。この端末だけにある — ブラウザを消せば、ともに消える。',
            pt: 'Uma nota do editor. Nunca guardamos os seus dados de visto num servidor. Vivem apenas neste dispositivo — limpe o navegador, e desaparecem consigo.',
            es: 'Una nota del editor. Nunca guardamos sus datos de visado en un servidor. Viven sólo en este dispositivo — limpie el navegador, y desaparecen con usted.'
        });
        const isLedgerEmpty = records.length === 0;
        const emptyStateHtml = isLedgerEmpty ? `
            <section class="sdd-ld-empty-state">
                <h3 class="sdd-ld-empty-h3">${escapeHtml(emptyHeadline)}</h3>
                <p class="sdd-ld-empty-body">${escapeHtml(emptyBody)}</p>
                <ul class="sdd-ld-empty-actions">
                    <li><button type="button" class="sdd-ld-empty-btn" data-jump-cat="visa">+ ${escapeHtml(addLabel.visa)}</button></li>
                    <li><button type="button" class="sdd-ld-empty-btn" data-jump-cat="tax">+ ${escapeHtml(addLabel.tax)}</button></li>
                    <li><button type="button" class="sdd-ld-empty-btn" data-jump-cat="insurance">+ ${escapeHtml(addLabel.insurance)}</button></li>
                    <li><button type="button" class="sdd-ld-empty-btn" data-jump-cat="pension">+ ${escapeHtml(addLabel.pension)}</button></li>
                </ul>
                <p class="sdd-ld-empty-note">${escapeHtml(editorNote)}</p>
            </section>
        ` : '';

        root.innerHTML = `
            <header class="sdd-ld-head">
                <h2 class="sdd-ld-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="it">${dropItalicPunct(headItalic)}</span>
                </h2>
            </header>
            ${articleIntro}
            <div id="sddLedgerEmpty"></div>
            ${isLedgerEmpty ? '' : emptyStateHtml}
            <div id="sddSchPanel"></div>
            <div id="sddSchForm"></div>
            <div id="sddTaxPanel"></div>
            ${categoriesHtml}
            ${formHtml}
        `;

        // Unified empty-state — replaces the old per-section markup when the user
        // has not yet added a single record.
        if (isLedgerEmpty && window.SAUDADE_EMPTY) {
            const t = window.SAUDADE_EMPTY.text('ledger');
            window.SAUDADE_EMPTY.render('#sddLedgerEmpty', {
                eyebrow: t.eyebrow,
                headline: t.headline,
                lede: t.lede,
                actions: [
                    { label: addLabel.visa,      kind: 'primary', onClick: () => jumpToCat('visa') },
                    { label: addLabel.tax,                          onClick: () => jumpToCat('tax') },
                    { label: addLabel.insurance,                    onClick: () => jumpToCat('insurance') },
                    { label: addLabel.pension,                      onClick: () => jumpToCat('pension') }
                ],
                note: t.note
            });
        }

        function jumpToCat(cat) {
            const el = root.querySelector(`[data-jump-cat="${cat}"]`)
                || root.querySelector(`[data-cat="${cat}"]`)
                || root.querySelector(`[data-form-cat="${cat}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.click && el.click();
            }
        }

        // Schengen 90/180 panel + entry form — both always mount when the
        // user has any Schengen-flagged record OR has stored stays in the
        // standalone form's localStorage. Otherwise we silently skip.
        try {
            // Auto-import Schengen-flagged ledger entries into the calc.
            const schStays = records
                .filter(r => (r.iso === 'EU') || (r.type === 'shengen') || (r.type === 'd7-pt'))
                .map(r => ({ in: r.entered, out: r.expiry, country: r.iso }));
            const formStays = (window.SAUDADE_SCHENGEN_FORM && window.SAUDADE_SCHENGEN_FORM.getStays && window.SAUDADE_SCHENGEN_FORM.getStays()) || [];
            const merged = schStays.concat(formStays.filter(s => s.in));
            if (window.SAUDADE_SCHENGEN && merged.length) {
                window.SAUDADE_SCHENGEN.render(document.getElementById('sddSchPanel'), { stays: merged });
            }
            if (window.SAUDADE_SCHENGEN_FORM) {
                window.SAUDADE_SCHENGEN_FORM.mount(document.getElementById('sddSchForm'));
            }

            // v637 — tax-residency 183-day counter. Maps tax-category records
            // (any record with typeCategory === 'tax' OR a country code on a
            // visa record) into [{ country, in, out }].
            const taxStays = records
                .filter(r => (r.typeCategory === 'tax') || (r.iso && r.entered))
                .map(r => ({ country: (r.iso || '').replace(/^EU$/, 'PT'), in: r.entered, out: r.expiry }));
            if (window.SAUDADE_TAX && taxStays.length) {
                window.SAUDADE_TAX.render(document.getElementById('sddTaxPanel'), { stays: taxStays });
            }
        } catch (e) {}

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

        // 빈 상태 quick-add — 카테고리 pre-select 후 폼으로 스크롤
        root.querySelectorAll('[data-jump-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-jump-cat');
                const catSel = root.querySelector('#ld-cat');
                const isoInp = root.querySelector('#ld-iso');
                if (catSel) {
                    catSel.value = target;
                    catSel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const formEl = root.querySelector('[data-add-entry]');
                if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => isoInp?.focus(), 320);
            });
        });

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
    // v7 검토 정정 — italic 헤드라인 마침표 regular 분리
    function dropItalicPunct(s) {
        if (!s) return '';
        const m = String(s).match(/^([\s\S]*?)([.,;:!?。、！？]+)$/);
        if (!m) return escapeHtml(s);
        return escapeHtml(m[1]) + '<span class="sdd-punct">' + escapeHtml(m[2]) + '</span>';
    }

    // v8 §07 — 도크 LEDGER 탭 visa expiry 긴급 도트 (조용한 알림, 알림 API X)
    function refreshVisaUrgent() {
        const v = activeVisa();
        const days = v ? daysLeft(v.expiry) : null;
        if (days != null && days <= 7) {
            document.body.setAttribute('data-visa-urgent', '1');
        } else {
            document.body.removeAttribute('data-visa-urgent');
        }
    }

    function init() {
        injectStyles();
        render();
        refreshVisaUrgent();
        // body section 변경 감지 — 01 진입 시 재렌더
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '01') render();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
        // 1분마다 D-day 갱신 + visa urgency 재계산
        setInterval(() => {
            if (document.body.getAttribute('data-section') === '01') render();
            refreshVisaUrgent();
        }, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_LEDGER = { render, getVisas, setVisas, activeVisa, daysLeft, taxResidency, refreshVisaUrgent };
})();
