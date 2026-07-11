// saudade · first-run welcome
//
// A three-card welcome that runs once per device. Sets the tone: this is a
// newspaper, not a dashboard. Skippable (Esc / Skip / Don't show again).
//
// Trigger:
//   • shown automatically the first time the cover loads on a fresh device
//   • re-openable via window.SAUDADE_WELCOME.open() or #welcome hash
'use strict';

// IIFE — 로드 즉시 실행. 새 기기에서 한 번만 뜨는 환영 카드 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_WELCOME) return;
    // KEY — "이미 봤음" 플래그 localStorage 키.
    const KEY = 'saudade.welcome.seen';

    // L — 현재 에디션 언어 문자열 선택(없으면 영어).
    function L(strings) {
        const ed = (window.SAUDADE_EDITION && window.SAUDADE_EDITION.get && window.SAUDADE_EDITION.get()) || 'en';
        return strings[ed] || strings.en;
    }

    // escapeHtml — innerHTML 주입 전 위험 문자 이스케이프(XSS 방지).
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        })[ch]);
    }

    function copy() {
        // v640 — collapsed from 3 cards to 1. The previous deck was the
        // first thing every visitor saw and read like a brochure on top of
        // the cover. A single italic headline + one paragraph + one action
        // is enough to set tone without robbing the cover of its first
        // impression. Etymology and section overview moved to /etymology.html
        // and /sitemap.html, which are linked from the cover footer.
        return [
            {
                eyebrow:  L({ en: 'WELCOME.', ko: '어서 오라.', ja: 'ようこそ。', pt: 'BEM-VINDO.', es: 'BIENVENIDO.' }),
                headline: L({
                    en: 'A slow newspaper. Three cities, no schedule.',
                    ko: '느린 신문. 세 도시, 정해진 시간 없음.',
                    ja: 'ゆっくりとした新聞。三つの都市、時刻表なし。',
                    pt: 'Um jornal lento. Três cidades, sem horário.',
                    es: 'Un periódico lento. Tres ciudades, sin horario.'
                }),
                body: L({
                    en: '<em>saudade</em> is Portuguese for the longing you carry for places you cannot return to. We file three city items, six days a week. Sunday is silence — by design. Read on, or sign in to track the days you have left.',
                    ko: '<em>saudade</em> 는 돌아갈 수 없는 장소에 대한 그리움이라는 뜻의 포르투갈어. 일주일에 엿새, 도시당 세 항목. 일요일은 침묵 — 의도된 것. 그냥 읽어도 좋고, 로그인하면 남은 일수를 헤아려준다.',
                    ja: '<em>saudade</em> は戻れない場所への切なさを意味するポルトガル語。週六日、都市ごとに三本。日曜は沈黙 — 意図されたもの。そのまま読むも良し、サインインすれば残り日数を数える。',
                    pt: '<em>saudade</em> em português é a ausência de algo a que não se pode regressar. Três itens por cidade, seis dias por semana. Domingo é silêncio — propositado. Continue a ler, ou entre para contar os dias.',
                    es: '<em>saudade</em> en portugués significa la añoranza por los lugares a los que no se puede volver. Tres elementos por ciudad, seis días por semana. El domingo es silencio — intencionado. Siga leyendo, o entre para contar los días.'
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

    // injectStyles — 이 모듈 전용 CSS 를 <head> 에 한 번만 주입(전역 CSS 변수 사용).
    function injectStyles() {
        if (document.getElementById('sddWelcomeStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddWelcomeStyles';
        s.textContent = `
.sdd-welcome {
    position: fixed; inset: 0; z-index: var(--z-modal-welcome);
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

    // _root: 모달 컨테이너. _step: 현재 카드 인덱스(카드 1장이라 항상 0).
    let _root = null;
    let _step = 0;

    // ensureRoot — 모달 컨테이너를 한 번만 만들고 ESC/좌우 화살표 키를 건다(접근성).
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

    // paint — 현재 카드를 그리고 건너뛰기/뒤로/다음 버튼 핸들러를 건다.
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

    // next — 다음 카드로(마지막이면 닫으며 본 것으로 표시).
    function next() {
        const len = copy().length;
        if (_step < len - 1) { _step++; paint(); }
        else { close(true); }
    }
    // prev — 이전 카드로.
    function prev() {
        if (_step > 0) { _step--; paint(); }
    }

    // open — 첫 카드부터 환영 화면을 표시.
    function open() {
        injectStyles();
        _step = 0;
        paint();
        ensureRoot().classList.add('active');
    }
    // close — 화면을 닫는다. seen 이면 "봤음" 플래그를 저장해 다시 안 뜨게.
    function close(seen) {
        if (_root) _root.classList.remove('active');
        if (seen) try { localStorage.setItem(KEY, '1'); } catch (e) {}
        if (location.hash === '#welcome') {
            try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
    }

    // maybeAutoOpen — 처음 방문(플래그 없음)에만 자동으로 띄운다. 토큰/다른 딥링크 위엔 안 띄움.
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

    // init — 스타일 주입 + #welcome 딥링크면 즉시 열기, 아니면 첫 방문 자동 표시 판단.
    function init() {
        injectStyles();
        if (location.hash === '#welcome') { open(); return; }
        maybeAutoOpen();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    // 전역 공개 API — 환영 화면 열기/닫기.
    window.SAUDADE_WELCOME = { open, close };
})();
