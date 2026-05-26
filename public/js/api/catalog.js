// ========================================
// PickFit Catalog API Client
// ========================================

import { apiRequest, toQuery } from './client.js';

export async function listProducts(params = {}) {
  const payload = await apiRequest(`/api/products${toQuery({
    category: params.category,
    maxPrice: params.maxPrice,
    limit: params.limit,
    cursor: params.cursor,
  })}`);

  return payload.data || {
    products: [],
    nextCursor: null,
  };
}

export async function getProduct(productId) {
  const payload = await apiRequest(`/api/products/${encodeURIComponent(productId)}`);

  return payload.data?.product || null;
}
