// ========================================
// PickFit SPA Router & App Entry
// ========================================

import { state } from './utils/state.js';
import { renderNavbar } from './components/navbar.js';
import { renderLanding } from './screens/landing.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderLoading } from './screens/loading.js';
import { renderResults } from './screens/results.js';
import { renderComparison } from './screens/comparison.js';
import { renderDetail } from './screens/detail.js';
import { renderSaved } from './screens/saved.js';

const SCREENS = {
  landing: renderLanding,
  onboarding: renderOnboarding,
  loading: renderLoading,
  results: renderResults,
  comparison: renderComparison,
  detail: renderDetail,
  saved: renderSaved,
};

// Hide nav on certain screens to focus on the flow
const HIDE_NAV = ['onboarding', 'loading'];

let currentScreen = null;

state.subscribe((key) => {
  if (!['onboarding', 'saved'].includes(key)) return;

  const screen = state.get('currentScreen') || currentScreen;
  if (!screen || HIDE_NAV.includes(screen)) return;

  renderNavbar(screen, navigateTo);
});

export function navigateTo(screen, params = {}) {
  const container = document.getElementById('screen-container');

  // Track navigation
  const prev = currentScreen;
  currentScreen = screen;
  state.set('previousScreen', prev);
  state.set('currentScreen', screen);

  // Fade out old content
  container.classList.add('screen-exit');

  setTimeout(() => {
    container.innerHTML = '';
    container.classList.remove('screen-exit');
    container.style.paddingBottom = HIDE_NAV.includes(screen) ? '0px' : '128px';

    // Render new screen
    const renderFn = SCREENS[screen];
    if (renderFn) {
      renderFn(container, { navigateTo, ...params });
    }

    // Animate in
    container.classList.add('screen-enter');
    setTimeout(() => container.classList.remove('screen-enter'), 300);

    // Update navbar
    const nav = document.getElementById('bottom-nav');
    if (HIDE_NAV.includes(screen)) {
      nav.style.display = 'none';
    } else {
      nav.style.display = '';
      renderNavbar(screen, navigateTo);
    }

    // Scroll to top
    window.scrollTo(0, 0);
  }, 130);
}

// Initialize app
function init() {
  navigateTo('landing');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
