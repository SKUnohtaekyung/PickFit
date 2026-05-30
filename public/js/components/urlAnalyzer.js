// ========================================
// PickFit URL Analyzer — landing-side product URL submission
// ========================================
// Single URL → backend analyze-url → optional poll → preview card.
// Trust UX principles ([PickFit.md §11]):
//   - explicit progress states, never silent success/failure
//   - block reasons surfaced in Korean
//   - auth required (opens modal if anonymous, no fake success)
//   - never displays raw error_message blobs to the user

import { analyzeUrl, getCrawlJob } from '../api/catalog.js';
import { ApiError, apiErrorMessage } from '../api/client.js';
import { getAuthUser, openAuthModal } from './authModal.js';
import { addSourceProductId, getSourceProductIds } from '../utils/sourceProducts.js';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_MS = 30000;

const ERROR_COPY = {
  blocked_url: '이 주소는 분석할 수 없어요. 공개된 상품 페이지 주소만 가능해요.',
  crawl_timeout: '상품 페이지를 읽는 데 너무 오래 걸렸어요. 잠시 후 다시 시도해 주세요.',
  navigation_timeout: '상품 페이지 응답이 너무 늦어요. 다른 주소로 시도해 보세요.',
  navigation_failed: '상품 페이지로 이동하지 못했어요. 주소가 정확한지 확인해 주세요.',
  post_navigation_blocked: '리다이렉트된 주소가 차단됐어요.',
  extraction_failed: '상품 정보를 정리하지 못했어요. 다른 주소로 시도해 주세요.',
  invalid_worker_output: '분석 워커 응답이 비정상이에요. 잠시 후 다시 시도해 주세요.',
  product_upsert_failed: '상품 데이터를 저장하지 못했어요.',
  artifact_dir_failed: '임시 저장 공간을 준비하지 못했어요.',
  unexpected_error: '예상치 못한 오류가 발생했어요.',
  rate_limited: 'URL 분석 요청이 많아요. 잠시 후 다시 시도해 주세요.',
  unauthenticated: '로그인하면 상품 URL을 분석할 수 있어요.',
};

export function mountUrlAnalyzer(target) {
  if (!target) return () => {};

  target.innerHTML = `
    <div class="lnd-analyzer pf-card">
      <div class="lnd-analyzer-head">
        <div>
          <p class="lnd-analyzer-kicker">URL 분석</p>
          <h3 class="lnd-analyzer-title">관심 있는 상품 주소가 있나요?</h3>
        </div>
        <span class="lnd-analyzer-badge">BETA</span>
      </div>
      <p class="lnd-analyzer-desc">
        공개된 쇼핑몰 상품 페이지 주소를 붙여 넣으면 픽핏 추천 후보에 자동으로 추가돼요.
      </p>
      <form class="lnd-analyzer-form" data-analyzer-form novalidate>
        <input
          type="url"
          class="lnd-analyzer-input"
          data-analyzer-input
          placeholder="https://..."
          autocomplete="off"
          spellcheck="false"
          inputmode="url"
        />
        <button type="submit" class="lnd-analyzer-submit" data-analyzer-submit>
          분석하기
        </button>
      </form>
      <p class="lnd-analyzer-hint" data-analyzer-hint aria-live="polite"></p>
      <div class="lnd-analyzer-status" data-analyzer-status hidden></div>
      <div class="lnd-analyzer-result" data-analyzer-result hidden></div>
    </div>
  `;

  const form = target.querySelector('[data-analyzer-form]');
  const input = target.querySelector('[data-analyzer-input]');
  const submit = target.querySelector('[data-analyzer-submit]');
  const hint = target.querySelector('[data-analyzer-hint]');
  const status = target.querySelector('[data-analyzer-status]');
  const result = target.querySelector('[data-analyzer-result]');

  let cancelled = false;

  const setHint = (text, tone = 'info') => {
    hint.textContent = text || '';
    hint.dataset.tone = tone;
  };

  const showStatus = (steps, currentIndex) => {
    status.hidden = false;
    status.innerHTML = steps
      .map((label, idx) => {
        const stateClass = idx < currentIndex ? 'is-done' : idx === currentIndex ? 'is-active' : '';
        return `<span class="lnd-analyzer-step ${stateClass}"><span class="lnd-analyzer-step-dot"></span>${label}</span>`;
      })
      .join('');
  };

  const hideStatus = () => {
    status.hidden = true;
    status.innerHTML = '';
  };

  const renderSuccess = (job, accumulatedCount) => {
    result.hidden = false;
    const product = job?.product || {};
    const name = product.productName || '상품 이름 미정';
    const brand = product.brandName ? `<span class="lnd-analyzer-result-brand">${escape(product.brandName)}</span>` : '';
    const price = product.priceSale ? `${Number(product.priceSale).toLocaleString()}원` : '가격 정보 없음';
    const image = product.heroImageUrl
      ? `<img src="${escape(product.heroImageUrl)}" alt="" class="lnd-analyzer-result-image" loading="lazy" />`
      : '<div class="lnd-analyzer-result-image lnd-analyzer-result-image--empty">이미지 없음</div>';
    const noteCopy = accumulatedCount > 0
      ? `추천 후보에 추가됐어요. 분석 누적 ${accumulatedCount}/5건 — 온보딩을 마치면 우선 반영돼요.`
      : '추천 후보에 추가됐어요. 온보딩을 마치면 추천에 우선 반영돼요.';
    result.innerHTML = `
      <div class="lnd-analyzer-result-card">
        ${image}
        <div class="lnd-analyzer-result-meta">
          ${brand}
          <p class="lnd-analyzer-result-name">${escape(name)}</p>
          <p class="lnd-analyzer-result-price">${price}</p>
          <p class="lnd-analyzer-result-note">${escape(noteCopy)}</p>
        </div>
      </div>
    `;
  };

  const renderFailure = (code, message) => {
    result.hidden = false;
    const friendly = ERROR_COPY[code] || message || ERROR_COPY.unexpected_error;
    result.innerHTML = `
      <div class="lnd-analyzer-result-error">
        <span class="lnd-analyzer-result-error-icon" aria-hidden="true">!</span>
        <p>${escape(friendly)}</p>
      </div>
    `;
  };

  const clearResult = () => {
    result.hidden = true;
    result.innerHTML = '';
  };

  const lockForm = (locked) => {
    submit.disabled = locked;
    input.disabled = locked;
    submit.textContent = locked ? '분석 중…' : '분석하기';
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    cancelled = false;
    clearResult();
    setHint('');

    const value = (input.value || '').trim();
    if (value === '') {
      setHint('주소를 입력해 주세요.', 'warn');
      return;
    }
    if (value.length > 2048) {
      setHint('URL이 너무 길어요. 더 짧은 주소를 사용해 주세요.', 'warn');
      return;
    }
    if (!/^https?:\/\//i.test(value)) {
      setHint('http:// 또는 https:// 로 시작하는 주소만 분석할 수 있어요.', 'warn');
      return;
    }

    if (!getAuthUser()) {
      setHint(ERROR_COPY.unauthenticated, 'warn');
      openAuthModal('login');
      return;
    }

    lockForm(true);
    const steps = ['URL 확인 중', '상품 화면 읽는 중', '상품 정보 정리 중', '추천 후보에 추가'];
    showStatus(steps, 0);

    try {
      // Step 1 → 2 transition is symbolic; the POST returns once the server-side
      // synchronous crawl finishes, but we tick through stages so the user has
      // visible progress while waiting.
      const tickInterval = setInterval(() => {
        const next = steps.findIndex((_, idx) => {
          const el = status.children[idx];
          return el && el.classList.contains('is-active');
        });
        if (next >= 0 && next < steps.length - 1) {
          showStatus(steps, next + 1);
        }
      }, 1200);

      let response;
      try {
        response = await analyzeUrl(value);
      } finally {
        clearInterval(tickInterval);
      }

      if (cancelled) return;

      if (response.ok === false && response.blocked === true) {
        hideStatus();
        renderFailure(response.code || 'blocked_url', response.message);
        return;
      }

      let job = response.job;
      if (job && (job.status === 'queued' || job.status === 'running')) {
        const polled = await pollJob(job.id);
        if (polled) {
          job = polled;
        } else {
          // Polling ended without a terminal status — this is a client-side
          // timeout (the crawl may still be running), not a definitive
          // extraction failure. Surface it honestly so the user can re-check.
          hideStatus();
          renderFailure('crawl_timeout');
          return;
        }
      }

      if (!job) {
        hideStatus();
        renderFailure('unexpected_error');
        return;
      }

      if (job.status === 'succeeded') {
        showStatus(steps, steps.length - 1);
        await delay(220);
        hideStatus();
        // Persist productId into sessionStorage so loading.js can pass it as
        // sourceProductIds on the next recommendation run (+5 score boost,
        // ProductRepository::scoreCandidate). FIFO cap of 5; dedup handled.
        const productId = job?.product?.id;
        const accumulated = typeof productId === 'string' && productId !== ''
          ? addSourceProductId(productId)
          : getSourceProductIds();
        renderSuccess(job, accumulated.length);
        setHint('완료됐어요. 추천 후보에 반영됐어요.', 'ok');
        input.value = '';
      } else if (job.status === 'blocked') {
        hideStatus();
        renderFailure(job.error?.code || 'blocked_url', job.error?.message);
      } else {
        hideStatus();
        renderFailure(job.error?.code || 'extraction_failed', job.error?.message);
      }
    } catch (error) {
      hideStatus();
      if (error instanceof ApiError && (error.status === 401 || error.code === 'unauthenticated')) {
        setHint(ERROR_COPY.unauthenticated, 'warn');
        openAuthModal('login');
      } else if (error instanceof ApiError && error.code === 'rate_limited') {
        renderFailure('rate_limited');
      } else {
        renderFailure(error instanceof ApiError ? error.code : 'unexpected_error', apiErrorMessage(error));
      }
    } finally {
      lockForm(false);
    }
  };

  form.addEventListener('submit', submitHandler);

  return function unmount() {
    cancelled = true;
    form.removeEventListener('submit', submitHandler);
    target.innerHTML = '';
  };
}

async function pollJob(jobId) {
  const deadline = Date.now() + POLL_MAX_MS;
  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);
    try {
      const job = await getCrawlJob(jobId);
      if (!job) return null;
      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'blocked') {
        return job;
      }
    } catch (_) {
      return null;
    }
  }
  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escape(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
