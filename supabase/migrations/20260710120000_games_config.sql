ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS games_config jsonb DEFAULT '{}'::jsonb;
