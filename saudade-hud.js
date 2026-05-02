// SAUDADE · PRINT HUD CORNER MARKS (Handoff v3 §1.4)
// 페이지 네 모서리에 1.25px L자 인쇄 코너 마크 (18×18px).
// top/left/right 14px · bottom 78px (dock 위 공간 확보).
// 모든 view 공통 — cafe-mode 외 전부 표시.
// 헌법 §3 — 카드 UI 금지 룰의 보완: paper 가 실제 종이임을 시각적으로 단언.
'use strict';

(function() {
    if (window.SAUDADE_HUD) return;

    const NS = 'http://www.w3.org/2000/svg';

    function injectStyles() {
        if (document.getElementById('sddHudStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddHudStyles';
        s.textContent = `
.sdd-hud-corners {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 7;            /* z-cover(4) < z-footer(5) < z-mast(6) < HUD(7) < section-page(8) */
}
.sdd-hud-corner {
    position: absolute;
    width: 18px; height: 18px;
    border: 0;
    overflow: visible;
}
.sdd-hud-corner svg { display: block; width: 100%; height: 100%; }
.sdd-hud-corner svg path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.25;
    stroke-linecap: square;
}

.sdd-hud-tl { top: 14px;     left: 14px;  }
.sdd-hud-tr { top: 14px;     right: 14px; }
.sdd-hud-bl { bottom: 78px;  left: 14px;  }
.sdd-hud-br { bottom: 78px;  right: 14px; }

/* 카페 모드 외에는 모두 표시. listening 진입 시 paper → ink 전환되니 stroke 도 자동 (currentColor X — token 직접) */
body.cafe-mode .sdd-hud-corners,
body.listening-active .sdd-hud-corners { display: none !important; }

/* Listening Room 안에서도 HUD 보이게 하려면 stroke 색만 paper 로 — Y2 결정,
   v1 은 §4-6 룰 (UI 일체 없음) 우선. */

/* 모바일 — bottom 위치만 dock 위로 보정 */
@media (max-width: 768px) {
    .sdd-hud-bl { bottom: calc(var(--dock-h, 56px) + 22px); }
    .sdd-hud-br { bottom: calc(var(--dock-h, 56px) + 22px); }
}
`;
        document.head.appendChild(s);
    }

    function lShape(rotation) {
        // 18×18 SVG, L자 stroke. rotation 으로 4 모서리 변형:
        // tl: 0deg (┘ 모양 — 좌상단에 ┘ 배치하면 corner mark)
        // 실제로 각 코너에서 'inward' 방향으로 두 stroke 가 짧게 뻗는 모양.
        // tl: ┐ (right + down)
        // tr: ┌ (left + down)
        // bl: ┘ (right + up)
        // br: └ (left + up)
        // 단순하게 SVG path 4종 — 18px 길이 9px stroke.
        return rotation;
    }

    function svgFor(corner) {
        // 각 모서리 별 path. 18×18 viewBox. stroke 안쪽으로 9px 두 개.
        const PATHS = {
            tl: 'M 0 9 L 0 0 L 9 0',         // ┐ (좌·상)
            tr: 'M 9 0 L 18 0 L 18 9',       // ┌ (우·상)
            bl: 'M 0 9 L 0 18 L 9 18',       // ┘ (좌·하)
            br: 'M 9 18 L 18 18 L 18 9'      // └ (우·하)
        };
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('xmlns', NS);
        svg.setAttribute('viewBox', '0 0 18 18');
        svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', PATHS[corner]);
        svg.appendChild(p);
        return svg;
    }

    function mount() {
        if (document.getElementById('sddHudCorners')) return;
        const wrap = document.createElement('div');
        wrap.id = 'sddHudCorners';
        wrap.className = 'sdd-hud-corners';
        wrap.setAttribute('aria-hidden', 'true');

        const corners = ['tl', 'tr', 'bl', 'br'];
        corners.forEach(c => {
            const div = document.createElement('div');
            div.className = `sdd-hud-corner sdd-hud-${c}`;
            div.appendChild(svgFor(c));
            wrap.appendChild(div);
        });

        document.body.appendChild(wrap);
    }

    function init() {
        injectStyles();
        mount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_HUD = { mount };
})();
