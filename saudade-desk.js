// SAUDADE · § 04 THE DESK (Handoff v2 §5.4)
// 발행 파이프라인 + 사용자 설정 (편집부 페이지).
// 카드 X. 모든 요소 mono UPPERCASE 라벨 + Fraunces 본문.
// 모달 X — 페이지 진입.
'use strict';

(function() {
    if (window.SAUDADE_DESK) return;

    // v3 pipeline — 100% free AI stack (Workers AI + Gemini 2.0 Flash).
    // 운영비 0원. provider 는 LLM_*_PROVIDER env var 로 swap 가능.
    const PIPELINE = [
        { time: '00:00 KST', step: 'GATHER',    desc: 'rss-parser collects RSS from city halls, museums, local press.' },
        { time: '00:30 KST', step: 'SORT',      desc: 'Workers AI · Llama 3.1 8B — city classification, noise removed.' },
        { time: '02:00 KST', step: 'SCORE',     desc: 'Workers AI · Llama 3.1 8B — quietness scored one to ten.' },
        { time: '04:00 KST', step: 'WRITE',     desc: 'Gemini 2.0 Flash — three to four sentence dispatches rewritten.' },
        { time: '05:00 KST', step: 'TRANSLATE', desc: 'Gemini 2.0 Flash — base edition into four separate impressions.' },
        { time: '05:30 KST', step: 'STAGE',     desc: 'D1 staged for editorial review.' },
        { time: '06:00 KST', step: 'FILE',      desc: 'Top nine publish. Human editor reviews afterwards.' }
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
    border-bottom: 0.5px solid var(--rule);
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
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1;
    color: var(--ink);
    flex: 1;
}
.sdd-following-remove {
    background: transparent !important;
    border: 0 !important;
    color: var(--bone-d) !important;
    font-family: var(--mono) !important;
    font-size: 16px !important;
    width: 32px !important;
    height: 32px !important;
    min-height: 32px !important;
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
.sdd-following-opt:hover { color: var(--rust) !important; background: rgba(15,14,18,.04) !important; }
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

/* v6 §5.4 — Switch the Desk active state */
.sdd-desk-switch-active {
    padding: clamp(16px, 2vw, 24px);
    border: 0.5px solid var(--accent, var(--rust));
    margin: 0 0 16px;
}
.sdd-desk-switch-msg {
    font-family: var(--serif);
    font-weight: 300;
    font-style: italic;
    font-size: clamp(15px, 1.4vw, 18px);
    line-height: 1.4;
    color: var(--accent, var(--rust));
    margin: 0 0 14px;
}
.sdd-desk-switch-actions {
    display: flex; flex-wrap: wrap; gap: 10px;
}

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

    // v7 §13 — Account section (sign-in / tour / sign-out). 헌법 §13 매직 링크.
    function renderAccountSection() {
        const T = window.SAUDADE_T || ((s) => s.en);
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

    // v6 §5.4 — Switch the Desk + Home City UI (v8: Switch the desk 폐기, home city 만 유지)
    function renderHomeDeskSection() {
        if (!window.SAUDADE_CITY) return '';
        const T = window.SAUDADE_T || ((s) => s.en);
        const home = window.SAUDADE_CITY.getHomeCity();
        const sw = window.SAUDADE_CITY.getSwitch();
        const ed = window.SAUDADE_EDITION?.get?.() || 'en';
        const homeName = window.SAUDADE_CITY.cityName(home, ed);
        const adjacent = window.SAUDADE_CITY.adjacentCities();

        const labels = {
            label:    T({ en: 'Home Desk', ko: '정착 책상', ja: '本拠デスク', pt: 'Mesa Permanente', es: 'Mesa Permanente' }),
            sub:      T({ en: 'Where you sleep this month', ko: '이번 달 머무는 곳', ja: '今月の住まい', pt: 'Onde dorme este mês', es: 'Dónde duermes este mes' }),
            switchTo: T({ en: 'Switch the desk to', ko: '책상을 옮기기', ja: 'デスクを移す', pt: 'Mudar a mesa para', es: 'Mover la mesa a' }),
            returnIn: T({ en: 'Returning to $home in $days days', ko: '$days일 후 $home 으로 복귀', ja: '$days日後に $home に戻ります', pt: 'Regresso a $home em $days dias', es: 'Regreso a $home en $days días' }),
            returnNow:T({ en: 'Return now', ko: '지금 복귀', ja: '今すぐ戻る', pt: 'Voltar agora', es: 'Volver ahora' }),
            keepHere: T({ en: 'Keep me on $to permanently', ko: '$to 를 정착 도시로', ja: '$to を本拠に', pt: 'Manter $to permanente', es: 'Mantener $to permanente' }),
            requestNew: T({ en: 'Request a new desk', ko: '새 책상 요청', ja: '新しいデスクを要請', pt: 'Pedir uma nova mesa', es: 'Solicitar una nueva mesa' }),
            requestPh:  T({ en: 'CITY NAME', ko: '도시 이름', ja: '都市名', pt: 'NOME DA CIDADE', es: 'NOMBRE DE LA CIUDAD' }),
            requestSent:T({ en: 'Submitted, queued for next issue.', ko: '제출됐다. 다음 호에 검토한다.', ja: '提出された。次号で検討する。', pt: 'Submetido, em fila para a próxima edição.', es: 'Enviado, en cola para la próxima edición.' })
        };

        // Switch active 시
        let switchHtml = '';
        if (sw && sw.to) {
            const daysLeft = Math.max(0, Math.ceil((new Date(sw.returns_at).getTime() - Date.now()) / 86400000));
            const fromName = window.SAUDADE_CITY.cityName(sw.from, ed);
            const toName = window.SAUDADE_CITY.cityName(sw.to, ed);
            switchHtml = `
                <div class="sdd-desk-switch-active">
                    <p class="sdd-desk-switch-msg">
                        ${escapeHtml(labels.returnIn.replace('$home', fromName).replace('$days', String(daysLeft)))}
                    </p>
                    <div class="sdd-desk-switch-actions">
                        <button class="sdd-desk-edition-opt" data-switch-end>
                            ${escapeHtml(labels.returnNow)}
                        </button>
                        <button class="sdd-desk-edition-opt" data-switch-permanent>
                            ${escapeHtml(labels.keepHere.replace('$to', toName))}
                        </button>
                    </div>
                </div>
            `;
        }

        // 주변 도시 → switch buttons
        const adjacentBtnsHtml = !sw && adjacent.length ? adjacent.map(c => {
            const name = window.SAUDADE_CITY.cityName(c, ed);
            return `<button class="sdd-desk-edition-opt" data-switch-to="${escapeHtml(c)}">
                        ${escapeHtml(labels.switchTo)} ${escapeHtml(name)}
                    </button>`;
        }).join('') : '';

        return `
            <section class="sdd-desk-section">
                <p class="sdd-desk-label">${escapeHtml(labels.label)}<span class="sdd-co-sub" style="display:block;font-weight:400;color:var(--bone-d);margin-top:4px">${escapeHtml(labels.sub)}</span></p>
                <p style="font-family:var(--serif);font-weight:300;font-style:italic;font-size:clamp(20px,2.4vw,28px);line-height:1.2;color:var(--ink);margin:0 0 16px">
                    ${escapeHtml(homeName)}
                </p>
                ${switchHtml}
                ${adjacentBtnsHtml ? `<div class="sdd-desk-edition-list" style="margin-top:12px">${adjacentBtnsHtml}</div>` : ''}
                <form class="sdd-desk-request-form" data-request-form style="margin-top:24px;display:flex;gap:8px;flex-wrap:wrap">
                    <input type="text" name="city" placeholder="${escapeHtml(labels.requestPh)}"
                           style="background:transparent;border:0;border-bottom:0.5px solid var(--rule);font-family:var(--mono);font-size:11px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;padding:10px 0;min-height:44px;flex:1;min-width:200px;color:var(--ink);outline:none" />
                    <button type="submit" class="sdd-desk-edition-opt">${escapeHtml(labels.requestNew)}</button>
                </form>
                <p class="sdd-desk-request-status" data-request-status style="font-family:var(--mono);font-size:10px;letter-spacing:var(--tr-mono-meta);text-transform:uppercase;color:var(--bone-d);margin:8px 0 0;min-height:14px"></p>
            </section>
        `;
    }

    function render() {
        let root = document.getElementById('sddDesk');
        if (!root) {
            root = document.createElement('section');
            root.id = 'sddDesk';
            root.className = 'sdd-desk';
            document.body.appendChild(root);
        }

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
            ${renderAccountSection()}

            <section class="sdd-desk-section">
                <p class="sdd-desk-disclaimer">
                    <strong>A note on sources.</strong>
                    Each dispatch is rewritten in our own words from the source listed.
                    We quote no more than twenty-five words. We link to the original.
                    We do not republish AP, Reuters, or Bloomberg copy. We never use
                    photographs we did not take ourselves. Dispatches are AI-assisted
                    and reviewed by a human editor.
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

        root.querySelectorAll('[data-edition]').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-edition');
                if (window.SAUDADE_EDITION?.set) window.SAUDADE_EDITION.set(code);
            });
        });

        // v8 §02 — Following handlers
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

        // v6 §5.4 — Switch the Desk handlers
        root.querySelectorAll('[data-switch-to]').forEach(btn => {
            btn.addEventListener('click', () => {
                const to = btn.getAttribute('data-switch-to');
                if (window.SAUDADE_CITY?.startSwitch) window.SAUDADE_CITY.startSwitch(to);
            });
        });
        root.querySelector('[data-switch-end]')?.addEventListener('click', () => {
            window.SAUDADE_CITY?.endSwitch?.();
        });
        root.querySelector('[data-switch-permanent]')?.addEventListener('click', () => {
            window.SAUDADE_CITY?.makePermanent?.();
        });

        // v6 §5.5 — 정의 안 된 도시 요청 폼
        const reqForm = root.querySelector('[data-request-form]');
        if (reqForm) {
            reqForm.addEventListener('submit', (e) => {
                e.preventDefault();
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
                let count = window.SAUDADE_CITY?.recordRequest?.(cityName) || 0;
                const status = root.querySelector('[data-request-status]');
                // POST /city/request — fire-and-forget, count 갱신
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
    function watchSettings() {
        document.addEventListener('click', (e) => {
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

    function init() {
        injectStyles();
        render();
        watchSettings();
        const mo = new MutationObserver(() => {
            if (document.body.getAttribute('data-section') === '04') render();
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['data-section', 'data-edition'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_DESK = { render };
})();
