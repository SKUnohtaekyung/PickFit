// ========================================
// 코디 저장(하트) 컨트롤 공용 모듈
// ========================================
// results/detail 화면이 동일하게 쓰던 하트 아이콘 + 저장 토글 UI를 한 곳으로 모음.
// 생성 마크업과 DOM 동작은 기존 화면별 구현과 100% 동일하게 유지한다.

import { state } from '../utils/state.js';

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
