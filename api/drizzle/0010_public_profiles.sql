ALTER TABLE users ADD COLUMN IF NOT EXISTS public_profile_enabled boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_slug text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_show_stats boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_show_photos boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_show_program boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_show_nutrition boolean DEFAULT false;
ALTER TABLE progress_photos ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
