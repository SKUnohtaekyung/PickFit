# PickFit 핵심 코드 정리

작성 기준: 현재 저장소의 PHP 백엔드, Vanilla JS SPA, Playwright 크롤러, MySQL 스키마, 테스트 코드를 읽고 기능 흐름 중심으로 정리했다.

## Phase별 작업 계획 및 결과

| Phase | 목적 | 확인한 범위 | 결과 |
| --- | --- | --- | --- |
| Phase 1 | 프로젝트 구조와 기술 스택 파악 | `README.md`, `composer.json`, `package.json`, `public/index.php`, `src/Bootstrap.php` | PHP 8.2+ JSON API와 Vanilla JS SPA가 `public/`에서 함께 서비스되는 구조 |
| Phase 2 | 백엔드 핵심 흐름 분석 | `src/Http`, `src/Controllers`, `src/Services`, `src/Repositories`, `src/Support` | 라우팅, 인증, 카탈로그, URL 분석, 추천 생성, 저장/피드백 책임을 분리해 구현 |
| Phase 3 | 프론트엔드 화면과 상태/API 연동 분석 | `public/js/app.js`, `public/js/screens`, `public/js/api`, `public/js/utils`, `public/js/components` | 온보딩 조건 수집부터 추천 결과, 상세, 비교, 저장까지 SPA 상태 흐름 확인 |
| Phase 4 | 크롤러/DB/테스트 분석 | `crawler`, `database/migrations`, `tests` | Playwright URL 분석, Musinsa 배치 수집, MySQL 영속화, 보안/추천 회귀 테스트 확인 |
| Phase 5 | 핵심 코드 문서화 | 이 문서 | 기능별 핵심 파일, 주요 함수, 데이터 흐름을 정리 |
| Phase 6 | 별도 검토 | backend mapper, frontend mapper subagent 2개 | URL analyzer 노출 상태, reload 조건, route/auth matrix, DB 전제, 테스트 범위 등 수정점 확인 |
| Phase 7 | 최종본 확인 | subagent 피드백 반영 후 문서 재확인 | 최종본 확정 |

## 전체 구조

PickFit은 "상황과 취향을 입력하면 3개의 코디를 추천하고, 저장/비교/피드백까지 이어지는 패션 결정 도우미"다.

```text
브라우저 SPA
  public/app.html
  public/js/app.js
  public/js/screens/*
  public/js/api/*
        |
        | JSON API
        v
PHP 백엔드
  public/index.php
  src/Bootstrap.php
  src/Controllers/*
  src/Services/*
  src/Repositories/*
        |
        | PDO
        v
MySQL
  users, products, crawl_jobs,
  recommendation_runs, recommendation_outfits,
  recommendation_items, saved_outfits, feedback_events

별도 워커
  crawler/playwright-crawl.js
  crawler/adapters/generic.js
```

## 시스템 아키텍처

### 기술 스택

| 영역 | 기술 | 비고 |
| --- | --- | --- |
| 백엔드 | PHP 8.2+, 프레임워크 없는 자체 라우터/DI | `public/index.php` -> `src/Bootstrap.php` 단일 진입점 |
| 데이터 접근 | PDO (MySQL 8+, InnoDB, utf8mb4) | Repository 계층에서 prepared statement 사용 |
| 프론트엔드 | Vanilla JS SPA, Tailwind CSS | 빌드 후 `public/`에서 정적 서빙, 화면 단위 모듈 |
| 크롤러 | Node.js + Playwright | PHP가 `proc_open()`으로 별도 프로세스 실행 |
| AI 보강 | OpenAI Responses API (strict JSON Schema) | 추천 생성과 상품 추출, 둘 다 선택적 활성화 |
| 영속/런타임 | MySQL + 파일 기반 storage | rate limit, crawl artifact, OpenAI 로그는 파일 |

핵심 특징: 외부 웹 프레임워크에 의존하지 않고, HTTP 처리·라우팅·DI·미들웨어(세션/CSRF/rate limit/인증)를 `Bootstrap`이 직접 조립한다.

### 계층 구조 (layered)

```text
[Presentation]  public/app.html + public/js/*  (SPA: screens / components / api client)
       |  JSON over HTTP (same-origin, credentials 포함)
       v
[HTTP Edge]     public/index.php -> Bootstrap
                  Router          : method + path 매칭
                  Request/Response: 입력 정규화 + 보안 헤더
                  Middleware 래퍼 : 세션 / CSRF / rate limit / auth / DB 예외
       |
       v
[Controller]    Auth / Catalog / Recommendation / UserAction
                  입력 검증 + HTTP 상태 코드 결정 (얇은 계층)
       |
       v
[Service]       Auth / Csrf / RateLimiter / UrlSafety / Crawler
                Recommendation / OpenAI            (도메인 로직)
       |
       v
[Repository]    User / Product / CrawlJob / Recommendation / SavedOutfit / Feedback
                  PDO prepared statement만으로 DB 접근
       |
       v
[Data]          MySQL (InnoDB)  +  파일 storage (rate-limits / crawls / logs)

[Worker]        Node Playwright 프로세스 (proc_open) <- CrawlerService가 호출
[External]      OpenAI Responses API                 <- OpenAIService가 호출
```

### 요청 라이프사이클 (백엔드)

```text
HTTP 요청
  -> public/index.php            정적 파일이면 통과, 아니면 Bootstrap
  -> Router                      라우트 매칭, 없으면 404 / 비 API면 app.html 반환
  -> Middleware 래퍼             세션 시작 -> CSRF 검증 -> rate limit -> auth 사용자 확인
  -> Controller                  JSON body 검증, 파라미터 추출
  -> Service                     도메인 로직 (필요 시 Worker/OpenAI 호출)
  -> Repository                  PDO로 DB 읽기/쓰기 (트랜잭션 포함)
  -> Response                    {ok,data/error,meta} envelope + 공통 보안 헤더
  -> 송신
```

특징:
- 미들웨어는 별도 클래스가 아니라 `Bootstrap`의 `withCsrfProtection()`, `withAuthRateLimit()` 같은 래퍼 메서드로 라우트 핸들러를 감싸 적용한다.
- 모든 응답에 CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`가 붙는다.
- rate limit과 인증은 세션/IP 기준이며, 무거운 작업(크롤링·OpenAI)은 동기 호출이지만 외부 프로세스/API로 위임된다.

### 실행/배포 구성

```text
PHP 내장 서버 (또는 PHP-FPM)  --  document root: public/
        |                         정적 파일은 직접 서빙, 그 외 index.php로 위임
        +-- MySQL 8+              migrations 001~004 적용 필수
        +-- Node + Playwright     CrawlerService가 proc_open()으로 1회성 실행
        +-- storage/              rate-limits / crawls / logs / certs (파일 영속)
        +-- OpenAI API            OPENAI_API_KEY 등 환경변수로 활성화 (선택)
```

- 프론트와 백엔드가 같은 origin(`public/`)에서 서비스되어 CORS 없이 same-origin 쿠키 세션을 쓴다.
- 크롤러 워커는 상시 데몬이 아니라 요청 시점에 단발성으로 실행되고 stdout JSON 한 개만 반환한다.
- 외부 의존성(OpenAI)이 없거나 실패해도 deterministic fallback 추천으로 서비스가 동작한다.

## 실행 진입점과 공통 HTTP 코드

### `public/index.php`

역할:

- PHP 내장 서버에서 정적 파일 요청은 그대로 통과시킨다.
- Composer autoload가 있으면 사용하고, 없으면 `PickFit\` 네임스페이스용 간단 autoloader를 등록한다.
- `Bootstrap::create($projectRoot)->handle(Request::fromGlobals())->send()`로 모든 요청을 넘긴다.
- 예외가 밖으로 새면 JSON `internal_error`로 응답한다.

핵심 의미:

```php
Bootstrap::create($projectRoot)
    ->handle(Request::fromGlobals())
    ->send();
```

이 한 줄이 "요청 생성 -> 라우팅/처리 -> 응답 송신"의 전체 백엔드 진입점이다.

### `src/Bootstrap.php`

역할:

- API 라우트를 직접 등록한다.
- 컨트롤러, 서비스, 리포지토리를 조립하는 의존성 주입 지점이다.
- 세션, CSRF, rate limit, 인증 사용자 확인, DB 예외 처리를 공통 래퍼로 묶는다.
- API가 아닌 요청은 `public/app.html`을 반환해 SPA 라우팅을 살린다.

주요 라우트와 보호 조건:

| Method | Path | 담당 기능 | Auth | CSRF | Rate limit | 응답 형태 |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | 서버 상태 확인 | 아니오 | 아니오 | 아니오 | 특수 형태: `{ok, app, environment}` |
| `GET` | `/api/csrf` | CSRF 토큰 발급 | 아니오 | 아니오 | 아니오 | `{ok,data,meta}` |
| `POST` | `/api/auth/register` | 회원가입 | 아니오 | 예 | IP별 auth limit | `{ok,data,meta}` 또는 error |
| `POST` | `/api/auth/login` | 로그인 | 아니오 | 예 | IP별 auth limit | `{ok,data,meta}` 또는 error |
| `POST` | `/api/auth/logout` | 로그아웃 | 세션 사용 | 예 | 아니오 | `{ok,data,meta}` |
| `GET` | `/api/auth/me` | 현재 사용자 조회 | 세션 사용 | 아니오 | 아니오 | `{ok,data,meta}` 또는 401 |
| `POST` | `/api/profile` | 프로필 성별/닉네임 수정 | 예 | 예 | 아니오 | `{ok,data,meta}` 또는 error |
| `GET` | `/api/products` | 상품 목록 | 아니오 | 아니오 | 아니오 | `{ok,data,meta}` |
| `GET` | `/api/products/{id}` | 상품 상세 | 아니오 | 아니오 | 아니오 | `{ok,data,meta}` 또는 404 |
| `POST` | `/api/catalog/analyze-url` | 상품 URL 분석 | 예 | 예 | IP별 crawl limit | `{ok,data,meta}` 또는 blocked/error |
| `GET` | `/api/catalog/crawl-jobs/{id}` | URL 분석 작업 조회 | 예 | 아니오 | 아니오 | `{ok,data,meta}` 또는 404 |
| `POST` | `/api/recommendations` | 코디 추천 생성 | 예 | 예 | IP별 recommendation limit | `{ok,data,meta}` 또는 error |
| `GET` | `/api/recommendations/{id}` | 추천 run 재조회 | 예 | 아니오 | 아니오 | `{ok,data,meta}` 또는 404 |
| `GET` | `/api/saved-outfits` | 저장 코디 조회 | 예 | 아니오 | 아니오 | `{ok,data,meta}` |
| `POST` | `/api/saved-outfits` | 코디 저장 | 예 | 예 | 아니오 | `{ok,data,meta}` |
| `DELETE` | `/api/saved-outfits/{id}` | 저장 코디 삭제 | 예 | 예 | 아니오 | `{ok,data,meta}` |
| `POST` | `/api/feedback` | 피드백 기록 | 예 | 예 | 아니오 | `{ok,data,meta}` |

주의:

- `GET /api/health`와 일부 최상위 fallback 오류는 공통 `{ok,data/error,meta}` envelope와 다를 수 있다.
- 세 가지 rate limit은 사용자 id가 아니라 `$request->clientIp()` 기준이다.
- `DELETE /api/saved-outfits/{id}`의 `{id}`는 `saved_outfits.id`가 아니라 추천 outfit의 public id다.

### `src/Http/Router.php`

역할:

- `GET`, `POST`, `DELETE` 라우트를 등록한다.
- `/api/products/{id}` 같은 path parameter를 직접 매칭한다.
- 일치하는 라우트가 없으면 `null`을 반환하고, `Bootstrap`이 404 처리한다.

### `src/Http/Request.php`

역할:

- 전역 변수(`$_SERVER`, `php://input`, `$_GET`)를 객체로 감싼다.
- 헤더 이름을 소문자/하이픈 형태로 정규화한다.
- `json()`에서 JSON body가 객체가 아니거나 파싱 실패하면 `InvalidArgumentException`을 던진다.

### `src/Http/Response.php`

역할:

- JSON 응답과 파일 응답을 생성한다.
- 모든 응답에 보안 헤더를 붙인다.
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`를 공통 적용한다.

## 인증과 보안 흐름

### 주요 파일

| 파일 | 핵심 역할 |
| --- | --- |
| `src/Controllers/AuthController.php` | 요청 JSON 검증, 상태 코드 결정 |
| `src/Services/AuthService.php` | 이메일/비밀번호 검증, 세션 생성, 로그아웃, 프로필 수정 |
| `src/Repositories/UserRepository.php` | `users` 테이블 CRUD |
| `src/Services/CsrfService.php` | 세션 기반 CSRF 토큰 발급/검증 |
| `src/Services/RateLimiter.php` | 파일 기반 시간창 rate limit |
| `public/js/components/authModal.js` | 프론트 인증 상태 캐시와 로그인/회원가입 UI |
| `public/js/api/auth.js` | 인증 API 호출 래퍼 |

### 회원가입/로그인 흐름

```text
authModal 또는 auth 화면
  -> public/js/api/auth.js
  -> POST /api/auth/register 또는 /api/auth/login
  -> Bootstrap::withCsrfProtection()
  -> Bootstrap::withAuthRateLimit()
  -> AuthController
  -> AuthService
  -> UserRepository
  -> 세션 auth_user 저장
```

핵심 코드 책임:

- `AuthController::register()`  
  `email`, `password`, `displayName`, `gender`를 꺼내고 검증 실패를 `422 validation_failed`로 바꾼다.

- `AuthService::register()`  
  이메일 정규화, 비밀번호 길이 검사, 중복 이메일 확인, `password_hash()`, 세션 생성까지 담당한다. 회원가입의 `gender`는 `male`/`female`이면 저장하고, 유효하지 않으면 `null`로 정규화한다. 반면 프로필 수정은 잘못된 `gender`를 `422`로 거부한다.

- `AuthService::login()`  
  이메일 정규화 후 `password_verify()`로 검증한다. 존재하지 않는 이메일과 틀린 비밀번호는 같은 메시지를 반환해 사용자 열거를 막는다.

- `CsrfService::token()` / `validateRequest()`  
  세션에 토큰을 만들고 `X-CSRF-Token` 헤더와 `hash_equals()`로 비교한다.

- `RateLimiter::allow()`  
  `storage/rate-limits` 아래 키별 JSON 파일에 카운트를 기록하고 `flock()`으로 동시 요청을 방어한다. 인증, 추천, URL 분석 limit은 모두 client IP 기준이다.

## 카탈로그와 상품 데이터

### 주요 파일

| 파일 | 핵심 역할 |
| --- | --- |
| `src/Controllers/CatalogController.php` | 상품 목록/상세/URL 분석 API 응답 |
| `src/Repositories/ProductRepository.php` | 상품 조회, 추천 후보 조회, 크롤링 상품 upsert |
| `database/migrations/001_initial_schema.sql` | 상품, 리뷰, 미디어, 추천, 저장, 피드백 테이블 생성 |
| `database/migrations/003_product_origin_owner.sql` | 상품 출처와 사용자 URL 소유권 추가 |

### 상품 목록/상세

`ProductRepository::list()`는 public catalog browse용이다.

핵심 조건:

- `stock_status <> 'sold_out'`
- `origin_type = 'batch'`
- 선택 필터: `category`, `situation`, `style`, `maxPrice`, `cursor`

`ProductRepository::findByPublicId()`는 batch 상품만 상세 조회한다. 사용자 URL로 분석한 개인 상품은 일반 카탈로그 상세에 노출하지 않는 방향이다.

### 추천 후보 조회

`ProductRepository::findRecommendationCandidates()`는 추천용으로 더 많은 필드를 조회한다.

핵심 조건:

- 카테고리: `top`, `bottom`, `shoes`, `outer`
- 재고: sold out 제외
- 출처:
  - `batch` 상품은 모든 사용자에게 노출
  - `user_url` 상품은 현재 로그인 사용자의 `owner_user_id`와 일치할 때만 포함
- 성별:
  - 사용자 성별이 `male` 또는 `female`이면 해당 성별, `unisex`, `NULL`만 포함

후보 점수 `scoreCandidate()`:

| 입력 조건 | 점수 영향 |
| --- | --- |
| 상황 태그 일치 | `+4` |
| 무드/스타일 태그 겹침 | 겹친 개수마다 `+2` |
| 선호 색상 일치 | `+1` |
| 핏 선호 일치 | `+3` |
| `tight` 회피 + slim 상품 | `-4` |
| `sheer` 회피 + 불투명 아님 | `-4` |
| 방금 URL 분석한 상품 | `+5` |

## URL 분석과 크롤링

중요한 현재 상태:

- `public/js/components/urlAnalyzer.js`에는 URL 분석 UI와 API 연동 코드가 구현되어 있다.
- 하지만 현재 `landing.js`, `home.js` 등 어떤 화면에서도 `mountUrlAnalyzer()`를 호출하지 않는다.
- 따라서 아래 프론트 URL 분석 흐름은 "구현된 컴포넌트 기준의 잠재 흐름"이고, 실제 사용자 화면에 다시 노출하려면 화면에서 mount 작업이 필요하다.

### 주요 파일

| 파일 | 핵심 역할 |
| --- | --- |
| `public/js/components/urlAnalyzer.js` | 사용자가 상품 URL을 입력하는 UI |
| `public/js/api/catalog.js` | `/api/catalog/analyze-url`, `/api/catalog/crawl-jobs/{id}` 호출 |
| `src/Controllers/CatalogController.php` | URL 분석 요청 검증과 job 응답 shaping |
| `src/Services/UrlSafetyService.php` | SSRF 방어 URL 검증 |
| `src/Services/CrawlerService.php` | crawl job 생성, Playwright 실행, 상품 upsert |
| `src/Repositories/CrawlJobRepository.php` | `crawl_jobs` 상태 전이 저장 |
| `crawler/playwright-crawl.js` | 단일 URL Playwright 워커 |
| `crawler/adapters/generic.js` | JSON-LD, meta, DOM, text, image 추출 |

### URL 분석 흐름

```text
urlAnalyzer.js 컴포넌트
  -> analyzeUrl(url)
  -> POST /api/catalog/analyze-url
  -> UrlSafetyService::validate()
  -> CrawlJobRepository::createQueued()
  -> CrawlerService::runPlaywright()
  -> crawler/playwright-crawl.js
  -> crawler/adapters/generic.js
  -> ProductRepository::upsertFromCrawl()
  -> optional OpenAI extraction
  -> crawl_jobs succeeded/failed/blocked
  -> 프론트는 product id를 sessionStorage에 저장
  -> 다음 추천 요청의 sourceProductIds로 전달
```

### `UrlSafetyService`

핵심 방어:

- 허용 scheme: `http`, `https`
- URL 길이 제한: 2048
- URL 내 계정 정보 차단
- 허용 port: `80`, `443`, `8080`, `8443`
- long decimal, octal, hex 등 모호한 numeric host 차단
- DNS 조회 후 private, loopback, link-local, multicast, reserved IPv4/IPv6 차단
- 최종 redirect URL도 다시 검증

### `CrawlerService`

핵심 책임:

- URL 검증 실패 시에도 `crawl_jobs`에 blocked 상태를 기록한다.
- 정상 URL은 `queued -> running -> succeeded/failed/blocked` 상태로 전이한다.
- `proc_open()`으로 Node Playwright 워커를 실행한다.
- stdout은 JSON payload로만 취급하고, stderr는 tail만 sanitize해 저장한다.
- generic 추출 결과를 `ProductRepository::upsertFromCrawl()`로 상품화한다.
- `OPENAI_EXTRACTION_ENABLED=true`이면 OpenAI 구조화 출력으로 상품 필드를 보강한다.
- 기본값은 `OPENAI_EXTRACTION_ENABLED=false`라서 상품 추출 보강은 명시적으로 켜야 한다.
- 같은 `source_url`이 이미 존재하면 `origin_type`과 `owner_user_id`는 기존 값을 유지한다. 따라서 다른 사용자가 같은 URL을 분석하면 crawl job은 연결될 수 있지만, 추천 후보 필터에서는 원래 소유자가 아닌 사용자에게 그 `user_url` 상품이 포함되지 않을 수 있다.

### `crawler/playwright-crawl.js`

정책:

- 단일 navigation만 수행
- 로그인/캡차 우회 없음
- 장바구니/구매/폼 제출 없음
- fresh browser context 사용
- 결과는 stdout에 JSON 한 개만 출력
- 진행/오류 로그는 stderr 사용

### `crawler/adapters/generic.js`

추출 순서:

1. meta tag / Open Graph
2. JSON-LD Product
3. 공통 DOM selector
4. visible text fallback
5. image candidate 수집

## 추천 생성 핵심 코드

### 주요 파일

| 파일 | 핵심 역할 |
| --- | --- |
| `public/js/screens/landing.js` | 상황 선택 |
| `public/js/screens/onboarding.js` | 예산, 무드, 핏, 체형, 색상, 회피 조건 수집 |
| `public/js/screens/loading.js` | 실제 추천 API 호출과 진행 UI |
| `public/js/api/recommendations.js` | 추천 생성/조회 API |
| `src/Controllers/RecommendationController.php` | 추천 요청 검증 |
| `src/Services/RecommendationService.php` | 추천 후보 수집, OpenAI/fallback 생성, 저장 |
| `src/Repositories/RecommendationRepository.php` | 추천 run/outfit/item 영속화 |
| `src/Support/ResponseValidator.php` | OpenAI 구조화 출력 2차 검증 |
| `src/Services/OpenAIService.php` | OpenAI Responses API 호출 |

### 프론트 추천 흐름

```text
landing.js
  상황 선택
onboarding.js
  budget/mood/fit/bodyType/colors/avoidances 저장
loading.js
  buildConditions()
  getSourceProductIds()
  createRecommendationRun()
results.js
  state.recommendations 렌더링
detail.js / comparison.js / saved.js
  같은 outfit shape 재사용
```

`loading.js::requestRecommendations()`가 프론트 추천 흐름의 핵심이다.

역할:

- 전역 onboarding 상태를 API conditions로 변환한다.
- URL 분석 컴포넌트가 노출되어 상품을 분석한 경우, `sessionStorage`에 쌓인 `sourceProductIds`를 함께 보낸다.
- API 응답을 `adaptRecommendationResponse()`로 UI shape로 바꾼다.
- 성공, 인증 만료, 후보 부족, 일반 오류를 서로 다른 UI 상태로 분기한다.
- API 실패 시 mock 추천으로 조용히 대체하지 않는다. 오류 UI와 사용자 재시도 흐름을 보여준다.

### 백엔드 추천 흐름

```text
POST /api/recommendations
  -> RecommendationController::create()
  -> RecommendationService::generate()
     1. normalizeConditions()
     2. budgetCap(), totalBudget()
     3. ProductRepository::findRecommendationCandidates()
     4. pruneByBudget()
     5. minimum coverage 확인
     6. OpenAI 가능하면 tryOpenAiRecommendation()
     7. 실패/불가하면 assembleOutfits()
     8. RecommendationRepository::persistRun()
     9. shapeResponse()
```

### `RecommendationService::generate()`

이 프로젝트에서 추천 기능의 중심 함수다.

핵심 판단:

- 후보는 슬롯별(`top`, `bottom`, `shoes`, `outer`)로 받는다.
- 필수 슬롯은 `top`, `bottom`, `shoes`다.
- 예산은 "아이템 1개당 상한"으로 먼저 후보를 prune한다.
- 필수 슬롯 후보가 너무 줄면 가장 싼 초과 상품을 일부 되살려 coverage를 보존한다.
- OpenAI가 설정되어 있고 schema가 있으면 OpenAI 추천을 시도한다.
- OpenAI 실패, 검증 실패, 변환 실패는 deterministic fallback으로 내려간다.
- fallback도 3개 코디를 만들지 못하면 `low_catalog_coverage`를 던진다.
- 최종 결과는 DB에 저장한 뒤 public id가 붙은 응답 shape로 반환한다.

### OpenAI 추천 경로

`OpenAIService::generateRecommendations()`:

- system prompt: `src/Support/prompts/recommendation_system.txt`
- user payload: `conditions`, slot별 후보 요약
- schema: `src/Support/schemas/recommendation.schema.json`
- API: Responses API `text.format.type=json_schema`, `strict=true`

`ResponseValidator::validateRecommendationOutput()`:

- top-level `confidence`, `globalWarnings`, `outfits` 필수 확인
- 코디는 정확히 3개여야 함
- rank는 1, 2, 3 중 하나이고 중복 불가
- slot product id는 후보 whitelist 안에 있어야 함
- outfit 내부에 같은 product id가 두 slot에 중복되면 거부
- confidence는 0~1 범위
- `fitRisk` 등 enum 값 검증

`RecommendationService::convertOpenAiOutfits()`:

- 검증된 OpenAI 응답을 내부 outfit shape로 변환한다.
- 필수 슬롯이 빠지면 fallback으로 내려간다.
- 상품 id가 실제 후보에 없거나 category/slot이 맞지 않으면 fallback으로 내려간다.
- 필수 슬롯의 상품이 코디 카드 간 반복되면 alternative로 교체하고, 교체 불가하면 fallback으로 내려간다.

### Fallback 추천 경로

`RecommendationService::assembleOutfits()`:

- 세 가지 전략으로 3개 코디를 만든다.
  - situation focused
  - body type focused
  - value focused
- 이전 코디에서 사용한 상품은 다음 코디 후보에서 제외한다.
- 후보가 부족하면 전체 pool을 다시 쓰는 graceful fallback은 있지만, signature 중복은 막는다.
- 최종적으로 3개가 안 되면 low coverage로 처리한다.

이 fallback은 OpenAI가 없어도 추천 결과가 나오도록 하는 핵심 안전장치다.

### 추천 저장

`RecommendationRepository::persistRun()`:

- 트랜잭션 시작
- `recommendation_runs` insert
- 코디별 `recommendation_outfits` insert
- 아이템별 `recommendation_items` insert
- commit 후 public outfit id를 붙여 반환
- 실패 시 rollback

이 저장 구조 덕분에 `GET /api/recommendations/{id}`로 새로고침 후에도 결과를 재조회할 수 있다.

## 프론트엔드 SPA 구조

### `public/js/app.js`

역할:

- 화면 이름과 render 함수를 매핑한다.
- 로그인 필요 화면을 `GATED`로 관리한다.
- 화면 전환 애니메이션과 bottom nav 표시 여부를 관리한다.
- `initializeAuth()` 후 로그인 상태에 따라 `home` 또는 `welcome`으로 진입한다.
- 전역 오류와 session expired 이벤트를 처리한다.
- 인증 우선 구조다. `welcome`, `auth`를 제외한 주요 화면은 `GATED`로 묶이고, 로그인하지 않은 사용자가 접근하면 `navigateTo()`가 `auth`로 돌린다.

주요 화면:

| 화면 | 파일 | 역할 |
| --- | --- | --- |
| `welcome` | `screens/welcome.js` | 최초 진입 |
| `auth` | `screens/auth.js` | 로그인/회원가입 화면 |
| `home` | `screens/home.js` | 로그인 후 허브 |
| `landing` | `screens/landing.js` | 상황 선택 |
| `onboarding` | `screens/onboarding.js` | 추천 조건 입력 |
| `loading` | `screens/loading.js` | 추천 API 호출 |
| `results` | `screens/results.js` | 추천 카드 목록 |
| `detail` | `screens/detail.js` | 코디 상세 |
| `comparison` | `screens/comparison.js` | 코디 비교 |
| `saved` | `screens/saved.js` | 저장 코디와 피드백 |
| `profile/account/settings` | `screens/*` | 계정/설정 관리 |

### `public/js/utils/state.js`

역할:

- `localStorage`에 `pickfit_state`로 앱 상태를 저장한다.
- onboarding 조건, 추천 결과, 저장 코디, 피드백, 현재 화면, 비교 대상 등을 관리한다.
- 서버 동기화 데이터의 출처를 `dataSources`로 추적한다.
- `lastRunId`는 추천 run 재조회용이고, `apiCache.catalog`는 카탈로그 캐시 확장 지점이다.

### 프론트 저장소 key

| Key | 저장 위치 | 담당 |
| --- | --- | --- |
| `pickfit_state` | `localStorage` | onboarding, recommendations, saved, feedback, currentScreen, lastRunId 등 |
| `pickfit_source_products` | `sessionStorage` | URL 분석으로 얻은 최근 상품 public id, 최대 5개 |
| `pf_splash_shown` | `sessionStorage` | 현재 탭에서 splash 노출 여부 |
| `pf_seen_welcome` | `localStorage` | 최초 welcome 경험 여부 |
| `pf_reduce_motion` | `localStorage` | 앱 자체 모션 줄이기 설정 |

핵심 메서드:

| 메서드 | 기능 |
| --- | --- |
| `set()` / `update()` | 상태 변경 후 저장/구독자 알림 |
| `resetOnboarding()` | 새 추천 시작을 위해 조건/추천/비교 상태 초기화 |
| `setRecommendations()` | 추천 결과와 출처 저장 |
| `toggleSaved()` | 저장 코디 optimistic update |
| `replaceSavedFromApi()` | 서버 저장 목록으로 교체 |
| `markSavedFromApi()` | 저장 API 성공 결과 반영 |
| `addFeedback()` | 피드백 로컬 기록 |

### API client 계층

`public/js/api/client.js`:

- 모든 API 요청의 공통 fetch 래퍼다.
- JSON body와 `credentials: 'same-origin'`을 기본 처리한다.
- CSRF 필요 요청이면 `/api/csrf`에서 토큰을 받아 `X-CSRF-Token`으로 넣는다.
- 403 forbidden + CSRF 실패는 토큰을 지우고 한 번 재시도한다.
- GET 네트워크 오류는 한 번 재시도한다.
- 실패 응답은 `ApiError`로 정규화한다.

`public/js/api/recommendationAdapter.js`:

- 백엔드 추천 응답을 UI용 outfit/product shape로 바꾼다.
- double-adapt 방지를 위해 이미 `comparison`이 있으면 그대로 반환한다.
- 가격, 핏, 소재, 시즌, 리뷰, 핏 리스크 비교값을 계산한다.
- 배송/반품 정보는 실제 데이터가 없으면 가짜 숫자를 만들지 않고 `EXTERNAL` 또는 정보 부족으로 둔다.

## 결과, 상세, 비교, 저장 기능

### 결과 화면 `public/js/screens/results.js`

핵심 기능:

- `state.recommendations`가 비었지만 `lastRunId`가 있으면 서버에서 추천 run을 재조회한다.
- 단, 앱 새로고침 자체가 이전 `currentScreen`을 복원하지는 않는다. 부트스트랩은 로그인 사용자를 `home`으로, 비로그인 사용자를 `welcome`으로 보낸다. `lastRunId` 재조회는 사용자가 `results` 화면에 도달했을 때 그 화면 내부에서만 작동한다.
- 현재 onboarding 조건과 run 조건이 크게 다르면 onboarding으로 돌려보낸다.
- 3개 추천 카드를 렌더링한다.
- 전체 비교, 상세 보기, 저장 버튼을 연결한다.
- URL 분석 상품이 실제 추천에 반영되었는지 badge로 표시한다.

### 상세 화면 `public/js/screens/detail.js`

핵심 기능:

- `selectedOutfitId`로 추천 또는 저장 목록에서 outfit을 찾는다.
- 상품 카드, 추천 이유, 리뷰 근거, 리스크를 렌더링한다.
- 구매 링크가 있을 때만 새 탭을 연다.
- 피드백 sheet를 띄우고 `persistFeedback()`으로 서버 저장을 시도한다.

### 비교 화면 `public/js/screens/comparison.js`

핵심 기능:

- `compareOutfitIds`가 있으면 해당 코디를, 없으면 추천 상위 3개를 비교한다.
- 가격 최저, 핏 리스크 최소는 best badge를 계산한다.
- 정보 부족 값은 best 계산에서 제외한다.
- 긴 한국어 라벨이 겹치지 않도록 행 기반 비교 UI로 구성한다.

### 저장 화면 `public/js/screens/saved.js`

핵심 기능:

- 진입 시 `syncSavedFromApi()`로 서버 저장 목록을 동기화한다.
- 저장 코디를 상황별로 그룹핑한다.
- 비교 모드에서 2~3개 코디를 선택해 비교 화면으로 이동한다.
- 저장 삭제는 optimistic update 후 API 실패 시 롤백한다.
- quick feedback을 로컬 기록 후 서버에도 전송한다.

### 저장 버튼 공통 코드 `public/js/components/saveControls.js`

역할:

- 결과/상세 화면에서 같은 저장 UI와 동작을 공유한다.
- optimistic update를 먼저 하고, 일반 API 오류에서는 상태를 되돌린다.
- 인증 만료나 비로그인 local fallback 경로에서는 로컬 상태를 유지하고 동기화 안내 toast만 보여줄 수 있다. 즉 모든 실패가 항상 rollback되는 것은 아니다.
- 같은 outfit에 대해 서버 요청이 진행 중이면 중복 클릭을 무시한다.

## OpenAI 구조화 출력 코드

### `src/Services/OpenAIService.php`

핵심 기능:

- OpenAI API key, model, timeout, temperature, seed를 `Config`에서 읽는다.
- 추천 생성과 상품 추출을 모두 Responses API + strict JSON Schema로 호출한다.
- HTTP status별 오류를 `openai_auth_failed`, `openai_rate_limited`, `openai_unavailable`, `openai_bad_request` 등으로 정규화한다.
- 응답 envelope에서 `output_text` 또는 content entry를 찾아 JSON decode한다.
- raw response와 fallback event를 `storage/logs/openai`에 기록할 수 있다.

### schema 파일

| 파일 | 목적 |
| --- | --- |
| `src/Support/schemas/recommendation.schema.json` | 3개 코디 추천 응답 구조 |
| `src/Support/schemas/product_extraction.schema.json` | URL 크롤링 상품 필드 보강 구조 |

중요한 점:

- OpenAI strict schema만 믿지 않고 `ResponseValidator`에서 서버 측 재검증을 다시 한다.
- 추천 product id는 반드시 후보 목록 whitelist에 있어야 한다.
- OpenAI가 실패해도 fallback 추천이 동작한다.
- 추천 OpenAI 경로는 API key, model, recommendation schema가 모두 있을 때만 실행된다.
- URL 분석 상품 필드 보강용 OpenAI extraction은 추천 OpenAI와 별도이며, `OPENAI_EXTRACTION_ENABLED=true`일 때만 시도된다.

## 데이터베이스 구조

DB는 MySQL 8+, InnoDB, `utf8mb4_0900_ai_ci`를 기준으로 한다. 모든 테이블은 내부 `id BIGINT` PK와 외부 노출용 `public_id`(대부분 `VARCHAR(36) UNIQUE`)를 함께 가진다. API는 내부 id를 노출하지 않고 `public_id`만 주고받는다.

### ERD (관계 개요)

```text
users (1) ────< user_profiles (0..1)        프로필 확장(1:1, 현재 거의 미사용)
  │  │  │  │
  │  │  │  └──< crawl_jobs (N)               URL 분석 작업 (user_id FK)
  │  │  └─────< recommendation_runs (N)      추천 요청 단위
  │  └────────< saved_outfits (N) >────┐     저장 (user_id + outfit_id)
  └───────────< feedback_events (N)    │     피드백 (outfit_id / product_id nullable)
                                       │
recommendation_runs (1) ──< recommendation_outfits (N) ──< recommendation_items (N)
                                       │                          │  │
saved_outfits >────────────────────────┘                         │  │
                                                                  │  └─> products (product_id, RESTRICT)
                                                                  └────> product_variants (selected_variant_id, SET NULL)

products (1) ──< product_variants (N)
products (1) ──< product_media (N)
products (1) ──< reviews (N)
products (0..1) <── crawl_jobs.product_id (SET NULL)   분석 결과로 만들어진 상품 연결
products.owner_user_id ──> users (SET NULL)            user_url 상품 소유자
products.crawl_job_id  ──> crawl_jobs (SET NULL)       상품 생성 출처 작업
```

읽는 법: `A ──< B`는 A:B = 1:N, `>──<`는 양쪽을 잇는 조인/소유 관계를 의미한다.

### 테이블별 핵심 컬럼

`users` — 계정/인증/성별

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` / `public_id` | BIGINT PK / VARCHAR(36) UNIQUE | 내부 id, 외부 id |
| `email` | VARCHAR(255) UNIQUE | 정규화 후 저장, 사용자 열거 방지 |
| `password_hash` | VARCHAR(255) | `password_hash()` 결과 |
| `display_name` | VARCHAR(80) NULL | 닉네임 |
| `gender` | VARCHAR(20) NULL | 추천 성별 필터 (`male`/`female`/그 외 null), migration 004 |
| `role` | ENUM(user,admin) | 기본 user |
| `last_login_at`, `created_at`, `updated_at` | DATETIME | 타임스탬프 |

`products` — 상품 핵심(추천 후보의 원천)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` / `public_id` | BIGINT PK / VARCHAR(36) UNIQUE | |
| `origin_type` | ENUM(seed,batch,user_url) | 가시성 경계의 핵심, migration 003 |
| `owner_user_id` | BIGINT FK->users SET NULL | `user_url` 상품 소유자 |
| `crawl_job_id` | BIGINT FK->crawl_jobs SET NULL | 생성 출처 작업 |
| `source_url`, `source_domain` | TEXT / VARCHAR(255) | 출처 |
| `category_main`, `category_sub` | VARCHAR | top/bottom/shoes/outer 등 |
| `gender_target` | VARCHAR(40) | 성별 타깃 |
| `product_name`, `brand_name`, `hero_image_url` | | 표시용 |
| `price_original`, `price_sale`, `discount_rate`, `currency` | INT/DECIMAL/CHAR(3) | 가격 |
| `stock_status` | ENUM(in_stock,low_stock,sold_out,unknown) | sold_out 제외 필터 |
| `fit_type`, `silhouette`, `material_*`, `opacity`, `seasonality`, `color_family` | | 추천 신호 |
| `style_tags`, `occasion_tags`, `body_type_notes` | JSON | 태그/상황/체형 |
| `data_quality_score` | DECIMAL(4,3) | 데이터 품질 |
| 인덱스 | category / source_domain / stock / (origin_type,owner_user_id) | |

`crawl_jobs` — URL 분석 작업

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` / `public_id` | BIGINT PK / VARCHAR(36) | API는 public_id 사용 |
| `user_id` | BIGINT FK->users CASCADE | 작업 소유자 |
| `input_url`, `normalized_url`, `source_domain` | | 입력/정규화 URL |
| `status` | ENUM(queued,running,succeeded,failed,blocked) | 상태 전이 |
| `error_code`, `error_message` | | 실패/차단 사유 |
| `raw_result_json` | JSON | 워커 원본 결과 |
| `artifact_dir` | TEXT | `storage/crawls/{public_id}` |
| `product_id` | BIGINT FK->products SET NULL | 분석으로 만든 상품 |

`recommendation_runs` / `recommendation_outfits` / `recommendation_items` — 추천 영속화

| 테이블 | 핵심 컬럼 | 비고 |
| --- | --- | --- |
| `recommendation_runs` | `user_id` FK, `status`, `input_conditions_json`, `candidate_product_ids_json`, `model_name`, `model_usage_json`, `confidence` | 추천 요청 1건 = 1 run |
| `recommendation_outfits` | `run_id` FK CASCADE, `title`, `framing_label`(002), `reason_text`, `reasons_json`(002), `evidence_json`, `risk_notes_json`, `review_evidence`(002), `total_price`, `sort_order`, `confidence` | run당 보통 3개 코디 |
| `recommendation_items` | `outfit_id` FK CASCADE, `product_id` FK RESTRICT, `slot` ENUM(top,bottom,outer,shoes,accessory), `selected_variant_id` FK SET NULL, `alternative_product_ids_json` | 코디 구성 상품 |

`saved_outfits` / `feedback_events` — 사용자 액션

| 테이블 | 핵심 컬럼 | 비고 |
| --- | --- | --- |
| `saved_outfits` | `user_id` FK, `outfit_id` FK, UNIQUE(user_id,outfit_id) | 같은 코디 중복 저장 방지 |
| `feedback_events` | `user_id` FK, `outfit_id` FK NULL, `product_id` FK NULL, `feedback_type`, `tags_json`, `note` | 코디/상품 피드백 |

보조 테이블: `user_profiles`(1:1 확장, taste_memory_json 등), `product_variants`(색상/사이즈), `product_media`(image/screenshot), `reviews`(평점·사이즈 체감·complaint/praise 태그).

### 참조 무결성(FK ON DELETE) 요약

| 관계 | 동작 | 의미 |
| --- | --- | --- |
| user -> 대부분 자식(profile/crawl_jobs/runs/saved/feedback) | CASCADE | 사용자 삭제 시 데이터 정리 |
| run -> outfits -> items | CASCADE | 추천 트리 통째로 정리 |
| items -> products | RESTRICT | 추천에 묶인 상품은 삭제 차단 |
| items -> variant, crawl_job -> product | SET NULL | 참조만 끊고 행은 유지 |
| products.owner_user_id / crawl_job_id -> users/crawl_jobs | SET NULL | 출처 끊겨도 상품 보존 |

### 마이그레이션 적용 순서

현재 코드 기준 DB는 `database/migrations/001_initial_schema.sql`만으로는 부족하다. 아래 마이그레이션을 모두 순서대로 적용해야 현재 코드가 참조하는 컬럼이 갖춰진다.

| Migration | 추가/변경 내용 |
| --- | --- |
| `001_initial_schema.sql` | 기본 사용자, 상품, 리뷰, 크롤링, 추천, 저장, 피드백 테이블 |
| `002_outfit_display_fields.sql` | `recommendation_outfits.framing_label`, `reasons_json`, `review_evidence` |
| `003_product_origin_owner.sql` | `products.origin_type`, `owner_user_id`, `crawl_job_id`와 관련 FK/index |
| `004_user_gender.sql` | `users.gender` |

| 테이블 | 의미 |
| --- | --- |
| `users` | 사용자 계정, 로그인 정보, 성별 |
| `user_profiles` | 향후 확장용 프로필 |
| `products` | 상품 핵심 정보, 출처, 소유자, 추천 태그 |
| `product_variants` | 색상/사이즈 변형 |
| `product_media` | 이미지/스크린샷 |
| `reviews` | 리뷰와 사이즈 체감 |
| `crawl_jobs` | URL 분석 작업 상태와 raw 결과 |
| `recommendation_runs` | 추천 요청 단위 |
| `recommendation_outfits` | 추천된 코디 카드 |
| `recommendation_items` | 코디를 구성하는 상품 |
| `saved_outfits` | 사용자가 저장한 코디 |
| `feedback_events` | 코디/상품 피드백 |

중요한 데이터 경계:

- `origin_type='batch'`: 전체 사용자에게 추천 후보로 사용 가능
- `origin_type='user_url'`: 해당 `owner_user_id` 사용자 추천에만 포함
- `origin_type='seed'`: 현재 `ProductRepository::list()`, `findByPublicId()`, `findRecommendationCandidates()` 코드 경로에서는 제외된다.

## 런타임 저장소와 환경 의존성

| 경로/설정 | 용도 |
| --- | --- |
| MySQL + migrations `001`~`004` | API와 추천 영속화의 필수 DB |
| `storage/rate-limits` | 파일 기반 IP별 rate limit 기록 |
| `storage/crawls/{jobPublicId}` | URL 분석 스크린샷과 artifact 저장 |
| `storage/logs/openai` | OpenAI raw response와 fallback event 로그 |
| `storage/certs/cacert.pem` | 있으면 cURL CA bundle로 사용 |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | 추천 OpenAI 경로 활성화 조건 |
| `OPENAI_EXTRACTION_ENABLED` | URL 크롤링 상품 필드 OpenAI 보강 여부, 기본값 false |

## 배치 크롤러와 카탈로그 보강

### `crawler/musinsa-batch.js`

역할:

- Musinsa PLP API에서 카테고리별 상품 목록을 JSONL로 저장한다.
- operator용 배치 수집 스크립트다.
- 지터를 넣고, HTTP 오류/빈 페이지가 반복되면 중단한다.

### `crawler/musinsa-detail.js`

역할:

- 상품 상세 페이지에서 소재, 설명, 본문 등 추가 신호를 JSONL로 저장한다.
- 403/429 또는 bot-check 징후가 있으면 즉시 중단한다.

### `crawler/musinsa-normalize.js`

역할:

- batch JSONL과 detail JSONL을 합쳐 추천에 필요한 normalized record를 만든다.
- 소재, 시즌, 핏, 색상, 스타일 태그, 상황 태그, 리스크 flag를 추론한다.
- 크롤링 근거가 있으면 confidence를 높게, 이름 기반 추론이면 낮게 둔다.

### `crawler/apply-occasion-tags.js`

역할:

- normalized JSONL의 `occasionTags`를 seed SQL과 live DB update SQL에 반영한다.
- source URL 기준으로 매칭해 id 변경에 덜 민감하게 처리한다.

## 테스트 구조

실행 범위:

- `composer test`: `public/index.php` PHP lint와 Unit test suite를 실행한다.
- `composer test:unit`: Unit test suite만 실행한다.
- `composer test:feature`: Feature test suite를 실행하지만, MySQL과 테스트용 PHP 서버가 준비되어 있어야 한다. 현재 테스트 지원 코드는 기본적으로 `127.0.0.1:8002` 서버를 기대한다.
- `composer test:all`: Unit + Feature 전체를 실행한다.

| 테스트 | 보장하는 내용 |
| --- | --- |
| `tests/Feature/HealthEndpointTest.php` | health, csrf, unknown API 404 |
| `tests/Feature/AuthFlowTest.php` | 회원가입/로그인/로그아웃, CSRF 차단, 중복 가입, 사용자 열거 방지 |
| `tests/Feature/CatalogTest.php` | 상품 목록, cursor, 필터, 상세, 404 |
| `tests/Feature/RecommendationVarianceTest.php` | 예산/핏/상황 변화가 추천 결과를 바꾸는지, 3개 코디 중복 방지 |
| `tests/Unit/Services/UrlSafetyServiceTest.php` | SSRF 방어: scheme, port, private IP, ambiguous host |
| `tests/Unit/Services/CrawlerServiceHelpersTest.php` | 워커 stdout 파싱, 이미지 선택, extraction payload, stderr sanitize |
| `tests/Unit/Services/RecommendationServicePruneBudgetTest.php` | 예산 pruning과 coverage relaxation |
| `tests/Unit/Repositories/ProductRepositoryScoreTest.php` | 추천 후보 점수화 |
| `tests/Unit/Repositories/ProductRepositorySanitizeTest.php` | 크롤링/OpenAI 텍스트 sanitize |
| `tests/Unit/Support/ResponseValidatorTest.php` | OpenAI 추천/추출 응답 검증 |
| `tests/Unit/Support/PublicIdTest.php` | public id 길이, alphabet, 유일성, 시간 prefix |
| `tests/Unit/Support/JsonColumnTest.php` | JSON 컬럼 decode 안전성 |
| `tests/Unit/ConfigTest.php` | `.env` 파서 |

## 핵심 사용자 시나리오별 코드 흐름

### 1. 사용자가 로그인한다

```text
auth.js / authModal.js
  -> /api/csrf
  -> /api/auth/login
  -> Bootstrap CSRF + rate limit
  -> AuthController::login()
  -> AuthService::login()
  -> UserRepository::findAuthRecordByEmail()
  -> password_verify()
  -> $_SESSION['auth_user']
```

### 2. 사용자가 추천을 받는다

```text
landing.js
  -> state.onboarding.situation
onboarding.js
  -> state.onboarding 조건 누적
loading.js
  -> POST /api/recommendations
RecommendationController
  -> RecommendationService::generate()
ProductRepository
  -> slot별 후보 조회와 점수화
OpenAIService + ResponseValidator
  -> 가능하면 OpenAI 추천
RecommendationService fallback
  -> 실패하면 deterministic 3개 코디 생성
RecommendationRepository
  -> run/outfit/item 저장
recommendationAdapter.js
  -> UI shape 변환
results.js
  -> 카드 렌더링
```

### 3. 상품 URL 분석 컴포넌트가 노출된 경우 추천에 반영한다

```text
urlAnalyzer.js
  -> POST /api/catalog/analyze-url
UrlSafetyService
  -> URL/host/IP/port 검증
CrawlerService
  -> Playwright worker 실행
generic adapter
  -> 상품명/브랜드/가격/이미지 추출
ProductRepository::upsertFromCrawl()
  -> user_url 상품 저장
sourceProducts.js
  -> product public id를 sessionStorage에 저장
loading.js
  -> 다음 추천 요청 sourceProductIds로 전달
ProductRepository::scoreCandidate()
  -> 해당 상품 +5 점수
```

### 4. 사용자가 코디를 저장한다

```text
results.js 또는 detail.js
  -> toggleSaveFromClick()
  -> state.toggleSaved()로 즉시 UI 반영
  -> persistToggleSaved()
  -> POST /api/saved-outfits 또는 DELETE /api/saved-outfits/{id}
  -> UserActionController
  -> SavedOutfitRepository
  -> 실패 시 프론트 상태 롤백
```

### 5. 사용자가 피드백을 남긴다

```text
detail.js 또는 saved.js
  -> state.addFeedback()
  -> persistFeedback()
  -> POST /api/feedback
  -> UserActionController::submitFeedback()
  -> FeedbackRepository::record()
```

## 설계상 중요한 포인트

1. 추천은 OpenAI 의존 기능이지만, OpenAI가 없어도 fallback 추천이 동작한다.
2. OpenAI 응답은 schema와 서버 validator를 모두 통과해야 저장된다.
3. 사용자 URL로 분석한 상품은 owner-scoped라 다른 사용자 추천 후보로 새지 않는다.
4. 프론트는 `recommendationAdapter.js`를 통해 백엔드 응답 shape와 UI shape를 분리한다.
5. 저장/삭제는 optimistic update지만 실패 시 롤백한다.
6. URL 분석은 SSRF 방어가 강하게 들어가 있고, Playwright 워커도 단일 navigation 정책을 따른다. 다만 현재 화면에서는 URL analyzer가 mount되어 있지 않다.
7. 추천 결과는 DB에 저장되므로 `results` 화면에 도달했을 때 `lastRunId`로 재조회할 수 있다. 앱 부트스트랩 자체는 이전 화면을 복원하지 않는다.

## 주의해서 볼 부분

- 이 문서 자체는 UTF-8 기준으로 한글이 정상 표시된다. 다만 Windows PowerShell 기본 출력처럼 UTF-8이 아닌 콘솔에서는 한글이 깨져 보일 수 있다.
- 소스 코드의 일부 한국어 문자열과 주석은 mojibake 형태로 깨져 보인다. 기능 구조는 읽을 수 있지만, 사용자 노출 문구와 주석은 별도 인코딩 정리가 필요하다.
- `README.md`는 현재 실제 백엔드 구조와 일부 오래된 설명이 섞여 있고, 문서 인코딩도 깨져 보인다.
- `public/js/api/contracts.js`에서 URL 분석 endpoint 상태가 `planned-day-7`로 남아 있지만 실제 라우트는 구현되어 있다. 문서/상태 상수 갱신 여지가 있다.
- feature 테스트 일부는 MySQL과 실행 중인 dev server에 의존한다. 로컬 환경이 준비되지 않으면 skip 또는 실패할 수 있다.

## Subagent 검토 반영 내역

| 검토 관점 | 반영 내용 |
| --- | --- |
| Backend mapper | route/auth/CSRF/rate-limit 표 보강, `/api/health` 특수 응답 형태 명시, 회원가입 gender 정규화와 프로필 수정 검증 차이 명시 |
| Backend mapper | DB 마이그레이션 `001`~`004` 적용 전제, runtime storage 경로, OpenAI extraction 기본 off, same URL ownership 보존 edge case 추가 |
| Backend mapper | `DELETE /api/saved-outfits/{id}`의 id가 saved row id가 아니라 outfit public id임을 명시 |
| Frontend mapper | `urlAnalyzer.js`는 구현되어 있지만 현재 화면에 mount되지 않는다는 현재 상태 반영 |
| Frontend mapper | reload 시 앱이 이전 화면을 복원하지 않고, `results.js` 내부에서만 `lastRunId` rehydrate가 동작한다는 점 보강 |
| Frontend mapper | 저장 optimistic update의 rollback 범위를 `api-error` 중심으로 정확히 수정하고, unauthenticated/local fallback은 로컬 상태가 남을 수 있음을 명시 |
| Frontend mapper | 프론트 저장소 key와 auth-first gated routing 구조 추가 |
