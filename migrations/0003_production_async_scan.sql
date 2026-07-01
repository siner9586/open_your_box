CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  mode TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  target_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS scan_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_hash TEXT NOT NULL,
  target_masked TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result_status TEXT,
  reason TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_evidence (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  item_id TEXT,
  source TEXT,
  evidence_type TEXT,
  evidence_preview TEXT,
  evidence_ref TEXT,
  severity TEXT,
  confidence TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adapter_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  target_type TEXT,
  status TEXT,
  reason TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT,
  target_type TEXT,
  target_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT,
  bucket TEXT,
  count INTEGER,
  reset_at TEXT,
  PRIMARY KEY (key, bucket)
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_user_id ON scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scan_items_job_id ON scan_items(job_id);
CREATE INDEX IF NOT EXISTS idx_scan_items_status ON scan_items(status);
CREATE INDEX IF NOT EXISTS idx_scan_evidence_job_id ON scan_evidence(job_id);
CREATE INDEX IF NOT EXISTS idx_adapter_runs_job_id ON adapter_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_bucket ON rate_limits(key, bucket);
