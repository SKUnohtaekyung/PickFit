# PickFit Tech Spec
> Project: 픽핏 (PickFit)  
> Purpose: FE/BE/Database implementation contract for turning the current static prototype into a running PHP/MySQL/OpenAI/Playwright app  
> Source priority: `design_system.md` -> `PickFit.md` -> `tech.md` -> implementation details  
> Last updated: 2026-05-17

---

## 0. 전문가 역할과 판단 프로세스

### 자동 선택 역할
**AI 커머스 풀스택 아키텍트**

### 이 역할을 선택한 이유
픽핏은 단순 프론트엔드 페이지가 아니라, 상품 데이터 수집, 데이터 정규화, GPT 기반 설명 생성, 사용자 피드백 저장, 추천 결과 재현성을 모두 다루는 AI 커머스 시스템이다. 따라서 프론트엔드 구현자 관점만으로는 부족하고, PHP API, MySQL 스키마, Playwright 크롤링, OpenAI Structured Outputs, 보안 경계를 함께 설계하는 역할이 필요하다.

### 사고 프로세스
1. **제품 철학 고정**: `PickFit.md`의 핵심인 "패션 탐색 앱이 아니라 패션 결정 엔진"을 최우선 기준으로 둔다.
2. **기존 코드 존중**: 현재 `index.html`, `js/screens/*`, `js/data/mock.js`, `css/styles.css`로 구성된 모바일 우선 Vanilla JS SPA를 버리지 않고 API 기반으로 점진 전환한다.
3. **실행 가능한 스택 선택**: 첨부 이미지의 FE/BE/DB/AI 구성을 그대로 받아 `HTML5 + Tailwind CSS + JavaScript + PHP + MySQL + GPT API + Playwright`로 확정한다.
4. **사용자 URL 분석의 안전 경계 설정**: 사용자가 URL을 넣어 분석할 수 있게 하되, 사설망 접근(SSRF)은 차단한다.
5. **AI 출력 신뢰성 확보**: GPT 결과는 자연어 덩어리가 아니라 DB와 UI가 검증할 수 있는 JSON Schema 기반 구조화 결과로 제한한다.

---

## 1. 현재 프로젝트 분석

### 1.1 현재 구조

```text
/
├─ index.html
├─ PickFit.md
├─ design_system.md
├─ css/
│  └─ styles.css
├─ js/
│  ├─ app.js
│  ├─ components/navbar.js
│  ├─ data/mock.js
│  ├─ screens/
│  │  ├─ landing.js
│  │  ├─ onboarding.js
│  │  ├─ loading.js
│  │  ├─ results.js
│  │  ├─ comparison.js
│  │  ├─ detail.js
│  │  └─ saved.js
│  └─ utils/
│     ├─ state.js
│     └─ animations.js
├─ assets/
│  ├─ products/*.webp
│  └─ img/*.png
├─ img/logo/*.png
└─ LOGO/*.png
```

### 1.2 현재 앱 동작

- `js/app.js`가 SPA router 역할을 하며 화면을 동적으로 렌더링한다.
- `state.js`는 `localStorage` 기반으로 온보딩, 추천 결과, 저장 목록, 피드백을 저장한다.
- `mock.js`는 상황/예산/무드/핏/색상/회피 조건과 상품/코디 mock 데이터를 제공한다.
- `loading.js`는 실제 API 호출 없이 로딩 애니메이션 후 mock 추천을 `state.recommendations`에 넣는다.
- `results.js`, `comparison.js`, `detail.js`, `saved.js`는 모두 mock outfit/product 구조에 의존한다.
- `index.html`은 Tailwind CDN과 `css/styles.css`를 동시에 사용한다.

### 1.3 구현 전환의 핵심 과제

1. `mock.js` 데이터를 MySQL seed/catalog 데이터로 전환한다.
2. `localStorage` 저장을 로그인 사용자 기반 DB 저장으로 전환한다.
3. `loading.js`의 가짜 AI 처리 과정을 실제 `/api/recommendations` 호출과 job 상태로 교체한다.
4. 사용자 URL 분석을 Playwright 기반 크롤링 job으로 구현한다.
5. GPT API 응답을 추천 UI가 그대로 사용할 수 있는 구조화 JSON으로 저장한다.
6. Tailwind CDN은 빌드 기반 CSS로 교체한다.

---

## 2. 첨부 이미지 분석

### 2.1 이미지 1: 기술 스택 카드

이미지는 픽핏 구현 기술을 다음 4개 축으로 나눈다.

| 축 | 명시 기술 | 구현 해석 |
|---|---|---|
| FE | HTML5, Tailwind CSS, JavaScript | 현재 Vanilla JS SPA를 유지하되 Tailwind CLI 빌드와 API client 계층을 추가한다. |
| BE | PHP | Laravel 없이 PHP 8.2+ 단일 서버, Composer autoload, PDO, front controller 구조로 시작한다. |
| DB | MySQL | 상품/리뷰/추천/사용자/피드백을 정규화하고 추천 결과는 run 단위로 재현 가능하게 저장한다. |
| AI | GPT API | OpenAI Responses API와 Structured Outputs를 사용해 상품 추출/추천/설명 생성을 schema 기반으로 제한한다. |

### 2.2 이미지 2: AI 추천 파이프라인

이미지는 3단계 흐름을 제시한다.

1. **데이터 수집**
   - Playwright 기반 화면 크롤링으로 상품 정보를 수집한다.
   - 구현에서는 사용자 제출 URL을 crawl job으로 등록하고, Playwright CLI가 공개 상품 페이지의 DOM/meta/image/screenshot을 수집한다.

2. **조건 분석**
   - GPT API가 사용자의 상황, 취향, 체형, 예산을 분석한다.
   - 구현에서는 온보딩 답변과 사용자 free text, 저장/피드백 이력을 recommendation input으로 묶는다.

3. **추천 생성**
   - 코디 3세트와 추천 이유를 생성한다.
   - 구현에서는 GPT가 직접 없는 상품을 만들어내지 못하게 하고, DB의 후보 상품만 조합하도록 한다.

### 2.3 기존 문서와 이미지의 충돌 조정

이미지의 Playwright 크롤링 명시를 그대로 수용한다.

MVP 정의는 다음처럼 확정한다.

- 허용: 사용자가 공개 상품 URL을 제출하면 픽핏이 해당 URL을 분석한다. 운영자 측 배치 수집/카탈로그 확장도 허용.
- 카탈로그 저장: 분석 결과는 `products` 테이블에 후보 데이터로 저장한다.
- 우선 품질 보장: 도메인 adapter가 있는 쇼핑몰은 높은 confidence, 일반 URL은 낮은 confidence로 처리한다.
- 기술 안전: 사설망 접근(SSRF) 차단은 `UrlSafetyService`로 유지한다.

---

## 3. 확정 기술 스택

### 3.1 Frontend

- HTML5
- Vanilla JavaScript ES Modules
- Tailwind CSS CLI build
- Existing `css/styles.css` design tokens 유지
- Browser Fetch API
- No React/Vue in MVP

### 3.2 Backend

- PHP 8.2+
- Composer PSR-4 autoload
- PDO MySQL
- Native PHP session
- Front controller: `public/index.php`
- JSON API first
- No Laravel/Symfony in MVP

### 3.3 Database

- MySQL 8+
- Charset: `utf8mb4`
- Collation: `utf8mb4_0900_ai_ci`
- Engine: InnoDB
- Timezone storage: UTC
- App display timezone: Asia/Seoul

### 3.4 Crawling

- Node.js 20+
- Playwright Chromium
- CLI script: `crawler/playwright-crawl.js`
- PHP launches CLI with sanitized arguments and timeout
- Crawl artifacts stored under `storage/crawls/{job_id}/`

### 3.5 AI

- OpenAI Responses API
- Structured Outputs with JSON Schema
- Default model: use `OPENAI_MODEL` env var
- Recommended initial model: latest account-available GPT model that supports Structured Outputs
- Do not hardcode model in business logic

### 3.6 Build and Tooling

- Composer for PHP dependencies
- npm for Playwright and Tailwind CLI
- PHPUnit for backend unit tests
- Playwright test runner can be added later for FE E2E

---

## 4. Target Repository Structure

Implementation should migrate toward this structure.

```text
/
├─ public/
│  ├─ index.php                 # API front controller
│  ├─ app.html                  # migrated SPA entry, or index.html if served by PHP
│  ├─ css/
│  │  ├─ input.css              # @import "tailwindcss" + custom imports
│  │  └─ app.css                # compiled output
│  ├─ js/
│  │  ├─ app.js
│  │  ├─ api/client.js
│  │  ├─ api/auth.js
│  │  ├─ api/catalog.js
│  │  ├─ api/recommendations.js
│  │  └─ ...
│  ├─ assets/
│  └─ img/
├─ src/
│  ├─ Bootstrap.php
│  ├─ Config.php
│  ├─ Database.php
│  ├─ Http/
│  │  ├─ Router.php
│  │  ├─ Request.php
│  │  ├─ Response.php
│  │  └─ Middleware/
│  ├─ Controllers/
│  │  ├─ AuthController.php
│  │  ├─ CatalogController.php
│  │  ├─ RecommendationController.php
│  │  └─ UserActionController.php
│  ├─ Services/
│  │  ├─ AuthService.php
│  │  ├─ CrawlerService.php
│  │  ├─ OpenAIService.php
│  │  ├─ RecommendationService.php
│  │  └─ UrlSafetyService.php
│  ├─ Repositories/
│  │  ├─ UserRepository.php
│  │  ├─ ProductRepository.php
│  │  ├─ CrawlJobRepository.php
│  │  ├─ RecommendationRepository.php
│  │  └─ FeedbackRepository.php
│  └─ Support/
│     ├─ Validator.php
│     └─ JsonSchema.php
├─ crawler/
│  ├─ playwright-crawl.js
│  ├─ adapters/
│  │  ├─ generic.js
│  │  └─ musinsa.js              # optional after generic works
│  └─ schemas/
│     └─ crawl-result.schema.json
├─ database/
│  ├─ migrations/
│  │  └─ 001_initial_schema.sql
│  └─ seeds/
│     └─ mock_catalog_seed.sql
├─ storage/
│  ├─ crawls/
│  ├─ logs/
│  └─ cache/
├─ tests/
│  ├─ Unit/
│  └─ Api/
├─ composer.json
├─ package.json
├─ .env.example
├─ PickFit.md
├─ design_system.md
└─ tech.md
```

### Migration rule

The current root-level `index.html`, `css`, `js`, `assets`, and `img` may remain temporarily during migration. The target state is to serve all browser-accessible files from `public/`.

---

## 5. Runtime Architecture

```text
Browser SPA
  |
  | fetch /api/*
  v
PHP public/index.php
  |
  +-- Auth/session/CSRF middleware
  |
  +-- Controllers
  |
  +-- Services
  |    +-- MySQL via PDO
  |    +-- OpenAI Responses API
  |    +-- Node Playwright CLI subprocess
  |
  v
MySQL

Playwright crawl flow:
Browser -> POST /api/catalog/analyze-url
PHP -> create crawl_jobs row
PHP -> run node crawler/playwright-crawl.js --job-id ... --url ...
Node -> outputs JSON + screenshot artifacts
PHP -> normalize and insert/update products, media, reviews
Browser -> GET /api/catalog/crawl-jobs/{id}
```

### Important boundary

PHP is the only HTTP backend in MVP. Playwright is not a public server. It is a local CLI worker launched by PHP.

### MVP execution decision

To keep the PHP single-server requirement realistic, MVP background work is implemented as **foreground job execution with persisted job rows**.

- `POST /api/catalog/analyze-url` creates a `crawl_jobs` row, sets it to `running`, executes `node crawler/playwright-crawl.js` with a hard timeout, stores the result, then returns the current job state.
- `GET /api/catalog/crawl-jobs/{id}` still exists so the frontend can use the same polling UI now and later.
- `POST /api/recommendations` creates a `recommendation_runs` row, generates recommendations synchronously within `OPENAI_TIMEOUT_SECONDS`, stores results, then returns the run.
- If these calls exceed the configured timeout, mark the job/run as `failed` and return a retry-safe error.
- A real queue worker is explicitly a post-MVP scale improvement, not a requirement for first runnable implementation.

---

## 6. Environment Variables

Create `.env.example` with these keys.

```dotenv
APP_ENV=local
APP_URL=http://127.0.0.1:8000
APP_TIMEZONE=Asia/Seoul
SESSION_NAME=pickfit_session
SESSION_SECURE=false

DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pickfit
DB_USERNAME=root
DB_PASSWORD=

OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_TIMEOUT_SECONDS=45

NODE_BINARY=node
PLAYWRIGHT_CRAWLER_PATH=crawler/playwright-crawl.js
CRAWL_TIMEOUT_SECONDS=45
CRAWL_ARTIFACT_ROOT=storage/crawls
CRAWL_MAX_TEXT_CHARS=20000
CRAWL_MAX_IMAGE_COUNT=12

RATE_LIMIT_AUTH_PER_HOUR=20
RATE_LIMIT_CRAWL_PER_HOUR=10
RATE_LIMIT_RECOMMEND_PER_HOUR=20
```

---

## 7. Database Schema

### 7.1 Naming rules

- Primary keys use `BIGINT UNSIGNED AUTO_INCREMENT`.
- Public identifiers use `CHAR(26)` ULID or `VARCHAR(36)` UUID in `public_id`.
- All user-facing object lookup APIs should use `public_id`, not numeric IDs.
- Every table has `created_at`.
- Mutable tables have `updated_at`.
- Soft delete is only added where product requirements need it.

### 7.2 Initial schema

```sql
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  gender_expression VARCHAR(40) NULL,
  preferred_size_top VARCHAR(20) NULL,
  preferred_size_bottom VARCHAR(20) NULL,
  preferred_shoe_size VARCHAR(20) NULL,
  default_budget_min INT NULL,
  default_budget_max INT NULL,
  taste_memory_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  source_url TEXT NULL,
  source_domain VARCHAR(255) NULL,
  brand_name VARCHAR(120) NULL,
  seller_name VARCHAR(120) NULL,
  category_main VARCHAR(80) NOT NULL,
  category_sub VARCHAR(80) NULL,
  gender_target VARCHAR(40) NULL,
  product_name VARCHAR(255) NOT NULL,
  hero_image_url TEXT NULL,
  product_page_url TEXT NULL,
  price_original INT NULL,
  price_sale INT NULL,
  discount_rate DECIMAL(5,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KRW',
  stock_status ENUM('in_stock', 'low_stock', 'sold_out', 'unknown') NOT NULL DEFAULT 'unknown',
  fit_type VARCHAR(40) NULL,
  silhouette VARCHAR(80) NULL,
  material_main VARCHAR(120) NULL,
  material_sub VARCHAR(255) NULL,
  thickness VARCHAR(40) NULL,
  opacity VARCHAR(40) NULL,
  stretch VARCHAR(40) NULL,
  seasonality VARCHAR(80) NULL,
  color_family VARCHAR(80) NULL,
  style_tags JSON NULL,
  occasion_tags JSON NULL,
  body_type_notes JSON NULL,
  shipping_fee INT NULL,
  free_shipping_threshold INT NULL,
  estimated_shipping_days VARCHAR(40) NULL,
  returnable TINYINT(1) NULL,
  return_fee INT NULL,
  exchange_fee INT NULL,
  policy_note TEXT NULL,
  data_quality_score DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category_main, category_sub),
  INDEX idx_products_source_domain (source_domain),
  INDEX idx_products_stock (stock_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  color_name VARCHAR(80) NULL,
  color_code_normalized VARCHAR(40) NULL,
  size_label VARCHAR(40) NULL,
  size_system VARCHAR(40) NULL,
  stock_status ENUM('in_stock', 'low_stock', 'sold_out', 'unknown') NOT NULL DEFAULT 'unknown',
  variant_url TEXT NULL,
  variant_image_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_variants_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE product_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  media_type ENUM('image', 'screenshot') NOT NULL,
  url TEXT NOT NULL,
  local_path TEXT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_media_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  rating DECIMAL(3,2) NULL,
  review_text TEXT NULL,
  created_at_source DATETIME NULL,
  verified_purchase TINYINT(1) NULL,
  reviewer_height INT NULL,
  reviewer_weight INT NULL,
  usual_size VARCHAR(40) NULL,
  purchased_size VARCHAR(40) NULL,
  size_runs ENUM('small', 'true', 'large', 'unknown') NOT NULL DEFAULT 'unknown',
  fit_satisfaction VARCHAR(80) NULL,
  material_satisfaction VARCHAR(80) NULL,
  complaint_tags JSON NULL,
  praise_tags JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_reviews_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE crawl_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  input_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  source_domain VARCHAR(255) NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed', 'blocked') NOT NULL DEFAULT 'queued',
  adapter_name VARCHAR(80) NOT NULL DEFAULT 'generic',
  error_code VARCHAR(80) NULL,
  error_message TEXT NULL,
  raw_result_json JSON NULL,
  artifact_dir TEXT NULL,
  product_id BIGINT UNSIGNED NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_crawl_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crawl_jobs_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_crawl_jobs_user_status (user_id, status),
  INDEX idx_crawl_jobs_domain (source_domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recommendation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(26) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
  input_conditions_json JSON NOT NULL,
  candidate_product_ids_json JSON NOT NULL,
  model_name VARCHAR(120) NULL,
  model_response_id VARCHAR(255) NULL,
  model_usage_json JSON NULL,
  confidence DECIMAL(4,3) NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recommendation_runs_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recommendation_outfits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT UNSIGNED NOT NULL,
  public_id CHAR(26) NOT NULL UNIQUE,
  rank_no INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  framing_label VARCHAR(120) NULL,
  summary TEXT NOT NULL,
  total_price_min INT NULL,
  total_price_max INT NULL,
  reasons_json JSON NOT NULL,
  risks_json JSON NULL,
  review_evidence TEXT NULL,
  comparison_json JSON NOT NULL,
  confidence DECIMAL(4,3) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_outfits_run FOREIGN KEY (run_id) REFERENCES recommendation_runs(id) ON DELETE CASCADE,
  UNIQUE KEY uq_recommendation_outfit_rank (run_id, rank_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE recommendation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  outfit_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  slot ENUM('top', 'bottom', 'outer', 'shoes', 'accessory') NOT NULL,
  selected_variant_id BIGINT UNSIGNED NULL,
  alternative_product_ids_json JSON NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_items_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE CASCADE,
  CONSTRAINT fk_recommendation_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_recommendation_items_variant FOREIGN KEY (selected_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  INDEX idx_recommendation_items_outfit (outfit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE saved_outfits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  outfit_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_outfits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_outfits_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved_outfits_user_outfit (user_id, outfit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE feedback_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  outfit_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  feedback_type VARCHAR(80) NOT NULL,
  tags_json JSON NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_events_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedback_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_feedback_events_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

## 8. API Contract

### 8.1 Common response shape

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "req_...",
    "serverTime": "2026-05-17T12:00:00+09:00"
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "validation_failed",
    "message": "입력값을 확인해주세요.",
    "fields": {
      "email": "올바른 이메일 형식이 아닙니다."
    }
  },
  "meta": {
    "requestId": "req_...",
    "serverTime": "2026-05-17T12:00:00+09:00"
  }
}
```

### 8.2 Auth API

#### `POST /api/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "string-min-8",
  "displayName": "선택"
}
```

Rules:

- Email is unique.
- Password minimum 8 characters.
- Store only `password_hash()`.
- After successful register, create session and return user.

Response:

```json
{
  "user": {
    "id": "01HX...",
    "email": "user@example.com",
    "displayName": "선택"
  }
}
```

#### `POST /api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

Rules:

- Use `password_verify()`.
- Regenerate session ID after login.
- Return generic error for wrong email or password.

#### `POST /api/auth/logout`

- Destroy session.
- Return `{ "loggedOut": true }`.

#### `GET /api/auth/me`

- Return current session user or `401 unauthenticated`.

### 8.3 Catalog and crawl API

#### `POST /api/catalog/analyze-url`

Request:

```json
{
  "url": "https://example-shop.com/product/123"
}
```

Validation:

- Required.
- Must be `http` or `https`.
- Must not resolve to private, loopback, link-local, multicast, or reserved IP ranges.
- Must not contain credentials in URL.
- Must not exceed 2048 chars.
- User must be logged in.
- Rate limit per user.

Response:

```json
{
  "job": {
    "id": "01HX...",
    "status": "queued",
    "inputUrl": "https://example-shop.com/product/123",
    "sourceDomain": "example-shop.com"
  }
}
```

#### `GET /api/catalog/crawl-jobs/{id}`

Response:

```json
{
  "job": {
    "id": "01HX...",
    "status": "succeeded",
    "sourceDomain": "example-shop.com",
    "adapterName": "generic",
    "product": {
      "id": "01HY...",
      "name": "상품명",
      "brandName": "브랜드",
      "priceSale": 49000,
      "heroImageUrl": "https://..."
    },
    "error": null
  }
}
```

### 8.4 Product API

#### `GET /api/products`

Query:

- `category`
- `situation`
- `style`
- `maxPrice`
- `limit`
- `cursor`

Response:

```json
{
  "products": [
    {
      "id": "01HY...",
      "brandName": "STANDARD.O",
      "productName": "슬림핏 코튼 셔츠",
      "categoryMain": "top",
      "priceSale": 49000,
      "heroImageUrl": "/assets/products/shirt_white.webp",
      "fitType": "slim",
      "seasonality": "봄/가을",
      "stockStatus": "in_stock"
    }
  ],
  "nextCursor": null
}
```

#### `GET /api/products/{id}`

- Return normalized product, variants, media, review summaries, shipping/return policy.

### 8.5 Recommendation API

#### `POST /api/recommendations`

Request:

```json
{
  "conditions": {
    "situation": "office",
    "budget": "50k-100k",
    "mood": ["minimal", "clean"],
    "fit": "regular",
    "bodyType": ["broad_shoulders"],
    "colors": ["black", "navy"],
    "avoidances": ["tight"],
    "freeText": "출근용으로 너무 튀지 않았으면 좋겠어요"
  },
  "sourceProductIds": ["01HY..."]
}
```

Rules:

- Must be logged in.
- `situation`, `budget`, `mood`, `fit` required.
- Use source products from user crawls plus seed catalog.
- Hard filters first: budget, stock, avoidances, situation.
- If fewer than required candidates exist, return lower confidence with disclosure.

Response:

```json
{
  "run": {
    "id": "01HZ...",
    "status": "succeeded",
    "confidence": 0.82,
    "outfits": [
      {
        "id": "01HZ...",
        "rank": 1,
        "title": "오피스 깔끔 코어",
        "framingLabel": "출근 상황에 가장 적합",
        "summary": "깔끔한 세미포멀 출근룩",
        "totalPrice": 127000,
        "reasons": [
          "출근 상황에 적합한 세미포멀 실루엣",
          "리뷰에서 정사이즈 평이 높음"
        ],
        "risks": [
          {
            "type": "warning",
            "text": "어깨가 넓으면 셔츠 한 치수 업을 권장합니다."
          }
        ],
        "items": [
          {
            "slot": "top",
            "product": {
              "id": "01HY...",
              "brandName": "STANDARD.O",
              "productName": "슬림핏 코튼 셔츠",
              "priceSale": 49000,
              "heroImageUrl": "/assets/products/shirt_white.webp"
            },
            "alternatives": []
          }
        ],
        "comparison": {
          "price": "127,000원",
          "fit": "레귤러/슬림",
          "material": "면 혼방",
          "season": "봄/가을",
          "shipping": "무료 / 2일",
          "returnFee": "무료~3,000원",
          "reviewSummary": "사이즈 적당, 소재 좋음",
          "fitRisk": "낮음"
        }
      }
    ]
  }
}
```

#### `GET /api/recommendations/{id}`

- Return run status and stored outfits.
- Used if recommendation generation becomes async.

### 8.6 User action API

#### `GET /api/saved-outfits`

- Return saved outfits for current user.

#### `POST /api/saved-outfits`

Request:

```json
{
  "outfitId": "01HZ..."
}
```

#### `DELETE /api/saved-outfits/{id}`

- Delete saved relation for current user only.

#### `POST /api/feedback`

Request:

```json
{
  "outfitId": "01HZ...",
  "productId": null,
  "feedbackType": "not_my_taste",
  "tags": ["too_basic", "show_more"],
  "note": "좀 더 캐주얼했으면 좋겠어요"
}
```

Rules:

- Store as append-only event.
- Later recommendations read recent feedback as taste memory.

---

## 9. PHP Backend Design

### 9.1 Request lifecycle

1. `public/index.php` loads Composer autoload and `.env`.
2. `Bootstrap` creates config, PDO, router, session.
3. Router matches method + path.
4. Middleware runs:
   - request ID
   - JSON body parse
   - session start
   - CSRF for mutating requests
   - auth for protected routes
   - rate limit for auth/crawl/recommend
5. Controller validates input and calls service.
6. Service uses repository and external clients.
7. Response helper emits JSON with status code.

### 9.2 Router behavior

- `/api/*` returns JSON only.
- Static assets are served by web server from `public/`.
- Unknown non-API routes return SPA HTML.
- Unknown API routes return `404 route_not_found`.

### 9.3 Session and CSRF

- Use `session.cookie_httponly=true`.
- Use secure cookie in production.
- Use `SameSite=Lax`.
- Regenerate session ID after login/register.
- CSRF token endpoint:
  - `GET /api/csrf`
  - returns token stored in session.
- Mutating requests require `X-CSRF-Token` except initial login/register if same-origin constraints are enforced. Preferred: require it for all POST after first page load.

### 9.4 Password handling

- Use `password_hash($password, PASSWORD_DEFAULT)`.
- Use `password_verify()`.
- Do not log passwords.
- Enforce minimum password length.

### 9.5 PDO rules

- Use prepared statements only.
- Set error mode to exceptions.
- Wrap recommendation generation persistence in transactions.
- Store external API raw responses only where needed and never store API keys.

### 9.6 PHP subprocess rule for crawler

Use `proc_open()` or Symfony Process if installed. The command must be built as an array-like escaped command, not string concatenation.

Required safeguards:

- Pass job ID and URL as arguments after URL safety validation.
- Set timeout.
- Limit stdout/stderr size.
- Store stderr summary in `crawl_jobs.error_message` on failure.
- Do not expose raw stderr to the browser.

---

## 10. Playwright Crawling Design

### 10.1 CLI command

```bash
node crawler/playwright-crawl.js \
  --job-id 01HZ... \
  --url https://example-shop.com/product/123 \
  --artifact-dir storage/crawls/01HZ... \
  --max-text-chars 20000 \
  --max-images 12
```

### 10.2 CLI output contract

The script writes JSON to stdout.

```json
{
  "ok": true,
  "url": "https://example-shop.com/product/123",
  "finalUrl": "https://example-shop.com/product/123",
  "domain": "example-shop.com",
  "adapter": "generic",
  "title": "상품명",
  "meta": {
    "description": "상품 설명",
    "ogTitle": "OG title",
    "ogImage": "https://..."
  },
  "extracted": {
    "brandName": null,
    "productName": "상품명",
    "priceCandidates": [49000],
    "imageUrls": ["https://..."],
    "text": "페이지에서 추출한 텍스트"
  },
  "artifacts": {
    "screenshotPath": "storage/crawls/01HZ/screenshot.png"
  },
  "warnings": []
}
```

Failure:

```json
{
  "ok": false,
  "errorCode": "navigation_timeout",
  "errorMessage": "Page navigation timed out",
  "warnings": []
}
```

### 10.3 Playwright implementation requirements

- Use Chromium headless by default.
- Use a fresh browser context per job.
- Set viewport to a common desktop size first: `1365x768`.
- Use timeout for navigation and selectors.
- Use `page.goto(url, { waitUntil: 'domcontentloaded', timeout })`.
- Avoid `networkidle` as the only readiness condition because many commerce sites keep network requests open.
- Capture screenshot after initial extraction.
- Close context and browser in `finally`.
- Do not use a persistent logged-in profile.
- Do not install or run browser extensions.

### 10.4 Generic extraction strategy

Order of extraction:

1. JSON-LD product schema from `script[type="application/ld+json"]`
2. Open Graph meta tags
3. Common product selectors
4. Visible text fallback
5. Image candidates from `img`, `picture`, `meta[property="og:image"]`

Generic fields:

- `productName`
- `brandName`
- `priceCandidates`
- `currencyCandidates`
- `imageUrls`
- `description`
- `optionText`
- `shippingText`
- `returnPolicyText`
- `reviewTextCandidates`

### 10.5 Adapter strategy

`crawler/adapters/generic.js` is mandatory. Domain-specific adapters are optional but should be added for quality.

Adapter interface:

```js
export async function extract({ page, url, artifactDir, limits }) {
  return {
    adapter: "generic",
    title: "",
    meta: {},
    extracted: {},
    warnings: []
  };
}
```

### 10.6 URL safety

PHP must validate before invoking Node.

Block:

- `localhost`, `127.0.0.0/8`, `::1`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `169.254.0.0/16`
- private IPv6 ranges
- `file:`, `ftp:`, `data:`, `javascript:` schemes
- URLs with username/password
- redirects to blocked hosts

The crawler must also verify `page.url()` after navigation and reject blocked final URLs.

### 10.7 Policy boundary

The crawler must not:

- bypass login walls
- solve CAPTCHA
- click purchase or cart buttons
- submit forms except harmless cookie consent close when necessary
- scrape personal account pages
- perform bulk crawling without explicit job creation and rate limit

---

## 11. OpenAI / GPT Design

### 11.1 Official implementation basis

Use the OpenAI Responses API. Current official guidance highlights:

- Responses API as the primary API surface for modern model workflows.
- Structured Outputs for schema-adherent JSON.
- Refusal handling as a programmatic branch.
- Prompt caching for repeated stable prompts.
- Reasoning effort controls for quality/latency tradeoff.

### 11.2 OpenAI service responsibilities

`OpenAIService` should expose two internal methods:

1. `extractProductFieldsFromCrawl(crawlResult): ProductExtractionResult`
2. `generateRecommendations(userConditions, candidates, feedbackHistory): RecommendationResult`

### 11.3 Product extraction schema

Use this schema for GPT-assisted normalization after Playwright extraction.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "productName",
    "brandName",
    "categoryMain",
    "categorySub",
    "priceSale",
    "currency",
    "fitType",
    "materialMain",
    "colorFamily",
    "confidence",
    "missingFields",
    "warnings"
  ],
  "properties": {
    "productName": { "type": ["string", "null"] },
    "brandName": { "type": ["string", "null"] },
    "categoryMain": {
      "type": ["string", "null"],
      "enum": ["top", "bottom", "outer", "shoes", "accessory", "unknown", null]
    },
    "categorySub": { "type": ["string", "null"] },
    "priceSale": { "type": ["integer", "null"] },
    "currency": { "type": "string", "enum": ["KRW", "USD", "JPY", "EUR", "UNKNOWN"] },
    "fitType": {
      "type": ["string", "null"],
      "enum": ["slim", "regular", "oversized", "relaxed", "straight", "wide", "unknown", null]
    },
    "materialMain": { "type": ["string", "null"] },
    "materialSub": { "type": ["string", "null"] },
    "thickness": { "type": ["string", "null"] },
    "opacity": { "type": ["string", "null"] },
    "stretch": { "type": ["string", "null"] },
    "seasonality": { "type": ["string", "null"] },
    "colorFamily": { "type": ["string", "null"] },
    "styleTags": { "type": "array", "items": { "type": "string" } },
    "occasionTags": { "type": "array", "items": { "type": "string" } },
    "shippingSummary": { "type": ["string", "null"] },
    "returnSummary": { "type": ["string", "null"] },
    "reviewSummary": { "type": ["string", "null"] },
    "riskFlags": { "type": "array", "items": { "type": "string" } },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "missingFields": { "type": "array", "items": { "type": "string" } },
    "warnings": { "type": "array", "items": { "type": "string" } }
  }
}
```

### 11.4 Recommendation schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["outfits", "globalWarnings", "confidence"],
  "properties": {
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "globalWarnings": { "type": "array", "items": { "type": "string" } },
    "outfits": {
      "type": "array",
      "minItems": 3,
      "maxItems": 3,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "rank",
          "title",
          "framingLabel",
          "summary",
          "productIdsBySlot",
          "alternativeProductIdsBySlot",
          "reasons",
          "risks",
          "reviewEvidence",
          "comparison",
          "confidence"
        ],
        "properties": {
          "rank": { "type": "integer", "minimum": 1, "maximum": 3 },
          "title": { "type": "string" },
          "framingLabel": { "type": "string" },
          "summary": { "type": "string" },
          "productIdsBySlot": {
            "type": "object",
            "additionalProperties": false,
            "required": ["top", "bottom", "shoes"],
            "properties": {
              "top": { "type": ["string", "null"] },
              "bottom": { "type": ["string", "null"] },
              "outer": { "type": ["string", "null"] },
              "shoes": { "type": ["string", "null"] },
              "accessory": { "type": ["string", "null"] }
            }
          },
          "alternativeProductIdsBySlot": {
            "type": "object",
            "additionalProperties": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "reasons": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": { "type": "string" }
          },
          "risks": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["type", "text"],
              "properties": {
                "type": { "type": "string", "enum": ["info", "warning", "low_confidence"] },
                "text": { "type": "string" }
              }
            }
          },
          "reviewEvidence": { "type": "string" },
          "comparison": {
            "type": "object",
            "additionalProperties": false,
            "required": ["price", "fit", "material", "season", "shipping", "returnFee", "reviewSummary", "fitRisk"],
            "properties": {
              "price": { "type": "string" },
              "fit": { "type": "string" },
              "material": { "type": "string" },
              "season": { "type": "string" },
              "shipping": { "type": "string" },
              "returnFee": { "type": "string" },
              "reviewSummary": { "type": "string" },
              "fitRisk": { "type": "string", "enum": ["낮음", "중간", "높음", "정보 부족"] }
            }
          },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

### 11.5 Prompt contract

System instruction must include:

- 픽핏은 한국형 패션 결정 에이전트다.
- 상품은 제공된 candidate list 안에서만 선택한다.
- 모르는 가격, 재고, 사이즈 정보는 만들지 않는다.
- 추천은 반드시 3개 outfit으로 반환한다.
- 각 outfit은 이유, 리뷰 근거, 리스크, 비교 정보를 포함한다.
- body type 관련 표현은 단정하지 않고 "보완 가능", "권장", "주의" 수준으로 말한다.
- 민감한 신체 평가나 외모 비하 표현을 금지한다.

### 11.6 Model behavior

- Product extraction: lower latency model acceptable if schema quality passes tests.
- Recommendation generation: use model configured by `OPENAI_MODEL`.
- Set low-to-medium reasoning effort depending on available model/API.
- Use stable system instructions at the beginning for prompt caching.
- Put user-specific conditions and candidate products near the end.
- Store `model_response_id`, `model_name`, and token usage.

### 11.7 Refusal and failure handling

If model returns refusal or invalid schema:

1. Mark recommendation run as `failed`.
2. Store safe error summary.
3. Return UI-safe message: "추천을 생성하지 못했습니다. 조건을 조금 줄이거나 다시 시도해주세요."
4. Do not expose raw model output to browser.

### 11.8 Structured Outputs compatibility rules

Before implementing the OpenAI call, convert the example schemas in this document into strict schema files under `src/Support/schemas/`.

Rules:

- Treat schemas in this document as **business shape**, not copy-paste final API payloads.
- For strict Structured Outputs, prefer objects with fixed keys over dynamic maps.
- Avoid `additionalProperties` schemas for dynamic object keys in model outputs.
- Every UI-consumed field should be present in the model result. If the value is unknown, use `null`, `[]`, `"정보 부족"`, or a low confidence value instead of omitting the key.
- Optional business fields should still be represented as nullable required fields in the final strict schema.
- Validate the model result server-side even when Structured Outputs are enabled.
- Reject any product ID that was not included in the candidate list sent to the model.

Recommended fixed slot shape:

```json
{
  "top": "01HY...",
  "bottom": "01HY...",
  "outer": null,
  "shoes": "01HY...",
  "accessory": null
}
```

Recommended fixed alternatives shape:

```json
{
  "top": [],
  "bottom": ["01HY..."],
  "outer": [],
  "shoes": [],
  "accessory": []
}
```

---

## 12. Recommendation Engine Logic

### 12.1 Candidate selection before GPT

PHP must pre-filter candidates before calling GPT.

Hard filters:

- `stock_status != sold_out`
- product has at least `category_main`, `product_name`, and price candidate
- price within budget where possible
- avoidances mapped to product attributes
- situation/occasion tag match where possible

Soft scoring:

- mood/style tag match
- fit preference match
- body type note match
- review confidence
- shipping/return practicality
- data quality score
- recent user feedback compatibility

### 12.2 Candidate payload limit

Send compact candidate objects to GPT.

```json
{
  "id": "01HY...",
  "slot": "top",
  "brand": "STANDARD.O",
  "name": "슬림핏 코튼 셔츠",
  "price": 49000,
  "fit": "slim",
  "material": "면 60%, 폴리 40%",
  "color": "white",
  "styleTags": ["minimal", "office"],
  "reviewSummary": "정사이즈, 슬림하지만 답답하지 않음",
  "riskFlags": ["broad_shoulders_size_up"],
  "shipping": "무료 / 2일",
  "returnPolicy": "무료 / 7일 이내",
  "confidence": 0.83
}
```

### 12.3 Result persistence

Persist in one DB transaction:

1. `recommendation_runs`
2. `recommendation_outfits`
3. `recommendation_items`

If any selected product ID is not in candidate set, reject the model response and fail the run.

---

## 13. Frontend Integration Plan

### 13.1 API client

Create `js/api/client.js`.

Responsibilities:

- base fetch wrapper
- JSON parse
- error normalization
- CSRF header injection
- `credentials: "same-origin"`
- `AbortController` timeout support

### 13.2 State manager change

`state.js` should keep only transient UI state:

- current screen
- previous screen
- onboarding draft
- selected outfit id
- compare outfit ids
- last recommendation run id

Move these to API/DB:

- recommendations
- saved
- feedback
- user profile

### 13.3 Screen changes

#### `landing.js`

- Keep situation selection.
- Add authenticated user affordance later: login state, logout.
- Keep start CTA behavior.

#### `onboarding.js`

- Keep current 5-7 question flow.
- On final button, navigate to loading with conditions in state.

#### `loading.js`

Replace mock flow:

1. Show working state immediately.
2. `POST /api/recommendations` with onboarding conditions.
3. If response is synchronous, store run ID and navigate to `results`.
4. If response returns queued/running, poll `GET /api/recommendations/{id}`.
5. On failure, show retry and condition edit buttons.

#### `results.js`

- Load run by `state.lastRecommendationRunId`.
- Render API outfit structure.
- Save button calls `POST /api/saved-outfits`.
- Compare button uses returned outfit IDs.

#### `comparison.js`

- Use API outfit comparison metadata.
- If local compare IDs are missing, fetch latest recommendation run.

#### `detail.js`

- Fetch outfit detail if not in local screen cache.
- Purchase links open external URL in new tab.
- Before opening link, optional event tracking endpoint can be added later.

#### `saved.js`

- `GET /api/saved-outfits` instead of localStorage.
- Feedback chips call `POST /api/feedback`.

### 13.4 URL analysis UI

Add a compact URL analysis module in the landing or onboarding flow.

Preferred MVP placement:

- Landing lower section: "상품 URL 분석하기"
- Auth required. If unauthenticated, prompt login/register.
- Input + analyze button.
- Progress states:
  - URL 확인 중
  - 상품 화면 읽는 중
  - 상품 정보 정리 중
  - 추천 후보에 추가됨

This module should not dominate the core onboarding because PickFit remains situation-first.

---

## 14. Tailwind and CSS Build

### 14.1 Current issue

`index.html` currently uses Tailwind CDN. That is acceptable for prototype but not production.

### 14.2 Target setup

Install:

```bash
npm install tailwindcss@latest @tailwindcss/cli@latest
```

Input CSS:

```css
@import "tailwindcss";
@source "../*.html";
@source "../js/**/*.js";
@import "../../css/styles.css";
```

Development:

```bash
npx @tailwindcss/cli -i ./public/css/input.css -o ./public/css/app.css --watch
```

Production:

```bash
npx @tailwindcss/cli -i ./public/css/input.css -o ./public/css/app.css --minify
```

### 14.3 Rule

Do not rewrite the design system. Preserve tokens from `design_system.md` and existing `styles.css`. Tailwind is a utility/build layer, not a replacement for PickFit design tokens.

---

## 15. Security Requirements

### 15.1 Auth security

- Use HTTP-only session cookie.
- Regenerate session ID on login/register.
- Password hash only.
- Generic login failure message.
- Rate limit auth attempts.

### 15.2 API security

- Validate all request JSON.
- Return typed error codes.
- Use CSRF token for mutating endpoints.
- Do not expose stack traces in production.
- Log request ID, user ID, endpoint, status, duration.

### 15.3 Crawl security

- SSRF protection before and after redirects.
- Timeout every crawl.
- Limit text size, image count, artifact size.
- Do not crawl private/account/cart/checkout pages.
- Do not store cookies from user browsers.
- Do not use user credentials.

### 15.4 OpenAI security

- Keep `OPENAI_API_KEY` only in server env.
- Browser never calls OpenAI directly.
- Do not send passwords, session IDs, or raw private user data to model.
- Send only product/condition context necessary for recommendation.
- Store raw model output only if needed for debugging and never expose it directly.

---

## 16. Error States

| Code | HTTP | Meaning | UI action |
|---|---:|---|---|
| `unauthenticated` | 401 | Login required | Show login/register |
| `forbidden` | 403 | Not allowed | Show safe error |
| `validation_failed` | 422 | Bad input | Highlight fields |
| `rate_limited` | 429 | Too many requests | Ask user to wait |
| `crawl_blocked_url` | 422 | URL blocked by safety policy | Explain unsupported URL |
| `crawl_failed` | 500 | Crawl failed | Retry / enter another URL |
| `recommendation_failed` | 500 | GPT or candidate failure | Retry / edit conditions |
| `low_catalog_coverage` | 409 | Not enough candidates | Add URL or loosen filters |

---

## 17. Local Development Setup

### 17.1 Prerequisites

- PHP 8.2+
- Composer
- MySQL 8+
- Node.js 20+
- npm

### 17.2 Install

```bash
composer require vlucas/phpdotenv
composer require --dev phpunit/phpunit
composer install
npm install
npx playwright install chromium
```

### 17.3 Database

```bash
mysql -u root -p -e "CREATE DATABASE pickfit CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -p pickfit < database/migrations/001_initial_schema.sql
mysql -u root -p pickfit < database/seeds/mock_catalog_seed.sql
```

### 17.4 Run

```bash
php -S 127.0.0.1:8000 -t public public/index.php
npx @tailwindcss/cli -i ./public/css/input.css -o ./public/css/app.css --watch
```

Open:

```text
http://127.0.0.1:8000
```

---

## 18. Implementation Order

### Phase 1: Foundation

1. Create `composer.json`, `package.json`, `.env.example`.
2. Move/serve frontend from `public/`.
3. Add PHP bootstrap, router, JSON response helper.
4. Add PDO connection.
5. Add migrations and seed mock catalog.

### Phase 2: Auth

1. Implement register/login/logout/me.
2. Add session and CSRF.
3. Add frontend auth API wrapper.
4. Add minimal login/register UI.

### Phase 3: Catalog and crawl

1. Implement URL safety service.
2. Implement `crawl_jobs`.
3. Implement `crawler/playwright-crawl.js`.
4. Add generic extraction.
5. Insert normalized product record.
6. Add URL analysis UI.

### Phase 4: Recommendations

1. Implement candidate product selection.
2. Implement OpenAI service with Structured Outputs.
3. Persist recommendation run/outfits/items.
4. Replace `loading.js` mock flow.
5. Replace `results.js`, `comparison.js`, `detail.js` mock reads.

### Phase 5: Saved and feedback

1. Implement saved outfit endpoints.
2. Implement feedback endpoint.
3. Replace `saved.js` localStorage logic.
4. Feed feedback history into recommendation prompt.

### Phase 6: QA and hardening

1. Add PHPUnit tests.
2. Add API smoke tests.
3. Add Playwright crawler fixtures.
4. Add FE E2E for main happy path.
5. Validate mobile layout after API integration.

---

## 19. Test Plan

### 19.1 PHP unit tests

- URL safety:
  - blocks `localhost`
  - blocks `127.0.0.1`
  - blocks private IP hostnames after DNS resolution
  - allows valid `https` product URL
- Auth:
  - password hashing
  - duplicate email rejection
  - wrong password generic error
- Recommendation validation:
  - required onboarding fields
  - invalid enum rejection
  - candidate product ID whitelist
- Repositories:
  - product insert/update
  - recommendation run transaction
  - saved outfit uniqueness

### 19.2 API smoke tests

1. Register user.
2. Login.
3. Submit URL analysis.
4. Poll crawl job.
5. Request recommendation.
6. Fetch recommendation.
7. Save outfit.
8. Submit feedback.
9. Logout.

### 19.3 Playwright crawler tests

- Supported sample URL with product JSON-LD.
- Generic URL without JSON-LD but visible product text.
- Timeout URL.
- Image-less page.
- Redirect to blocked host.
- Page with no reliable price.

### 19.4 FE E2E scenario

1. User registers with email.
2. User logs in.
3. User submits product URL.
4. App shows crawl progress and candidate added state.
5. User completes onboarding.
6. Loading screen calls real recommendation API.
7. Results show 3 outfit cards.
8. User opens comparison.
9. User opens detail.
10. User saves outfit.
11. User submits feedback.

### 19.5 Acceptance criteria

- A logged-in user can reach 3 recommendation cards from onboarding.
- Recommendation cards show reasons, evidence, risk, price, and item composition.
- Saved outfit persists after page refresh.
- Feedback persists in DB.
- Crawling failure does not break onboarding or recommendations.
- If data confidence is low, UI says so instead of pretending certainty.

---

## 20. UI Copy and Trust Rules

Use clear Korean copy. Avoid overclaiming.

Good:

- "수집한 상품 정보가 부족해 추천 신뢰도가 낮아요."
- "리뷰에서 정사이즈 언급이 많지만, 어깨가 넓다면 한 치수 업을 권장해요."
- "이 상품은 반품 정책을 확인하지 못했어요."

Avoid:

- "완벽하게 어울려요."
- "AI가 가장 좋은 답을 찾았어요."
- "무조건 실패하지 않아요."

---

## 21. Non-goals for MVP

Do not implement:

- autonomous checkout
- payment input handling
- cart automation
- login/captcha bypass crawling
- social feed
- community
- full marketplace crawling
- virtual fitting
- wardrobe management
- voice commerce
- broad chatbot interface

---

## 22. References

- `PickFit.md`: product positioning, MVP scope, data/recommendation principles
- `design_system.md`: UI tokens, component rules, accessibility, copy principles
- OpenAI official docs checked for Responses API and Structured Outputs guidance
- Playwright docs checked for Chromium launch, isolated browser context, page navigation, screenshot, and cleanup patterns
- Tailwind docs checked for CLI install, `@import "tailwindcss"`, watch, and minified production build

---

## 23. Codex Automation Readiness Review

### 23.1 Verdict

`tech.md` is strong enough to guide implementation, but **not sufficient as the only context for flawless automatic development**.

For near-complete automated development, Codex must use this context bundle:

1. `tech.md`
2. `PickFit.md`
3. `design_system.md`
4. current source files under `index.html`, `js/`, `css/`, `assets/`, `img/`
5. current official docs for OpenAI, Playwright, Tailwind, PHP/Composer/PHPUnit when implementation touches those APIs

Reason: `tech.md` defines the target contract, but the existing codebase still contains concrete UI structure, CSS class names, asset paths, and mock data shape that must be preserved during migration.

### 23.2 Main error risks found in review

| Risk | Why it matters | Required handling |
|---|---|---|
| OpenAI strict schema mismatch | The example schemas contain conceptual optional fields and dynamic maps. | Generate final strict schemas with fixed keys and nullable required fields before coding API calls. |
| PHP single-server background jobs | Real async queues are not present. | MVP uses synchronous foreground execution with persisted job/run rows and polling-compatible endpoints. |
| `public/index.php` vs SPA entry | A PHP front controller and static SPA entry can conflict. | Use `public/index.php` as router and serve `public/app.html` for non-API routes. |
| Existing asset paths | Moving files to `public/` can break `assets/`, `img/`, and CSS URLs. | Move/copy assets in one controlled step and verify every image path in browser. |
| Tailwind v4 source scan | Current Tailwind config lives inline in `index.html`. | Move source scanning and tokens into CLI input CSS/build workflow. |
| Playwright URL analysis quality | Generic crawling can produce weak product fields. | Store `data_quality_score`, use adapter confidence, and disclose low confidence in UI. |
| Crawl legal/policy limits | User URL analysis can violate site rules if treated as unrestricted crawling. | Keep crawler public-page only, rate-limited, no login/captcha/cart/checkout automation. |
| MySQL JSON portability | JSON fields are flexible but harder to query and validate. | Keep core searchable fields as columns; JSON is for tags, evidence, and model metadata only. |
| OpenAI model availability | Model names and account availability can change. | Read `OPENAI_MODEL` from env and verify docs/account before implementation. |

### 23.3 Decisions now locked to reduce ambiguity

- Serve API and SPA through `public/index.php`; non-API routes return `public/app.html`.
- Use same-origin requests only; do not add CORS for MVP.
- Use PHP cURL for OpenAI initially unless a small SDK materially reduces code risk.
- Use `vlucas/phpdotenv` for local `.env` loading.
- Use PHPUnit for backend tests.
- Use Playwright Node CLI for crawling, not a Node HTTP server.
- Use synchronous job execution for MVP, while preserving job tables and polling endpoints for future queue migration.
- Seed catalog must be generated from the existing `js/data/mock.js` before replacing UI mock reads.
- Do not start visual redesign while integrating backend.
- If OpenAI or crawling is unavailable locally, the app must still run with seeded catalog and deterministic fallback recommendation logic.

### 23.4 Fallback recommendation requirement

Codex must implement a deterministic fallback recommendation path before depending on OpenAI.

Fallback behavior:

- Filter seeded products by budget, category, stock, and avoidances.
- Assemble up to 3 outfits with `top + bottom + shoes`, adding `outer` when available.
- Generate simple rule-based reasons from matched tags and known product fields.
- Mark `confidence <= 0.55`.
- Display a UI warning: "AI 추천을 사용할 수 없어 기본 규칙으로 코디를 구성했어요."

This makes the app runnable even without `OPENAI_API_KEY`.

### 23.5 Minimum done definition

Implementation is not done until all of these pass:

- `php -S 127.0.0.1:8000 -t public public/index.php` serves the app.
- Register/login/logout/me work.
- Seed products appear through `GET /api/products`.
- Onboarding can produce 3 recommendation cards without OpenAI using fallback logic.
- With `OPENAI_API_KEY`, recommendation generation stores a run and 3 outfits.
- Save and feedback persist after refresh.
- URL analysis rejects unsafe URLs and succeeds on at least one public product-like test page.
- Browser verification passes at mobile width and desktop width.

---

## 24. Skills Usage Guide for Codex

Use skills only when their trigger matches the work. Do not load every skill by default.

| Skill | Use when | Do not use when |
|---|---|---|
| `openai-docs` | Implementing or changing OpenAI Responses API calls, Structured Outputs schemas, model selection, prompt behavior, or API error handling. | General PHP/JS refactors that do not touch OpenAI. |
| `browser-use:browser` | Opening local `http://127.0.0.1:8000`, clicking through the app, taking screenshots, verifying responsive UI, and checking that frontend changes actually render. | Reading code or doing static backend work. |
| `chrome:Chrome` | Testing remote authenticated websites or pages that require the user's real Chrome cookies/session. | Normal local app verification; use `browser-use` instead. |
| `github:github` | Inspecting repository issues, PR context, or remote GitHub state. | Local-only implementation with no GitHub request. |
| `github:gh-fix-ci` | Debugging failing GitHub Actions checks for a PR. | Local test failures. |
| `github:gh-address-comments` | Addressing PR review comments and unresolved review threads. | Unreviewed local development. |
| `github:yeet` | User asks to commit, push, and open a PR. | Creating local changes only. |
| `figma:figma-generate-design` | User asks to convert the PickFit screen/spec into Figma screens. | Implementing code in the repo. |
| `figma:figma-generate-diagram` | User asks for an architecture diagram, ERD, sequence diagram, or flowchart in FigJam/Figma. | Markdown-only diagrams in `tech.md`. |
| `imagegen` | User asks to create raster visual assets such as product placeholders, illustrations, or hero images. | Existing SVG/code/CSS/layout work. |
| `skill-installer` | User asks to list or install Codex skills. | Normal implementation. |
| `skill-creator` | User asks to create or update a reusable Codex skill. | Writing project documentation. |
| `plugin-creator` | User asks to scaffold a Codex plugin. | Building PickFit app code. |
| `documents`, `presentations`, `spreadsheets` | User asks for `.docx`, PPTX, or spreadsheet artifacts. | App implementation and `tech.md` updates. |

### Required skill sequence by task

- OpenAI implementation: `openai-docs` -> inspect current code -> implement `OpenAIService` -> run schema/unit tests.
- Frontend verification: implement code -> start PHP server -> `browser-use:browser` -> screenshot/click through mobile and desktop.
- GitHub PR work: local tests -> `github:yeet` only if the user asks to publish.
- Figma design work: read `design_system.md` -> use relevant Figma skill -> verify generated screen against app UI.

---

## 25. MCP Usage Guide for Codex

### 25.1 Use `mcp__openaiDeveloperDocs__`

Use before any work involving:

- OpenAI Responses API request shape
- Structured Outputs schema syntax and limitations
- model selection or model upgrade
- reasoning controls, verbosity, prompt caching
- tool/function calling
- official API error handling

Default flow:

1. `search_openai_docs` for the exact topic.
2. `fetch_openai_doc` for the specific page/section.
3. Implement only after confirming the current official behavior.

### 25.2 Use `mcp__context7__`

Use for current library/framework/tool docs:

- Playwright API and crawler patterns
- Tailwind CLI/build/source scanning
- PHP package usage if a package is introduced
- PHPUnit setup and assertions
- Composer autoload conventions
- MySQL/PDO examples if uncertain

Default flow:

1. `resolve_library_id`.
2. `query_docs` with a specific implementation question.
3. Use only the minimum current guidance needed for the change.

### 25.3 Use `mcp__sequential_thinking__`

Use for complex planning or failure analysis:

- breaking the whole migration into safe phases
- reconciling conflicts between `PickFit.md`, `design_system.md`, and implementation constraints
- debugging multi-system failures involving FE + PHP + DB + crawler + OpenAI
- deciding whether to change architecture after a blocker

Do not use for routine file edits, simple tests, or obvious one-file fixes.

### 25.4 Use app/plugin MCPs only when needed

- GitHub MCP: PRs, issues, review comments, Actions checks.
- Figma MCP: diagrams, screens, design system generation.
- Browser MCP/plugin: local app runtime verification.
- Notion MCP: only if the user asks to sync specs/tasks into Notion.

### 25.5 MCP safety rules

- Do not send secrets, `.env` values, passwords, session cookies, or API keys to any MCP.
- Do not use remote browsing to bypass a site's access controls.
- Prefer local repo inspection over web/MCP when the question is about current project code.
- Prefer official docs MCPs over general web search for library/API behavior.

---

## 26. Implementation Checklist for Codex

When using this document to build the app, Codex should proceed in this exact order.

1. Read `PickFit.md`, `design_system.md`, and `tech.md`.
2. Inspect current repo files and confirm there is no hidden framework already installed.
3. Use `mcp__context7__` for Tailwind/Playwright/PHPUnit docs when those files are first created.
4. Use `mcp__openaiDeveloperDocs__` before writing OpenAI request code or schemas.
5. Create backend foundation without changing UI behavior.
6. Add DB schema and seed data from existing `mock.js`.
7. Add auth and session.
8. Add deterministic fallback recommendation logic.
9. Add API client in frontend.
10. Replace one screen at a time:
   - loading
   - results
   - detail
   - comparison
   - saved
11. Add crawler job and URL analysis UI.
12. Add OpenAI recommendation service.
13. Run smoke tests.
14. Run browser verification on mobile width and desktop width with `browser-use:browser`.

Do not refactor unrelated design or visual direction while implementing backend integration.

---

## 27. Self-Check

- 사용자 URL 분석은 사이트별 약관, robots 정책, 차단 정책에 따라 실제 운영 가능 범위가 달라질 수 있다.
- OpenAI 모델명, 가격, 계정별 사용 가능 모델은 변동될 수 있으므로 구현 직전 공식 문서와 계정 설정을 다시 확인해야 한다.
- PHP 단일 서버에서 Playwright를 동기 subprocess로 실행하면 단순하지만 요청 시간이 길어질 수 있다. MVP는 가능하지만, 트래픽이 늘면 queue worker 분리가 필요하다.
- `PickFit.md`의 "open-web crawling 금지" 원칙과 사용자 선택인 "사용자 URL 분석"은 완전히 동일하지 않다. 이 문서는 사용자 URL 분석을 허용하되 안전한 반폐쇄형 카탈로그 후보 수집으로 제한해 충돌을 줄였다.
- 이 문서만 단독으로 사용하면 기존 CSS 클래스, asset path, mock data 세부 구조를 놓칠 수 있다. 구현 전 반드시 현재 코드와 `PickFit.md`, `design_system.md`를 함께 읽어야 한다.
