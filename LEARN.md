# LEARN.md — saudade 코드를 한 줄씩 (코딩 처음 배우는 사람용)

이 문서는 saudade 의 코드가 어떻게 돌아가는지 **처음 코딩 배우는 사람** 도 따라올 수 있게 한 줄씩 설명합니다. 분량 길지만, 위에서부터 차례로 읽으면 됩니다. 모르는 단어 나오면 거기서 멈추고 검색해도 OK.

---

## 0. 이 문서가 다루는 것

- 웹사이트가 어떻게 동작하는지 (브라우저가 뭘 하는지)
- saudade 의 폴더 구조 — **각 파일이 무슨 역할인지**
- 진짜 코드 한 모듈 (saudade-edition.js) 을 **한 줄씩** 해부
- 데이터가 어디서 오는지 (정적 JSON · 서버 · AI)
- 빌드·배포·캐시
- 앞으로 새 기능 추가하는 법

마지막 챕터 (10번) 까지 읽으면, 본인이 새 섹션 (예: "오늘의 인용") 추가하는 방법까지 알게 됩니다.

---

## 1. saudade 가 무슨 사이트?

> "디지털 노마드를 위한 슬로우 매거진"

핵심 특징:
- **5개 에디션** (en/ko/ja/pt/es) — 각 언어가 독립된 잡지
- **14개 도시** — 서울·도쿄·리스본 등
- **PWA** (Progressive Web App) — 앱스토어 안 가도 홈화면에 설치
- **매일 06:00 KST 발행** — 그 날의 디스패치 (짧은 도시 소식 9개)

기술 스택:
- **Frontend**: HTML + CSS + 순수 JavaScript (React/Vue 같은 프레임워크 X)
- **Backend**: Cloudflare Worker (서버리스 — "내 서버 없이 클라우드에서 돌리는 코드")
- **DB**: Cloudflare D1 (SQLite 호환 무료 DB)
- **AI**: Gemini (구글 LLM) → 매일 디스패치 초안 작성

---

## 2. 웹의 기본 3가지 — 모르면 여기서 시작

웹사이트는 **3개 언어**로 만들어집니다.

### HTML — "구조 (뼈대)"
```html
<h1>안녕</h1>
<p>이건 단락이에요.</p>
<button>클릭</button>
```
- `<h1>` = "큰 제목"
- `<p>` = "단락 (paragraph)"
- `<button>` = 버튼
- 태그 (tag) 라고 부름. 거의 다 `<여는것>` ... `</닫는것>` 쌍.

### CSS — "디자인 (스킨)"
```css
h1 {
    color: red;
    font-size: 32px;
}
```
- 어떤 HTML 요소를 (`h1`)
- 어떻게 보일지 (`color: red`)
- 정해주는 규칙
- saudade 는 색이 5에디션마다 다름 — 그래서 `var(--accent)` 같은 "변수" 씀

### JavaScript — "동작 (근육)"
```js
const button = document.querySelector('button');
button.addEventListener('click', () => {
    alert('눌렸어요!');
});
```
- HTML 요소를 찾고 (`querySelector`)
- "클릭" 같은 사건 (이벤트) 에 함수 연결 (`addEventListener`)
- 사용자가 누르면 그 함수 실행 → `alert(...)` (경고창)

이 셋이 합쳐져서 saudade 가 됩니다.

---

## 3. saudade 의 폴더 구조 — 어디에 뭐가 있나

```
saudade/
├── index.html              ← 사용자가 처음 보는 화면 (메인 페이지)
├── manifest.json           ← PWA 설정 (앱 이름·아이콘·색)
├── sw.js                   ← Service Worker (오프라인·캐시)
│
├── style.css               ← 기본 디자인
├── saudade-tokens.css      ← 색·폰트·간격 변수
├── saudade-edition-tokens.css  ← 5에디션별 색·폰트
├── saudade-skin.css        ← 추가 스킨
│
├── bootstrap.js            ← 부트 스크립트 (가장 먼저 실행)
├── saudade-boot.js         ← saudade 시작 셋업
├── saudade-edition.js      ← 언어 (에디션) 전환
├── saudade.editorial.js    ← 표지 + 마스트헤드
├── saudade.core.js         ← 인증·계산기·후원 등 묶음
├── saudade-cover.js        ← § 00 표지
├── saudade-ledger.js       ← § 01 비자·세금 카운터
├── saudade-atlas.js        ← § 02 카페 지도
├── saudade-dispatches.js   ← § 03 매일 디스패치
├── saudade-desk.js         ← § 04 The Desk (Following 도시 + 계정)
├── saudade-listening.js    ← § 05 Listening Room (사진+ambient)
├── ... (기타 30+ 모듈)
│
├── data/                   ← 콘텐츠 데이터
│   ├── cafes-seoul.json    ← 서울 카페 (큐레이션)
│   ├── cafes-seoul.candidates.json ← 큐레이션 대기 후보
│   ├── dispatches.json     ← § 03 EN 디스패치
│   ├── dispatches.ko.json  ← § 03 KO 디스패치
│   ├── dispatches.ja.json
│   ├── dispatches.pt.json
│   ├── dispatches.es.json
│   ├── listening.json      ← § 05 도시별 사진·트랙
│   ├── editions.json       ← 5에디션 메타 (도시·voice)
│   ├── city-definitions.json ← 14도시 좌표·인접
│   └── licenses/           ← 외부 자산 라이선스 사이드카
│
├── scripts/                ← 빌드·운영 도구 (사용자가 명령으로 실행)
│   ├── promote-cafe.js     ← 후보 → 정식 카페로 승격
│   ├── refresh-dispatches.js ← AI 가 매일 디스패치 작성
│   ├── fetch-pexels-photos.js ← Pexels 사진 다운
│   ├── fetch-freesound.js  ← Freesound 음악 다운
│   ├── fetch-kakao-cafes.js ← Kakao Map 카페 fetch
│   ├── audit-rss.js        ← RSS 살아있는지 검사
│   ├── bump-cache.js       ← 캐시 버전 한 번에 올림
│   ├── validate-content.js ← 헌법 위반 검사
│   └── build-bundle.js     ← JS 묶기
│
├── test/                   ← 테스트
│   ├── smoke.js            ← 큰 invariant 65개 검사
│   └── calculators.test.js ← 비자 계산기 단위 테스트
│
├── .github/workflows/      ← GitHub 자동화
│   ├── refresh-dispatches.yml  ← 매일 KO/JA/PT/ES 발행
│   ├── fetch-content.yml       ← 사진·음악 fetch
│   ├── audit-rss.yml           ← 매주 RSS 검사
│   └── saudade.yml             ← PR 검증
│
├── cloudflare-worker.js    ← 서버 (인증·결제·cron)
├── wrangler.toml           ← Worker 설정
├── schema/                 ← D1 DB 테이블 정의
│
├── *.html                  ← 보조 페이지들 (privacy, terms, install …)
│
└── docs (사용자 + AI 가이드)
    ├── README.md           ← 외부 소개
    ├── ARCHITECTURE.md     ← 모듈 구조·데이터 흐름
    ├── CLAUDE.md           ← AI 에이전트 작업 가이드
    ├── RUNBOOK.md          ← 매일·주간 운영
    ├── CHANGELOG.md        ← 변경 이력
    ├── DEPLOY.md           ← 배포 절차
    ├── types.d.ts          ← 데이터 타입 중앙 정의
    └── LEARN.md            ← (이 파일)
```

### 파일 종류별 정리

| 종류 | 확장자 | 무엇 |
|---|---|---|
| 페이지 | `.html` | 브라우저가 직접 여는 문서 |
| 디자인 | `.css` | 색·폰트·레이아웃 규칙 |
| 동작 | `.js` | JavaScript — 화면 만들고 사용자 입력 처리 |
| 데이터 | `.json` | "이름:값" 으로 적힌 데이터 (브라우저가 fetch 로 읽음) |
| 설정 | `.toml`, `.yml` | 도구 설정 파일 |
| 문서 | `.md` | 마크다운 (Markdown — 사람이 읽는 글) |
| 타입 | `.d.ts` | TypeScript 타입 정의 (코드 안의 데이터 모양) |

---

## 4. 사용자가 사이트 처음 열 때 무슨 일이?

`https://saudade.pages.dev` 를 브라우저 주소창에 친다고 해봅시다.

1. **브라우저 → 서버 (Cloudflare Pages) 에 요청**
   "이 URL 의 페이지 줘"

2. **서버가 `index.html` 을 보냄**
   브라우저가 받음

3. **브라우저가 `index.html` 을 위에서부터 파싱**
   ```html
   <head>
       <script src="bootstrap.js?v=v667"></script>
       <link rel="stylesheet" href="style.css?v=v667" />
       <link rel="stylesheet" href="saudade-edition-tokens.css?v=v667" />
       ...
   </head>
   ```
   → 브라우저: "아 이 CSS·JS 파일들도 필요하네" → 추가 다운로드

4. **다운받은 JS 파일들이 차례로 실행**
   `bootstrap.js` → 셋업
   `saudade-edition.js` → 사용자가 이전에 골랐던 언어 (예: KO) 적용 → `<body data-edition="ko">`
   `saudade-cover.js` → 표지 그리기
   ...

5. **각 JS 모듈이 자기 데이터 fetch**
   ```js
   fetch('./data/dispatches.ko.json')
       .then(r => r.json())
       .then(data => render(data));
   ```
   → 한국어 디스패치 데이터 받아서 화면에 그림

6. **Service Worker (`sw.js`) 등록**
   다음에 사용자가 인터넷 끊긴 상태에서 와도, 캐시에서 보여줌

이 모든 게 **약 1~2초 안**에 끝남.

---

## 5. 실전 — saudade-edition.js 한 줄씩

가장 작고 명확한 모듈로 시작. 이 파일은 "사용자가 언어 버튼 누르면 5개 에디션 중 하나 적용" 을 합니다.

코드는 약 200줄. 위에서부터:

### 헤더 주석

```js
// SAUDADE · EDITION SYSTEM
// 5 별쇄 — en / ko / ja / pt / es. body[data-edition] 토글로 다른 잡지 입장.
// 실시간 번역 X — 사용자가 명시적 선택. 각 에디션은 자기 도시·자기 voice.
// localStorage: saudade.edition.
```

- `//` 로 시작하는 줄은 **주석** — 컴퓨터 무시, 사람이 읽는 메모.
- 헤더 주석은 "이 파일이 뭐 하는지" 1~5줄 요약.
- saudade 는 모든 모듈이 이런 헤더를 가짐. **새 모듈 만들면 본인도 이렇게 시작하면 됨.**

### `'use strict';`

```js
'use strict';
```

- "엄격 모드" — JavaScript 의 안전 규칙 켜기.
- 끄면 실수해도 조용히 넘어감 (예: 변수 선언 안 하고 쓰기).
- 켜면 에러 던져서 일찍 잡힘.
- saudade 의 모든 JS 가 이 줄을 가짐.

### IIFE 시작

```js
(function() {
    if (window.SAUDADE_EDITION) return;
```

- `(function() { ... })()` 패턴 = **IIFE** (Immediately Invoked Function Expression, 즉시 실행 함수)
- "함수를 만들어서, 만들자마자 호출"
- **왜?** 이 안에서 만든 변수들이 "전역" 으로 새지 않게 막음.
  - 예: `const COPY_5 = ...` 를 IIFE 밖에 쓰면, 다른 파일이 우연히 `COPY_5` 라는 이름 쓰면 충돌.
  - IIFE 안에 두면 다른 파일은 못 봄.
- `if (window.SAUDADE_EDITION) return;` — "이미 이 모듈 한 번 로드됐으면 두 번 안 함." 안전장치.

### 상수 정의

```js
    const KEY        = 'saudade.edition';
    const SUPPORTED  = ['en', 'ko', 'ja', 'pt', 'es'];
    const DEFAULT    = 'en';
    const SKINS      = ['paper', 'saturated', 'dark'];
```

- `const` = "constant", 한 번 정하면 안 바뀜.
- `KEY` = localStorage 에 저장할 때 쓸 키 이름.
- `SUPPORTED` = 지원하는 5개 언어 코드. 배열 (`[ ... ]`).
- `DEFAULT` = 사용자가 처음 들어왔을 때 보여줄 언어.
- `SKINS` = 잡지 스킨 3가지.

### 객체 (Object)

```js
    const META = {
        en: { name: 'English',   loading: 'Opening English edition…' },
        ko: { name: '한국어',    loading: '한국어판을 펼치는 중…' },
        ja: { name: '日本語',    loading: '日本語版をひらいている…' },
        pt: { name: 'Português', loading: 'A abrir a edição portuguesa…' },
        es: { name: 'Español',   loading: 'Abriendo la edición en español…' }
    };
```

- `{}` = **객체** — "키: 값" 쌍의 모음.
- `META.en` 으로 꺼내면 `{ name: 'English', loading: '...' }` 가 나옴.
- 중첩됨 — `META.ko.name` 은 `'한국어'`.

### 변수 (let)

```js
    let _config = null;
    let _configP = null;
```

- `let` = "let", 변할 수 있는 변수.
- `_config` 가 처음엔 `null` (값 없음) → 나중에 fetch 하면 데이터 들어감.
- `_` (밑줄) 로 시작 = 관례적으로 "이 모듈 내부용, 밖에서 쓰지 마" 표시.

### 함수 정의

```js
    function loadConfig() {
        if (_configP) return _configP;
        _configP = fetch('./data/editions.json', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { _config = d; return d; })
            .catch(() => null);
        return _configP;
    }
```

- `function loadConfig() { ... }` = "loadConfig 라는 함수 정의".
- 안에 들어있는 게 그 함수가 할 일.

이 함수 한 줄씩:
- `if (_configP) return _configP;` — "이미 로딩 시작했으면 그거 그대로 돌려주기 (두 번 fetch 안 함)"
- `_configP = fetch(...)` — `fetch` 는 브라우저 빌트인 함수, 인터넷에서 파일 가져오기.
- `.then(r => r.ok ? r.json() : null)` — fetch 가 끝나면 응답 (`r`) 의 본문을 JSON 으로 파싱.
  - `r.ok` 가 true 면 (응답 성공) `r.json()`, 아니면 `null`.
- `.then(d => { _config = d; return d; })` — 파싱된 데이터 (`d`) 를 `_config` 에 저장.
- `.catch(() => null)` — 만약 도중에 에러 나면 `null` 로 처리 (에러로 페이지 깨지지 않게).
- `return _configP;` — 약속 (Promise) 을 돌려줌. 호출한 쪽이 `await loadConfig()` 로 결과 기다릴 수 있음.

### 더 짧은 함수

```js
    function getEdition() {
        try { const v = localStorage.getItem(KEY); return SUPPORTED.includes(v) ? v : null; }
        catch (e) { return null; }
    }
```

- `try { ... } catch (e) { ... }` — "try 안의 코드 시도하다가 에러 나면 catch 안 코드 실행".
- `localStorage.getItem(KEY)` — 브라우저 저장소에서 키 (`'saudade.edition'`) 로 값 꺼내기.
  - localStorage = 사용자 브라우저에 저장되는 작은 DB. 사이트 닫아도 남음.
- `SUPPORTED.includes(v)` — 가져온 값이 5개 중 하나면 true.
- `? v : null` — 삼항 연산자. `조건 ? 참일때 : 거짓일때`. true 면 `v` 돌려주고, 아니면 `null`.
- 왜 `try/catch`? 사파리 시크릿 모드 등에서 `localStorage` 접근 자체가 에러 나는 경우가 있음. 안전하게.

### 본격 핵심 함수 — applyEdition

```js
    function applyEdition(ed) {
        if (!SUPPORTED.includes(ed)) ed = DEFAULT;
        if (!document.body) {
            document.documentElement.setAttribute('lang', ed);
            return;
        }
        document.body.setAttribute('data-edition', ed);
        document.body.classList.remove(...SUPPORTED.map(c => 'edition-' + c));
        document.body.classList.add('edition-' + ed);
        document.documentElement.setAttribute('lang', ed);
        if (!window.state) window.state = {};
        try { window.state.lang = ed; } catch (e) {}
    }
```

이 함수가 진짜 일을 하는 곳. 한 줄씩:
- `function applyEdition(ed)` — 인자 (parameter) `ed` 를 받음.
- `if (!SUPPORTED.includes(ed)) ed = DEFAULT;` — 이상한 값 들어오면 디폴트로.
- `if (!document.body)` — 아직 body 가 만들어지기 전이면 (스크립트가 너무 일찍 실행)
  - `document.documentElement.setAttribute('lang', ed);` — `<html lang="ko">` 만 셋, body 는 다음에.
  - `return;` — 함수 종료.
- `document.body.setAttribute('data-edition', ed);` — `<body data-edition="ko">` 로 만듦.
- `document.body.classList.remove(...SUPPORTED.map(c => 'edition-' + c));`
  - `SUPPORTED.map(c => 'edition-' + c)` = `['edition-en', 'edition-ko', ...]`
  - `...` 는 spread — 배열을 펼침. `remove('edition-en', 'edition-ko', ...)` 로 됨.
  - 이전에 붙어있던 모든 edition-X 클래스 제거.
- `document.body.classList.add('edition-' + ed);` — 새 클래스 추가.

**왜 이렇게?** CSS 가 `body.edition-ko { --accent: #A8341E; }` 같은 식으로 되어있어서, body 의 class 만 바꾸면 색이 바뀜.

### Public API 노출

```js
    window.SAUDADE_EDITION = {
        set,
        get: () => getEdition() || DEFAULT,
        skin: () => document.documentElement.getAttribute('data-skin') || 'paper',
        config: async (ed) => { ... },
        configSync: (ed) => _config?.[ed || (getEdition() || DEFAULT)] || null,
        toLatinDigits,
        SUPPORTED,
        SKINS,
        META
    };
```

- `window.SAUDADE_EDITION = { ... }` — 다른 모듈이 쓸 수 있게 전역으로 노출.
- `set`, `get`, ... — 함수들과 데이터 묶음.
- 다른 모듈에서:
  ```js
  const ed = window.SAUDADE_EDITION.get();   // 'ko'
  window.SAUDADE_EDITION.set('ja');           // JA 로 전환
  ```

### IIFE 닫기

```js
})();
```

- IIFE 끝. `})` 가 함수 정의 끝, `()` 가 그 함수 즉시 호출.

---

## 6. 모든 saudade 모듈이 같은 패턴

위에서 본 saudade-edition.js 의 골격은 **모든** saudade-*.js 가 따름:

```js
// 1. 헤더 주석
// SAUDADE · XXX

// 2. 엄격 모드
'use strict';

// 3. IIFE 시작 + 가드
(function() {
    if (window.SAUDADE_XXX) return;

    // 4. 상수
    const ...

    // 5. 변수
    let ...

    // 6. 함수들
    function foo() { ... }
    function bar() { ... }

    // 7. 시작 함수 — DOMContentLoaded 후 호출
    function init() {
        // CSS 주입
        // DOM 그리기
        // 이벤트 등록
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 8. Public API
    window.SAUDADE_XXX = { ... };
})();
```

이 패턴 한 번 익히면 **51개 saudade-*.js 모두 같은 구조**라 빨리 읽힙니다.

---

## 7. 데이터는 어디서 와?

saudade 가 보여주는 거 = 데이터 가져와서 그리기.

### A. 정적 JSON (data/*.json)
```js
fetch('./data/dispatches.ko.json')
    .then(r => r.json())
    .then(data => /* 화면에 그리기 */);
```
- 사이트와 같이 배포된 파일.
- 빠름 (Cloudflare 가 CDN 으로 서빙).
- 카페 데이터, 디스패치, 도시 정의 등.

### B. 서버 (Cloudflare Worker) 의 API
```js
fetch('https://saudade.absbjj1230.workers.dev/dispatches/today?edition=ko')
    .then(r => r.json())
    .then(items => /* 표시 */);
```
- 동적 — 매일 바뀌는 데이터.
- D1 (서버 DB) 에서 SELECT.
- 사용자 인증, 결제, 카페 제출 등.

### C. AI 가 작성 (scripts/refresh-dispatches.js)
```js
const out = await callGemini(prompt, GEMINI_KEY);
const parsed = JSON.parse(out);
// 파일에 저장
fs.writeFileSync('data/dispatches.ko.json', JSON.stringify(parsed));
```
- GitHub Actions 가 매일 06:00 KST 실행.
- Gemini (구글 LLM) 가 새 디스패치 작성.
- PR 만들어서 머지하면 사이트에 반영.

---

## 8. Cloudflare Worker — 백엔드는 어떻게?

`cloudflare-worker.js` (3,000줄) 한 파일에 백엔드 전체. 핵심만:

### Default export

```js
export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        switch (url.pathname) {
            case '/health':         return J(req, { ok: true });
            case '/auth/request':   return authRequest(req, env, ctx);
            case '/dispatches/today': return dispatchesToday(req, env, ctx);
            // ...
        }
    },
    async scheduled(event, env, ctx) {
        switch (event.cron) {
            case '0 15 * * *': return await pipelineGather(env);
            case '0 19 * * *': return await pipelineWrite(env);
            // ...
        }
    }
};
```

- `fetch(req, env, ctx)` — 누가 URL 요청하면 이게 실행됨.
  - `req` = HTTP 요청 (URL, headers, body).
  - `env` = 시크릿 + DB 바인딩.
  - `ctx` = "이 요청 끝난 후에도 계속 일해줘" 같은 비동기 컨텍스트.
- `scheduled(event, env, ctx)` — cron 시간이 되면 자동 실행.

### Cron 5개

```toml
# wrangler.toml
[triggers]
crons = [
  "0 15 * * *",   # Gather (RSS → DB)
  "0 17 * * *",   # Sort + Score (AI 평가)
  "0 19 * * *",   # Write (Gemini 가 글 씀)
  "0 20 * * *",   # decommissioned
  "0 21 * * *"    # File (top 3 발행)
]
```

- `* * * *` = 분 시 일 월 요일 (UTC).
- `0 15 * * *` = 매일 15:00 UTC = 00:00 KST.

### D1 SQL

```js
const rows = await env.SAUDADE_DB.prepare(
    'SELECT id, headline FROM dispatches_staged WHERE status = ? LIMIT ?'
).bind('published', 10).all();
```

- `prepare(SQL).bind(값1, 값2).all()` — SQL 실행.
- 결과는 `{ results: [{...}, {...}] }` 객체.

---

## 9. 캐시 — 왜 자꾸 v667 같은 게 보이나?

### 문제
브라우저는 한 번 받은 파일을 **캐시** (저장소) 에 둠. 다음에 같은 URL 요청하면 다시 다운 안 받음. 빠르지만, 우리가 코드 바꿔도 사용자는 옛 코드 봄.

### 해결 — query string
```html
<script src="saudade-cover.js?v=v667"></script>
```
- `?v=v667` 가 붙으면 브라우저는 "다른 URL 이네" 하고 새로 받음.
- 코드 바꾸면 `v667 → v668` 로 올림 → 사용자가 새 코드 받음.

### 자동화
```bash
npm run bump-cache
```
이 명령 한 번 치면:
1. `sw.js` 의 CACHE_VERSION 바꿈
2. `index.html` 의 모든 `?v=v667` → `?v=v668` (50곳)
3. `saudade-listening.js` 의 `?v=v667` 도 (1곳)

총 52곳을 한 번에. 이걸 손으로 하면 까먹기 쉬움.

### Smoke test 가 sync 검사
```bash
node test/smoke.js
```
이 테스트가 `sw.js` 캐시 버전과 `index.html` 의 `?v=` 가 일치하는지 검사. 안 맞으면 빨간불.

---

## 10. 새 기능 추가해보기 — 실습

예: "오늘의 인용" 섹션 추가하고 싶다고 해봅시다.

### 1단계 — 데이터 만들기
`data/quotes.json` 새 파일:
```json
{
    "quotes": [
        { "text": "조용한 거리도 한 번은 시끄러웠다.", "author": "어느 편집자", "date": "2026-05-08" }
    ]
}
```

### 2단계 — 타입 정의 (선택)
`types.d.ts` 에 추가:
```ts
export interface Quote {
    text: string;
    author: string;
    date: string;
}
```

### 3단계 — 모듈 만들기
`saudade-quote.js` 새 파일:
```js
// SAUDADE · DAILY QUOTE — § 06 sub-block
'use strict';

(function() {
    if (window.SAUDADE_QUOTE) return;

    function injectStyles() {
        if (document.getElementById('sddQuoteStyles')) return;
        const s = document.createElement('style');
        s.id = 'sddQuoteStyles';
        s.textContent = `
            .sdd-quote {
                font-family: var(--serif);
                font-style: italic;
                font-size: 24px;
                color: var(--ink);
                padding: 32px;
                border-top: 0.5px solid var(--rule);
            }
            .sdd-quote-author {
                font-family: var(--mono);
                font-size: 11px;
                color: var(--bone-d);
                letter-spacing: .28em;
                text-transform: uppercase;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(s);
    }

    async function load() {
        const r = await fetch('./data/quotes.json?v=v667');
        if (!r.ok) return null;
        return r.json();
    }

    async function render() {
        const root = document.getElementById('sddQuote');
        if (!root) return;
        const data = await load();
        if (!data || !data.quotes.length) return;
        const q = data.quotes[0];
        root.innerHTML = `
            <blockquote class="sdd-quote">
                ${q.text}
                <p class="sdd-quote-author">${q.author} · ${q.date}</p>
            </blockquote>
        `;
    }

    function init() {
        injectStyles();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.SAUDADE_QUOTE = { render };
})();
```

### 4단계 — index.html 에 등록
```html
<!-- 다른 saudade-*.js 옆에 -->
<script defer src="saudade-quote.js?v=v667"></script>

<!-- 그리고 화면에 자리 잡을 빈 div: -->
<div id="sddQuote"></div>
```

### 5단계 — 검증
```bash
npm run validate
node test/smoke.js
```

### 6단계 — 캐시 버전 올리기
```bash
npm run bump-cache
```

### 7단계 — 커밋
```bash
git checkout -b feat/daily-quote
git add data/quotes.json saudade-quote.js types.d.ts index.html sw.js
git commit -m "feat: § 06 daily quote block"
git push -u origin feat/daily-quote
```

이 7단계가 saudade 의 "기능 추가 표준 절차". `ARCHITECTURE.md §8` 에도 같은 체크리스트 있음.

---

## 11. 문서 vs 코드

| 파일 | 누구 위한? | 언제 읽나 |
|---|---|---|
| **README.md** | 외부 사람 (이 사이트 첫인상) | 첫 방문 |
| **ARCHITECTURE.md** | 새 기능 추가하는 개발자 | 코드 만지기 전 |
| **CLAUDE.md** | AI 에이전트 (저 같은) | AI 가 코드 작업할 때 |
| **RUNBOOK.md** | 매일 운영하는 에디터 | 매일 06:30 KST |
| **DEPLOY.md** | 처음 배포하는 사람 | 신규 셋업 시 |
| **CHANGELOG.md** | 최근 변경 알고 싶은 누구나 | 변화 살펴볼 때 |
| **types.d.ts** | 타입 안전성 원하는 개발자 | 새 데이터 추가할 때 |
| **LEARN.md** (이 문서) | 처음 배우는 사람 | 처음 |

---

## 12. 자주 헷갈리는 것

### "왜 React/Vue 안 쓰나요?"
saudade 는 **vanilla JS** (순수 JS). 이유:
- 매거진은 SPA 보다 **page-by-page** 가 더 잘 맞음.
- React 빌드 단계 = 복잡도 증가, 더 큰 파일.
- 51개 IIFE 모듈이 전부 합쳐도 25k 줄 — React + 라이브러리 보다 작음.

### "왜 fetch 가 자꾸 force-cache?"
정적 JSON 은 사용자 환경에서 매번 새로 받으면 느림. `force-cache` = "있으면 그거 써, 없으면 받아". 데이터 바뀌면 캐시 버전을 올려서 새 URL 로 만듦 (위 9번).

### "왜 IIFE 패턴? 그냥 ES Module 쓰면?"
- ES Module (`import` / `export`) 도 가능했지만, **번들러 (webpack 등) 가 필요**.
- IIFE 는 빌드 단계 없이 그냥 `<script>` 태그로 로드 가능.
- `scripts/build-bundle.js` 가 단순히 IIFE 들을 concat 해서 saudade.core.js 만듦.
- 빌드 단계 0 → CI 빠름, 디버깅 쉬움.

### "왜 export 하지 않고 window.SAUDADE_XXX?"
- IIFE 패턴이라 export 가 없음.
- 대신 `window` 객체에 직접 붙임 = 다른 모듈이 `window.SAUDADE_EDITION.get()` 으로 호출.
- 단점: 전역 namespace 오염.
- 해결: `SAUDADE_` 접두어 통일 → 충돌 가능성 거의 없음.

### "헌법 (Constitution) 이 뭐예요?"
saudade 의 편집·디자인 원칙. 코드보다 먼저 정해진 룰:
- §1: paper × ink × ONE accent. 그라디언트·그림자 X. 이모지 X.
- §3: "들렀거나 정독한 곳만 등재." (카페)
- §9.5: 매일 06:00 KST 발행. 30% 헤드라인 본인이 다시 씀.
- 기타. CLAUDE.md 상단에 정리됨.

### "이상한 변수명이 보여요. `_audio`, `_data` 처럼 `_` 가 앞에 있는 거"
- 관례적으로 "**모듈 내부용 변수**, 밖에서 쓰지 마" 표시.
- JS 자체는 강제하지 않음. 사람끼리의 약속.

---

## 13. 다음 학습

이 문서 읽고 나서:

1. **MDN Web Docs** (https://developer.mozilla.org/) — JavaScript 사전. 모르는 함수 검색.
2. **web.dev** (https://web.dev/) — Google 의 웹 개발 가이드. PWA · 성능 · 접근성.
3. **Cloudflare Workers Docs** (https://developers.cloudflare.com/workers/) — 백엔드 더 알고 싶으면.
4. **GitHub** — 다른 사람의 vanilla-JS 프로젝트 구경. saudade 처럼 vanilla 인 곳 찾으면 비교.

코드 읽기 연습:
1. saudade-edition.js (200줄, 가장 간단)
2. saudade-listening.js (1500줄, ASMR 라이브러리)
3. saudade-atlas.js (지도 + 카페)
4. saudade.editorial.js (표지)
5. saudade.core.js (5000줄, 마지막)

---

## 14. 한 줄로 마무리

> **saudade 는 vanilla JS 51개 모듈이 IIFE 패턴으로 동거하는 매거진. 디자인은 paper × ink × accent. 데이터는 정적 JSON · D1 · Gemini 가 만들어. 캐시는 query string 으로 깸. 새 기능 = 새 IIFE 모듈 + JSON 파일 + index.html 등록 + 캐시 bump.**

이 한 줄이 머리에 남으면, 코드 읽다가 길 잃지 않습니다.

질문 생기면 ARCHITECTURE.md → CLAUDE.md → 그 다음 코드 직접. 모르겠으면 `git log --oneline -20` 으로 최근 변화 봐도 답 있을 때가 많음.

행운을 — 천천히 가도 됨. 이 매거진 자체가 그런 톤이니까.
