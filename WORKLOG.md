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
