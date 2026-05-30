// ========================================
// Screen 7: Saved / Feedback
// Phase 1 refactor — token-first .sv-* classes (no inline hex / sizes).
// Behavior, routing, persistence, and state contracts are unchanged.
// ========================================

import { state } from '../utils/state.js';
import { showToast, staggerChildren } from '../utils/animations.js';
import { persistFeedback, persistToggleSaved, syncSavedFromApi } from '../api/userActions.js';
import { resolveOutfitFromSaved } from '../utils/resolvers.js';
import { escapeHtml as ee } from '../utils/escape.js';
import { getAuthUser } from '../components/authModal.js';

const FEEDBACK_CHIPS = [
  { id: 'liked', emoji: '👍', label: '좋았어요' },
  { id: 'too_expensive', emoji: '💸', label: '너무 비싸요' },
  { id: 'too_basic', emoji: '😐', label: '너무 기본적' },
  { id: 'too_flashy', emoji: '✨', label: '너무 화려해요' },
  { id: 'too_slim', emoji: '📏', label: '너무 타이트' },
  { id: 'not_my_taste', emoji: '🎨', label: '취향 아니에요' },
  { id: 'show_more', emoji: '🔄', label: '비슷한 거 더' },
  { id: 'not_flattering', emoji: '🪞', label: '체형에 안맞아' },
];

export function renderSaved(container, { navigateTo }) {
  renderSavedView(container, { navigateTo });
  syncSavedFromApi().then((result) => {
    if (result.source === 'api') {
      renderSavedView(container, { navigateTo });
    } else if (result.error && getAuthUser()) {
      // Logged-in but the server list failed to load — don't present the local
      // (possibly empty) state as confirmed. Surface a retry so the user doesn't
      // think their saved coordis are gone and re-save duplicates.
      renderSavedView(container, { navigateTo, syncFailed: true });
    }
  }).catch(() => {});
}

function renderSavedView(container, { navigateTo, syncFailed = false }) {
  const savedList = state.get('saved') || [];
  const savedOutfits = savedList
    .map((s) => ({ ...s, outfit: resolveOutfitFromSaved(s) }))
    .filter((s) => s.outfit);

  let selectedFeedback = [];

  container.innerHTML = `
    <div class="sv-screen">
      <div class="sv-shell">
        ${syncFailed ? renderSyncErrorBanner() : ''}
        <header class="sv-header">
          <div class="sv-header-copy">
            <p class="sv-header-kicker">PICKFIT SAVED</p>
            <h1 class="sv-header-title">저장한 코디</h1>
          </div>
          ${savedOutfits.length > 0
            ? `<span class="sv-header-count">${savedOutfits.length}개</span>`
            : ''}
        </header>

        ${savedOutfits.length > 0
          ? `<section class="sv-list" id="saved-list">
              ${savedOutfits.map((entry) => renderSavedCard(entry)).join('')}
            </section>`
          : renderEmptyState()}

        <div class="sv-divider" aria-hidden="true"></div>

        <section class="sv-feedback-section">
          <div class="sv-feedback-head">
            <span class="sv-feedback-kicker">QUICK FEEDBACK</span>
            <h2 class="sv-feedback-title">최근 추천은 어떠셨나요?</h2>
            <p class="sv-feedback-desc">피드백을 남기면 다음 추천이 더 정확해져요.</p>
          </div>

          <div id="feedback-grid" class="sv-feedback-grid">
            ${FEEDBACK_CHIPS.map((fc) => `
              <button type="button" class="pf-feedback-chip" data-fb="${ee(fc.id)}">
                <span class="fb-emoji" aria-hidden="true">${fc.emoji}</span>
                <span class="fb-label">${ee(fc.label)}</span>
              </button>
            `).join('')}
          </div>

          <button type="button" id="submit-feedback-btn" class="sv-feedback-submit" disabled>
            피드백 보내기
          </button>
        </section>

        <button type="button" id="new-rec-btn" class="sv-new-rec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.62"/>
          </svg>
          새 추천 시작하기
        </button>
      </div>
    </div>
  `;

  staggerChildren(container, '.sv-card', 60);

  container.querySelector('#sv-retry-sync')?.addEventListener('click', () => {
    renderSaved(container, { navigateTo });
  });

  bindViewButtons(container, navigateTo);
  bindDeleteButtons(container, navigateTo);
  bindEmptyCta(container, navigateTo);
  bindFeedback(container);
  bindNewRec(container, navigateTo);

  function bindFeedback(root) {
    const submitBtn = root.querySelector('#submit-feedback-btn');

    root.querySelectorAll('.pf-feedback-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.fb;
        if (selectedFeedback.includes(id)) {
          selectedFeedback = selectedFeedback.filter((s) => s !== id);
          chip.classList.remove('selected');
        } else {
          selectedFeedback.push(id);
          chip.classList.add('selected');
        }
        if (submitBtn) submitBtn.disabled = selectedFeedback.length === 0;
      });
    });

    submitBtn?.addEventListener('click', () => {
      state.addFeedback(selectedFeedback);
      const feedbackType = selectedFeedback.length === 1 ? selectedFeedback[0] : 'general';
      const tags = selectedFeedback.length === 1 ? [] : [...selectedFeedback];
      selectedFeedback = [];
      root.querySelectorAll('.pf-feedback-chip').forEach((c) => c.classList.remove('selected'));
      submitBtn.disabled = true;
      showToast('피드백 감사해요. 다음 추천에 반영할게요.');
      persistFeedback({ feedbackType, tags }).then((result) => {
        if (result.status === 'unauthenticated') {
          showToast('로그인하면 피드백이 동기화돼요.');
        } else if (result.status === 'api-error') {
          showToast('피드백 서버 반영에 실패했어요.');
        }
      });
    });
  }
}

function renderSavedCard({ outfit, savedAt, id }) {
  const dateLabel = new Date(savedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  const priceLabel = `${outfit.totalPrice.toLocaleString()}원`;

  return `
    <article class="pf-card sv-card" data-outfit="${ee(id)}">
      <span class="sv-card-accent" aria-hidden="true"></span>
      <div class="sv-card-body">
        <div class="sv-card-text">
          <span class="sv-card-frame">${ee(outfit.framingLabel)}</span>
          <p class="sv-card-title">${ee(outfit.title)}</p>
          <p class="sv-card-meta">
            <span>${ee(dateLabel)} 저장</span>
            <span class="sv-card-meta-sep" aria-hidden="true">·</span>
            <span>${ee(priceLabel)}</span>
          </p>
        </div>
        <div class="sv-card-actions">
          <button type="button" class="sv-view-btn" data-view-outfit="${ee(id)}">
            보기
          </button>
          <button type="button" class="sv-delete-btn" data-delete-outfit="${ee(id)}" aria-label="저장 해제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderSyncErrorBanner() {
  return `
    <div class="sv-sync-error" role="status">
      <div class="sv-sync-error-copy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>저장 목록을 불러오지 못했어요. 아래는 최신이 아닐 수 있어요.</span>
      </div>
      <button type="button" id="sv-retry-sync" class="sv-sync-retry">다시 시도</button>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="sv-empty">
      <div class="sv-empty-icon" aria-hidden="true">🪄</div>
      <p class="sv-empty-title">아직 저장한 코디가 없어요</p>
      <p class="sv-empty-desc">추천받은 코디에서 하트를 눌러<br/>마음에 드는 코디를 저장해보세요.</p>
      <button type="button" id="go-landing-empty" class="sv-empty-cta">추천 받으러 가기</button>
    </div>
  `;
}

function bindViewButtons(container, navigateTo) {
  container.querySelectorAll('[data-view-outfit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.set('selectedOutfitId', btn.dataset.viewOutfit);
      navigateTo('detail');
    });
  });
}

function bindDeleteButtons(container, navigateTo) {
  container.querySelectorAll('[data-delete-outfit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteOutfit;
      const entry = state.findSavedEntry(id);
      const outfit = entry?.outfit || null;
      state.toggleSaved(id, outfit);
      const card = container.querySelector(`.sv-card[data-outfit="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          card.remove();
          showToast('저장이 해제되었습니다.');
          const remaining = container.querySelectorAll('.sv-card');
          if (remaining.length === 0) {
            renderSavedView(container, { navigateTo });
          }
        }, 200);
      }
      persistToggleSaved({ id }, false).then((result) => {
        if (result.status === 'api-error') {
          showToast('서버 동기화에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
    });
  });
}

function bindEmptyCta(container, navigateTo) {
  container.querySelector('#go-landing-empty')?.addEventListener('click', () => navigateTo('landing'));
}

function bindNewRec(container, navigateTo) {
  container.querySelector('#new-rec-btn')?.addEventListener('click', () => {
    state.resetOnboarding();
    navigateTo('landing');
  });
}
