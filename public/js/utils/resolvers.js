// Shared outfit/product resolution used by results/detail/comparison/saved screens.
// Lookup order: in-memory recommendations -> saved entries -> mock data.

import { state } from './state.js';
import { getOutfit as getMockOutfit, getProduct as getMockProduct } from '../data/mock.js';

export function resolveOutfit(outfitId) {
  if (!outfitId) return null;
  const recs = state.get('recommendations') || [];
  const fromRecs = recs.find((outfit) => outfit?.id === outfitId);
  if (fromRecs) return fromRecs;
  const savedEntry = state.findSavedEntry(outfitId);
  if (savedEntry?.outfit) return savedEntry.outfit;
  return getMockOutfit(outfitId);
}

export function resolveOutfitFromSaved(savedEntry) {
  if (savedEntry?.outfit) return savedEntry.outfit;
  return resolveOutfit(savedEntry?.id);
}

export function resolveProductFromItem(item) {
  if (item?.product) return item.product;
  if (item?.productId) return getMockProduct(item.productId);
  return null;
}
