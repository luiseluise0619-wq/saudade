// 404.js — surface the not-found message in the reader's edition.
// Loaded by 404.html; CSP blocks inline scripts, so this lives external.
(function () {
    'use strict';
    var ed;
    try { ed = localStorage.getItem('saudade.edition') || 'en'; }
    catch (e) { ed = 'en'; }
    if (!/^(en|ko|ja|pt|es)$/.test(ed)) ed = 'en';

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

    function pick(key) { var d = LINES[key]; return (d && d[ed]) || d.en; }

    document.documentElement.setAttribute('lang', ed);
    var crumb = document.querySelector('.crumb'); if (crumb) crumb.textContent = pick('crumb');
    var line  = document.querySelector('.line');  if (line) line.innerHTML = pick('line');
    var note  = document.querySelector('.note');  if (note) note.textContent = pick('note');
    var back  = document.querySelector('.back');  if (back) back.textContent = pick('back');
    document.title = pick('title');
})();
