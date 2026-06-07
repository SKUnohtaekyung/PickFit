// ========================================
// PickFit SPA Router & App Entry
// ========================================

import { state } from './utils/state.js';
import { showToast } from './utils/animations.js';
import { renderNavbar } from './components/navbar.js';
import { initializeAuth, getAuthUser, clearAuthUser } from './components/authModal.js';
import { createSplash } from './components/splash.js';
import { initConnectivity } from './components/connectivity.js';
import { renderWelcome } from './screens/welcome.js';
import { renderAuth } from './screens/auth.js';
import { renderAccount } from './screens/account.js';
import { renderProfile } from './screens/profile.js';
import { renderSettings } from './screens/settings.js';
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
  profile: renderProfile,
  settings: renderSettings,
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
const HIDE_NAV = ['welcome', 'auth', 'account', 'profile', 'settings', 'onboarding', 'loading'];

// Auth-first model: the whole app behind welcome/auth requires a logged-in
// user, so there is never a mid-flow login wall (the user pinned this). Only
// welcome + auth are public; everything else routes to auth when signed out.
const GATED = new Set(['home', 'landing', 'onboarding', 'loading', 'results', 'comparison', 'detail', 'saved', 'account', 'profile', 'settings']);

const EXIT_CLASS = { fade: 'screen-exit', 'push-forward': 'screen-exit-left', 'push-back': 'screen-exit-right' };
const ENTER_CLASS = { fade: 'screen-enter', 'push-forward': 'screen-enter-right', 'push-back': 'screen-enter-left' };

let currentScreen = null;
let transitioning = false;
let pendingScreen = null;

function reducedMotion() {
  // 설정 화면의 "모션 줄이기"를 켜면 시스템 설정과 무관하게 전환 애니메이션을 끈다.
  try {
    if (localStorage.getItem('pf_reduce_motion') === '1') return true;
  } catch (_) { /* ignore */ }
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
      // 화면 렌더 실패(동기 throw 또는 async reject)를 잡아 빈/깨진 컨테이너 대신
      // 복구 가능한 폴백을 보여준다. 일부 화면(results 등)은 async 함수라 반환
      // 프라미스의 reject도 함께 처리한다.
      try {
        const maybePromise = renderFn(container, { navigateTo, ...params, ...extra });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch((err) => {
            console.error('[PickFit] screen render rejected:', screen, err);
            if (currentScreen === screen) renderErrorFallback(container, screen);
          });
        }
      } catch (err) {
        console.error('[PickFit] screen render failed:', screen, err);
        renderErrorFallback(container, screen);
      }
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

// 화면 렌더가 실패했을 때 보여주는 복구용 폴백. 같은 화면 재시도 또는 홈 이동.
function renderErrorFallback(container, screen) {
  container.innerHTML = `
    <div class="pf-error-screen" role="alert">
      <div class="pf-error-card pf-card">
        <div class="pf-error-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h1 class="pf-error-title">화면을 불러오지 못했어요</h1>
        <p class="pf-error-desc">잠시 후 다시 시도하거나 홈으로 이동해 주세요.</p>
        <div class="pf-error-actions">
          <button type="button" id="pf-error-retry" class="pf-btn-primary">다시 시도</button>
          <button type="button" id="pf-error-home" class="pf-btn-secondary">홈으로</button>
        </div>
      </div>
    </div>
  `;
  container.querySelector('#pf-error-retry')?.addEventListener('click', () => navigateTo(screen, { transition: 'none' }));
  container.querySelector('#pf-error-home')?.addEventListener('click', () => navigateTo('home', { transition: 'none' }));
}

// 전역 에러 처리: 화면을 망가뜨리지 않도록 비파괴적으로 토스트만 띄운다(스팸 방지 스로틀).
let lastErrorToastAt = 0;
function reportGlobalError(label, detail) {
  console.error(`[PickFit] ${label}:`, detail);
  const now = Date.now();
  if (now - lastErrorToastAt > 4000) {
    lastErrorToastAt = now;
    showToast('일시적인 문제가 발생했어요. 다시 시도해 주세요.');
  }
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
  // 전역 에러 바운더리(비파괴적). 이미지/스크립트 등 리소스 로드 실패는 무시하고
  // JS 런타임 에러/처리되지 않은 프라미스 거절만 사용자에게 알린다.
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window && event.target.tagName) return;
    reportGlobalError('uncaught error', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportGlobalError('unhandled rejection', event.reason);
  });

  // 오프라인 배너 + 복구 시 저장 목록 재동기화.
  initConnectivity({
    onReconnect: () => {
      if (getAuthUser()) syncSavedFromApi().catch(() => {});
    },
  });

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
