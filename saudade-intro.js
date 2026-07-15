// SAUDADE · INTRO — 잉크 번짐 로고 인트로
// 앱 로드 시 'saudade' 워드마크가 잉크 번지듯(blur→sharp + fade) 등장 후
// 커버로 디졸브. 클릭/키/탭으로 스킵. prefers-reduced-motion 존중.
// 세션당 1회(sessionStorage) — 매 새로고침마다 반복되면 성가시므로.
'use strict';

(function () {
    if (window.SAUDADE_INTRO) return;

    function injectStyles() {
        if (document.getElementById('sddIntroStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddIntroStyles';
        s.textContent = `
#sddIntro {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0e0b18;
    cursor: pointer;
    transition: opacity .8s ease;
}
#sddIntro.sdd-intro-out { opacity: 0; pointer-events: none; }
.sdd-intro-word {
    font-family: var(--serif, "Fraunces", Georgia, "Times New Roman", serif);
    font-style: italic;
    font-weight: 400;
    font-size: clamp(52px, 13vw, 132px);
    letter-spacing: -.02em;
    color: #f3ecdc;
    opacity: 0;
    filter: blur(16px);
    transform: scale(1.045);
    transition: opacity 1.35s cubic-bezier(.22,.61,.36,1),
                filter 1.5s cubic-bezier(.22,.61,.36,1),
                transform 1.6s cubic-bezier(.22,.61,.36,1);
    will-change: opacity, filter, transform;
}
#sddIntro.sdd-intro-in .sdd-intro-word {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
}
.sdd-intro-tag {
    position: absolute;
    bottom: 14vh;
    left: 0; right: 0;
    text-align: center;
    font-family: var(--serif, Georgia, serif);
    font-style: italic;
    font-size: clamp(13px, 1.6vw, 17px);
    color: rgba(243,236,220,.55);
    opacity: 0;
    transition: opacity 1.2s ease .7s;
}
#sddIntro.sdd-intro-in .sdd-intro-tag { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
    .sdd-intro-word, .sdd-intro-tag { transition: opacity .3s ease; filter: none; transform: none; }
}
`;
        document.head.appendChild(s);
    }

    function run() {
        // 세션당 1회
        try { if (sessionStorage.getItem('saudade.intro.seen')) return; } catch (e) {}
        if (document.getElementById('sddIntro')) return;
        injectStyles();

        const el = document.createElement('div');
        el.id = 'sddIntro';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
            '<div class="sdd-intro-word">saudade</div>' +
            '<div class="sdd-intro-tag">a longing for what cannot return</div>';
        document.body.appendChild(el);
        try { sessionStorage.setItem('saudade.intro.seen', '1'); } catch (e) {}

        const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        // 다음 프레임에 in 클래스 → 트랜지션 발동
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('sdd-intro-in')));

        let done = false;
        function finish() {
            if (done) return;
            done = true;
            el.classList.add('sdd-intro-out');
            setTimeout(() => { if (el.parentNode) el.remove(); }, 850);
            document.removeEventListener('keydown', finish);
        }
        el.addEventListener('click', finish);
        document.addEventListener('keydown', finish);
        setTimeout(finish, reduce ? 500 : 2400);
    }

    function init() {
        if (document.body) run();
        else document.addEventListener('DOMContentLoaded', run);
    }
    init();

    window.SAUDADE_INTRO = { run };
})();
