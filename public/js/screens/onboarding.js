// ========================================
// Screen 2: Onboarding Quick Interview
// ========================================

import { BUDGETS, MOODS, FITS, BODY_TYPES, COLORS_PREF, AVOIDANCES } from '../data/enums.js';
import { state } from '../utils/state.js';
import { staggerChildren, showToast } from '../utils/animations.js';

const STEPS = [
  {
    id: 'budget',
    question: '예산은 어느 정도 생각하세요?',
    displayLines: ['예산은 어느 정도', '생각하세요?'],
    sub: '전체 코디 기준 예산이에요',
    type: 'single',
    options: BUDGETS,
    key: 'budget',
    required: true,
    skipLabel: null,
  },
  {
    id: 'mood',
    question: '원하는 스타일 무드를 골라주세요',
    displayLines: ['원하는 스타일 무드를', '골라주세요'],
    sub: '최대 3가지까지 선택 가능해요',
    type: 'multi',
    max: 3,
    options: MOODS,
    key: 'mood',
    required: true,
    skipLabel: null,
  },
  {
    id: 'fit',
    question: '선호하는 핏은 무엇인가요?',
    displayLines: ['선호하는 핏은', '무엇인가요?'],
    sub: '평소에 즐겨 입는 실루엣을 선택해주세요',
    type: 'single',
    options: FITS,
    key: 'fit',
    required: true,
    skipLabel: null,
  },
  {
    id: 'bodyType',
    question: '체형 고민이 있다면 알려주세요',
    displayLines: ['체형 고민이 있다면', '알려주세요'],
    sub: '최대 2가지까지 선택할 수 있어요',
    type: 'multi',
    max: 2,
    options: BODY_TYPES,
    key: 'bodyType',
    required: false,
    skipLabel: '특별한 고민 없어요',
  },
  {
    id: 'colors',
    question: '자주 입는 색상을 알려주세요',
    displayLines: ['자주 입는 색상을', '알려주세요'],
    sub: '좋아하는 컬러를 선택해주세요',
    type: 'color',
    options: COLORS_PREF,
    key: 'colors',
    required: false,
    skipLabel: '색상 상관없어요',
  },
  {
    id: 'avoidances',
    question: '피하고 싶은 것이 있나요?',
    displayLines: ['피하고 싶은 것이', '있나요?'],
    sub: '불편하거나 싫어하는 요소를 선택해주세요',
    type: 'multi',
    options: AVOIDANCES,
    key: 'avoidances',
    required: false,
    skipLabel: '특별히 없어요',
  },
];

export function renderOnboarding(container, { navigateTo }) {
  const onboarding = state.get('onboarding');
  // If situation was selected on landing, we start from step 1 (budget)
  // Total steps = 1 (situation from landing) + 6 = 7 steps
  const totalSteps = STEPS.length + 1; // +1 for situation step (already done)
  let currentStep = 0;

  function render() {
    const step = STEPS[currentStep];
    const ob = state.get('onboarding');
    const stepNum = currentStep + 2; // Step 1 was situation on landing
    const progress = ((stepNum) / totalSteps) * 100;
    const hasSkipAction = !step.required && Boolean(step.skipLabel);

    container.innerHTML = `
      <div class="onb-screen ${hasSkipAction ? 'has-skip-action' : ''}">
        <div class="onb-ambient" aria-hidden="true">
          <img src="assets/img/Ellipse%202.png" alt="" class="onb-blob onb-blob--lime" />
          <img src="assets/img/Ellipse%204.png" alt="" class="onb-blob onb-blob--blue-a" />
          <img src="assets/img/Ellipse%205.png" alt="" class="onb-blob onb-blob--blue-b" />
        </div>

        <div class="onb-shell">
          <header class="onb-progress-card">
            <button id="back-btn" class="onb-back-btn" aria-label="이전 단계">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>
            <div class="onb-progress-body">
              <div class="pf-progress-bar onb-progress-bar">
                <div class="pf-progress-fill onb-progress-fill" style="width:${progress}%;"></div>
              </div>
              <div class="onb-progress-meta">
                <span class="onb-progress-step">STEP ${stepNum}</span>
                <span class="onb-progress-pct">${Math.round(progress)}%</span>
              </div>
            </div>
          </header>

          <section class="onb-question-wrap step-content">
            <span class="onb-eyebrow">Question ${stepNum}</span>
            <h1 class="onb-title">${renderQuestionTitle(step)}</h1>
            <p class="onb-subtitle">${step.sub}</p>

            <div id="options-container" class="onb-options">
              ${renderOptions(step, ob)}
            </div>
          </section>
        </div>

        <div class="onb-footer">
          <div class="onb-footer-inner">
            <div id="summary-area" class="onb-summary-area">
              ${renderConditionSummary(ob)}
            </div>

            <button id="next-btn" class="pf-btn-primary onb-next-btn" ${isNextEnabled(step, ob) ? '' : 'disabled'}>
              <span class="onb-next-balance" aria-hidden="true"></span>
              <span class="onb-next-label">${currentStep < STEPS.length - 1 ? '다음 단계로' : '코디 추천받기'}</span>
              <span class="onb-next-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </span>
            </button>

            ${hasSkipAction ? `
              <button id="skip-btn" class="pf-btn-ghost onb-skip-btn">
                ${step.skipLabel}
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Stagger animate options
    staggerChildren(container, '.onb-chip', 30);

    bindEvents(step, ob);
  }

  function renderOptions(step, ob) {
    const selected = ob[step.key] || (step.type === 'single' ? null : []);

    if (step.type === 'color') {
      return `
        <div class="onb-color-grid">
          ${step.options.map(opt => {
            const isSelected = Array.isArray(selected) && selected.includes(opt.id);
            return `
              <button type="button" class="pf-chip onb-chip onb-color-chip ${isSelected ? 'selected' : ''}" data-value="${opt.id}">
                <span class="onb-color-swatch" style="--onb-swatch:${opt.hex};"></span>
                <span class="onb-color-label">${opt.label}</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="onb-chip-grid">
        ${step.options.map(opt => {
          const isSelected = step.type === 'single'
            ? selected === opt.id
            : (Array.isArray(selected) && selected.includes(opt.id));
          return `
            <button type="button" class="pf-chip onb-chip ${isSelected ? 'selected' : ''}" data-value="${opt.id}">
               ${opt.label}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderConditionSummary(ob) {
    const tags = [];
    if (ob.situation) {
      const s = ['office','date','daily','travel','wedding','rainy','interview','casual'];
      const l = ['출근룩','소개팅','데일리','여행','하객룩','장마철','면접','캐주얼'];
      const idx = s.indexOf(ob.situation);
      if (idx >= 0) tags.push(l[idx]);
    }
    if (ob.budget) {
      const bl = { 'under50k':'~5만', '50k-100k':'5~10만', '100k-200k':'10~20만', 'over200k':'20만+' };
      if (bl[ob.budget]) tags.push(bl[ob.budget]);
    }
    ob.mood?.forEach(m => {
      const ml = { minimal:'미니멀', casual:'캐주얼', street:'스트릿', classic:'클래식', feminine:'페미닌', clean:'클린', soft:'소프트', chic:'시크' };
      if (ml[m]) tags.push(ml[m]);
    });
    if (ob.fit) {
      const fl = { slim:'슬림', regular:'레귤러', oversized:'오버사이즈', relaxed:'릴랙스드', straight:'스트레이트' };
      if (fl[ob.fit]) tags.push(fl[ob.fit]);
    }
    ob.colors?.slice(0, 2).forEach((colorId) => {
      const color = COLORS_PREF.find((item) => item.id === colorId);
      if (color) tags.push(color.label);
    });

    if (!tags.length) return '';

    return `
      <div class="pf-card onb-summary-card">
        <p class="onb-summary-title">선택된 조건</p>
        <div class="onb-summary-tags">
          ${tags.map(t => `<span class="onb-summary-tag">${t}</span>`).join('')}
        </div>
      </div>
    `;
  }

  function isNextEnabled(step, ob) {
    if (!step.required) return true;
    const val = ob[step.key];
    if (step.type === 'single') return !!val;
    return Array.isArray(val) && val.length > 0;
  }

  function bindEvents(step, ob) {
    // Back button
    const backBtn = container.querySelector('#back-btn');
    backBtn?.addEventListener('click', () => {
      if (currentStep === 0) {
        navigateTo('landing');
      } else {
        currentStep--;
        render();
      }
    });

    // Option chips
    container.querySelectorAll('[data-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        const ob = state.get('onboarding');

        if (step.type === 'single') {
          state.update('onboarding', o => ({ ...o, [step.key]: val }));
          container.querySelectorAll('[data-value]').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        } else {
          const current = ob[step.key] || [];
          const max = step.max || 99;
          if (current.includes(val)) {
            state.update('onboarding', o => ({ ...o, [step.key]: current.filter(v => v !== val) }));
            btn.classList.remove('selected');
          } else if (current.length < max) {
            state.update('onboarding', o => ({ ...o, [step.key]: [...current, val] }));
            btn.classList.add('selected');
          } else {
            showToast(`최대 ${max}가지까지 선택할 수 있어요`);
          }
        }

        // Update next button state
        const newOb = state.get('onboarding');
        const nextBtn = container.querySelector('#next-btn');
        if (nextBtn) nextBtn.disabled = !isNextEnabled(step, newOb);

        // Update condition summary
        const summaryEl = container.querySelector('#summary-area');
        if (summaryEl) summaryEl.innerHTML = renderConditionSummary(newOb);
      });
    });

    // Next button
    const nextBtn = container.querySelector('#next-btn');
    nextBtn?.addEventListener('click', () => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render();
      } else {
        navigateTo('loading');
      }
    });

    // Skip button
    const skipBtn = container.querySelector('#skip-btn');
    skipBtn?.addEventListener('click', () => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render();
      } else {
        navigateTo('loading');
      }
    });
  }

  render();
}

function renderQuestionTitle(step) {
  const lines = step.displayLines?.length ? step.displayLines : [step.question];
  return lines.map((line) => `<span class="onb-title-line">${line}</span>`).join('');
}
