// SAUDADE · RINGS — 동심원 시스템 (헌법 §3 유일한 시각적 모티프)
// 신규 파일. 기존 JS 한 줄도 수정 안 함.
// 사용처: § 00 표지 배경 macro rings 14개. 다른 §에는 meso rings 8개.
// 회전 애니메이션 금지. 페이드인 0.4s 한 번만. paper 위 ink rule color.
'use strict';

// IIFE — 로드 즉시 실행. 잡지의 유일한 시각 모티프인 동심원(rings) SVG 를 그리는 모듈.
(function() {
    // 중복 로드 방어(멱등).
    if (window.SAUDADE_RINGS) return;
    window.SAUDADE_RINGS = { ready: false };

    // NS — SVG 요소를 만들 때 필요한 네임스페이스 URI.
    const NS = 'http://www.w3.org/2000/svg';

    // originXY — 동심원 중심을 화면 어디에 둘지(모서리/중앙) 좌표로 환산.
    // origin 옵션: 'center' | 'bottom-right' | 'top-left' | 'bottom-left'
    function originXY(origin, w, h) {
        switch (origin) {
            case 'top-left':     return { cx: w * 0.05, cy: h * 0.05 };
            case 'top-right':    return { cx: w * 0.95, cy: h * 0.05 };
            case 'bottom-left':  return { cx: w * 0.05, cy: h * 0.95 };
            case 'bottom-right': return { cx: w * 0.95, cy: h * 0.95 };
            case 'center':
            default:             return { cx: w * 0.5, cy: h * 0.5 };
        }
    }

    // injectMobileStyles — 모바일에서 링 투명도를 낮추는 CSS 를 한 번만 주입(성능/가독성).
    // 메인 SVG 빌더 — 14개 macro rings 또는 8개 meso rings
    function injectMobileStyles() {
        if (document.getElementById('sddRingsMobileStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddRingsMobileStyles';
        s.textContent = '@media (max-width: 768px) { .sdd-rings-svg, [data-sdd-rings] { opacity: 0.35 !important; } }';
        document.head.appendChild(s);
    }
    injectMobileStyles();

    // buildSvg — scale(macro/meso/micro)에 따라 원 개수/반경/투명도를 정해 SVG 를 만든다.
    function buildSvg(scale, origin) {
        const w = 1600, h = 1200;     // viewBox — 16:12 매거진 비율
        const { cx, cy } = originXY(origin, w, h);

        // scale 별 파라미터: macro=표지 배경 14개, meso=섹션 8개, 그 외=단일 원.
        const params = scale === 'macro'
            ? { count: 14, strokeOpacity: [0.06, 0.18], rMin: 80, rStep: 100 }
            : scale === 'meso'
            ? { count: 8,  strokeOpacity: [0.10, 0.28], rMin: 60, rStep: 130 }
            : { count: 1,  strokeOpacity: [1.0],        rMin: 18, rStep: 0  };

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('xmlns', NS);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('data-sdd-rings', '');
        svg.style.cssText = [
            'position:fixed', 'inset:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:1',
            'opacity:0',
            'transition:opacity .4s ease-out'
        ].join(';');

        const opMin = params.strokeOpacity[0];
        const opMax = params.strokeOpacity[params.strokeOpacity.length - 1];

        for (let i = 0; i < params.count; i++) {
            const r = params.rMin + i * params.rStep;
            const t = params.count > 1 ? i / (params.count - 1) : 0;
            // 안쪽일수록 진하게, 바깥쪽으로 페이드
            const op = opMax - (opMax - opMin) * t;
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', cx);
            c.setAttribute('cy', cy);
            c.setAttribute('r', r);
            c.setAttribute('fill', 'none');
            c.setAttribute('stroke', 'currentColor');
            c.setAttribute('stroke-width', '1');
            c.setAttribute('stroke-opacity', op.toFixed(3));
            svg.appendChild(c);
        }

        return svg;
    }

    // mount — 링 SVG 를 body 에 붙이고 페이드인(같은 scale 이 있으면 교체).
    // 페이지에 마운트 — body 직접 자식으로. cafe-mode 진입 시 자동 hide.
    function mount(scale = 'macro', origin = 'bottom-right') {
        const isMobile = window.innerWidth <= 768;
        if (isMobile && scale === 'macro') {
            // 모바일은 macro 표시 안 함 (헌법 §6-2 — 성능 + 화면 좁음). meso 만 5개.
            scale = 'meso';
        }
        const svg = buildSvg(scale, origin);
        svg.id = 'saudadeRings_' + scale;
        svg.style.color = 'var(--ink)';
        // 카페 모드에선 자동 숨김 (§4-6 reading room 은 영상만)
        svg.dataset.scale = scale;

        const existing = document.getElementById(svg.id);
        if (existing) existing.remove();

        document.body.appendChild(svg);
        // 페이드인
        requestAnimationFrame(() => {
            svg.style.opacity = '1';
        });
        return svg;
    }

    // unmount — 특정 scale(또는 전체) 링을 페이드아웃 후 제거.
    function unmount(scale) {
        if (scale) {
            const el = document.getElementById('saudadeRings_' + scale);
            if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }
        } else {
            document.querySelectorAll('[id^="saudadeRings_"]').forEach(el => {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 400);
            });
        }
    }

    // watchCafeMode — 카페(리딩룸) 모드에서는 링을 숨기고 나오면 다시 보인다.
    // 카페 모드 토글 시 자동 hide/show (existing class observer)
    function watchCafeMode() {
        const mo = new MutationObserver(() => {
            const inCafe = document.body.classList.contains('cafe-mode');
            document.querySelectorAll('[id^="saudadeRings_"]').forEach(el => {
                el.style.display = inCafe ? 'none' : '';
            });
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // init — 표지 기본 화면에 macro 링을 깔고 카페 모드 감시 시작.
    function init() {
        // § 00 ISSUE COVER 가 디폴트 화면 — macro rings (또는 모바일은 meso)
        mount('macro', 'bottom-right');
        watchCafeMode();
        window.SAUDADE_RINGS.ready = true;
    }

    // 문서 로딩 중이면 DOMContentLoaded 후, 아니면 즉시 시동.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // public API — 다른 § 화면 이동 시 origin/scale 변경
    window.SAUDADE_RINGS.mount = mount;
    window.SAUDADE_RINGS.unmount = unmount;
})();
