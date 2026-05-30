// ========================================
// Home — Editorial dashboard (authed entry hub)
// ========================================
// Personal-stylist dashboard: time-aware greeting + big editorial headline, one
// Brand-Blue "start" card (the single brand-highlight the design system allows),
// a horizontal situation quick-start rail (tap → straight into onboarding), an
// image-forward "내 코디" rail (resume / saved thumbnails), and a compact trust
// line. Layout/structure only — colors & tokens unchanged.

import { state } from '../utils/state.js';
import { getAuthUser } from '../components/authModal.js';
import { SITUATIONS } from '../data/enums.js';
import { resolveProductFromItem, resolveOutfitFromSaved } from '../utils/resolvers.js';

export function renderHome(container, { navigateTo } = {}) {
  const user = getAuthUser();
  const name = greetingName(user);
  const recs = state.get('recommendations') || [];
  const hasRun = Array.isArray(recs) && recs.length > 0;
  const saved = state.get('saved') || [];
  const savedCount = saved.length;

  const savedThumbs = saved.slice(0, 3).map((s) => firstImage(resolveOutfitFromSaved(s))).filter(Boolean);
  const resumeThumbs = recs.slice(0, 3).map((o) => firstImage(o)).filter(Boolean);

  container.innerHTML = `
    <div class="home-screen">
      <div class="lnd-ambient" aria-hidden="true">
        <img src="assets/img/Ellipse%202.png" alt="" class="lnd-blob lnd-blob--lime" />
      </div>

      <header class="home-topbar">
        <img src="img/logo/logo_img.png" class="home-mark" alt="픽핏" />
        <button type="button" class="lnd-account" id="home-account" aria-label="내 정보">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6"/></svg>
        </button>
      </header>

      <section class="home-hero-ed">
        <p class="home-greeting"><strong>${escapeText(name)}</strong>님, ${timeGreeting()}</p>
        <h1 class="home-display">오늘 뭐 입지?</h1>
      </section>

      <button type="button" class="home-start-card" id="home-start">
        <span class="home-start-mark" aria-hidden="true"></span>
        <span class="home-start-body">
          <span class="home-start-kicker"><span class="home-start-dot" aria-hidden="true"></span>AI 스타일리스트</span>
          <span class="home-start-title">상황만 고르면<br>3분 안에 코디 완성</span>
        </span>
        <span class="home-start-cta">상황 고르기
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </span>
      </button>

      <section class="home-sec" aria-label="상황 바로 시작">
        <div class="home-sec-head">
          <h2 class="home-sec-title">바로 시작</h2>
          <button type="button" class="home-sec-link" id="home-all-situations">전체 보기</button>
        </div>
        <div class="home-sit-rail">
          ${SITUATIONS.map((s) => `
            <button type="button" class="home-sit-card" data-situation="${s.id}">
              <span class="home-sit-emoji" aria-hidden="true">${s.emoji}</span>
              <span class="home-sit-label">${s.label}</span>
            </button>
          `).join('')}
        </div>
      </section>

      ${hasRun || savedCount > 0 ? `
        <section class="home-sec" aria-label="내 코디">
          <div class="home-sec-head"><h2 class="home-sec-title">내 코디</h2></div>
          <div class="home-mine">
            ${hasRun ? mineCard('home-resume', resumeThumbs, '지난 추천 결과', `코디 ${recs.length}개 이어보기`) : ''}
            ${savedCount > 0 ? mineCard('home-saved', savedThumbs, '저장한 코디', `${savedCount}개 다시 보기`) : ''}
          </div>
        </section>
      ` : ''}

      <p class="home-trust-mini">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        리뷰·체형·예산을 반영하고, 추천 이유까지 함께 보여드려요
      </p>

      <div class="lnd-bottom-space" aria-hidden="true"></div>
    </div>
  `;

  container.querySelector('#home-account')?.addEventListener('click', () => navigateTo?.('account'));
  container.querySelector('#home-start')?.addEventListener('click', () => navigateTo?.('landing'));
  container.querySelector('#home-all-situations')?.addEventListener('click', () => navigateTo?.('landing'));
  container.querySelector('#home-resume')?.addEventListener('click', () => navigateTo?.('results'));
  container.querySelector('#home-saved')?.addEventListener('click', () => navigateTo?.('saved'));

  // Situation quick-start: skip the picker, jump straight into onboarding with
  // the chosen situation (fresh run, situation kept) — same contract as the 추천
  // screen's in-flow CTA.
  container.querySelectorAll('.home-sit-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const situation = btn.dataset.situation;
      state.resetOnboarding();
      state.update('onboarding', (next) => ({ ...next, situation, freeText: '' }));
      navigateTo?.('onboarding');
    });
  });
}

function mineCard(id, thumbs, label, sub) {
  const tiles = (thumbs.length ? thumbs : [null, null, null]).slice(0, 3).map((src) => `
    <span class="home-thumb">${src ? `<img src="${escapeAttr(src)}" alt="" loading="lazy" />` : ''}</span>
  `).join('');
  return `
    <button type="button" class="home-card" id="${id}">
      <span class="home-thumbs" aria-hidden="true">${tiles}</span>
      <span class="home-card-meta">
        <span class="home-card-label">${label}</span>
        <span class="home-card-sub">${sub}</span>
      </span>
      <svg class="home-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  `;
}

function firstImage(outfit) {
  for (const item of (outfit?.items || [])) {
    const product = item?.product || resolveProductFromItem(item);
    if (product?.image) return product.image;
  }
  return null;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '늦은 밤이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '좋은 오후예요';
  return '좋은 저녁이에요';
}

function greetingName(user) {
  const display = user?.displayName?.trim();
  if (display) return display;
  const email = user?.email?.trim();
  if (email) return email.split('@')[0];
  return '회원';
}

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
