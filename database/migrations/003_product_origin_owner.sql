-- PickFit migration 003
-- Adds origin / ownership / crawl-job lineage to products so that batch-ingested
-- catalog (e.g. Musinsa) and user-submitted URL crawls can coexist with seed data
-- without leaking personal crawls across users.
--
-- origin_type semantics:
--   seed     — bundled mock catalog (seed.pickfit.local rows, Phase 1 source)
--   batch    — operator batch ingest (e.g. Musinsa PLP API), public to all users
--   user_url — submitted by a single user via /api/catalog/analyze-url, owner-scoped
--
-- Visibility contract (enforced in ProductRepository, not in DB):
--   - /api/products list/detail: owner_user_id IS NULL (public browse never leaks user crawls)
--   - findRecommendationCandidates(userId): seed/batch always, plus the caller's own
--     user_url rows (origin_type='user_url' AND owner_user_id = :userId). Orphaned
--     user_url rows (owner_user_id IS NULL) are excluded to prevent cross-user leakage.

SET NAMES utf8mb4;

ALTER TABLE products
  ADD COLUMN origin_type ENUM('seed', 'batch', 'user_url') NOT NULL DEFAULT 'batch' AFTER source_domain,
  ADD COLUMN owner_user_id BIGINT UNSIGNED NULL AFTER origin_type,
  ADD COLUMN crawl_job_id BIGINT UNSIGNED NULL AFTER owner_user_id;

ALTER TABLE products
  ADD INDEX idx_products_origin_owner (origin_type, owner_user_id);

ALTER TABLE products
  ADD CONSTRAINT fk_products_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_products_crawl_job
    FOREIGN KEY (crawl_job_id) REFERENCES crawl_jobs(id) ON DELETE SET NULL;

-- Retroactively tag bundled seed rows.
UPDATE products
SET origin_type = 'seed'
WHERE source_domain = 'seed.pickfit.local';

-- Retroactively tag any pre-existing crawler rows (Day 7 BETA) as user_url.
-- owner_user_id stays NULL because we can't reconstruct who submitted them — the
-- crawl_jobs table is the audit trail. New crawls (post-migration) will set owner.
UPDATE products
SET origin_type = 'user_url'
WHERE source_domain <> 'seed.pickfit.local'
  AND source_url IS NOT NULL
  AND origin_type = 'batch';
