// ========================================
// Screen 3: AI Loading State
// ========================================

import { state } from '../utils/state.js';
import { OUTFITS } from '../data/mock.js';

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
          <span class="ldg-eyebrow">AI Analysis in progress</span>
          <h1 class="ldg-title">
            <span class="ldg-title-line">조건에 맞는</span>
            <span class="ldg-title-line">최적의 코디를</span>
            <span class="ldg-title-line">찾고 있어요</span>
          </h1>
          <p class="ldg-subtitle" id="loading-subtitle">잠시만 기다려주세요</p>
        </div>

        <div class="pf-card ldg-card">
          <div class="ldg-card-head">
             <span class="ldg-card-kicker">AI STATUS</span>
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
      </div>
    </div>
  `;

  // Run loading animation
  runLoadingSequence(container, navigateTo, ob);
}

function pendingIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/></svg>`;
}

function activeIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4D5EFF" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
}

function doneIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F8A4D" stroke-width="2.5"><circle cx="12" cy="12" r="10" fill="#EAF7EF" stroke="#1F8A4D"/><polyline points="9 12 11 14 15 10"/></svg>`;
}

async function runLoadingSequence(container, navigateTo, ob) {
  const progressBar = container.querySelector('#loading-progress');
  const subtitle = container.querySelector('#loading-subtitle');
  let elapsed = 0;
  const total = LOADING_STEPS.reduce((sum, s) => sum + s.duration, 0) + 1000;

  for (let i = 0; i < LOADING_STEPS.length; i++) {
    const step = LOADING_STEPS[i];
    const stepEl = container.querySelector(`#step-${i}`);
    if (!stepEl) break;

    // Mark as active
    stepEl.className = 'pf-step-item ldg-step active';
    stepEl.style.transform = 'translateX(4px)';
    stepEl.querySelector('.ldg-step-label').style.color = 'var(--pf-ink)';
    stepEl.querySelector('.pf-step-icon').innerHTML = activeIcon();
    subtitle.textContent = step.label;

    // Update progress
    elapsed += step.duration;
    const pct = Math.round((elapsed / total) * 90);
    if (progressBar) progressBar.style.width = `${pct}%`;
    const pctEl = container.querySelector('#loading-pct');
    if (pctEl) pctEl.textContent = `${pct}%`;

    await delay(step.duration);

    // Mark as done
    if (stepEl) {
      stepEl.className = 'pf-step-item ldg-step completed';
      stepEl.style.transform = 'translateX(0)';
      stepEl.querySelector('.pf-step-icon').innerHTML = doneIcon();
    }
  }

  // Done!
  if (progressBar) progressBar.style.width = '100%';
  if (subtitle) subtitle.textContent = '3개의 코디를 준비했어요.';

  // Set mock recommendations
  state.set('recommendations', OUTFITS);

  await delay(900);

  // Navigate to results
  navigateTo('results');
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
