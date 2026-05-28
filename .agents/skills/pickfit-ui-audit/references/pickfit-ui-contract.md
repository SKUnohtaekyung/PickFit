# PickFit UI Contract

## Shell

- The app is centered in a `max-width: 480px` wrapper.
- `#screen-container` is the dynamic screen target.
- `#bottom-nav` is fixed at the bottom.
- `#toast-container` is fixed above the nav.

## Screen Modules

- `renderLanding`
- `renderOnboarding`
- `renderLoading`
- `renderResults`
- `renderComparison`
- `renderDetail`
- `renderSaved`

Each screen writes to a passed `container` and binds events after rendering.

## Shared State

State lives in `js/utils/state.js` and persists to `localStorage` key `pickfit_state`.

Important fields:

- `onboarding`
- `recommendations`
- `saved`
- `feedback`
- `currentScreen`
- `previousScreen`
- `selectedOutfitId`
- `compareOutfitIds`

## Visual Regression Hotspots

- Landing situation grid.
- Onboarding fixed footer.
- Loading timeline.
- Results card actions.
- Detail save and feedback sheet.
- Saved empty state.
- Bottom nav center CTA.
