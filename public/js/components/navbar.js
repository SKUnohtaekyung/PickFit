// ========================================
// PickFit HANGER HOOK bottom navigation — 3 fixed tabs
// ========================================
// Three independent destinations: 홈(home) · 추천(landing) · 저장(saved).
// The center hook is ALWAYS "추천" (no more morphing into "저장한 코디"/"다시
// 추천"). Tapping it goes to the 추천 screen; the actual recommendation flow is
// started from that screen's in-flow CTA, not from the nav. The center keeps a
// color cue when a situation is selected on the 추천 screen.

import { state } from '../utils/state.js';

const TAB_ITEMS = [
  {
    id: 'home',
    label: '홈',
    icon: 'img/logo/image 77.png',
    activeIcon: 'img/logo/image 78.png',
  },
  {
    id: 'saved',
    label: '저장',
    icon: 'img/logo/image 76.png',
    activeIcon: 'img/logo/image 79.png',
  },
];

// Screens that belong to the 추천 journey (center tab is the active section).
const RECOMMEND_SECTION = ['landing', 'onboarding', 'loading', 'results', 'comparison', 'detail'];

export function renderNavbar(currentScreen, onNavigate) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const centerCta = getCenterCta(currentScreen);
  const tabState = getTabState(currentScreen);

  nav.innerHTML = `
    <div class="pf-hook-nav">
      <div class="pf-hook-handle" aria-hidden="true"></div>

      <div class="pf-hook-shell">
        <span class="pf-hook-shell-shape" aria-hidden="true">
          ${renderShellShape()}
        </span>

        <div class="pf-hook-shell-content">
          ${renderTabButton(TAB_ITEMS[0], tabState.home, 'left')}
          ${renderTabButton(TAB_ITEMS[1], tabState.saved, 'right')}
        </div>

        <button
          type="button"
          class="pf-hook-main ${centerCta.variant}"
          id="nav-main-cta"
          aria-label="${centerCta.label}"
        >
          <span class="pf-hook-main-shape" aria-hidden="true">
            ${renderCenterHookShape()}
          </span>
          <span class="pf-hook-main-icon ${centerCta.iconTone}">
            <img src="${centerCta.icon}" alt="" />
          </span>
          <span class="pf-hook-main-label">${centerCta.label}</span>
        </button>
      </div>
    </div>
  `;

  nav.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      onNavigate(button.dataset.nav);
    });
  });

  nav.querySelector('#nav-main-cta')?.addEventListener('click', () => {
    onNavigate('landing');
  });
}

function renderTabButton(item, tone, side) {
  const isBlue = tone === 'blue';
  const iconSrc = item.activeIcon;

  return `
    <button
      type="button"
      class="pf-hook-tab pf-hook-tab--${side} ${isBlue ? 'is-blue' : 'is-dark'}"
      data-nav="${item.id}"
      aria-label="${item.label}"
    >
      <span class="pf-hook-tab-icon ${isBlue ? 'is-blue' : 'is-dark'}">
        <img src="${iconSrc}" alt="" />
      </span>
      <span class="pf-hook-tab-label">${item.label}</span>
    </button>
  `;
}

function renderShellShape() {
  return `
    <svg viewBox="0 0 360 88" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <path
        d="M26 88C11.64 88 0 76.36 0 62V38C0 23.64 11.64 12 26 12H136C145 12 149 0 180 0C211 0 215 12 224 12H334C348.36 12 360 23.64 360 38V62C360 76.36 348.36 88 334 88H26Z"
      ></path>
    </svg>
  `;
}

function renderCenterHookShape() {
  return `
    <svg viewBox="0 0 96 78" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <path
        d="M14 78C6.268 78 0 71.732 0 64V28C0 20.268 6.268 14 14 14H26C30.6 14 32.8 0 48 0C63.2 0 65.4 14 70 14H82C89.732 14 96 20.268 96 28V64C96 71.732 89.732 78 82 78H14Z"
      ></path>
    </svg>
  `;
}

function getCenterCta(currentScreen) {
  const onboarding = state.get('onboarding');
  const hasSituation = Boolean(onboarding?.situation);
  const base = { label: '추천', icon: 'img/logo/image 75.png' };

  if (currentScreen === 'landing') {
    // Preserve the situation-selected color cue: idle → active fill.
    return hasSituation
      ? { ...base, iconTone: 'is-white', variant: 'is-active' }
      : { ...base, iconTone: 'is-blue', variant: 'is-idle' };
  }

  if (RECOMMEND_SECTION.includes(currentScreen)) {
    // results / comparison / detail — 추천 is the active section.
    return { ...base, iconTone: 'is-white', variant: 'is-active' };
  }

  // home / saved — 추천 is a reachable tab, not the current section.
  return { ...base, iconTone: 'is-blue', variant: 'is-secondary' };
}

function getTabState(currentScreen) {
  return {
    home: currentScreen === 'home' ? 'blue' : 'dark',
    saved: currentScreen === 'saved' ? 'blue' : 'dark',
  };
}
