// ========================================
// PickFit Recommendations API Client
// ========================================

import { apiRequest } from './client.js';
import { endpointStatus } from './contracts.js';

export const recommendationApiStatus = endpointStatus('recommendations');

export async function createRecommendationRun(conditions, sourceProductIds = []) {
  // Frontend timeout sits above backend OPENAI_TIMEOUT_SECONDS (60) plus DB write
  // headroom. If you change this, also bump the env value or you'll cut OpenAI calls
  // short on the client side.
  const payload = await apiRequest('/api/recommendations', {
    method: 'POST',
    csrf: true,
    body: {
      conditions,
      sourceProductIds,
    },
    timeoutMs: 75000,
  });

  return payload.data || null;
}

export async function getRecommendationRun(runId) {
  const payload = await apiRequest(`/api/recommendations/${encodeURIComponent(runId)}`);

  return payload.data || null;
}
