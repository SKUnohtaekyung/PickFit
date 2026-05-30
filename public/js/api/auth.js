// ========================================
// PickFit Auth API Client
// ========================================

import {
  ApiError,
  apiErrorMessage,
  apiRequest,
  clearCsrfToken,
  getCsrfToken,
} from './client.js';

export { ApiError as AuthApiError, getCsrfToken };

export async function currentUser() {
  try {
    const payload = await apiRequest('/api/auth/me');
    return payload.data?.user || null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function register({ email, password, displayName, gender }) {
  const payload = await apiRequest('/api/auth/register', {
    method: 'POST',
    csrf: true,
    body: {
      email,
      password,
      displayName,
      gender,
    },
  });

  return payload.data?.user || null;
}

export async function login({ email, password }) {
  const payload = await apiRequest('/api/auth/login', {
    method: 'POST',
    csrf: true,
    body: {
      email,
      password,
    },
  });

  return payload.data?.user || null;
}

export async function logout() {
  const payload = await apiRequest('/api/auth/logout', {
    method: 'POST',
    csrf: true,
  });

  clearCsrfToken();
  return payload.data || {};
}

export function authErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return apiErrorMessage(error);
  }

  if (error.code === 'unauthenticated') {
    return '이메일 또는 비밀번호를 확인해 주세요.';
  }

  if (error.code === 'validation_failed') {
    const message = error.message.toLowerCase();
    if (message.includes('registered')) {
      return '이미 가입된 이메일이에요.';
    }
    if (message.includes('password')) {
      return '비밀번호는 8자 이상 입력해 주세요.';
    }
    if (message.includes('email')) {
      return '이메일 형식을 확인해 주세요.';
    }
  }

  return apiErrorMessage(error);
}
