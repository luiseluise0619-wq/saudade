// saudade · first-run welcome
//
// A three-card welcome that runs once per device. Sets the tone: this is a
// newspaper, not a dashboard. Skippable (Esc / Skip / Don't show again).
//
// Trigger:
//   • shown automatically the first time the cover loads on a fresh device
//   • re-openable via window.SAUDADE_WELCOME.open() or #welcome hash
'use strict';

(function() {
    if (window.SAUDADE_WELCOME) return;
    const KEY = 'saudade.welcome.seen';

    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function copy() {
        return [
            {
                eyebrow:  L({ en: 'WELCOME TO SAUDADE.', ko: 'SAUDADE 에 어서 오라.', ja: 'SAUDADE へようこそ。', pt: 'BEM-VINDO À SAUDADE.', es: 'BIENVENIDO A SAUDADE.' }),
                headline: L({
                    en: 'A slow newspaper for people who keep moving.',
                    ko: '계속 움직이는 사람들을 위한 느린 신문.',
                    ja: '動き続ける人のための、ゆっくりとした新聞。',
                    pt: 'Um jornal lento para quem continua a mover-se.',
                    es: 'Un periódico lento para quienes siguen moviéndose.'
                }),
                body: L({
                    en: '<em>saudade</em> is Portuguese for the longing you carry for places you can’t return to. We file three city items, six days a week. Sunday is silence — by design.',
                    ko: '<em>saudade</em> 는 돌아갈 수 없는 장소에 대한 그리움이라는 뜻의 포르투갈어. 우리는 일주일에 엿새, 도시당 세 항목을 보낸다. 일요일은 침묵 — 의도된 것.',
                    ja: '<em>saudade</em> は、戻れない場所への切なさを意味するポルトガル語。週六日、都市ごとに三本を届ける。日曜は沈黙 — 意図されたもの。',
                    pt: '<em>saudade</em> em português é a ausência de algo a que não se pode regressar. Arquivamos três itens por cidade, seis dias por semana. Domingo é silêncio — propositado.',
                    es: '<em>saudade</em> en portugués significa la añoranza por los lugares a los que no se puede volver. Archivamos tres elementos por ciudad, seis días por semana. El domingo es silencio — intencionado.'
                })
            },
            {
                eyebrow:  L({ en: 'FOUR SECTIONS.', ko: '네 개의 섹션.', ja: '四つのセクション。', pt: 'QUATRO SECÇÕES.', es: 'CUATRO SECCIONES.' }),
                headline: L({
                    en: 'A ledger, an atlas, dispatches, and the desk.',
                    ko: '장부, 지도, 디스패치, 그리고 편집부.',
                    ja: '台帳、地図、ディスパッチ、編集部。',
                    pt: 'Um livro-razão, um atlas, despachos, e a redacção.',
                    es: 'Un libro mayor, un atlas, despachos, y la redacción.'
                }),
                body: L({
                    en: '<strong>§01 Ledger</strong> counts visa days, tax-residency days, insurance pauses, pension filings. <strong>§02 Atlas</strong> is verified work cafés. <strong>§03 Dispatches</strong> is policy news. <strong>§04 The Desk</strong> shows the daily filing pipeline.',
                    ko: '<strong>§01 Ledger</strong> 는 비자·세금·보험·연금 일수를 헤아린다. <strong>§02 Atlas</strong> 는 검증된 작업용 카페. <strong>§03 Dispatches</strong> 는 정책 뉴스. <strong>§04 The Desk</strong> 는 일일 발행 파이프라인.',
                    ja: '<strong>§01 Ledger</strong> はビザ・税・保険・年金の日数を数える。<strong>§02 Atlas</strong> は検証済みの作業向けカフェ。<strong>§03 Dispatches</strong> は政策ニュース。<strong>§04 The Desk</strong> は日次入稿パイプライン。',
                    pt: '<strong>§01 Ledger</strong> conta dias de visto, residência fiscal, pausas de seguro, pensões. <strong>§02 Atlas</strong> são cafés de trabalho verificados. <strong>§03 Dispatches</strong> é notícia de política. <strong>§04 The Desk</strong> mostra o pipeline diário.',
                    es: '<strong>§01 Ledger</strong> cuenta días de visado, residencia fiscal, pausas de seguro, pensiones. <strong>§02 Atlas</strong> son cafés de trabajo verificados. <strong>§03 Dispatches</strong> son noticias de política. <strong>§04 The Desk</strong> muestra el pipeline diario.'
                })
            },
            {
                eyebrow:  L({ en: 'BEFORE YOU READ.', ko: '읽기 전에.', ja: '読む前に。', pt: 'ANTES DE LER.', es: 'ANTES DE LEER.' }),
                headline: L({
                    en: 'Sign in, or browse without.',
                    ko: '로그인하거나, 그냥 둘러보라.',
                    ja: 'サインインするか、そのまま読む。',
                    pt: 'Entre, ou navegue sem registar.',
                    es: 'Inicie sesión, o navegue sin registrarse.'
                }),
                body: L({
                    en: 'Magic-link only — no password, no tracker. Your visa data lives on this device. Whatever we do hold, you can export, delete, or revoke from <code>#account</code> at any time.',
                    ko: '매직 링크만 사용 — 비밀번호도, 추적도 없다. 비자 데이터는 이 기기에만 머문다. 우리가 보관하는 것은 무엇이든 <code>#account</code> 에서 언제든 내보내기·삭제·회수 가능.',
                    ja: 'マジックリンクのみ — パスワードも追跡もなし。ビザ情報はこの端末だけにある。我々が保持するものは <code>#account</code> でいつでもエクスポート・削除・取消できる。',
                    pt: 'Apenas magic-link — sem palavra-passe, sem rastreamento. Os dados de visto vivem neste dispositivo. O que tivermos, pode exportar, apagar, ou revogar em <code>#account</code> a qualquer momento.',
                    es: 'Sólo magic-link — sin contraseña, sin rastreo. Sus datos de visado viven en este dispositivo. Lo que conservemos, puede exportar, borrar o revocar en <code>#account</code> en cualquier momento.'
                })
            }
        ];
    }

    function btnCopy() {
        return {
            next:  L({ en: 'CONTINUE', ko: '계속', ja: '次へ', pt: 'CONTINUAR', es: 'CONTINUAR' }),
            back:  L({ en: 'BACK', ko: '뒤로', ja: '戻る', pt: 'VOLTAR', es: 'VOLVER' }),
            done:  L({ en: 'BEGIN READING', ko: '읽기 시작', ja: '読みはじめる', pt: 'COMEÇAR A LER', es: 'EMPEZAR A LEER' }),
            skip:  L({ en: 'SKIP', ko: '건너뛰기', ja: 'スキップ', pt: 'SALTAR', es: 'OMITIR' })
        };
    }

    function injectStyles() {
        if (document.getElementById('sddWelcomeStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWelcomeStyles';
        s.textContent = `
.sdd-welcome {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--paper);
    color: var(--ink);
    display: none;
    align-items: center;
    justify-content: center;
    padding: clamp(40px, 8vw, 96px);
    overflow-y: auto;
    animation: sddWelcomeFade .35s ease both;
}
.sdd-welcome.active { display: flex; }
@keyframes sddWelcomeFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.sdd-welcome__inner {
    width: 100%; max-width: 560px;
    border-top: 0.5px solid var(--rule);
    border-bottom: 0.5px solid var(--rule);
    padding: clamp(28px, 4vw, 48px) 0;
}
.sdd-welcome__step {
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d);
    margin: 0 0 clamp(14px, 2vw, 18px);
    display: flex; gap: 6px;
}
.sdd-welcome__step span {
    display: inline-block; width: 14px; height: 1px; background: var(--rule);
}
.sdd-welcome__step span.active { background: var(--rust); height: 2px; }
.sdd-welcome__eyebrow {
    font-family: var(--mono); font-weight: 500;
    font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--rust); margin: 0 0 clamp(14px, 2vw, 20px);
}
.sdd-welcome__h {
    font-family: var(--serif); font-weight: 300; font-style: italic;
    font-size: clamp(34px, 4.5vw, 52px); line-height: 1.02;
    letter-spacing: -0.025em;
    color: var(--ink); margin: 0 0 clamp(20px, 3vw, 28px);
    text-wrap: balance;
}
.sdd-welcome__body {
    font-family: var(--serif); font-weight: 300;
    font-size: clamp(15px, 1.4vw, 18px); line-height: 1.6;
    color: var(--ink); margin: 0 0 clamp(28px, 4vw, 40px);
    max-width: 48ch;
}
.sdd-welcome__body em { font-style: italic; color: var(--rust); }
.sdd-welcome__body strong { font-weight: 400; color: var(--rust); }
.sdd-welcome__body code {
    font-family: var(--mono); font-size: 12px;
    padding: 1px 6px; background: var(--paper-d); border: 0.5px solid var(--rule);
}
.sdd-welcome__nav {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 0.5px solid var(--rule);
    padding-top: clamp(16px, 2vw, 22px);
    gap: 16px;
}
.sdd-welcome__btn {
    background: transparent; border: 0;
    font-family: var(--mono); font-weight: 500;
    font-size: 12px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--ink); cursor: pointer; padding: 12px 4px;
    transition: color .15s;
    min-height: 44px;
}
.sdd-welcome__btn:hover { color: var(--rust); }
.sdd-welcome__btn.is-quiet { color: var(--bone-d); }
.sdd-welcome__btn[disabled] { opacity: 0.3; pointer-events: none; }
.sdd-welcome__skip {
    position: absolute; top: clamp(20px, 4vw, 32px); right: clamp(20px, 4vw, 32px);
    background: transparent; border: 0;
    font-family: var(--mono); font-weight: 500;
    font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--bone-d); cursor: pointer;
}
.sdd-welcome__skip:hover { color: var(--rust); }

@media (prefers-reduced-motion: reduce) {
    .sdd-welcome { animation: none; }
}
@media print { .sdd-welcome { display: none !important; } }
        `;
        document.head.appendChild(s);
    }

    let _root = null;
    let _step = 0;

    function ensureRoot() {
        if (_root) return _root;
        _root = document.createElement('div');
        _root.className = 'sdd-welcome';
        _root.setAttribute('role', 'dialog');
        _root.setAttribute('aria-modal', 'true');
        _root.setAttribute('aria-label', 'Welcome to saudade');
        document.body.appendChild(_root);
        document.addEventListener('keydown', (e) => {
            if (!_root.classList.contains('active')) return;
            if (e.key === 'Escape') close(true);
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft')  prev();
        });
        return _root;
    }

    function paint() {
        const cards = copy();
        const step = cards[_step];
        const b = btnCopy();
        const dots = cards.map((_, i) => `<span class="${i <= _step ? 'active' : ''}"></span>`).join('');
        ensureRoot().innerHTML = `
            <button type="button" class="sdd-welcome__skip" data-skip>${escapeHtml(b.skip)}</button>
            <div class="sdd-welcome__inner">
                <div class="sdd-welcome__step">${dots}</div>
                <p class="sdd-welcome__eyebrow">${escapeHtml(step.eyebrow)}</p>
                <h1 class="sdd-welcome__h">${escapeHtml(step.headline)}</h1>
                <p class="sdd-welcome__body">${step.body /* trusted: from in-file copy bank */}</p>
                <div class="sdd-welcome__nav">
                    <button type="button" class="sdd-welcome__btn is-quiet" data-back ${_step === 0 ? 'disabled' : ''}>${escapeHtml(b.back)}</button>
                    <button type="button" class="sdd-welcome__btn" data-next>${escapeHtml(_step === cards.length - 1 ? b.done : b.next)}</button>
                </div>
            </div>
        `;
        _root.querySelector('[data-skip]').addEventListener('click', () => close(true));
        _root.querySelector('[data-back]').addEventListener('click', prev);
        _root.querySelector('[data-next]').addEventListener('click', next);
    }

    function next() {
        const len = copy().length;
        if (_step < len - 1) { _step++; paint(); }
        else { close(true); }
    }
    function prev() {
        if (_step > 0) { _step--; paint(); }
    }

    function open() {
        injectStyles();
        _step = 0;
        paint();
        ensureRoot().classList.add('active');
    }
    function close(seen) {
        if (_root) _root.classList.remove('active');
        if (seen) try { localStorage.setItem(KEY, '1'); } catch (e) {}
        if (location.hash === '#welcome') {
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }

    function maybeAutoOpen() {
        try {
            if (localStorage.getItem(KEY) === '1') return;
        } catch (e) { return; }
        // Don't show on top of magic-link verify or already-deep-linked panels.
        if (location.search && /token=/.test(location.search)) return;
        if (location.hash && location.hash !== '#welcome') return;
        // 600 ms delay so the cover painting finishes first.
        setTimeout(open, 600);
    }

    function init() {
        injectStyles();
        if (location.hash === '#welcome') { open(); return; }
        maybeAutoOpen();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    window.SAUDADE_WELCOME = { open, close };
})();
