// ========================================
// Screen 4: Recommendation Results
// ========================================

import { state } from '../utils/state.js';
import { staggerChildren } from '../utils/animations.js';
import { resolveProductFromItem } from '../utils/resolvers.js';
import { escapeHtml as e } from '../utils/escape.js';
import { renderSaveIcon, renderSaveText, toggleSaveFromClick } from '../components/saveControls.js';
import { getRecommendationRun } from '../api/recommendations.js';
import { adaptRecommendationResponse } from '../api/recommendationAdapter.js';
import { getSourceProductIds, countSourceMatches } from '../utils/sourceProducts.js';

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

// 1인당(아이템당) 예산 상한 — 백엔드 BUDGET_CAPS 와 동일. 카드의 '예산 적합' 배지가
// 실제 가격을 반영하도록 쓰인다(무조건 표시 → 실제 충족 시에만 표시).
const BUDGET_CAP_VALUES = {
  under50k: 50000,
  '50k-100k': 100000,
  '100k-200k': 200000,
  over200k: 600000,
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
      // 조건이 바뀐 뒤의 콜드 로드 방지: 불러온 run의 조건이 현재 온보딩과 다르면
      // 옛 run을 보여주지 말고 온보딩으로 보낸다(조건 바꿔도 옛 결과가 뜨는 현상 차단).
      if (!conditionsRoughlyMatch(adapted.conditions, state.get('onboarding') || {})) {
        navigateTo('onboarding');
        return;
      }
      if (Array.isArray(adapted.outfits) && adapted.outfits.length >= 3) {
        state.setRecommendations(adapted.outfits, 'api-rehydrated');
        recommendations = adapted.outfits;
      } else {
        // Run loaded but is incomplete — let the user start fresh.
        renderRehydrateError(container, navigateTo, {
          message: '이전 추천을 온전히 불러오지 못했어요.',
          allowRetry: false,
        });
        return;
      }
    } catch (_) {
      // Transient fetch failure — keep lastRunId and offer a retry before
      // discarding a still-valid run (e.g. a reload on a slow connection).
      renderRehydrateError(container, navigateTo, {
        message: '이전 추천을 불러오지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.',
        allowRetry: true,
      });
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
  const budgetCap = BUDGET_CAP_VALUES[onboarding.budget] ?? null; // 1인당 상한(없으면 null)
  const compareCount = Math.min(recommendations.length, 3);
  // Trust UX: only count what actually appears in the response. Backend grants
  // +5 score per sourceProductId but never guarantees inclusion. Computed here
  // (after the rehydrate path reassigns `recommendations`) so refresh works too.
  const sourceMatches = countSourceMatches(recommendations, getSourceProductIds());

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
          ${renderSourceMatchBadge(sourceMatches)}
        </div>
      </section>

      <section class="rs-list" id="outfit-list">
        ${recommendations.map((outfit, index) => renderOutfitCard(outfit, index, budgetCap)).join('')}
      </section>
    </div>
  `;

  staggerChildren(container, '.rs-card', 80);

  container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo('home'));
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
      // 낙관적 토글·UI 동기화·서버 반영·실패 롤백 + 진행 중 재클릭 가드를 한 번에 처리.
      toggleSaveFromClick(container, outfit);
    });
  });
}

function renderOutfitCard(outfit, index, budgetCap = null) {
  const items = outfit.items.map((item) => ({
    ...item,
    product: resolveProductFromItem(item),
  }));
  const isSaved = state.isSaved(outfit.id);
  const highlights = outfit.reasons.slice(0, 2);
  // '예산 적합' 배지는 실제로 모든 아이템이 1인당 상한 이하일 때만 표시한다.
  // (예산 미선택이거나 완화로 초과 상품이 섞이면 거짓 표기 대신 배지를 숨긴다.)
  const withinBudget = budgetCap != null
    && items.every((item) => (item.product?.price ?? 0) <= budgetCap);

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
            ${withinBudget ? '<span class="rs-total-badge">예산 적합</span>' : ''}
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

function renderSourceMatchBadge({ selected, alternatives }) {
  if (selected === 0 && alternatives === 0) return '';
  const chips = [];
  if (selected > 0) {
    chips.push(`<span class="rs-source-chip"><span class="rs-source-chip-dot" aria-hidden="true"></span>방금 분석한 ${selected}개 반영됨</span>`);
  }
  if (alternatives > 0) {
    chips.push(`<span class="rs-source-chip rs-source-chip--alt">+ 후보 ${alternatives}개</span>`);
  }
  return `<div class="rs-source-tags" role="status">${chips.join('')}</div>`;
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

// Recovery state for a failed rehydrate (§15.10). Keeps the run id so "다시
// 불러오기" can re-fetch; "새로 시작" clears it and returns to onboarding.
function renderRehydrateError(container, navigateTo, { message, allowRetry }) {
  container.innerHTML = `
    <div class="rs-screen">
      <header class="rs-header">
        <div class="rs-header-bar">
          <div class="rs-header-start">
            <div class="rs-header-copy">
              <p class="rs-header-kicker">PICKFIT</p>
              <h1 class="rs-header-title">추천을 불러오지 못했어요</h1>
            </div>
          </div>
        </div>
      </header>
      <section class="rs-summary">
        <div class="rs-summary-card pf-card rs-rehydrate-error">
          <div class="pf-badge-warning rs-rehydrate-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${e(message)}</span>
          </div>
          <div class="rs-rehydrate-actions">
            ${allowRetry ? `<button type="button" id="rs-retry" class="pf-btn-primary">다시 불러오기</button>` : ''}
            <button type="button" id="rs-restart" class="pf-btn-secondary rs-rehydrate-restart">새로 시작</button>
          </div>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#rs-retry')?.addEventListener('click', () => {
    renderResults(container, { navigateTo });
  });
  container.querySelector('#rs-restart')?.addEventListener('click', () => {
    state.set('lastRunId', null);
    navigateTo('onboarding');
  });
}

// 불러온 run의 조건이 현재 온보딩 선택과 (대략) 같은지 비교한다. runConditions 가
// 없으면(구버전 run) 판단 불가로 보고 통과시켜 불필요한 이탈을 막는다. 주요 식별
// 필드(상황·예산·핏 + 다중선택 배열)만 비교하고 freeText 는 제외한다.
function conditionsRoughlyMatch(runConditions, onboarding) {
  if (!runConditions || typeof runConditions !== 'object') return true;
  const norm = (v) => (v === undefined || v === null || v === '' ? null : v);
  const arr = (v) => (Array.isArray(v) ? [...v].filter(Boolean).sort() : []);
  const sameArr = (a, b) => {
    const x = arr(a);
    const y = arr(b);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  };
  return norm(runConditions.situation) === norm(onboarding.situation)
    && norm(runConditions.budget) === norm(onboarding.budget)
    && norm(runConditions.fit) === norm(onboarding.fit)
    && sameArr(runConditions.mood, onboarding.mood)
    && sameArr(runConditions.bodyType, onboarding.bodyType)
    && sameArr(runConditions.colors, onboarding.colors)
    && sameArr(runConditions.avoidances, onboarding.avoidances);
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
