// ========================================
// PickFit Animation Utilities
// ========================================

export function fadeIn(el, duration = 280) {
  el.style.opacity = '0';
  el.style.transform = 'translateY(12px)';
  el.style.transition = `opacity ${duration}ms cubic-bezier(0.2,0.8,0.2,1), transform ${duration}ms cubic-bezier(0.2,0.8,0.2,1)`;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

export function fadeOut(el, duration = 120) {
  return new Promise(resolve => {
    el.style.transition = `opacity ${duration}ms cubic-bezier(0.2,0.8,0.2,1), transform ${duration}ms cubic-bezier(0.2,0.8,0.2,1)`;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(resolve, duration);
  });
}

export function staggerChildren(container, selector, delay = 60) {
  const children = container.querySelectorAll(selector);
  children.forEach((child, i) => {
    child.style.opacity = '0';
    child.style.transform = 'translateY(16px)';
    child.style.transition = `opacity 280ms cubic-bezier(0.2,0.8,0.2,1), transform 280ms cubic-bezier(0.2,0.8,0.2,1)`;
    setTimeout(() => {
      child.style.opacity = '1';
      child.style.transform = 'translateY(0)';
    }, i * delay + 80);
  });
}

export function pulseScale(el) {
  el.style.transition = 'transform 120ms cubic-bezier(0.2,0.8,0.2,1)';
  el.style.transform = 'scale(0.95)';
  setTimeout(() => {
    el.style.transform = 'scale(1)';
  }, 120);
}

export function showToast(message, duration = 2000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'pf-toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exiting');
    setTimeout(() => toast.remove(), 150);
  }, duration);
}
