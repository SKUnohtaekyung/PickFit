# PickFit Verification Reference

## Current Commands

`package.json` currently defines:

```bash
npm run dev
```

which runs:

```bash
http-server . -p 8000 -c-1
```

README also mentions:

```bash
python -m http.server 8000
```

There is no current `npm test` or `npm run build` unless later changes add them.

## Target Commands

Target backend server:

```bash
php -S 127.0.0.1:8000 -t public public/index.php
```

Target Tailwind watch:

```bash
npx @tailwindcss/cli -i ./public/css/input.css -o ./public/css/app.css --watch
```

Target Tailwind production:

```bash
npx @tailwindcss/cli -i ./public/css/input.css -o ./public/css/app.css --minify
```

## Smoke Checks

- `/` serves the SPA.
- `/api/health` returns JSON.
- Product images render.
- Onboarding reaches results.
- Save and feedback persist after refresh once backend persistence exists.
- Unsafe crawler URLs are rejected once crawler is implemented.
