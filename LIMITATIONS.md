# 알려진 한계 / 향후 작업

이 파일은 "단점만 골라서" 진단한 결과 중 **이번 세션에서 못 고친** 항목입니다.
해결되거나 더 이상 유효하지 않으면 지우세요.

## 큰 작업 (며칠~몇 주)

### 1. 모듈 분리 / 빌드 파이프라인 부재
- `app.js` 3,500줄+가 boot/render/state/event/UI/music/search/personalization 다 들고 있음.
- 빌드 도구(Vite, esbuild 등) 안 씀. 매번 23K줄 풀 다운로드 + minify 없음.
- **권장**: Vite + ESM 모듈 분리. 단계적으로 ambient/music/news/categories를 별도 파일로 추출.

### 2. 테스트 0개
- 자동화 테스트 부재. 변경 시 회귀 검증 수동.
- **권장**: Vitest + jsdom으로 단위 테스트 + Playwright로 E2E 스모크 테스트.

### 3. 타입 안전성 없음
- TypeScript도 JSDoc도 없음.
- **권장**: jsconfig.json에 `checkJs: true` + 핵심 함수에 JSDoc부터 시작.

## 중간 작업 (반나절~하루)

### 4. 외부 API 단일점 실패
- Pexels/Tenor/SomaFM/USGS 등 한 곳 죽으면 그 기능 다운. 다층 폴백 없음.
- **권장**: 각 카테고리별 fallback chain 2단 이상 (Pexels → Pixabay → 정적 GIF).

### 5. i18n 분산
- `data-i18n` 어트리뷰트 + 코드 안 `if (isKo) ...`가 섞여 있음.
- **권장**: 모든 문자열을 단일 i18n.json으로 모으고, 빌드 시 추출.

### 6. 죽은 코드 / 숨김 패턴
- `style.display = 'none'`로 처리한 옛 UI 노드들이 남아 있음. (예: `.detail-block`).
- **권장**: 사용 안 하는 노드는 삭제. `git revert`로 복원 가능.

### 7. `!important` 남발
- `style.css` + 인라인 스타일에서 specificity 우회용 `!important` 다수.
- **권장**: BEM 스타일 클래스명 + 컴포넌트별 CSS module화.

## 작은 작업 (한 시간 이하)

### 8. 빈 catch 블록
- `aura-common.js`에 `dbgWarn` 헬퍼 추가됨. 기존 47개 catch는 점진적으로 교체.
- **권장**: lint rule(`no-empty`)로 강제.

### 9. innerHTML 34군데
- 대부분 안전하지만 (정적 SVG, 빈 문자열 클리어), 사용자 입력 흘러들어가지 않게 lint로 추적.

### 10. localStorage 5MB 한도
- `aura-common.js`에 `safeStorageSetGuarded` 추가. 사용처는 점진 교체 필요.

### 11. 자동 재생 정책
- 브라우저별로 SoundCloud/YouTube/HTML5 audio 정책 달라짐. 현재 SomaFM `<audio>` + 사용자 클릭 트리거로 가장 안정적이지만, Safari iOS/일부 모바일에서 추가 검증 필요.

### 12. 어필리에이트 ID 0원
- `travel-affiliate.js`에 ID 빈 문자열. `window.AURA_AFF` 주입해야 활성화. README/DEPLOY 안내는 있음.

### 13. 글로벌 CDN 의존
- globe.gl + three.js를 jsdelivr/unpkg에서 로드. 자체 호스팅하지 않음.
- **권장**: Cloudflare Worker에서 동일 자산 CDN-pull-through 캐시.

### 14. 도시 영상 hardcoded customQueries
- `city-videos.js`에 60개 도시별 큐레이션 쿼리가 박혀 있음. 새 도시 추가 시 코드 수정 필요.
- **권장**: 별도 JSON으로 분리.
