---
name: pickfit-ui-audit
description: Audit PickFit frontend UI, UX, accessibility, responsiveness, and visual regressions. Use when reviewing index.html, css/styles.css, js/screens, navbar, onboarding/results/detail flows, asset rendering, mobile 480px layout, or backend-driven UI state after integration.
---

# PickFit UI Audit

Use this skill to check PickFit UI quality while preserving the existing product direction.

## Sources

- `design_system.md` for brand and UX intent.
- `css/styles.css` for actual tokens and screen styles.
- `index.html` for shell layout and Tailwind CDN config.
- `js/screens/*.js` for screen markup and interactions.
- `js/components/navbar.js` for bottom navigation.
- `references/pickfit-ui-contract.md` for compact rules.

When a general web best-practice audit is requested, use the installed `web-design-guidelines` skill as a secondary checklist.

## PickFit UI Rules

- Preserve the mobile app-like max-width 480px shell.
- Preserve `--pf-*` design tokens.
- Do not redesign the product while backend integration is underway.
- Avoid adding new frameworks.
- Check fixed bottom nav, toast, onboarding footer, and result/detail actions for overlap.
- Verify image paths after file moves.
- Keep accessible button labels for icon controls.
- Keep text inside compact controls from overflowing.
- Avoid changing mojibake Korean strings unless the user explicitly asks for text repair.

## Audit Workflow

1. Inspect relevant files statically.
2. Run or request the app URL when visual verification matters.
3. Use Browser/in-app browser for mobile and desktop viewport checks when available.
4. Report only actionable issues, ordered by severity.

## Output Shape

```text
Finding:
File:
Evidence:
Impact:
Suggested fix:
Verification:
```

If no issues are found, say that clearly and list residual risk.
