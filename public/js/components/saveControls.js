// ========================================
// 코디 저장(하트) 컨트롤 공용 모듈
// ========================================
// results/detail 화면이 동일하게 쓰던 하트 아이콘 + 저장 토글 UI를 한 곳으로 모음.
// 생성 마크업과 DOM 동작은 기존 화면별 구현과 100% 동일하게 유지한다.

import { state } from '../utils/state.js';
import { persistToggleSaved } from '../api/userActions.js';
import { showToast } from '../utils/animations.js';

export function heartIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;
}

export function savedHeartIcon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  `;
}

export function renderSaveIcon(isSaved) {
  return isSaved ? savedHeartIcon() : heartIcon();
}

export function renderSaveText(isSaved) {
  return `
    ${isSaved ? savedHeartIcon() : heartIcon()}
    <span>${isSaved ? '저장됨' : '코디 저장'}</span>
  `;
}

// 서버 동기화가 진행 중인 outfit id 집합. 진행 중에는 같은 코디의 추가 토글을
// 무시해, 낙관적 변경과 롤백 사이에 다른 토글이 끼어 "현재 상태 토글"이 엉뚱한
// 방향으로 원복되는 레이스를 막는다.
const pendingSaves = new Set();

// 저장 버튼 클릭의 단일 진입점: 낙관적 토글 → UI 동기화 → 서버 반영 →
// 실패 시 정확히 직전 변경만 원복. results/detail가 공통으로 사용한다.
export function toggleSaveFromClick(root, outfit) {
  const id = outfit?.id;
  if (!id) return;
  if (pendingSaves.has(id)) return; // 직전 토글의 서버 응답을 기다리는 중이면 무시

  const justSaved = state.toggleSaved(id, outfit);
  syncSaveControls(root, id);
  showToast(justSaved ? '코디를 저장했어요.' : '저장을 해제했어요.');

  pendingSaves.add(id);
  persistToggleSaved(outfit, justSaved).then((result) => {
    if (result.status === 'unauthenticated') {
      showToast('로그인하면 저장이 동기화돼요.');
    } else if (result.status === 'api-error') {
      // 진행 중 재클릭을 막았으므로 현재 상태 == 낙관적 상태 → toggleSaved 1회로 정확히 원복.
      state.toggleSaved(id, outfit);
      syncSaveControls(root, id);
      showToast(justSaved
        ? '저장에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : '저장 해제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  }).finally(() => {
    pendingSaves.delete(id);
  });
}

// 같은 outfit의 저장 버튼(아이콘/텍스트 변형)을 현재 저장 상태로 동기화
export function syncSaveControls(root, outfitId) {
  const isSaved = state.isSaved(outfitId);

  root.querySelectorAll(`[data-save-outfit="${outfitId}"]`).forEach((button) => {
    const variant = button.dataset.saveVariant;
    button.classList.toggle('is-saved', isSaved);
    button.setAttribute('aria-label', isSaved ? '저장됨' : '코디 저장');
    button.setAttribute('aria-pressed', String(isSaved));

    if (variant === 'icon') {
      button.innerHTML = renderSaveIcon(isSaved);
      return;
    }

    button.innerHTML = renderSaveText(isSaved);
  });
}
