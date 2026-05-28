# PickFit Backend Contract

Use this reference as a compact checklist. Read `tech.md` for full details.

## Target Stack

- PHP 8.2+
- Composer PSR-4
- PDO MySQL
- Native PHP session
- JSON API
- MySQL 8 with `utf8mb4`
- OpenAI Responses API via server environment
- Node.js Playwright Chromium CLI crawler
- PHPUnit for backend tests

## Target Folders

- `public/index.php`
- `public/app.html`
- `public/css/`
- `public/js/`
- `public/assets/`
- `src/Bootstrap.php`
- `src/Config.php`
- `src/Database.php`
- `src/Http/Router.php`
- `src/Http/Request.php`
- `src/Http/Response.php`
- `src/Controllers/`
- `src/Services/`
- `src/Repositories/`
- `database/migrations/`
- `database/seeds/`
- `crawler/playwright-crawl.js`
- `tests/`

## Error Codes

Use stable typed error codes:

- `unauthenticated`
- `forbidden`
- `validation_failed`
- `rate_limited`
- `crawl_blocked_url`
- `crawl_failed`
- `recommendation_failed`
- `low_catalog_coverage`

## Fallback Recommendation

Fallback must work without `OPENAI_API_KEY`.

- Filter seeded products by budget, category, stock, and avoidances.
- Assemble up to three outfits.
- Generate rule-based reasons.
- Mark confidence as low or moderate.
- Display a UI warning that fallback rules were used.
