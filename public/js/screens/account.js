// ========================================
// Account — lightweight profile + logout (gated).
// ========================================
// Replaces the old header auth slot. Logout routes through auth.js::logout()
// (clears CSRF) then resets client-side state to prevent cross-user leakage on
// a shared browser, and returns to welcome.

import { getAuthUser, logout } from '../components/authModal.js';
import { state } from '../utils/state.js';
import { showToast } from '../utils/animations.js';
import { authErrorMessage } from '../api/auth.js';
import { escapeText } from '../utils/escape.js';

function resetClientState() {
  // resetOnboarding clears onboarding draft, recommendations, selectedOutfitId,
  // compareOutfitIds, and the sourceProducts accumulator.
  state.resetOnboarding();
  state.clearSaved();
  state.set('feedback', []);
}

export function renderAccount(container, { navigateTo } = {}) {
  const user = getAuthUser();
  const displayName = user?.displayName || '';
  const email = user?.email || '';
  const label = displayName || email || '내 계정';
  const initial = (displayName || email || 'P').trim().charAt(0).toUpperCase();
  const savedCount = (state.get('saved') || []).length;

  container.innerHTML = `
    <div class="acc-screen">
      <header class="acc-topbar">
        <button type="button" class="acc-back" id="acc-back" aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="acc-topbar-title">내 정보</span>
      </header>

      <section class="acc-profile">
        <span class="acc-avatar" aria-hidden="true">${escapeText(initial)}</span>
        <div class="acc-profile-text">
          <p class="acc-name" tabindex="-1">${escapeText(label)}</p>
          ${email ? `<p class="acc-email">${escapeText(email)}</p>` : ''}
        </div>
      </section>

      <section class="acc-list">
        <button type="button" class="acc-row" id="acc-saved">
          <span class="acc-row-label">저장한 코디</span>
          <span class="acc-row-meta">${savedCount}개 <span class="acc-row-arrow" aria-hidden="true">›</span></span>
        </button>
      </section>

      <button type="button" class="acc-logout" id="acc-logout">로그아웃</button>
    </div>
  `;

  container.querySelector('#acc-back')?.addEventListener('click', () => navigateTo?.('home'));
  container.querySelector('#acc-saved')?.addEventListener('click', () => navigateTo?.('saved'));

  const logoutBtn = container.querySelector('#acc-logout');
  logoutBtn?.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
      await logout();
      resetClientState();
      navigateTo?.('welcome');
    } catch (error) {
      logoutBtn.disabled = false;
      showToast(authErrorMessage(error));
    }
  });

  requestAnimationFrame(() => container.querySelector('.acc-name')?.focus?.());
}
