# RSS 출처 운영자 워크플로우

v7 §3 (출처 정책) · §9.2 (요일 구조) · §9.3 (금지 출처) · §10.1 (일일 cron) 연계.

## 빠른 흐름

```
[1] 스키마 + 시드 적용 (1회)
    wrangler d1 execute saudade_db --remote --file=schema/rss_sources.sql
    wrangler d1 execute saudade_db --remote --file=data/rss-sources-seed.sql

[2] 시드된 ~25개 entry 의 rss_url 은 모두 NULL — 운영자가 검증 후 채워야 함
    GET /admin/rss-sources?city=lisbon  (Bearer EDITOR_TOKEN)
    → 검증 안 된 출처 목록 받기

[3] 각 site_url 방문 → RSS 피드 URL 확인
    예: lisboa.pt 첫 방문 → footer/header 의 RSS 아이콘 확인
    없으면: RSS.app (rss.app) 으로 변환 시도, 또는 출처 제외 (rejected)

[4] 약관 검토 (terms_status='pending' 인 큰 매체만 — 정부/박물관은 시드에 'approved')
    - 재배포·인용 제한 조항 확인
    - 25 단어 이내 인용 + 원문 링크 표기 가능한지
    - 문제 있으면 terms_status='rejected'

[5] PATCH /admin/rss-sources
    body: {
      "id": 3,
      "rss_url": "https://www.theportugalnews.com/rss",
      "terms_status": "approved",
      "terms_notes": "reviewed 2026-05-03: ToS allows headline + link + 25-word excerpt",
      "active": 1
    }

[6] 첫 1주 cron 결과 매일 검수
    - SELECT * FROM raw_feeds WHERE fetched_at > strftime('%s','now','-1 day')*1000;
    - SELECT * FROM rss_sources WHERE last_fetch_ok = 0;  -- 실패 출처 점검
```

## 시드 출처 (검증 대기 상태)

| city | source | section | terms |
|---|---|---|---|
| lisbon | Lisbon City Hall (lisboa.pt) | cityhall | approved |
| lisbon | Gulbenkian Foundation | museum | approved |
| lisbon | The Portugal News | quiet | **pending** |
| lisbon | Time Out Lisbon | desk | **pending** |
| lisbon | Visit Lisboa | desk | approved |
| chiang-mai | Chiang Mai City Life | quiet | **pending** |
| chiang-mai | TAT Chiang Mai | desk | approved |
| chiang-mai | MAIIAM Contemporary Art | museum | approved |
| chiang-mai | The Nation Thailand | quiet | **pending** |
| seoul | Seoul Metropolitan Govt | cityhall | approved |
| seoul | Seoul Foundation for Arts | museum | approved |
| seoul | National Museum of Korea | museum | approved |
| seoul | Visit Seoul | desk | approved |
| seoul | The Korea Times | quiet | **pending** |
| berlin | Berlin.de | cityhall | approved |
| berlin | The Berlin Spectator | quiet | **pending** |
| berlin | Sammlung Boros | museum | approved |
| berlin | Visit Berlin | desk | approved |
| tokyo | Tokyo Metropolitan Govt | cityhall | approved |
| tokyo | Mori Art Museum | museum | approved |
| tokyo | Tokyo Art Beat | museum | **pending** |
| tokyo | Time Out Tokyo | desk | **pending** |
| mexico-city | Gobierno CDMX | cityhall | approved |
| mexico-city | Museo Jumex | museum | approved |
| mexico-city | Mexico News Daily | quiet | **pending** |

`approved` 도 RSS URL 확인은 필수. `pending` 은 ToS 검토까지 필요.

## 금지 출처 (forbidden_sources 테이블)

`gather()` 가 raw_feeds INSERT 직전 도메인 매칭으로 차단. 시드:

- **Wire**: reuters.com / apnews.com / ap.org / bloomberg.com
- **Paywall**: nytimes.com / wsj.com / ft.com / washingtonpost.com / economist.com
- **Major UK**: theguardian.com
- **KR major**: chosun.com / joongang.co.kr / donga.com / hani.co.kr
- **Tabloid/political**: tmz.com / dailymail.co.uk / thesun.co.uk / foxnews.com / breitbart.com

새 차단 도메인은 SQL 직접 INSERT (관리 endpoint 는 조회만):
```bash
wrangler d1 execute saudade_db --remote --command="INSERT INTO forbidden_sources (domain_pattern, reason, notes, created_at) VALUES ('example.com', 'wire-service', 'added 2026-05-10', strftime('%s','now')*1000);"
```

## 관리 API

`Authorization: Bearer ${EDITOR_TOKEN}` 필수.

### `GET /admin/rss-sources?city=lisbon`
도시별 (생략 시 전체) 출처 목록. `last_fetch_ok=0` 인 항목 우선 점검.

### `PATCH /admin/rss-sources`
운영자가 검증 후 RSS URL · 약관 상태 · 활성화 갱신.
```json
{
  "id": 3,
  "rss_url": "https://...",
  "terms_status": "approved|pending|rejected",
  "terms_notes": "reviewed YYYY-MM-DD: ...",
  "active": 1
}
```
응답: `{ "ok": true, "id": 3, "changed": 1 }` (`last_verified` 자동 갱신)

### `GET /admin/rss-forbidden`
금지 출처 조회만.

## cron 활성화

`wrangler.toml` 의 `[triggers]` 섹션 주석 해제 후 `wrangler deploy`. cron 흐름:

```
00:00 KST  gather    rss_sources WHERE active=1 → raw_feeds (forbidden 차단)
00:30 KST  sort      Workers AI Llama 3.1 8B → raw_feeds.city
02:00 KST  score     Workers AI → raw_feeds.ai_score (1~10)
04:00 KST  write     Gemini 2.0 Flash → dispatches_staged (요일별 프롬프트)
05:00 KST  translate Gemini → 5 에디션 별쇄
05:30 KST  stage     검수 큐 marker
06:00 KST  file      Top 3 → status='published'
```

active 출처가 0개면 gather 는 `{ ok:true, count:0, note:'no active rss_sources — operator setup pending' }` 반환. 이후 phase 도 raw_feeds 비어 no-op.

## 분쟁 대비

`terms_notes` 필드는 분쟁 발생 시 **유일한 근거**. 검토일 + 검토 결과를 항상 기록:

```
"reviewed 2026-05-03: ToS section 4.2 allows headline + link + 25-word excerpt
 with attribution. Republication of full article prohibited. Photographs
 require separate license — we use none."
```

`rejected` 처리한 출처도 `terms_notes` 에 사유 기록 후 두지 (재검토 가능).
