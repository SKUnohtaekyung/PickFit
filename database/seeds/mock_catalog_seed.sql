-- PickFit mock catalog seed
-- Source: js/data/mock.js PRODUCTS
-- Requires: database/migrations/001_initial_schema.sql catalog tables.

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
('prod-001', NULL, 'seed.pickfit.local', 'STANDARD.O', 'PickFit Seed Catalog', 'top', 'shirt', 'unisex', 'Slim Fit Cotton Shirt', '/assets/products/shirt_white.webp', '#', 59000, 49000, 17.00, 'KRW', 'in_stock', 'slim', 'straight shirt', 'cotton blend', 'cotton 60%, polyester 40%', 'medium', 'opaque', 'low', 'spring/fall', 'white', JSON_ARRAY('minimal', 'clean', 'office'), JSON_ARRAY('office', 'interview', 'daily'), JSON_ARRAY('regular sizing', 'clean shoulder line'), 0, NULL, '2 days', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.780, UTC_TIMESTAMP()),
('prod-002', NULL, 'seed.pickfit.local', 'MUSINSA STANDARD', 'PickFit Seed Catalog', 'bottom', 'slacks', 'unisex', 'Black Wide Slacks', '/assets/products/slacks_black.webp', '#', 39000, 39000, 0.00, 'KRW', 'in_stock', 'regular', 'wide straight', 'polyester blend', 'polyester 80%, rayon 20%', 'medium', 'opaque', 'medium', 'all-season', 'black', JSON_ARRAY('minimal', 'clean', 'office'), JSON_ARRAY('office', 'interview', 'daily'), JSON_ARRAY('comfortable waist', 'straight leg balance'), 0, NULL, '2 days', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.820, UTC_TIMESTAMP()),
('prod-003', NULL, 'seed.pickfit.local', 'COMMON PROJECTS', 'PickFit Seed Catalog', 'shoes', 'derby', 'unisex', 'Minimal Derby Shoes', '/assets/products/shoes_black.webp', '#', 49000, 39000, 20.00, 'KRW', 'in_stock', 'true_to_size', 'minimal derby', 'synthetic leather', NULL, NULL, NULL, 'none', 'spring/fall', 'black', JSON_ARRAY('minimal', 'classic', 'office'), JSON_ARRAY('office', 'date', 'interview'), JSON_ARRAY('stable formal base', 'average foot width'), 3000, NULL, '3 days', 1, 3000, 3000, 'Seeded mock return policy. Confirm seller page before purchase.', 0.720, UTC_TIMESTAMP()),
('prod-004', NULL, 'seed.pickfit.local', 'DEPOUND', 'PickFit Seed Catalog', 'top', 'knit', 'unisex', 'Relaxed Oversized Knit', '/assets/products/knit_beige.webp', '#', 68000, 58000, 15.00, 'KRW', 'in_stock', 'oversized', 'relaxed knit', 'acrylic wool blend', 'acrylic 50%, wool 30%, nylon 20%', 'thick', 'opaque', 'high', 'fall/winter', 'beige', JSON_ARRAY('soft', 'casual', 'body_compensating'), JSON_ARRAY('daily', 'office', 'date'), JSON_ARRAY('upper body coverage', 'soft shoulder line'), 0, NULL, '2 days', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.800, UTC_TIMESTAMP()),
('prod-005', NULL, 'seed.pickfit.local', 'UNIQLO', 'PickFit Seed Catalog', 'bottom', 'pants', 'unisex', 'Smart Tech Pants', '/assets/products/pants_navy.webp', '#', 49900, 49900, 0.00, 'KRW', 'in_stock', 'regular', 'tapered pants', 'polyester cotton blend', 'polyester 65%, cotton 35%', 'medium', 'opaque', 'medium', 'all-season', 'navy', JSON_ARRAY('clean', 'value', 'office'), JSON_ARRAY('office', 'travel', 'daily'), JSON_ARRAY('low fit risk', 'balanced length'), 0, NULL, '1 day', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.860, UTC_TIMESTAMP()),
('prod-006', NULL, 'seed.pickfit.local', 'NIKE', 'PickFit Seed Catalog', 'shoes', 'sneakers', 'unisex', 'Air Force 1 Low', '/assets/products/sneakers_white.webp', '#', 69000, 59000, 14.00, 'KRW', 'in_stock', 'true_to_size', 'low sneakers', 'leather blend', 'natural leather, synthetic leather', NULL, NULL, 'none', 'all-season', 'white', JSON_ARRAY('casual', 'classic', 'clean'), JSON_ARRAY('daily', 'travel', 'casual'), JSON_ARRAY('wide foot may size up', 'classic casual base'), 0, NULL, '1 day', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.880, UTC_TIMESTAMP()),
('prod-007', NULL, 'seed.pickfit.local', 'COS', 'PickFit Seed Catalog', 'top', 'tshirt', 'unisex', 'Regular Fit T-Shirt', '/assets/products/tshirt_gray.webp', '#', 39000, 29000, 26.00, 'KRW', 'in_stock', 'regular', 'regular tee', 'cotton', 'cotton 100%', 'medium', 'slightly sheer', 'low', 'spring/summer', 'gray', JSON_ARRAY('clean', 'value', 'casual'), JSON_ARRAY('daily', 'casual', 'travel'), JSON_ARRAY('regular body fit', 'low styling risk'), 3000, NULL, '3 days', 1, 5000, 5000, 'Seeded mock return policy. Confirm seller page before purchase.', 0.740, UTC_TIMESTAMP()),
('prod-008', NULL, 'seed.pickfit.local', 'MUSINSA STANDARD', 'PickFit Seed Catalog', 'bottom', 'denim', 'unisex', 'Wide Denim Pants', '/assets/products/denim_blue.webp', '#', 55000, 45000, 18.00, 'KRW', 'in_stock', 'wide', 'wide denim', 'cotton stretch denim', 'cotton 98%, span 2%', 'thick', 'opaque', 'low', 'spring/fall', 'denim blue', JSON_ARRAY('casual', 'body_compensating', 'street'), JSON_ARRAY('daily', 'travel', 'casual'), JSON_ARRAY('lower body coverage', 'natural washing'), 0, NULL, '2 days', 1, 2500, 2500, 'Seeded mock return policy. Confirm seller page before purchase.', 0.790, UTC_TIMESTAMP()),
('prod-009', NULL, 'seed.pickfit.local', 'ANDERSSON BELL', 'PickFit Seed Catalog', 'outer', 'blazer', 'unisex', 'Oversized Blazer', '/assets/products/blazer_charcoal.webp', '#', 119000, 89000, 25.00, 'KRW', 'in_stock', 'oversized', 'structured blazer', 'polyester rayon blend', 'polyester 70%, rayon 30%', 'medium', 'opaque', 'low', 'spring/fall', 'charcoal', JSON_ARRAY('classic', 'office', 'chic'), JSON_ARRAY('office', 'interview', 'date'), JSON_ARRAY('shoulder coverage', 'smart casual layering'), 0, NULL, '3 days', 1, 0, 0, 'Seeded mock return policy. Confirm seller page before purchase.', 0.800, UTC_TIMESTAMP());

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
SELECT id, 'image', hero_image_url, hero_image_url, CONCAT(product_name, ' product image'), 0
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
) VALUES
((SELECT id FROM products WHERE public_id = 'prod-001'), 'rev-prod-001-summary', 4.30, 'True-to-size shirt with a slim but not tight fit. Mock review summary.', 1, 'true', 'good', 'good', JSON_ARRAY('shoulder width caution'), JSON_ARRAY('clean fit', 'office ready')),
((SELECT id FROM products WHERE public_id = 'prod-002'), 'rev-prod-002-summary', 4.50, 'Good length, stable construction, and enough leg room. Mock review summary.', 1, 'true', 'good', 'good', JSON_ARRAY('length check needed'), JSON_ARRAY('easy office styling')),
((SELECT id FROM products WHERE public_id = 'prod-003'), 'rev-prod-003-summary', 4.10, 'Good finish for the price and average foot comfort. Mock review summary.', 1, 'true', 'average', 'good', JSON_ARRAY('break-in needed'), JSON_ARRAY('minimal formal look')),
((SELECT id FROM products WHERE public_id = 'prod-004'), 'rev-prod-004-summary', 4.40, 'Strong upper body coverage with a relaxed natural line. Mock review summary.', 1, 'large', 'good', 'good', JSON_ARRAY('knit care needed'), JSON_ARRAY('body coverage')),
((SELECT id FROM products WHERE public_id = 'prod-005'), 'rev-prod-005-summary', 4.60, 'Practical length, low construction risk, and easy styling. Mock review summary.', 1, 'true', 'good', 'good', JSON_ARRAY('simple design'), JSON_ARRAY('low risk basic')),
((SELECT id FROM products WHERE public_id = 'prod-006'), 'rev-prod-006-summary', 4.70, 'Classic design with good cushioning; wide feet may size up. Mock review summary.', 1, 'true', 'good', 'good', JSON_ARRAY('wide foot size up'), JSON_ARRAY('classic versatility')),
((SELECT id FROM products WHERE public_id = 'prod-007'), 'rev-prod-007-summary', 4.20, 'Good fabric feel with possible shrinkage after washing. Mock review summary.', 1, 'true', 'average', 'good', JSON_ARRAY('washing shrink risk'), JSON_ARRAY('value basic')),
((SELECT id FROM products WHERE public_id = 'prod-008'), 'rev-prod-008-summary', 4.30, 'Good lower body coverage and natural washing. Mock review summary.', 1, 'large', 'good', 'good', JSON_ARRAY('size down may help'), JSON_ARRAY('lower body coverage')),
((SELECT id FROM products WHERE public_id = 'prod-009'), 'rev-prod-009-summary', 4.50, 'Good shoulder coverage and works for styling or office looks. Mock review summary.', 1, 'large', 'good', 'good', JSON_ARRAY('oversized fit caution'), JSON_ARRAY('smart casual layering'));
