// ========================================
// 네트워크 연결 상태 배너
// ========================================
// 오프라인이 되면 상단에 슬림 배너를 띄우고, 복구되면 자동으로 내린다.
// 복구 시 onReconnect 콜백(저장 목록 재동기화 등)을 호출해 끊겼던 동기화를 만회한다.

let bannerEl = null;

function ensureBanner() {
  if (bannerEl) return bannerEl;
  bannerEl = document.createElement('div');
  bannerEl.id = 'pf-offline-banner';
  bannerEl.className = 'pf-offline-banner';
  bannerEl.setAttribute('role', 'status');
  bannerEl.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
    <span>인터넷 연결이 끊겼어요. 일부 기능이 제한될 수 있어요.</span>
  `;
  document.body.appendChild(bannerEl);
  return bannerEl;
}

function showBanner() {
  const el = ensureBanner();
  requestAnimationFrame(() => el.classList.add('is-visible'));
}

function hideBanner() {
  if (bannerEl) bannerEl.classList.remove('is-visible');
}

export function initConnectivity({ onReconnect } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    showBanner();
  }

  window.addEventListener('offline', showBanner);
  window.addEventListener('online', () => {
    hideBanner();
    try {
      onReconnect?.();
    } catch (_) {
      /* ignore — reconnect side-effects must not break the handler */
    }
  });
}
