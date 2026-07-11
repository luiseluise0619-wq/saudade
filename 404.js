// ─────────────────────────────────────────────────────────────────────
// [파일 역할 배너 — 초보자 안내]
// 404.js = "페이지 없음(404)" 화면의 문구를 독자의 언어(edition)로 바꿔주는 작은 스크립트.
// 404.html 이 불러온다. CSP(보안 정책)가 HTML 안에 직접 쓴 <script> 를 막기 때문에
// 이렇게 별도 파일로 둔다.
// ─────────────────────────────────────────────────────────────────────
// 404.js — surface the not-found message in the reader's edition.
// Loaded by 404.html; CSP blocks inline scripts, so this lives external.
// IIFE(즉시 실행 함수) 패턴 — 함수를 정의하자마자 괄호로 감싸 바로 실행한다.
// 전역(window)을 더럽히지 않으려고 변수들을 이 함수 안에 가둔다.
(function () {
    // 'use strict' = 엄격 모드. 실수(선언 안 한 변수 사용 등)를 에러로 잡아준다.
    'use strict';
    // ed = 현재 독자의 판(언어). 기본 'en'.
    var ed;
    // localStorage(브라우저 로컬 저장소) 읽기는 실패할 수 있으므로 try/catch 로 감싼다.
    try { ed = localStorage.getItem('saudade.edition') || 'en'; }
    catch (e) { ed = 'en'; }
    // 알 수 없는 값이면 안전하게 'en' 으로. 정규식으로 5개 언어만 허용.
    if (!/^(en|ko|ja|pt|es)$/.test(ed)) ed = 'en';

    // LINES = 화면 각 자리(부스러기/문장/설명/뒤로/제목)의 5개 언어 문구 모음.
    var LINES = {
        crumb: {
            en: '§ 404 · NOT FILED',
            ko: '§ 404 · 발행되지 않음',
            ja: '§ 404 · 未掲載',
            pt: '§ 404 · NÃO PUBLICADO',
            es: '§ 404 · NO PUBLICADO'
        },
        line: {
            en: 'This page is not in the <em>archive</em>.',
            ko: '이 페이지는 <em>아카이브</em>에 없다.',
            ja: 'このページは<em>書庫</em>にない。',
            pt: 'Esta página não está no <em>arquivo</em>.',
            es: 'Esta página no está en el <em>archivo</em>.'
        },
        note: {
            en: 'It may have been moved, renamed, or never written. The editor does not keep broken pages on purpose, so this is probably an honest mistake — your link, our routing, or a slow service worker. Try the cover.',
            ko: '이동됐거나, 이름이 바뀌었거나, 애초에 쓰여진 적 없는 페이지다. 편집부는 깨진 페이지를 의도해서 두지 않는다 — 링크, 라우팅, 또는 느린 서비스 워커 중 하나의 정직한 실수일 가능성이 높다. 표지로 가시라.',
            ja: '移動された、改名された、あるいは最初から書かれなかったページかもしれない。編集部は壊れたページをそのまま残しはしない — リンク、ルーティング、もしくは遅いサービスワーカーの素直な手違いだろう。表紙へどうぞ。',
            pt: 'Pode ter sido movida, renomeada, ou nunca escrita. A redação não mantém páginas partidas de propósito — provavelmente é um erro honesto: o seu link, o nosso routing, ou um service worker lento. Vá à capa.',
            es: 'Puede haber sido movida, renombrada, o nunca escrita. La redacción no mantiene páginas rotas a propósito — probablemente es un error honesto: su enlace, nuestro routing, o un service worker lento. Vaya a la portada.'
        },
        back: {
            en: 'back to the cover',
            ko: '표지로 돌아가기',
            ja: '表紙へ戻る',
            pt: 'voltar à capa',
            es: 'volver a la portada'
        },
        title: {
            en: 'saudade — page not found',
            ko: 'saudade — 페이지 없음',
            ja: 'saudade — ページが見つかりません',
            pt: 'saudade — página não encontrada',
            es: 'saudade — página no encontrada'
        }
    };

    // pick: 주어진 자리(key)에서 현재 언어 문구를 고르고, 없으면 영어로 대체.
    function pick(key) { var d = LINES[key]; return (d && d[ed]) || d.en; }

    // <html lang="..."> 속성을 독자 언어로 설정(접근성/스크린리더용).
    document.documentElement.setAttribute('lang', ed);
    // 아래 각 줄: 해당 CSS 클래스 요소를 찾아(querySelector) 있으면 문구를 채운다.
    // textContent = 순수 텍스트(안전), innerHTML = <em> 같은 태그를 살려야 할 때만 사용.
    var crumb = document.querySelector('.crumb'); if (crumb) crumb.textContent = pick('crumb');
    var line  = document.querySelector('.line');  if (line) line.innerHTML = pick('line');
    var note  = document.querySelector('.note');  if (note) note.textContent = pick('note');
    var back  = document.querySelector('.back');  if (back) back.textContent = pick('back');
    // 브라우저 탭 제목도 언어에 맞게.
    document.title = pick('title');
// IIFE 끝 — 정의와 동시에 () 로 실행.
})();
