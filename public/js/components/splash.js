// ========================================
// PickFit Splash — brand intro overlay (not a route)
// ========================================
// Lives as a sibling overlay of #screen-container so the first real screen can
// be painted underneath and then revealed by dissolving the splash out. This
// avoids the single-buffered innerHTML swap in navigateTo (which would destroy
// a splash-as-screen before the next screen exists).
//
// Modes:
//   full = true  → first-ever launch: ~2.6s staged logo animation (§5.4 brand
//                  splash = Brand Blue bg + white symbol)
//   full = false → returning/authed: minimal hold that just covers the async
//                  auth check (~0.6s)
//
// Respects prefers-reduced-motion: collapses to a short logo fade, no transform.

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSplash({ full = false } = {}) {
  const host = document.getElementById('app') || document.body;
  const reduced = prefersReducedMotion();
  const useFull = full && !reduced;

  const el = document.createElement('div');
  el.id = 'pf-splash';
  el.className = `spl ${useFull ? 'spl--full' : 'spl--min'}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="spl-lock">
      <div class="spl-markrow">
        <img class="spl-mark" src="img/logo/logo_img.png" alt="" />
        <span class="spl-lime" aria-hidden="true"></span>
      </div>
      <img class="spl-word" src="img/logo/logo_korea.png" alt="픽핏" />
      <p class="spl-tag">내 상황에 맞는 코디를 고르는 가장 빠른 방법</p>
    </div>
  `;
  host.appendChild(el);

  // Minimum on-screen time before we allow the dissolve. Full intro plays its
  // staged keyframes; minimal mode just covers the auth round-trip.
  const introMs = reduced ? 320 : (useFull ? 2500 : 600);
  const minHold = new Promise((resolve) => setTimeout(resolve, introMs));

  function dissolve() {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        el.removeEventListener('transitionend', finish);
        el.remove();
        resolve();
      };
      el.addEventListener('transitionend', finish, { once: true });
      // requestAnimationFrame so the class change always triggers a transition
      requestAnimationFrame(() => el.classList.add('spl--out'));
      // Fallback in case transitionend doesn't fire (reduced-motion, etc.)
      setTimeout(finish, 700);
    });
  }

  return { minHold, dissolve };
}
