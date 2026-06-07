// ========================================
// PickFit Auth Modal
// ========================================

import {
  authErrorMessage,
  currentUser,
  login,
  logout as apiLogout,
  register,
} from '../api/auth.js';
import { showToast } from '../utils/animations.js';

const AUTH_CHANGE_EVENT = 'pickfit:auth-change';

const authState = {
  ready: false,
  loading: false,
  user: null,
};

let modalRoot = null;
let activeMode = 'login';
let authSequence = 0;

export function initializeAuth() {
  if (authState.loading || authState.ready) {
    return Promise.resolve(authState.user);
  }

  authState.loading = true;
  const sequence = ++authSequence;
  notifyAuthChange();

  return currentUser()
    .then((user) => {
      if (sequence !== authSequence) {
        return authState.user;
      }

      authState.user = user;
      return user;
    })
    .catch((error) => {
      console.warn('Auth state check failed:', error);
      return null;
    })
    .finally(() => {
      authState.ready = true;
      authState.loading = false;
      notifyAuthChange();
    });
}

export function getAuthUser() {
  return authState.user;
}

// 프로필 편집 등으로 사용자 정보가 바뀌었을 때 캐시를 갱신하고 변경을 알린다.
// (로그인/로그아웃이 아니라 같은 사용자의 필드 변경이므로 user만 교체)
export function setAuthUser(user) {
  if (!user) return;
  authState.user = user;
  authState.ready = true;
  notifyAuthChange();
}

export function openAuthModal(mode = 'login') {
  activeMode = mode === 'register' ? 'register' : 'login';
  ensureModalRoot();
  renderModal();

  modalRoot.hidden = false;
  document.body.classList.add('pf-auth-modal-open');

  requestAnimationFrame(() => {
    modalRoot.querySelector('input')?.focus();
  });
}

export function closeAuthModal() {
  if (!modalRoot) return;

  modalRoot.hidden = true;
  document.body.classList.remove('pf-auth-modal-open');
}

export async function logout() {
  await apiLogout();
  authSequence += 1;
  authState.user = null;
  authState.ready = true;
  notifyAuthChange();
  showToast('로그아웃했어요.');
}

// Shared login/register submit — used by both the contextual modal and the
// full-screen auth page so the two never diverge. Pure: performs the API call,
// updates auth state, broadcasts the change, and returns the user. Callers own
// their own UI (toast / close / navigate). Throws on failure.
export async function submitAuth({ mode, email, password, displayName, gender }) {
  const user = mode === 'register'
    ? await register({ email, password, displayName, gender })
    : await login({ email, password });
  authSequence += 1;
  authState.user = user;
  authState.ready = true;
  notifyAuthChange();
  return user;
}

// Central session-expiry handler: clears cached auth so the navbar/gate stop
// believing the user is logged in after a 401 on a gated call. Does NOT call the
// logout API (the session is already gone server-side).
export function clearAuthUser() {
  authSequence += 1;
  authState.user = null;
  authState.ready = true;
  notifyAuthChange();
}

function ensureModalRoot() {
  if (modalRoot) return;

  modalRoot = document.createElement('div');
  modalRoot.className = 'pf-auth-modal-backdrop';
  modalRoot.hidden = true;
  document.body.appendChild(modalRoot);

  modalRoot.addEventListener('click', (event) => {
    if (event.target === modalRoot) {
      closeAuthModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!modalRoot || modalRoot.hidden || event.key !== 'Escape') return;
    closeAuthModal();
  });
}

function renderModal() {
  const isRegister = activeMode === 'register';

  modalRoot.innerHTML = `
    <section
      class="pf-auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div class="pf-auth-modal-head">
        <div class="pf-auth-title-stack">
          <p class="pf-auth-kicker">PICKFIT ACCOUNT</p>
          <h2 id="auth-modal-title">
            ${isRegister ? '회원가입' : '로그인'}
          </h2>
        </div>
        <button type="button" class="pf-auth-close" data-auth-close aria-label="닫기">
          ×
        </button>
      </div>

      <div class="pf-auth-tabs" role="tablist" aria-label="인증 방식 선택">
        ${renderModeButton('login', '로그인')}
        ${renderModeButton('register', '회원가입')}
      </div>

      <form class="pf-auth-form" id="auth-form" novalidate>
        ${isRegister ? `
          <div class="pf-auth-field">
            <span>성별</span>
            <div class="pf-auth-gender" role="radiogroup" aria-label="성별">
              <button type="button" class="pf-auth-gender-opt" data-gender="male" role="radio" aria-checked="false">남성</button>
              <button type="button" class="pf-auth-gender-opt" data-gender="female" role="radio" aria-checked="false">여성</button>
            </div>
          </div>
          <label class="pf-auth-field">
            <span>닉네임 <span class="pf-auth-opt">선택</span></span>
            <input
              type="text"
              name="displayName"
              autocomplete="nickname"
              maxlength="80"
              placeholder="선택 입력"
            />
          </label>
        ` : ''}

        <label class="pf-auth-field">
          <span>이메일</span>
          <input
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
            required
            placeholder="you@example.com"
          />
        </label>

        <label class="pf-auth-field">
          <span>비밀번호</span>
          <input
            type="password"
            name="password"
            autocomplete="${isRegister ? 'new-password' : 'current-password'}"
            minlength="8"
            required
            placeholder="8자 이상"
          />
        </label>

        <p class="pf-auth-error" id="auth-error" role="alert" hidden></p>

        <button type="submit" class="pf-btn-primary pf-auth-submit">
          ${isRegister ? '가입하고 시작하기' : '로그인하기'}
        </button>
      </form>
    </section>
  `;

  modalRoot.querySelector('[data-auth-close]')?.addEventListener('click', closeAuthModal);

  modalRoot.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      activeMode = button.dataset.authMode;
      renderModal();
      requestAnimationFrame(() => modalRoot.querySelector('input')?.focus());
    });
  });

  modalRoot.querySelectorAll('.pf-auth-gender-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalRoot.querySelectorAll('.pf-auth-gender-opt').forEach((b) => {
        b.classList.remove('on');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('on');
      btn.setAttribute('aria-checked', 'true');
    });
  });

  modalRoot.querySelector('#auth-form')?.addEventListener('submit', handleSubmit);
}

function renderModeButton(mode, label) {
  const selected = activeMode === mode;

  return `
    <button
      type="button"
      class="pf-auth-tab ${selected ? 'is-active' : ''}"
      data-auth-mode="${mode}"
      role="tab"
      aria-selected="${selected}"
    >
      ${label}
    </button>
  `;
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const errorEl = form.querySelector('#auth-error');
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');
  const displayName = String(data.get('displayName') || '').trim();
  const gender = form.querySelector('.pf-auth-gender-opt.on')?.dataset.gender || null;

  if (!email || !password) {
    showFormError(errorEl, '이메일과 비밀번호를 입력해 주세요.');
    return;
  }

  if (password.length < 8) {
    showFormError(errorEl, '비밀번호는 8자 이상 입력해 주세요.');
    return;
  }

  if (activeMode === 'register' && !gender) {
    showFormError(errorEl, '성별을 선택해 주세요.');
    return;
  }

  submit.disabled = true;
  submit.textContent = activeMode === 'register' ? '가입 중...' : '로그인 중...';
  errorEl.hidden = true;

  try {
    await submitAuth({ mode: activeMode, email, password, displayName, gender });
    closeAuthModal();
    showToast(activeMode === 'register' ? '회원가입이 완료됐어요.' : '로그인했어요.');
  } catch (error) {
    showFormError(errorEl, authErrorMessage(error));
  } finally {
    submit.disabled = false;
    submit.textContent = activeMode === 'register' ? '가입하고 시작하기' : '로그인하기';
  }
}

function showFormError(target, message) {
  target.textContent = message;
  target.hidden = false;
}

function notifyAuthChange() {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, {
    detail: {
      ready: authState.ready,
      user: authState.user,
    },
  }));
}
