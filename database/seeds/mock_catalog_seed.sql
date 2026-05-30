-- PickFit mock catalog seed
-- Source: js/data/mock.js PRODUCTS
-- Requires: database/migrations/001_initial_schema.sql catalog tables.
-- All product / brand / review text mirrors the Korean UI strings in mock.js so
-- recommendations stay localized end-to-end. SET NAMES utf8mb4 is mandatory.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM reviews;
DELETE FROM product_media;
DELETE FROM product_variants;
DELETE FROM products;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO products (
  public_id,
  source_url,
  source_domain,
  origin_type,
  brand_name,
  seller_name,
  category_main,
  category_sub,
  gender_target,
  product_name,
  hero_image_url,
  product_page_url,
  price_original,
  price_sale,
  discount_rate,
  currency,
  stock_status,
  fit_type,
  silhouette,
  material_main,
  material_sub,
  thickness,
  opacity,
  stretch,
  seasonality,
  color_family,
  style_tags,
  occasion_tags,
  body_type_notes,
  shipping_fee,
  free_shipping_threshold,
  estimated_shipping_days,
  returnable,
  return_fee,
  exchange_fee,
  policy_note,
  data_quality_score,
  last_synced_at
) VALUES
('prod-001', NULL, 'seed.pickfit.local', 'seed', 'STANDARD.O', 'PickFit 시드 카탈로그', 'top', 'shirt', 'unisex', '슬림핏 코튼 셔츠', '/assets/products/shirt_white.webp', '#', 59000, 49000, 17.00, 'KRW', 'in_stock', 'slim', 'straight shirt', '면 60%, 폴리 40%', '면 혼방', 'medium', 'opaque', 'low', 'spring/fall', '화이트', JSON_ARRAY('minimal', 'clean', 'office'), JSON_ARRAY('office', 'interview', 'daily'), JSON_ARRAY('정사이즈', '깔끔한 어깨 라인'), 0, NULL, '2일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.780, UTC_TIMESTAMP()),
('prod-002', NULL, 'seed.pickfit.local', 'seed', 'MUSINSA STANDARD', 'PickFit 시드 카탈로그', 'bottom', 'slacks', 'unisex', '세미 와이드 슬랙스', '/assets/products/slacks_black.webp', '#', 39000, 39000, 0.00, 'KRW', 'in_stock', 'regular', 'wide straight', '폴리 80%, 레이온 20%', '폴리 혼방', 'medium', 'opaque', 'medium', 'all-season', '블랙', JSON_ARRAY('minimal', 'clean', 'office'), JSON_ARRAY('office', 'interview', 'daily'), JSON_ARRAY('허리 여유', '스트레이트 다리 라인'), 0, NULL, '2일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.820, UTC_TIMESTAMP()),
('prod-003', NULL, 'seed.pickfit.local', 'seed', 'COMMON PROJECTS', 'PickFit 시드 카탈로그', 'shoes', 'derby', 'unisex', '미니멀 더비슈즈', '/assets/products/shoes_black.webp', '#', 49000, 39000, 20.00, 'KRW', 'in_stock', 'true_to_size', 'minimal derby', '인조가죽', NULL, NULL, NULL, 'none', 'spring/fall', '블랙', JSON_ARRAY('minimal', 'classic', 'office'), JSON_ARRAY('office', 'date', 'interview'), JSON_ARRAY('포멀 기본 베이스', '평균 발볼'), 3000, NULL, '3일', 1, 3000, 3000, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.720, UTC_TIMESTAMP()),
('prod-004', NULL, 'seed.pickfit.local', 'seed', 'DEPOUND', 'PickFit 시드 카탈로그', 'top', 'knit', 'unisex', '릴랙스 오버핏 니트', '/assets/products/knit_beige.webp', '#', 68000, 58000, 15.00, 'KRW', 'in_stock', 'oversized', 'relaxed knit', '아크릴 50%, 울 30%, 나일론 20%', '아크릴 울 혼방', 'thick', 'opaque', 'high', 'fall/winter', '베이지', JSON_ARRAY('soft', 'casual', 'body_compensating'), JSON_ARRAY('daily', 'office', 'date'), JSON_ARRAY('상체 커버', '자연스러운 어깨 드롭'), 0, NULL, '2일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.800, UTC_TIMESTAMP()),
('prod-005', NULL, 'seed.pickfit.local', 'seed', 'UNIQLO', 'PickFit 시드 카탈로그', 'bottom', 'pants', 'unisex', '스마트 앵클 팬츠', '/assets/products/pants_navy.webp', '#', 49900, 49900, 0.00, 'KRW', 'in_stock', 'regular', 'tapered pants', '폴리 65%, 면 35%', '폴리 코튼 혼방', 'medium', 'opaque', 'medium', 'all-season', '네이비', JSON_ARRAY('clean', 'value', 'office'), JSON_ARRAY('office', 'travel', 'daily', 'rainy'), JSON_ARRAY('낮은 핏 리스크', '균형 잡힌 기장'), 0, NULL, '1일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.860, UTC_TIMESTAMP()),
('prod-006', NULL, 'seed.pickfit.local', 'seed', 'NIKE', 'PickFit 시드 카탈로그', 'shoes', 'sneakers', 'unisex', '에어포스 1 로우', '/assets/products/sneakers_white.webp', '#', 69000, 59000, 14.00, 'KRW', 'in_stock', 'true_to_size', 'low sneakers', '천연가죽, 합성가죽', '가죽 혼합', NULL, NULL, 'none', 'all-season', '화이트', JSON_ARRAY('casual', 'classic', 'clean'), JSON_ARRAY('daily', 'travel', 'casual'), JSON_ARRAY('발볼 넓으면 반 사이즈 업', '클래식 캐주얼 베이스'), 0, NULL, '1일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.880, UTC_TIMESTAMP()),
('prod-007', NULL, 'seed.pickfit.local', 'seed', 'COS', 'PickFit 시드 카탈로그', 'top', 'tshirt', 'unisex', '레귤러핏 크루넥 티', '/assets/products/tshirt_gray.webp', '#', 39000, 29000, 26.00, 'KRW', 'in_stock', 'regular', 'regular tee', '면 100%', '면', 'medium', 'slightly sheer', 'low', 'spring/summer', '그레이', JSON_ARRAY('clean', 'value', 'casual'), JSON_ARRAY('daily', 'casual', 'travel'), JSON_ARRAY('레귤러 바디 핏', '낮은 스타일 리스크'), 3000, NULL, '3일', 1, 5000, 5000, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.740, UTC_TIMESTAMP()),
('prod-008', NULL, 'seed.pickfit.local', 'seed', 'MUSINSA STANDARD', 'PickFit 시드 카탈로그', 'bottom', 'denim', 'unisex', '와이드 데님 팬츠', '/assets/products/denim_blue.webp', '#', 55000, 45000, 18.00, 'KRW', 'in_stock', 'wide', 'wide denim', '면 98%, 스판 2%', '코튼 스트레치 데님', 'thick', 'opaque', 'low', 'spring/fall', '인디고 블루', JSON_ARRAY('casual', 'body_compensating', 'street'), JSON_ARRAY('daily', 'travel', 'casual', 'rainy'), JSON_ARRAY('하체 커버', '자연스러운 워싱'), 0, NULL, '2일', 1, 2500, 2500, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.790, UTC_TIMESTAMP()),
('prod-009', NULL, 'seed.pickfit.local', 'seed', 'ANDERSSON BELL', 'PickFit 시드 카탈로그', 'outer', 'blazer', 'unisex', '오버사이즈 블레이저', '/assets/products/blazer_charcoal.webp', '#', 119000, 89000, 25.00, 'KRW', 'in_stock', 'oversized', 'structured blazer', '폴리 70%, 레이온 30%', '폴리 레이온 혼방', 'medium', 'opaque', 'low', 'spring/fall', '차콜', JSON_ARRAY('classic', 'office', 'chic'), JSON_ARRAY('office', 'interview', 'date', 'rainy'), JSON_ARRAY('어깨 커버', '스마트 캐주얼 레이어링'), 0, NULL, '3일', 1, 0, 0, '시드 모의 반품 정책. 구매 전 판매처 페이지 확인 필요.', 0.800, UTC_TIMESTAMP());

INSERT INTO product_variants (
  product_id,
  public_id,
  color_name,
  color_code_normalized,
  size_label,
  size_system,
  stock_status,
  variant_url,
  variant_image_url
)
SELECT id, CONCAT('var-', public_id, '-default'), color_family, color_family, 'FREE', 'seed', 'in_stock', product_page_url, hero_image_url
FROM products
WHERE public_id IN ('prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005', 'prod-006', 'prod-007', 'prod-008', 'prod-009');

INSERT INTO product_media (
  product_id,
  media_type,
  url,
  local_path,
  alt_text,
  sort_order
)
SELECT id, 'image', hero_image_url, hero_image_url, product_name, 0
FROM products
WHERE public_id IN ('prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005', 'prod-006', 'prod-007', 'prod-008', 'prod-009');

INSERT INTO reviews (
  product_id,
  public_id,
  rating,
  review_text,
  verified_purchase,
  size_runs,
  fit_satisfaction,
  material_satisfaction,
  complaint_tags,
  praise_tags
)
SELECT p.id,
       CONCAT('rev-', p.public_id, '-001'),
       CASE p.public_id
         WHEN 'prod-001' THEN 4.3
         WHEN 'prod-002' THEN 4.5
         WHEN 'prod-003' THEN 4.1
         WHEN 'prod-004' THEN 4.4
         WHEN 'prod-005' THEN 4.6
         WHEN 'prod-006' THEN 4.7
         WHEN 'prod-007' THEN 4.2
         WHEN 'prod-008' THEN 4.3
         WHEN 'prod-009' THEN 4.5
         ELSE 4.0
       END,
       CASE p.public_id
         WHEN 'prod-001' THEN '정사이즈, 슬림하지만 답답하지 않은 라인.'
         WHEN 'prod-002' THEN '기장 좋고 구김 적음, 허리 여유 있음.'
         WHEN 'prod-003' THEN '가격 대비 마감 좋음, 발볼 보통.'
         WHEN 'prod-004' THEN '상체 커버 좋음, 어깨 드롭 자연스러움.'
         WHEN 'prod-005' THEN '기장 적절, 구김 거의 없음, 사계절 무난.'
         WHEN 'prod-006' THEN '클래식 디자인, 착화감 좋음, 발볼 넓으면 반 사이즈 업.'
         WHEN 'prod-007' THEN '소재 좋음, 한 번 세탁 후 약간 줄어듦.'
         WHEN 'prod-008' THEN '하체 커버 좋음, 워싱 자연스러움.'
         WHEN 'prod-009' THEN '어깨 드롭 좋음, 데일리·오피스 모두 가능.'
         ELSE '리뷰 데이터를 보강 중입니다.'
       END,
       1,
       'true',
       '만족',
       '만족',
       NULL,
       NULL
FROM products p
WHERE p.public_id IN ('prod-001', 'prod-002', 'prod-003', 'prod-004', 'prod-005', 'prod-006', 'prod-007', 'prod-008', 'prod-009');
