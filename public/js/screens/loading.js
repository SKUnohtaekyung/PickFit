// ========================================
// Screen 3: AI Loading State
// ========================================

import { state } from '../utils/state.js';
import { createRecommendationRun } from '../api/recommendations.js';
import { adaptRecommendationResponse } from '../api/recommendationAdapter.js';
import { ApiError, apiErrorMessage } from '../api/client.js';
import { showToast } from '../utils/animations.js';
import { getSourceProductIds } from '../utils/sourceProducts.js';

const LOADING_STEPS = [
  { label: '조건 정리 중…', duration: 1400 },
  { label: '코디 후보 찾는 중…', duration: 1800 },
  { label: '리뷰 요약 중…', duration: 1900 },
  { label: '비교 포인트 정리 중…', duration: 1400 },
];

export function renderLoading(container, { navigateTo }) {
  const ob = state.get('onboarding');

  // Build condition tags
  const conditionTags = buildConditionTags(ob);

  container.innerHTML = `
    <div class="ldg-screen">
      <div class="ldg-ambient" aria-hidden="true">
        <img src="assets/img/Ellipse%202.png" alt="" class="ldg-blob ldg-blob--lime" />
        <img src="assets/img/Ellipse%204.png" alt="" class="ldg-blob ldg-blob--blue-a" />
        <img src="assets/img/Ellipse%205.png" alt="" class="ldg-blob ldg-blob--blue-b" />
      </div>

      <div class="ldg-shell">
        <div class="ldg-logo-row">
          <img src="img/logo/logo_korea.png" alt="픽핏" class="ldg-logo" />
        </div>

        <div class="ldg-hero">
          <span class="ldg-eyebrow">추천 코디를 준비하고 있어요</span>
          <h1 class="ldg-title">
            <span class="ldg-title-line">조건에 맞는</span>
            <span class="ldg-title-line">최적의 코디를</span>
            <span class="ldg-title-line">찾고 있어요</span>
          </h1>
          <p class="ldg-subtitle" id="loading-subtitle">잠시만 기다려주세요</p>
        </div>

        <div class="pf-card ldg-card">
          <div class="ldg-card-head">
             <span class="ldg-card-kicker">준비 현황</span>
             <span id="loading-pct" class="ldg-card-pct">0%</span>
          </div>

          <div class="pf-progress-bar ldg-progress-bar">
            <div class="pf-progress-fill ldg-progress-fill" id="loading-progress" style="width:0%;"></div>
          </div>

          <div id="loading-steps" class="ldg-steps">
            ${LOADING_STEPS.map((s, i) => `
              <div class="pf-step-item ldg-step pending" id="step-${i}">
                <div class="pf-step-icon ldg-step-icon">
                  ${pendingIcon()}
                </div>
                <span class="ldg-step-label">${s.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${conditionTags.length ? `
          <div class="ldg-conditions">
            <p class="ldg-conditions-title">반영된 조건</p>
            <div class="ldg-conditions-tags">
              ${conditionTags.map(t => `
                <span class="ldg-condition-tag">${t}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <button type="button" class="ldg-cancel" id="loading-cancel">취소하고 조건 수정</button>
      </div>
    </div>
  `;

  // Escape hatch: the loading screen hides the bottom nav, so this is the only
  // way out if the recommendation request hangs. Always available.
  container.querySelector('#loading-cancel')?.addEventListener('click', () => {
    navigateTo('onboarding');
  });

  // Run loading animation
  runLoadingSequence(container, navigateTo, ob);
}

function pendingIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>`;
}

// Icons inherit color from the tokenized parent (.pf-step-item.active →
// --pf-cta-blue, .completed → --pf-success) via currentColor — no off-system
// hex literals (design_system.md §18.1).
function activeIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function doneIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`;
}

async function runLoadingSequence(container, navigateTo, ob) {
  const progressBar = container.querySelector('#loading-progress');
  const pctEl = container.querySelector('#loading-pct');
  const subtitle = container.querySelector('#loading-subtitle');
  const stepEls = LOADING_STEPS.map((_, i) => container.querySelector(`#step-${i}`));

  // Fire the real request immediately — the bar tracks ITS lifecycle, not a
  // pre-baked timeline. settled flips the moment the response (success or error)
  // arrives. requestRecommendations never rejects, so the 2nd handler is defensive.
  const apiPromise = requestRecommendations(ob);
  let settled = false;
  apiPromise.then(() => { settled = true; }, () => { settled = true; });

  // Honest progress: creep toward 90% while in flight, slowing as it nears the
  // cap so it never "completes" before the response; snap to 100% on arrival.
  let progress = 6;
  paint(progress);

  const ticker = setInterval(() => {
    if (settled) return;
    progress += Math.max(0.5, (90 - progress) * 0.07);
    if (progress >= 90) {
      progress = 90;
      progressBar?.classList.add('is-indeterminate');
      if (subtitle) subtitle.textContent = '거의 다 됐어요. 추천을 마무리하는 중이에요…';
    }
    paint(progress);
  }, 180);

  function paint(p) {
    const v = Math.round(p);
    if (progressBar) progressBar.style.width = `${v}%`;
    if (pctEl) pctEl.textContent = `${v}%`;
    syncSteps(p);
  }

  // Light up the step list by progress band (cosmetic context, not a clock).
  function syncSteps(p) {
    if (progress >= 90) return; // hold the last step active during the wait
    const cur = p < 25 ? 0 : p < 50 ? 1 : p < 72 ? 2 : 3;
    stepEls.forEach((el, i) => {
      if (!el) return;
      const icon = el.querySelector('.pf-step-icon');
      const label = el.querySelector('.ldg-step-label');
      if (i < cur) {
        el.className = 'pf-step-item ldg-step completed';
        el.style.transform = 'translateX(0)';
        if (icon) icon.innerHTML = doneIcon();
        if (label) label.style.color = '';
      } else if (i === cur) {
        el.className = 'pf-step-item ldg-step active';
        el.style.transform = 'translateX(4px)';
        if (icon) icon.innerHTML = activeIcon();
        if (label) label.style.color = 'var(--pf-ink)';
        if (subtitle) subtitle.textContent = LOADING_STEPS[i].label;
      } else {
        el.className = 'pf-step-item ldg-step pending';
        el.style.transform = '';
        if (icon) icon.innerHTML = pendingIcon();
        if (label) label.style.color = '';
      }
    });
  }

  const apiOutcome = await apiPromise;
  clearInterval(ticker);
  progressBar?.classList.remove('is-indeterminate');

  if (apiOutcome.status === 'success' && apiOutcome.outfits.length >= 3) {
    if (progressBar) progressBar.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    stepEls.forEach((el) => {
      if (!el) return;
      el.className = 'pf-step-item ldg-step completed';
      el.style.transform = 'translateX(0)';
      el.querySelector('.pf-step-icon').innerHTML = doneIcon();
    });
    if (subtitle) subtitle.textContent = '3개의 코디를 준비했어요.';
    state.setRecommendations(apiOutcome.outfits, apiOutcome.source);
    state.set('selectedOutfitId', null);
    state.set('compareOutfitIds', []);
    state.set('lastRunId', apiOutcome.runId || null);
    await delay(650);
    navigateTo('results');
    return;
  }

  if (apiOutcome.status === 'unauthenticated') {
    // Soft gate: the recommendation step is the auth boundary. Hand off to the
    // central session-expiry handler (clears cached auth, routes to the auth
    // screen, and remembers 'loading' as the resume target). The onboarding
    // draft persists in state, so re-login continues the run.
    if (subtitle) subtitle.textContent = '로그인하고 이어서 진행해요.';
    showToast('추천을 받으려면 로그인이 필요해요.');
    await delay(800);
    window.dispatchEvent(new CustomEvent('pickfit:session-expired'));
    return;
  }

  // A genuinely successful run that returned too few outfits is a "not enough
  // candidates" situation, not a server error — surface it with relax-and-retry.
  if (apiOutcome.status === 'success' || apiOutcome.status === 'low_coverage') {
    state.setRecommendations([], 'low_coverage');
    state.set('lastRunId', null);
    showLoadingError(container, navigateTo, ob, {
      subtitle: '조건과 어울리는 후보가 부족해요.',
      message: '지금 조건에 맞는 코디가 충분하지 않아요. 조건을 조금 풀어서 다시 시도해 보세요.',
    });
    return;
  }

  // §19.4 / §20.0 P1: do NOT silently swap in mock results on API failure —
  // that would lie about success and pollute saved/feedback flows. Surface the
  // failure inline with a user-initiated retry instead of auto-bouncing.
  state.setRecommendations([], 'error');
  state.set('lastRunId', null);
  showLoadingError(container, navigateTo, ob, {
    subtitle: '추천을 만들지 못했어요.',
    message: apiOutcome.message || '추천 서버에 잠시 문제가 있어요. 잠시 후 다시 시도하거나 조건을 바꿔 주세요.',
  });
}

// Inline error/recovery card (§15.10) — replaces the steps area with a clear
// message + a primary "다시 시도" (re-runs the whole sequence) and a secondary
// "조건 수정". Replaces the previous silent toast-then-auto-redirect behavior.
function showLoadingError(container, navigateTo, ob, { subtitle, message }) {
  const card = container.querySelector('.ldg-card');
  const subtitleEl = container.querySelector('#loading-subtitle');
  const cancelBtn = container.querySelector('#loading-cancel');
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (cancelBtn) cancelBtn.style.display = 'none';

  if (card) {
    card.innerHTML = `
      <div class="ldg-error">
        <div class="pf-badge-warning ldg-error-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>${escapeText(message)}</span>
        </div>
        <div class="ldg-error-actions">
          <button type="button" class="pf-btn-primary" id="loading-retry">다시 시도</button>
          <button type="button" class="pf-btn-secondary ldg-error-edit" id="loading-edit">조건 수정</button>
        </div>
      </div>
    `;
  }

  container.querySelector('#loading-retry')?.addEventListener('click', () => {
    renderLoading(container, { navigateTo });
  });
  container.querySelector('#loading-edit')?.addEventListener('click', () => {
    navigateTo('onboarding');
  });
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function requestRecommendations(onboarding) {
  try {
    // sourceProductIds: publicIds accumulated by urlAnalyzer.js into
    // sessionStorage. Backend grants +5 score boost per match in
    // ProductRepository::scoreCandidate. Explicit read here (instead of letting
    // recommendations.js silently fall back) so the chain is grep-traceable.
    const sourceIds = getSourceProductIds();
    const response = await createRecommendationRun(buildConditions(onboarding), sourceIds);
    const adapted = adaptRecommendationResponse(response);
    return {
      status: 'success',
      outfits: adapted.outfits,
      source: adapted.source === 'fallback' ? 'fallback-api' : 'api',
      runId: adapted.runId,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'unauthenticated' || error.status === 401) {
        return { status: 'unauthenticated' };
      }
      if (error.code === 'low_catalog_coverage' || error.status === 409) {
        return { status: 'low_coverage' };
      }
      return { status: 'error', message: apiErrorMessage(error) };
    }
    return { status: 'error', message: '추천 서버에 잠시 문제가 있어요.' };
  }
}

function buildConditions(onboarding) {
  return {
    situation: onboarding?.situation ?? null,
    budget: onboarding?.budget ?? null,
    fit: onboarding?.fit ?? null,
    mood: Array.isArray(onboarding?.mood) ? onboarding.mood : [],
    bodyType: Array.isArray(onboarding?.bodyType) ? onboarding.bodyType : [],
    colors: Array.isArray(onboarding?.colors) ? onboarding.colors : [],
    avoidances: Array.isArray(onboarding?.avoidances) ? onboarding.avoidances : [],
    freeText: onboarding?.freeText ?? '',
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildConditionTags(ob) {
  const tags = [];
  const sitMap = { office:'출근룩', date:'소개팅', daily:'데일리', travel:'여행', wedding:'하객룩', rainy:'장마철', interview:'면접', casual:'캐주얼' };
  const budMap = { 'under50k':'~5만 원', '50k-100k':'5~10만 원', '100k-200k':'10~20만 원', 'over200k':'20만 원+' };
  const fitMap = { slim:'슬림핏', regular:'레귤러', oversized:'오버사이즈', relaxed:'릴랙스드', straight:'스트레이트' };
  const moodMap = { minimal:'미니멀', casual:'캐주얼', street:'스트릿', classic:'클래식', feminine:'페미닌', clean:'클린', soft:'소프트', chic:'시크' };

  if (ob.situation && sitMap[ob.situation]) tags.push(sitMap[ob.situation]);
  if (ob.budget && budMap[ob.budget]) tags.push(budMap[ob.budget]);
  if (ob.fit && fitMap[ob.fit]) tags.push(fitMap[ob.fit]);
  ob.mood?.slice(0, 2).forEach(m => { if (moodMap[m]) tags.push(moodMap[m]); });
  if (ob.bodyType?.length) tags.push('체형 고민 반영');

  return tags;
}
