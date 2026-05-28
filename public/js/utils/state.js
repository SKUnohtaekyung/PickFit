// ========================================
// PickFit Global State Manager
// ========================================

const STATE_KEY = 'pickfit_state';
const SERVER_BACKED_KEYS = ['recommendations', 'saved', 'feedback'];

const defaultState = {
  onboarding: {
    situation: null,
    budget: null,
    mood: [],
    fit: null,
    bodyType: [],
    colors: [],
    avoidances: [],
    freeText: '',
  },
  recommendations: [],
  saved: [],
  feedback: [],
  currentScreen: 'landing',
  previousScreen: null,
  selectedOutfitId: null,
  compareOutfitIds: [],
  lastRunId: null,
  dataSources: {
    recommendations: 'empty',
    saved: 'local-fallback',
    feedback: 'local-fallback',
  },
  apiCache: {
    catalog: {
      products: [],
      fetchedAt: null,
    },
  },
};

function cloneDefaultState() {
  return {
    onboarding: {
      ...defaultState.onboarding,
      mood: [...defaultState.onboarding.mood],
      bodyType: [...defaultState.onboarding.bodyType],
      colors: [...defaultState.onboarding.colors],
      avoidances: [...defaultState.onboarding.avoidances],
    },
    recommendations: [],
    saved: [],
    feedback: [],
    currentScreen: defaultState.currentScreen,
    previousScreen: defaultState.previousScreen,
    selectedOutfitId: defaultState.selectedOutfitId,
    compareOutfitIds: [],
    dataSources: { ...defaultState.dataSources },
    apiCache: {
      catalog: { ...defaultState.apiCache.catalog },
    },
  };
}

class StateManager {
  constructor() {
    this._state = this._load();
    this._listeners = [];
  }

  _load() {
    const base = cloneDefaultState();

    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return this._normalize({
          ...base,
          ...parsed,
          onboarding: { ...base.onboarding, ...(parsed.onboarding || {}) },
          dataSources: { ...base.dataSources, ...(parsed.dataSources || {}) },
          apiCache: {
            ...base.apiCache,
            ...(parsed.apiCache || {}),
            catalog: {
              ...base.apiCache.catalog,
              ...(parsed.apiCache?.catalog || {}),
            },
          },
        });
      }
    } catch (e) {
      console.warn('State load failed, using default:', e);
    }
    return this._normalize(base);
  }

  _normalize(nextState) {
    SERVER_BACKED_KEYS.forEach((key) => {
      if (!Array.isArray(nextState[key])) {
        nextState[key] = [];
      }
    });

    if (!Array.isArray(nextState.compareOutfitIds)) {
      nextState.compareOutfitIds = [];
    }

    return nextState;
  }

  _save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this._state));
    } catch (e) {
      console.warn('State save failed:', e);
    }
  }

  _notify(key) {
    this._listeners.forEach(fn => fn(key, this._state));
  }

  get(key) {
    return key ? this._state[key] : { ...this._state };
  }

  set(key, value) {
    this._state[key] = value;
    this._markImplicitSource(key);
    this._save();
    this._notify(key);
  }

  update(key, updater) {
    this._state[key] = updater(this._state[key]);
    this._markImplicitSource(key);
    this._save();
    this._notify(key);
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  resetOnboarding() {
    const fresh = cloneDefaultState();
    this._state.onboarding = fresh.onboarding;
    this._state.recommendations = [];
    this._state.dataSources.recommendations = 'empty';
    this._state.selectedOutfitId = null;
    this._state.compareOutfitIds = [];
    this._save();
    this._notify('onboarding');
  }

  setRecommendations(recommendations, source = 'mock') {
    this._state.recommendations = Array.isArray(recommendations) ? recommendations : [];
    this._state.dataSources.recommendations = source;
    this._save();
    this._notify('recommendations');
  }

  toggleSaved(outfitId, outfit = null) {
    const idx = this._state.saved.findIndex(s => s.id === outfitId);
    if (idx >= 0) {
      this._state.saved.splice(idx, 1);
    } else {
      this._state.saved.push({
        id: outfitId,
        savedAt: new Date().toISOString(),
        outfit: outfit || null,
        source: 'local',
      });
    }
    this._state.dataSources.saved = 'local-fallback';
    this._save();
    this._notify('saved');
    return idx < 0; // true if just saved
  }

  replaceSavedFromApi(entries) {
    this._state.saved = Array.isArray(entries) ? entries.map((entry) => ({
      id: entry.outfit?.id || entry.outfit?.publicId || entry.id,
      savedAt: entry.savedAt || new Date().toISOString(),
      outfit: entry.outfit || null,
      savedOutfitId: entry.savedOutfitId || null,
      source: 'api',
    })).filter((e) => e.id) : [];
    this._state.dataSources.saved = 'api';
    this._save();
    this._notify('saved');
  }

  markSavedFromApi(outfitId, entry) {
    const idx = this._state.saved.findIndex(s => s.id === outfitId);
    const next = {
      id: outfitId,
      savedAt: entry?.savedAt || new Date().toISOString(),
      outfit: entry?.outfit || null,
      savedOutfitId: entry?.savedOutfitId || null,
      source: 'api',
    };
    if (idx >= 0) {
      this._state.saved.splice(idx, 1, next);
    } else {
      this._state.saved.push(next);
    }
    this._state.dataSources.saved = 'api';
    this._save();
    this._notify('saved');
  }

  removeSaved(outfitId) {
    const idx = this._state.saved.findIndex(s => s.id === outfitId);
    if (idx < 0) return false;
    this._state.saved.splice(idx, 1);
    this._save();
    this._notify('saved');
    return true;
  }

  clearSaved() {
    this._state.saved = [];
    this._state.dataSources.saved = 'local-fallback';
    this._save();
    this._notify('saved');
  }

  isSaved(outfitId) {
    return this._state.saved.some(s => s.id === outfitId);
  }

  findSavedEntry(outfitId) {
    return this._state.saved.find(s => s.id === outfitId) || null;
  }

  addFeedback(tags, source = 'local-fallback') {
    this._state.feedback.push({
      tags,
      timestamp: new Date().toISOString(),
    });
    this._state.dataSources.feedback = source;
    this._save();
    this._notify('feedback');
  }

  sourceOf(key) {
    return this._state.dataSources?.[key] || 'unknown';
  }

  _markImplicitSource(key) {
    if (key === 'recommendations') {
      this._state.dataSources.recommendations = 'mock';
    }
  }
}

export const state = new StateManager();
