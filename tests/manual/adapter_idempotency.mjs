// Adapter idempotency smoke.
//
// Bug pattern this guards against: calling adaptSavedOutfitEntry on already-
// adapted data silently strips every backend-shape product field, because the
// adapter looks up `brandName/productName/priceSale/heroImageUrl/fitType/…`
// but the second invocation receives UI-shape (`brand/name/price/image/fit`).
// The result is brand='', name='', price=0, image='', fit='-' …
//
// The contract: adaptSavedOutfitEntry should be idempotent (or at least the
// pipeline should detect double-adapt and warn/fail). We assert idempotency
// on the user-visible UI fields here.
//
// Run: node tests/manual/adapter_idempotency.mjs

import { adaptSavedOutfitEntry, adaptRecommendationResponse } from '../../public/js/api/recommendationAdapter.js';

let pass = 0;
let fail = 0;
const lines = [];

function assertEq(label, expected, actual) {
  const ok = Object.is(expected, actual);
  if (ok) {
    pass++;
    lines.push(`PASS  ${label}`);
  } else {
    fail++;
    lines.push(`FAIL  ${label}\n      expected=${JSON.stringify(expected)}\n      actual=${JSON.stringify(actual)}`);
  }
}

// Synthetic raw API entry — matches what UserActionController::listSaved emits
// after listForUser + itemsForOutfits are merged together.
const rawSavedEntry = {
  savedOutfitId: 42,
  savedAt: '2026-05-28T16:00:00+09:00',
  outfit: {
    id: 999,                                       // internal numeric id
    publicId: '01HYZTESTABCDEFGH',                 // ULID surfaced to clients
    runId: 7,
    title: '비 오는 날에 적합한 캐주얼 룩',
    summary: 'demo',
    framingLabel: '상황 적합도 우선',
    totalPrice: 158000,
    reasonText: '이유 1 이유 2',
    reasons: ['이유 1', '이유 2'],
    evidence: [],
    risks: [],
    reviewEvidence: '리뷰 데이터 부족',
    confidence: 0.7,
    sortOrder: 0,
    items: [
      {
        slot: 'top',
        productPublicId: 'prod-004',
        product: {
          id: 'prod-004',
          brandName: 'DEPOUND',
          productName: 'Relaxed Oversized Knit',
          priceSale: 58000,
          priceOriginal: 68000,
          discountRate: 15,
          heroImageUrl: '/assets/products/knit_beige.webp',
          productPageUrl: '#',
          fitType: 'oversized',
          seasonality: 'fall/winter',
          colorFamily: 'beige',
          categoryMain: 'top',
          categorySub: 'knit',
        },
        alternativeProductIds: [],
        reason: null,
      },
      {
        slot: 'bottom',
        productPublicId: 'prod-002',
        product: {
          id: 'prod-002',
          brandName: 'MUSINSA STANDARD',
          productName: 'Black Wide Slacks',
          priceSale: 39000,
          priceOriginal: 39000,
          discountRate: 0,
          heroImageUrl: '/assets/products/slacks_black.webp',
          productPageUrl: '#',
          fitType: 'regular',
          seasonality: 'all-season',
          colorFamily: 'black',
          categoryMain: 'bottom',
          categorySub: 'slacks',
        },
        alternativeProductIds: [],
        reason: null,
      },
    ],
  },
};

// First adaptation: raw backend-shape → UI-shape. This is what userActions.js
// does in syncSavedFromApi (after the api/saved.js hotfix that removed its
// internal adapter call).
const once = adaptSavedOutfitEntry(rawSavedEntry, 0);
const p1 = once.outfit.items[0].product;

assertEq('1st adapt: top brand preserved', 'DEPOUND', p1.brand);
assertEq('1st adapt: top name preserved',  'Relaxed Oversized Knit', p1.name);
assertEq('1st adapt: top price=58000',     58000, p1.price);
assertEq('1st adapt: top image preserved', '/assets/products/knit_beige.webp'.replace(/^\/+/, ''), p1.image);
assertEq('1st adapt: top fit=oversized',   'oversized', p1.fit);
assertEq('1st adapt: top season=fall/winter', 'fall/winter', p1.season);
assertEq('1st adapt: top discountRate=15', 15, p1.discountRate);

// Second adaptation: feed the already-adapted entry back in. We expect the
// adapter to leave the UI-visible fields untouched OR to detect the prior
// adaptation. Currently it silently corrupts them, which is the bug —
// these assertions will FAIL until the adapter is made idempotent or callers
// guarantee single-adapt (the chosen fix is the latter via api/saved.js hotfix).
//
// We still run the assertions to lock in the contract. If they ever flip to
// PASS in the future (idempotent adapter), even better.
const twice = adaptSavedOutfitEntry(once, 0);
const p2 = twice.outfit.items[0].product;

assertEq('2nd adapt: top brand survives 2x', p1.brand, p2.brand);
assertEq('2nd adapt: top name survives 2x',  p1.name,  p2.name);
assertEq('2nd adapt: top price survives 2x', p1.price, p2.price);
assertEq('2nd adapt: top image survives 2x', p1.image, p2.image);
assertEq('2nd adapt: top fit survives 2x',   p1.fit,   p2.fit);
assertEq('2nd adapt: top season survives 2x', p1.season, p2.season);

// Outfit-level id must survive — second adapt previously fell back to
// `outfit-1` because UI shape uses `id` not `publicId`.
assertEq('2nd adapt: outfit id survives', once.outfit.id, twice.outfit.id);

// Same check via the recommendation response adapter — chained 2× must not
// strip product fields.
const apiResponse = {
  runId: 'run-1',
  source: 'openai',
  conditions: {},
  outfits: [rawSavedEntry.outfit],
};
const respOnce = adaptRecommendationResponse(apiResponse);
const respTwice = adaptRecommendationResponse({ ...apiResponse, outfits: respOnce.outfits });
const r1 = respOnce.outfits[0].items[0].product;
const r2 = respTwice.outfits[0].items[0].product;
assertEq('adaptRecommendationResponse: brand survives 2x', r1.brand, r2.brand);
assertEq('adaptRecommendationResponse: price survives 2x', r1.price, r2.price);
assertEq('adaptRecommendationResponse: image survives 2x', r1.image, r2.image);

console.log(lines.join('\n'));
console.log('-'.repeat(60));
console.log(`TOTAL: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
