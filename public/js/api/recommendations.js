// ========================================
// PickFit Recommendations API Client
// ========================================

import { apiRequest } from './client.js';

export async function createRecommendationRun(conditions) {
  const payload = await apiRequest('/api/recommendations', {
    method: 'POST',
    csrf: true,
    body: conditions,
    timeoutMs: 45000,
  });

  return payload.data || null;
}

export async function getRecommendationRun(runId) {
  const payload = await apiRequest(`/api/recommendations/${encodeURIComponent(runId)}`);

  return payload.data || null;
}
