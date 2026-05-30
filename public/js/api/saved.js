// ========================================
// PickFit Saved Outfit and Feedback API Client
// ========================================

import { apiRequest } from './client.js';
import { endpointStatus } from './contracts.js';

export const savedOutfitApiStatus = endpointStatus('savedOutfits');
export const feedbackApiStatus = endpointStatus('feedback');

// Returns raw backend shape. Adaptation to UI shape is the caller's job
// (userActions.js::syncSavedFromApi) — single source of truth. Calling
// adaptSavedOutfitEntry here too would double-adapt and silently strip every
// backend-shape product field (brandName, priceSale, heroImageUrl, …).
// See WORKLOG "Day 9 hotfix — saved 이중 어댑팅 회귀".
export async function listSavedOutfits() {
  const payload = await apiRequest('/api/saved-outfits');
  return payload.data?.savedOutfits || [];
}

export async function saveOutfit(outfitId) {
  const payload = await apiRequest('/api/saved-outfits', {
    method: 'POST',
    csrf: true,
    body: {
      outfitId,
    },
  });

  return payload.data?.savedOutfit || null;
}

export async function deleteSavedOutfit(outfitId) {
  const payload = await apiRequest(`/api/saved-outfits/${encodeURIComponent(outfitId)}`, {
    method: 'DELETE',
    csrf: true,
  });

  return payload.data || {};
}

export async function submitFeedback({ outfitId = null, productId = null, feedbackType, tags = [], note = '' }) {
  const payload = await apiRequest('/api/feedback', {
    method: 'POST',
    csrf: true,
    body: {
      outfitId,
      productId,
      feedbackType,
      tags,
      note,
    },
  });

  return payload.data?.feedback || null;
}
