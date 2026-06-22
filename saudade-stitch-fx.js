// ════════════════════════════════════════════════════════════════════════
// saudade · STITCH FX
// ════════════════════════════════════════════════════════════════════════
//
// 이 파일이 하는 일 (한 줄):
//   "리스닝 룸" 헤더에 16개 막대로 된 가짜 웨이브폼(소리 시각화)을 그려 넣고,
//   오디오가 재생 중일 때만 막대들이 출렁이게 만든다.
//
// 왜 별도 파일로 두었나?
//   saudade-stitch.css 는 "보라/핑크/글래스" 비주얼 reset 만 한다. 새로운
//   DOM(요소)을 만들어 넣는 건 JS 의 일이다. 둘을 분리해야 나중에 "비주얼만
//   되돌리기" 또는 "JS 효과만 끄기" 가 쉽다.
//
// 큰 그림:
//   1) IIFE — 즉시 실행되는 함수 (아래 설명)
//   2) ensureWaveform() — 헤더에 막대 16개 만들어 붙임
//   3) bindAudioToWaveforms() — 오디오 play/pause 이벤트 들음
//   4) MutationObserver — 페이지가 새로 그려져도 다시 붙도록 감시
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── IIFE (Immediately Invoked Function Expression) — "즉시 실행 함수" ──
// (function(){ ... })() 패턴: 함수를 만들자마자 곧바로 호출한다.
// 이렇게 하면 안에서 선언한 변수들이 바깥(전역)으로 새지 않는다.
// saudade 의 모든 모듈이 이 패턴을 쓴다 — 서로 충돌 안 나게 하려고.
(function() {

    // ── 가드 패턴 (guard) ──
    // 이 파일이 어쩌다 두 번 로드되더라도(예: 캐시 + 새 버전 동시 로드),
    // 두 번째 실행은 그냥 끝난다. window.SAUDADE_STITCH_FX 가 이미 있으면
    // 이미 한 번 실행됐다는 뜻.
    if (window.SAUDADE_STITCH_FX) return;
    window.SAUDADE_STITCH_FX = { mounted: true };

    // ── 설정값 (constant) ──
    // 막대 개수와, 어느 요소 안에 웨이브폼을 넣을지 정한다.
    // 셀렉터는 CSS 처럼 . = 클래스, # = 아이디.
    const WAVE_BARS = 16;
    const WAVE_HOST_SELECTOR = '.sdd-listen-head';

    // ── 막대 16개를 가진 <div> 한 덩어리 만들기 ──
    // document.createElement = 새 HTML 요소 만들기.
    // 만든 후엔 아직 페이지에 안 붙어 있다 — 마지막에 host.appendChild() 로 붙임.
    function makeWaveform() {
        const w = document.createElement('div');
        w.className = 'sdd-waveform';
        // 스크린 리더(시각장애 보조 도구)한테는 이 막대들이 정보 없다고 알림.
        w.setAttribute('aria-hidden', 'true');
        // 16번 반복하면서 <span class="sdd-waveform__bar"> 를 16개 만들어 안에 넣음.
        // CSS 의 :nth-child(1)..(16) 가 각 막대에 다른 높이/딜레이를 줘서
        // 16개가 한꺼번에 움직이지 않게 한다.
        for (let i = 0; i < WAVE_BARS; i++) {
            const b = document.createElement('span');
            b.className = 'sdd-waveform__bar';
            w.appendChild(b);
        }
        return w;
    }

    // ── 페이지에서 헤더를 찾아서, 아직 웨이브폼이 없으면 새로 붙인다 ──
    // querySelectorAll(셀렉터) = 매칭되는 요소 전부 찾기.
    // forEach = 배열을 하나씩 돌면서 콜백 실행.
    function ensureWaveform() {
        document.querySelectorAll(WAVE_HOST_SELECTOR).forEach(host => {
            // 이미 한 번 붙였으면 두 번 안 붙임 — 중복 방지.
            if (host.querySelector('.sdd-waveform')) return;
            host.appendChild(makeWaveform());
        });
    }

    // ── 오디오 재생 상태에 따라 막대 애니메이션 켜고 끄기 ──
    // 핵심 트릭: saudade-listening 모듈이 어디 있는지 모르고, 어떤 audio 태그를
    // 쓰는지도 정확히 모른다. 그래서 "document 전체에 대해" play/pause 이벤트를
    // 듣는다. addEventListener(..., true) 의 마지막 true 는 "capture phase" —
    // 이벤트가 위에서 아래로 내려갈 때 듣는다는 뜻. <audio> 이벤트는 bubble 이
    // 안 일어나서 capture phase 로 들어야 잡힌다.
    function bindAudioToWaveforms() {
        document.addEventListener('play', (e) => {
            // e.target = 이벤트가 일어난 요소. <audio> 인지만 확인.
            if (e.target && e.target.tagName === 'AUDIO') {
                // 페이지 안의 모든 웨이브폼에 is-playing 클래스 추가 → CSS 가
                // 막대 애니메이션을 깨운다 (CSS 의 .sdd-waveform.is-playing 규칙).
                document.querySelectorAll('.sdd-waveform').forEach(w => w.classList.add('is-playing'));
            }
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target && e.target.tagName === 'AUDIO') {
                document.querySelectorAll('.sdd-waveform').forEach(w => w.classList.remove('is-playing'));
            }
        }, true);
    }

    // ── 시작 함수 ──
    // ensureWaveform() 한 번 돌리고, audio 이벤트 binding 걸고,
    // 마지막으로 MutationObserver 로 "DOM 이 바뀌면 다시 ensureWaveform() 해줘"
    // 등록한다. 도시 전환 / 모드 토글 때 헤더가 새로 그려져도 자동 재주입.
    function start() {
        ensureWaveform();
        bindAudioToWaveforms();
        // MutationObserver = "이 노드 안에 뭔가 추가/제거되면 알려줘" 감시자.
        // childList: true → 자식 추가/제거 감시.
        // subtree: true → 하위 모든 깊이까지 감시.
        const mo = new MutationObserver(() => ensureWaveform());
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // ── 언제 start() 를 부를까 ──
    // document.readyState 가 'loading' 이면 HTML 이 아직 파싱 중.
    // 이 경우 DOMContentLoaded (파싱 끝났을 때) 를 기다린다.
    // 이미 끝났으면 (interactive / complete) 바로 start().
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
