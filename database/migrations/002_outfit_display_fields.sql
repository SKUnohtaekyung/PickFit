-- PickFit migration 002
-- Adds display fields to recommendation_outfits so re-fetched runs and saved outfits
-- can render with the same shape as freshly generated recommendations.

SET NAMES utf8mb4;

ALTER TABLE recommendation_outfits
  ADD COLUMN framing_label VARCHAR(120) NULL AFTER title,
  ADD COLUMN reasons_json JSON NULL AFTER reason_text,
  ADD COLUMN review_evidence TEXT NULL AFTER risk_notes_json;
