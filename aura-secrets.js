// ============================================================
// AURA SECRETS — TEMPLATE
// ============================================================
// 이 파일은 .gitignore 에 등록되어 있습니다.
// 절대 실제 키를 이 파일에 적어 commit 하지 마세요.
//
// ⚠ 과거 commit history (0899185) 에 평문 PEXELS_KEY 가 노출된 적이 있습니다.
//    해당 키는 무효화되었으며, 현재 client 에는 어떠한 외부 API 키도 두지 않습니다.
//
// 운영 정책:
//   - 외부 API 키는 모두 Cloudflare Worker(cloudflare-worker.js) 환경변수로만 보관.
//   - Client 는 window.AURA_SERVER 의 프록시 엔드포인트(/pexels-videos 등) 만 호출.
//   - 사용자 본인이 입력한 키(TMDB 등) 는 사용자 localStorage 에만 저장되고
//     서버 전송되지 않습니다.
//
// 로컬 개발 시 임시로 키를 쓰고 싶다면 브라우저 콘솔에서:
//   localStorage.setItem('aura_pexels_key',  '<Pexels 키>');     // pexels.com/api 무료 발급
//   localStorage.setItem('aura_pixabay_key', '<Pixabay 키>');    // pixabay.com/api/docs 무료 발급
//   localStorage.setItem('aura_coverr_key',  '<Coverr 키>');     // coverr.co/developers 무료 발급 (시네마틱 보강)
//   ※ Wikimedia Commons 는 키 불필요 (자동 fallback)
//   ※ 이 값들은 절대 git 으로 push 되지 않습니다.
// ============================================================
'use strict';
(function() {
    // 정상 상태: 빈 객체.
    window.AURA_SECRETS = Object.freeze({});
})();
