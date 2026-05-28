// ========================================
// PickFit Catalog API Client
// ========================================

import { apiRequest, toQuery, ApiError } from './client.js';

export async function analyzeUrl(url) {
  try {
    const payload = await apiRequest('/api/catalog/analyze-url', {
      method: 'POST',
      body: { url },
      csrf: true,
      timeoutMs: 60000,
    });
    return { ok: true, job: payload.data?.job || null };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'blocked_url') {
      return {
        ok: false,
        blocked: true,
        code: 'blocked_url',
        message: error.message,
        job: error.payload?.data?.job || null,
      };
    }
    throw error;
  }
}

export async function getCrawlJob(jobId) {
  const payload = await apiRequest(`/api/catalog/crawl-jobs/${encodeURIComponent(jobId)}`);
  return payload.data?.job || null;
}

export async function listProducts(params = {}) {
  const payload = await apiRequest(`/api/products${toQuery({
    category: params.category,
    situation: params.situation,
    style: params.style,
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
