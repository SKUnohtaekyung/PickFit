// ========================================
// PickFit HANGER HOOK bottom navigation
// ========================================

import { state } from '../utils/state.js';

const TAB_ITEMS = [
  {
    id: 'landing',
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

export function renderNavbar(currentScreen, onNavigate) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  const centerCta = getCenterCta(currentScreen);
  const tabState = getTabState(currentScreen, centerCta);

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
          ${centerCta.hint ? `<span class="pf-hook-main-hint">${centerCta.hint}</span>` : ''}
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
    handleMainCta(currentScreen, onNavigate);
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

  if (currentScreen === 'landing') {
    if (hasSituation) {
      return {
        label: '코디 추천 받기',
        icon: 'img/logo/image 75.png',
        iconTone: 'is-white',
        hint: '',
        variant: 'is-active',
      };
    }

    return {
      label: '코디 추천 받기',
      icon: 'img/logo/image 75.png',
      iconTone: 'is-blue',
      hint: '상황 선택 후 시작',
      variant: 'is-idle',
    };
  }

  if (currentScreen === 'saved') {
    return {
      label: '저장한 코디',
      icon: 'img/logo/image 79.png',
      iconTone: 'is-blue',
      hint: '',
      variant: 'is-secondary',
    };
  }

  return {
    label: '다시 추천',
    icon: 'img/logo/image 75.png',
    iconTone: 'is-blue',
    hint: '',
    variant: 'is-secondary',
  };
}

function getTabState(currentScreen, centerCta) {
  if (currentScreen === 'saved') {
    return { home: 'dark', saved: 'blue' };
  }

  if (currentScreen === 'landing' && centerCta.variant === 'is-idle') {
    return { home: 'blue', saved: 'dark' };
  }

  return { home: 'dark', saved: 'dark' };
}

function handleMainCta(currentScreen, onNavigate) {
  const onboarding = state.get('onboarding');
  const hasSituation = Boolean(onboarding?.situation);

  if (currentScreen === 'landing') {
    if (!hasSituation) {
      document.getElementById('situation-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const draft = {
      situation: onboarding?.situation || null,
    };

    state.resetOnboarding();
    state.update('onboarding', (next) => ({
      ...next,
      situation: draft.situation,
      freeText: '',
    }));
    onNavigate('onboarding');
    return;
  }

  state.resetOnboarding();
  onNavigate('landing');
}
