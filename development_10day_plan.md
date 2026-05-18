# PickFit 10-Day Development Schedule
> Purpose: 10일 동안 Codex가 `tech.md`를 기준으로 순차 개발할 수 있게 만든 실행 계획서  
> Primary spec: `tech.md`  
> Supporting specs: `PickFit.md`, `design_system.md`  
> Created: 2026-05-17

---

## 0. 전문가 역할과 실행 원칙

### 자동 선택 역할
**AI 풀스택 구현 매니저**

### 왜 이 역할인가
픽핏 개발은 단순 기능 추가가 아니라, 정적 SPA를 PHP/MySQL/OpenAI/Playwright 기반 앱으로 점진 이전하는 작업이다. 10일 안에 끝내려면 매일의 산출물이 다음 날의 기반이 되어야 하며, Codex가 한 번의 작업 세션에서 읽어야 할 문서, 건드릴 파일, 쓰면 안 되는 범위, 검증 기준이 명확해야 한다.

### 판단 프로세스
1. `tech.md`의 구현 순서를 10일 단위로 나눈다.
2. 매일 "작동하는 작은 단위"를 남긴다.
3. OpenAI/Playwright처럼 외부 의존이 있는 기능은 fallback과 테스트 가능 상태를 먼저 만든다.
4. 기존 `design_system.md`의 UI 방향을 깨지 않는다.
5. 각 날짜마다 Codex에 그대로 붙여넣을 수 있는 명령 프롬프트를 제공한다.

---

## 1. 이 문서 사용법

매일 새 Codex 세션을 시작할 때 **공통 프리앰블**과 해당 날짜의 **Codex 실행 프롬프트**를 함께 붙여넣는다. Codex가 이전 작업을 이어가야 하므로, 프롬프트에는 항상 다음 4가지를 포함한다.

- 반드시 읽을 문서: `tech.md`, `PickFit.md`, `design_system.md`
- 이전 작업 기록: `WORKLOG.md`
- 오늘의 목표와 범위
- 검증 명령과 완료 기준

작업 중 Codex가 임의로 범위를 넓히면 안 된다. 특히 리디자인, 프레임워크 전환, 결제/장바구니 자동화, 무제한 크롤링은 금지한다.

### 공통 프리앰블

매일 해당 날짜 프롬프트 앞에 아래 내용을 붙인다.

```text
먼저 tech.md, PickFit.md, design_system.md, development_10day_plan.md, WORKLOG.md가 있으면 WORKLOG.md를 읽어줘.

작업 원칙:
- 오늘 Day 범위만 수행한다.
- 이전 Day가 미완료라면 오늘 작업을 시작하기 전에 미완료 원인을 짧게 보고하고, 오늘 목표를 막는 항목만 먼저 복구한다.
- 기존 사용자 변경을 되돌리지 않는다.
- 리디자인, 프레임워크 전환, 결제/장바구니 자동화, 로그인/캡차 우회 크롤링은 금지한다.
- 구현 후 가능한 검증 명령을 실제로 실행한다.
- 검증이 환경 문제로 불가능하면 어떤 명령이 왜 불가능했는지 명확히 남긴다.
- 마지막에 WORKLOG.md를 생성 또는 업데이트해 오늘 변경 사항, 검증 결과, 실패/보류 항목, 다음 시작점을 기록한다.
```

### 개발 전 30분 Pre-flight

Day 1 시작 전에 한 번만 실행한다. 이 단계는 10일 일정에 포함하지 않는다.

```text
PickFit 개발 착수 전 pre-flight만 수행해줘.

목표:
- 로컬 환경에서 PHP, Composer, Node, npm, MySQL client 사용 가능 여부를 확인한다.
- 현재 프로젝트가 git repo인지 확인한다.
- tech.md, PickFit.md, design_system.md, development_10day_plan.md 존재 여부를 확인한다.
- WORKLOG.md가 없으면 생성하고 pre-flight 결과를 기록한다.

검증 명령:
- php -v
- composer -V
- node -v
- npm -v
- mysql --version
- git status --short

제약:
- 코드 구현은 하지 않는다.
- 설치가 필요한 항목은 임의로 설치하지 말고 누락 항목과 필요한 조치만 기록한다.
```

### 재검토 결론

이 일정은 Codex가 높은 효율로 순차 개발하기에 충분히 구체적이지만, "에러 없는 완벽한 결과"를 보장하려면 다음 운영 규칙이 반드시 지켜져야 한다.

- 매일 `WORKLOG.md`를 갱신해 세션 간 맥락 손실을 줄인다.
- 외부 의존 기능은 fallback을 먼저 만든다.
- DB, npm, Composer, OpenAI, Playwright 검증이 실패하면 그날 바로 원인을 기록한다.
- 화면 변경이 있는 날은 반드시 브라우저 검증을 한다.
- 하루 작업이 과도하면 "완료 가능한 수직 단위"를 우선하고 나머지는 WORKLOG에 넘긴다.

---

## 2. 전체 10일 로드맵

| Day | 목표 | 핵심 산출물 | 주요 검증 |
|---:|---|---|---|
| 1 | 프로젝트 기반 세팅 | `public/`, `src/`, Composer/npm, PHP router skeleton | PHP 서버가 SPA/API를 응답 |
| 2 | DB 스키마와 seed | migration SQL, mock catalog seed, repository 기초 | `GET /api/products` 준비 |
| 3 | 인증/세션/CSRF | register/login/logout/me API, 최소 로그인 UI | 인증 smoke test |
| 4 | FE API client와 public 이전 | `js/api/*`, SPA asset 경로 안정화 | 기존 화면이 깨지지 않음 |
| 5 | fallback 추천 엔진 | OpenAI 없이 3개 코디 생성, loading/results API화 | 온보딩 -> 결과 3개 |
| 6 | 상세/비교/저장/피드백 | detail/comparison/saved API 연동 | 저장/피드백 refresh 유지 |
| 7 | Playwright URL 분석 | crawler CLI, URL safety, crawl job API, URL 분석 UI | 안전 URL 차단 + 샘플 수집 |
| 8 | OpenAI 추천/정규화 | strict schema, OpenAIService, GPT 추천 저장 | API key 있을 때 GPT run 저장 |
| 9 | 통합 QA/E2E | PHPUnit/API smoke/브라우저 검증 | 모바일/데스크톱 핵심 플로우 통과 |
| 10 | 하드닝/문서/최종 점검 | 오류 처리, fallback, README/runbook, 마무리 | minimum done definition 통과 |

---

## 2.5 일일 품질 게이트

각 Day는 아래 품질 게이트를 통과해야 완료로 본다.

| Gate | 기준 | 실패 시 처리 |
|---|---|---|
| Build/Run | 그날 만든 서버 또는 빌드 명령이 실행된다. | 실패 원인을 수정하거나 `WORKLOG.md`에 blocker로 남긴다. |
| Scope | 오늘 범위 밖 기능을 구현하지 않았다. | 관련 변경을 되돌리지 말고, 필요 없는 추가 변경은 다음 작업에서 정리 대상으로 기록한다. |
| Data | DB/API shape가 `tech.md`와 충돌하지 않는다. | schema/API contract를 우선 맞춘다. |
| UI | 기존 화면과 디자인 토큰을 깨지 않는다. | browser-use 검증 후 깨진 경로/class/asset만 수정한다. |
| Security | auth, CSRF, URL safety, secret handling을 약화하지 않는다. | 기능 완료보다 보안 경계를 우선한다. |
| Handoff | `WORKLOG.md`가 업데이트됐다. | 다음 Day 시작 전 반드시 보강한다. |

P0로 보는 실패:

- 앱이 전혀 실행되지 않음
- 로그인 없이 보호 API 접근 가능
- OpenAI key가 브라우저에 노출됨
- private IP/localhost URL 크롤링 허용
- 추천이 3개 미만인데 성공으로 표시됨
- 저장/피드백이 다른 사용자 데이터와 섞임

P0가 있으면 다음 Day로 넘어가지 않는다.

---

## 3. 공통 Codex 작업 규칙

### 매일 Codex에게 요구할 것

- 작업 전 `tech.md`의 관련 섹션을 먼저 읽게 한다.
- 작업 전 `WORKLOG.md`를 읽어 이전 상태를 확인하게 한다.
- `PickFit.md`, `design_system.md`의 제품/디자인 원칙을 위반하지 않게 한다.
- 기존 사용자 변경을 되돌리지 않게 한다.
- 구현 후 실제 명령으로 검증하게 한다.
- 실패한 검증은 원인과 다음 조치를 남기게 한다.
- 작업 후 `WORKLOG.md`를 업데이트하게 한다.

### 매일 금지할 것

- React/Vue/Laravel/Symfony로 임의 전환
- UI 전면 리디자인
- payment/cart/checkout 자동화
- 로그인/캡차 우회 크롤링
- OpenAI API key를 브라우저에 노출
- `.env` 값 커밋 또는 문서 출력

### 공통 완료 보고 형식

Codex 최종 답변은 매일 아래 형식을 따르게 한다.

```text
완료:
- ...

검증:
- command: result

남은 리스크:
- ...

다음 날 시작점:
- ...

[Self-Check]
- ...
```

### WORKLOG.md 형식

Codex는 매일 작업 후 아래 형식으로 `WORKLOG.md`를 생성 또는 갱신한다.

```md
# PickFit Worklog

## Day N - YYYY-MM-DD

### Completed
- ...

### Changed Files
- ...

### Verification
- `command`: pass/fail, short result

### Blocked or Deferred
- ...

### Next Start Point
- ...

### Self-Check
- ...
```

### 하루 작업 분할 기준

하루 작업이 너무 커질 경우 Codex는 아래 순서로 우선순위를 둔다.

1. 서버가 계속 실행되는 상태 유지
2. DB/API contract 안정화
3. 기존 화면이 깨지지 않는 frontend 연결
4. 브라우저 검증
5. 추가 테스트와 문서화

완료하지 못한 하위 항목은 임의로 대충 마무리하지 말고 `WORKLOG.md`의 `Blocked or Deferred`에 남긴다.

---

## 4. Day 1 - Foundation / PHP Router / Public Structure

### 목표
정적 프로젝트를 PHP 단일 서버가 서빙할 수 있는 최소 구조로 만든다. 기존 UI는 깨지지 않아야 한다.

### 작업 범위

- `composer.json`
- `package.json`
- `.env.example`
- `public/index.php`
- `public/app.html`
- `src/Bootstrap.php`
- `src/Config.php`
- `src/Http/Router.php`
- `src/Http/Request.php`
- `src/Http/Response.php`
- 기존 `index.html`, `css/`, `js/`, `assets/`, `img/`를 `public/` 구조로 이전하거나 호환 serving 처리

### Skills / MCP

- `mcp__context7__`: Composer autoload 또는 Tailwind CLI 설정이 불확실할 때만 사용.
- `browser-use:browser`: 서버가 뜬 뒤 로컬 화면 확인에 사용.

### 완료 기준

- `php -S 127.0.0.1:8000 -t public public/index.php` 실행 가능
- `/`가 SPA를 반환
- `/api/health`가 JSON 반환
- 기존 랜딩 화면이 이미지 누락 없이 표시

### Codex 실행 프롬프트

```text
tech.md, PickFit.md, design_system.md를 먼저 읽고 Day 1 작업만 수행해줘.

목표:
- 현재 정적 SPA를 PHP 단일 서버에서 서빙할 수 있는 foundation을 만든다.
- public/index.php front controller, public/app.html SPA entry, src Bootstrap/Config/Router/Request/Response skeleton을 만든다.
- /api/health JSON endpoint를 추가한다.
- 기존 UI와 asset path가 깨지지 않게 한다.

제약:
- Laravel/Symfony/React/Vue 도입 금지.
- 리디자인 금지.
- 기존 기능을 고치려 하지 말고 서버 구조만 만든다.
- 파일 이동이 필요하면 경로 깨짐을 검증한다.

필요하면 context7 MCP로 Composer/Tailwind 최신 사용법을 확인해도 된다.

검증:
- php -S 127.0.0.1:8000 -t public public/index.php
- /api/health 응답 확인
- browser-use로 http://127.0.0.1:8000 접속해 랜딩 화면과 이미지 렌더링 확인

완료 후 변경 파일, 실행한 검증, 남은 리스크, Day 2 시작점을 보고해줘.
```

---

## 5. Day 2 - Database Schema / Seed Catalog / Product API

### 목표
`mock.js`의 상품/코디 데이터를 MySQL seed로 옮기고, PHP API가 seed 상품을 읽을 수 있게 한다.

### 작업 범위

- `database/migrations/001_initial_schema.sql`
- `database/seeds/mock_catalog_seed.sql`
- `src/Database.php`
- `src/Repositories/ProductRepository.php`
- `src/Controllers/CatalogController.php`
- `GET /api/products`
- `GET /api/products/{id}`

### Skills / MCP

- `mcp__context7__`: PDO/MySQL/PHPUnit 사용법이 불확실할 때.

### 완료 기준

- MySQL schema 생성 가능
- seed 삽입 가능
- `GET /api/products`가 seed 상품 반환
- `GET /api/products/{id}`가 상세 반환

### Codex 실행 프롬프트

```text
tech.md의 Database Schema, Product API, Implementation Order를 읽고 Day 2 작업만 수행해줘.

목표:
- database/migrations/001_initial_schema.sql을 작성한다.
- js/data/mock.js의 PRODUCTS/OUTFITS 구조를 참고해 최소 seed SQL을 만든다.
- PDO 기반 Database와 ProductRepository를 구현한다.
- GET /api/products, GET /api/products/{id}를 구현한다.

제약:
- 추천 엔진, auth, crawler, OpenAI는 오늘 구현하지 않는다.
- mock.js 원본은 아직 삭제하지 않는다.
- MySQL JSON 컬럼은 tech.md 기준으로 쓰되, 검색이 필요한 핵심 필드는 일반 컬럼으로 유지한다.

검증:
- migration SQL 문법 점검
- seed SQL 문법 점검
- 가능하면 로컬 MySQL에 migration/seed 적용
- php 서버에서 GET /api/products 호출

완료 후 변경 파일, DB 적용 여부, API 응답 예시, 실패한 검증이 있다면 이유를 보고해줘.
```

---

## 6. Day 3 - Auth / Session / CSRF / Minimal Auth UI

### 목표
이메일 로그인 기반 MVP 인증을 완성한다. 추천/저장/피드백의 사용자 기반 저장을 위한 전제 작업이다.

### 작업 범위

- `src/Controllers/AuthController.php`
- `src/Services/AuthService.php`
- `src/Repositories/UserRepository.php`
- session config
- CSRF endpoint and middleware
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- 최소 로그인/회원가입 UI 또는 auth modal
- `js/api/auth.js`

### Skills / MCP

- `mcp__context7__`: PHP session, password hashing, PHPUnit 관련 확인이 필요할 때.
- `browser-use:browser`: 로그인 UI 동작 확인.

### 완료 기준

- 회원가입 후 session 생성
- 로그인/로그아웃 동작
- `GET /api/auth/me`가 현재 사용자 반환
- 잘못된 비밀번호는 generic error
- session fixation 방지를 위해 login/register 후 session id 재생성

### Codex 실행 프롬프트

```text
tech.md의 Auth API, PHP Backend Design, Security Requirements를 읽고 Day 3 작업만 수행해줘.

목표:
- 이메일 회원가입/로그인/로그아웃/me API를 구현한다.
- PHP native session, password_hash/password_verify, CSRF token endpoint를 구현한다.
- 프론트엔드에 최소 auth API wrapper와 로그인/회원가입 UI를 추가한다.

제약:
- 이메일 인증 메일은 구현하지 않는다.
- OAuth, 소셜 로그인, 비밀번호 재설정은 구현하지 않는다.
- 추천/크롤링/OpenAI는 오늘 구현하지 않는다.
- 로그인 실패 메시지는 이메일 존재 여부를 드러내지 않는다.

검증:
- register -> me -> logout -> login -> me 순서 API smoke
- 브라우저에서 회원가입/로그인/로그아웃 클릭 확인
- 기존 랜딩/온보딩 UI가 깨지지 않는지 확인

완료 후 변경 파일, API 테스트 결과, 보안상 남은 리스크를 보고해줘.
```

---

## 7. Day 4 - Frontend API Client / State Refactor / Public Asset Stability

### 목표
프론트엔드가 API 기반 전환을 받을 준비를 한다. 아직 화면 기능을 크게 바꾸지 않고, API client와 transient state 구조를 안정화한다.

### 작업 범위

- `public/js/api/client.js`
- `public/js/api/catalog.js`
- `public/js/api/recommendations.js`
- `public/js/api/saved.js`
- `state.js`에서 DB 저장 대상과 UI 임시 상태 구분
- asset path 점검
- Tailwind CLI input/output 정리

### Skills / MCP

- `mcp__context7__`: Tailwind CLI source scan 설정 확인.
- `browser-use:browser`: 기존 화면 경로/이미지 확인.

### 완료 기준

- API client가 JSON success/error를 공통 처리
- CSRF header 처리
- 기존 화면이 계속 렌더링
- Tailwind build command가 문서화 또는 동작

### Codex 실행 프롬프트

```text
tech.md의 Frontend Integration Plan, Tailwind and CSS Build, Codex Automation Readiness Review를 읽고 Day 4 작업만 수행해줘.

목표:
- fetch wrapper인 js/api/client.js를 만든다.
- auth/catalog/recommendations/saved API wrapper를 만든다.
- state.js를 UI 임시 상태 중심으로 정리하되, 오늘은 mock 기반 화면을 완전히 제거하지 않는다.
- public 구조에서 asset path와 CSS가 안정적으로 동작하게 한다.
- Tailwind CLI input.css/app.css 흐름을 준비한다.

제약:
- UI 전면 리디자인 금지.
- 추천 화면 API 전환은 Day 5에 한다.
- saved/detail/comparison 전환은 Day 6에 한다.

검증:
- npm/Tailwind build 가능 여부 확인
- php 서버 실행
- browser-use로 landing, onboarding, saved 이동 확인
- 콘솔 에러와 이미지 누락 확인

완료 후 변경 파일, 브라우저 검증 결과, 다음 전환할 화면 목록을 보고해줘.
```

---

## 8. Day 5 - Deterministic Fallback Recommendation / Loading + Results API

### 목표
OpenAI 없이도 온보딩 후 3개 코디 추천이 실제 DB/API 기반으로 나오게 한다.

### 작업 범위

- `src/Services/RecommendationService.php`
- `src/Repositories/RecommendationRepository.php`
- fallback recommendation logic
- `POST /api/recommendations`
- `GET /api/recommendations/{id}`
- `loading.js` API 전환
- `results.js` API 전환

### Skills / MCP

- `mcp__sequential_thinking__`: 추천 흐름 설계가 꼬일 때만.
- `browser-use:browser`: 온보딩 -> 결과 플로우 검증.

### 완료 기준

- OpenAI API key 없이도 3개 추천 카드 생성
- 추천 run/outfits/items가 DB에 저장
- `loading.js`가 실제 API 호출
- `results.js`가 API 응답 렌더링
- fallback warning 표시

### Codex 실행 프롬프트

```text
tech.md의 Fallback recommendation requirement, Recommendation API, Recommendation Engine Logic, Frontend Integration Plan을 읽고 Day 5 작업만 수행해줘.

목표:
- OpenAI 없이도 seeded catalog로 3개 outfit을 생성하는 deterministic fallback recommendation을 구현한다.
- POST /api/recommendations와 GET /api/recommendations/{id}를 구현한다.
- loading.js를 실제 추천 API 호출로 바꾼다.
- results.js를 API 응답 기반 렌더링으로 바꾼다.

제약:
- OpenAIService는 오늘 구현하지 않는다.
- detail/comparison/saved 화면 전환은 Day 6에 한다.
- 추천 이유는 과장하지 않고 tech.md의 trust copy 원칙을 따른다.

검증:
- 로그인 사용자로 온보딩 완료 -> loading -> results 3개 카드 확인
- DB에 recommendation_runs/recommendation_outfits/recommendation_items 저장 확인
- OpenAI 키가 없어도 앱이 작동하는지 확인
- browser-use로 모바일 폭에서 결과 카드 확인

완료 후 변경 파일, 추천 생성 방식, API 응답 예시, 검증 결과를 보고해줘.
```

---

## 9. Day 6 - Detail / Comparison / Saved / Feedback API Integration

### 목표
추천 이후 핵심 의사결정 화면을 DB/API 기반으로 연결한다.

### 작업 범위

- `detail.js`
- `comparison.js`
- `saved.js`
- saved outfit endpoints
- feedback endpoint
- `UserActionController`
- `FeedbackRepository`
- `SavedOutfitRepository`

### Skills / MCP

- `browser-use:browser`: 저장/비교/상세/피드백 플로우 확인.

### 완료 기준

- 결과 -> 상세 이동
- 결과 -> 비교 이동
- 저장 후 refresh해도 유지
- 피드백 DB 저장
- 새 추천 받기 동작 유지

### Codex 실행 프롬프트

```text
tech.md의 User action API, Frontend Integration Plan, Test Plan을 읽고 Day 6 작업만 수행해줘.

목표:
- saved_outfits, feedback_events API를 구현한다.
- detail.js, comparison.js, saved.js를 API 기반으로 전환한다.
- 저장/삭제/피드백이 DB에 persist되게 한다.
- 추천 run의 outfit IDs를 기준으로 상세와 비교를 안정적으로 조회하게 한다.

제약:
- Playwright URL 분석은 Day 7에 한다.
- OpenAI 추천은 Day 8에 한다.
- UI 디자인 방향을 바꾸지 않는다.

검증:
- results -> detail -> back
- results -> comparison -> detail
- save outfit -> refresh -> saved page 유지
- feedback submit -> DB row 확인
- browser-use로 모바일/데스크톱 최소 확인

완료 후 변경 파일, API smoke 결과, 브라우저 플로우 결과, 남은 UI 문제를 보고해줘.
```

---

## 10. Day 7 - Playwright Crawler / URL Safety / URL Analysis UI

### 목표
사용자 URL 분석을 안전하게 구현한다. 단, 반폐쇄형 카탈로그 후보 수집이라는 경계를 유지한다.

### 작업 범위

- `src/Services/UrlSafetyService.php`
- `src/Services/CrawlerService.php`
- `src/Repositories/CrawlJobRepository.php`
- `POST /api/catalog/analyze-url`
- `GET /api/catalog/crawl-jobs/{id}`
- `crawler/playwright-crawl.js`
- `crawler/adapters/generic.js`
- URL 분석 UI

### Skills / MCP

- `mcp__context7__`: Playwright 최신 API 확인 필수.
- `mcp__sequential_thinking__`: URL safety/SSRF 흐름이 복잡해질 때.
- `browser-use:browser`: URL 분석 UI 검증.

### 완료 기준

- unsafe URL 차단
- safe public URL job 생성
- Playwright가 title/meta/text/image/screenshot 추출
- crawl result를 product 후보로 저장
- UI가 분석 진행/성공/실패 상태 표시

### Codex 실행 프롬프트

```text
tech.md의 Playwright Crawling Design, URL safety, Catalog and crawl API, Security Requirements를 읽고 Day 7 작업만 수행해줘.

작업 전 context7 MCP로 Playwright Node.js의 browser/context/page.goto/screenshot/cleanup 최신 사용법을 확인해줘.

목표:
- UrlSafetyService로 SSRF 위험 URL을 차단한다.
- crawl_jobs repository와 analyze-url/poll API를 구현한다.
- crawler/playwright-crawl.js와 generic adapter를 구현한다.
- 공개 상품 페이지에서 DOM text, meta, image candidates, screenshot을 수집한다.
- 수집 결과를 products/product_media에 저장하거나 연결한다.
- 프론트엔드에 상품 URL 분석 UI를 추가한다.

제약:
- 로그인/캡차/결제/장바구니 자동화 금지.
- Playwright를 HTTP 서버로 띄우지 않는다. PHP가 CLI로 실행한다.
- 크롤링 실패가 추천 플로우를 깨면 안 된다.

검증:
- localhost/127.0.0.1/private IP URL 차단
- 정상 https URL 분석 job 성공 또는 graceful failure
- screenshot artifact 생성 확인
- URL 분석 UI 상태 확인

완료 후 변경 파일, 안전 차단 테스트 결과, 성공/실패 crawl 예시, 남은 정책 리스크를 보고해줘.
```

---

## 11. Day 8 - OpenAI Responses API / Strict Schemas / GPT Recommendation

### 목표
OpenAI API가 있을 때 GPT 기반 상품 정규화와 추천 생성을 사용하고, 없을 때 fallback으로 유지한다.

### 작업 범위

- `src/Services/OpenAIService.php`
- `src/Support/schemas/product_extraction.schema.json`
- `src/Support/schemas/recommendation.schema.json`
- strict schema conversion
- OpenAI recommendation path
- model response validation
- refusal/error handling

### Skills / MCP

- `openai-docs` skill 필수.
- `mcp__openaiDeveloperDocs__` 필수.
- `mcp__sequential_thinking__`: schema/fallback 설계가 충돌할 때.

### 완료 기준

- OpenAI 호출은 서버에서만 발생
- Structured Outputs schema 검증
- model response에 없는 product id가 있으면 reject
- API key 없으면 fallback 유지
- GPT run이 DB에 저장

### Codex 실행 프롬프트

```text
tech.md의 OpenAI / GPT Design, Structured Outputs compatibility rules, Recommendation Engine Logic을 읽고 Day 8 작업만 수행해줘.

작업 전 openai-docs skill과 mcp__openaiDeveloperDocs__를 사용해 Responses API와 Structured Outputs 최신 문서를 확인해줘.

목표:
- OpenAIService를 구현한다.
- product extraction schema와 recommendation schema를 strict schema 파일로 만든다.
- POST /api/recommendations에서 OPENAI_API_KEY가 있으면 GPT 추천을 사용하고, 없거나 실패하면 deterministic fallback으로 돌아가게 한다.
- 모델 응답을 서버에서 재검증하고, candidate에 없는 product id는 reject한다.
- refusal/invalid schema/error를 UI-safe error 또는 fallback으로 처리한다.

제약:
- OPENAI_API_KEY를 브라우저에 노출하지 않는다.
- model name은 OPENAI_MODEL env에서 읽는다.
- 가격/재고/사이즈를 hallucination하지 않는다.
- schema 예시는 그대로 복붙하지 말고 tech.md의 strict compatibility rules에 맞게 조정한다.

검증:
- OPENAI_API_KEY 없이 fallback 유지
- 가능하면 OPENAI_API_KEY 있는 환경에서 GPT recommendation run 저장 확인
- invalid model response validation unit test
- 추천 결과 3개 outfit 보장

완료 후 사용한 공식 문서 요약, 변경 파일, fallback/GPT 각각의 검증 결과, 남은 OpenAI 리스크를 보고해줘.
```

---

## 12. Day 9 - Integration QA / Tests / Browser Verification

### 목표
10일차 하드닝 전에 전체 플로우의 깨진 지점을 잡는다.

### 작업 범위

- PHPUnit unit tests
- API smoke tests
- crawler tests or fixtures
- browser verification
- bug fixes only

### Skills / MCP

- `browser-use:browser` 필수.
- `mcp__context7__`: PHPUnit/Playwright test docs가 필요할 때.
- `mcp__sequential_thinking__`: FE+BE+DB+crawler+OpenAI 복합 장애 분석 시.

### 완료 기준

- register -> login -> URL analysis -> onboarding -> recommendation -> comparison -> detail -> save -> feedback 플로우 통과
- mobile and desktop visual sanity check
- critical console error 없음
- 테스트 실패 목록 정리 또는 수정

### Codex 실행 프롬프트

```text
tech.md의 Test Plan, Minimum done definition, Error States를 읽고 Day 9 통합 QA 작업만 수행해줘.

목표:
- PHPUnit unit/API smoke 테스트를 추가하거나 보강한다.
- crawler 안전/실패 케이스 테스트를 추가한다.
- php 서버를 실행하고 browser-use로 핵심 사용자 플로우를 직접 검증한다.
- 발견한 bug만 수정한다.

제약:
- 새로운 큰 기능 추가 금지.
- 리디자인 금지.
- 테스트를 통과시키기 위해 보안 검증을 약화하지 않는다.

검증 플로우:
1. 회원가입
2. 로그인
3. 상품 URL 분석
4. 온보딩 완료
5. 추천 3개 확인
6. 비교
7. 상세
8. 저장
9. 새로고침 후 저장 유지
10. 피드백 제출

완료 후 실행한 테스트 명령, browser-use 검증 결과, 수정한 bug, Day 10에 남길 hardening 항목을 보고해줘.
```

---

## 13. Day 10 - Hardening / Docs / Final Acceptance

### 목표
앱을 "다음 사람이 실행하고 검증할 수 있는 상태"로 마무리한다.

### 작업 범위

- error copy 정리
- `.env.example` 최종화
- README 또는 RUNBOOK 작성
- setup/run/test commands 정리
- 마지막 browser verification
- `tech.md`와 구현 차이 기록
- known limitations 기록

### Skills / MCP

- `browser-use:browser`: 최종 로컬 앱 검증.
- `github:yeet`: 사용자가 PR 생성을 요청할 때만.

### 완료 기준

- fresh setup 문서가 있음
- minimum done definition 통과
- 앱 실행/테스트 명령이 명확함
- 남은 한계가 문서화됨

### Codex 실행 프롬프트

```text
tech.md의 Minimum done definition, Local Development Setup, Self-Check를 읽고 Day 10 마무리 작업만 수행해줘.

목표:
- README 또는 RUNBOOK에 설치/실행/테스트/환경변수/문제 해결 절차를 정리한다.
- .env.example이 실제 구현과 일치하는지 확인한다.
- 오류 메시지와 fallback 안내가 사용자에게 안전하게 보이는지 점검한다.
- tech.md와 실제 구현 사이의 차이가 있으면 문서에 known limitations로 남긴다.
- browser-use로 최종 핵심 플로우를 모바일/데스크톱에서 확인한다.

제약:
- 새 기능 추가 금지.
- 대규모 리팩터 금지.
- 테스트를 생략하지 않는다.

최종 검증:
- php -S 127.0.0.1:8000 -t public public/index.php
- products API
- auth API
- fallback recommendation
- saved/feedback persistence
- URL safety
- browser-use 핵심 플로우

완료 후 최종 산출물 목록, 검증 결과, 남은 리스크, 사용자가 다음에 해야 할 일을 보고해줘.
```

---

## 14. 중간에 막혔을 때 쓰는 구조화 프롬프트

### 빌드/서버가 안 뜰 때

```text
현재 PickFit 개발 중 서버/빌드가 실패했다. tech.md의 Local Development Setup과 현재 구현 파일을 읽고 원인을 찾아 수정해줘.

반드시:
- 실패 명령을 다시 실행해 재현한다.
- 로그를 근거로 원인을 분류한다.
- 최소 수정만 한다.
- 수정 후 같은 명령으로 재검증한다.
- 관련 없는 리팩터는 하지 않는다.

실패 명령/출력:
[여기에 붙여넣기]
```

### API가 실패할 때

```text
PickFit API가 실패했다. tech.md의 API Contract, Error States, PHP Backend Design을 기준으로 디버깅해줘.

반드시:
- route 매칭, request JSON parsing, auth/session/CSRF, repository, DB query 순서로 점검한다.
- 브라우저에 raw exception을 노출하지 않는다.
- API 응답 shape을 tech.md와 맞춘다.
- 수정 후 API smoke를 다시 실행한다.

실패 endpoint와 응답:
[여기에 붙여넣기]
```

### 화면이 깨질 때

```text
PickFit 화면이 깨졌다. design_system.md와 tech.md의 Frontend Integration Plan을 읽고 UI를 복구해줘.

반드시:
- 기존 CSS class와 asset path를 먼저 확인한다.
- 리디자인하지 않는다.
- 모바일 480px 이하와 데스크톱 중앙 정렬을 확인한다.
- browser-use로 스크린샷/동작 검증을 한다.

문제 화면:
[화면명/증상]
```

### OpenAI 추천이 실패할 때

```text
OpenAI 추천 생성이 실패했다. openai-docs skill과 mcp__openaiDeveloperDocs__로 Responses API / Structured Outputs 최신 문서를 확인한 뒤 수정해줘.

반드시:
- OPENAI_API_KEY가 없으면 fallback으로 동작해야 한다.
- strict schema와 서버 validation을 분리해서 점검한다.
- candidate에 없는 product id는 reject한다.
- raw model output을 브라우저에 노출하지 않는다.

실패 로그:
[여기에 붙여넣기]
```

### Playwright 크롤링이 실패할 때

```text
Playwright URL 분석이 실패했다. context7 MCP로 Playwright Node.js 문서를 확인하고 tech.md의 Playwright Crawling Design과 URL safety 기준으로 수정해줘.

반드시:
- SSRF safety를 약화하지 않는다.
- login/captcha/cart/checkout 자동화는 하지 않는다.
- context/browser/page close가 finally에서 보장되는지 확인한다.
- 실패 시 crawl_jobs에 안전한 error_code/error_message를 저장한다.

실패 URL/로그:
[여기에 붙여넣기]
```

---

## 15. 매일 작업 전 체크리스트

- [ ] 오늘 Day 번호와 목표를 확인했다.
- [ ] `tech.md` 관련 섹션을 읽게 했다.
- [ ] `PickFit.md`, `design_system.md`의 제품/디자인 원칙을 지키게 했다.
- [ ] 오늘 범위 밖 기능을 금지했다.
- [ ] 필요한 skill/MCP만 쓰게 했다.
- [ ] 검증 명령과 완료 기준을 프롬프트에 포함했다.

---

## 16. 매일 작업 후 체크리스트

- [ ] 변경 파일 목록을 받았다.
- [ ] 실행한 테스트/검증 명령을 받았다.
- [ ] 실패한 검증이 있으면 이유를 받았다.
- [ ] 다음 날 시작점을 받았다.
- [ ] 남은 리스크가 문서화됐다.
- [ ] 화면 작업이 있었다면 browser-use 검증이 있었다.

---

## 17. 최종 성공 기준

10일 후 성공 상태는 다음이다.

- PHP 서버로 앱이 실행된다.
- 이메일 회원가입/로그인/로그아웃이 된다.
- MySQL seed 상품이 API로 조회된다.
- OpenAI 없이도 fallback 추천 3개가 나온다.
- OpenAI API key가 있으면 GPT 추천이 저장된다.
- 상세/비교/저장/피드백이 DB 기반으로 동작한다.
- 사용자 URL 분석은 안전하게 차단/성공/실패 상태를 처리한다.
- 모바일/데스크톱에서 핵심 플로우가 깨지지 않는다.
- 설치/실행/테스트 문서가 있다.

---

## 18. Self-Check

- 10일 일정은 MVP 완성을 목표로 하지만, 로컬 환경의 PHP/MySQL/Node/OpenAI key 준비 상태에 따라 Day 7-9 작업량이 늘어날 수 있다.
- 사용자 URL 분석은 대상 사이트 정책에 따라 성공률이 달라질 수 있으므로, Day 7의 완료 기준은 "모든 쇼핑몰 성공"이 아니라 "안전한 job 처리와 최소 1개 공개 상품형 페이지 성공"으로 둔다.
- OpenAI API key가 없을 수 있으므로 fallback 추천을 Day 5에 먼저 구현하도록 배치했다.
