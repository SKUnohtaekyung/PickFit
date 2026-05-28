// ========================================
// Screen 7: Saved / Feedback
// ========================================

import { state } from '../utils/state.js';
import { OUTFITS } from '../data/mock.js';
import { showToast, staggerChildren } from '../utils/animations.js';
import { persistFeedback, persistToggleSaved, syncSavedFromApi } from '../api/userActions.js';
import { resolveOutfitFromSaved } from '../utils/resolvers.js';
import { escapeHtml as ee } from '../utils/escape.js';

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
    }
  }).catch(() => {});
}

function renderSavedView(container, { navigateTo }) {
  const savedList = state.get('saved') || [];
  const savedOutfits = savedList
    .map(s => ({ ...s, outfit: resolveOutfitFromSaved(s) }))
    .filter(s => s.outfit);

  let selectedFeedback = [];

  container.innerHTML = `
    <!-- Top Bar -->
    <header class="px-4 flex items-center" style="height:56px;">
      <span class="text-heading-3" style="color:#12141A;">저장한 코디</span>
    </header>

    <div class="px-4 pb-32">

      ${savedOutfits.length > 0 ? `
        <!-- Saved Outfit Cards -->
        <div id="saved-list" style="display:flex; flex-direction:column; gap:12px; margin-bottom:28px;">
          ${savedOutfits.map(({ outfit, savedAt, id }) => `
            <div class="pf-card saved-card" style="padding:0; overflow:hidden;" data-outfit="${ee(id)}">
              <div style="display:flex; align-items:center; gap:0;">
                <!-- Color accent bar -->
                <div style="width:4px; self-stretch; background:#4D5EFF; border-radius:4px 0 0 4px; min-height:80px; flex-shrink:0; align-self:stretch;"></div>
                <!-- Content -->
                <div style="flex:1; padding:14px 16px;">
                  <div style="display:flex; align-items:start; justify-content:space-between; gap:8px;">
                    <div>
                      <span style="display:inline-block; background:#EAF0FF; color:#4D5EFF; font-size:11px; font-weight:700; padding:2px 10px; border-radius:999px; margin-bottom:5px;">${ee(outfit.framingLabel)}</span>
                      <p style="font-size:15px; font-weight:700; color:#12141A; margin-bottom:2px;">${ee(outfit.title)}</p>
                      <p class="text-caption" style="color:#5F6675;">${new Date(savedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 저장 · ${outfit.totalPrice.toLocaleString()}원</p>
                    </div>
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                      <button class="view-btn pf-btn-ghost" data-outfit="${ee(id)}" style="height:34px; padding:0 10px; font-size:12px; background:#EEF1F6; color:#4D5EFF; border-radius:8px;">
                        보기
                      </button>
                      <button class="delete-btn" data-outfit="${ee(id)}" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; background:#FDECEC; border:none; border-radius:8px; cursor:pointer; color:#C53B3B; transition:all 0.12s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <!-- Empty State -->
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:280px; text-align:center; padding:40px 20px;">
          <div style="width:72px; height:72px; border-radius:24px; background:#EEF1F6; display:flex; align-items:center; justify-content:center; margin-bottom:16px; font-size:36px;">
            🪄
          </div>
          <p class="text-title" style="color:#12141A; margin-bottom:8px;">아직 저장한 코디가 없어요</p>
          <p class="text-body" style="color:#5F6675; margin-bottom:24px;">추천받은 코디에서 하트를 눌러<br/>마음에 드는 코디를 저장해보세요</p>
          <button id="go-landing-empty" style="height:44px; padding:0 24px; border-radius:12px; background:#4D5EFF; color:#fff; font-size:14px; font-weight:600; border:none; cursor:pointer;">
            추천 받으러 가기
          </button>
        </div>
      `}

      <!-- Divider -->
      <div style="height:1px; background:#EEF1F6; margin:4px 0 24px;"></div>

      <!-- Feedback Section -->
      <div>
        <p class="text-heading-3" style="color:#12141A; margin-bottom:6px;">최근 추천은 어떠셨나요?</p>
        <p class="text-body" style="color:#5F6675; margin-bottom:16px;">피드백을 남기면 다음 추천이 더 정확해져요</p>
        <div id="feedback-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:20px;">
          ${FEEDBACK_CHIPS.map(fc => `
            <button class="pf-feedback-chip" data-fb="${fc.id}">
              <span class="fb-emoji">${fc.emoji}</span>
              <span class="fb-label" style="color:#12141A;">${fc.label}</span>
            </button>
          `).join('')}
        </div>
        <button id="submit-feedback-btn" class="pf-btn-primary" style="height:48px; margin-bottom:12px;" disabled>
          피드백 완료
        </button>
      </div>

      <!-- New Recommendation CTA -->
      <button id="new-rec-btn" class="pf-btn-secondary" style="width:100%; height:48px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.62"/></svg>
        새로 추천 받기
      </button>
    </div>
  `;

  // Stagger animate
  staggerChildren(container, '.saved-card', 60);

  // View outfit
  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('selectedOutfitId', btn.dataset.outfit);
      navigateTo('detail');
    });
  });

  // Delete outfit
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.outfit;
      const entry = state.findSavedEntry(id);
      const outfit = entry?.outfit || null;
      state.toggleSaved(id, outfit); // removes since it's saved
      const card = container.querySelector(`.saved-card[data-outfit="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          card.remove();
          showToast('저장이 해제되었습니다');
          const remaining = container.querySelectorAll('.saved-card');
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

  // Empty state CTA
  container.querySelector('#go-landing-empty')?.addEventListener('click', () => navigateTo('landing'));

  // Feedback chips
  const submitBtn = container.querySelector('#submit-feedback-btn');
  container.querySelectorAll('.pf-feedback-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.fb;
      if (selectedFeedback.includes(id)) {
        selectedFeedback = selectedFeedback.filter(s => s !== id);
        chip.classList.remove('selected');
        chip.querySelector('.fb-label').style.color = '#12141A';
      } else {
        selectedFeedback.push(id);
        chip.classList.add('selected');
        chip.querySelector('.fb-label').style.color = '#ffffff';
      }
      if (submitBtn) submitBtn.disabled = selectedFeedback.length === 0;
    });
  });

  submitBtn?.addEventListener('click', () => {
    state.addFeedback(selectedFeedback);
    const feedbackType = selectedFeedback.length === 1 ? selectedFeedback[0] : 'general';
    const tags = selectedFeedback.length === 1 ? [] : [...selectedFeedback];
    selectedFeedback = [];
    container.querySelectorAll('.pf-feedback-chip').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.fb-label').style.color = '#12141A';
    });
    submitBtn.disabled = true;
    showToast('피드백 감사해요! 다음 추천에 반영할게요 ✨');
    persistFeedback({ feedbackType, tags }).then((result) => {
      if (result.status === 'unauthenticated') {
        showToast('로그인하면 피드백이 동기화돼요.');
      } else if (result.status === 'api-error') {
        showToast('피드백 서버 반영에 실패했어요.');
      }
    });
  });

  // New recommendation
  container.querySelector('#new-rec-btn')?.addEventListener('click', () => {
    state.resetOnboarding();
    navigateTo('landing');
  });
}
