BEGIN;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_data bytea;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_mime varchar(50);
DO $$ BEGIN
  ALTER TABLE app_user ADD CONSTRAINT avatar_consistency CHECK ((avatar_data IS NULL AND avatar_mime IS NULL) OR (avatar_data IS NOT NULL AND avatar_mime IN ('image/jpeg','image/png','image/webp')));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
COMMIT;
