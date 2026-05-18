// ========================================
// PickFit Global State Manager
// ========================================

const STATE_KEY = 'pickfit_state';

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
};

class StateManager {
  constructor() {
    this._state = this._load();
    this._listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.warn('State load failed, using default:', e);
    }
    return { ...defaultState };
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
    this._save();
    this._notify(key);
  }

  update(key, updater) {
    this._state[key] = updater(this._state[key]);
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
    this._state.onboarding = { ...defaultState.onboarding };
    this._state.recommendations = [];
    this._state.selectedOutfitId = null;
    this._state.compareOutfitIds = [];
    this._save();
    this._notify('onboarding');
  }

  toggleSaved(outfitId) {
    const idx = this._state.saved.findIndex(s => s.id === outfitId);
    if (idx >= 0) {
      this._state.saved.splice(idx, 1);
    } else {
      this._state.saved.push({
        id: outfitId,
        savedAt: new Date().toISOString(),
      });
    }
    this._save();
    this._notify('saved');
    return idx < 0; // true if just saved
  }

  isSaved(outfitId) {
    return this._state.saved.some(s => s.id === outfitId);
  }

  addFeedback(tags) {
    this._state.feedback.push({
      tags,
      timestamp: new Date().toISOString(),
    });
    this._save();
    this._notify('feedback');
  }
}

export const state = new StateManager();
