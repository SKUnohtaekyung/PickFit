// ========================================
// PickFit Mock Data
// ========================================

export const SITUATIONS = [
  { id: 'office', label: '출근룩', emoji: '🏢' },
  { id: 'date', label: '소개팅', emoji: '💕' },
  { id: 'daily', label: '데일리', emoji: '☀️' },
  { id: 'travel', label: '여행', emoji: '✈️' },
  { id: 'wedding', label: '하객룩', emoji: '💒' },
  { id: 'rainy', label: '장마철', emoji: '🌧️' },
  { id: 'interview', label: '면접', emoji: '👔' },
  { id: 'casual', label: '캐주얼', emoji: '👟' },
];

export const BUDGETS = [
  { id: 'under50k', label: '~5만 원' },
  { id: '50k-100k', label: '5~10만 원' },
  { id: '100k-200k', label: '10~20만 원' },
  { id: 'over200k', label: '20만 원+' },
];

export const MOODS = [
  { id: 'minimal', label: '미니멀' },
  { id: 'casual', label: '캐주얼' },
  { id: 'street', label: '스트릿' },
  { id: 'classic', label: '클래식' },
  { id: 'feminine', label: '페미닌' },
  { id: 'clean', label: '클린' },
  { id: 'soft', label: '소프트' },
  { id: 'chic', label: '시크' },
];

export const FITS = [
  { id: 'slim', label: '슬림' },
  { id: 'regular', label: '레귤러' },
  { id: 'oversized', label: '오버사이즈' },
  { id: 'relaxed', label: '릴랙스드' },
  { id: 'straight', label: '스트레이트' },
];

export const BODY_TYPES = [
  { id: 'broad_shoulders', label: '넓은 어깨' },
  { id: 'upper_volume', label: '상체 볼륨' },
  { id: 'lower_volume', label: '하체 볼륨' },
  { id: 'height', label: '키 고민' },
  { id: 'waist', label: '허리 라인' },
  { id: 'leg_length', label: '다리 비율' },
];

export const COLORS_PREF = [
  { id: 'black', label: '블랙', hex: '#1a1a1a' },
  { id: 'navy', label: '네이비', hex: '#22345d' },
  { id: 'gray', label: '그레이', hex: '#8b8b8b' },
  { id: 'white', label: '화이트', hex: '#f5f5f5' },
  { id: 'beige', label: '베이지', hex: '#d4c5a9' },
  { id: 'brown', label: '브라운', hex: '#8B6F47' },
  { id: 'khaki', label: '카키', hex: '#7B8162' },
  { id: 'blue', label: '블루', hex: '#5B9BD5' },
  { id: 'denim', label: '데님블루', hex: '#4A6FA5' },
  { id: 'pink', label: '핑크', hex: '#D9A7B0' },
  { id: 'red', label: '레드', hex: '#B24747' },
  { id: 'green', label: '그린', hex: '#5F8F65' },
  { id: 'ivory', label: '아이보리', hex: '#EFE7D4' },
];

export const AVOIDANCES = [
  { id: 'tight', label: '타이트한 핏' },
  { id: 'bright_color', label: '밝은 색상' },
  { id: 'short_length', label: '짧은 기장' },
  { id: 'dry_clean', label: '드라이클리닝' },
  { id: 'high_return_risk', label: '반품 어려운 상품' },
  { id: 'sheer', label: '비치는 소재' },
];

// --- Mock Products ---
export const PRODUCTS = {
  'prod-001': {
    id: 'prod-001',
    brand: 'STANDARD.O',
    name: '슬림핏 코튼 셔츠',
    price: 49000,
    originalPrice: 59000,
    discountRate: 17,
    image: 'assets/products/shirt_white.webp',
    fit: '슬림',
    material: '면 60%, 폴리 40%',
    thickness: '중간',
    opacity: '불투명',
    stretch: '약간',
    season: '봄/가을',
    color: '화이트',
    sizeRun: '정사이즈',
    reviewSummary: '정사이즈, 슬림하지만 답답하지 않은 라인',
    reviewCount: 847,
    rating: 4.3,
    shipping: { fee: 0, days: 2, label: '무료 / 2일' },
    returnPolicy: { fee: 0, days: 7, label: '무료 / 7일 이내' },
    purchaseUrl: '#',
  },
  'prod-002': {
    id: 'prod-002',
    brand: 'MUSINSA STANDARD',
    name: '세미 와이드 슬랙스',
    price: 39000,
    originalPrice: 39000,
    discountRate: 0,
    image: 'assets/products/slacks_black.webp',
    fit: '레귤러',
    material: '폴리 80%, 레이온 20%',
    thickness: '중간',
    opacity: '불투명',
    stretch: '중간',
    season: '사계절',
    color: '블랙',
    sizeRun: '정사이즈',
    reviewSummary: '기장 좋고 구김 적음, 허리 여유 있음',
    reviewCount: 1203,
    rating: 4.5,
    shipping: { fee: 0, days: 2, label: '무료 / 2일' },
    returnPolicy: { fee: 0, days: 7, label: '무료 / 7일 이내' },
    purchaseUrl: '#',
  },
  'prod-003': {
    id: 'prod-003',
    brand: 'COMMON PROJECTS',
    name: '미니멀 더비슈즈',
    price: 39000,
    originalPrice: 49000,
    discountRate: 20,
    image: 'assets/products/shoes_black.webp',
    fit: '정사이즈',
    material: '인조가죽',
    thickness: '-',
    opacity: '-',
    stretch: '없음',
    season: '봄/가을',
    color: '블랙',
    sizeRun: '정사이즈',
    reviewSummary: '가격 대비 마감 좋음, 발볼 보통',
    reviewCount: 456,
    rating: 4.1,
    shipping: { fee: 3000, days: 3, label: '3,000원 / 3일' },
    returnPolicy: { fee: 3000, days: 7, label: '3,000원 / 7일 이내' },
    purchaseUrl: '#',
  },
  'prod-004': {
    id: 'prod-004',
    brand: 'DEPOUND',
    name: '릴랙스 오버핏 니트',
    price: 58000,
    originalPrice: 68000,
    discountRate: 15,
    image: 'assets/products/knit_beige.webp',
    fit: '오버핏',
    material: '아크릴 50%, 울 30%, 나일론 20%',
    thickness: '두꺼움',
    opacity: '불투명',
    stretch: '많음',
    season: '가을/겨울',
    color: '베이지',
    sizeRun: '넉넉함',
    reviewSummary: '상체 커버 좋음, 어깨 드롭 자연스러움',
    reviewCount: 623,
    rating: 4.4,
    shipping: { fee: 0, days: 2, label: '무료 / 2일' },
    returnPolicy: { fee: 0, days: 14, label: '무료 / 14일 이내' },
    purchaseUrl: '#',
  },
  'prod-005': {
    id: 'prod-005',
    brand: 'UNIQLO',
    name: '스마트 앵클 팬츠',
    price: 49900,
    originalPrice: 49900,
    discountRate: 0,
    image: 'assets/products/pants_navy.webp',
    fit: '레귤러',
    material: '폴리 65%, 면 35%',
    thickness: '중간',
    opacity: '불투명',
    stretch: '중간',
    season: '사계절',
    color: '네이비',
    sizeRun: '정사이즈',
    reviewSummary: '기장 적절, 구김 거의 없음, 사계절 무난',
    reviewCount: 2100,
    rating: 4.6,
    shipping: { fee: 0, days: 1, label: '무료 / 1일' },
    returnPolicy: { fee: 0, days: 30, label: '무료 / 30일 이내' },
    purchaseUrl: '#',
  },
  'prod-006': {
    id: 'prod-006',
    brand: 'NIKE',
    name: '에어포스 1 로우',
    price: 59000,
    originalPrice: 69000,
    discountRate: 14,
    image: 'assets/products/sneakers_white.webp',
    fit: '정사이즈',
    material: '천연가죽, 합성가죽',
    thickness: '-',
    opacity: '-',
    stretch: '없음',
    season: '사계절',
    color: '화이트',
    sizeRun: '반 사이즈 업 권장',
    reviewSummary: '클래식 디자인, 착화감 좋음, 발볼 넓으면 반UP',
    reviewCount: 3400,
    rating: 4.7,
    shipping: { fee: 0, days: 1, label: '무료 / 1일' },
    returnPolicy: { fee: 0, days: 14, label: '무료 / 14일 이내' },
    purchaseUrl: '#',
  },
  'prod-007': {
    id: 'prod-007',
    brand: 'COS',
    name: '레귤러핏 크루넥 티',
    price: 29000,
    originalPrice: 39000,
    discountRate: 26,
    image: 'assets/products/tshirt_gray.webp',
    fit: '레귤러',
    material: '면 100%',
    thickness: '중간',
    opacity: '약간 비침',
    stretch: '약간',
    season: '봄/여름',
    color: '그레이',
    sizeRun: '정사이즈',
    reviewSummary: '소재 좋음, 한 번 세탁 후 약간 줄어듦',
    reviewCount: 890,
    rating: 4.2,
    shipping: { fee: 3000, days: 3, label: '3,000원 / 3일' },
    returnPolicy: { fee: 5000, days: 14, label: '5,000원 / 14일 이내' },
    purchaseUrl: '#',
  },
  'prod-008': {
    id: 'prod-008',
    brand: 'MUSINSA STANDARD',
    name: '와이드 데님 팬츠',
    price: 45000,
    originalPrice: 55000,
    discountRate: 18,
    image: 'assets/products/denim_blue.webp',
    fit: '와이드',
    material: '면 98%, 스판 2%',
    thickness: '두꺼움',
    opacity: '불투명',
    stretch: '약간',
    season: '봄/가을',
    color: '인디고 블루',
    sizeRun: '한 치수 업 권장',
    reviewSummary: '하체 커버 좋음, 워싱 자연스러움',
    reviewCount: 567,
    rating: 4.3,
    shipping: { fee: 0, days: 2, label: '무료 / 2일' },
    returnPolicy: { fee: 2500, days: 7, label: '2,500원 / 7일 이내' },
    purchaseUrl: '#',
  },
  'prod-009': {
    id: 'prod-009',
    brand: 'ANDERSSON BELL',
    name: '오버사이즈 블레이저',
    price: 89000,
    originalPrice: 119000,
    discountRate: 25,
    image: 'assets/products/blazer_charcoal.webp',
    fit: '오버핏',
    material: '폴리 70%, 레이온 30%',
    thickness: '중간',
    opacity: '불투명',
    stretch: '약간',
    season: '봄/가을',
    color: '차콜',
    sizeRun: '넉넉함',
    reviewSummary: '어깨 드롭 좋음, 데일리/오피스 모두 가능',
    reviewCount: 312,
    rating: 4.5,
    shipping: { fee: 0, days: 3, label: '무료 / 3일' },
    returnPolicy: { fee: 0, days: 14, label: '무료 / 14일 이내' },
    purchaseUrl: '#',
  },
};

// --- Mock Outfits ---
export const OUTFITS = [
  {
    id: 'outfit-001',
    title: '오피스 깔끔 코어',
    situation: 'office',
    framingLabel: '출근 상황에 가장 적합',
    summary: '슬림한 실루엣의 깔끔한 세미포멀 출근룩',
    totalPrice: 127000,
    reasons: [
      '출근 상황에 적합한 세미포멀 실루엣',
      '리뷰에서 정사이즈 평이 72%로 높음',
      '예산 범위 내 전체 코디 구성 가능',
    ],
    risks: [
      { type: 'warning', text: '어깨가 넓으면 셔츠 한 치수 업 권장' },
    ],
    tags: ['minimal', 'office', 'slim'],
    reviewEvidence: '셔츠 리뷰 847건 중 "정사이즈" 언급 72%, 슬랙스 "구김적음" 81%',
    items: [
      { slot: 'top', productId: 'prod-001', alternatives: ['prod-007'] },
      { slot: 'bottom', productId: 'prod-002', alternatives: ['prod-005'] },
      { slot: 'shoes', productId: 'prod-003', alternatives: ['prod-006'] },
    ],
    comparison: {
      price: '127,000원',
      fit: '레귤러/슬림',
      material: '면 혼방',
      season: '봄/가을',
      shipping: '무료 / 2일',
      returnFee: '무료~3,000원',
      reviewSummary: '사이즈 적당, 소재 좋음',
      fitRisk: '낮음',
    },
  },
  {
    id: 'outfit-002',
    title: '체형 보완 스마트룩',
    situation: 'office',
    framingLabel: '체형 보완에 최적',
    summary: '오버핏으로 상체를 자연스럽게 커버하는 스마트 캐주얼',
    totalPrice: 147000,
    reasons: [
      '오버핏 니트가 상체 볼륨을 자연스럽게 커버',
      '어깨 드롭 실루엣이 체형 보완에 효과적',
      '와이드 팬츠로 하체 비율 보정',
    ],
    risks: [
      { type: 'warning', text: '니트 소재 특성상 보풀 관리 필요' },
      { type: 'warning', text: '데님은 한 치수 업 권장' },
    ],
    tags: ['soft', 'body_compensating', 'oversized'],
    reviewEvidence: '니트 리뷰 623건 중 "상체커버" 언급 68%, 데님 "허리여유있음" 56%',
    items: [
      { slot: 'top', productId: 'prod-004', alternatives: ['prod-001'] },
      { slot: 'bottom', productId: 'prod-008', alternatives: ['prod-002'] },
      { slot: 'shoes', productId: 'prod-006', alternatives: ['prod-003'] },
    ],
    comparison: {
      price: '147,000원',
      fit: '오버핏/와이드',
      material: '울 혼방 + 데님',
      season: '가을',
      shipping: '무료 / 1~2일',
      returnFee: '무료~2,500원',
      reviewSummary: '체형커버 좋음, 핏 만족',
      fitRisk: '중간',
    },
  },
  {
    id: 'outfit-003',
    title: '가성비 베스트',
    situation: 'office',
    framingLabel: '가격 대비 최고',
    summary: '10만 원 이하로 완성하는 깔끔한 오피스 캐주얼',
    totalPrice: 89000,
    reasons: [
      '전체 코디 9만 원 이하의 합리적 가격',
      '무난한 레귤러핏으로 실패 확률 낮음',
      '모든 아이템 무료/빠른 배송 가능',
    ],
    risks: [
      { type: 'warning', text: '티셔츠 첫 세탁 시 약간 줄어들 수 있음' },
    ],
    tags: ['clean', 'value', 'regular'],
    reviewEvidence: '티 리뷰 890건 중 "가성비" 언급 64%, 팬츠 "구김없음" 78%',
    items: [
      { slot: 'top', productId: 'prod-007', alternatives: ['prod-001'] },
      { slot: 'bottom', productId: 'prod-005', alternatives: ['prod-002'] },
      { slot: 'shoes', productId: 'prod-006', alternatives: ['prod-003'] },
    ],
    comparison: {
      price: '89,000원',
      fit: '레귤러',
      material: '면 + 폴리 혼방',
      season: '봄/여름',
      shipping: '무료 / 1일',
      returnFee: '무료~5,000원',
      reviewSummary: '가성비 좋음, 무난한 핏',
      fitRisk: '낮음',
    },
  },
];

// Helper to get product by ID
export function getProduct(id) {
  return PRODUCTS[id] || null;
}

// Helper to get outfit by ID
export function getOutfit(id) {
  return OUTFITS.find(o => o.id === id) || null;
}

// Helper to get situation label
export function getSituationLabel(id) {
  const s = SITUATIONS.find(s => s.id === id);
  return s ? s.label : id;
}

export function getBudgetLabel(id) {
  const b = BUDGETS.find(b => b.id === id);
  return b ? b.label : id;
}

export function getMoodLabel(id) {
  const m = MOODS.find(m => m.id === id);
  return m ? m.label : id;
}

export function getFitLabel(id) {
  const f = FITS.find(f => f.id === id);
  return f ? f.label : id;
}
