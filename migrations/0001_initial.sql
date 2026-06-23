create table if not exists users (id text primary key, auth_provider text, display_name text, email_hash text, phone_hash text, created_at text, updated_at text);
create table if not exists verified_identifiers (id text primary key, user_id text, type text, value_hash text, value_masked text, verification_status text, verification_method text, created_at text);
