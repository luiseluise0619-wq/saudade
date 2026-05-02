# AURA — 수익화 / 결제 인프라 가이드 (보관 / DEPRECATED)

> ⚠ **2026-04 이후 본 앱은 100% 무료로 전환되었습니다.**
> Premium 구독·B2B 라이선스 트랙은 현재 비활성 상태이며, **광고(Sponsored 마커) + 어필리에이트** 만 운영됩니다.
> 결제 인프라(Lemon Squeezy 연동, license 검증, premium UI)는 코드와 git history 에 보존되어 있어, 향후 재활성화 시 git revert + 라우터 한 줄로 복구 가능합니다.
> 본 문서는 그 시점에 다시 사용할 수 있도록 참고 자료로 보관합니다.

3가지 수익 트랙(이전 계획): **광고 (Sponsored 마커)** ✅ 운영중, **Premium 구독** ❌ 비활성, **B2B 카페 라이선스** ❌ 비활성.

---

## 💎 트랙 1: Sponsored 마커 (제일 빠른 매출)

### 코드: 이미 구현됨
- `sponsors.json` — 매물 데이터
- `sponsors.js` — globe 마커 + popup
- 명시적 "SPONSORED" 라벨 (FTC 준수)

### 매물 모집 (No-code)
JSON 추가만 하면 됩니다:

```json
{
  "active": [
    {
      "id": "starbucks-gangnam",
      "name": "Starbucks Gangnam Reserve",
      "type": "cafe",
      "lat": 37.4979, "lng": 127.0276,
      "country": "KR",
      "description": "프리미엄 리저브 매장, 24시간 영업",
      "url": "https://starbucks.co.kr/...?utm_source=aura",
      "price": 99,
      "currency": "USD",
      "expiresAt": "2026-12-31T23:59:59Z"
    }
  ]
}
```

### 가격 (시작가)
| 티어 | 월 | 노출 |
|---|---|---|
| **Featured** | $499 | 도시 영상 위 카드 + 첫번째 마커 |
| **Pin** | $99 | globe 마커 + popup |
| **Listed** | $19 | 도시 패널 리스트 |

### 영업 시작
1. **본인 동네 카페/게스트하우스 5-10곳** — "한 달 무료 시범" 제안
2. 노출 데이터 (impression, click) 보여주기
3. Booking/Agoda 어필리에이트 코미션 + 직접 광고 수익 합쳐 ROI 입증

---

## 💳 트랙 2: Premium 구독 ($4.99/월)

### 셋업

**준비물**: 도메인, Stripe 계정 (한국은 Toss Payments도 가능)

**1) Stripe 계정 (10분)**
```
1. https://dashboard.stripe.com/register
2. 사업자 등록 (개인 사업자 OK)
3. 한국 은행 계좌 연결
4. Tax 설정
```

**2) Stripe 제품 만들기**
```
Dashboard → Products → Add product
- Name: "AURA Premium"
- Price: $4.99 USD recurring monthly
- Trial: 7 days (선택)
→ Copy the Price ID (price_xxxxx)
```

**3) Checkout 통합 (코드)**
간단한 옵션: **Stripe Payment Link** (코드 0줄)
```
Dashboard → Payment Links → Create
- Product: AURA Premium
- Success URL: https://aura.app/welcome.html
→ URL 복사: https://buy.stripe.com/abc123
```

이 URL을 AURA의 "Upgrade to Premium" 버튼에 연결.

**4) 구독자 식별** (가장 단순)
- Stripe → Customer Portal 활성화
- 사용자가 결제 후 Email 받음 → 그 Email을 localStorage에 저장
- AURA는 그 Email 기준으로 Premium 기능 unlock (서버 검증 X — honor system)
- 또는 더 안전하게: Cloudflare Worker로 webhook 받기

### Premium 기능 후보
- 광고 마커 제거
- 카페 모드 추가 위젯 (포모도로, 할 일, 날씨 시계)
- AI 여행 무제한 (현재는 사용자 키 필요)
- 추가 음악 채널 30개+
- 도시 영상 4K (Pexels 4K only)
- 오프라인 모드 (PWA 강화)

### 수익 예상
- 1만 MAU × 5% 전환 = 500 유료
- 500 × $4.99 = **월 $2,495**
- Stripe 수수료 3% + Pay Vat = 실수령 ~$2,200

---

## 🏨 트랙 3: B2B 카페 라이선스

### 컨셉
카페가 자기 매장 디스플레이에 AURA 띄워놓기 (BGM + 분위기 + 무료).
대신 **자기 매장 정보가 globe에 Sponsored 마커**로 노출.

### 가격
- $19/매장/월 (개인 카페)
- $99/체인/월 (5+ 매장)
- 첫 3개월 무료 (시범)

### 영업 채널
- 카페 사장 페이스북 그룹
- 인스타그램 카페 해시태그
- 직접 방문 (서울/부산 핫플)

### 매출 시뮬
- 100 매장 × $19 = **월 $1,900**
- 1년 안에 카페 체인 1-2곳 확보 시 추가 $200-500/월

---

## 🇰🇷 한국 사용자: Toss Payments (Stripe 대안)

Stripe가 한국 결제 처리 안 됨. 대안:

### Toss Payments
```
1. https://www.tosspayments.com/ 가입
2. 사업자 인증
3. 정기결제 (구독) API 사용
4. 가격: 결제금액의 3.3% (Stripe와 비슷)
```

### Patreon (가장 간단, 영업 부담 ↓)
```
1. patreon.com/aura
2. $4.99 tier 만들기
3. 후원자에게 "Premium key" 수동 발급 (이메일)
```

### Buy Me a Coffee (간단)
```
1. buymeacoffee.com/aura
2. Membership tier $4.99
3. 사용자 인증은 honor system
```

---

## 🚀 추천 순서

| 단계 | 시점 | 작업 |
|---|---|---|
| **MVP** | 지금 | Sponsored 마커 시작 (코드 됨) — 동네 카페 5곳 영업 |
| **+1주** | 사용자 100명 도달 후 | Patreon 또는 Buy Me a Coffee Premium tier |
| **+1개월** | 사용자 1천명 도달 후 | Stripe / Toss 정식 결제 + 도메인 |
| **+3개월** | 카페 매물 30곳 도달 후 | 별도 광고주 대시보드 (CMS) |

---

## ⚖️ 법적 / 세금

- **개인사업자 등록** (홈택스, 무료, 1일)
- **광고 표시 의무** — "광고", "Sponsored" 명시 (이미 코드에 있음)
- **VAT 10%** — Stripe 자동 계산 가능
- **개인정보처리방침** — privacy.html 페이지 추가 권장 (Premium 결제하면 이메일 받으니까)

---

## ⚠️ 주의

- **Stripe API key를 client-side 코드에 절대 노출 X** — Cloudflare Worker로 proxy
- **사용자 가짜 Premium key 입력 차단** — 서버 verify 권장
- **Premium 기능을 client에서만 gating하면 우회 가능** — 핵심 기능은 서버 verify
