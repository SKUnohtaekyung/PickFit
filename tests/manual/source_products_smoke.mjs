#!/usr/bin/env node
// ========================================
// Source Product accumulator smoke
// ========================================
// Polyfills sessionStorage so the browser-targeted utility runs in Node.

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const mod = await import('../../public/js/utils/sourceProducts.js');
const { getSourceProductIds, addSourceProductId, clearSourceProductIds, countSourceMatches } = mod;

let passed = 0;
let failed = 0;
const assert = (label, cond) => {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
};
const j = (v) => JSON.stringify(v);

// 1) empty initial state
clearSourceProductIds();
assert('empty: getSourceProductIds() === []', j(getSourceProductIds()) === '[]');

// 2) add one
let r = addSourceProductId('a');
assert('add 1: returns ["a"]', j(r) === '["a"]');
assert('add 1: persisted', j(getSourceProductIds()) === '["a"]');

// 3) dedup keeps single entry and moves to end
r = addSourceProductId('a');
assert('dedup: stays ["a"]', j(r) === '["a"]');
addSourceProductId('b');
r = addSourceProductId('a');
assert('dedup: re-add moves to end ["b","a"]', j(r) === '["b","a"]');

// 4) FIFO eviction at 5
clearSourceProductIds();
for (const id of ['a', 'b', 'c', 'd', 'e']) addSourceProductId(id);
assert('FIFO: 5 items intact', j(getSourceProductIds()) === '["a","b","c","d","e"]');
r = addSourceProductId('f');
assert('FIFO: 6th evicts oldest ["b","c","d","e","f"]', j(r) === '["b","c","d","e","f"]');

// 5) non-string / empty id ignored
clearSourceProductIds();
addSourceProductId('a');
addSourceProductId('');
addSourceProductId(null);
addSourceProductId(undefined);
addSourceProductId(123);
assert('non-string / empty ignored — only ["a"]', j(getSourceProductIds()) === '["a"]');

// 6) invalid JSON in storage tolerated
store.set('pickfit_source_products', '{not-json');
assert('invalid JSON → []', j(getSourceProductIds()) === '[]');

// 7) non-array JSON tolerated
store.set('pickfit_source_products', '{"foo":"bar"}');
assert('non-array JSON → []', j(getSourceProductIds()) === '[]');

// 8) mixed array filtered to strings
store.set('pickfit_source_products', '["a", 1, null, "b", ""]');
assert('mixed array filtered → ["a","b"]', j(getSourceProductIds()) === '["a","b"]');

// 9) clear empties
addSourceProductId('z');
clearSourceProductIds();
assert('clear: empty after', j(getSourceProductIds()) === '[]');

// ---- countSourceMatches ----
const recs = [
  {
    items: [
      { productPublicId: 'src-1', alternatives: ['other-1'] },
      { productPublicId: 'other-2', alternatives: ['src-2', 'src-3'] },
    ],
  },
  {
    items: [
      { productPublicId: 'src-2', alternatives: ['other-3'] },
      { productPublicId: 'other-4', alternatives: [] },
    ],
  },
];

// 10) empty sources → 0/0
let m = countSourceMatches(recs, []);
assert('count: empty sources → 0/0', m.selected === 0 && m.alternatives === 0);

// 11) src-1 primary only (not in alternatives anywhere) → selected 1, alt 0
m = countSourceMatches(recs, ['src-1']);
assert('count: src-1 primary → selected=1, alt=0', m.selected === 1 && m.alternatives === 0);

// 12) src-2 appears as primary AND alternative → selected wins, alt dedup'd to 0
m = countSourceMatches(recs, ['src-2']);
assert('count: src-2 selected wins over alt → selected=1, alt=0', m.selected === 1 && m.alternatives === 0);

// 13) src-3 only in alternatives → selected=0, alt=1
m = countSourceMatches(recs, ['src-3']);
assert('count: src-3 alt-only → selected=0, alt=1', m.selected === 0 && m.alternatives === 1);

// 14) mixed: src-1 (primary), src-3 (alt), unknown ignored
m = countSourceMatches(recs, ['src-1', 'src-3', 'unknown']);
assert('count: mixed → selected=1, alt=1', m.selected === 1 && m.alternatives === 1);

// 15) malformed recs tolerated
assert('count: null recs → 0/0', JSON.stringify(countSourceMatches(null, ['src-1'])) === '{"selected":0,"alternatives":0}');
assert('count: empty recs → 0/0', JSON.stringify(countSourceMatches([], ['src-1'])) === '{"selected":0,"alternatives":0}');

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} total)`);
process.exit(failed ? 1 : 0);
