// ========================================
// Welcome — brand entry (public). Shown on first visit before the home.
// ========================================
// Soft-gate model: 시작하기 → home(landing, guest OK). 로그인 → auth screen.
// Login is required later (at the recommendation step), not here.

const SEEN_KEY = 'pf_seen_welcome';

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* ignore */ }
}

export function renderWelcome(container, { navigateTo } = {}) {
  container.innerHTML = `
    <div class="wel-screen">
      <div class="wel-orb wel-orb--blue" aria-hidden="true"></div>
      <div class="wel-orb wel-orb--lime" aria-hidden="true"></div>

      <div class="wel-logo">
        <img class="wel-logo-mark" src="img/logo/logo_img.png" alt="" aria-hidden="true" />
        <img class="wel-logo-word" src="img/logo/logo_korea.png" alt="픽핏" />
      </div>

      <div class="wel-hero">
        <h1 class="wel-h1" tabindex="-1">옷 고민,<br><b>3분</b>이면<br>끝나요</h1>
        <p class="wel-sub">상황만 고르면, 이유까지 정리된<br>완성 코디로 이어져요.</p>
      </div>

      <div class="wel-footer">
        <button type="button" class="wel-cta" id="wel-start">
          시작하기
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
          </svg>
        </button>
        <button type="button" class="wel-login" id="wel-login">
          이미 회원이세요? <b>로그인</b>
        </button>
      </div>
    </div>
  `;

  // Auth-first: 시작하기 opens registration, the secondary link opens login.
  // No more guest entry to the home — login happens up front, not mid-flow.
  container.querySelector('#wel-start')?.addEventListener('click', () => {
    markSeen();
    navigateTo?.('auth', { mode: 'register' });
  });
  container.querySelector('#wel-login')?.addEventListener('click', () => {
    markSeen();
    navigateTo?.('auth', { mode: 'login' });
  });

  // Move focus to the headline so keyboard/SR users land on content, not <body>.
  requestAnimationFrame(() => container.querySelector('.wel-h1')?.focus?.());
}
