// ========================================
// Screen 6: Outfit Detail
// ========================================

import { state } from '../utils/state.js';
import { OUTFITS, getProduct as getMockProduct } from '../data/mock.js';
import { showToast } from '../utils/animations.js';
import { persistFeedback, persistToggleSaved } from '../api/userActions.js';
import { resolveOutfit, resolveProductFromItem } from '../utils/resolvers.js';
import { escapeHtml as e } from '../utils/escape.js';

const SLOT_LABELS = {
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  outer: '아우터',
};

const FEEDBACK_OPTIONS = [
  { id: 'liked', emoji: '🙂', label: '좋았어요' },
  { id: 'too_expensive', emoji: '💸', label: '가격이 높아요' },
  { id: 'too_basic', emoji: '🧩', label: '조금 심심해요' },
  { id: 'show_more', emoji: '✨', label: '비슷한 코디 더 보기' },
  { id: 'not_my_taste', emoji: '🫥', label: '취향과 달라요' },
  { id: 'not_flattering', emoji: '🪡', label: '핏이 아쉬워요' },
];

export function renderDetail(container, { navigateTo }) {
  const outfitId = state.get('selectedOutfitId');
  const outfit = resolveOutfit(outfitId) || OUTFITS[0];
  const isSaved = state.isSaved(outfit.id);
  const recommendations = state.get('recommendations') || OUTFITS;

  const items = outfit.items.map((item) => ({
    ...item,
    product: resolveProductFromItem(item),
    alternatives: Array.isArray(item.alternatives) ? item.alternatives : [],
  }));

  container.innerHTML = `
    <div class="dt-screen">
      <header class="dt-header">
        <div class="dt-header-bar">
          <div class="dt-header-start">
            <button type="button" id="back-btn" class="dt-back-btn" aria-label="추천 결과로 돌아가기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5"/>
                <path d="m12 19-7-7 7-7"/>
              </svg>
            </button>
            <div class="dt-header-copy">
              <p class="dt-header-kicker">OUTFIT DETAIL</p>
              <h1 class="dt-header-title">${e(outfit.title)}</h1>
            </div>
          </div>

          <button
            type="button"
            class="dt-header-save ${isSaved ? 'is-saved' : ''}"
            data-save-outfit="${e(outfit.id)}"
            data-save-variant="icon"
            aria-label="${isSaved ? '저장됨' : '코디 저장'}"
            aria-pressed="${isSaved}"
          >
            ${renderSaveIcon(isSaved)}
          </button>
        </div>
      </header>

      <div class="dt-shell">
        <section class="dt-hero pf-card">
          <div class="dt-hero-badges">
            <span class="dt-lime-badge">PICKFIT 추천</span>
            <span class="dt-blue-badge">${e(outfit.framingLabel)}</span>
          </div>

          <h2 class="dt-hero-title">${e(outfit.title)}</h2>
          <p class="dt-hero-summary">${e(outfit.summary)}</p>

          <div class="dt-total-block">
            <p class="dt-total-label">Estimated Total</p>
            <div class="dt-total-row">
              <strong class="dt-total-value">${outfit.totalPrice.toLocaleString()}원</strong>
              <span class="dt-lime-badge dt-total-badge">바로 비교 가능</span>
            </div>
          </div>

          <div class="dt-hero-actions">
            <button
              type="button"
              class="dt-save-btn ${isSaved ? 'is-saved' : ''}"
              data-save-outfit="${e(outfit.id)}"
              data-save-variant="text"
              aria-pressed="${isSaved}"
            >
              ${renderSaveText(isSaved)}
            </button>
            <button type="button" id="compare-btn" class="dt-compare-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              비교하기
            </button>
          </div>
        </section>

        <section class="dt-section">
          <div class="dt-section-head">
            <div>
              <p class="dt-section-kicker">ITEM PICK</p>
              <h3 class="dt-section-title">구성 아이템</h3>
            </div>
            <span class="dt-section-note">개별 링크로 바로 확인</span>
          </div>

          <div class="dt-items">
            ${items.map((item) => renderItemCard(item)).join('')}
          </div>
        </section>

        <section class="dt-reason-block pf-card">
          <div class="dt-reason-head">
            <span class="dt-reason-marker" aria-hidden="true"></span>
            <h3 class="dt-section-title">이 코디를 추천한 이유</h3>
          </div>

          <div class="dt-reason-list">
            ${outfit.reasons.map((reason) => `
              <div class="dt-reason-item">
                <span class="dt-reason-dot is-blue" aria-hidden="true"></span>
                <span>${e(reason)}</span>
              </div>
            `).join('')}

            ${(outfit.risks || []).map((risk) => `
              <div class="dt-reason-item is-note">
                <span class="dt-reason-dot is-lime" aria-hidden="true"></span>
                <span>${e(risk.text)}</span>
              </div>
            `).join('')}
          </div>

          <div class="dt-evidence-card">
            <span class="dt-lime-badge dt-evidence-badge">리뷰 근거</span>
            <p class="dt-evidence-text">${e(outfit.reviewEvidence)}</p>
          </div>

          <div class="dt-feedback-row">
            <div class="dt-feedback-copy-wrap">
              <p class="dt-feedback-title">이 추천이 잘 맞았나요?</p>
              <p class="dt-feedback-copy">남겨준 피드백은 다음 추천에 바로 반영돼요.</p>
            </div>
            <button type="button" id="feedback-btn" class="dt-feedback-btn">피드백 남기기</button>
          </div>
        </section>
      </div>
    </div>
  `;

  container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo('results'));

  container.querySelectorAll('[data-save-outfit]').forEach((button) => {
    button.addEventListener('click', () => {
      const justSaved = state.toggleSaved(outfit.id, outfit);
      syncDetailSaveControls(container, outfit.id);
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

  container.querySelector('#compare-btn')?.addEventListener('click', () => {
    state.set('compareOutfitIds', buildCompareIds(outfit.id, recommendations));
    navigateTo('comparison');
  });

  container.querySelectorAll('.dt-purchase-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const productId = button.dataset.prod;
      const item = items.find((entry) => entry.product?.id === productId);
      const product = item?.product || getMockProduct(productId);

      if (product?.purchaseUrl && product.purchaseUrl !== '#') {
        window.open(product.purchaseUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      showToast('외부 쇼핑몰로 이동합니다.');
    });
  });

  container.querySelectorAll('.dt-alt-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const count = Number(button.dataset.count || '0');
      showToast(count > 0 ? `대안 ${count}개는 다음 단계에서 확장할 예정이에요.` : '대안 상품을 준비 중이에요.');
    });
  });

  container.querySelector('#feedback-btn')?.addEventListener('click', () => {
    showFeedbackSheet();
  });
}

function renderItemCard(item) {
  const product = item.product;
  if (!product) return '';

  return `
    <article class="dt-item-card pf-card">
      <div class="dt-item-grid">
        <div class="dt-item-media">
          <img src="${e(product.image)}" alt="${e(product.name)}" loading="lazy" />
          <span class="dt-item-slot">${e(SLOT_LABELS[item.slot] || item.slot)}</span>
        </div>

        <div class="dt-item-content">
          <p class="dt-item-brand">${e(product.brand)}</p>
          <h4 class="dt-item-name">${e(product.name)}</h4>

          <div class="dt-item-price-row">
            <strong class="dt-item-price">${product.price.toLocaleString()}원</strong>
            ${product.discountRate > 0 ? `<span class="dt-lime-badge">${product.discountRate}% 할인</span>` : ''}
          </div>

          <div class="dt-item-tags">
            <span class="dt-item-chip">${e(product.fit)}</span>
            <span class="dt-item-chip">${e(product.season)}</span>
            <span class="dt-item-chip">두께 ${e(product.thickness)}</span>
          </div>

          ${product.sizeRun ? `
            <div class="dt-item-size">
              <span class="dt-item-size-dot" aria-hidden="true"></span>
              <span>사이즈 ${e(product.sizeRun)}</span>
            </div>
          ` : ''}

          <div class="dt-item-actions">
            <button type="button" class="dt-purchase-btn" data-prod="${e(product.id)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" x2="21" y1="14" y2="3"/>
              </svg>
              구매 링크
            </button>

            ${item.alternatives.length > 0 ? `
              <button type="button" class="dt-alt-btn" data-slot="${e(item.slot)}" data-count="${item.alternatives.length}">
                대안 ${item.alternatives.length}개
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="dt-item-review">
        <span class="dt-item-review-quote">${product.reviewSummary ? `“${e(product.reviewSummary)}”` : '리뷰 데이터 부족'}</span>
        ${product.rating !== null && product.rating !== undefined ? `
          <span class="dt-item-review-divider">·</span>
          <strong>★ ${product.rating}</strong>
        ` : ''}
        ${product.reviewCount !== null && product.reviewCount !== undefined ? `
          <span>(${product.reviewCount.toLocaleString()}건)</span>
        ` : ''}
      </div>
    </article>
  `;
}

function buildCompareIds(currentId, recommendations) {
  const ids = [currentId, ...recommendations.map((item) => item.id)];
  return [...new Set(ids)].slice(0, 3);
}

function syncDetailSaveControls(root, outfitId) {
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

function showFeedbackSheet() {
  const overlay = document.createElement('div');
  overlay.className = 'pf-dim';
  overlay.style.zIndex = '70';

  const sheet = document.createElement('div');
  sheet.className = 'pf-sheet dt-feedback-sheet';
  sheet.style.zIndex = '71';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `
    <div class="pf-sheet-handle"></div>
    <p class="dt-feedback-sheet-title">이 추천은 어떠셨나요?</p>
    <p class="dt-feedback-sheet-copy">선택한 피드백을 다음 추천에 바로 반영할게요.</p>

    <div class="dt-feedback-chip-grid">
      ${FEEDBACK_OPTIONS.map((option) => `
        <button type="button" class="pf-feedback-chip" data-fb="${option.id}">
          <span class="fb-emoji">${option.emoji}</span>
          <span class="fb-label">${option.label}</span>
        </button>
      `).join('')}
    </div>

    <button type="button" id="submit-feedback" class="pf-btn-primary dt-feedback-submit">
      피드백 완료
    </button>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  let selected = [];

  sheet.querySelectorAll('.pf-feedback-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.fb;

      if (selected.includes(id)) {
        selected = selected.filter((item) => item !== id);
        chip.classList.remove('selected');
        return;
      }

      selected.push(id);
      chip.classList.add('selected');
    });
  });

  function closeSheet() {
    overlay.classList.add('exit');
    sheet.classList.add('exit');
    document.body.style.overflow = previousOverflow;

    setTimeout(() => {
      overlay.remove();
      sheet.remove();
    }, 200);
  }

  overlay.addEventListener('click', closeSheet);

  sheet.querySelector('#submit-feedback')?.addEventListener('click', () => {
    if (selected.length > 0) {
      state.addFeedback(selected);
      const feedbackType = selected.length === 1 ? selected[0] : 'general';
      const tags = selected.length === 1 ? [] : [...selected];
      const outfitId = state.get('selectedOutfitId');
      showToast('피드백을 반영해둘게요.');
      persistFeedback({ outfitId, feedbackType, tags }).then((result) => {
        if (result.status === 'unauthenticated') {
          showToast('로그인하면 피드백이 동기화돼요.');
        } else if (result.status === 'api-error') {
          showToast('피드백이 서버에 반영되지 못했어요.');
        }
      });
    }

    closeSheet();
  });
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
