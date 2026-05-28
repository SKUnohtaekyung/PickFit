---
name: pickfit-ci-workflows
description: Design or update PickFit GitHub Actions and local test workflows. Use for CI around PHP syntax, Composer, PHPUnit, npm checks, Tailwind build, Playwright smoke tests, crawler tests, secrets, environments, and docs-grounded GitHub Actions YAML for this PHP/vanilla JS project.
---

# PickFit CI Workflows

Use this skill to create or review CI for PickFit. Ground GitHub Actions syntax in official GitHub documentation when writing or changing workflow YAML.

## Sources

- Read `development_10day_plan.md` for the expected phase.
- Read `tech.md` sections on testing, tooling, and done criteria.
- Use the installed `github-actions-docs` skill as the docs-grounding reference when exact Actions syntax or security guidance matters.

## CI Philosophy

- Start small and make checks real.
- Do not add CI jobs for scripts that do not exist yet.
- Prefer explicit setup and cache steps over clever shell fragments.
- Keep secrets out of logs.
- Use OIDC for cloud credentials when a deployment target is chosen.

## PickFit Check Ladder

Early static SPA:

- `node --check js/app.js`
- `node --check js/data/mock.js`
- `npm run dev` only for local smoke, not CI unless paired with a smoke check.

Backend foundation:

- `php -l` over PHP files.
- `composer validate` when `composer.json` exists.
- `composer install`.
- `vendor/bin/phpunit` when tests exist.

Frontend build:

- `npm install` or `npm ci`.
- Tailwind CLI build when `public/css/input.css` exists.

Integration:

- Start `php -S 127.0.0.1:8000 -t public public/index.php`.
- Check `/api/health`.
- Run Playwright smoke tests when they exist.

## Workflow Rules

- Use Windows only if the project explicitly needs it; otherwise use Ubuntu runners for CI.
- Use MySQL service containers only after DB migrations exist.
- Do not require `OPENAI_API_KEY` for baseline CI.
- Put OpenAI-backed tests behind an explicit optional job or secret-gated condition.
- Keep crawler tests public-page only and fixture-first.

## Output Shape

For workflow proposals:

```text
Workflow purpose:
Jobs:
Commands required:
Secrets required:
Docs consulted:
Risk notes:
```

For reviews, lead with blocking issues in `file:line` form where possible.
