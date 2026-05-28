# PickFit Project Map

Use this compact map before loading larger project documents.

## Current Implementation

- `index.html` is the static SPA entry.
- `js/app.js` is the SPA router. It maps screen names to render functions and owns `navigateTo`.
- `js/screens/` contains screen renderers: landing, onboarding, loading, results, comparison, detail, saved.
- `js/components/navbar.js` renders the fixed bottom navigation.
- `js/utils/state.js` stores app state in `localStorage` under `pickfit_state`.
- `js/data/mock.js` contains the current catalog and outfit mock data.
- `css/styles.css` contains PickFit design tokens and screen styles.
- `assets/`, `img/`, `LOGO/`, and `docs/images/` contain visual assets.

## Target Direction

- Move toward `public/index.php` as PHP front controller.
- Serve SPA as `public/app.html` or equivalent non-API fallback.
- Add `src/Bootstrap.php`, `src/Config.php`, `src/Http/*`, controllers, services, repositories.
- Add MySQL migrations and seed data generated from current mock data.
- Add API-backed recommendations with deterministic fallback before OpenAI.
- Add Playwright CLI crawler later, not as a Node server.

## High-Risk Areas

- Moving files can break image paths in HTML, CSS, and JS templates.
- `localStorage` state shape is shared across many screens.
- Current Korean strings appear mojibake in several files; do not bulk rewrite text unless explicitly requested.
- There are no current build/test scripts beyond `npm run dev`.
- Target docs describe future implementation; verify what exists before assuming it is built.
