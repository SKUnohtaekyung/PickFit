// ========================================
// Profile — 닉네임·성별 편집 (gated).
// ========================================
// account 화면에서 진입한다. 저장하면 POST /api/profile로 갱신하고, 서버가 돌려준
// user로 인증 캐시(setAuthUser)를 맞춰 account/navbar가 즉시 최신값을 보여준다.

import { getAuthUser, setAuthUser } from '../components/authModal.js';
import { updateProfile } from '../api/profile.js';
import { showToast } from '../utils/animations.js';
import { apiErrorMessage } from '../api/client.js';
import { escapeText } from '../utils/escape.js';

export function renderProfile(container, { navigateTo } = {}) {
  const user = getAuthUser();
  const displayName = user?.displayName || '';
  const gender = user?.gender || '';
  const email = user?.email || '';

  container.innerHTML = `
    <div class="acc-screen">
      <header class="acc-topbar">
        <button type="button" class="acc-back" id="prof-back" aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="acc-topbar-title">프로필 편집</span>
      </header>

      <form class="prof-form" id="prof-form" novalidate>
        <label class="prof-field">
          <span>이메일</span>
          <input type="email" value="${escapeText(email)}" disabled />
          <span class="prof-hint">이메일은 변경할 수 없어요.</span>
        </label>

        <div class="prof-field">
          <span>성별</span>
          <div class="pf-auth-gender" role="radiogroup" aria-label="성별">
            <button type="button" class="pf-auth-gender-opt ${gender === 'male' ? 'on' : ''}" data-gender="male" role="radio" aria-checked="${gender === 'male'}">남성</button>
            <button type="button" class="pf-auth-gender-opt ${gender === 'female' ? 'on' : ''}" data-gender="female" role="radio" aria-checked="${gender === 'female'}">여성</button>
          </div>
        </div>

        <label class="prof-field">
          <span>닉네임 <span class="pf-auth-opt">선택</span></span>
          <input type="text" name="displayName" maxlength="80" value="${escapeText(displayName)}" placeholder="닉네임을 입력하세요" autocomplete="nickname" />
        </label>

        <p class="pf-auth-error" id="prof-error" role="alert" hidden></p>

        <button type="submit" class="pf-btn-primary prof-submit" id="prof-save">저장하기</button>
      </form>
    </div>
  `;

  // 현재 성별을 초기 선택값으로 잡고, 버튼 클릭 시 갱신한다.
  let selectedGender = gender || null;

  container.querySelector('#prof-back')?.addEventListener('click', () => navigateTo?.('account'));

  container.querySelectorAll('.pf-auth-gender-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.pf-auth-gender-opt').forEach((b) => {
        b.classList.remove('on');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('on');
      btn.setAttribute('aria-checked', 'true');
      selectedGender = btn.dataset.gender;
    });
  });

  const form = container.querySelector('#prof-form');
  const errorEl = container.querySelector('#prof-error');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedGender) {
      showError(errorEl, '성별을 선택해 주세요.');
      return;
    }

    const name = String(new FormData(form).get('displayName') || '').trim();
    const saveBtn = container.querySelector('#prof-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    errorEl.hidden = true;

    try {
      const updated = await updateProfile({ displayName: name, gender: selectedGender });
      setAuthUser(updated);
      showToast('프로필을 저장했어요.');
      navigateTo?.('account');
    } catch (error) {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장하기';
      // 세션이 만료(401)됐다면 다른 화면과 동일하게 중앙 핸들러로 위임해 로그인 화면으로 보낸다.
      if (error?.status === 401 || error?.code === 'unauthenticated') {
        window.dispatchEvent(new CustomEvent('pickfit:session-expired'));
        return;
      }
      showError(errorEl, apiErrorMessage(error));
    }
  });
}

function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}
