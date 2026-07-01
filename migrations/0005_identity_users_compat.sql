ALTER TABLE users ADD COLUMN auth_subject TEXT;
ALTER TABLE users ADD COLUMN display_name_masked TEXT;
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_users_auth_subject ON users(auth_provider, auth_subject);
