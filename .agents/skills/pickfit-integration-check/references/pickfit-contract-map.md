# PickFit Integration Contract Map

Use this map for cross-layer checks.

## Frontend Current State

- Screen routing is in `js/app.js`.
- State is in `js/utils/state.js`.
- Mock data is in `js/data/mock.js`.
- Results/detail/comparison screens expect outfit objects with items that reference product IDs.
- Product images are relative paths such as `assets/products/shirt_white.webp`.

## Backend Target Slices

Day 1:

- `/` serves SPA.
- `/api/health` returns JSON.

Day 2:

- MySQL schema and seed.
- `GET /api/products` returns seeded catalog data.

Recommendation:

- `POST /api/recommendations` accepts onboarding conditions.
- It returns up to three outfits.
- Fallback must work without OpenAI.

Persistence:

- Saved outfits and feedback should survive refresh after backend persistence is introduced.

Crawler:

- URL analysis rejects private/local URLs.
- Crawler is a Playwright CLI worker called by PHP, not a server.

## Mismatch Hotspots

- Product image paths after moving to `public/`.
- Price/label encoding and Korean mojibake.
- `localStorage` saved state versus backend saved state.
- Recommendation IDs used by detail and comparison screens.
- Fallback warning display.
