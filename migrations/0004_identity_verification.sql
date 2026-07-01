CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth_provider TEXT,
  auth_subject TEXT,
  email_hash TEXT,
  phone_hash TEXT,
  display_name_masked TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);

CREATE TABLE IF NOT EXISTS identity_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK(verification_type IN ('real_name','phone_ownership','company_ownership','domain_ownership','manual_review')),
  provider TEXT NOT NULL DEFAULT 'manual_or_mock',
  status TEXT NOT NULL CHECK(status IN ('pending','verified','rejected','expired','cancelled')),
  subject_hash TEXT NOT NULL,
  subject_masked TEXT NOT NULL,
  evidence_ref TEXT,
  reviewed_by TEXT,
  review_note TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_identity_user_id ON identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_status ON identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_type ON identity_verifications(verification_type);
CREATE INDEX IF NOT EXISTS idx_identity_subject_hash ON identity_verifications(subject_hash);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  job_id TEXT,
  consent_type TEXT NOT NULL CHECK(consent_type IN ('personal_self_check','company_authorized_check','phone_deep_scan','data_retention','report_export')),
  consent_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('granted','revoked')),
  target_type TEXT,
  target_hash TEXT,
  target_masked TEXT,
  ip_hash TEXT,
  ua_hash TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_user_id ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_job_id ON consent_records(job_id);
CREATE INDEX IF NOT EXISTS idx_consent_target_hash ON consent_records(target_hash);
CREATE INDEX IF NOT EXISTS idx_consent_type_status ON consent_records(consent_type, status);

CREATE TABLE IF NOT EXISTS phone_verification_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  phone_hash TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  challenge_type TEXT NOT NULL CHECK(challenge_type IN ('sms_otp','manual_review','mock_dev')),
  status TEXT NOT NULL CHECK(status IN ('pending','verified','failed','expired')),
  code_hash TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phone_challenge_phone_hash ON phone_verification_challenges(phone_hash);
CREATE INDEX IF NOT EXISTS idx_phone_challenge_user_id ON phone_verification_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_challenge_status ON phone_verification_challenges(status);

CREATE TABLE IF NOT EXISTS data_retention_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  request_type TEXT NOT NULL CHECK(request_type IN ('export','delete','anonymize')),
  status TEXT NOT NULL CHECK(status IN ('pending','processing','completed','rejected')),
  scope TEXT NOT NULL,
  result_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_review_queue (
  id TEXT PRIMARY KEY,
  review_type TEXT NOT NULL,
  user_id TEXT,
  job_id TEXT,
  target_hash TEXT,
  target_masked TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
  reason TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_review_status ON admin_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_admin_review_user_id ON admin_review_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
