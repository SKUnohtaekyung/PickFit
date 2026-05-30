// ========================================
// PickFit SPA Router & App Entry
// ========================================

import { state } from './utils/state.js';
import { renderNavbar } from './components/navbar.js';
import { initializeAuth, getAuthUser, clearAuthUser } from './components/authModal.js';
import { createSplash } from './components/splash.js';
import { renderWelcome } from './screens/welcome.js';
import { renderAuth } from './screens/auth.js';
import { renderAccount } from './screens/account.js';
import { renderHome } from './screens/home.js';
import { renderLanding } from './screens/landing.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderLoading } from './screens/loading.js';
import { renderResults } from './screens/results.js';
import { renderComparison } from './screens/comparison.js';
import { renderDetail } from './screens/detail.js';
import { renderSaved } from './screens/saved.js';
import { setAuthSignal, syncSavedFromApi } from './api/userActions.js';

const SCREENS = {
  splash: null, // splash is an overlay, never routed through navigateTo
  welcome: renderWelcome,
  auth: renderAuth,
  account: renderAccount,
  home: renderHome,
  landing: renderLanding,
  onboarding: renderOnboarding,
  loading: renderLoading,
  results: renderResults,
  comparison: renderComparison,
  detail: renderDetail,
  saved: renderSaved,
};

// Hide bottom nav on focus/entry screens.
const HIDE_NAV = ['welcome', 'auth', 'account', 'onboarding', 'loading'];

// Auth-first model: the whole app behind welcome/auth requires a logged-in
// user, so there is never a mid-flow login wall (the user pinned this). Only
// welcome + auth are public; everything else routes to auth when signed out.
const GATED = new Set(['home', 'landing', 'onboarding', 'loading', 'results', 'comparison', 'detail', 'saved', 'account']);

const EXIT_CLASS = { fade: 'screen-exit', 'push-forward': 'screen-exit-left', 'push-back': 'screen-exit-right' };
const ENTER_CLASS = { fade: 'screen-enter', 'push-forward': 'screen-enter-right', 'push-back': 'screen-enter-left' };

let currentScreen = null;
let transitioning = false;
let pendingScreen = null;

function reducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function transitionFor(prev, next) {
  if (reducedMotion()) return 'fade';
  if (prev === 'welcome' && next === 'auth') return 'push-forward';
  if (prev === 'auth' && next === 'welcome') return 'push-back';
  return 'fade';
}

// Re-render navbar on auth/onboarding/saved changes, but never while a screen
// transition is mid-flight (the container is being swapped and currentScreen
// already points at the new screen — rendering now would paint against stale DOM).
state.subscribe((key) => {
  if (transitioning) return;
  if (!['onboarding', 'saved'].includes(key)) return;
  const screen = state.get('currentScreen') || currentScreen;
  if (!screen || HIDE_NAV.includes(screen)) return;
  renderNavbar(screen, navigateTo);
});

function handleAuthSuccess() {
  const target = pendingScreen || 'home';
  pendingScreen = null;
  navigateTo(target);
}

export function navigateTo(screen, params = {}) {
  // Soft-gate guard — runs BEFORE any state mutation or class change so a
  // redirect can't double-trigger the transition timers. Pure reassignment.
  if (GATED.has(screen) && !getAuthUser()) {
    pendingScreen = screen;
    screen = 'auth';
  } else if (screen !== 'auth') {
    // Navigating anywhere other than auth abandons a pending gated target, so a
    // later *intentional* login isn't misrouted to a screen the user backed out of.
    pendingScreen = null;
  }

  const container = document.getElementById('screen-container');
  const prev = currentScreen;
  const transition = params.transition || transitionFor(prev, screen);

  currentScreen = screen;
  state.set('previousScreen', prev);
  state.set('currentScreen', screen);

  const paint = () => {
    container.innerHTML = '';
    container.style.paddingBottom = HIDE_NAV.includes(screen) ? '0px' : '128px';

    const renderFn = SCREENS[screen];
    if (renderFn) {
      const extra = screen === 'auth' ? { onAuthSuccess: handleAuthSuccess } : {};
      renderFn(container, { navigateTo, ...params, ...extra });
    }

    const nav = document.getElementById('bottom-nav');
    if (HIDE_NAV.includes(screen)) {
      nav.style.display = 'none';
    } else {
      nav.style.display = '';
      renderNavbar(screen, navigateTo);
    }

    window.scrollTo(0, 0);
  };

  if (transition === 'none') {
    transitioning = false;
    container.classList.remove(...Object.values(EXIT_CLASS), ...Object.values(ENTER_CLASS));
    paint();
    return;
  }

  const exitClass = EXIT_CLASS[transition] || EXIT_CLASS.fade;
  const enterClass = ENTER_CLASS[transition] || ENTER_CLASS.fade;

  transitioning = true;
  container.classList.add(exitClass);

  setTimeout(() => {
    container.classList.remove(exitClass);
    paint();
    container.classList.add(enterClass);
    setTimeout(() => {
      container.classList.remove(enterClass);
      transitioning = false;
    }, 300);
  }, 130);
}

function decideDestination() {
  // Auth-first: signed-in users land on the personalized home; everyone else
  // sees the welcome/brand entry which leads into register/login.
  return getAuthUser() ? 'home' : 'welcome';
}

async function bootstrap() {
  let splashShown = false;
  try { splashShown = sessionStorage.getItem('pf_splash_shown') === '1'; } catch (e) { /* ignore */ }

  let firstEver = false;
  try { firstEver = localStorage.getItem('pf_seen_welcome') !== '1'; } catch (e) { /* ignore */ }

  // Full intro only on a genuine first-ever launch; otherwise a minimal hold
  // that just covers the auth round-trip.
  const splash = createSplash({ full: firstEver && !splashShown });
  try { sessionStorage.setItem('pf_splash_shown', '1'); } catch (e) { /* ignore */ }

  // initializeAuth never rejects (its own .catch maps failures to anonymous);
  // a transient /me failure leaves getAuthUser() as-is so a returning user isn't
  // stranded. We only await for timing, then read the cached auth state.
  await Promise.all([initializeAuth().catch(() => {}), splash.minHold]);

  if (getAuthUser()) {
    syncSavedFromApi().catch(() => {});
  }
  setAuthSignal(getAuthUser());

  navigateTo(decideDestination(), { transition: 'none' });
  await splash.dissolve();
}

function init() {
  let priorUser = getAuthUser();
  window.addEventListener('pickfit:auth-change', () => {
    const user = getAuthUser();
    setAuthSignal(user);
    if (user) {
      syncSavedFromApi().catch(() => {});
    } else if (priorUser) {
      state.clearSaved();
    }
    priorUser = user;
  });

  // Central session-expiry: a gated call returned 401 → clear cached auth and
  // route to the auth screen (the gate guard will preserve any pending target).
  window.addEventListener('pickfit:session-expired', () => {
    clearAuthUser();
    if (currentScreen !== 'auth') {
      if (GATED.has(currentScreen)) pendingScreen = currentScreen;
      navigateTo('auth');
    }
  });

  bootstrap();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
