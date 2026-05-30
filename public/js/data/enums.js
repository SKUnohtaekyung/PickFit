// ========================================
// PickFit Option Enums
// ========================================
// Static option lists for onboarding (multi-step questionnaire) and landing
// (situation cards). The single source of truth for all questionnaire UI.
//
// Kept as plain UI constants here because they are display labels, not
// recommendation candidates. Backend takes the `id` value verbatim as a
// condition input (`POST /api/recommendations`). When adding a new option, the
// recommendation engine (`src/Services/RecommendationService.php`) and
// catalog tagging (`database/seeds/mock_catalog_seed.sql` `occasion_tags`)
// must be updated together.

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
