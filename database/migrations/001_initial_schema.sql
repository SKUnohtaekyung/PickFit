-- PickFit initial schema
-- MySQL 8+, InnoDB, utf8mb4.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  gender_expression VARCHAR(40) NULL,
  preferred_size_top VARCHAR(20) NULL,
  preferred_size_bottom VARCHAR(20) NULL,
  preferred_shoe_size VARCHAR(20) NULL,
  default_budget_min INT NULL,
  default_budget_max INT NULL,
  taste_memory_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_profiles_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  source_url TEXT NULL,
  source_domain VARCHAR(255) NULL,
  brand_name VARCHAR(120) NULL,
  seller_name VARCHAR(120) NULL,
  category_main VARCHAR(80) NOT NULL,
  category_sub VARCHAR(80) NULL,
  gender_target VARCHAR(40) NULL,
  product_name VARCHAR(255) NOT NULL,
  hero_image_url TEXT NULL,
  product_page_url TEXT NULL,
  price_original INT NULL,
  price_sale INT NULL,
  discount_rate DECIMAL(5,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KRW',
  stock_status ENUM('in_stock', 'low_stock', 'sold_out', 'unknown') NOT NULL DEFAULT 'unknown',
  fit_type VARCHAR(40) NULL,
  silhouette VARCHAR(80) NULL,
  material_main VARCHAR(120) NULL,
  material_sub VARCHAR(255) NULL,
  thickness VARCHAR(40) NULL,
  opacity VARCHAR(40) NULL,
  stretch VARCHAR(40) NULL,
  seasonality VARCHAR(80) NULL,
  color_family VARCHAR(80) NULL,
  style_tags JSON NULL,
  occasion_tags JSON NULL,
  body_type_notes JSON NULL,
  shipping_fee INT NULL,
  free_shipping_threshold INT NULL,
  estimated_shipping_days VARCHAR(40) NULL,
  returnable TINYINT(1) NULL,
  return_fee INT NULL,
  exchange_fee INT NULL,
  policy_note TEXT NULL,
  data_quality_score DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category (category_main, category_sub),
  INDEX idx_products_source_domain (source_domain),
  INDEX idx_products_stock (stock_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  public_id VARCHAR(64) NOT NULL UNIQUE,
  color_name VARCHAR(80) NULL,
  color_code_normalized VARCHAR(40) NULL,
  size_label VARCHAR(40) NULL,
  size_system VARCHAR(40) NULL,
  stock_status ENUM('in_stock', 'low_stock', 'sold_out', 'unknown') NOT NULL DEFAULT 'unknown',
  variant_url TEXT NULL,
  variant_image_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_variants_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS product_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  media_type ENUM('image', 'screenshot') NOT NULL,
  url TEXT NOT NULL,
  local_path TEXT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_media_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_media_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  public_id VARCHAR(64) NOT NULL UNIQUE,
  rating DECIMAL(3,2) NULL,
  review_text TEXT NULL,
  created_at_source DATETIME NULL,
  verified_purchase TINYINT(1) NULL,
  reviewer_height INT NULL,
  reviewer_weight INT NULL,
  usual_size VARCHAR(40) NULL,
  purchased_size VARCHAR(40) NULL,
  size_runs ENUM('small', 'true', 'large', 'unknown') NOT NULL DEFAULT 'unknown',
  fit_satisfaction VARCHAR(80) NULL,
  material_satisfaction VARCHAR(80) NULL,
  complaint_tags JSON NULL,
  praise_tags JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_reviews_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  input_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  source_domain VARCHAR(255) NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed', 'blocked') NOT NULL DEFAULT 'queued',
  adapter_name VARCHAR(80) NOT NULL DEFAULT 'generic',
  error_code VARCHAR(80) NULL,
  error_message TEXT NULL,
  raw_result_json JSON NULL,
  artifact_dir TEXT NULL,
  product_id BIGINT UNSIGNED NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_crawl_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_crawl_jobs_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_crawl_jobs_user_status (user_id, status),
  INDEX idx_crawl_jobs_domain (source_domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recommendation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
  input_conditions_json JSON NOT NULL,
  candidate_product_ids_json JSON NOT NULL,
  model_name VARCHAR(120) NULL,
  model_response_id VARCHAR(255) NULL,
  model_usage_json JSON NULL,
  confidence DECIMAL(4,3) NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recommendation_runs_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recommendation_outfits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  run_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  summary TEXT NULL,
  reason_text TEXT NULL,
  evidence_json JSON NULL,
  risk_notes_json JSON NULL,
  total_price INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  confidence DECIMAL(4,3) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_outfits_run FOREIGN KEY (run_id) REFERENCES recommendation_runs(id) ON DELETE CASCADE,
  INDEX idx_recommendation_outfits_run (run_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS recommendation_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  outfit_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  slot ENUM('top', 'bottom', 'outer', 'shoes', 'accessory') NOT NULL,
  selected_variant_id BIGINT UNSIGNED NULL,
  alternative_product_ids_json JSON NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recommendation_items_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE CASCADE,
  CONSTRAINT fk_recommendation_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_recommendation_items_variant FOREIGN KEY (selected_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  INDEX idx_recommendation_items_outfit (outfit_id),
  INDEX idx_recommendation_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS saved_outfits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  outfit_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_outfits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_outfits_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved_outfits_user_outfit (user_id, outfit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS feedback_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  outfit_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  feedback_type VARCHAR(80) NOT NULL,
  tags_json JSON NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_events_outfit FOREIGN KEY (outfit_id) REFERENCES recommendation_outfits(id) ON DELETE SET NULL,
  CONSTRAINT fk_feedback_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_feedback_events_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
