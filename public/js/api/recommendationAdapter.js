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
  // Idempotency guard: if the caller has already adapted this entry (its
  // outfit carries the computed `comparison` block we set below), pass it
  // through untouched. Double-calling this used to silently strip every
  // backend-shape product field because the second invocation looked up
  // `brandName/priceSale/heroImageUrl/…` against an already-UI-shape payload.
  // See WORKLOG "Day 9 hotfix — saved 이중 어댑팅 회귀".
  if (entry?.outfit && entry.outfit.comparison !== undefined) {
    return entry;
  }

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
    situation: entry?.situation || null, // 상황별 그룹용(서버가 run 조건에서 내려줌)
    outfit: adaptedOutfit,
  };
}

function adaptOutfit(outfit, index) {
  // Idempotency guard — `comparison` is computed below and never appears in
  // raw backend responses, so its presence means we already adapted this
  // outfit. Returning as-is prevents the field-name mismatch that strips
  // every product field on a second pass.
  if (outfit && outfit.comparison !== undefined) {
    return outfit;
  }

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

  // Idempotency guard — UI shape uses `brand`/`name`/`price`/`image`; backend
  // shape uses `brandName`/`productName`/`priceSale`/`heroImageUrl`. If the
  // caller already adapted this product, do not re-adapt or every field
  // becomes empty (because the second pass looks up backend keys that no
  // longer exist).
  if (product.brand !== undefined && product.brandName === undefined) {
    return product;
  }

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
    // Review-grounded per-product fit risk from the backend (낮음/중간/높음/정보부족).
    fitRisk: product.fitRisk || null,
    // Shipping/return are per-mall and resolved at the external store (§16.5),
    // not invented here — the comparison UI surfaces them as "구매처 확인".
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

const FIT_RISK_RANK = { '낮음': 1, '중간': 2, '높음': 3 };

function deriveComparison(items) {
  const fits = new Set();
  const materials = new Set();
  const seasons = new Set();
  const highlights = [];
  let total = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let reviewCount = 0;
  let maxRisk = 0;         // review-grounded fit risk (worst severity across items)
  let sawBackendRisk = false;
  let fitFallbackRisk = 0; // fit-type fallback when no review-grounded risk
  let sawFitData = false;

  items.forEach((item) => {
    const product = item.product;
    if (!product) return;

    if (product.fit && product.fit !== '-') {
      fits.add(product.fit);
      sawFitData = true;
      fitFallbackRisk = Math.max(fitFallbackRisk, (product.fit === 'oversized' || product.fit === 'wide') ? 2 : 1);
    }
    if (product.material && product.material !== '-') materials.add(product.material);
    if (product.season && product.season !== '-') seasons.add(product.season);
    total += numberOrZero(product.price);

    if (product.fitRisk && FIT_RISK_RANK[product.fitRisk]) {
      sawBackendRisk = true;
      maxRisk = Math.max(maxRisk, FIT_RISK_RANK[product.fitRisk]);
    }
    if (typeof product.rating === 'number' && Number.isFinite(product.rating)) {
      ratingSum += product.rating;
      ratingCount += 1;
    }
    if (typeof product.reviewCount === 'number' && product.reviewCount > 0) {
      reviewCount += product.reviewCount;
    }
    if (product.reviewSummary) highlights.push(product.reviewSummary);
  });

  const rankToLabel = (rank) => Object.keys(FIT_RISK_RANK).find((k) => FIT_RISK_RANK[k] === rank) || '정보부족';
  let fitRisk = '정보부족';
  if (sawBackendRisk) fitRisk = rankToLabel(maxRisk);
  else if (sawFitData) fitRisk = rankToLabel(fitFallbackRisk);

  const avgRating = ratingCount ? Number((ratingSum / ratingCount).toFixed(1)) : null;

  return {
    price: total > 0 ? `${total.toLocaleString()}원` : '정보 부족',
    fit: [...fits].slice(0, 2).join('/') || '정보 부족',
    material: [...materials].slice(0, 2).join(' + ') || '정보 부족',
    season: [...seasons].slice(0, 2).join('/') || '정보 부족',
    fitRisk,
    // Review block — consumed by the redesigned comparison UI.
    rating: avgRating,
    reviewCount,
    reviewSummary: highlights[0] || (reviewCount > 0 ? `리뷰 ${reviewCount.toLocaleString()}개 반영` : '정보 부족'),
    // Shipping / return are per-mall (resolved at the external store, §16.5).
    // 'EXTERNAL' is a sentinel the UI renders as "구매처 확인" — never a fake number.
    shipping: 'EXTERNAL',
    returnFee: 'EXTERNAL',
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
