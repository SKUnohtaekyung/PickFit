// ========================================
// PickFit Saved Outfit and Feedback API Client
// ========================================

import { apiRequest } from './client.js';
import { endpointStatus } from './contracts.js';
import { adaptSavedOutfitEntry } from './recommendationAdapter.js';

export const savedOutfitApiStatus = endpointStatus('savedOutfits');
export const feedbackApiStatus = endpointStatus('feedback');

export async function listSavedOutfits() {
  const payload = await apiRequest('/api/saved-outfits');
  const entries = payload.data?.savedOutfits || [];
  return entries.map(adaptSavedOutfitEntry);
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
