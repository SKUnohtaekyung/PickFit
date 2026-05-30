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

작업 중 Codex가 임의로 범위를 넓히면 안 된다. 특히 리디자인과 프레임워크 전환은 금지한다.

### 공통 프리앰블

매일 해당 날짜 프롬프트 앞에 아래 내용을 붙인다.

```text
먼저 tech.md, PickFit.md, design_system.md, development_10day_plan.md, WORKLOG.md가 있으면 WORKLOG.md를 읽어줘.

작업 원칙:
- 오늘 Day 범위만 수행한다.
- 이전 Day가 미완료라면 오늘 작업을 시작하기 전에 미완료 원인을 짧게 보고하고, 오늘 목표를 막는 항목만 먼저 복구한다.
- 기존 사용자 변경을 되돌리지 않는다.
- 리디자인과 프레임워크 전환은 금지한다.
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

---

## 19. Day 5 진입 전 개발 주의사항 - 2026-05-27 보강

> 목적: Day 4 종료 시점의 실제 구현 상태와 검토 결과를 Day 5 개발자가 바로 이어받을 수 있도록 정리한다.
> Day 5의 핵심은 OpenAI 없이도 동작하는 deterministic fallback recommendation API를 먼저 완성하는 것이다.

### 19.1 Day 4 종료 시점 현재 상태

- PHP 서버와 SPA는 `public/index.php`를 통해 같은 origin에서 동작한다.
- `GET /api/health`, `GET /api/csrf`, auth API, `GET /api/products`, `GET /api/products/{id}`는 구현되어 있다.
- `GET /api/products`는 `category`, `situation`, `style`, `maxPrice`, `limit`, `cursor` query를 받는다.
- `public/js/api/client.js`는 JSON, CSRF, timeout, same-origin credentials, normalized error를 처리한다.
- `public/js/api/recommendations.js`는 Day 5 endpoint를 호출할 준비가 되어 있으며 request body는 `{ conditions, sourceProductIds }` 형태다.
- `public/js/utils/state.js`에는 `setRecommendations(recommendations, source)`가 있으며 Day 5 API 연결 시 반드시 `source = 'api'` 또는 `source = 'fallback-api'`를 명시해야 한다.
- `loading.js`는 아직 mock `OUTFITS`를 사용한다. Day 5 backend endpoint가 통과하기 전에는 이 화면을 API 호출로 바꾸지 않는다.
- saved/feedback API wrapper는 있지만 backend endpoint와 screen wiring은 Day 6 범위다.
- URL analysis/crawler는 Day 7 범위다.

### 19.2 Day 5 시작 전 필수 선행 수정

1. `public/js/utils/state.js` 기본 상태 깊은 복사 보강
   - 현재 `defaultState`에 중첩 객체가 있고, 얕은 복사만 쓰면 `dataSources`, `apiCache`, `onboarding` 기본 객체가 런타임 변경에 오염될 수 있다.
   - `cloneDefaultState()` 같은 작은 helper를 만들고 `onboarding`, `dataSources`, `apiCache.catalog`를 새 객체로 복사한다.
   - 검증: 기존 localStorage가 있어도 landing -> onboarding -> loading -> results mock flow가 유지되어야 한다.

2. recommendation request contract 고정
   - frontend wrapper는 이미 `{ conditions, sourceProductIds }`를 보낸다.
   - backend `POST /api/recommendations`도 반드시 같은 shape만 받는다.
   - `conditions`에는 onboarding state를 넣고, `sourceProductIds`는 optional array로 처리한다.

3. recommendation output adapter 전략 결정
   - 기존 results/detail/comparison/saved 화면은 mock `OUTFITS`, `getOutfit()`, `getProduct()` shape에 강하게 묶여 있다.
   - Day 5에서 화면을 안정적으로 연결하려면 backend response를 현재 화면 shape로 변환하는 adapter를 먼저 둔다.
   - 추천 adapter 후보 파일: `public/js/api/recommendations.js` 또는 새 파일 `public/js/api/recommendationAdapter.js`.
   - adapter는 backend outfit을 현재 UI가 기대하는 `id`, `title`, `summary`, `framingLabel`, `totalPrice`, `reasons`, `risks`, `reviewEvidence`, `items[{ slot, productId, alternatives }]` 구조로 변환한다.

### 19.3 Day 5 구현 권장 phase

#### Phase 0 - Pre-flight / Day 4 회귀 확인

Skills:
- `pickfit-backend-foundation`
- `pickfit-integration-check`

Subagents:
- `pickfit_backend_mapper`
- `pickfit_contract_reviewer`

작업:
- MySQL과 PHP 서버를 시작한다.
- Day 4에서 통과한 health/auth/catalog smoke를 다시 실행한다.
- `state.js` 깊은 복사 보강을 먼저 적용한다.

검증:

```powershell
composer test
Get-ChildItem -Recurse -Include *.php public,src | ForEach-Object { php -l $_.FullName }
Get-ChildItem -Recurse -Include *.js public\js | ForEach-Object { node --check $_.FullName }
npm.cmd run build
Invoke-RestMethod -Uri http://127.0.0.1:8002/api/health
Invoke-RestMethod -Uri "http://127.0.0.1:8002/api/products?limit=3"
Invoke-RestMethod -Uri "http://127.0.0.1:8002/api/products?limit=10&situation=office&style=clean"
```

완료 기준:
- 기존 Day 4 기능이 깨지지 않는다.
- MySQL seed products가 9개 유지된다.
- 임시 auth smoke user를 만들었다면 반드시 cleanup한다.

#### Phase 1 - Recommendation domain skeleton

Skills:
- `pickfit-backend-foundation`
- 필요 시 `pickfit-architecture-review`

작업 파일:
- `src/Controllers/RecommendationController.php`
- `src/Services/RecommendationService.php`
- `src/Repositories/RecommendationRepository.php`
- `src/Repositories/ProductRepository.php`
- `src/Bootstrap.php`

작업:
- `POST /api/recommendations`
- `GET /api/recommendations/{id}`
- recommendation run/outfit/item 저장을 위한 repository skeleton
- 인증이 필요한 endpoint인지 명확히 한다. MVP 계약상 추천 결과 persistence는 user 기반이므로 로그인 요구를 기본으로 한다.

주의:
- OpenAIService를 아직 만들지 않는다.
- GPT 호출을 넣지 않는다.
- UI 화면을 아직 API로 전환하지 않는다.
- endpoint가 비어 있어도 raw PHP exception을 노출하지 않는다.

검증:
- 미로그인 요청은 `401 unauthenticated`.
- 로그인 후 잘못된 body는 `422 validation_failed`.
- catalog coverage 부족은 `409 low_catalog_coverage`.
- 내부 실패는 `500 recommendation_failed`.

#### Phase 2 - Recommendation candidate query

Skills:
- `pickfit-backend-foundation`

작업:
- public catalog list를 그대로 recommendation candidate source로 쓰지 않는다.
- recommendation 전용 candidate mapper/query를 만든다.
- candidate에는 최소한 아래 필드를 포함한다.

필수 candidate fields:
- `id`
- `categoryMain`
- `categorySub`
- `brandName`
- `productName`
- `priceSale`
- `heroImageUrl`
- `fitType`
- `seasonality`
- `colorFamily`
- `styleTags`
- `occasionTags`
- `bodyTypeNotes`
- `dataQualityScore`
- review summary 또는 evidence로 쓸 수 있는 대표 review 정보

주의:
- `ProductRepository::toListItem()`를 무리하게 확장해서 public catalog response를 비대하게 만들지 않는다.
- 추천 전용 method 예: `findRecommendationCandidates(array $conditions, array $sourceProductIds = [])`.

검증:
- `office + clean` 조건에서 top/bottom/shoes 후보가 나온다.
- `travel + casual + maxPrice` 조건에서 후보가 나온다.
- 후보가 부족하면 성공처럼 꾸미지 않고 `low_catalog_coverage`를 반환한다.

#### Phase 3 - Deterministic fallback assembly

Skills:
- `pickfit-backend-foundation`

작업:
- OpenAI 없이 seeded catalog만으로 3개 outfit을 만든다.
- 각 outfit은 가능한 한 `top + bottom + shoes`를 포함한다.
- `outer`는 조건/후보가 맞을 때 선택적으로 추가한다.
- budget, situation, style, stock_status, avoidances를 반영한다.
- confidence는 fallback임을 드러내도록 낮거나 중간 수준으로 둔다.

출력 shape:
- backend 저장용 normalized shape와 frontend adapter용 shape를 분리해도 된다.
- API response에는 run id와 3개 outfits를 포함한다.
- 각 outfit에는 이유, 근거, 주의점, 총액, 구성 item이 있어야 한다.

금지:
- 3개 미만인데 성공으로 응답하지 않는다.
- 존재하지 않는 product id를 만들어내지 않는다.
- 가격/사이즈/배송 정보를 추측해서 과장하지 않는다.
- OpenAI key가 없다고 실패시키지 않는다.

검증:
- 로그인 사용자가 onboarding 조건으로 `POST /api/recommendations` 호출 시 3개 outfit 반환.
- DB에 `recommendation_runs`, `recommendation_outfits`, `recommendation_items`가 저장된다.
- `GET /api/recommendations/{id}`가 같은 run을 다시 조회한다.

#### Phase 4 - Loading/results API wiring

Skills:
- `pickfit-ui-audit`
- `pickfit-integration-check`

Subagents:
- `pickfit_frontend_mapper`
- `pickfit_contract_reviewer`
- `pickfit_browser_verifier`

작업:
- backend endpoint와 fallback 저장 검증이 끝난 뒤에만 `loading.js`를 API 호출로 전환한다.
- `state.setRecommendations(apiOutfits, 'fallback-api')` 또는 `state.setRecommendations(apiOutfits, 'api')`를 사용한다.
- backend response adapter를 통해 현재 results 화면 shape로 변환한다.
- API 실패 시 mock으로 조용히 성공 처리하지 않는다. 사용자에게 retry-safe error를 보여주거나 onboarding으로 되돌린다.

주의:
- detail/comparison은 아직 mock lookup에 묶여 있으므로, Day 5에서 같이 연결하려면 adapter 또는 state lookup helper를 반드시 먼저 만든다.
- 가장 안전한 방식은 `state.recommendations` 안에서 detail/comparison이 필요한 product data를 모두 찾을 수 있게 하는 것이다.

검증:
- onboarding -> loading -> results 3 cards
- result card image가 빈 `src`가 아니어야 한다.
- detail로 이동했을 때 첫 mock outfit으로 fallback되는 버그가 없어야 한다.
- comparison으로 이동했을 때 API outfit id가 유지되어야 한다.

#### Phase 5 - Day 5 final integration

Skills:
- `pickfit-integration-check`
- `pickfit-ui-audit`

Subagents:
- `pickfit_backend_mapper`
- `pickfit_contract_reviewer`
- `pickfit_browser_verifier`
- 필요 시 `pickfit_integration_reviewer`

검증 명령:

```powershell
composer test
Get-ChildItem -Recurse -Include *.php public,src | ForEach-Object { php -l $_.FullName }
Get-ChildItem -Recurse -Include *.js public\js | ForEach-Object { node --check $_.FullName }
npm.cmd run build
```

API smoke:

```text
1. csrf
2. register 또는 login
3. POST /api/recommendations with { conditions, sourceProductIds }
4. GET /api/recommendations/{id}
5. DB count 확인: recommendation_runs / recommendation_outfits / recommendation_items
```

Browser smoke:
- mobile width 390 또는 480
- landing -> onboarding -> loading -> results
- results card 3개
- image broken 없음
- console critical error 없음
- refresh 후 최소한 run id 기반 복구 또는 안전한 fallback 안내

### 19.4 Day 5에서 절대 하지 말 것

- OpenAI integration을 먼저 구현하지 않는다. deterministic fallback이 먼저다.
- saved/feedback persistence를 Day 5에 끼워 넣지 않는다. Day 6 범위다.
- URL crawling이나 Playwright를 Day 5에 넣지 않는다. Day 7 범위다.
- results/detail/comparison UI를 redesign하지 않는다.
- root `index.html` 기반으로 검증하지 않는다. 검증 표면은 `public/index.php`가 serving하는 `public/app.html`이다.
- browser에서 OpenAI API key를 사용하지 않는다.
- endpoint가 실패했는데 mock result로 성공처럼 숨기지 않는다.

### 19.5 Day 5 완료 기준

- `OPENAI_API_KEY` 없이도 로그인 사용자가 onboarding을 끝내면 3개 추천 카드가 나온다.
- 추천 결과가 DB에 저장된다.
- `GET /api/recommendations/{id}`로 저장된 추천 run을 재조회할 수 있다.
- API response는 존재하는 product id만 참조한다.
- 후보 부족, validation 실패, 미로그인, 내부 실패가 typed error로 구분된다.
- existing public SPA layout과 asset path가 깨지지 않는다.
- `WORKLOG.md`에 변경 파일, 검증 명령, 실패/보류 항목, Day 6 시작점을 남긴다.

### 19.6 Day 5 남은 설계 리스크

- `state.js` 깊은 복사 보강을 빼먹으면 source metadata가 예기치 않게 오염될 수 있다.
- backend recommendation outfit shape와 현재 화면 mock shape가 다르므로 adapter 없이 연결하면 detail/comparison이 잘못된 outfit을 보여줄 수 있다.
- public catalog list response에는 추천 scoring에 필요한 tag/evidence가 부족하므로 recommendation 전용 candidate mapper가 필요하다.
- catalog coverage가 낮을 때 3개 추천을 억지로 만들면 신뢰 UX가 깨진다. 부족하면 `low_catalog_coverage`로 처리한다.
- 현재 browser plugin 검증이 환경에 따라 불안정할 수 있으므로, browser 검증 실패 시 Chrome headless 또는 HTTP/static checks를 보조 검증으로 남긴다.

---

## 20. Day 7 진입 전 개발 주의사항 - 2026-05-28 보강

> 목적: Day 7 (Playwright Crawler / URL Safety / URL 분석 UI)을 보안 사고 없이, MVP 경계를 유지하면서 완성하기 위한 phase 단위 실행 계획.
> 핵심 원칙: **SSRF 방어가 먼저, 추출은 나중**. 크롤링은 사용자 의지로 시작되는 단일 URL 분석 작업이지 자동화 권리 행사가 아니다.
> 선결 조건: §20.0의 Day 5/6 회수 작업을 먼저 끝내야 Day 7 작업이 회귀 위험 없이 진행된다.

### 20.0 Day 5/6 회수 작업 (Day 7 시작 전 반드시 정리)

> Day 5와 Day 6의 코드 산출물은 대부분 들어가 있으나, `WORKLOG.md`가 Day 4에서 멈춰 있고 saved/comparison 경로에 shape 불일치가 남아 있다. Day 7 Phase 0 회귀 점검에 들어가기 전에 아래 P0 항목을 먼저 닫는다.

#### P0 - 즉시 정리

1. **`WORKLOG.md`에 Day 5, Day 6 항목 백필**
   - Skill: 별도 없음. §3의 표준 포맷(Completed / Changed Files / Verification / Blocked or Deferred / Next Start Point / Self-Check)을 그대로 사용한다.
   - 기록 근거: git diff, 신규 파일(`src/Controllers/RecommendationController.php`, `src/Controllers/UserActionController.php`, `src/Services/RecommendationService.php`, `src/Repositories/{Recommendation,SavedOutfit,Feedback}Repository.php`, `src/Support/{PublicId,JsonColumn}.php`, `database/migrations/002_outfit_display_fields.sql`, `public/js/api/{contracts,recommendationAdapter,userActions}.js`, `public/js/utils/resolvers.js`), 수정 화면(`loading.js`, `results.js`, `comparison.js`, `detail.js`, `saved.js`, `state.js`).
   - Subagent: 프로젝트 `pickfit_backend_mapper`로 변경 파일 검증 후 작성한다.

2. **Saved entry → detail/comparison 진입 시 product shape 어댑팅**
   - 증상: `SavedOutfitRepository::listForUser`가 `items[].product`에 `brandName/productName/heroImageUrl/priceSale` 같은 backend 카멜케이스를 채워주는데, `detail.js`와 `comparison.js`는 `product.brand/name/image/price`라는 UI 카멜케이스를 기대한다. saved 카드에서 "보기"를 누르면 product 표시가 깨진다.
   - 수정 위치 옵션 A: `public/js/api/userActions.js::syncSavedFromApi`에서 받은 entries 각각을 `adaptSavedOutfitEntry`로 정규화한 뒤 `state.replaceSavedFromApi`에 전달.
   - 수정 위치 옵션 B: `public/js/utils/resolvers.js::resolveOutfitFromSaved`에서 항상 어댑터를 통과시키기.
   - 권장: 옵션 A (단일 진입점, 어댑터 출력이 캐시되어 다중 진입 시 비용 절감).
   - Skill: `pickfit-integration-check`, `pickfit-ui-audit`
   - Subagent: `pickfit_contract_reviewer`로 어댑팅 후 shape이 results.js와 같은지 비교.

3. **`detail.js`의 alternatives mock 조회 제거 또는 우회**
   - 증상: `item.alternatives?.map((id) => getMockProduct(id))`가 backend public_id로 mock 스키마를 조회해 항상 빈 결과를 만든다.
   - 단기 수정: `recommendationAdapter.adaptItem`에서 `alternatives`에 product summary(brand/name/image) 미니 객체를 만들어 둔다. 또는 detail.js의 alternative 카운트 표시만 유지하고 카드 클릭 시 "다음 단계에서 확장" 토스트를 유지한다.
   - 장기 수정: backend가 `alternativeProductIds`에 더해 `alternativeProducts` summary를 함께 반환하도록 `RecommendationService::shapeResponse` 확장. 단, Day 8 OpenAI 통합 시 schema가 다시 바뀔 수 있으므로 단기 수정만 적용해 깨짐을 막는 것이 안전.

#### P1 - Day 7과 병행 가능

4. **결과 화면 새로고침 복구 (`lastRunId` 재호출)**
   - 증상: `state.lastRunId`가 localStorage에 남아도 `results.js`는 `GET /api/recommendations/{id}`를 호출하지 않는다. 새로고침하면 추천이 사라지고 mock fallback으로 떨어진다.
   - 수정: `results.js` 진입 시 `state.recommendations`가 비어 있고 `state.lastRunId`가 있으면 `fetchRecommendationRun(lastRunId)` → adapter → `state.setRecommendations(..., 'api-rehydrated')` 후 렌더.
   - `public/js/api/recommendations.js`에 `fetchRecommendationRun` wrapper가 없으면 추가.
   - Skill: `pickfit-integration-check`
   - Subagent: `pickfit_browser_verifier`로 새로고침 → 결과 카드 유지 검증.

5. **`recommendationAdapter`의 fabricated 필드 정리 (신뢰 UX)**
   - 대상: `shipping.label = '무료 / 2일'`, `returnPolicy.label = '무료 / 7일 이내'`, `reviewCount || 100`, `rating || 4.3`, `reviewSummary || '리뷰 요약 데이터를 준비 중이에요.'`
   - 위반 원칙: [PickFit.md §10.4](PickFit.md) "Trust over automation theater" — 모르는 값은 만들지 않는다.
   - 수정: 백엔드가 값을 안 보내면 UI에서 "정보 부족" 또는 해당 행 자체를 숨김. 하드코딩된 기본값은 모두 제거하거나 명시적으로 "예시" 라벨을 붙인다.
   - Skill: `pickfit-ui-audit` (신뢰 UX 카피 검토)
   - Subagent: `pickfit_browser_verifier`로 카드 노출 컴포넌트별 fallback 카피 확인.

6. **size-run 추정 카피 제거**
   - 위치: `recommendationAdapter.adaptProduct` L113-115.
   - 현재: `fitType === 'oversized' || 'wide'` → `'한 치수 다운 권장'`, 그 외 → `'정사이즈'`.
   - 문제: 리뷰 데이터 없이 단정. PickFit.md "body type 관련 표현은 단정하지 않는다" 원칙 위반.
   - 수정: 백엔드 `reviews.size_runs` 집계 결과가 있을 때만 표시, 없으면 "사이즈 정보 보강 중"로 둔다.

7. **`loading.js` mock-fallback silent path 정리**
   - 위치: L164-169 — API 실패/타임아웃 시 `OUTFITS` mock을 결과로 채우고 토스트만 띄움.
   - §19.4 원칙: "endpoint가 실패했는데 mock result로 성공처럼 숨기지 않는다"와 정확히 충돌.
   - 수정: 실패 시 결과 화면으로 넘기지 말고, 사용자에게 "다시 시도" 또는 "조건 수정" CTA를 보여주는 에러 상태로 이동. mock은 dev `APP_ENV=local` 일 때만 허용하거나, 완전히 제거.
   - Skill: `pickfit-ui-audit`

#### P2 - Day 10 hardening까지 유예 가능

8. **게스트 모드 정책 결정 (`PickFit.md §31.11` open question)**
   - 현재: `POST /api/recommendations`가 로그인 필수. 미로그인 사용자는 landing으로 되돌아감.
   - 결정 필요: 첫 사용자 체험을 위해 익명 추천을 허용할지 (저장/피드백만 로그인 필수). MVP 의사결정 사항으로 product 측에 에스컬레이션.

9. **CSRF 자동 재시도 실패 시 사용자 메시지**
   - 현재 `client.js`는 403 forbidden을 받으면 토큰 클리어 후 1회 재시도. 재시도까지 실패하면 generic "보안 토큰이 만료됐어요" 토스트.
   - 더 자세한 가이드 카피 추가 (예: "잠시 후 다시 시도하거나 새로고침 해주세요").

#### Day 5/6 회수 완료 게이트

회수 후 §3 표준 포맷으로 `WORKLOG.md`에 다음 4개 entry를 추가/기록한다.

```text
## Day 5 - Deterministic Fallback Recommendation - YYYY-MM-DD (백필)
## Day 6 - Detail/Comparison/Saved/Feedback API - YYYY-MM-DD (백필)
## Day 5/6 회수 작업 - 2026-05-28 (P0/P1 정리)
## Day 7 Pre-flight - 2026-05-XX (Day 7 시작 직전)
```

회수 게이트 검증:

```powershell
composer test
Get-ChildItem -Recurse -Include *.php public,src | ForEach-Object { php -l $_.FullName }
Get-ChildItem -Recurse -Include *.js public\js | ForEach-Object { node --check $_.FullName }
npm.cmd run build
# saved → detail → comparison shape 회귀 (브라우저)
# 새로고침 후 lastRunId 복구 회귀 (브라우저)
# loading 실패 경로 (네트워크 오프라인) → mock으로 숨기지 않는지 확인
```

---

### 20.1 Day 6 종료 시점 현재 상태 (실측 기준)

- PHP 서버와 SPA는 `public/index.php`를 통해 같은 origin에서 동작한다.
- 인증, CSRF, rate limit (auth + recommendation), 카탈로그 API, 추천 생성/조회 API, saved outfit GET/POST/DELETE, feedback POST가 모두 구현되어 [src/Bootstrap.php](src/Bootstrap.php)에 라우트 등록되어 있다.
- 추천 fallback 엔진은 [src/Services/RecommendationService.php](src/Services/RecommendationService.php)에 situation/body-type/value-focused + alternate 4가지 전략으로 구현되어 있고 `low_catalog_coverage`를 typed error로 분기한다.
- DB 마이그레이션은 001(초기 스키마), 002(outfit display fields: framing_label, reasons_json, review_evidence)까지 적용됨. crawl_jobs 테이블은 001에 이미 들어 있어 Day 7에 별도 마이그레이션 불필요.
- 프론트엔드 어댑터 (`recommendationAdapter.js`, `resolvers.js`)와 사용자 액션 동기화 (`userActions.js`)가 자리 잡았다.
- `.env.example`에 `NODE_BINARY`, `PLAYWRIGHT_CRAWLER_PATH`, `CRAWL_TIMEOUT_SECONDS`, `CRAWL_ARTIFACT_ROOT`, `CRAWL_MAX_TEXT_CHARS`, `CRAWL_MAX_IMAGE_COUNT`, `RATE_LIMIT_CRAWL_PER_HOUR`가 미리 정의되어 있다.
- `src/Support/PublicId.php`가 존재 — crawl job public_id 생성에 재사용.
- 미해결: §20.0의 P0/P1 항목, Playwright npm 의존성 미설치, `storage/crawls/` 생성/회수 정책 미정.

### 20.2 Day 7 시작 전 필수 선행 수정

1. **Node 환경 확인 후 Playwright 의존성 결정**
   - 확인 대상: `node -v`, npm 디스크 여유, 회사망 프록시 여부.
   - Playwright Chromium 다운로드 약 ~170MB.
   - `package.json`에 추가할 패키지는 **`playwright`** (런타임 API만 필요, `@playwright/test`는 불필요).

2. **`storage/crawls/` 생성 정책 확정**
   - PHP가 잡 생성 시 `storage/crawls/{public_id}/`를 만들고 권한을 검사한다.
   - 디렉토리 생성 실패는 잡을 `failed`로 전이하고 raw exception을 노출하지 않는다.

3. **URL 검증 책임 경계 합의**
   - PHP `UrlSafetyService`는 **DNS resolution까지** 책임지고 IP까지 화이트리스트 검사한다.
   - 단순 정규식만으로는 SSRF에 무력. `gethostbynamel()` 또는 `dns_get_record()`로 모든 A/AAAA 레코드를 확인한다.
   - Playwright는 navigation 후 `page.url()`로 최종 URL을 재검증한다 (redirect 우회 차단).

4. **Rate limiter 키 네임스페이스**
   - 기존 `auth:*`, `rec:*`와 충돌 없게 `crawl:{userId}:{period}` 사용.
   - 익명 사용자는 차단 (인증 필수).

5. **proc_open 인자 전달 정책 (Windows 우선)**
   - PowerShell escape 이슈 회피: PHP `proc_open()`에 **배열 형태**(`['node', $script, '--job-id', $id, '--url', $url, ...]`) 사용.
   - 문자열 concat은 절대 금지 ([tech.md §9.6](tech.md)).

### 20.3 Day 7 구현 권장 phase

#### Phase 0 - Pre-flight / Day 4-6 회귀 확인 + Day 5/6 회수 종료 확인

**Skills**
- 프로젝트: `pickfit-backend-foundation`, `pickfit-integration-check`
- Claude Code: `run` (앱 띄우기), `verify` (smoke 확인)

**Agents / Subagents**
- `Explore` (Claude Code) — 신규 추가될 `crawler/*` 위치와 충돌 파일 빠른 점검
- 프로젝트: `pickfit_backend_mapper`, `pickfit_contract_reviewer` — Day 5/6 회수 검증

**작업**
- §20.0 회수 작업이 완료되었는지 확인 (특히 P0 3건)
- MySQL, PHP 서버, npm 빌드 회복
- Day 4-6 smoke (health → csrf → register → login → products → recommendations → saved → feedback)
- `npm install playwright` + `npx playwright install chromium --with-deps`
- `storage/crawls/`, `storage/rate-limits/` 권한 확인

**검증 (PowerShell)**

```powershell
composer test
Get-ChildItem -Recurse -Include *.php public,src | ForEach-Object { php -l $_.FullName }
Get-ChildItem -Recurse -Include *.js public\js | ForEach-Object { node --check $_.FullName }
npm.cmd run build
node -e "require('playwright').chromium.executablePath()"
```

**완료 기준**
- §20.0 회수 P0 3건 모두 닫힘
- Day 6까지 smoke 통과
- Playwright Chromium 바이너리 경로 출력
- crawl 관련 새 파일이 아직 없음을 확인

#### Phase 1 - UrlSafetyService (SSRF 방어 우선 구현)

> **이 phase가 가장 위험. 보안 검토를 코드 작성과 동시에 진행한다.**

**Skills**
- 프로젝트: `pickfit-backend-foundation`
- Claude Code: `security-review` (구현 직후 즉시 실행)

**Agents / Subagents**
- `Plan` (Claude Code) — IPv4/IPv6 차단 룰 매트릭스 사전 설계
- `general-purpose` — SSRF 우회 패턴 (DNS rebinding, 0.0.0.0, IPv4-mapped IPv6, 8진/16진/long-form IP) 조사

**작업 파일**
- `src/Services/UrlSafetyService.php` (신규)
- `src/Support/IpRangeChecker.php` (선택, UrlSafetyService 안으로 흡수해도 됨)

**구현 항목**
- URL parsing: `parse_url()` + 호스트 punycode 정규화
- Scheme 화이트리스트: `http`, `https`만. `file:/ftp:/data:/javascript:/gopher:`, 빈 scheme 모두 차단
- 길이 cap: 2048자
- credentials 포함(`user:pass@host`) 차단
- 포트 검증: 22, 25, 3306 등 비-HTTP 포트 차단 (기본 허용 80, 443, 8080, 8443)
- 호스트 DNS 해석: `dns_get_record($host, DNS_A | DNS_AAAA)` — **모든** 레코드가 안전해야 통과
- IP 차단 범위:
  - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `224.0.0.0/4`, `240.0.0.0/4`
  - IPv6: `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, IPv4-mapped `::ffff:0:0/96` 안의 차단 범위
- 결과 객체: `{ok: bool, reason?: string, normalizedUrl?: string, resolvedHost?: string}`

**검증**
- 표 기반 단위 테스트 (PHPUnit 미도입 시 임시 `php -r` 스크립트):

```
https://example.com           → ok
http://127.0.0.1              → blocked (loopback)
http://localhost              → blocked (loopback after DNS)
http://10.0.0.1               → blocked (private)
http://[::1]                  → blocked (ipv6 loopback)
http://user:pw@example.com    → blocked (credentials)
file:///etc/passwd            → blocked (scheme)
http://0.0.0.0                → blocked (any)
http://2130706433             → blocked (long-form 127.0.0.1)
```

- **Claude Code `security-review` skill을 이 phase 종료 직후 실행**해 SSRF 우회 가능성을 독립 감사.

#### Phase 2 - CrawlJobRepository + Support 확장

**Skills**
- 프로젝트: `pickfit-backend-foundation`

**Agents / Subagents**
- 별도 필요 없음 (Repository 패턴은 기존 `ProductRepository`, `RecommendationRepository`와 동일).

**작업 파일**
- `src/Repositories/CrawlJobRepository.php` (신규)
- `src/Support/PublicId.php` 재사용

**구현 항목**
- `createQueued(int $userId, string $inputUrl, string $normalizedUrl, string $sourceDomain, string $adapterName): array`
- `markRunning(int $jobId): void`
- `markSucceeded(int $jobId, array $rawResult, string $artifactDir, ?int $productId): void`
- `markFailed(int $jobId, string $errorCode, string $errorMessage): void`
- `markBlocked(int $jobId, string $errorCode, string $errorMessage): void`
- `findByPublicId(string $publicId, int $userId): ?array` (사용자 스코프 필수)
- 모든 메서드 PDO prepared statement, snake_case → camelCase 매핑

**검증**
- `php -l` 통과
- 임시 PHP 스크립트로 잡 row 생성/조회/상태 전이 라운드트립

#### Phase 3 - Playwright CLI worker

> **외부 API 의존이 가장 큰 phase. context7 MCP로 최신 문서 확인 필수.**

**Skills**
- 프로젝트: `pickfit-backend-foundation` (간접)
- 외부 MCP: `context7` (Playwright Node.js — page.goto 옵션, context 옵션, screenshot 옵션이 자주 변동)

**Agents / Subagents**
- `Plan` — JSON-LD → OG → 일반 셀렉터 → 텍스트 폴백의 추출 우선순위 트리 사전 설계
- `Explore` — 시드 카탈로그의 `productPageUrl` 도메인 확인해 generic adapter가 우선 다뤄야 할 패턴 파악

**작업 파일**
- `crawler/playwright-crawl.js` (신규)
- `crawler/adapters/generic.js` (신규)
- `crawler/schemas/crawl-result.schema.json` (신규)

**구현 항목 — playwright-crawl.js**
- CLI 인자: `--job-id`, `--url`, `--artifact-dir`, `--max-text-chars`, `--max-images`
- Chromium headless, **fresh context per job** (`browser.newContext()`), persistent profile 사용 금지
- Viewport `1365x768`, User-Agent는 명시적으로 정상 데스크톱 Chrome
- `page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })`
- **navigation 후 `page.url()` 재검증**: 호출자(PHP)가 보낸 normalizedUrl과 호스트가 다르면 차단 결과 리턴
- generic adapter 호출 → 결과 받음
- 스크린샷: `await page.screenshot({ path: artifactDir/screenshot.png, fullPage: false })`
- `finally`에서 context, browser close 보장
- stdout에 단일 JSON 출력 (성공 schema 또는 실패 schema), stderr는 진단 로그만
- 출력 size cap: text는 max-text-chars로 자름, images는 max-images까지

**구현 항목 — generic.js**
- 추출 순서 (각 단계 결과를 누적, 후순위는 누락 필드만 보완):
  1. `script[type="application/ld+json"]` 파싱 → Product schema (name, brand, offers.price, image)
  2. `meta[property^="og:"]` (og:title, og:image, og:price:amount)
  3. 일반 셀렉터: `[itemprop="name"]`, `[class*="price"]`, `meta[name="description"]`
  4. 가시 텍스트 폴백 (`page.locator('main, article, [role=main]').innerText()` → 처음 N자)
  5. 이미지 후보: `<img>`, `<picture>`, OG image
- 가격 후보는 숫자 배열 + 통화 후보 (KRW/USD/JPY/EUR)
- adapter 인터페이스는 [tech.md §10.5](tech.md)의 시그니처 그대로

**금지**
- 로그인 시도, captcha 해결, 폼 제출 (필수 쿠키 동의 close만 예외적 허용), 결제/장바구니 클릭
- `page.evaluate`로 사이트 자체 API 호출
- 다중 페이지 탐색, 페이지네이션 follow

**검증**
- `node --check crawler/playwright-crawl.js` 통과
- 로컬 정적 HTML로 테스트 (127.0.0.1은 PHP 단에서 차단되므로 CLI 단독 검증용):

```powershell
http-server tests/fixtures/crawler -p 9100
node crawler/playwright-crawl.js --job-id test1 --url http://127.0.0.1:9100/product.html --artifact-dir storage/crawls/test1 --max-text-chars 5000 --max-images 5
```

- 스크린샷 파일 존재 확인, JSON 파싱 가능 확인.

#### Phase 4 - CrawlerService + analyze-url API

**Skills**
- 프로젝트: `pickfit-backend-foundation`, `pickfit-integration-check`
- Claude Code: `code-review` (PHP↔Node 경계 코드 검토)

**Agents / Subagents**
- 프로젝트: `pickfit_contract_reviewer` — API 응답 shape이 [tech.md §8.3](tech.md)과 일치하는지 검증

**작업 파일**
- `src/Services/CrawlerService.php` (신규)
- `src/Controllers/CatalogController.php` (확장: `analyzeUrl`, `showCrawlJob` 액션)
- `src/Bootstrap.php` (라우트 + 미들웨어 등록)

**구현 항목**
- 라우트:
  - `POST /api/catalog/analyze-url` (CSRF + crawl rate limit + 인증)
  - `GET /api/catalog/crawl-jobs/{id}` (세션 + 인증)
- `withCrawlRateLimit`: `crawl:{userId}` 키, `RATE_LIMIT_CRAWL_PER_HOUR` 기본 10
- CrawlerService 흐름:
  1. `UrlSafetyService::validate($url)` → 실패면 `markBlocked` + 응답 422 `blocked_url`
  2. `CrawlJobRepository::createQueued(...)` → public_id 발급
  3. `storage/crawls/{public_id}/` 생성
  4. `markRunning`
  5. `proc_open(['node', $env('PLAYWRIGHT_CRAWLER_PATH'), '--job-id', ..., '--url', ...], $pipes, ...)` — **배열 형태**
  6. timeout enforcement (`CRAWL_TIMEOUT_SECONDS`) — 초과 시 `proc_terminate` + `markFailed('crawl_timeout', ...)`
  7. stdout JSON parse → 성공이면 `markSucceeded` + product candidate insert/upsert
  8. stderr 길이 cap 후 요약만 error_message에 저장, 브라우저로는 노출 X
- 상품 후보 저장:
  - 동일 `source_url` 있으면 update, 없으면 insert
  - `data_quality_score`는 generic adapter가 채운 필드 수 비율로 산정
  - `hero_image_url`, `product_media` insert (이미지 상위 N장)
  - `crawl_jobs.product_id`로 링크

**응답 shape ([tech.md §8.3](tech.md) 준수)**

```json
{
  "ok": true,
  "data": {
    "job": {
      "id": "...", "status": "succeeded", "sourceDomain": "...",
      "adapterName": "generic",
      "product": { "id": "...", "name": "...", "brandName": "...", "priceSale": ..., "heroImageUrl": "..." },
      "error": null
    }
  }
}
```

**검증**

```powershell
# 차단
Invoke-RestMethod ... -Body '{"url":"http://127.0.0.1/x"}'   # 422 blocked_url
Invoke-RestMethod ... -Body '{"url":"http://10.0.0.1/x"}'    # 422 blocked_url
Invoke-RestMethod ... -Body '{"url":"file:///etc/passwd"}'   # 422 blocked_url
# 허용
Invoke-RestMethod ... -Body '{"url":"https://<공개 데모 URL>"}'  # 200 succeeded
```

- DB 확인: `crawl_jobs` row 1개, `products` row 1개 (또는 update), `product_media` rows
- `storage/crawls/{public_id}/screenshot.png` 파일 존재

#### Phase 5 - URL 분석 UI

**Skills**
- 프로젝트: `pickfit-ui-audit`, `pickfit-integration-check`
- Claude Code: `verify` (실제 브라우저 동작 확인)

**Agents / Subagents**
- 프로젝트: `pickfit_frontend_mapper`, `pickfit_browser_verifier`
- `Explore` — 기존 landing/onboarding 구조에 분석 모듈을 끼울 위치 파악

**작업 파일**
- `public/js/api/catalog.js` (확장: `analyzeUrl(url)`, `getCrawlJob(id)`)
- `public/js/screens/landing.js` (분석 모듈 placement) 또는 `public/js/components/urlAnalyzer.js` (신규)
- 한국어 에러 메시지 매핑 추가

**구현 항목**
- 입력 + 분석 버튼: 클라이언트 측 1차 검증 (length, scheme prefix)
- 비로그인 → 기존 `authModal` 트리거 (재사용)
- 폴링: `setInterval(1500ms)`, max 30s, succeeded/failed 시 정지
- 진행 상태 카피 ([tech.md §13.4](tech.md)):
  - "URL 확인 중" → "상품 화면 읽는 중" → "상품 정보 정리 중" → "추천 후보에 추가됨"
- 결과 카드: 추출된 상품 미리보기 (브랜드, 이름, 가격, hero 이미지)
- 에러 코드별 한국어 문구:
  - `blocked_url` → "이 주소는 분석할 수 없어요. 공개된 상품 페이지 주소만 가능해요."
  - `crawl_timeout` → "상품 페이지를 읽는 데 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요."
  - `rate_limited` → 기존 `apiErrorMessage` 재사용
- 위치: landing 하단 ([tech.md §13.4](tech.md) 권장) — 단, 온보딩 진입을 가리지 않게 작게

**금지**
- URL 분석 모듈이 메인 CTA를 가리거나 480px wrapper 깨뜨림
- mock 데이터로 성공처럼 위장
- 브라우저에서 raw error_message를 그대로 노출

**검증**
- `verify` skill로 실제 브라우저 플로우 검증
  - 비로그인 → 분석 버튼 클릭 → auth modal
  - 로그인 후 unsafe URL → blocked 메시지
  - 로그인 후 정상 URL → 진행 상태 → 결과 카드
- mobile 480px, desktop 1280px 양쪽에서 깨짐 없음
- console critical error 없음

#### Phase 6 - Day 7 final integration + 독립 보안 감사

**Skills**
- 프로젝트: `pickfit-ci-workflows`, `pickfit-integration-check`
- Claude Code: `security-review` (전체 변경분 대상 최종 감사), `code-review` (effort: high)

**Agents / Subagents**
- 프로젝트: `pickfit_contract_reviewer`, `pickfit_browser_verifier`, `pickfit_integration_reviewer`
- Claude Code `Agent` (subagent_type=general-purpose) — SSRF 회귀 케이스 외부 시각으로 한 번 더 점검

**검증 명령**

```powershell
composer test
Get-ChildItem -Recurse -Include *.php public,src | ForEach-Object { php -l $_.FullName }
Get-ChildItem -Recurse -Include *.js public\js,crawler | ForEach-Object { node --check $_.FullName }
npm.cmd run build
```

**API smoke 시퀀스**

```text
1. csrf → register/login
2. POST /api/catalog/analyze-url with blocked URLs × 5 (loopback, private v4, private v6, file:, javascript:)
3. POST /api/catalog/analyze-url with credentials URL (user:pw@host)
4. POST /api/catalog/analyze-url with valid public URL
5. GET /api/catalog/crawl-jobs/{id}
6. DB 확인: crawl_jobs status 전이, products row 추가, product_media row 추가
7. storage/crawls/{public_id}/ artifact 존재
```

**브라우저 smoke (`verify` skill)**
- 비로그인 진입 → 분석 시도 → 로그인 유도
- 로그인 후 차단 URL 5종 → 사용자에게 한국어 안전 메시지
- 정상 URL → 진행 상태 → 결과 카드 → "추천 후보에 추가됨"
- 모바일 390/480px, 데스크톱 폭에서 깨짐 없음
- Day 5-6에서 만든 추천/저장 플로우가 여전히 동작

**독립 보안 감사**
- `security-review` skill 실행 → `UrlSafetyService`, `CrawlerService`, `playwright-crawl.js` 통합 검토
- 발견된 우회 케이스가 있으면 즉시 Phase 1으로 회귀 (Day 8로 미루지 않음)

### 20.4 Day 7에서 절대 하지 말 것 (기술 안전 한정)

- Playwright를 HTTP 서버로 띄움 — PHP CLI 자식 프로세스로만
- persistent browser profile, 브라우저 확장 설치
- proc_open에 문자열 concat 명령 전달 (반드시 배열)
- `crawl_jobs.raw_result_json`을 그대로 OpenAI/외부 API로 송신 (Day 8 범위)
- 크롤 실패가 추천 플로우를 깨뜨림 — 추천은 fallback으로 계속 동작
- raw stderr / PHP exception을 브라우저에 노출
- DNS resolution 생략한 정규식 SSRF 검증
- 시드 카탈로그를 임의 사이트 결과로 덮어쓰기 (반드시 source_url 기준 upsert)
- IPv6 차단 룰 누락 (IPv4만 막으면 즉시 우회 가능)

### 20.5 Day 7 완료 기준

- **차단**: loopback IPv4/IPv6, 사설 IPv4 3 클래스, link-local, multicast, reserved, IPv4-mapped IPv6 안의 차단대, `file:/ftp:/data:/javascript:` scheme, credentials URL, 2048자 초과 URL, 비-HTTP 포트 모두 422 `blocked_url`
- **DNS 우회 차단**: `localhost` 같은 호스트도 DNS 해석 후 차단됨
- **Navigation 후 재검증**: redirect로 차단 호스트로 빠지면 잡 `failed` (또는 `blocked`)
- **성공 경로**: 정상 공개 URL → 잡이 queued→running→succeeded로 전이, `products`/`product_media` row 생성, `crawl_jobs.product_id` 링크, 스크린샷 artifact 생성
- **리소스 정리**: Playwright browser/context가 finally에서 닫힘, 자식 프로세스 timeout 시 강제 종료
- **API contract**: 응답이 `{ok, data:{job:{...}}, meta}` shape으로 [tech.md §8.3](tech.md)과 일치
- **UI**: 비로그인 진입 시 로그인 유도, 진행/성공/실패 상태가 한국어로 노출, mobile/desktop에서 깨지지 않음
- **회귀 없음**: Day 5-6 추천/저장/피드백 플로우가 그대로 동작
- **레이트 리미트**: 사용자별 `RATE_LIMIT_CRAWL_PER_HOUR` 초과 시 429
- **WORKLOG.md**: Day 7 변경 파일, 검증 명령, 차단 테스트 결과, 성공/실패 crawl 예시, Day 8 시작점 기록

### 20.6 Day 7 남은 설계 리스크

1. **DNS rebinding** — 검증 시점 IP와 navigation 시점 IP가 다를 수 있음. Phase 1의 IP 화이트리스트와 Phase 3의 `page.url()` 재검증을 둘 다 유지해야 의미가 있다. 추가 강화는 Day 10 hardening 범위.
2. **Anti-bot 트리거** — 일부 쇼핑몰은 headless Chromium UA 즉시 차단. 시드 도메인 1개로 happy path 확인되면 OK로 보고, 도메인 어댑터는 Day 8 이후로 미룬다.
3. **Playwright 디스크/메모리** — Chromium 바이너리 ~170MB, 잡당 ~200MB RAM. 동시 잡 실행은 MVP에서 1개로 제한.
4. **동기 실행 timeout** — 응답이 느린 사이트는 `CRAWL_TIMEOUT_SECONDS=45` 안에서 cut. timeout이 실패의 다수가 될 가능성 — 사용자 안내 카피로 흡수.
5. **generic adapter 가격 추출 부정확** — JSON-LD가 없으면 가격 후보가 노이즈 섞임. `priceCandidates`는 배열로 두고, Day 8에서 OpenAI 정규화로 단일 값 확정.
6. **storage/crawls 디스크 사용량** — 스크린샷 누적 시 빠르게 증가. Day 10에서 retention 정책(예: 7일) 추가 필요. 지금은 모니터링만.
7. **Windows proc_open 인자 escape** — 배열 형태 사용으로 회피하지만, PHP 버전·환경에 따라 동작 차이 가능. Phase 4 검증 시 Windows에서 직접 확인.
8. **rate limiter 파일 동시성** — `RateLimiter`가 파일 기반이라 동시 잡 실행 시 카운터 race 가능. Day 7은 그대로 두고 Day 10에서 검토.
9. **에러 메시지 누설** — `error_message`에 페이지 텍스트가 섞이지 않게 generic 카테고리만 저장 (`navigation_timeout`, `extraction_failed`, `blocked_url` 등).
10. **시드 도메인 충돌** — 시드 카탈로그의 `source_url`이 일부 비어 있을 수 있어 upsert 키 정책을 명확히 (없으면 항상 insert + `data_quality_score` 가중치 낮춤).

### 20.7 Skill·Agent 사용 요약

| Phase | 프로젝트 Skill | Claude Code Skill | Agent / Subagent |
|---|---|---|---|
| §20.0 회수 | backend-foundation, integration-check, ui-audit | (해당 없음) | pickfit_backend_mapper, pickfit_contract_reviewer, pickfit_browser_verifier |
| 0 Pre-flight | backend-foundation, integration-check | run, verify | Explore, pickfit_backend_mapper, pickfit_contract_reviewer |
| 1 UrlSafety | backend-foundation | **security-review** ★ | Plan, general-purpose (SSRF 우회 조사) |
| 2 CrawlJobRepo | backend-foundation | — | — |
| 3 Playwright CLI | backend-foundation | — (context7 MCP 필수) | Plan, Explore |
| 4 CrawlerService+API | backend-foundation, integration-check | code-review | pickfit_contract_reviewer |
| 5 UI | ui-audit, integration-check | **verify** ★ | pickfit_frontend_mapper, pickfit_browser_verifier, Explore |
| 6 Final | ci-workflows, integration-check | **security-review** ★, code-review (high) | pickfit_contract_reviewer, pickfit_browser_verifier, pickfit_integration_reviewer, general-purpose |

★ 표시는 보안 직결이라 생략 금지.
