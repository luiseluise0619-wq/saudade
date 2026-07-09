# CODE_TOUR.md — 초보자를 위한 saudade 코드 투어 (한국어)

이 문서는 코드를 처음 여는 사람을 위한 안내서다. 아키텍처의 공식 문서는
ARCHITECTURE.md 이고, 여기서는 "처음 보면 헷갈리는 것"부터 순서대로 푼다.

---

## 0. 한 문장 요약

**saudade 는 디지털 노마드를 위한 "느린 신문"** — 프레임워크 없는 순수
JS(vanilla JS) 모듈 ~57개가 프론트엔드이고, `cloudflare-worker.js` 파일
하나가 백엔드 전부다. 배포는 Cloudflare Pages(정적 파일) + Cloudflare
Worker(API).

---

## 1. 5개 언어판(에디션) 구조

- 에디션은 `en / ko / ja / pt / es` 다섯. 담당 모듈은 `saudade-edition.js`
  (전역 `window.SAUDADE_EDITION`).
- **번역이 아니라 별쇄(別刷)다.** KO판은 EN판의 번역본이 아니다 — 서울·부산·
  제주 독자에게 그 도시 이야기를 하고, JA판은 도쿄·오사카·교토, PT판은
  리스본·포르투 이야기를 한다. 도시도, 기사도, 목소리도 에디션마다 다르다.
- 동작 방식: 사용자가 에디션을 고르면 `<body data-edition="ko">` 속성이
  바뀌고 localStorage `saudade.edition` 에 저장된다. 각 모듈은 문자열이
  필요할 때 `SAUDADE_T({ en: '…', ko: '…', … })` 로 현재 에디션 것을 고른다.
  중앙 번역 테이블이 없고, 문자열이 쓰이는 자리에서 5개 언어를 다 든다.
- 데이터도 에디션별 파일이다: `data/dispatches.json`(EN),
  `data/dispatches.ko.json`, `.ja/.pt/.es` — 서로 독립 생성 (아래 §2).

## 2. 하루 한 번 dispatches 가 갱신되는 흐름 (cron → worker → AI → JSON)

"매일 06:00 KST 에 새 단신이 실린다"는 헌법 §9.5 를 코드가 이렇게 지킨다.
**EN 판과 나머지 4개 판의 파이프라인이 다르다**는 게 핵심.

### EN 판 — Cloudflare Worker 의 cron 파이프라인

`wrangler.toml [triggers]` 의 cron 시각마다 `cloudflare-worker.js` 의
`scheduled(event)` 가 깨어나 단계를 하나씩 진행한다 (§ 04 THE DESK 화면에
그대로 공개되어 있는 시간표):

```
00:00 KST GATHER  rss-parser 가 시청·미술관·지역 언론 RSS 수집 → D1 raw_feeds
00:30 KST SORT    Workers AI (Llama 3.1 8B) 가 기사를 도시별 분류
02:00 KST SCORE   Workers AI 가 "조용함" 1~10점 채점 (금칙어는 0점)
04:00 KST WRITE   Gemini Flash 가 3~4문장 단신으로 다시 씀
05:00 KST REVIEW  Gemini Flash 2차 검수 — 헌법 위반이면 차단
05:30 KST STAGE   D1 에 대기(staged)
06:00 KST FILE    상위 항목 발행 → D1 dispatches
```

독자 브라우저의 `saudade-dispatches.js` 는 ① 워커 `/dispatches/today`
(D1, 가장 신선)를 먼저 시도하고 ② 실패하면 저장소의 정적
`data/dispatches.json` 으로 폴백한다.

### KO / JA / PT / ES 판 — GitHub Actions cron

`.github/workflows/refresh-dispatches.yml` 이 매일 21:00 UTC(= 다음날
06:00 KST)에 `scripts/refresh-dispatches.js` 를 실행한다. 이 스크립트가
에디션별 도시 풀에 대해 Gemini 로 **그 언어로 처음부터** 단신을 쓰고,
결과를 `data/dispatches.{ed}.json` 에 커밋한다. 워커의 옛 "translate"
cron 은 폐기됐다(번역은 별쇄 원칙 위반).

모든 `dispatches.{ed}.json` 에는 `ai_assisted: true` 와 `ai_disclosure`
문구가 반드시 들어간다 (CLAUDE.md 헌법 규칙).

## 3. 캐시버스터 — 초보자가 제일 헷갈리는 부분

### 왜 존재하나

이 앱은 PWA 라서 Service Worker(`sw.js`)가 JS/CSS 를 통째로 캐시한다.
게다가 CDN 도 길게 캐시한다. 그 상태에서 파일만 고쳐 배포하면 **기존
방문자는 영원히 옛 파일을 본다.** 해결책이 "캐시버스터" — 버전 번호를
파일 요청 주소에 붙여서(`?v=v744`), 번호가 바뀌면 브라우저가 "다른
주소네?" 하고 새로 받게 만드는 것.

### 반드시 같이 움직여야 하는 세 곳 (+보조 두 곳)

| 위치 | 무엇 | 어긋나면 |
|---|---|---|
| `sw.js` `CACHE_VERSION = 'saudade-v744'` | SW 캐시 이름 | 옛 캐시가 안 지워짐 |
| `index.html` 모든 `<script src="….js?v=v744">` | 자산 요청 주소 | 새 SW 가 옛 파일을 캐시 |
| `bootstrap.js` `SAUDADE_RELEASE = 'v744'` | SW 등록 주소(`sw.js?v=…`) 스탬프 | 브라우저가 옛 SW 를 영영 유지 |
| (보조) `saudade-listening.js` 의 `listening.json?v=…` | 데이터 fetch 버스터 | 옛 트랙 목록 |
| (보조) `sw.js` 안의 `CB` 상수 | SW 프리캐시 목록의 버스터 | 스모크 테스트 검사 대상 아님 |

세 곳이 어긋난 실제 사고가 두 번 있었다(bootstrap v657 에 멈춘 채 sw 는
v668 — 사용자가 새 버전을 영영 못 받음). 그래서 `test/smoke.js` 가
**세 값이 같은지 기계적으로 검사**하고, 다르면 실패한다.

### 어떻게 맞추나 — 손으로 하지 말 것

```bash
node scripts/bump-cache.js        # v744 → v745 자동 (전부 한 번에)
node scripts/bump-cache.js v750   # 특정 버전으로
node test/smoke.js                # 검증
```

규칙: **루트의 JS/CSS/HTML 파일을 하나라도 고쳤으면 무조건 bump.**
주석 한 줄만 바꿔도 파일 내용이 달라지므로 bump 한다.

## 4. 파일 지도

```
index.html               앱 셸. <script defer> 목록 = 로드되는 모듈 전부
bootstrap.js             부트 4종: AURA_SERVER 주소, 캐시 마이그레이션,
                         SW 등록, 스킨 선적용. SAUDADE_RELEASE 상수가 여기
sw.js                    Service Worker (오프라인 + 캐시. 헤더 주석 참고)
cloudflare-worker.js     백엔드 전부 (API 라우터 + AI 파이프라인 cron.
                         매직링크/D1 설명은 파일 맨 위 주석)

saudade-edition.js       5개 언어판 전환 (IIFE 패턴 상세 설명도 이 파일 맨 위)
saudade-cover.js         § 00 표지 (첫 화면)
saudade-ledger.js        § 01 비자·세금 장부
saudade-atlas*.js        § 02 카페 아틀라스 (목록/지도/GPS/도보권/제보)
saudade-quarterly-*.js   § 02b 분기 부록
saudade-dispatches.js    § 03 일간 단신
saudade-desk.js          § 04 편집부 (파이프라인 공개)
saudade-listening.js     § 05 리스닝 룸 (ASMR)
saudade-auth.js          매직링크 로그인 (클라이언트 쪽)
saudade-desks.js         통신원 데스크
saudade-personal.js      "당신의 순간" 공감 문장

saudade.core.js          ★ 빌드 산출물 — build-bundle.js 가 auth/account/
saudade.editorial.js     ★ schengen/…, cover/edition/masthead 원본들을 이어
                         붙인 번들. 직접 고치지 말 것 (원본 고치고 재생성)

data/                    dispatches.{ed}.json, cafes-*.json, listening.json …
data/licenses/           사진·음원·장소 데이터의 라이선스 사이드카 (필수)
schema/                  D1 SQL 스키마
scripts/                 bump-cache.js, build-bundle.js, refresh-dispatches.js,
                         validate-content.js (콘텐츠 게이트) 등
test/smoke.js            캐시버스터 동기화 포함 67개 스모크 검사
.github/workflows/       KO/JA/PT/ES dispatches cron, 콘텐츠 fetch 등
```

주의: `index.html` 의 주석 처리된 `<script>` 줄들(`in saudade.core.js` 라고
적힌 것)은 죽은 코드가 아니라 "이 모듈은 번들 안에 들어 있다"는 표식이다.

알려진 잔재: `saudade-cover.js` **원본**은 v729 주석의 백틱 때문에 단독
파싱이 깨진다(`node --check` 실패). 실제 서비스는 그 이전에 빌드된
`saudade.editorial.js` 번들을 로드하므로 동작에는 문제없지만, 다음 번들
재생성 전에 고쳐야 한다.

## 5. AURA 잔재 — 왜 window.AURA_SERVER 인가

코드 곳곳에 `AURA` 라는 이름이 남아 있다:

- `bootstrap.js` 의 `window.AURA_SERVER` (워커 주소)
- `cloudflare-worker.js` 맨 위 배너 "AURA WORLD PULSE — Backend v4.0"
- 워커의 KV 바인딩 `env.AURA_KV`
- `aura-secrets.js` 파일명
- 워커 `ALLOWED_ORIGINS` 의 `aura-os-cao.pages.dev`, `aura-worldpulse.com`

**역사**: saudade 는 백지에서 시작한 프로젝트가 아니다. 같은 제작자의 전신
프로젝트 **AURA (AURA OS / AURA WORLD PULSE)** — 세계 뉴스·데이터 대시보드
— 의 인프라(워커, KV, 배포 계정, 부트스트랩)를 물려받아 "느린 신문"으로
피벗한 것이다. 전역 변수명과 워커 바인딩명을 지금 바꾸면:

1. `AURA_SERVER` 를 읽는 모듈 전부 + 번들 재생성 + 캐시 bump,
2. Cloudflare 대시보드의 KV 바인딩 이름 변경 + 재배포,
3. 옛 도메인에서 오는 트래픽 처리

가 한 번에 걸리는 대수술이라, 위험 대비 이득이 없어 그대로 둔 것이다.
새 코드를 쓸 때는 `SAUDADE_*` 네임스페이스를 쓰면 되고, `AURA_*` 를
만나면 "옛 이름, 의미는 saudade 백엔드"라고 읽으면 된다.

## 6. 검증 명령어 (수정했으면 이 순서로)

```bash
npm run validate       # 콘텐츠 게이트 (헌법 §3 — 카페/라이선스 검증)
node test/smoke.js     # 캐시버스터 동기화 포함 67개 검사
node --check <파일>    # 문법만 빠르게
npm run test:all       # 단위 테스트 + 스모크 전부
```
