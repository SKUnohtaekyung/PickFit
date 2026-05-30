// ========================================
// Display label maps — backend tokens → Korean UI text
// ========================================
// Product fit_type / seasonality come from the DB as English tokens (and the
// comparison adapter joins several with "/"). UI must never show those raw, so
// map at render time. Unknown tokens pass through unchanged.

const FIT_LABELS = {
  slim: '슬림',
  regular: '레귤러',
  oversized: '오버사이즈',
  wide: '와이드',
  relaxed: '릴랙스드',
  straight: '스트레이트',
  true_to_size: '정사이즈',
};

const SEASON_LABELS = {
  spring: '봄',
  summer: '여름',
  fall: '가을',
  winter: '겨울',
  'all-season': '사계절',
};

function mapTokens(value, table) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (text === '') return '';
  const seen = new Set();
  const out = [];
  text.split('/').forEach((token) => {
    const key = token.trim();
    if (!key) return;
    const label = table[key] || key;
    // Dedup — joined values can repeat (e.g. two items both "spring/...").
    if (seen.has(label)) return;
    seen.add(label);
    out.push(label);
  });
  return out.join('·');
}

export function fitLabel(value) {
  return mapTokens(value, FIT_LABELS);
}

export function seasonLabel(value) {
  return mapTokens(value, SEASON_LABELS);
}
