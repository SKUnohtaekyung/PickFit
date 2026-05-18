// ========================================
// Screen 5: Comparison
// ========================================

import { state } from '../utils/state.js';
import { OUTFITS, getOutfit } from '../data/mock.js';
import { staggerChildren } from '../utils/animations.js';

const COMPARE_ROWS = [
  { key: 'price',        label: '가격' },
  { key: 'fit',         label: '핏' },
  { key: 'material',    label: '소재' },
  { key: 'season',      label: '계절감' },
  { key: 'shipping',    label: '배송' },
  { key: 'returnFee',   label: '반품비' },
  { key: 'reviewSummary', label: '리뷰 요약' },
  { key: 'fitRisk',     label: '핏 리스크' },
];

// Best-for determination (most favorable per row)
function getBestIdx(outfits, key) {
  if (key === 'price') {
    // Lowest raw price
    const prices = outfits.map(o => parseInt(o.comparison.price.replace(/[^0-9]/g, ''), 10));
    const min = Math.min(...prices);
    return prices.indexOf(min);
  }
  if (key === 'returnFee') {
    const fees = outfits.map(o => o.comparison.returnFee.includes('무료') ? 0 : 999);
    const min = Math.min(...fees);
    return fees.indexOf(min);
  }
  if (key === 'fitRisk') {
    const risk = outfits.map(o => o.comparison.fitRisk === '낮음' ? 0 : o.comparison.fitRisk === '중간' ? 1 : 2);
    const min = Math.min(...risk);
    return risk.indexOf(min);
  }
  if (key === 'shipping') {
    // Free shipping wins
    const free = outfits.map(o => o.comparison.shipping.includes('무료') ? 0 : 1);
    const min = Math.min(...free);
    return free.indexOf(min);
  }
  return -1; // No best
}

export function renderComparison(container, { navigateTo }) {
  const compareIds = state.get('compareOutfitIds') || [];
  const outfits = compareIds.length
    ? compareIds.map(id => getOutfit(id)).filter(Boolean)
    : OUTFITS;

  container.innerHTML = `
    <!-- Top Bar -->
    <header class="sticky top-0 z-40 px-4 flex items-center gap-3" style="height:56px; background:rgba(247,248,252,0.9); backdrop-filter:blur(12px); border-bottom:1px solid rgba(217,220,230,0.5);">
      <button id="back-btn" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:none; border:none; cursor:pointer; color:#12141A; border-radius:10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      </button>
      <span class="text-label-lg" style="color:#12141A;">코디 비교</span>
    </header>

    <!-- Comparison Header (Outfit Names + Images) -->
    <div class="sticky top-14 z-30" style="background:rgba(247,248,252,0.95); backdrop-filter:blur(10px); border-bottom:2px solid #D9DCE6; padding:14px 16px 0;">
      <div style="display:grid; grid-template-columns:90px repeat(${outfits.length}, 1fr); gap:8px; padding-bottom:12px;">
        <div></div>
        ${outfits.map((outfit, i) => `
          <button class="outfit-header-btn text-center" data-outfit="${outfit.id}" style="display:flex; flex-direction:column; align-items:center; gap:6px; background:none; border:none; cursor:pointer;">
            <div style="width:52px; height:52px; border-radius:12px; overflow:hidden; background:#EEF1F6; border:2px solid ${i === 0 ? '#4D5EFF' : '#D9DCE6'}; margin:0 auto;">
              <img src="${getOutfit(outfit.id)?.items?.[0] ? '' : ''}" alt="" style="width:100%; height:100%; object-fit:cover;" />
              <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:24px; margin-top:-52px;">${['👔','🧥','👕'][i]}</div>
            </div>
            <span class="text-label" style="color:${i === 0 ? '#4D5EFF' : '#12141A'}; font-size:11px; line-height:1.3; text-align:center;">${outfit.title}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Comparison Table -->
    <div class="px-4 pb-40" style="overflow-x:hidden;">
      ${COMPARE_ROWS.map(row => {
        const bestIdx = getBestIdx(outfits, row.key);
        return `
          <div style="display:grid; grid-template-columns:90px repeat(${outfits.length}, 1fr); min-height:52px; align-items:start; padding:10px 0; border-bottom:1px solid #EEF1F6;">
            <div style="padding:2px 0; color:#5F6675; font-size:12px; font-weight:600; padding-top:6px;">${row.label}</div>
            ${outfits.map((outfit, i) => {
              const val = outfit.comparison[row.key] || '—';
              const isBest = bestIdx === i;
              const isRisk = row.key === 'fitRisk' && val === '중간';
              return `
                <div style="text-align:center; padding:0 4px;">
                  <div style="font-size:13px; font-weight:${isBest ? '700' : '500'}; color:${isRisk ? '#B7791F' : '#12141A'}; line-height:1.4;">
                    ${isRisk ? '⚠️ ' : ''}${val}
                  </div>
                  ${isBest ? `<span class="pf-best-badge">✓ Best</span>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
      }).join('')}
    </div>

    <!-- Bottom CTAs -->
    <div style="position:fixed; bottom:64px; left:50%; transform:translateX(-50%); width:100%; max-width:480px; padding:0 16px 12px; background:linear-gradient(to top, #F7F8FC 70%, transparent);">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${outfits.slice(0, 2).map(outfit => `
          <button class="go-detail-btn pf-btn-secondary" data-outfit="${outfit.id}" style="height:48px; font-size:13px;">
            ${outfit.title.length > 8 ? outfit.title.substring(0, 8) + '…' : outfit.title}
          </button>
        `).join('')}
      </div>
      <button id="back-results-btn" class="pf-btn-ghost" style="width:100%; margin-top:8px; color:#5F6675;">
        추천 목록으로 돌아가기
      </button>
    </div>
  `;

  // Back
  container.querySelector('#back-btn')?.addEventListener('click', () => navigateTo('results'));
  container.querySelector('#back-results-btn')?.addEventListener('click', () => navigateTo('results'));

  // Detail buttons
  container.querySelectorAll('.go-detail-btn, .outfit-header-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('selectedOutfitId', btn.dataset.outfit);
      navigateTo('detail');
    });
  });
}
