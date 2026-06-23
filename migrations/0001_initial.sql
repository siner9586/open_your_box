create table if not exists users (id text primary key, auth_provider text, display_name text, email_hash text, phone_hash text, created_at text, updated_at text);
create table if not exists verified_identifiers (id text primary key, user_id text, type text, value_hash text, value_masked text, verification_status text, verification_method text, created_at text);
create table if not exists jobs (id text primary key, user_id text, subject_type text, subject_hash text, mode text, status text, progress integer, started_at text, finished_at text, error_message text, created_at text);
create table if not exists findings (id text primary key, job_id text, user_id text, source text, category text, severity text, confidence text, title text, summary text, evidence_type text, evidence_preview text, evidence_ref text, remediation_json text, created_at text);
create table if not exists account_tasks (id text primary key, user_id text, platform_id text, platform_name text, account_status text, task_type text, task_status text, action_url text, notes text, created_at text, updated_at text);
create table if not exists company_assets (id text primary key, user_id text, company_id text, asset_type text, asset_hash text, asset_masked text, verification_status text, created_at text);
create table if not exists audit_logs (id text primary key, user_id text, action text, target_type text, target_hash text, ip_hash text, user_agent_hash text, created_at text);
create table if not exists rate_limits (key text, bucket text, count integer, reset_at text, primary key (key, bucket));
create table if not exists reports (id text primary key, user_id text, job_id text, report_type text, risk_score integer, report_json text, created_at text);
