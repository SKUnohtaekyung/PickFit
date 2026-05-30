// Shared outfit/product resolution used by results/detail/comparison/saved screens.
// Lookup order: in-memory recommendations → saved entries. No mock fallback —
// when nothing matches the caller MUST handle null (e.g., redirect, empty state)
// so silently-corrupted mock data never leaks into a real recommendation flow.

import { state } from './state.js';

export function resolveOutfit(outfitId) {
  if (!outfitId) return null;
  const recs = state.get('recommendations') || [];
  const fromRecs = recs.find((outfit) => outfit?.id === outfitId);
  if (fromRecs) return fromRecs;
  const savedEntry = state.findSavedEntry(outfitId);
  if (savedEntry?.outfit) return savedEntry.outfit;
  return null;
}

export function resolveOutfitFromSaved(savedEntry) {
  if (savedEntry?.outfit) return savedEntry.outfit;
  return resolveOutfit(savedEntry?.id);
}

export function resolveProductFromItem(item) {
  if (item?.product) return item.product;
  return null;
}
