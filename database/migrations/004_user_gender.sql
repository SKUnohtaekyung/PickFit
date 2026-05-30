-- 004_user_gender.sql
-- Capture the user's clothing gender at registration so recommendations can
-- filter the catalog (women's vs men's vs unisex). Nullable so existing users
-- (created before this column) keep working — a null gender means "no filter".

ALTER TABLE users
  ADD COLUMN gender VARCHAR(20) NULL AFTER display_name;
