// ========================================
// PickFit Saved Outfit and Feedback API Client
// ========================================

import { apiRequest } from './client.js';

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

  return payload.data || null;
}

export async function deleteSavedOutfit(savedOutfitId) {
  const payload = await apiRequest(`/api/saved-outfits/${encodeURIComponent(savedOutfitId)}`, {
    method: 'DELETE',
    csrf: true,
  });

  return payload.data || {};
}

export async function submitFeedback({ outfitId, productId = null, feedbackType, tags = [], note = '' }) {
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

  return payload.data || null;
}
