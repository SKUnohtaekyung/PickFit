// ========================================
// 추천(Recommend) Screen — situation picker
// ========================================
// Reached via the home CTA or the center nav tab. Single job: pick a situation,
// then advance into the onboarding interview via the in-flow bottom CTA.
// (Trust strip / resume / URL analyzer were moved to home or removed — this
// screen stays focused on the one decision it asks for.)

import { SITUATIONS } from '../data/enums.js';
import { state } from '../utils/state.js';

export function renderLanding(container, { navigateTo } = {}) {
  const onboarding = state.get('onboarding');
  let selected = onboarding?.situation || null;

  container.innerHTML = `
    <div class="lnd-screen">
      <div class="lnd-ambient" aria-hidden="true">
        <img src="assets/img/Ellipse%202.png" alt="" class="lnd-blob lnd-blob--lime" />
      </div>

      <header class="lnd-header">
        <div class="lnd-brand-block">
          <div class="lnd-brand-lockup">
            <img src="img/logo/logo_img.png" alt="" class="lnd-logo-mark" aria-hidden="true" />
            <img src="img/logo/logo_korea.png" alt="픽핏" class="lnd-logo-lockup" />
          </div>
          <div class="lnd-service-meta">
            <span class="lnd-service-dot" aria-hidden="true"></span>
            <span class="lnd-service-label">AI 패션 결정 에이전트</span>
          </div>
        </div>
        <div class="pf-auth-slot">
          <button type="button" class="lnd-account" id="lnd-account" aria-label="내 정보">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6"/></svg>
          </button>
        </div>
      </header>

      <section class="lnd-hero">
        <div class="lnd-copy-stack">
          <h1 class="lnd-h1">
            어떤 상황의<br>
            <em class="lnd-h1-em">옷이 필요해요?</em>
          </h1>
          <p class="lnd-hero-sub">
            상황만 고르면, 추천 이유까지 정리된 코디로 이어져요.
          </p>
        </div>
      </section>

      <section class="lnd-section lnd-section--primary" id="situation-section">
        <div class="lnd-launch-flow" aria-label="추천 진행 순서">
          <span class="lnd-launch-stage ${selected ? 'is-done' : 'is-current'}" ${selected ? '' : 'aria-current="step"'}>
            <span class="lnd-launch-stage-num">1</span>
            <span class="lnd-launch-stage-text">상황 선택</span>
          </span>
          <span class="lnd-launch-flow-sep" aria-hidden="true">·</span>
          <span class="lnd-launch-stage ${selected ? 'is-current' : ''}" ${selected ? 'aria-current="step"' : ''}>
            <span class="lnd-launch-stage-num">2</span>
            <span class="lnd-launch-stage-text">취향 입력</span>
          </span>
          <span class="lnd-launch-flow-sep" aria-hidden="true">·</span>
          <span class="lnd-launch-stage">
            <span class="lnd-launch-stage-num">3</span>
            <span class="lnd-launch-stage-text">추천 결과</span>
          </span>
        </div>

        <div class="lnd-situation-grid" id="situation-grid">
          ${SITUATIONS.map((situation) => {
            const isSelected = selected === situation.id;
            return `
              <button
                type="button"
                class="lnd-choice ${isSelected ? 'on' : ''}"
                data-situation="${situation.id}"
                aria-pressed="${isSelected}"
              >
                <span class="lnd-choice-icon" aria-hidden="true">${situation.emoji}</span>
                <span class="lnd-choice-label">${situation.label}</span>
              </button>
            `;
          }).join('')}
        </div>

        <p
          class="lnd-inline-status ${selected ? 'is-visible' : ''}"
          id="selection-status"
          aria-live="polite"
          ${selected ? '' : 'hidden'}
        >
          ${selected ? selectionCopy(selected) : ''}
        </p>

        <button
          type="button"
          class="pf-btn-primary lnd-start-btn"
          id="lnd-start"
          ${selected ? '' : 'disabled aria-disabled="true"'}
        >
          <span class="lnd-start-label">${selected ? '코디 추천 받기' : '상황을 먼저 선택해 주세요'}</span>
          <svg class="lnd-start-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </button>
      </section>

      <div class="lnd-bottom-space" aria-hidden="true"></div>
    </div>
  `;

  container.querySelector('#lnd-account')?.addEventListener('click', () => navigateTo?.('account'));

  const selectionStatus = container.querySelector('#selection-status');
  const startBtn = container.querySelector('#lnd-start');
  const startLabel = startBtn?.querySelector('.lnd-start-label');
  const launchStages = [...container.querySelectorAll('.lnd-launch-stage')];
  const choiceButtons = [...container.querySelectorAll('.lnd-choice')];

  const syncOnboardingDraft = () => {
    state.update('onboarding', (draft) => ({
      ...draft,
      situation: selected,
      freeText: '',
    }));
  };

  const refreshSelectionStatus = () => {
    selectionStatus.hidden = !selected;
    selectionStatus.classList.toggle('is-visible', Boolean(selected));
    selectionStatus.innerHTML = selected ? selectionCopy(selected) : '';
  };

  const refreshStartBtn = () => {
    if (!startBtn) return;
    startBtn.disabled = !selected;
    if (selected) startBtn.removeAttribute('aria-disabled');
    else startBtn.setAttribute('aria-disabled', 'true');
    if (startLabel) startLabel.textContent = selected ? '코디 추천 받기' : '상황을 먼저 선택해 주세요';
  };

  const refreshLaunchFlow = () => {
    launchStages[0]?.classList.toggle('is-current', !selected);
    launchStages[0]?.classList.toggle('is-done', Boolean(selected));
    launchStages[1]?.classList.toggle('is-current', Boolean(selected));
    setAriaCurrent(launchStages[0], !selected);
    setAriaCurrent(launchStages[1], Boolean(selected));
  };

  const refreshChoices = () => {
    choiceButtons.forEach((button) => {
      const isSelected = selected === button.dataset.situation;
      button.classList.toggle('on', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  };

  // Forward affordance in document flow. Fresh run, situation kept.
  const startRecommendation = () => {
    if (!selected) return;
    state.resetOnboarding();
    state.update('onboarding', (next) => ({ ...next, situation: selected, freeText: '' }));
    navigateTo?.('onboarding');
  };

  startBtn?.addEventListener('click', startRecommendation);

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextSituation = button.dataset.situation;
      selected = selected === nextSituation ? null : nextSituation;
      refreshChoices();
      refreshLaunchFlow();
      refreshSelectionStatus();
      refreshStartBtn();
      syncOnboardingDraft();
    });
  });
}

// Confirmation copy points at the in-flow primary CTA right below the grid.
function selectionCopy(situationId) {
  const label = getSituationLabel(situationId);
  return `‘${escapeText(label)}’ 선택됨 · 아래 <strong>‘코디 추천 받기’</strong>로 바로 시작해요`;
}

function setAriaCurrent(el, on) {
  if (!el) return;
  if (on) el.setAttribute('aria-current', 'step');
  else el.removeAttribute('aria-current');
}

function getSituationLabel(id) {
  return SITUATIONS.find((item) => item.id === id)?.label || '선택한 상황';
}

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
