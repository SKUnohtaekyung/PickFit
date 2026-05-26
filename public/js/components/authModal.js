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

export function mountAuthSlot(target) {
  if (!target) return () => {};

  const refresh = () => {
    if (!document.documentElement.contains(target)) {
      window.removeEventListener(AUTH_CHANGE_EVENT, refresh);
      return;
    }

    renderAuthSlot(target);
  };

  window.addEventListener(AUTH_CHANGE_EVENT, refresh);
  refresh();

  return () => window.removeEventListener(AUTH_CHANGE_EVENT, refresh);
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

function renderAuthSlot(target) {
  if (!authState.ready) {
    target.innerHTML = `
      <button type="button" class="pf-auth-trigger is-loading" disabled>
        확인 중
      </button>
    `;
    return;
  }

  if (!authState.user) {
    target.innerHTML = `
      <button type="button" class="pf-auth-trigger" data-auth-open>
        로그인
      </button>
    `;

    target.querySelector('[data-auth-open]')?.addEventListener('click', () => {
      openAuthModal('login');
    });
    return;
  }

  const label = authState.user.displayName || authState.user.email;

  target.innerHTML = `
    <div class="pf-auth-user">
      <span class="pf-auth-user-name">${escapeHtml(label)}</span>
      <button type="button" class="pf-auth-logout" data-auth-logout>
        로그아웃
      </button>
    </div>
  `;

  target.querySelector('[data-auth-logout]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      await logout();
    } catch (error) {
      button.disabled = false;
      showToast(authErrorMessage(error));
    }
  });
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
          <label class="pf-auth-field">
            <span>닉네임</span>
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

  if (!email || !password) {
    showFormError(errorEl, '이메일과 비밀번호를 입력해 주세요.');
    return;
  }

  if (password.length < 8) {
    showFormError(errorEl, '비밀번호는 8자 이상 입력해 주세요.');
    return;
  }

  submit.disabled = true;
  submit.textContent = activeMode === 'register' ? '가입 중...' : '로그인 중...';
  errorEl.hidden = true;

  try {
    authState.user = activeMode === 'register'
      ? await register({ email, password, displayName })
      : await login({ email, password });
    authSequence += 1;
    authState.ready = true;

    closeAuthModal();
    notifyAuthChange();
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}
