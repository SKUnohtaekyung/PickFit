// ========================================
// PickFit Source Product Accumulator
// ========================================
// Tracks publicIds the user just analyzed via URL analyzer so the next
// recommendation run can pre-bias toward them and results.js can show
// "방금 분석한 N개 반영됨". sessionStorage so it resets per tab and never
// leaks across users on the same browser.

const KEY = 'pickfit_source_products';
const MAX = 5;

export function getSourceProductIds() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string' && id !== '');
  } catch (_) {
    return [];
  }
}

export function addSourceProductId(id) {
  if (typeof id !== 'string' || id === '') return getSourceProductIds();
  const next = getSourceProductIds().filter((existing) => existing !== id);
  next.push(id);
  while (next.length > MAX) next.shift();
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {
    // sessionStorage full / disabled — drop silently, caller falls back to [].
  }
  return next;
}

export function clearSourceProductIds() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (_) {
    // ignore
  }
}

// Counts how many of the user's recently-analyzed source products actually
// landed in the recommendation response. `selected` = primary item match;
// `alternatives` = appeared only as a slot alternative (and not also primary).
// A product is never counted in both buckets simultaneously.
export function countSourceMatches(recommendations, sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0 || !Array.isArray(recommendations)) {
    return { selected: 0, alternatives: 0 };
  }
  const sourceSet = new Set(sourceIds);
  const selectedSet = new Set();
  const alternativeSet = new Set();

  for (const outfit of recommendations) {
    const items = Array.isArray(outfit?.items) ? outfit.items : [];
    for (const item of items) {
      const primary = item?.productPublicId || item?.productId || item?.product?.id || null;
      if (typeof primary === 'string' && sourceSet.has(primary)) {
        selectedSet.add(primary);
      }
      const alts = Array.isArray(item?.alternatives) ? item.alternatives : [];
      for (const altId of alts) {
        if (typeof altId === 'string' && sourceSet.has(altId)) {
          alternativeSet.add(altId);
        }
      }
    }
  }
  for (const id of selectedSet) alternativeSet.delete(id);

  return { selected: selectedSet.size, alternatives: alternativeSet.size };
}
