// ========================================
// Auth screen — intentional login / register (page, not modal).
// ========================================
// Single-screen toggle (로그인 / 회원가입). Reuses submitAuth() shared with the
// contextual modal so the two never diverge. On success, resumes the pending
// gated destination (set by the soft-gate guard) or falls back to home.

import { submitAuth } from '../components/authModal.js';
import { authErrorMessage } from '../api/auth.js';

const COPY = {
  login: {
    title: '로그인',
    sub: '픽핏 계정으로 코디 추천을 시작해요',
    cta: '로그인하기',
    note: '추천 결과와 저장한 코디가 안전하게 보관돼요.',
    swap: '아직 계정이 없어요? ',
    swapAction: '회원가입',
  },
  register: {
    title: '회원가입',
    sub: '이메일만 있으면 바로 시작할 수 있어요',
    cta: '가입하고 시작하기',
    note: '가입하면 추천 기록과 저장한 코디가 안전하게 보관돼요.',
    swap: '이미 계정이 있어요? ',
    swapAction: '로그인',
  },
};

export function renderAuth(container, { navigateTo, onAuthSuccess, mode } = {}) {
  const initialMode = mode === 'register' ? 'register' : 'login';
  const draft = { mode: initialMode, email: '', password: '', displayName: '', gender: null };
  let busy = false;

  function snapshotInputs() {
    const root = container;
    draft.email = root.querySelector('#auth-email')?.value ?? draft.email;
    draft.password = root.querySelector('#auth-password')?.value ?? draft.password;
    draft.displayName = root.querySelector('#auth-nickname')?.value ?? draft.displayName;
    draft.gender = root.querySelector('.auth-gender-opt.on')?.dataset.gender ?? draft.gender;
  }

  function render() {
    const c = COPY[draft.mode];
    const isRegister = draft.mode === 'register';

    container.innerHTML = `
      <div class="auth-screen">
        <div class="auth-orb" aria-hidden="true"></div>

        <button type="button" class="auth-back" id="auth-back" aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <header class="auth-head">
          <img class="auth-mark" src="img/logo/logo_img.png" alt="" aria-hidden="true" />
          <h1 class="auth-title" tabindex="-1">${c.title}</h1>
          <p class="auth-sub">${c.sub}</p>
        </header>

        <div class="auth-seg" role="tablist" aria-label="인증 방식">
          <button type="button" class="auth-seg-btn ${!isRegister ? 'on' : ''}" data-mode="login" role="tab" aria-selected="${!isRegister}">로그인</button>
          <button type="button" class="auth-seg-btn ${isRegister ? 'on' : ''}" data-mode="register" role="tab" aria-selected="${isRegister}">회원가입</button>
        </div>

        <form class="auth-form" id="auth-form" novalidate>
          ${isRegister ? `
            <div class="auth-field">
              <span class="auth-label">성별</span>
              <div class="auth-gender" role="radiogroup" aria-label="성별">
                <button type="button" class="auth-gender-opt ${draft.gender === 'male' ? 'on' : ''}" data-gender="male" role="radio" aria-checked="${draft.gender === 'male'}">남성</button>
                <button type="button" class="auth-gender-opt ${draft.gender === 'female' ? 'on' : ''}" data-gender="female" role="radio" aria-checked="${draft.gender === 'female'}">여성</button>
              </div>
              <span class="auth-gender-hint">맞는 옷(여성복·남성복·공용)만 추천하는 데 사용돼요</span>
            </div>
            <label class="auth-field">
              <span class="auth-label">닉네임 <span class="auth-opt">선택</span></span>
              <input class="auth-input" id="auth-nickname" type="text" name="displayName" autocomplete="nickname" maxlength="80" placeholder="픽핏에서 부를 이름" value="${escapeAttr(draft.displayName)}" />
            </label>
          ` : ''}
          <label class="auth-field">
            <span class="auth-label">이메일</span>
            <input class="auth-input" id="auth-email" type="email" name="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" value="${escapeAttr(draft.email)}" />
          </label>
          <label class="auth-field">
            <span class="auth-label">비밀번호</span>
            <input class="auth-input" id="auth-password" type="password" name="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" minlength="8" required placeholder="8자 이상 입력" value="${escapeAttr(draft.password)}" />
          </label>

          <p class="auth-error" id="auth-error" role="alert" hidden></p>

          ${isRegister ? `
            <p class="auth-consent">가입하면 <b>이용약관</b>과 <b>개인정보처리방침</b>에 동의하게 돼요.</p>
          ` : ''}

          <p class="auth-note">${c.note}</p>
          <button type="submit" class="auth-cta" id="auth-submit">${c.cta}</button>
          <p class="auth-swap">${c.swap}<button type="button" class="auth-swap-btn" data-mode="${isRegister ? 'login' : 'register'}">${c.swapAction}</button></p>
        </form>
      </div>
    `;

    bind();
    requestAnimationFrame(() => container.querySelector('.auth-title')?.focus?.());
  }

  function switchMode(mode) {
    if (busy || mode === draft.mode) return;
    snapshotInputs();
    draft.mode = mode === 'register' ? 'register' : 'login';
    render();
  }

  function showError(message) {
    const el = container.querySelector('#auth-error');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    snapshotInputs();

    const email = draft.email.trim();
    const password = draft.password;
    const displayName = draft.displayName.trim();
    const gender = draft.gender;
    const errorEl = container.querySelector('#auth-error');
    if (errorEl) errorEl.hidden = true;

    if (draft.mode === 'register' && !gender) {
      showError('성별을 선택해 주세요.');
      return;
    }
    if (!email || !password) {
      showError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (password.length < 8) {
      showError('비밀번호는 8자 이상 입력해 주세요.');
      return;
    }

    const submit = container.querySelector('#auth-submit');
    busy = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = draft.mode === 'register' ? '가입 중…' : '로그인 중…';
    }

    try {
      await submitAuth({ mode: draft.mode, email, password, displayName, gender });
      busy = false;
      if (typeof onAuthSuccess === 'function') onAuthSuccess();
      else navigateTo?.('home');
    } catch (error) {
      busy = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = COPY[draft.mode].cta;
      }
      showError(authErrorMessage(error));
    }
  }

  function bind() {
    container.querySelector('#auth-back')?.addEventListener('click', () => {
      snapshotInputs();
      navigateTo?.('welcome');
    });
    container.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    container.querySelectorAll('.auth-gender-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        draft.gender = btn.dataset.gender;
        container.querySelectorAll('.auth-gender-opt').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-checked', String(on));
        });
      });
    });
    container.querySelector('#auth-form')?.addEventListener('submit', handleSubmit);
  }

  render();
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
