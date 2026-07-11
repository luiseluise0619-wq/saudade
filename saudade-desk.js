// SAUDADE · § 04 THE DESK (Handoff v2 §5.4)
// 발행 파이프라인 + 사용자 설정 (편집부 페이지).
// 카드 X. 모든 요소 mono UPPERCASE 라벨 + Fraunces 본문.
// 모달 X — 페이지 진입.
'use strict';

// IIFE — 파일이 로드되면 즉시 실행되는 익명 함수. 내부 변수는 전역을 더럽히지 않는다.
(function() {
    // 중복 로드 방어 — 이미 초기화됐으면(window.SAUDADE_DESK 존재) 다시 실행하지 않는다.
    if (window.SAUDADE_DESK) return;

    // PIPELINE — § 04 DESK 화면에 "매일 발행 파이프라인"을 표로 보여주기 위한 데이터.
    // 각 원소는 시각(KST)·단계 이름·설명을 담은 객체. 실제 크론은 worker/GitHub Actions 에 있고
    // 여기 배열은 순수 표시용(설명 텍스트)일 뿐이다.
    // v3 pipeline — 100% free AI stack (Workers AI + Gemini Flash alias).
    // 운영비 0원. provider 는 LLM_*_PROVIDER env var 로 swap 가능.
    // Model name uses the gemini-flash-lite-latest alias — never a pinned
    // version, since pinning silently broke the pipeline three times
    // during development as Google retired older flash variants.
    const PIPELINE = [
        { time: '00:00 KST', step: 'GATHER',    desc: 'rss-parser collects RSS from city halls, museums, local press.' },
        { time: '00:30 KST', step: 'SORT',      desc: 'Workers AI · Llama 3.1 8B — city classification, noise removed.' },
        { time: '02:00 KST', step: 'SCORE',     desc: 'Workers AI · Llama 3.1 8B — quietness scored one to ten.' },
        { time: '04:00 KST', step: 'WRITE',     desc: 'Gemini Flash (latest) — three to four sentence dispatches rewritten.' },
        { time: '05:00 KST', step: 'REVIEW',    desc: 'Gemini Flash — second pass copy-edits against the constitution; anything that fails the gate is blocked.' },
        { time: '05:30 KST', step: 'STAGE',     desc: 'D1 staged.' },
        { time: '06:00 KST', step: 'FILE',      desc: 'Top items publish. KO/JA/PT/ES are independently drafted by a parallel GitHub Actions cron on the same schedule — not translations of the EN edition.' }
    ];

    function injectStyles() {
        if (document.getElementById('sddDeskStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddDeskStyles';
        s.textContent = `
.sdd-desk {
    position: fixed; inset: 0;
    z-index: var(--z-section-page, 8);
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    padding: 88px clamp(24px, 6vw, 80px) calc(var(--dock-h, 56px) + 88px);
    display: none;
}
body.section-active[data-section="04"] .sdd-desk { display: block; }

.sdd-desk-head {
    margin: 0 0 clamp(24px, 4vw, 48px);
    padding-bottom: clamp(12px, 2vw, 20px);
    /* v647 — was border-bottom + section border-top below = double rule.
       Drop the head's bottom border; the next section's top border carries it. */
}
.sdd-desk-h2 {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    /* v7 §2.2 — 헤드라인 전체 italic */
    font-size: clamp(36px, 5vw, 54px);
    line-height: 0.95;
    letter-spacing: var(--tr-fraunces-h2-d);
    color: var(--ink);
    margin: 0;
}
.sdd-desk-h2 .it { font-style: italic; display: inline; }

.sdd-desk-section {
    padding: clamp(20px, 3vw, 32px) 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-desk-section:last-child { border-bottom: 0.5px solid var(--rule); }

/* v8 §02 — Following 3 도시 picker (Switch the desk 폐기 후 신규) */
.sdd-desk-following { padding: clamp(20px, 3vw, 32px) 0; border-top: 0.5px solid var(--rule); }
.sdd-following-sub {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
    margin: 0 0 clamp(20px, 3vw, 28px);
}
.sdd-following-slots {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-following-slot {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 0.5px solid var(--rule);
    min-height: 48px;
}
.sdd-following-pos {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    color: var(--bone-d);
    min-width: 28px;
}
.sdd-following-name {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    /* v647 — was clamp(18, 2vw, 22) which read like an H3 stacked three
       times. Reduce to a calmer list weight. */
    font-size: clamp(16px, 1.6vw, 19px);
    line-height: 1.2;
    color: var(--ink);
    flex: 1;
}
.sdd-following-remove {
    background: transparent !important;
    border: 0 !important;
    color: var(--bone-d) !important;
    font-family: var(--mono) !important;
    font-size: 16px !important;
    width: 44px !important;
    height: 44px !important;
    min-height: 44px !important;
    cursor: pointer;
    border-radius: 0 !important;
    padding: 0 !important;
}
.sdd-following-remove:hover { color: var(--rust) !important; }
.sdd-following-picker {
    flex: 1;
    position: relative;
}
.sdd-following-picker > summary {
    list-style: none;
    cursor: pointer;
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
    padding: 8px 0;
    user-select: none;
}
.sdd-following-picker > summary::-webkit-details-marker { display: none; }
.sdd-following-picker > summary::after { content: ' \\25BE'; opacity: .6; margin-left: 6px; }
.sdd-following-picker[open] > summary::after { content: ' \\25B4'; opacity: 1; }
.sdd-following-pool {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    background: var(--paper-d);
    border: 0.5px solid var(--rule);
    max-height: 280px;
    overflow-y: auto;
    position: absolute;
    left: 0;
    right: 0;
    z-index: 4;
}
.sdd-following-pool li { border-top: 0.5px solid var(--rule); }
.sdd-following-pool li:first-child { border-top: 0; }
.sdd-following-opt {
    background: transparent !important;
    border: 0 !important;
    width: 100% !important;
    text-align: left !important;
    font-family: var(--mono) !important;
    font-weight: 500 !important;
    font-size: 11px !important;
    letter-spacing: var(--tr-mono-mast) !important;
    text-transform: uppercase !important;
    color: var(--ink) !important;
    padding: 12px 14px !important;
    cursor: pointer;
    border-radius: 0 !important;
    min-height: 44px !important;
}
.sdd-following-opt:hover { color: var(--rust) !important; background: var(--paper-d) !important; }
.sdd-desk-theme-opts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
}
.sdd-desk-theme-opt {
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--bone-d);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 12px 16px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 4px;
    transition: color .15s, border-color .15s, background .15s;
}
.sdd-desk-theme-opt:hover {
    color: var(--accent);
    border-color: var(--accent);
}
.sdd-desk-theme-opt[aria-checked="true"] {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--paper-d);
}
.sdd-desk-theme-opt:focus-visible {
    outline: 1.5px solid var(--accent);
    outline-offset: 2px;
}
.sdd-following-pairings {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 0.5px solid var(--rule);
}
.sdd-following-pairings li { border-bottom: 0.5px solid var(--rule); }
.sdd-following-pairing {
    background: transparent !important;
    border: 0 !important;
    width: 100% !important;
    text-align: left !important;
    padding: 14px 0 !important;
    cursor: pointer;
    border-radius: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    min-height: 44px !important;
}
.sdd-following-pairing-label {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 17px);
    color: var(--ink);
}
.sdd-following-pairing-cities {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
}
.sdd-following-pairing:hover .sdd-following-pairing-label { color: var(--rust); }

/* v7 §13 — Account section */
.sdd-desk-account-headline {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(20px, 2.4vw, 28px);
    line-height: 1.2;
    color: var(--ink);
    margin: 0 0 8px;
}
.sdd-desk-account-email {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 12px;
    letter-spacing: var(--tr-mono-data);
    color: var(--ink);
    margin: 0 0 clamp(16px, 2vw, 20px);
}
.sdd-desk-account-body {
    font-family: var(--serif);
    font-weight: 300;
    font-size: clamp(14px, 1.3vw, 16px);
    line-height: 1.55;
    color: var(--ink);
    max-width: 60ch;
    margin: 0 0 clamp(16px, 2vw, 20px);
}
.sdd-desk-account-actions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.sdd-desk-account-actions li {
    border-top: 0.5px solid var(--rule);
    margin: 0;
}
.sdd-desk-account-btn {
    background: transparent !important;
    border: 0 !important;
    color: var(--ink) !important;
    font-family: var(--mono) !important;
    font-weight: 500 !important;
    font-size: 11px !important;
    letter-spacing: var(--tr-mono-mast) !important;
    text-transform: uppercase !important;
    text-align: left !important;
    padding: 14px 0 !important;
    width: 100% !important;
    cursor: pointer;
    border-radius: 0 !important;
    min-height: 44px !important;
    transition: color .12s;
}
.sdd-desk-account-btn:hover { color: var(--rust) !important; }
.sdd-desk-account .sdd-desk-account-actions + .sdd-desk-account-btn,
.sdd-desk-account-headline + .sdd-desk-account-email + .sdd-desk-account-btn {
    border-top: 0.5px solid var(--rule) !important;
}

.sdd-desk-label {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 10px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(12px, 2vw, 20px);
}

.sdd-desk-pipeline {
    display: flex; flex-direction: column; gap: 0;
}
.sdd-desk-step {
    display: grid;
    grid-template-columns: 100px 100px 1fr;
    gap: clamp(12px, 2vw, 24px);
    padding: 12px 0;
    border-top: 0.5px solid var(--rule);
    align-items: baseline;
}
.sdd-desk-step:first-child { border-top: 0; }
.sdd-desk-step .time {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-data);
    color: var(--bone-d);
    white-space: nowrap;
}
.sdd-desk-step .name {
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    color: var(--ink);
}
.sdd-desk-step .desc {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(13.5px, 1.2vw, 15px);
    line-height: 1.55;
    color: var(--ink);
}

.sdd-desk-edition-list {
    display: flex; flex-wrap: wrap; gap: 12px;
}
.sdd-desk-edition-opt {
    background: transparent;
    border: 0.5px solid var(--rule);
    color: var(--ink);
    font-family: var(--mono);
    font-weight: 500;
    font-size: 11px;
    letter-spacing: var(--tr-mono-mast);
    text-transform: uppercase;
    padding: 12px 18px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 4px;
    transition: border-color .12s, color .12s;
}
.sdd-desk-edition-opt:hover {
    border-color: var(--ink);
    color: var(--accent, var(--rust));
}
.sdd-desk-edition-opt[aria-current="true"] {
    border-color: var(--accent, var(--rust));
    color: var(--accent, var(--rust));
}

/* v8 §02 — v6 §5.4 Switch the desk 폐기. Following 섹션이 도시 변경 담당. */

.sdd-desk-disclaimer {
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    line-height: 1.7;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    max-width: 60ch;
}
.sdd-desk-disclaimer strong {
    font-weight: 500;
    color: var(--ink);
    letter-spacing: var(--tr-mono-mast);
    display: block;
    margin-bottom: 6px;
}

.sdd-desk-foot {
    margin-top: clamp(40px, 6vw, 80px);
    padding-top: clamp(16px, 2vw, 24px);
    border-top: 0.5px solid var(--rule);
    font-family: var(--mono);
    font-weight: 400;
    font-size: 10px;
    letter-spacing: var(--tr-mono-meta);
    text-transform: uppercase;
    color: var(--bone-d);
    text-align: center;
}

@media (max-width: 768px) {
    .sdd-desk { padding: 56px 16px calc(var(--dock-h, 56px) + 24px); }
    .sdd-desk-step {
        grid-template-columns: 1fr;
        gap: 4px;
        padding: 14px 0;
    }
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

    // ── 아래 renderXxxSection 함수들은 각각 § 04 DESK 안의 한 블록(HTML 문자열)을 만든다. ──
    // 공통 패턴: T(...) 로 5개 에디션(en/ko/ja/pt/es) 문구를 고른 뒤 템플릿 문자열로 HTML 조립.
    // T 는 window.SAUDADE_T 가 있으면 그것을, 없으면 영어만 반환하는 기본 함수를 쓴다(안전 폴백).

    // 테마(스킨) 선택 블록 — AUTO/PAPER/COVER/NIGHT 중 하나를 라디오처럼 고르게 한다.
    // v7 §13 — Account section (sign-in / tour / sign-out). 헌법 §13 매직 링크.
    function renderThemeSection() {
        const T = window.SAUDADE_T || ((s) => s.en);
        // 현재 저장된 스킨 선호값(없으면 'auto'). 어느 버튼에 체크 표시를 할지 결정.
        const cur = window.SAUDADE_EDITION?.skinPref?.() || 'auto';
        const head = T({
            en: 'THEME', ko: '테마', ja: 'テーマ', pt: 'TEMA', es: 'TEMA'
        });
        const note = T({
            en: 'Auto = ISO-week rotation + system dark mode.',
            ko: '자동 = 발행 주차 회전 + 시스템 다크 모드 따름.',
            ja: '自動 = 発行週ローテーション + システム設定。',
            pt: 'Auto = rotação semanal + tema do sistema.',
            es: 'Auto = rotación semanal + tema del sistema.'
        });
        const opts = [
            { v: 'auto',      label: T({ en: 'AUTO',  ko: '자동', ja: '自動', pt: 'AUTO',  es: 'AUTO' }) },
            { v: 'paper',     label: T({ en: 'PAPER', ko: '종이', ja: '紙',    pt: 'PAPEL', es: 'PAPEL' }) },
            { v: 'saturated', label: T({ en: 'COVER', ko: '표지', ja: '表紙',  pt: 'CAPA',  es: 'TAPA' }) },
            { v: 'dark',      label: T({ en: 'NIGHT', ko: '밤',   ja: '夜',    pt: 'NOITE', es: 'NOCHE' }) }
        ];
        return `
            <section class="sdd-desk-section sdd-desk-theme">
                <h3 class="sdd-desk-head">${escapeHtml(head)}</h3>
                <p class="sdd-desk-note">${escapeHtml(note)}</p>
                <div class="sdd-desk-theme-opts" role="radiogroup">
                    ${opts.map(o => `
                        <button type="button" class="sdd-desk-theme-opt"
                                role="radio"
                                aria-checked="${o.v === cur}"
                                data-skin="${escapeHtml(o.v)}">
                            ${escapeHtml(o.label)}
                        </button>
                    `).join('')}
                </div>
            </section>
        `;
    }

    // 주간 다이제스트(주 1회 이메일) 구독 폼 블록. 실제 전송 처리는 render() 안의 submit 핸들러.
    function renderDigestSection() {
        const T = window.SAUDADE_T || ((s) => s.en);
        const head = T({ en: 'SUNDAY DIGEST', ko: '주간 다이제스트', ja: '週刊ダイジェスト', pt: 'DIGEST DOMINICAL', es: 'DIGEST DOMINICAL' });
        const lede = T({
            en: 'One email a week. The desk does not write to you on any other day.',
            ko: '주 1회 이메일. 그 외에는 사우다지가 메일을 보내지 않습니다.',
            ja: '週に一通だけ。それ以外の日に編集部からメールは届きません。',
            pt: 'Um email por semana. A redação não escreve em mais nenhum dia.',
            es: 'Un correo a la semana. La redacción no escribe ningún otro día.'
        });
        const placeholder = T({
            en: 'you@example.com', ko: 'you@example.com', ja: 'you@example.com',
            pt: 'voce@exemplo.com', es: 'tu@ejemplo.com'
        });
        const btn = T({ en: 'SUBSCRIBE', ko: '구독', ja: '購読', pt: 'SUBSCREVER', es: 'SUSCRIBIRSE' });
        const consent = T({
            en: 'No tracking. No third-party sharing. Unsubscribe link in every email.',
            ko: '추적 없음. 외부 공유 없음. 모든 이메일 하단에 구독 해지 링크.',
            ja: 'トラッキング無し。第三者提供無し。各メールに配信停止リンクあり。',
            pt: 'Sem rastreio. Sem partilha com terceiros. Link de cancelamento em cada email.',
            es: 'Sin seguimiento. Sin compartir con terceros. Enlace de cancelación en cada correo.'
        });
        return `
            <section class="sdd-desk-section sdd-desk-digest">
                <h3 class="sdd-desk-head">${escapeHtml(head)}</h3>
                <p class="sdd-desk-note" style="max-width:60ch">${escapeHtml(lede)}</p>
                <form class="sdd-desk-digest-form" data-digest-form
                      style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;align-items:stretch">
                    <input type="email" name="email" required
                           placeholder="${escapeHtml(placeholder)}"
                           autocomplete="email"
                           style="flex:1 1 220px;min-width:220px;padding:10px 12px;font-family:var(--mono);font-size:12px;border:0.5px solid var(--rule);background:var(--paper);color:var(--ink);border-radius:0" />
                    <button type="submit"
                            style="padding:10px 18px;font-family:var(--mono);font-weight:500;font-size:11px;letter-spacing:var(--tr-mono-mast);text-transform:uppercase;border:0.5px solid var(--ink);background:var(--paper);color:var(--ink);cursor:pointer;border-radius:0">
                        ${escapeHtml(btn)}
                    </button>
                </form>
                <p class="sdd-desk-note" style="margin-top:10px;font-size:10px;color:var(--bone-d)">${escapeHtml(consent)}</p>
                <p data-digest-status style="margin-top:12px;font-family:var(--mono);font-size:11px;color:var(--ink);min-height:1em"></p>
            </section>
        `;
    }

    // 계정 블록 — 로그인 상태에 따라 세 갈래로 다른 HTML 을 보여준다.
    // (1) 로그인됨 → 이메일 + 로그아웃, (2) 둘러보기 중 → 로그인 유도, (3) 비로그인 → 로그인/둘러보기.
    function renderAccountSection() {
        const T = window.SAUDADE_T || ((s) => s.en);
        // ?. 는 옵셔널 체이닝: SAUDADE_AUTH 나 getUser 가 없어도 에러 없이 undefined 를 준다.
        const user   = window.SAUDADE_AUTH?.getUser?.() || null;
        const onTour = window.SAUDADE_AUTH?.isTour?.() || false;

        const labelTitle = T({
            en: 'Account', ko: '계정', ja: 'アカウント',
            pt: 'Conta', es: 'Cuenta'
        });
        const headSignedIn = T({
            en: 'Signed in.', ko: '로그인됨.', ja: 'サインイン済み。',
            pt: 'Sessão iniciada.', es: 'Sesión iniciada.'
        });
        const headTour = T({
            en: 'Browsing as guest.', ko: '둘러보는 중.', ja: 'ゲストとして閲覧中。',
            pt: 'A navegar como convidado.', es: 'Navegando como invitado.'
        });
        const headAnon = T({
            en: 'Not signed in.', ko: '로그인 전.', ja: 'サインインなし。',
            pt: 'Sem sessão.', es: 'Sin sesión.'
        });
        const bodyAnon = T({
            en: 'One line. We send a sign-in link to your inbox. No password.',
            ko: '한 줄. 이메일로 로그인 링크를 보낸다. 비밀번호 없음.',
            ja: '一行。メールにサインインリンクを送る。パスワードなし。',
            pt: 'Uma linha. Enviamos um link para a sua caixa de entrada. Sem palavra-passe.',
            es: 'Una línea. Enviamos un enlace al correo. Sin contraseña.'
        });
        const btnSignIn = T({
            en: 'SIGN IN WITH EMAIL', ko: '이메일로 로그인',
            ja: 'メールでサインイン', pt: 'ENTRAR COM EMAIL',
            es: 'INICIAR SESIÓN CON CORREO'
        });
        const btnTour = T({
            en: 'BROWSE WITHOUT SIGNING IN', ko: '가입 없이 둘러보기',
            ja: '登録せずに見る', pt: 'NAVEGAR SEM REGISTO',
            es: 'NAVEGAR SIN REGISTRO'
        });
        const btnSignOut = T({
            en: 'SIGN OUT', ko: '로그아웃', ja: 'サインアウト',
            pt: 'TERMINAR SESSÃO', es: 'CERRAR SESIÓN'
        });
        const btnEndTour = T({
            en: 'END TOUR · SIGN IN', ko: '둘러보기 종료 · 로그인',
            ja: 'ツアー終了 · サインイン',
            pt: 'TERMINAR VISITA · ENTRAR',
            es: 'FINALIZAR VISITA · ENTRAR'
        });

        // 상태별로 stateHtml 을 다르게 채운다(위에서 준비한 문구를 끼워 넣는다).
        let stateHtml;
        if (user) {
            stateHtml = `
                <p class="sdd-desk-account-headline">${escapeHtml(headSignedIn)}</p>
                <p class="sdd-desk-account-email">${escapeHtml(user.email || '')}</p>
                <button type="button" class="sdd-desk-account-btn" data-account-signout>${escapeHtml(btnSignOut)}</button>
            `;
        } else if (onTour) {
            stateHtml = `
                <p class="sdd-desk-account-headline">${escapeHtml(headTour)}</p>
                <p class="sdd-desk-account-body">${escapeHtml(bodyAnon)}</p>
                <button type="button" class="sdd-desk-account-btn" data-account-signin>${escapeHtml(btnEndTour)}</button>
            `;
        } else {
            stateHtml = `
                <p class="sdd-desk-account-headline">${escapeHtml(headAnon)}</p>
                <p class="sdd-desk-account-body">${escapeHtml(bodyAnon)}</p>
                <ul class="sdd-desk-account-actions">
                    <li><button type="button" class="sdd-desk-account-btn" data-account-signin>${escapeHtml(btnSignIn)}</button></li>
                    <li><button type="button" class="sdd-desk-account-btn" data-account-tour>${escapeHtml(btnTour)}</button></li>
                </ul>
            `;
        }
        return `
            <section class="sdd-desk-section sdd-desk-account">
                <p class="sdd-desk-label">${escapeHtml(labelTitle)}</p>
                ${stateHtml}
            </section>
        `;
    }

    // v8 §02 — 사용자 도시 선택 Dispatches (Following 3) UI.
    // v7 §5.4 Switch the desk 폐기 — 사용자가 언제든 직접 변경 가능하므로 임시 모드 불필요.
    function renderFollowingSection() {
        if (!window.SAUDADE_FOLLOWING) return '';
        const T = window.SAUDADE_T || ((s) => s.en);
        const ed = window.SAUDADE_EDITION?.get?.() || 'en';
        const cur = window.SAUDADE_FOLLOWING.list();
        const pool = window.SAUDADE_FOLLOWING.pool();
        const pairings = window.SAUDADE_FOLLOWING.pairings();

        const labels = {
            label:    T({ en: 'Following', ko: '구독 중', ja: 'フォロー中', pt: 'A acompanhar', es: 'Siguiendo' }),
            sub:      T({
                en: 'Three cities, one dispatch each. Change anytime — the next morning reflects your choice.',
                ko: '세 도시, 도시당 하나의 디스패치. 언제든 변경한다 — 다음 발행분이 곧장 반영한다.',
                ja: '三つの街、街ごとに一本の通信。いつでも変更可能 — 翌朝の発行に即反映される。',
                pt: 'Três cidades, um despacho por cada. Altere quando quiser — a edição da manhã seguinte reflecte a sua escolha.',
                es: 'Tres ciudades, un despacho por cada una. Cambia cuando quieras — la edición de la mañana siguiente refleja tu elección.'
            }),
            slotEmpty: T({ en: '+ Add a city', ko: '+ 도시 추가', ja: '+ 街を追加', pt: '+ Adicionar cidade', es: '+ Añadir ciudad' }),
            remove:   T({ en: 'Remove', ko: '제거', ja: '削除', pt: 'Remover', es: 'Eliminar' }),
            pairings: T({ en: 'Popular pairings', ko: '편집부 추천 묶음', ja: '編集部おすすめ', pt: 'Combinações sugeridas', es: 'Combinaciones recomendadas' })
        };

        // 3 슬롯 — 채워진 건 도시명 + remove, 빈 슬롯은 + Add (드롭다운 details)
        // [0,1,2].map 으로 세 칸을 순서대로 그린다. cur[i] 에 도시 slug 가 있으면 채워진 슬롯.
        const slotsHtml = [0, 1, 2].map(i => {
            const slug = cur[i];
            if (slug) {
                const name = window.SAUDADE_FOLLOWING.cityName(slug, ed);
                return `
                    <li class="sdd-following-slot">
                        <span class="sdd-following-pos">${String(i + 1).padStart(2, '0')}</span>
                        <span class="sdd-following-name">${escapeHtml(name)}</span>
                        <button type="button" class="sdd-following-remove" data-following-remove="${escapeHtml(slug)}" aria-label="${escapeHtml(labels.remove)}">×</button>
                    </li>
                `;
            }
            // 빈 슬롯 — details/summary 드롭다운으로 도시 선택
            const optsHtml = pool
                .filter(c => !cur.includes(c.slug))
                .map(c => `<li><button type="button" class="sdd-following-opt" data-following-add="${escapeHtml(c.slug)}">${escapeHtml(c.names?.[ed] || c.names?.en || c.slug)}</button></li>`)
                .join('');
            return `
                <li class="sdd-following-slot empty">
                    <span class="sdd-following-pos">${String(i + 1).padStart(2, '0')}</span>
                    <details class="sdd-following-picker">
                        <summary>${escapeHtml(labels.slotEmpty)}</summary>
                        <ul class="sdd-following-pool">${optsHtml}</ul>
                    </details>
                </li>
            `;
        }).join('');

        const pairingsHtml = (pairings || []).map(p => {
            const lbl = window.SAUDADE_FOLLOWING.pairingLabel(p, ed);
            const cityNames = (p.cities || []).map(s => window.SAUDADE_FOLLOWING.cityName(s, ed)).join(' · ');
            return `
                <li>
                    <button type="button" class="sdd-following-pairing" data-following-pairing="${escapeHtml(p.id)}">
                        <span class="sdd-following-pairing-label">${escapeHtml(lbl)}</span>
                        <span class="sdd-following-pairing-cities">${escapeHtml(cityNames)}</span>
                    </button>
                </li>
            `;
        }).join('');

        return `
            <section class="sdd-desk-section sdd-desk-following">
                <p class="sdd-desk-label">${escapeHtml(labels.label)}</p>
                <p class="sdd-following-sub">${escapeHtml(labels.sub)}</p>
                <ol class="sdd-following-slots">${slotsHtml}</ol>
                <p class="sdd-desk-label" style="margin-top:clamp(20px,3vw,28px)">${escapeHtml(labels.pairings)}</p>
                <ul class="sdd-following-pairings">${pairingsHtml}</ul>
            </section>
        `;
    }

    // v8 §02 — v7 §5.4 Switch the desk 폐기. Home city 표시 + 도시 요청 폼만 유지.
    // Atlas/Ledger 컨텍스트의 home city 개념은 그대로 유지 (Following 과 별개).
    // 도시 변경은 Following 섹션에서 직접 함.
    function renderHomeDeskSection() {
        if (!window.SAUDADE_CITY) return '';
        const T = window.SAUDADE_T || ((s) => s.en);
        const home = window.SAUDADE_CITY.getHomeCity();
        const ed = window.SAUDADE_EDITION?.get?.() || 'en';
        const homeName = window.SAUDADE_CITY.cityName(home, ed);

        const labels = {
            label:    T({ en: 'Home Desk', ko: '정착 책상', ja: '本拠デスク', pt: 'Mesa Permanente', es: 'Mesa Permanente' }),
            sub:      T({ en: 'Where you sleep this month — used by Atlas and Ledger.',
                          ko: '이번 달 머무는 곳 — 아틀라스와 레저에서 사용한다.',
                          ja: '今月の住まい — アトラスと台帳で使う。',
                          pt: 'Onde dorme este mês — usado pelo Atlas e pelo Livro-Razão.',
                          es: 'Dónde duermes este mes — usado por el Atlas y el Libro Mayor.' }),
            requestNew: T({ en: 'Request a new city', ko: '새 도시 요청', ja: '新しい街を要請', pt: 'Pedir uma nova cidade', es: 'Solicitar una nueva ciudad' }),
            requestPh:  T({ en: 'CITY NAME', ko: '도시 이름', ja: '都市名', pt: 'NOME DA CIDADE', es: 'NOMBRE DE LA CIUDAD' }),
            requestSent:T({ en: 'Submitted, queued for next issue.', ko: '제출됐다. 다음 호에 검토한다.', ja: '提出された。次号で検討する。', pt: 'Submetido, em fila para a próxima edição.', es: 'Enviado, en cola para la próxima edición.' })
        };

        return `
            <section class="sdd-desk-section">
                <p class="sdd-desk-label">${escapeHtml(labels.label)}<span class="sdd-co-sub" style="display:block;font-weight:400;color:var(--bone-d);margin-top:4px">${escapeHtml(labels.sub)}</span></p>
                <p style="font-family:var(--serif);font-weight:300;font-style:italic;font-size:clamp(20px,2.4vw,28px);line-height:1.2;color:var(--ink);margin:0 0 16px">
                    ${escapeHtml(homeName)}
                </p>
                <form class="sdd-desk-request-form" data-request-form style="margin-top:24px;display:flex;gap:8px;flex-wrap:wrap">
                    <input type="text" name="city" placeholder="${escapeHtml(labels.requestPh)}"
                           style="background:transparent !important;border:0 !important;border-bottom:0.5px solid var(--rule) !important;font-family:var(--mono);font-size:11px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;padding:10px 0;min-height:44px;flex:1;min-width:200px;color:var(--ink);outline:none;border-radius:0 !important" />
                    <button type="submit" class="sdd-desk-edition-opt">${escapeHtml(labels.requestNew)}</button>
                </form>
                <p class="sdd-desk-request-status" data-request-status style="font-family:var(--mono);font-size:10px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;color:var(--bone-d);margin:8px 0 0;min-height:14px"></p>
            </section>
        `;
    }

    // § 04 DESK 화면 전체를 조립해 그리고, 새로 만들어진 버튼/폼에 이벤트를 연결한다.
    // 위의 renderXxxSection 조각들을 한 innerHTML 안에 끼워 넣는 구조.
    function render() {
        // 루트 컨테이너 확보(없으면 만들어 body 에 붙임).
        let root = document.getElementById('sddDesk');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddDesk';
            root.className = 'sdd-desk';
            document.body.appendChild(root);
        }

        // 현재 에디션 코드(en/ko/ja/pt/es). 에디션 목록에서 어느 버튼을 강조할지에 쓰인다.
        const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
        const editionsHtml = (window.SAUDADE_EDITION?.SUPPORTED || ['en','ko','ja','pt','es']).map(code => {
            const meta = window.SAUDADE_EDITION?.META?.[code] || { name: code };
            return `<button class="sdd-desk-edition-opt"
                            data-edition="${code}"
                            aria-current="${code === ed ? 'true' : 'false'}">
                        ${code.toUpperCase()} · ${escapeHtml(meta.name)}
                    </button>`;
        }).join('');

        const pipelineHtml = PIPELINE.map(s => `
            <div class="sdd-desk-step">
                <span class="time">${escapeHtml(s.time)}</span>
                <span class="name">${escapeHtml(s.step)}</span>
                <span class="desc">${escapeHtml(s.desc)}</span>
            </div>
        `).join('');

        const T = window.SAUDADE_T || ((s) => s.en);
        const headLabel = T({
            en: 'From the', ko: '편집부', ja: '編集部',
            pt: 'Da', es: 'Desde la'
        });
        const headItalic = T({
            en: 'desk.', ko: '에서.', ja: 'より。',
            pt: 'mesa.', es: 'mesa.'
        });

        root.innerHTML = `
            <header class="sdd-desk-head">
                <h2 class="sdd-desk-h2">
                    ${dropItalicPunct(headLabel)}
                    <span class="it">${dropItalicPunct(headItalic)}</span>
                </h2>
            </header>

            <section class="sdd-desk-section">
                <p class="sdd-desk-label">Daily filing pipeline</p>
                <div class="sdd-desk-pipeline">${pipelineHtml}</div>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-label">Editions</p>
                <p style="font-family:var(--serif);font-weight:300;font-size:14.5px;line-height:1.55;color:var(--ink);max-width:60ch;margin:0 0 16px">
                    Each edition is its own impression. The user opens a different magazine, not a translation.
                </p>
                <div class="sdd-desk-edition-list">${editionsHtml}</div>
            </section>

            ${renderFollowingSection()}
            ${renderHomeDeskSection()}
            ${renderThemeSection()}
            ${renderDigestSection()}
            ${renderAccountSection()}

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on sources.</strong>
                    Each dispatch is rewritten in our own words from the source listed.
                    We quote no more than twenty-five words. We link to the original.
                    We do not republish AP, Reuters, or Bloomberg copy. We never use
                    photographs we did not take ourselves. Dispatches are AI-drafted
                    and AI-reviewed against the magazine’s constitution before filing.
                </p>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on visas.</strong>
                    Visa policy changes without warning. Verify with the embassy of
                    the country you are visiting. We do not guarantee accuracy.
                </p>
            </section>

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on places.</strong>
                    We list only what we have visited. We accept no payment for
                    inclusion. We never use a photograph that is not our own. If
                    you are an owner and would like to be removed, write to
                    luiseluise0619@gmail.com.
                </p>
            </section>

            <footer class="sdd-desk-foot">
                Saudade · Issue 03 · Spring 2026 · Daily filing · Operating cost zero
            </footer>
        `;

        // ── innerHTML 을 새로 그렸으므로 방금 만들어진 요소들에 이벤트를 (다시) 붙인다. ──
        // 테마 버튼: 클릭하면 스킨을 저장하고 화면을 다시 그려 체크 표시를 갱신한다.
        root.querySelectorAll('[data-skin]').forEach(btn => {
            btn.addEventListener('click', () => {
                const skin = btn.getAttribute('data-skin');
                if (window.SAUDADE_EDITION?.setSkin) window.SAUDADE_EDITION.setSkin(skin);
                // Re-render desk so the aria-checked state updates
                render();
            });
        });

        // 다이제스트 구독 폼 제출 처리.
        const digestForm = root.querySelector('[data-digest-form]');
        if (digestForm) {
            // async 핸들러 — 안에서 await 로 서버 응답을 기다린다.
            digestForm.addEventListener('submit', async (ev) => {
                // 폼 기본 동작(페이지 새로고침)을 막는다. SPA 라 직접 처리한다.
                ev.preventDefault();
                const T = window.SAUDADE_T || ((s) => s.en);
                const ed = (window.SAUDADE_EDITION?.get?.() || 'en');
                const email = (digestForm.querySelector('input[name="email"]').value || '').trim();
                const status = root.querySelector('[data-digest-status]');
                // 이메일 형식 정규식 검증: (골뱅이 앞) @ (도메인) . (TLD). 틀리면 안내만 하고 중단.
                if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                    status.textContent = T({ en: 'Enter a valid email.', ko: '올바른 이메일을 입력하세요.', ja: '有効なメールを入力してください。', pt: 'Indique um email válido.', es: 'Indique un correo válido.' });
                    return;
                }
                const base = (window.AURA_SERVER || '').replace(/\/$/, '');
                if (!base) {
                    status.textContent = T({ en: 'Server not configured.', ko: '서버 설정 누락.', ja: 'サーバー設定がありません。', pt: 'Servidor não configurado.', es: 'Servidor no configurado.' });
                    return;
                }
                status.textContent = T({ en: 'Sending…', ko: '전송 중…', ja: '送信中…', pt: 'A enviar…', es: 'Enviando…' });
                try {
                    // 워커의 구독 엔드포인트로 이메일+에디션을 JSON 으로 POST. await 로 응답 대기.
                    const r = await fetch(base + '/digest/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, edition: ed })
                    });
                    // r.ok 는 HTTP 200~299. 성공이면 "받은편지함 확인" 안내 + 폼 리셋.
                    if (r.ok) {
                        status.textContent = T({
                            en: 'Check your inbox to confirm.',
                            ko: '받은 편지함에서 확인 메일을 눌러주세요.',
                            ja: '受信トレイで承認メールをクリックしてください。',
                            pt: 'Verifique a sua caixa de entrada para confirmar.',
                            es: 'Revise su bandeja de entrada para confirmar.'
                        });
                        digestForm.reset();
                    } else {
                        status.textContent = T({ en: 'Something went wrong. Please try again.', ko: '문제가 발생했습니다. 다시 시도하세요.', ja: 'エラーが発生しました。再度お試しください。', pt: 'Algo correu mal. Tente novamente.', es: 'Algo salió mal. Inténtelo de nuevo.' });
                    }
                } catch (e) {
                    status.textContent = T({ en: 'Network error. Try again.', ko: '네트워크 오류. 다시 시도하세요.', ja: 'ネットワークエラー。再試行してください。', pt: 'Erro de rede. Tente novamente.', es: 'Error de red. Inténtelo de nuevo.' });
                }
            });
        }

        // 에디션 버튼: 클릭하면 그 언어판으로 전환(SAUDADE_EDITION.set).
        root.querySelectorAll('[data-edition]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-edition');
                if (window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
            });
        });

        // v8 §02 — Following handlers
        // 도시 추가/제거/추천묶음 적용 버튼. 각 동작 후 render() 로 슬롯 UI 를 다시 그린다.
        root.querySelectorAll('[data-following-add]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slug = btn.getAttribute('data-following-add');
                window.SAUDADE_FOLLOWING?.add?.(slug);
                render();
            });
        });
        root.querySelectorAll('[data-following-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slug = btn.getAttribute('data-following-remove');
                window.SAUDADE_FOLLOWING?.remove?.(slug);
                render();
            });
        });
        root.querySelectorAll('[data-following-pairing]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-following-pairing');
                window.SAUDADE_FOLLOWING?.applyPairing?.(id);
                render();
            });
        });

        // v7 §13 — Account handlers
        root.querySelector('[data-account-signin]')?.addEventListener('click', () => {
            window.SAUDADE_AUTH?.openModal?.();
        });
        root.querySelector('[data-account-tour]')?.addEventListener('click', () => {
            window.SAUDADE_AUTH?.startTour?.();
            render();
        });
        root.querySelector('[data-account-signout]')?.addEventListener('click', () => {
            window.SAUDADE_AUTH?.signOut?.();
            render();
        });

        // v8 §02 — v6 §5.4 Switch the desk 핸들러 제거 (Following 이 도시 변경 담당)

        // v6 §5.5 — 정의 안 된 도시 요청 폼
        // 사용자가 아직 없는 도시를 요청하면: 이미 정의된 도시면 바로 정착, 아니면 요청 카운트를
        // 올리고 "100명 모이면 개설" 안내를 보여준다.
        const reqForm = root.querySelector('[data-request-form]');
        if (reqForm) {
            reqForm.addEventListener('submit', (e) => {
                e.preventDefault();
                // FormData 로 input[name=city] 값을 읽는다.
                const fd = new FormData(reqForm);
                const cityName = String(fd.get('city') || '').trim();
                if (!cityName) return;
                const T = window.SAUDADE_T || ((s) => s.en);
                if (window.SAUDADE_CITY?.isDefined?.(cityName)) {
                    // 이미 정의된 도시 → 바로 setHomeCity
                    window.SAUDADE_CITY.setHomeCity(cityName);
                    render();
                    return;
                }
                // 미정의 → worker D1 INSERT (v7 §5.5) + local fallback
                // 먼저 로컬(localStorage)에 요청을 기록해 즉시 카운트를 얻고(오프라인에서도 동작),
                let count = window.SAUDADE_CITY?.recordRequest?.(cityName) || 0;
                const status = root.querySelector('[data-request-status]');
                // POST /city/request — fire-and-forget, count 갱신
                // 이어서 서버에도 보내 정확한 누적 count 로 갱신한다("발사 후 잊기" 방식).
                const _base = (window.AURA_SERVER || '').replace(/\/$/, '');
                if (_base) {
                    fetch(_base + '/city/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            requested_city: cityName,
                            edition: (window.SAUDADE_EDITION?.get?.() || 'en'),
                            user_email: (window.SAUDADE_AUTH?.getUser?.() || {}).email || null
                        }),
                        credentials: 'omit'
                    }).then(r => r.json()).then(j => {
                        if (j && typeof j.count === 'number' && status) {
                            count = j.count;
                            status.textContent = status.textContent.replace(/\d+\s*\/\s*100/, count + ' / 100');
                        }
                    }).catch(() => {});
                }
                if (status) {
                    const msg = T({
                        en: `“${cityName}” isn't on our desk yet. We've noted your request. When 100 readers ask for a city, we open the desk. Currently: ${count} of 100.`,
                        ko: `"${cityName}" 은 아직 책상 위에 없다. 요청을 기록했다. 100명이 모이면 다음 분기에 책상을 연다. 현재 ${count} / 100.`,
                        ja: `「${cityName}」はまだ机にない。要請を記録した。百名集まれば次号で机を開く。現在 ${count} / 100。`,
                        pt: `“${cityName}” ainda não está na nossa mesa. Registámos o seu pedido. Quando 100 leitores pedirem uma cidade, abrimos a mesa. Atualmente: ${count} de 100.`,
                        es: `“${cityName}” aún no está en nuestra mesa. Hemos anotado su solicitud. Cuando 100 lectores pidan una ciudad, abrimos la mesa. Actualmente: ${count} de 100.`
                    });
                    status.textContent = msg;
                }
                reqForm.querySelector('input').value = '';
            });
        }
    }

    // topbar #settingsBtn 클릭 capturing 가로채 → § 04 DESK 진입 (잡지 콜로폰).
    // (이전 saudade-colophon.js 의 hook 이 여기로 통합됨)
    // capturing 단계(addEventListener 의 세 번째 인자 true)에서 클릭을 먼저 가로채,
    // 다른 핸들러가 실행되기 전에 DESK 로 이동시킨다. stopImmediatePropagation 으로 뒤 핸들러 차단.
    function watchSettings() {
        document.addEventListener('click', (e) => {
            // closest — 클릭 지점에서 위로 올라가며 설정 버튼(또는 data-saudade-desk)을 찾는다.
            const btn = e.target.closest('#settingsBtn, [data-saudade-desk]');
            if (!btn) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            // section-04 진입 (saudade-masthead 의 setSection 흐름)
            if (window.SAUDADE_MASTHEAD?.setSection) {
                window.SAUDADE_MASTHEAD.setSection('trip');
            } else {
                document.body.classList.add('section-active');
                document.body.setAttribute('data-section', '04');
            }
        }, true);
    }

    // 모듈 초기화: 스타일 주입 → 첫 렌더 → 설정 버튼 후킹 → 섹션/에디션 변화 감지.
    function init() {
        injectStyles();
        render();
        watchSettings();
        // data-section 이 04(DESK)로 바뀌거나 에디션이 바뀌면 화면을 최신으로 다시 그린다.
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '04') render();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
    }

    // DOM 이 아직 로딩 중이면 준비 완료 후 init, 이미 끝났으면 즉시 init.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 공개 API — 다른 모듈이 desk 를 다시 그리게 할 수 있도록 render 만 노출.
    window.SAUDADE_DESK = { render };
})();
