// ========================================
// Landing Screen - PickFit launcher home
// ========================================

import { SITUATIONS } from '../data/mock.js';
import { state } from '../utils/state.js';
import { mountAuthSlot } from '../components/authModal.js';

let unmountAuthSlot = null;

export function renderLanding(container) {
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
        <div class="pf-auth-slot" data-auth-slot aria-live="polite"></div>
      </header>

      <section class="lnd-hero">
        <div class="lnd-copy-stack">
          <h1 class="lnd-h1">
            어떤 상황의<br>
            <em class="lnd-h1-em">옷이 필요해요?</em>
          </h1>
          <p class="lnd-hero-sub">
            상황을 먼저 고르면, 이유까지 정리된 코디 추천으로 바로 이어져요.
          </p>
        </div>

        <div class="lnd-promise-card">
          <div class="lnd-promise-top">
            <span class="lnd-promise-badge">FAST PICK</span>
            <span class="lnd-promise-kicker">3분 안에 이유와 함께</span>
          </div>
          <p class="lnd-promise-sub">
            상황 · 체형 · 예산만 정하면 바로 살 수 있는 완성 코디로 정리해드려요.
          </p>
          <div class="lnd-promise-points" aria-label="추천 입력 기준">
            <span class="lnd-promise-pill">상황</span>
            <span class="lnd-promise-pill">체형</span>
            <span class="lnd-promise-pill">예산</span>
          </div>
        </div>
      </section>

      <section class="lnd-section lnd-section--primary" id="situation-section">
        <div class="lnd-section-head">
          <div>
            <p class="lnd-section-step">STEP 1</p>
            <h2 class="lnd-section-title">상황을 먼저 골라주세요</h2>
          </div>
          <span class="lnd-section-status">필수</span>
        </div>

        <p class="lnd-section-caption">
          가장 가까운 상황 하나를 먼저 골라보세요.
        </p>

        <div class="lnd-situation-stage">
          <div class="lnd-situation-ambient" aria-hidden="true">
            <img src="assets/img/Ellipse%204.png" alt="" class="lnd-blob lnd-blob--blue-a" />
            <img src="assets/img/Ellipse%205.png" alt="" class="lnd-blob lnd-blob--blue-b" />
          </div>

          <div class="lnd-launch-flow" aria-label="추천 시작 순서">
            <span class="lnd-launch-stage ${selected ? 'is-done' : 'is-current'}">
              <span class="lnd-launch-stage-num">1</span>
              <span class="lnd-launch-stage-text">상황 선택</span>
            </span>
            <span class="lnd-launch-flow-sep" aria-hidden="true">·</span>
            <span class="lnd-launch-stage ${selected ? 'is-current' : ''}">
              <span class="lnd-launch-stage-num">2</span>
              <span class="lnd-launch-stage-text">추천 시작</span>
            </span>
            <span class="lnd-launch-flow-sep" aria-hidden="true">·</span>
            <span class="lnd-launch-stage">
              <span class="lnd-launch-stage-num">3</span>
              <span class="lnd-launch-stage-text">결과 확인</span>
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
            ${selected ? `${getSituationLabel(selected)} 선택 완료 · 하단 코디 추천 받기 버튼이 활성화됐어요` : ''}
          </p>
        </div>
      </section>

      <div class="lnd-bottom-space" aria-hidden="true"></div>
    </div>
  `;

  unmountAuthSlot?.();
  unmountAuthSlot = mountAuthSlot(container.querySelector('[data-auth-slot]'));

  const selectionStatus = container.querySelector('#selection-status');
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
    selectionStatus.textContent = selected
      ? `${getSituationLabel(selected)} 선택 완료 · 하단 코디 추천 받기 버튼이 활성화됐어요`
      : '';
  };

  const refreshLaunchFlow = () => {
    launchStages[0]?.classList.toggle('is-current', !selected);
    launchStages[0]?.classList.toggle('is-done', Boolean(selected));
    launchStages[1]?.classList.toggle('is-current', Boolean(selected));
  };

  const refreshChoices = () => {
    choiceButtons.forEach((button) => {
      const isSelected = selected === button.dataset.situation;
      button.classList.toggle('on', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  };

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextSituation = button.dataset.situation;
      selected = selected === nextSituation ? null : nextSituation;
      refreshChoices();
      refreshLaunchFlow();
      refreshSelectionStatus();
      syncOnboardingDraft();
    });
  });
}

function getSituationLabel(id) {
  return SITUATIONS.find((item) => item.id === id)?.label || '선택한 상황';
}
