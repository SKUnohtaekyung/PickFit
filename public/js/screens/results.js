// ========================================
// Screen 4: Recommendation Results
// ========================================

import { state } from '../utils/state.js';
import { showToast, staggerChildren } from '../utils/animations.js';
import { persistToggleSaved } from '../api/userActions.js';
import { resolveProductFromItem } from '../utils/resolvers.js';
import { escapeHtml as e } from '../utils/escape.js';
import { getRecommendationRun } from '../api/recommendations.js';
import { adaptRecommendationResponse } from '../api/recommendationAdapter.js';

const SLOT_LABELS = {
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  outer: '아우터',
};

const SITUATION_LABELS = {
  office: '출근룩',
  date: '소개팅',
  daily: '데일리',
  travel: '여행',
  wedding: '하객룩',
  rainy: '장마철',
  interview: '면접',
  casual: '캐주얼',
};

const BUDGET_LABELS = {
  under50k: '~5만 원',
  '50k-100k': '5~10만 원',
  '100k-200k': '10~20만 원',
  over200k: '20만 원+',
};

const FIT_LABELS = {
  slim: '슬림',
  regular: '레귤러',
  oversized: '오버사이즈',
  relaxed: '릴랙스드',
  straight: '스트레이트',
};

const MOOD_LABELS = {
  minimal: '미니멀',
  casual: '캐주얼',
  street: '스트릿',
  classic: '클래식',
  feminine: '페미닌',
  clean: '클린',
  soft: '소프트',
  chic: '시크',
};

export async function renderResults(container, { navigateTo }) {
  let recommendations = state.get('recommendations') || [];
  const lastRunId = state.get('lastRunId');

  // §20.0 P1: page reload lands here with an empty `state.recommendations` but
  // a persisted `lastRunId` — re-fetch the run before rendering anything.
  // Without this, refresh silently dropped users to the empty/mock state.
  if ((!Array.isArray(recommendations) || recommendations.length === 0) && lastRunId) {
    container.innerHTML = renderRehydratePlaceholder();
    try {
      const apiData = await getRecommendationRun(lastRunId);
      const adapted = adaptRecommendationResponse(apiData);
      if (Array.isArray(adapted.outfits) && adapted.outfits.length >= 3) {
        state.setRecommendations(adapted.outfits, 'api-rehydrated');
        recommendations = adapted.outfits;
      } else {
        showToast('이전 추천을 불러오지 못했어요. 새로 시작해 주세요.');
        state.set('lastRunId', null);
        navigateTo('onboarding');
        return;
      }
    } catch (_) {
      showToast('이전 추천을 불러오지 못했어요. 새로 시작해 주세요.');
      state.set('lastRunId', null);
      navigateTo('onboarding');
      return;
    }
  }

  // No recs and nothing to rehydrate from — push the user to onboarding rather
  // than rendering an empty results screen.
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    navigateTo('onboarding');
    return;
  }

  const onboarding = state.get('onboarding') || {};
  const conditionTags = buildConditionTags(onboarding);
  const compareCount = Math.min(recommendations.length, 3);

  container.innerHTML = `
    <div class="rs-screen">
      <header class="rs-header">
        <div class="rs-header-bar">
          <div class="rs-header-start">
            <button type="button" id="back-btn" class="rs-back-btn" aria-label="홈으로 돌아가기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5"/>
                <path d="m12 19-7-7 7-7"/>
              </svg>
            </button>
            <div class="rs-header-copy">
              <p class="rs-header-kicker">PICKFIT RESULT</p>
              <h1 class="rs-header-title">추천 결과 ${recommendations.length}개</h1>
            </div>
          </div>
          <button type="button" id="edit-btn" class="rs-edit-btn">조건 수정</button>
        </div>
      </header>

      <section class="rs-summary">
        <div class="rs-summary-card pf-card">
          <div class="rs-summary-top">
            <div class="rs-summary-copy-group">
              <span class="rs-summary-badge">반영된 조건</span>
              <p class="rs-summary-copy">지금 조건으로 바로 비교하거나 저장해둘 수 있어요.</p>
            </div>
            <button type="button" id="compare-all-btn" class="rs-compare-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              ${compareCount}개 비교
            </button>
          </div>

          ${conditionTags.length ? `
            <div class="rs-condition-tags">
              ${conditionTags.map((tag) => `<span class="rs-condition-chip">${e(tag)}</span>`).join('')}
            </div>
          ` : `
            <div class="rs-condition-empty">조건이 더 쌓이면 여기서 한눈에 정리해드릴게요.</div>
          `}
        </div>
      </section>

      <section class="rs-list" id="outfit-list">
        ${recommendations.map((outfit, index) => renderOutfitCard(outfit, index)).join('')}
      </section>
    </div>
  `;

  staggerChildren(container, '.rs-card', 80);

  container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo('landing'));
  container.querySelector('#edit-btn')?.addEventListener('click', () => navigateTo('onboarding'));

  container.querySelector('#compare-all-btn')?.addEventListener('click', () => {
    const compareIds = recommendations.map((outfit) => outfit.id).slice(0, 3);
    state.set('compareOutfitIds', compareIds);
    navigateTo('comparison');
  });

  container.querySelectorAll('.rs-detail-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.set('selectedOutfitId', button.dataset.outfit);
      navigateTo('detail');
    });
  });

  container.querySelectorAll('[data-save-outfit]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const outfitId = button.dataset.saveOutfit;
      const outfit = recommendations.find((o) => o.id === outfitId);
      const justSaved = state.toggleSaved(outfitId, outfit);
      syncResultSaveControls(container, outfitId);
      showToast(justSaved ? '코디를 저장했어요.' : '저장을 해제했어요.');
      persistToggleSaved(outfit, justSaved).then((result) => {
        if (result.status === 'unauthenticated') {
          showToast('로그인하면 저장이 동기화돼요.');
        } else if (result.status === 'api-error') {
          showToast('저장이 서버에 반영되지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
    });
  });
}

function renderOutfitCard(outfit, index) {
  const items = outfit.items.map((item) => ({
    ...item,
    product: resolveProductFromItem(item),
  }));
  const isSaved = state.isSaved(outfit.id);
  const highlights = outfit.reasons.slice(0, 2);

  return `
    <article class="rs-card pf-card">
      <div class="rs-card-top">
        <div class="rs-card-head">
          <div class="rs-card-badges">
            <span class="rs-rank-badge">PICK ${index + 1}</span>
            <span class="rs-frame-badge">${e(outfit.framingLabel)}</span>
          </div>
          <h2 class="rs-card-title">${e(outfit.title)}</h2>
          <p class="rs-card-summary">${e(outfit.summary)}</p>
        </div>

        <button
          type="button"
          class="rs-save-icon ${isSaved ? 'is-saved' : ''}"
          data-save-outfit="${e(outfit.id)}"
          data-save-variant="icon"
          aria-label="${isSaved ? '저장됨' : '코디 저장'}"
          aria-pressed="${isSaved}"
        >
          ${renderSaveIcon(isSaved)}
        </button>
      </div>

      <div class="rs-image-grid">
        ${items.map((item) => `
          <div class="rs-item-thumb">
            <img src="${e(item.product?.image || '')}" alt="${e(item.product?.name || '')}" loading="lazy" />
            <span class="rs-item-slot">${e(SLOT_LABELS[item.slot] || item.slot)}</span>
          </div>
        `).join('')}
      </div>

      <div class="rs-feature-list">
        ${highlights.map((reason, reasonIndex) => `
          <div class="rs-feature">
            <span class="rs-feature-dot ${reasonIndex === 0 ? 'is-blue' : 'is-lime'}" aria-hidden="true"></span>
            <span class="rs-feature-text">${e(reason)}</span>
          </div>
        `).join('')}
      </div>

      <div class="rs-card-bottom">
        <div class="rs-total-wrap">
          <p class="rs-total-label">Estimated Total</p>
          <div class="rs-total-row">
            <p class="rs-total-value">${outfit.totalPrice.toLocaleString()}원</p>
            <span class="rs-total-badge">예산 적합</span>
          </div>
        </div>

        <div class="rs-card-actions">
          <button type="button" class="rs-detail-btn" data-outfit="${e(outfit.id)}">
            자세히 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </button>

          <button
            type="button"
            class="rs-save-text ${isSaved ? 'is-saved' : ''}"
            data-save-outfit="${e(outfit.id)}"
            data-save-variant="text"
            aria-pressed="${isSaved}"
          >
            ${renderSaveText(isSaved)}
          </button>
        </div>
      </div>
    </article>
  `;
}

function syncResultSaveControls(root, outfitId) {
  const isSaved = state.isSaved(outfitId);

  root.querySelectorAll(`[data-save-outfit="${outfitId}"]`).forEach((button) => {
    const variant = button.dataset.saveVariant;
    button.classList.toggle('is-saved', isSaved);
    button.setAttribute('aria-label', isSaved ? '저장됨' : '코디 저장');
    button.setAttribute('aria-pressed', String(isSaved));

    if (variant === 'icon') {
      button.innerHTML = renderSaveIcon(isSaved);
      return;
    }

    button.innerHTML = renderSaveText(isSaved);
  });
}

function renderSaveIcon(isSaved) {
  return isSaved ? savedHeartIcon() : heartIcon();
}

function renderSaveText(isSaved) {
  return `
    ${isSaved ? savedHeartIcon() : heartIcon()}
    <span>${isSaved ? '저장됨' : '코디 저장'}</span>
  `;
}

function heartIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;
}

function savedHeartIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;
}

function renderRehydratePlaceholder() {
  return `
    <div class="rs-screen">
      <header class="rs-header">
        <div class="rs-header-bar">
          <div class="rs-header-start">
            <div class="rs-header-copy">
              <p class="rs-header-kicker">PICKFIT</p>
              <h1 class="rs-header-title">이전 추천 불러오는 중…</h1>
            </div>
          </div>
        </div>
      </header>
      <section class="rs-summary">
        <div class="rs-summary-card pf-card">
          <p class="rs-summary-copy">서버에 저장된 추천 결과를 다시 가져오는 중이에요.</p>
        </div>
      </section>
    </div>
  `;
}

function buildConditionTags(onboarding) {
  const tags = [];

  if (onboarding.situation && SITUATION_LABELS[onboarding.situation]) {
    tags.push(SITUATION_LABELS[onboarding.situation]);
  }

  if (onboarding.budget && BUDGET_LABELS[onboarding.budget]) {
    tags.push(BUDGET_LABELS[onboarding.budget]);
  }

  if (onboarding.fit && FIT_LABELS[onboarding.fit]) {
    tags.push(FIT_LABELS[onboarding.fit]);
  }

  onboarding.mood?.slice(0, 2).forEach((mood) => {
    if (MOOD_LABELS[mood]) {
      tags.push(MOOD_LABELS[mood]);
    }
  });

  return tags;
}
