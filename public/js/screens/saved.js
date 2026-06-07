// ========================================
// Screen 7: Saved / Feedback
// Phase 1 refactor — token-first .sv-* classes (no inline hex / sizes).
// Behavior, routing, persistence, and state contracts are unchanged.
// ========================================

import { state } from '../utils/state.js';
import { showToast, staggerChildren } from '../utils/animations.js';
import { persistFeedback, persistToggleSaved, syncSavedFromApi } from '../api/userActions.js';
import { resolveOutfitFromSaved } from '../utils/resolvers.js';
import { escapeHtml as ee } from '../utils/escape.js';
import { getAuthUser } from '../components/authModal.js';

const FEEDBACK_CHIPS = [
  { id: 'liked', emoji: '👍', label: '좋았어요' },
  { id: 'too_expensive', emoji: '💸', label: '너무 비싸요' },
  { id: 'too_basic', emoji: '😐', label: '너무 기본적' },
  { id: 'too_flashy', emoji: '✨', label: '너무 화려해요' },
  { id: 'too_slim', emoji: '📏', label: '너무 타이트' },
  { id: 'not_my_taste', emoji: '🎨', label: '취향 아니에요' },
  { id: 'show_more', emoji: '🔄', label: '비슷한 거 더' },
  { id: 'not_flattering', emoji: '🪞', label: '체형에 안맞아' },
];

// 저장 코디를 그룹핑할 상황 라벨(추천 run의 conditions.situation 값 기준).
const SITUATION_LABELS = {
  office: '출근룩',
  date: '소개팅',
  daily: '데일리',
  travel: '여행',
  wedding: '하객룩',
  rainy: '장마철',
  interview: '면접',
  casual: '캐주얼',
};

// 저장 항목을 상황별 그룹으로 묶는다. 저장 목록은 이미 최신순이라 그룹 등장 순서도
// 최신 그룹이 위로 온다. 상황값이 없거나 미정의면 "그 외 코디"로 모은다.
function groupBySituation(savedOutfits) {
  const groups = new Map();
  savedOutfits.forEach((entry) => {
    const known = entry.situation && SITUATION_LABELS[entry.situation];
    const key = known ? entry.situation : '_other';
    if (!groups.has(key)) {
      groups.set(key, { key, label: known ? SITUATION_LABELS[key] : '그 외 코디', entries: [] });
    }
    groups.get(key).entries.push(entry);
  });
  return [...groups.values()];
}

// 저장 카드 목록을 렌더. 비교 모드에선 평면(그룹 헤더 없이), 일반 모드에선 상황별 그룹.
// 그룹이 하나뿐이면 헤더를 숨겨 불필요한 위계를 만들지 않는다(Calm Density).
function renderSavedList(savedOutfits, compareMode, selection) {
  if (compareMode) {
    return savedOutfits
      .map((entry) => renderSavedCard(entry, true, selection.includes(entry.id)))
      .join('');
  }
  const groups = groupBySituation(savedOutfits);
  const showHeaders = groups.length > 1;
  return groups.map((group) => `
    ${showHeaders ? `
      <div class="sv-group-head">
        <span class="sv-group-title">${ee(group.label)}</span>
        <span class="sv-group-count">${group.entries.length}개</span>
      </div>` : ''}
    ${group.entries.map((entry) => renderSavedCard(entry, false, false)).join('')}
  `).join('');
}

// 현재 화면의 비교 모드 상태(모드 on/off + 선택 목록)를 모듈 스코프에 보관한다.
// 백그라운드 syncSavedFromApi 응답이 늦게 도착해 재렌더할 때 이 값을 다시 넘겨야
// 진행 중이던 비교 모드와 선택이 일반 모드 렌더로 초기화되지 않는다.
let activeCompare = { mode: false, selection: [] };

export function renderSaved(container, { navigateTo }) {
  renderSavedView(container, { navigateTo });
  syncSavedFromApi().then((result) => {
    // 동기화 결과로 다시 그릴 때도 현재 비교 모드/선택을 보존해서 넘긴다.
    if (result.source === 'api') {
      renderSavedView(container, { navigateTo, compareMode: activeCompare.mode, compareSelection: activeCompare.selection });
    } else if (result.error && getAuthUser()) {
      // Logged-in but the server list failed to load — don't present the local
      // (possibly empty) state as confirmed. Surface a retry so the user doesn't
      // think their saved coordis are gone and re-save duplicates.
      renderSavedView(container, { navigateTo, syncFailed: true, compareMode: activeCompare.mode, compareSelection: activeCompare.selection });
    }
  }).catch(() => {});
}

function renderSavedView(container, { navigateTo, syncFailed = false, compareMode = false, compareSelection = [] }) {
  const savedList = state.get('saved') || [];
  const savedOutfits = savedList
    .map((s) => ({ ...s, outfit: resolveOutfitFromSaved(s) }))
    .filter((s) => s.outfit);

  // 비교 모드인데 저장 코디가 2개 미만이면 비교가 불가능하므로 일반 모드로 되돌린다.
  if (compareMode && savedOutfits.length < 2) {
    compareMode = false;
    compareSelection = [];
  }
  // 삭제된 항목이 선택 목록에 남지 않도록 현재 저장 목록 기준으로 정리한다.
  const validIds = new Set(savedOutfits.map((s) => s.id));
  const selection = compareSelection.filter((id) => validIds.has(id));

  // 늦게 도착하는 sync 재렌더가 보존할 수 있도록 최신 비교 상태를 기록.
  activeCompare = { mode: compareMode, selection };

  let selectedFeedback = [];

  container.innerHTML = `
    <div class="sv-screen">
      <div class="sv-shell">
        ${syncFailed ? renderSyncErrorBanner() : ''}
        <header class="sv-header">
          <div class="sv-header-copy">
            <p class="sv-header-kicker">PICKFIT SAVED</p>
            <h1 class="sv-header-title">${compareMode ? '비교할 코디 선택' : '저장한 코디'}</h1>
          </div>
          <div class="sv-header-actions">
            ${savedOutfits.length > 0
              ? `<span class="sv-header-count">${savedOutfits.length}개</span>`
              : ''}
            ${savedOutfits.length >= 2
              // 저장 코디가 2개 이상일 때만 비교 진입/취소 버튼을 노출한다.
              ? (compareMode
                  ? `<button type="button" id="sv-cancel-compare" class="sv-compare-toggle is-active">취소</button>`
                  : `<button type="button" id="sv-start-compare" class="sv-compare-toggle">비교</button>`)
              : ''}
          </div>
        </header>

        ${savedOutfits.length > 0
          ? `<section class="sv-list" id="saved-list">
              ${renderSavedList(savedOutfits, compareMode, selection)}
            </section>`
          : renderEmptyState()}

        ${compareMode
          // 비교 모드에서는 피드백/새 추천 영역 대신 하단에 "비교하기" 액션 바만 보여준다.
          ? renderCompareBar(selection)
          : `
        <div class="sv-divider" aria-hidden="true"></div>

        <section class="sv-feedback-section">
          <div class="sv-feedback-head">
            <span class="sv-feedback-kicker">QUICK FEEDBACK</span>
            <h2 class="sv-feedback-title">최근 추천은 어떠셨나요?</h2>
            <p class="sv-feedback-desc">피드백을 남기면 다음 추천이 더 정확해져요.</p>
          </div>

          <div id="feedback-grid" class="sv-feedback-grid">
            ${FEEDBACK_CHIPS.map((fc) => `
              <button type="button" class="pf-feedback-chip" data-fb="${ee(fc.id)}">
                <span class="fb-emoji" aria-hidden="true">${fc.emoji}</span>
                <span class="fb-label">${ee(fc.label)}</span>
              </button>
            `).join('')}
          </div>

          <button type="button" id="submit-feedback-btn" class="sv-feedback-submit" disabled>
            피드백 보내기
          </button>
        </section>

        <button type="button" id="new-rec-btn" class="sv-new-rec">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.62"/>
          </svg>
          새 추천 시작하기
        </button>
        `}
      </div>
    </div>
  `;

  staggerChildren(container, '.sv-card', 60);

  container.querySelector('#sv-retry-sync')?.addEventListener('click', () => {
    renderSaved(container, { navigateTo });
  });

  bindViewButtons(container, navigateTo);
  bindDeleteButtons(container, navigateTo);
  bindEmptyCta(container, navigateTo);
  bindFeedback(container);
  bindNewRec(container, navigateTo);

  // 비교 모드 상호작용: 카드 탭으로 선택(최대 3개), 하단 바로 비교 진입.
  if (compareMode) {
    container.querySelectorAll('[data-select-outfit]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.selectOutfit;
        let next;
        if (selection.includes(id)) {
          next = selection.filter((s) => s !== id);
        } else {
          if (selection.length >= 3) {
            showToast('최대 3개까지 비교할 수 있어요.');
            return;
          }
          next = [...selection, id];
        }
        // 선택이 바뀔 때마다 같은 모드로 다시 그려 선택 상태/카운트를 반영한다.
        renderSavedView(container, { navigateTo, compareMode: true, compareSelection: next });
      });
    });
    container.querySelector('#sv-do-compare')?.addEventListener('click', () => {
      if (selection.length < 2) return;
      // 비교 화면은 compareOutfitIds로 outfit을 resolve(저장분 포함)하므로 id만 넘긴다.
      state.set('compareOutfitIds', selection.slice(0, 3));
      navigateTo('comparison');
    });
    container.querySelector('#sv-cancel-compare')?.addEventListener('click', () => {
      renderSavedView(container, { navigateTo });
    });
  } else {
    container.querySelector('#sv-start-compare')?.addEventListener('click', () => {
      renderSavedView(container, { navigateTo, compareMode: true, compareSelection: [] });
    });
  }

  function bindFeedback(root) {
    const submitBtn = root.querySelector('#submit-feedback-btn');

    root.querySelectorAll('.pf-feedback-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.fb;
        if (selectedFeedback.includes(id)) {
          selectedFeedback = selectedFeedback.filter((s) => s !== id);
          chip.classList.remove('selected');
        } else {
          selectedFeedback.push(id);
          chip.classList.add('selected');
        }
        if (submitBtn) submitBtn.disabled = selectedFeedback.length === 0;
      });
    });

    submitBtn?.addEventListener('click', () => {
      state.addFeedback(selectedFeedback);
      const feedbackType = selectedFeedback.length === 1 ? selectedFeedback[0] : 'general';
      const tags = selectedFeedback.length === 1 ? [] : [...selectedFeedback];
      selectedFeedback = [];
      root.querySelectorAll('.pf-feedback-chip').forEach((c) => c.classList.remove('selected'));
      submitBtn.disabled = true;
      showToast('피드백 감사해요. 다음 추천에 반영할게요.');
      persistFeedback({ feedbackType, tags }).then((result) => {
        if (result.status === 'unauthenticated') {
          showToast('로그인하면 피드백이 동기화돼요.');
        } else if (result.status === 'api-error') {
          showToast('피드백 서버 반영에 실패했어요.');
        }
      });
    });
  }
}

function renderSavedCard({ outfit, savedAt, id }, compareMode = false, isSelected = false) {
  const dateLabel = new Date(savedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  const priceLabel = `${outfit.totalPrice.toLocaleString()}원`;

  // 비교 모드: 보기/삭제 대신 선택 체크 표시를 보여주고, 카드 전체가 선택 토글이 된다.
  const actions = compareMode
    ? `<span class="sv-select-indicator ${isSelected ? 'is-on' : ''}" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>`
    : `<div class="sv-card-actions">
        <button type="button" class="sv-view-btn" data-view-outfit="${ee(id)}">
          보기
        </button>
        <button type="button" class="sv-delete-btn" data-delete-outfit="${ee(id)}" aria-label="저장 해제">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>`;

  return `
    <article class="pf-card sv-card ${compareMode ? 'is-selectable' : ''} ${isSelected ? 'is-selected' : ''}"
      data-outfit="${ee(id)}"
      ${compareMode ? `data-select-outfit="${ee(id)}" role="button" aria-pressed="${isSelected}"` : ''}>
      <span class="sv-card-accent" aria-hidden="true"></span>
      <div class="sv-card-body">
        <div class="sv-card-text">
          <span class="sv-card-frame">${ee(outfit.framingLabel)}</span>
          <p class="sv-card-title">${ee(outfit.title)}</p>
          <p class="sv-card-meta">
            <span>${ee(dateLabel)} 저장</span>
            <span class="sv-card-meta-sep" aria-hidden="true">·</span>
            <span>${ee(priceLabel)}</span>
          </p>
        </div>
        ${actions}
      </div>
    </article>
  `;
}

// 비교 모드 하단 바: 선택 개수 안내 + "비교하기"(2개 이상일 때 활성).
function renderCompareBar(selection) {
  const count = selection.length;
  const ready = count >= 2;
  return `
    <div class="sv-compare-bar" role="status">
      <span class="sv-compare-count">${ready ? `${count}개 선택됨` : '2개 이상 선택해 주세요'}</span>
      <button type="button" id="sv-do-compare" class="sv-compare-go" ${ready ? '' : 'disabled'}>
        비교하기${ready ? ` (${count})` : ''}
      </button>
    </div>
  `;
}

function renderSyncErrorBanner() {
  return `
    <div class="sv-sync-error" role="status">
      <div class="sv-sync-error-copy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>저장 목록을 불러오지 못했어요. 아래는 최신이 아닐 수 있어요.</span>
      </div>
      <button type="button" id="sv-retry-sync" class="sv-sync-retry">다시 시도</button>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="sv-empty">
      <div class="sv-empty-icon" aria-hidden="true">🪄</div>
      <p class="sv-empty-title">아직 저장한 코디가 없어요</p>
      <p class="sv-empty-desc">추천받은 코디에서 하트를 눌러<br/>마음에 드는 코디를 저장해보세요.</p>
      <button type="button" id="go-landing-empty" class="sv-empty-cta">추천 받으러 가기</button>
    </div>
  `;
}

function bindViewButtons(container, navigateTo) {
  container.querySelectorAll('[data-view-outfit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.set('selectedOutfitId', btn.dataset.viewOutfit);
      navigateTo('detail');
    });
  });
}

function bindDeleteButtons(container, navigateTo) {
  container.querySelectorAll('[data-delete-outfit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // 연타 가드: 삭제 요청이 진행 중인 카드의 버튼을 즉시 비활성화해, 응답 대기 중
      // 재클릭이 낙관적 제거를 또 토글(=재추가)하는 롤백 레이스를 막는다.
      if (btn.disabled) return;
      btn.disabled = true;
      const id = btn.dataset.deleteOutfit;
      const entry = state.findSavedEntry(id);
      const outfit = entry?.outfit || null;
      state.toggleSaved(id, outfit);
      const card = container.querySelector(`.sv-card[data-outfit="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.2s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          card.remove();
          showToast('저장이 해제되었습니다.');
          const remaining = container.querySelectorAll('.sv-card');
          if (remaining.length === 0) {
            renderSavedView(container, { navigateTo });
          }
        }, 200);
      }
      persistToggleSaved(outfit || { id }, false).then((result) => {
        if (result.status === 'api-error') {
          // 서버 삭제 실패 — 낙관적 제거를 되돌려 카드를 복원한다(되돌리지 않으면
          // 화면엔 사라졌지만 서버엔 남아 다음 동기화 때 되살아나 혼란을 준다).
          state.toggleSaved(id, outfit);
          renderSavedView(container, { navigateTo });
          showToast('서버 동기화에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
      });
    });
  });
}

function bindEmptyCta(container, navigateTo) {
  container.querySelector('#go-landing-empty')?.addEventListener('click', () => navigateTo('landing'));
}

function bindNewRec(container, navigateTo) {
  container.querySelector('#new-rec-btn')?.addEventListener('click', () => {
    state.resetOnboarding();
    navigateTo('landing');
  });
}
