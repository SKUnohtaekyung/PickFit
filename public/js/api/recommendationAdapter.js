// ========================================
// PickFit Recommendation API Response Adapter
// ========================================
// Maps backend recommendation outfit shape into the UI outfit shape used by
// results/detail/comparison screens. Keeping this isolated lets us swap the
// fallback engine for GPT later without touching the screens.

const SLOT_DEFAULT_REASON = {
  top: '상의 핵심 픽',
  bottom: '하의 핵심 픽',
  shoes: '신발 핵심 픽',
  outer: '아우터 보강',
};

export function adaptRecommendationResponse(apiData) {
  if (!apiData || !Array.isArray(apiData.outfits)) {
    return { runId: null, outfits: [], source: 'unknown' };
  }

  const outfits = apiData.outfits.map((outfit, index) => adaptOutfit(outfit, index));
  return {
    runId: apiData.runId || null,
    source: apiData.source || 'fallback',
    conditions: apiData.conditions || null,
    outfits,
  };
}

export function adaptSavedOutfitEntry(entry, index = 0) {
  const outfit = entry?.outfit || null;
  const adaptedOutfit = outfit
    ? adaptOutfit({
        publicId: outfit.publicId,
        title: outfit.title,
        framingLabel: outfit.framingLabel,
        summary: outfit.summary,
        reasonText: outfit.reasonText,
        reasons: outfit.reasons,
        evidence: outfit.evidence,
        risks: outfit.risks,
        reviewEvidence: outfit.reviewEvidence,
        totalPrice: outfit.totalPrice,
        confidence: outfit.confidence,
        items: outfit.items,
      }, index)
    : null;

  return {
    id: adaptedOutfit?.id || outfit?.publicId || entry?.id || null,
    savedAt: entry?.savedAt || null,
    savedOutfitId: entry?.savedOutfitId || null,
    outfit: adaptedOutfit,
  };
}

function adaptOutfit(outfit, index) {
  const items = Array.isArray(outfit?.items) ? outfit.items : [];
  const adaptedItems = items.map((item) => adaptItem(item));
  const reasons = pickReasons(outfit);

  return {
    id: outfit?.publicId || `outfit-${index + 1}`,
    title: outfit?.title || `추천 코디 ${index + 1}`,
    framingLabel: outfit?.framingLabel || '추천 픽',
    summary: outfit?.summary || '',
    totalPrice: typeof outfit?.totalPrice === 'number' ? outfit.totalPrice : 0,
    reasons,
    risks: Array.isArray(outfit?.risks) ? outfit.risks : [],
    reviewEvidence: outfit?.reviewEvidence || '리뷰 요약 데이터를 보강 중이에요.',
    confidence: typeof outfit?.confidence === 'number' ? outfit.confidence : null,
    tags: deriveTags(adaptedItems),
    items: adaptedItems,
    comparison: deriveComparison(adaptedItems),
  };
}

function adaptItem(item) {
  const product = adaptProduct(item?.product);
  return {
    slot: item?.slot || 'top',
    productId: product?.id || item?.productPublicId || null,
    productPublicId: item?.productPublicId || product?.id || null,
    product,
    alternatives: Array.isArray(item?.alternativeProductIds) ? item.alternativeProductIds : [],
    reason: item?.reason || SLOT_DEFAULT_REASON[item?.slot] || '',
  };
}

function adaptProduct(product) {
  if (!product) return null;

  const priceSale = numberOrZero(product.priceSale);
  const priceOriginal = numberOrZero(product.priceOriginal) || priceSale;
  const discountRate = priceOriginal && priceSale && priceOriginal > priceSale
    ? Math.round(((priceOriginal - priceSale) / priceOriginal) * 100)
    : Math.round(numberOrZero(product.discountRate));

  const imageUrl = ensureRelativeAsset(product.heroImageUrl || '');

  // Trust-UX principle: do not invent shipping/return/review numbers when the
  // backend has not provided them. UI must render "정보 부족" or hide rows.
  const rawRating = typeof product.reviewRating === 'number' && Number.isFinite(product.reviewRating)
    ? Number(product.reviewRating.toFixed(1))
    : null;
  const rawCountNum = Number(product.reviewCount);
  const rawCount = Number.isFinite(rawCountNum) && rawCountNum > 0 ? rawCountNum : null;
  const rawSummary = typeof product.reviewHighlight === 'string' && product.reviewHighlight !== ''
    ? product.reviewHighlight
    : null;

  return {
    id: product.id || null,
    brand: product.brandName || '',
    name: product.productName || '',
    image: imageUrl,
    purchaseUrl: product.productPageUrl || '#',
    price: priceSale,
    originalPrice: priceOriginal,
    discountRate,
    fit: product.fitType || '-',
    season: product.seasonality || '-',
    thickness: product.thickness || '-',
    color: product.colorFamily || '-',
    // Size-run inference from fitType was ungrounded — UI hides the row when null.
    // Re-enable only when backend exposes reviews.size_runs aggregation.
    sizeRun: null,
    material: product.materialMain || '-',
    rating: rawRating,
    reviewCount: rawCount,
    reviewSummary: rawSummary,
    // Shipping and return policy require backend columns we don't surface yet —
    // null means "render the row as 정보 부족" or hide it. Anything else would
    // be invented and break trust UX.
    shipping: null,
    returnPolicy: null,
  };
}

function pickReasons(outfit) {
  if (Array.isArray(outfit?.reasons) && outfit.reasons.length) {
    return outfit.reasons.slice(0, 4);
  }
  if (typeof outfit?.reasonText === 'string' && outfit.reasonText) {
    return outfit.reasonText.split('. ').filter(Boolean).slice(0, 3);
  }
  return ['추천 이유를 보강 중이에요.'];
}

function deriveTags(items) {
  const tags = new Set();
  items.forEach((item) => {
    const product = item.product;
    if (!product) return;
    if (product.fit) tags.add(product.fit);
    if (product.color) tags.add(product.color);
  });
  return [...tags].slice(0, 4);
}

function deriveComparison(items) {
  const fits = new Set();
  const materials = new Set();
  const seasons = new Set();
  let total = 0;
  let fitRisk = '정보부족';
  let sawFitData = false;

  items.forEach((item) => {
    if (!item.product) return;
    if (item.product.fit && item.product.fit !== '-') {
      fits.add(item.product.fit);
      sawFitData = true;
      if (item.product.fit === 'oversized' || item.product.fit === 'wide') {
        fitRisk = '중간';
      } else if (fitRisk === '정보부족') {
        fitRisk = '낮음';
      }
    }
    if (item.product.material && item.product.material !== '-') materials.add(item.product.material);
    if (item.product.season && item.product.season !== '-') seasons.add(item.product.season);
    total += numberOrZero(item.product.price);
  });

  return {
    price: total > 0 ? `${total.toLocaleString()}원` : '정보 부족',
    fit: [...fits].join('/') || '정보 부족',
    material: [...materials].slice(0, 2).join(' + ') || '정보 부족',
    season: [...seasons].slice(0, 2).join('/') || '정보 부족',
    // Shipping / return / review summary are surfaced as 정보 부족 until the
    // backend exposes the corresponding columns and the adapter is updated to
    // propagate them. Hardcoded "무료 / 2일" / "리뷰 보강 중" was misleading.
    shipping: '정보 부족',
    returnFee: '정보 부족',
    reviewSummary: '정보 부족',
    fitRisk: sawFitData ? fitRisk : '정보부족',
  };
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ensureRelativeAsset(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) {
    return url.replace(/^\/+/, '');
  }
  return url;
}
