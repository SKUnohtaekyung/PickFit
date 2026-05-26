# PickFit Worklog

## Day 1 - 2026-05-25

### Completed
- Set up a local PHP runtime using FrankenPHP's Windows package at `C:\Users\miso\tools\frankenphp-1.12.0`.
- Added `C:\Users\miso\tools\frankenphp-1.12.0` and `C:\Users\miso\tools\composer` to the user PATH.
- Installed Composer 2.9.8 as a local `composer.phar` wrapper at `C:\Users\miso\tools\composer\composer.bat`.
- Added a local `php.ini` enabling `openssl`, `curl`, `pdo_mysql`, `mysqli`, `mbstring`, `fileinfo`, `zip`, and `intl`.
- Added the PHP backend foundation for serving the SPA and JSON APIs.
- Added `public/index.php` as the front controller.
- Added `GET /api/health` route wiring through a small router.
- Added `public/app.html` and copied existing `css/`, `js/`, `assets/`, and `img/` into `public/` without deleting the root SPA files.
- Added `.env.example` with local app, DB, OpenAI, crawler, and rate-limit placeholders.
- Added `composer.json` with PHP 8.2+ and PSR-4 autoload for `PickFit\`.

### Changed Files
- `.env.example`
- `composer.json`
- `public/index.php`
- `public/app.html`
- `public/css/*`
- `public/js/*`
- `public/assets/*`
- `public/img/*`
- `src/Bootstrap.php`
- `src/Config.php`
- `src/Http/Request.php`
- `src/Http/Response.php`
- `src/Http/Router.php`
- `WORKLOG.md`

### Verification
- `php -v`: pass after local runtime setup, PHP 8.5.3 from `C:\Users\miso\tools\frankenphp-1.12.0\php.exe`.
- `composer -V`: pass after local Composer setup, Composer 2.9.8 using PHP 8.5.3.
- `node -v`: pass, `v26.1.0`.
- `npm -v`: pass, `11.13.0`.
- `mysql --version`: fail, `mysql` is not available on PATH.
- `git status --short`: pass, repo status was readable; existing `.agents/`, `.codex/`, `package.json`, and `package-lock.json` were already untracked and were not cleaned up.
- `rg --files public src`: pass, public SPA files and PHP foundation files are present.
- `node -e "JSON.parse(...composer.json...)"`: pass, `composer.json` is valid JSON.
- `composer dump-autoload`: pass, generated `vendor/autoload.php`.
- `composer test`: pass, `public/index.php` syntax check succeeded.
- `php -l public/index.php`: pass.
- `php -l src/Bootstrap.php`: pass.
- `php -l src/Config.php`: pass.
- `php -l src/Http/Router.php`: pass.
- `php -l src/Http/Request.php`: pass.
- `php -l src/Http/Response.php`: pass.
- `php -S 127.0.0.1:8002 -t public public/index.php`: pass, PHP development server started on port 8002 because port 8000 is already occupied by an existing Node server.
- `GET http://127.0.0.1:8002/api/health`: pass, HTTP 200 with `{"ok":true,"app":"PickFit","environment":"local"}`.
- `GET http://127.0.0.1:8002/`: pass, HTTP 200 with SPA entry HTML.
- Static fallback check with `http-server public -p 8001 -c-1`: pass.
- `GET http://127.0.0.1:8001/app.html`: pass, HTTP 200.
- `GET http://127.0.0.1:8001/css/styles.css`: pass, HTTP 200.
- `GET http://127.0.0.1:8001/js/app.js`: pass, HTTP 200.
- Chrome headless check against `http://127.0.0.1:8001/app.html`: pass, landing rendered with 8 images and no broken images.
- Chrome headless flow check: pass, selecting `office` and clicking the center CTA navigated to onboarding; bottom nav was hidden on onboarding.

### Blocked or Deferred
- `php -S 127.0.0.1:8000 -t public public/index.php` was not run on port 8000 because that port is already occupied by an existing Node `http-server` process.
- Browser plugin automation was unavailable in this session, so Chrome headless CDP was used for the public SPA fallback verification.
- Tailwind CDN warning appears in browser console; this is expected for the current prototype and is deferred to the planned Tailwind CLI work.
- MySQL client is still unavailable on PATH.

### Next Start Point
- Day 2 can start with MySQL schema, mock catalog seed, repository foundation, and `GET /api/products` once PHP/MySQL are available.
- If port 8000 must be used for PHP, stop or move the existing Node server currently listening there. Otherwise continue using `http://127.0.0.1:8002` for PHP backend checks.

### Self-Check
- Day 1 scope stayed limited to backend foundation, public serving, and verification.
- Existing root SPA files were preserved.
- No DB, auth, recommendation, crawler, OpenAI, Tailwind CLI, or redesign work was added.
- OpenAI keys and other secrets were not introduced.

## Day 2 - 2026-05-25

### Completed
- Phase 0 MySQL environment check and setup.
- Confirmed no existing `mysql`/`mariadb` executable, MySQL service, or 3306 listener existed before setup.
- Installed MySQL Server 8.4.9 with `winget`.
- Added `C:\Program Files\MySQL\MySQL Server 8.4\bin` to the user PATH.
- Initialized a local development data directory at `C:\Users\miso\tools\mysql-8.4-local\data`.
- Created a local MySQL config at `C:\Users\miso\tools\mysql-8.4-local\my.ini`.
- Started local MySQL on `127.0.0.1:3306`.
- Created the `pickfit` database with `utf8mb4` and `utf8mb4_0900_ai_ci`.
- Added local `.env` for PHP/MySQL development settings. The file is ignored by git.
- Phase 2 mock catalog seed SQL.
- Phase 1 initial migration SQL.
- Created `database/migrations/001_initial_schema.sql` with users, profiles, catalog, crawl jobs, recommendation, saved outfit, and feedback tables.
- Created `database/seeds/mock_catalog_seed.sql` from the existing `js/data/mock.js` product catalog shape.
- Seed includes 9 products, 9 default variants, 9 hero image media rows, and 9 review summary rows.
- Applied the Phase 1 migration and Phase 2 seed to the real local `pickfit` database.
- Phase 3 catalog API foundation.
- Added PDO database connection loading local `.env` values without exposing secrets.
- Added product repository list/detail queries.
- Added catalog controller and wired `GET /api/products` and `GET /api/products/{id}`.
- Added simple route parameter matching to the PHP router.
- Day 1/2 final verification pass.
- Fixed PHP built-in server static asset handling in `public/index.php`; existing files under `public/` now return their real CSS, JS, image, or HTML content instead of the SPA fallback.

### Changed Files
- `.env` (ignored local file)
- `database/migrations/001_initial_schema.sql`
- `database/seeds/mock_catalog_seed.sql`
- `src/Bootstrap.php`
- `src/Config.php`
- `src/Database.php`
- `src/Controllers/CatalogController.php`
- `src/Http/Request.php`
- `src/Http/Router.php`
- `src/Repositories/ProductRepository.php`
- `public/index.php`
- `WORKLOG.md`

### Verification
- `winget install --id Oracle.MySQL --source winget --accept-source-agreements --accept-package-agreements`: pass, MySQL Server 8.4.9 installed.
- `mysql --version`: pass, `mysql  Ver 8.4.9 for Win64 on x86_64`.
- `mysqld --version`: pass, `mysqld  Ver 8.4.9 for Win64 on x86_64`.
- `mysql -h 127.0.0.1 -P 3306 -u root -e "SELECT VERSION();"`: pass, `8.4.9`.
- `mysql -h 127.0.0.1 -P 3306 -u root -e "CREATE DATABASE IF NOT EXISTS pickfit ..."`: pass.
- PHP PDO smoke test: pass, connected to `pickfit@8.4.9`.
- `netstat -ano | Select-String ':3306'`: pass, MySQL is listening on `127.0.0.1:3306`.
- Scratch DB schema creation for `pickfit_seed_check`: pass.
- `database/seeds/mock_catalog_seed.sql` applied to `pickfit_seed_check`: pass.
- `SELECT COUNT(*)` after seed: pass, 9 products, 9 variants, 9 media rows, 9 reviews.
- Scratch DB `pickfit_migration_check` migration + seed: pass, 12 tables created and seed counts verified.
- Real DB `pickfit` migration + seed: pass, 12 tables created.
- Real DB `pickfit` seed counts: pass, 9 products, 9 variants, 9 media rows, 9 reviews.
- PHP syntax checks for catalog API files: pass.
- `composer dump-autoload`: pass.
- `composer test`: pass, `public/index.php` syntax check succeeded.
- `GET http://127.0.0.1:8002/api/products?limit=3`: pass, returned 3 products with `nextCursor=prod-003`.
- `GET http://127.0.0.1:8002/api/products?limit=3&cursor=prod-003`: pass, next page starts at `prod-004`.
- `GET http://127.0.0.1:8002/api/products?category=top&maxPrice=50000`: pass, returned filtered products.
- `GET http://127.0.0.1:8002/api/products/prod-001`: pass, returned product detail with 1 variant, 1 media row, and 1 review.
- `GET http://127.0.0.1:8002/api/products/no-such-product`: pass, HTTP 404 JSON error.
- Day 1/2 final PHP syntax checks: pass for `public/index.php`, bootstrap, config, database, router, request/response, catalog controller, and product repository.
- Day 1/2 final `composer dump-autoload` and `composer test`: pass.
- Fresh DB check `pickfit_final_check` migration + seed: pass, 12 tables, 9 products, 9 variants, 9 media rows, 9 reviews.
- PHP server static file checks: pass, `/css/styles.css` returns `text/css`, `/js/app.js` returns `application/javascript`, product images return image content, and `/` returns SPA HTML.
- Chrome headless render check against `http://127.0.0.1:8002/`: pass, landing DOM rendered, start text present, and no module-load errors detected.

### Blocked or Deferred
- MySQL is running as a local development process, not as a Windows service.
- The local root account is initialized without a password for development to match the current `.env.example` default.
- Product names and review summaries in the seed are ASCII placeholders to avoid the current Korean text encoding issue in SQL files.
- Tailwind CDN warning remains expected for the prototype and is deferred to the planned Tailwind CLI work.

### Next Start Point
- Day 2 can continue with small API hardening/tests, or Day 3 can start auth/session/CSRF once the catalog contract is accepted.

## Maintenance Check - 2026-05-26

### Completed
- Re-read `development_10day_plan.md`, `tech.md`, and current Day 1/2 backend files.
- Confirmed Day 1 foundation is implemented and runnable.
- Confirmed Day 2 schema, seed, repository, and catalog API are implemented.
- Found current runtime failure source: local MySQL was not running, so `GET /api/products` returned a generic 500.
- Updated catalog route handling to return a typed `database_unavailable` 503 response when PDO cannot connect.
- Restarted the local MySQL 8.4.9 development process and confirmed the `pickfit` database still has 9 seeded products.

### Changed Files
- `src/Bootstrap.php`
- `WORKLOG.md`

### Verification
- `php -v`: pass, PHP 8.5.3.
- `composer -V`: pass, Composer 2.9.8.
- `mysql --version`: pass, MySQL client 8.4.9.
- `php -l src/Bootstrap.php`: pass.
- `composer test`: pass, `public/index.php` syntax check succeeded.
- `GET /api/health` before DB restart: pass, HTTP 200.
- `GET /` before DB restart: pass, HTTP 200.
- `GET /api/products` before DB restart: pass for error handling, HTTP 503 with `database_unavailable`.
- `mysql -h 127.0.0.1 -P 3306 -u root -e "SELECT VERSION(); USE pickfit; SELECT COUNT(*) AS products FROM products;"`: pass, MySQL 8.4.9 and 9 products.
- `GET /api/products?limit=3` after DB restart: pass, 3 products and `nextCursor=prod-003`.
- `GET /api/products/prod-001` after DB restart: pass, detail includes variants, media, and reviews.

### Blocked or Deferred
- MySQL is still a local development process rather than a Windows service, so product APIs will return `database_unavailable` after reboot until MySQL is started again.
- Day 3 auth/session/CSRF has not started.

### Next Start Point
- Start Day 3 with auth/session/CSRF after confirming MySQL is running.
- Consider adding a small local run script for the PHP server and MySQL dev process so Day 2 verification is repeatable.

## Day 3 Phase 5 - Minimal Auth UI Integration - 2026-05-26

### Completed
- Added a same-origin frontend auth API wrapper for CSRF, register, login, logout, and current-user checks.
- Added a minimal landing-page auth slot and modal for login/register/logout without redesigning the existing SPA flow.
- Initialized frontend auth state on app startup and guarded against stale `/api/auth/me` responses overwriting a newer login.
- Aligned duplicate email registration with the documented `validation_failed` HTTP 422 contract.
- Added frontend handling for the future `rate_limited` auth error code.
- Restarted the local MySQL 8.4.9 development process when it was found stopped during verification.

### Changed Files
- `public/js/api/auth.js`
- `public/js/components/authModal.js`
- `public/js/screens/landing.js`
- `public/js/app.js`
- `public/css/styles.css`
- `src/Controllers/AuthController.php`
- `WORKLOG.md`

### Verification
- `node --check public/js/api/auth.js`: pass.
- `node --check public/js/components/authModal.js`: pass.
- `node --check public/js/screens/landing.js`: pass.
- `node --check public/js/app.js`: pass.
- `php -l src/Controllers/AuthController.php`: pass.
- `composer test`: pass, `public/index.php` syntax check succeeded.
- API smoke `csrf -> register -> me -> logout -> me 401 -> csrf -> login -> logout`: pass.
- Duplicate registration contract: pass, second register returns HTTP 422 `validation_failed`.
- Headless Chrome auth flow at 390px and 480px: pass for login slot, register modal, logout, login, no horizontal overflow, and no header/nav overlap.
- Test users cleanup: pass, `users` count returned to 0.
- Subagent verification: pass, no blocking Phase 5 issues found.

### Blocked or Deferred
- Backend auth rate limiting is still deferred; the frontend now has a `rate_limited` message path ready for it.
- `/api/health` still intentionally uses its existing lightweight response shape; it is not used by the auth client.
- Tailwind CDN production warning remains expected for the prototype and is still deferred to planned Tailwind CLI work.

### Next Start Point
- Continue to the next planned phase after confirming `php -S 127.0.0.1:8002 -t public public/index.php` and local MySQL are running.
- Backend rate limiting should be handled as a focused security hardening slice before production.

## Day 4 Readiness Prep - 2026-05-26

### Completed
- Reviewed Day 3 deferred items against the Day 4 plan and treated auth rate limiting plus Tailwind CLI build readiness as the pre-Day-4 hardening targets.
- Added a file-backed auth rate limiter using `RATE_LIMIT_AUTH_PER_HOUR`, storing runtime counters under ignored `storage/rate-limits/`.
- Added a shared frontend API client with JSON parsing, normalized errors, CSRF injection, same-origin credentials, timeout handling, and one-time CSRF retry.
- Refactored the auth API wrapper to use the shared API client.
- Added Day 4 API wrapper starting points for catalog, recommendations, saved outfits, and feedback.
- Installed Tailwind CSS CLI dependencies and added `public/css/input.css -> public/css/app.css` build flow.
- Switched the SPA shell from Tailwind CDN to built `css/app.css`.

### Changed Files
- `.gitignore`
- `package.json`
- `package-lock.json`
- `public/app.html`
- `public/css/input.css`
- `public/css/app.css`
- `public/js/api/client.js`
- `public/js/api/auth.js`
- `public/js/api/catalog.js`
- `public/js/api/recommendations.js`
- `public/js/api/saved.js`
- `src/Bootstrap.php`
- `src/Http/Request.php`
- `src/Services/RateLimiter.php`
- `WORKLOG.md`

### Verification
- PHP syntax check for all `src/` and `public/` PHP files: pass.
- `composer test`: pass.
- `node --check` for API clients, auth modal, and app entry: pass.
- `npm run build`: pass, generated `public/css/app.css`.
- Auth rate limit smoke: pass, first 20 bad login attempts returned 401 and attempt 21 returned 429 `rate_limited`.
- Auth happy path smoke after clearing rate counters: pass for register, me, logout, login, logout.
- Headless Chrome 390px/480px prep smoke: pass for built CSS loading, no Tailwind CDN request, auth register/logout, saved navigation, onboarding navigation, no horizontal overflow, and no auth-header overlap.
- Runtime status: PHP server on `127.0.0.1:8002` and MySQL on `127.0.0.1:3306` are running.
- Database cleanup: pass, `users` count is 0 and `products` count is 9.

### Blocked or Deferred
- `npm run build` currently emits a Node DEP0205 deprecation warning from the Tailwind CLI runtime, but the build exits successfully.
- Recommendation, saved-outfit, and feedback backend endpoints are still intentionally unimplemented until their planned days; their frontend wrappers are ready but not wired into screens.
- State refactor has not been applied yet; Day 4 can now do that against the shared client without changing the existing mock screens all at once.

### Next Start Point
- Start Day 4 by separating transient UI state from API-backed data in `public/js/utils/state.js`.
- Then wire catalog/recommendation/saved wrappers screen by screen, keeping the current UI behavior intact until each endpoint exists.
