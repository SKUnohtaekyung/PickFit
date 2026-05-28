---
name: pickfit-architecture-review
description: Review PickFit architecture and migration plans. Use when changing the static SPA into the planned PHP/MySQL/OpenAI/Playwright backend, evaluating module boundaries, planning refactors, or checking that backend work follows tech.md and development_10day_plan.md without redesigning the UI.
---

# PickFit Architecture Review

Use this skill to keep PickFit architecture decisions aligned with the product docs while the app moves from a static SPA to a PHP-backed decision engine.

## Core Sources

Read only what is needed for the task:

- `tech.md` for target backend, API, database, crawler, AI, and security contracts.
- `development_10day_plan.md` for phased implementation order and done criteria.
- `PickFit.md` for product boundaries and MVP intent.
- `design_system.md` and `css/styles.css` only when architectural work touches UI structure or assets.
- `references/pickfit-project-map.md` for a compact project map and routing guide.

## Review Workflow

1. Inspect the current code before proposing structure.
2. Separate current implementation from target design.
3. Preserve the existing SPA user flow while introducing backend seams.
4. Prefer small vertical slices that can be verified in the browser.
5. Mark each suggestion as `Required`, `Recommended`, or `Later`.

## PickFit Architecture Rules

- Keep the MVP stack: PHP 8.2+, Composer PSR-4, PDO MySQL, native PHP session, vanilla JS, Tailwind CLI, PHPUnit, Playwright crawler.
- Do not introduce Laravel, Symfony, React, Vue, or a Node HTTP backend unless the user explicitly changes the plan.
- Serve API and SPA through `public/index.php`; non-API routes should return the SPA entry.
- Add deterministic fallback recommendation before depending on OpenAI.
- Keep OpenAI calls server-side. Never call OpenAI directly from the browser.
- Keep crawler public-page only with SSRF and private-network blocking.
- Preserve existing design tokens and asset paths during migrations.
- Avoid broad redesign while backend integration is underway.

## Output Shape

For architecture reviews, lead with findings:

```text
Finding:
Evidence:
Risk:
Recommendation:
Verification:
```

For implementation planning, use:

```text
Current state:
Target state:
Smallest safe step:
Files involved:
Verification:
Risk notes:
```

Do not create an HTML architecture report by default. If a visual report would help, ask the user first and write it outside the repo.
