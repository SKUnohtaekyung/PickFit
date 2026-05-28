// ========================================
// PickFit User Action Sync (saved outfits + feedback)
// ========================================
// Bridges API calls (saved.js, recommendationAdapter.js) with state.js so
// screens can call simple functions and we keep auth-aware fallback in one place.

import { state } from '../utils/state.js';
import { ApiError } from './client.js';
import { currentUser } from './auth.js';
import { adaptSavedOutfitEntry } from './recommendationAdapter.js';
import {
  deleteSavedOutfit as apiDeleteSavedOutfit,
  listSavedOutfits as apiListSavedOutfits,
  saveOutfit as apiSaveOutfit,
  submitFeedback as apiSubmitFeedback,
} from './saved.js';

let cachedAuth = null;

export function setAuthSignal(user) {
  cachedAuth = user || null;
}

export async function refreshAuthSignal() {
  try {
    const user = await currentUser();
    cachedAuth = user;
    return user;
  } catch (_) {
    cachedAuth = null;
    return null;
  }
}

export function getAuthSignal() {
  return cachedAuth;
}

export async function syncSavedFromApi() {
  const user = await refreshAuthSignal();
  if (!user) {
    return { source: 'local', entries: state.get('saved') || [] };
  }
  try {
    const rawEntries = await apiListSavedOutfits();
    const adaptedEntries = Array.isArray(rawEntries)
      ? rawEntries.map((entry, index) => adaptSavedOutfitEntry(entry, index))
      : [];
    state.replaceSavedFromApi(adaptedEntries);
    return { source: 'api', entries: adaptedEntries };
  } catch (error) {
    return { source: 'local', error, entries: state.get('saved') || [] };
  }
}

export async function persistToggleSaved(outfit, justSaved) {
  if (!outfit?.id) {
    return { ok: false, status: 'invalid' };
  }
  if (!cachedAuth) {
    return { ok: true, status: 'local' };
  }
  try {
    if (justSaved) {
      const saved = await apiSaveOutfit(outfit.id);
      state.markSavedFromApi(outfit.id, {
        savedAt: saved?.savedAt || new Date().toISOString(),
        savedOutfitId: saved?.savedOutfitId || null,
        outfit,
      });
      return { ok: true, status: 'api-saved' };
    }
    await apiDeleteSavedOutfit(outfit.id);
    return { ok: true, status: 'api-deleted' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      cachedAuth = null;
      return { ok: false, status: 'unauthenticated' };
    }
    return { ok: false, status: 'api-error', error };
  }
}

export async function persistFeedback({ outfitId = null, productId = null, feedbackType, tags = [], note = '' }) {
  if (!cachedAuth) {
    return { ok: true, status: 'local' };
  }
  try {
    const feedback = await apiSubmitFeedback({ outfitId, productId, feedbackType, tags, note });
    return { ok: true, status: 'api', feedback };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      cachedAuth = null;
      return { ok: false, status: 'unauthenticated' };
    }
    return { ok: false, status: 'api-error', error };
  }
}
