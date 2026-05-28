---
name: pickfit-backend-foundation
description: Build or review PickFit backend foundation work. Use for public/index.php, PHP router/bootstrap/config/request/response, Composer setup, .env.example, MySQL schema/seeds, catalog API, recommendation API, auth/session APIs, crawler/OpenAI service wiring, and preserving the existing SPA during backend migration.
---

# PickFit Backend Foundation

Use this skill when implementing PickFit backend phases from `development_10day_plan.md`.

## Start Here

1. Read `development_10day_plan.md` for the requested day or phase.
2. Read the relevant `tech.md` sections for API, DB, security, crawler, OpenAI, and testing requirements.
3. Inspect existing files with `rg --files` before editing.
4. Preserve the current static SPA behavior unless the task explicitly changes it.

## Foundation Rules

- Use PHP 8.2+ with Composer PSR-4 autoload.
- Use PDO for MySQL.
- Use native PHP sessions for auth.
- Keep same-origin API calls; do not add CORS for MVP.
- Keep JSON API responses consistent and typed.
- Use `public/index.php` as the front controller.
- Return the SPA entry for non-API routes.
- Keep OpenAI keys and model selection server-side via environment variables.
- Implement deterministic fallback recommendations before OpenAI dependency.
- Keep URL crawling synchronous for MVP while storing job state for future polling.

## Current-to-Target Migration Guardrails

- Do not break `assets/`, `img/`, or CSS URL paths.
- Avoid visual redesign.
- Keep JS screen modules and `state.js` shape stable until API replacement is deliberate.
- Add backend slices in thin vertical increments: health, products, auth, recommendations, saved, feedback, crawler, OpenAI.
- Keep generated or runtime output under ignored runtime folders such as `storage/`.

## Verification Ladder

Run the smallest relevant checks after each slice:

```bash
php -l public/index.php
php -S 127.0.0.1:8000 -t public public/index.php
```

When available, also run:

```bash
composer test
vendor/bin/phpunit
npm run test
npm run build
```

If commands do not exist yet, say so and verify with the closest available check.

## API Contract Priorities

Start with:

- `GET /api/health`
- `GET /api/products`
- `POST /api/recommendations`
- saved outfit APIs
- feedback APIs

Later:

- auth/session endpoints
- URL analysis and crawl job endpoints
- OpenAI-backed recommendation generation

## Output Shape

For backend implementation, report:

```text
Changed:
Verified:
Not yet available:
Risks:
```
