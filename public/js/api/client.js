// ========================================
// PickFit Shared API Client
// ========================================

let csrfToken = null;

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'request_failed', payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function apiRequest(path, options = {}, retried = false, networkRetried = false) {
  const {
    method = 'GET',
    body,
    csrf = false,
    headers = {},
    timeoutMs = 15000,
    signal,
    // 멱등한 GET은 일시적 네트워크/타임아웃 오류를 1회 자동 재시도한다.
    // POST 등 비멱등 요청은 중복 부작용 위험이 있어 기본적으로 끈다.
    retryOnNetwork = method === 'GET',
  } = options;
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (csrf) {
    requestHeaders['X-CSRF-Token'] = await getCsrfToken();
  }

  const controller = new AbortController();
  const timeoutId = timeoutMs > 0
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;
  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', abortFromCaller, { once: true });
    }
  }

  // 호출자가 직접 취소(signal abort)한 경우와, 우리 타임아웃/네트워크 단절을
  // 구분하기 위해 fetch 전에 호출자 취소 여부를 기록해 둔다.
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const normalized = normalizeFetchError(error);
    const callerAborted = !!signal?.aborted; // 사용자가 취소한 요청은 재시도하지 않음
    const isRetryable = normalized.code === 'network_error' || normalized.code === 'timeout';
    if (retryOnNetwork && isRetryable && !networkRetried && !callerAborted) {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
      await delay(400);
      return apiRequest(path, options, retried, true);
    }
    throw normalized;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const payload = await readJson(response);

  if (
    csrf
    && response.status === 403
    && payload.error?.code === 'forbidden'
    && !retried
  ) {
    clearCsrfToken();
    return apiRequest(path, options, true);
  }

  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.error?.message || 'Request failed.', {
      status: response.status,
      code: payload.error?.code || 'request_failed',
      payload,
    });
  }

  return payload;
}

export async function getCsrfToken({ force = false } = {}) {
  if (csrfToken && !force) {
    return csrfToken;
  }

  const payload = await apiRequest('/api/csrf');
  const token = payload.data?.csrfToken;

  if (!token) {
    throw new ApiError('CSRF token is missing from the response.', {
      status: 200,
      code: 'csrf_missing',
      payload,
    });
  }

  csrfToken = token;
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

export function toQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export function apiErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  if (error.status === 0) {
    return error.code === 'timeout'
      ? '요청 시간이 초과됐어요. 다시 시도해 주세요.'
      : '서버에 연결할 수 없어요. 로컬 서버 상태를 확인해 주세요.';
  }

  if (error.code === 'rate_limited') {
    return '요청이 잠시 많았어요. 조금 뒤에 다시 시도해 주세요.';
  }

  if (error.code === 'forbidden') {
    return '보안 토큰이 만료됐어요. 다시 시도해 주세요.';
  }

  if (error.code === 'unauthenticated') {
    return '로그인이 필요해요.';
  }

  if (error.code === 'validation_failed') {
    return '입력값을 다시 확인해 주세요.';
  }

  if (error.code === 'database_unavailable') {
    return '데이터베이스에 연결할 수 없어요.';
  }

  return error.message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError('Server response was not valid JSON.', {
      status: response.status,
      code: 'invalid_json_response',
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeFetchError(error) {
  if (error?.name === 'AbortError') {
    return new ApiError('Request timed out.', {
      status: 0,
      code: 'timeout',
    });
  }

  return new ApiError(error?.message || 'Network request failed.', {
    status: 0,
    code: 'network_error',
  });
}
