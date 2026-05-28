// ========================================
// PickFit API Contract Readiness
// ========================================

export const API_ENDPOINTS = Object.freeze({
  health: { method: 'GET', path: '/api/health', status: 'available' },
  csrf: { method: 'GET', path: '/api/csrf', status: 'available' },
  authMe: { method: 'GET', path: '/api/auth/me', status: 'available' },
  authRegister: { method: 'POST', path: '/api/auth/register', status: 'available' },
  authLogin: { method: 'POST', path: '/api/auth/login', status: 'available' },
  authLogout: { method: 'POST', path: '/api/auth/logout', status: 'available' },
  products: { method: 'GET', path: '/api/products', status: 'available' },
  productDetail: { method: 'GET', path: '/api/products/{id}', status: 'available' },
  recommendations: { method: 'POST', path: '/api/recommendations', status: 'available' },
  recommendationDetail: { method: 'GET', path: '/api/recommendations/{id}', status: 'available' },
  savedOutfits: { method: 'GET/POST', path: '/api/saved-outfits', status: 'available' },
  savedOutfitDetail: { method: 'DELETE', path: '/api/saved-outfits/{id}', status: 'available' },
  feedback: { method: 'POST', path: '/api/feedback', status: 'available' },
  analyzeUrl: { method: 'POST', path: '/api/catalog/analyze-url', status: 'planned-day-7' },
  crawlJob: { method: 'GET', path: '/api/catalog/crawl-jobs/{id}', status: 'planned-day-7' },
});

export function endpointStatus(key) {
  return API_ENDPOINTS[key]?.status || 'unknown';
}

// Recommendation response source discriminator. Returned by POST /api/recommendations and
// GET /api/recommendations/{id} as `data.source`. UI must not rely on a specific value —
// both should render identically; this is for observability and debugging only.
export const RECOMMENDATION_SOURCES = Object.freeze({
  OPENAI: 'openai',
  FALLBACK: 'fallback',
});
