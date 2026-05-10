# LEARN-PATH.md — 0 에서 saudade 코드 읽기까지 (6개월 로드맵)

이 문서는 **코드 한 줄도 안 써본 사람** 이 6개월 안에 saudade 코드베이스를 읽고, 작은 기능 추가까지 할 수 있게 만드는 단계별 로드맵입니다.

매일·매주 **구체적으로 뭘 할지** 적혀있습니다. "freeCodeCamp 해" 같은 추상적 조언 X.

---

## 시작하기 전 — 솔직한 이야기

### 1. 코딩은 어렵습니다

처음 한 달은 **모든 게 외계어** 같습니다. `console.log` 가 뭔지, 왜 `;` 붙이는지, 왜 `()` 가 두 번 나오는지 (`function()()`) 모릅니다. **그게 정상**입니다.

뇌가 새 언어 배우는 것과 같음. 한국어 → 일본어 배울 때처럼 처음엔 단어 외우고, 문법 외우고, 한참 후에야 자연스럽게 됩니다.

### 2. 빨리 배우는 사람의 비밀

- **매일 조금씩** (1시간 × 매일 > 5시간 × 일요일)
- **타이핑 먼저, 이해 나중에** — 외워서 베껴 쓰다 보면 어느 순간 이해됨
- **막히면 30분 시도 후 검색** (Google · Stack Overflow · ChatGPT)
- **혼자 공부 X** — Discord 나 카톡방 1곳에 들어가서 막힌 거 물어보기

### 3. 6개월 후 도달할 수준

- HTML/CSS 자유자재
- JavaScript 기본 80% (변수 · 함수 · 반복 · 조건 · 객체 · 배열)
- fetch 로 데이터 받아서 화면 그리기
- Git/GitHub 기본
- saudade 코드 읽고 작은 PR 보낼 수 있음
- **취업 수준은 아님** — 그건 1~2년

---

## 준비 — 첫날 (1시간)

### A. 도구 설치

#### 1. 크롬 브라우저
- https://www.google.com/chrome/
- 이미 있으면 OK

#### 2. VS Code (코드 에디터)
- https://code.visualstudio.com/
- 무료. 윈도우/맥/리눅스 다 됨.
- 설치 후 한국어 팩 설치 (왼쪽 사각형 아이콘 → "korean" 검색 → Korean Language Pack)

#### 3. GitHub 계정
- https://github.com/
- "Sign up" → 이메일 + 비밀번호 + 사용자명
- 사용자명은 평생 따라다님 — 신중히

#### 4. 카톡방 / Discord (질문할 곳)
- **생활코딩 페이스북 그룹** (한국어 가장 친절)
- **r/learnprogramming** (영어, Reddit)
- 또는 친구 한 명 같이 시작하기

### B. VS Code 첫 설정 (10분)

1. VS Code 열기
2. 왼쪽 사각형 아이콘 → 검색창에 "Live Server" → 설치
   - 이걸 깔면 HTML 파일 우클릭 → "Open with Live Server" 가능. 저장하면 자동 새로고침.
3. 한국어 팩 설치 (위에서)

### C. 첫 폴더 만들기

```
바탕화면 / 또는 어디든
└── coding/             ← 이름 자유
    └── day-01/
        └── index.html  ← 다음 단계에서 만들 파일
```

VS Code 에서 `File → Open Folder` → `coding` 선택.

이제 출발 준비 끝.

---

## 1주차 — HTML 만 (5일, 매일 1시간)

**목표**: 본인 소개 웹페이지 1개.

### Day 1 — 첫 HTML

VS Code 에서 `index.html` 만들고:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>안녕</title>
</head>
<body>
    <h1>안녕하세요</h1>
    <p>저는 처음 코딩을 시작합니다.</p>
</body>
</html>
```

저장 → 우클릭 → Open with Live Server.

**오늘 외울 것** (이해 X, 그냥 베껴 쓰기):
- `<!DOCTYPE html>` = "이건 HTML 문서야"
- `<html>` = HTML 시작 (끝은 `</html>`)
- `<head>` = 페이지 정보 (제목·언어)
- `<body>` = 화면에 보이는 내용
- `<h1>` = 큰 제목
- `<p>` = 단락

**오늘 자료**:
- 생활코딩 WEB1 1강 ~ 5강 (https://opentutorials.org/course/3084) — 25분

### Day 2 — 더 많은 태그

```html
<body>
    <h1>김아무개</h1>
    <h2>경력</h2>
    <ul>
        <li>2020 ~ 학교</li>
        <li>2024 ~ 코딩 시작</li>
    </ul>
    <h2>좋아하는 것</h2>
    <ol>
        <li>커피</li>
        <li>고양이</li>
        <li>음악</li>
    </ol>
    <p>연락: <a href="mailto:me@example.com">me@example.com</a></p>
    <img src="https://placehold.co/200x200" alt="내 사진">
</body>
```

새 태그:
- `<h2>` = 중간 제목
- `<ul>` / `<li>` = 점 리스트
- `<ol>` / `<li>` = 번호 리스트
- `<a>` = 링크
- `<img>` = 이미지

저장 → 새로고침 → 어떻게 보이는지 확인.

**오늘 자료**: 생활코딩 WEB1 6강~10강 (25분)

### Day 3 — 의미있는 태그 (semantic HTML)

```html
<body>
    <header>
        <h1>김아무개의 블로그</h1>
        <nav>
            <a href="#">홈</a> ·
            <a href="#about">소개</a> ·
            <a href="#blog">블로그</a>
        </nav>
    </header>

    <main>
        <article>
            <h2>오늘 처음 코딩을 했다</h2>
            <p>HTML 이 뭔지 처음 배웠다.</p>
        </article>
    </main>

    <footer>
        <p>&copy; 2026 김아무개</p>
    </footer>
</body>
```

새 태그:
- `<header>` = 위쪽 머리글
- `<nav>` = 메뉴
- `<main>` = 본문
- `<article>` = 글 한 편
- `<footer>` = 아래쪽 바닥글
- `&copy;` = ⓒ (특수문자)

**왜 이런 게 있나?** 화면엔 똑같이 보이지만, 검색 엔진과 보조 기술 (스크린리더 등) 이 "이게 메뉴구나, 이게 본문이구나" 알 수 있게.

### Day 4 — 폼 (form)

```html
<form>
    <label for="name">이름:</label>
    <input type="text" id="name">

    <label for="email">이메일:</label>
    <input type="email" id="email">

    <label for="msg">메시지:</label>
    <textarea id="msg" rows="5"></textarea>

    <button type="submit">보내기</button>
</form>
```

폼은 사용자 입력 받기. 지금은 못 보내고 그냥 만들기 연습.

### Day 5 — 본인 소개 페이지 완성

이름 / 사진 / 좋아하는 것 / 연락처 / 1~3개 글 들어간 페이지 하나 끝까지.

**일주일 끝났을 때 할 수 있어야**:
- HTML 파일 새로 만들 수 있음
- 제목·단락·리스트·링크·이미지 넣을 수 있음
- 적당한 의미 태그 (header/main/footer) 쓸 수 있음

**못 한다고 좌절 X** — 일주일 더 반복하기. 계속 따라치기.

---

## 2주차 — CSS (5일, 매일 1시간)

**목표**: 1주차 페이지를 예쁘게.

### Day 6 — 첫 CSS

`index.html` 의 `<head>` 안에 추가:

```html
<style>
    body {
        font-family: sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: #f5f5dc;
        color: #333;
    }
</style>
```

저장 → 페이지가 가운데 정렬되고 색이 바뀜.

CSS 문법:
```
선택자 {
    속성: 값;
}
```

위 예시:
- `body` 라는 선택자 (`body` 태그 모두)
- 그 안에 글자 폰트·최대 너비·여백·배경색·글자색

### Day 7 — 색·폰트

```css
h1 {
    font-size: 32px;
    color: #d33;
    text-align: center;
}
h2 {
    color: #06c;
    border-bottom: 2px solid #ccc;
    padding-bottom: 8px;
}
a {
    color: #06c;
    text-decoration: none;
}
a:hover {
    text-decoration: underline;
}
```

새 개념:
- `:hover` = 마우스 올렸을 때
- 색 표기: `#d33` 같은 16진수 또는 `red` 같은 이름
- `px` = 픽셀, 화면 점 단위

**오늘 자료**: 생활코딩 WEB2-CSS 1강 ~ 5강

### Day 8 — 박스 모델

모든 HTML 요소는 박스. 박스는:

```
┌──────── margin (밖 여백) ────────┐
│  ┌──── border (테두리) ────┐    │
│  │  ┌── padding (안 여백) ┐│    │
│  │  │   content (내용)    ││    │
│  │  └────────────────────┘│    │
│  └────────────────────────┘    │
└──────────────────────────────┘
```

```css
.card {
    margin: 16px;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: white;
}
```

`.card` = "card 라는 클래스를 가진 요소". HTML 에서:
```html
<div class="card">내용</div>
```

### Day 9 — Flex (레이아웃)

가로로 나란히 놓고 싶을 때:

```css
.row {
    display: flex;
    gap: 16px;
    align-items: center;
}
```

```html
<div class="row">
    <img src="...">
    <div>
        <h2>이름</h2>
        <p>설명</p>
    </div>
</div>
```

**Flex 한 번에 다 익히려 하지 말 것**. 나중에 천천히. 오늘은 `display: flex` + `gap` 만.

### Day 10 — 1주차 페이지 꾸미기

본인 소개 페이지에 CSS 추가해서 예쁘게.

**2주 끝났을 때**:
- HTML + CSS 로 간단한 페이지 만들 수 있음
- 색·폰트·여백·테두리 변경할 수 있음
- 만든 페이지 친구한테 카톡으로 보낼 수 있음 (스크린샷)

---

## 3~4주차 — JavaScript 기초 (10일, 매일 1.5시간)

**목표**: 변수·함수·조건·반복 자유롭게.

### Day 11 — JavaScript 첫 줄

`index.html` 끝쪽 `</body>` 직전에:

```html
<script>
    console.log('안녕');
    alert('환영합니다');
</script>
```

`console.log` = 콘솔에 출력 (F12 누르면 콘솔 보임).
`alert` = 팝업창.

### Day 12 — 변수

```js
const name = '김아무개';
const age = 28;
let mood = '졸림';

console.log(name);
console.log(age + 1);   // 29
console.log(name + '의 나이는 ' + age);

mood = '기쁨';   // let 은 바꿀 수 있음
console.log(mood);
```

- `const` = 안 변하는 값
- `let` = 변하는 값
- `'문자열'` 또는 `"문자열"`
- 숫자는 따옴표 없이

### Day 13 — 함수

```js
function greet(name) {
    return '안녕 ' + name;
}

console.log(greet('아무개'));   // 안녕 아무개
console.log(greet('철수'));    // 안녕 철수
```

함수 = 재사용 가능한 코드 묶음.
- `function` 키워드
- `(name)` = 인자 (parameter)
- `return` = 결과 돌려주기

### Day 14 — 조건

```js
const age = 18;

if (age >= 20) {
    console.log('성인');
} else if (age >= 14) {
    console.log('청소년');
} else {
    console.log('어린이');
}
```

비교 연산자:
- `===` 같다 (3개! `==` 안 씀)
- `!==` 다르다
- `>` 크다, `<` 작다, `>=` 크거나 같다

### Day 15 — 반복 (for)

```js
for (let i = 1; i <= 5; i++) {
    console.log(i);
}
// 1, 2, 3, 4, 5
```

문법 외우기:
- `let i = 1` — i 를 1 로 시작
- `i <= 5` — i 가 5 이하인 동안
- `i++` — 매번 i 에 1 더하기

### Day 16 — 배열 (array)

```js
const fruits = ['사과', '배', '귤'];

console.log(fruits[0]);   // 사과 (0번부터 시작!)
console.log(fruits.length); // 3

fruits.push('포도');   // 끝에 추가
console.log(fruits);   // ['사과', '배', '귤', '포도']

for (let i = 0; i < fruits.length; i++) {
    console.log(fruits[i]);
}

// 더 짧게:
fruits.forEach(f => console.log(f));
```

### Day 17 — 객체 (object)

```js
const user = {
    name: '아무개',
    age: 28,
    city: '서울'
};

console.log(user.name);     // 아무개
console.log(user['age']);   // 28 (똑같음, 다른 문법)

user.city = '부산';   // 변경
user.email = 'me@x.com';   // 추가
```

배열은 `[]`, 객체는 `{}`.
배열은 순서, 객체는 이름표.

### Day 18 — DOM 조작

DOM = "Document Object Model" = HTML 을 JS 로 만지기.

```html
<button id="myBtn">눌러</button>
<p id="output"></p>

<script>
    const btn = document.querySelector('#myBtn');
    const out = document.querySelector('#output');

    btn.addEventListener('click', () => {
        out.textContent = '눌렸어요!';
    });
</script>
```

`document.querySelector('#myBtn')` = HTML 에서 id="myBtn" 인 요소 찾기.
`addEventListener('click', 함수)` = 클릭하면 그 함수 실행.

### Day 19 — DOM 조작 더

```js
// 요소 찾기
const all = document.querySelectorAll('.item');   // 클래스 .item 인 모든 거
const first = document.querySelector('p');         // 첫 <p>

// 내용 변경
out.textContent = '텍스트';
out.innerHTML = '<strong>굵게</strong>';

// 클래스 추가/제거
out.classList.add('active');
out.classList.remove('active');
out.classList.toggle('active');

// 스타일
out.style.color = 'red';
out.style.fontSize = '24px';

// 새 요소 만들기
const div = document.createElement('div');
div.textContent = '새로 만든 거';
document.body.appendChild(div);
```

이게 JS 의 90%. 사용자 입력 받고 → 화면 바꾸기.

### Day 20 — 첫 작은 프로젝트: 카운터

`counter.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        button { font-size: 20px; padding: 10px 20px; margin: 5px; }
        #count { font-size: 48px; margin: 20px; }
    </style>
</head>
<body>
    <h1>카운터</h1>
    <p id="count">0</p>
    <button id="up">+1</button>
    <button id="down">-1</button>
    <button id="reset">초기화</button>

    <script>
        let count = 0;
        const display = document.querySelector('#count');

        document.querySelector('#up').addEventListener('click', () => {
            count++;
            display.textContent = count;
        });

        document.querySelector('#down').addEventListener('click', () => {
            count--;
            display.textContent = count;
        });

        document.querySelector('#reset').addEventListener('click', () => {
            count = 0;
            display.textContent = count;
        });
    </script>
</body>
</html>
```

저장 → Live Server → 직접 눌러봄.

이게 처음 "내가 만든 동작하는 것".

### 4주차 (Day 21~25) — 자료 학습

**Day 21~25 자료** (5일):
- **모던 자바스크립트 튜토리얼 한국어** (https://ko.javascript.info/) — 1장 (소개) ~ 5장 (자료구조).
- 매일 1~2 챕터. 코드 직접 따라치기.

**1달 끝났을 때**:
- 변수 / 함수 / 조건 / 반복 / 배열 / 객체 자유롭게
- DOM 으로 클릭 이벤트 연결 가능
- 작은 페이지 (카운터 / 시계 / 메모) 혼자 만들 수 있음

---

## 5~6주차 — DOM 깊게 + TODO 앱

**목표**: 완전한 TODO 앱 1개 (할 일 추가/체크/삭제).

### Day 26 — 자료 학습
**ko.javascript.info** Browser Document 챕터 (Chapter 6): https://ko.javascript.info/document
1장 ~ 4장. 천천히.

### Day 27~30 — TODO 앱 만들기

`todo.html` 부터 시작. 기능:
1. 할 일 입력 → 추가
2. 체크박스 누르면 줄 그어짐
3. 삭제 버튼

이건 **검색하면서 만들기**. "javascript todo app tutorial" 유튜브에 한국어로 100개 있음.

추천 영상:
- **드림코딩 by 엘리** (YouTube 한국어, https://www.youtube.com/@dream-coding)
- **노마드 코더 ToDo** (한국어 무료)

### Day 31~35 — TODO 앱 + localStorage

만든 TODO 앱이 새로고침하면 데이터 사라지죠? `localStorage` 로 저장:

```js
// 저장
localStorage.setItem('todos', JSON.stringify(todos));

// 불러오기
const saved = localStorage.getItem('todos');
const todos = saved ? JSON.parse(saved) : [];
```

이게 saudade 도 쓰는 패턴 (LEARN.md §5 의 `saudade.edition` 키 같은).

**6주 끝났을 때**:
- TODO 앱 새로고침해도 데이터 남음
- DOM 조작 + 이벤트 + localStorage 이해
- "내가 사이트 하나 만들었네" 자신감

---

## 7~8주차 — 비동기 / fetch / API

**목표**: 인터넷에서 데이터 받아 화면에 그리기.

### Day 36 — Promise / async / await

```js
// 옛날 방식 (콜백)
fetch('https://api.example.com/data')
    .then(r => r.json())
    .then(data => console.log(data))
    .catch(e => console.error(e));

// 새 방식 (async / await)
async function loadData() {
    try {
        const r = await fetch('https://api.example.com/data');
        const data = await r.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}
loadData();
```

**ko.javascript.info Promise 챕터** (Chapter 11) 천천히 — 1주.

### Day 37~42 — 날씨 앱

자유 API 로 연습:
- **Open-Meteo** (https://open-meteo.com/) — 무료, 키 없음.

```js
async function getWeather(lat, lng) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m`;
    const r = await fetch(url);
    const data = await r.json();
    return data.current.temperature_2m;
}

getWeather(37.5665, 126.9780).then(t => {
    document.querySelector('#temp').textContent = t + '°C';
});
```

이거 하나 됐으면 **인터넷 데이터 받아 화면 그리는 능력** 생긴 거. 큼.

### Day 43~45 — JSON / API 더

JSON = JavaScript Object Notation. 객체를 문자열로 표현.
```json
{ "name": "아무개", "age": 28 }
```

배우기 좋은 무료 API (키 없음):
- **JSONPlaceholder** (https://jsonplaceholder.typicode.com/) — 가짜 데이터
- **Dog API** (https://dog.ceo/dog-api/)
- **Pokéapi** (https://pokeapi.co/)

각각 1개씩 작은 사이트 만들기.

---

## 9~10주차 — Git / GitHub

**목표**: 본인 코드를 GitHub 에 올림.

### Day 46 — Git 설치
- 윈도우: https://git-scm.com/ → 설치 (다 default)
- 맥: 이미 있을 가능성. 터미널에서 `git --version`

### Day 47~50 — Git 기초 5개 명령

```bash
git init                 # 폴더 시작
git add .                # 모든 변경 stage
git commit -m "메모"     # 저장 (커밋)
git status               # 상태 보기
git log                  # 이전 커밋 보기
```

**자료**:
- **생활코딩 GIT** (https://opentutorials.org/course/3837) 5강까지

### Day 51~52 — GitHub 에 올리기

```bash
git remote add origin https://github.com/사용자명/저장소.git
git branch -M main
git push -u origin main
```

이전에 만든 TODO 앱 / 날씨 앱 모두 GitHub 에 올리기.

### Day 53~55 — Branch / Pull Request

```bash
git checkout -b feature/좋은이름   # 새 브랜치
# 코드 변경
git add . && git commit -m "변경"
git push -u origin feature/좋은이름
# GitHub 에서 PR (Pull Request) 만들기
```

이게 **saudade 같은 협업 프로젝트의 방식**.

---

## 11~12주차 — 본격 첫 프로젝트

**목표**: 머릿속에 있는 작은 사이트 하나 처음부터 끝까지.

### 아이디어 예시

- 본인 일기 앱 (날짜 + 내용 저장)
- 책 리뷰 (책 추가 + 별점 + 한줄평)
- 한국 카페 지도 (좌표 + 이름)
- 가족 생일 알림
- 가계부

**선택 기준**:
1. 본인이 진짜 쓸 만한 것
2. HTML + CSS + JS + localStorage 만으로 만들 수 있는 것
3. 너무 크지 않을 것 (2주 안에 끝낼 정도)

### 진행

**Day 56**: 종이에 화면 스케치. 어떤 버튼·입력·리스트?
**Day 57**: HTML 만 작성 (CSS X, JS X)
**Day 58~60**: CSS 입혀서 예쁘게
**Day 61~65**: JS 동작 추가 — 이벤트, localStorage
**Day 66~70**: 버그 잡기, README 쓰기, GitHub 올리기

이거 끝나면 **포트폴리오 1개** 생긴 것. 매우 큼.

---

## 13~14주차 — saudade 코드 읽기 시작

이제 saudade 코드가 외계어 안 보임.

### Day 71 — saudade 클론

```bash
git clone https://github.com/luiseluise0619-wq/saudade.git
cd saudade
```

VS Code 에서 폴더 열기.

### Day 72 — LEARN.md 읽기

이전 PR 의 LEARN.md (https://github.com/luiseluise0619-wq/saudade/blob/main/LEARN.md) 차분히 읽기. 처음 볼 땐 70% 이해됨. 다음 주에 다시 읽으면 90%.

### Day 73~75 — saudade-edition.js 한 줄씩

LEARN.md §5 따라가면서 saudade-edition.js 직접 읽기. 모르는 부분 검색.

### Day 76~80 — saudade-listening.js 읽기

더 큰 모듈 (1500줄). 천천히. 이게 됐으면 **saudade 의 다른 모듈도 다 비슷한 패턴**.

---

## 15~16주차 — 첫 PR (saudade 에 기여)

### Day 81~85 — 작은 fix 찾기

GitHub Issues (https://github.com/luiseluise0619-wq/saudade/issues) 에서:
- typo / 오타
- 영어 → 한국어 번역 빠진 곳
- 색상 약간 변경
- 새 카페 1개 추가 (promote-cafe.js 사용)

뭐든 작은 것.

### Day 86~90 — 첫 PR 보내기

```bash
git checkout -b fix/내가-고친-거
# 변경
git add .
git commit -m "fix: ..."
git push -u origin fix/내가-고친-거
# GitHub 가서 PR 만들기
```

머지되면 **본인 GitHub 에 contribution 1개**. 면접에서 보여줄 수 있는 것.

---

## 17~24주차 (5~6개월) — 본격 실력 쌓기

이 시점부터 사람마다 다름. 추천 방향:

### A. 더 깊이 공부
- **JavaScript.info** 끝까지 (Modern JS Tutorial)
- **Eloquent JavaScript** (책, 무료 https://eloquentjavascript.net/)
- **MDN** 검색하면서 사용

### B. 새 기술 1개 추가
- **Git 더** — Pro Git 책 무료
- **TypeScript** — JS 의 타입 안전 버전
- **React** OR **Vue** — 더 큰 사이트 만들 때
- **Node.js** — 서버 만들기

### C. 큰 프로젝트
- **본인이 진짜 쓰고 싶은 사이트** 처음부터 끝까지
- 2~3개월 걸려도 OK
- README 자세히, 배포 (Cloudflare Pages 무료)

### D. 알고리즘 (취업 노린다면)
- **백준** (https://www.acmicpc.net/) — 한국어 코딩 사이트
- 단계별 문제 풀이 → 일주일 5문제

---

## 매일·매주 루틴

### 매일 (1시간)
- 새 거 30분 (튜토리얼 / 책)
- 코드 직접 30분 (따라치기 / 작은 프로젝트)

### 매주
- 일요일 1시간: 그 주에 배운 거 정리 (블로그 또는 메모)
- 막힌 거 1개는 사람한테 물어보기

### 매월
- 작은 프로젝트 1개 GitHub 에 올리기

---

## 막히면

### 1단계 — 30분 시도
에러 메시지 그대로 구글 검색.

### 2단계 — Stack Overflow
영어지만 거의 모든 답이 있음.

### 3단계 — ChatGPT / Claude
"이 에러 무슨 뜻이야?" + 에러 코드 복붙. 답 받아서 이해.

### 4단계 — 사람
- **r/learnprogramming** (Reddit, 영어, 정중함)
- **생활코딩 페이스북 그룹** (한국어)
- **OKKY** (한국 개발자 커뮤니티, https://okky.kr/)

질문 잘하는 법:
- 뭘 하려 했는지
- 무슨 코드를 썼는지 (코드 복붙)
- 무슨 결과가 났는지 (에러 메시지)
- 뭘 시도해봤는지

이 4개 적으면 답 잘 받음.

---

## 자주 하는 실수

### 1. "튜토리얼만 보고 안 친다"
영상 보면 다 알 것 같은데, 직접 치면 막힘. **무조건 따라치기**.

### 2. "오늘 안 했는데 내일 2배 한다"
연속성이 핵심. 5분이라도 매일.

### 3. "다 이해해야 다음으로 간다"
이해 안 돼도 일단 진도. 한 달 후 다시 보면 이해됨. 어차피 처음엔 다 모름.

### 4. "큰 프로젝트 먼저 시도"
"인스타그램 클론 만들래" → 좌절. 카운터 → TODO → 날씨 → 차근차근.

### 5. "강의 만 사면 잘하게 될 줄"
유료 강의도 좋지만, **본인이 직접 안 치면 똑같음**. 무료 자료로 충분히 됨.

---

## 정직한 성공률

이 로드맵을 매일 1시간씩 6개월 따라하는 사람 중:
- 30% → 6개월 안에 saudade 코드 읽고 PR 보냄
- 40% → 6개월 후에도 계속하지만 saudade 는 아직 어려움. 1년 더 필요
- 30% → 도중에 그만둠 (재미없음 / 시간 없음 / 좌절)

매일 1시간이 진짜 어렵습니다. 그게 정상.

---

## 마지막 — 무료 자료 한 줄 요약

| 학습 단계 | 추천 자료 | 언어 | 시간 |
|---|---|---|---|
| HTML/CSS 처음 | **생활코딩 WEB1, WEB2** | 한국어 | 5시간 |
| JS 처음 | **드림코딩 by 엘리** YouTube | 한국어 | 10시간 |
| JS 더 | **모던 자바스크립트 튜토리얼** ko.javascript.info | 한국어 | 50시간 |
| JS 깊게 | **Eloquent JavaScript** (책 무료) | 영어 | 40시간 |
| 풀스택 | **freeCodeCamp** | 영어 (한국어 자막) | 300시간 |
| 알고리즘 | **백준 단계별** | 한국어 | 100시간 |
| Git | **생활코딩 GIT** | 한국어 | 5시간 |
| API / 무료 | **Open-Meteo / JSONPlaceholder** | 영어 | 연습 |

전부 **무료**. 유료 안 사도 됨.

---

## 한 줄

> **매일 1시간씩 6개월. 빨리 가려 하지 말 것. 막히는 게 정상. 같이 하는 사람 1명 있으면 성공률 2배.**

작게 시작하세요. 오늘 Day 1 부터.

준비되면 LEARN.md (이 파일 옆에) 6개월 뒤 다시 읽어보세요. 다 이해됩니다.
