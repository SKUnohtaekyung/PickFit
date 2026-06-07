// ========================================
// Settings — 모션 줄이기 · 로컬 데이터 초기화 · 앱 정보 (gated, client-only).
// ========================================
// 서버 상태가 없는 클라이언트 전용 설정. 모션 선호는 localStorage에 저장되고
// app.js의 reducedMotion()이 이 값을 읽어 화면 전환 애니메이션을 끈다.

import { state } from '../utils/state.js';
import { showToast } from '../utils/animations.js';

const MOTION_KEY = 'pf_reduce_motion';
const APP_VERSION = 'v1.0';

function motionReduced() {
  try {
    return localStorage.getItem(MOTION_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function renderSettings(container, { navigateTo } = {}) {
  const reduced = motionReduced();

  container.innerHTML = `
    <div class="acc-screen">
      <header class="acc-topbar">
        <button type="button" class="acc-back" id="set-back" aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="acc-topbar-title">설정</span>
      </header>

      <section class="acc-list">
        <div class="acc-row set-row-static">
          <span class="acc-row-text">
            <span class="acc-row-label">모션 줄이기</span>
            <span class="acc-row-sub">화면 전환 애니메이션을 최소화해요.</span>
          </span>
          <button type="button" id="set-motion" class="set-switch ${reduced ? 'is-on' : ''}" role="switch" aria-checked="${reduced}" aria-label="모션 줄이기">
            <span class="set-switch-knob" aria-hidden="true"></span>
          </button>
        </div>

        <button type="button" class="acc-row set-row-danger" id="set-reset">
          <span class="acc-row-text">
            <span class="acc-row-label">로컬 데이터 초기화</span>
            <span class="acc-row-sub">이 기기의 추천·저장·피드백 임시 데이터를 지워요.</span>
          </span>
          <span class="acc-row-arrow" aria-hidden="true">›</span>
        </button>
      </section>

      <p class="set-version">PICKFIT ${APP_VERSION}</p>
    </div>
  `;

  container.querySelector('#set-back')?.addEventListener('click', () => navigateTo?.('account'));

  // 모션 줄이기 토글 — 즉시 저장되고 다음 화면 전환부터 적용된다.
  const motionBtn = container.querySelector('#set-motion');
  motionBtn?.addEventListener('click', () => {
    const next = !motionReduced();
    try {
      localStorage.setItem(MOTION_KEY, next ? '1' : '0');
    } catch (_) {
      /* ignore storage failures */
    }
    motionBtn.classList.toggle('is-on', next);
    motionBtn.setAttribute('aria-checked', String(next));
    showToast(next ? '모션을 줄였어요.' : '모션을 켰어요.');
  });

  // 로컬 데이터 초기화 — 되돌릴 수 없으므로 확인을 받는다(서버 계정 데이터는 그대로).
  container.querySelector('#set-reset')?.addEventListener('click', () => {
    const ok = window.confirm('이 기기에 저장된 추천·저장·피드백 임시 데이터를 모두 지울까요?\n계정 정보는 사라지지 않아요.');
    if (!ok) return;
    state.resetOnboarding();
    state.clearSaved();
    state.set('feedback', []);
    showToast('로컬 데이터를 초기화했어요.');
  });
}
