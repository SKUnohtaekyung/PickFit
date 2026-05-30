// ========================================
// Screen 5: Comparison (vertical scannable redesign)
// ========================================
// Layout: a 3-outfit header (thumbnail · name · price · 최저가 badge) anchors the
// comparison, then decision rows (핏 리스크 · 핏 · 소재 · 계절감 · 리뷰 · 구매).
// Fixes the previous cramped 3-col table: Korean fit/season labels, min-width:0
// cells so long values wrap instead of overlapping, and inline (non-fixed)
// actions so nothing collides with the floating nav.
// "Best" logic, missing-value tolerance, routing, and compareOutfitIds state
// are unchanged.

import { state } from '../utils/state.js';
import { staggerChildren } from '../utils/animations.js';
import { resolveOutfit, resolveProductFromItem } from '../utils/resolvers.js';
import { escapeHtml as e } from '../utils/escape.js';
import { fitLabel, seasonLabel } from '../utils/labels.js';

// Decision rows below the outfit header (price lives in the header now).
const CORE_ROWS = [
  { key: 'fitRisk',  label: '핏 리스크' },
  { key: 'fit',      label: '핏',      kind: 'fit' },
  { key: 'material', label: '소재' },
  { key: 'season',   label: '계절감',  kind: 'season' },
];

const FALLBACK_THUMBS = ['👔', '🧥', '👕'];

// Treats null/undefined/'-'/'정보 부족' as "no data available" — these must
// never win a "Best" badge. Backend may send '정보부족' (no space) for fitRisk.
function isMissingComparisonValue(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === '' || s === '-' || s === '—' || s === '정보 부족' || s === '정보부족';
}

// Best-for determination. Returns -1 when fewer than 2 outfits carry meaningful
// data, so a lone outfit (or all-missing column) cannot be falsely awarded.
function getBestIdx(outfits, key) {
  const validCount = outfits.filter((o) => !isMissingComparisonValue(o.comparison?.[key])).length;
  if (validCount < 2) return -1;

  if (key === 'price') {
    const prices = outfits.map((o) => {
      if (isMissingComparisonValue(o.comparison?.price)) return Number.POSITIVE_INFINITY;
      const n = parseInt(String(o.comparison.price).replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    });
    const min = Math.min(...prices);
    return Number.isFinite(min) ? prices.indexOf(min) : -1;
  }
  if (key === 'fitRisk') {
    const risk = outfits.map((o) => {
      if (isMissingComparisonValue(o.comparison?.fitRisk)) return Number.POSITIVE_INFINITY;
      if (o.comparison.fitRisk === '낮음') return 0;
      if (o.comparison.fitRisk === '중간') return 1;
      if (o.comparison.fitRisk === '높음') return 2;
      return Number.POSITIVE_INFINITY;
    });
    const min = Math.min(...risk);
    return Number.isFinite(min) ? risk.indexOf(min) : -1;
  }
  return -1; // No "best" for free-text rows (fit / material / season).
}

function pickThumbnail(outfit, idx) {
  const firstItem = Array.isArray(outfit.items) ? outfit.items[0] : null;
  if (firstItem) {
    const product = resolveProductFromItem(firstItem);
    if (product?.image) return { kind: 'image', src: product.image };
  }
  return { kind: 'emoji', value: FALLBACK_THUMBS[idx] || '🪞' };
}

export function renderComparison(container, { navigateTo }) {
  const compareIds = state.get('compareOutfitIds') || [];
  const recommendations = state.get('recommendations') || [];
  const outfits = compareIds.length
    ? compareIds.map((id) => resolveOutfit(id)).filter(Boolean)
    : recommendations.slice(0, 3);

  if (outfits.length === 0) {
    container.innerHTML = `
      <div class="cp-screen">
        <header class="cp-topbar">
          <button type="button" id="back-btn" class="cp-back-btn" aria-label="뒤로 가기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span class="cp-topbar-title">코디 비교</span>
        </header>
        <div class="cp-empty">
          <div class="cp-empty-icon" aria-hidden="true">🪞</div>
          <p class="cp-empty-title">비교할 코디가 없어요</p>
          <p class="cp-empty-desc">먼저 추천을 받고 카드에서 비교를 시작해 주세요.</p>
          <button type="button" id="go-onboarding" class="cp-go-onboarding">추천 받기</button>
        </div>
      </div>
    `;
    container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo('home'));
    container.querySelector('#go-onboarding')?.addEventListener('click', () => navigateTo('onboarding'));
    return;
  }

  const colTemplate = `64px repeat(${outfits.length}, minmax(0, 1fr))`;
  const bestPriceIdx = getBestIdx(outfits, 'price');

  container.innerHTML = `
    <div class="cp-screen">
      <header class="cp-topbar">
        <button type="button" id="back-btn" class="cp-back-btn" aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        </button>
        <span class="cp-topbar-title">코디 비교 (${outfits.length}개)</span>
      </header>

      <div class="cp-outfit-bar">
        <div class="cp-outfit-grid" style="grid-template-columns:${colTemplate};">
          <div class="cp-outfit-corner"></div>
          ${outfits.map((outfit, i) => renderOutfitHeader(outfit, i, bestPriceIdx)).join('')}
        </div>
      </div>

      <div class="cp-body">
        <section class="cp-group">
          ${CORE_ROWS.map((row) => renderRow(row, outfits, colTemplate)).join('')}
        </section>

        <section class="cp-group">
          <p class="cp-group-title">리뷰 평점</p>
          <div class="cp-review-grid" style="grid-template-columns:${colTemplate};">
            <div class="cp-row-label">평점·후기</div>
            ${outfits.map((outfit) => renderReviewCell(outfit)).join('')}
          </div>
        </section>

        <section class="cp-group">
          <p class="cp-group-title">구매 정보</p>
          <div class="cp-row cp-row--ext" style="grid-template-columns:${colTemplate};">
            <div class="cp-row-label">배송·반품</div>
            ${outfits.map(() => `
              <div class="cp-row-cell">
                <span class="cp-ext-chip">구매처 확인
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                </span>
              </div>
            `).join('')}
          </div>
          <p class="cp-ext-note">배송비·반품비는 쇼핑몰마다 달라요. 구매 전 상품 페이지에서 확인해 주세요.</p>
        </section>

        <div class="cp-actions">
          <p class="cp-actions-title">자세히 볼 코디를 선택해요</p>
          <div class="cp-detail-row">
            ${outfits.map((outfit) => `
              <button type="button" class="cp-go-detail" data-outfit="${e(outfit.id)}">
                ${e(truncateTitle(outfit.title))}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            `).join('')}
          </div>
          <button type="button" id="back-results-btn" class="cp-back-results">추천 목록으로 돌아가기</button>
        </div>
      </div>
    </div>
  `;

  staggerChildren(container, '.cp-row', 30);

  container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo(comparisonBackTarget()));
  container.querySelector('#back-results-btn')?.addEventListener('click', () => {
    const recs = state.get('recommendations') || [];
    navigateTo(recs.length > 0 ? 'results' : 'home');
  });

  container.querySelectorAll('.cp-go-detail, .cp-outfit-header').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.set('selectedOutfitId', btn.dataset.outfit);
      navigateTo('detail');
    });
  });
}

// Topbar back returns to the screen the user came from (detail / saved),
// otherwise the recommendation list, otherwise home — never an onboarding bounce.
function comparisonBackTarget() {
  const prev = state.get('previousScreen');
  if (prev === 'detail' || prev === 'saved') return prev;
  const recs = state.get('recommendations') || [];
  return recs.length > 0 ? 'results' : 'home';
}

function renderOutfitHeader(outfit, idx, bestPriceIdx) {
  const isPrimary = idx === 0;
  const thumb = pickThumbnail(outfit, idx);

  const thumbContent = thumb.kind === 'image'
    ? `<img src="${e(thumb.src)}" alt="" loading="lazy" />`
    : `<span aria-hidden="true">${thumb.value}</span>`;

  const price = typeof outfit.totalPrice === 'number' && outfit.totalPrice > 0
    ? `${outfit.totalPrice.toLocaleString()}원`
    : '정보 부족';
  const isBestPrice = bestPriceIdx === idx;

  return `
    <button type="button" class="cp-outfit-header ${isPrimary ? 'is-primary' : ''}" data-outfit="${e(outfit.id)}">
      <span class="cp-outfit-thumb ${isPrimary ? 'is-primary' : ''}">${thumbContent}</span>
      <span class="cp-outfit-name">${e(outfit.title)}</span>
      <span class="cp-outfit-price ${isBestPrice ? 'is-best' : ''}">${e(price)}</span>
      ${isBestPrice ? `<span class="cp-best-badge cp-head-badge">✓ 최저가</span>` : ''}
    </button>
  `;
}

function renderRow(row, outfits, colTemplate) {
  const bestIdx = getBestIdx(outfits, row.key);

  return `
    <div class="cp-row" style="grid-template-columns:${colTemplate};">
      <div class="cp-row-label">${e(row.label)}</div>
      ${outfits.map((outfit, i) => {
        const raw = outfit.comparison?.[row.key];
        const missing = isMissingComparisonValue(raw);
        let val = missing ? '정보 부족' : raw;
        if (!missing && row.kind === 'fit') val = fitLabel(raw);
        else if (!missing && row.kind === 'season') val = seasonLabel(raw);
        const isBest = bestIdx === i;
        const isRisk = row.key === 'fitRisk' && (val === '중간' || val === '높음');
        const classes = ['cp-row-value'];
        if (isBest) classes.push('is-best');
        if (isRisk) classes.push('is-risk');
        if (missing) classes.push('is-missing');
        return `
          <div class="cp-row-cell">
            <div class="${classes.join(' ')}">${isRisk ? '⚠️ ' : ''}${e(val)}</div>
            ${isBest ? `<span class="cp-best-badge">✓ Best</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderReviewCell(outfit) {
  const c = outfit.comparison || {};
  const rating = typeof c.rating === 'number' && Number.isFinite(c.rating) ? c.rating.toFixed(1) : null;
  const count = typeof c.reviewCount === 'number' && c.reviewCount > 0 ? c.reviewCount : 0;
  const summary = !isMissingComparisonValue(c.reviewSummary) ? c.reviewSummary : null;

  if (rating === null && !summary) {
    return `<div class="cp-row-cell"><div class="cp-row-value is-missing">정보 부족</div></div>`;
  }

  return `
    <div class="cp-review-cell">
      ${rating !== null ? `
        <span class="cp-review-rating">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.07 1.1-6.47-4.7-4.58 6.5-.95z"/></svg>
          ${e(rating)}
        </span>` : ''}
      ${count > 0 ? `<span class="cp-review-count">리뷰 ${count.toLocaleString()}</span>` : ''}
      ${summary ? `<p class="cp-review-text">${e(summary)}</p>` : ''}
    </div>
  `;
}

function truncateTitle(title) {
  if (!title) return '';
  return title.length > 9 ? `${title.substring(0, 9)}…` : title;
}
