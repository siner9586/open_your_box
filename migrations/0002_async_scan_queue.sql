create table if not exists scan_queue (
  id text primary key,
  job_id text not null,
  user_id text not null,
  scan_type text not null,
  platform_id text,
  platform_name text,
  region text,
  identifier_type text,
  identifier_masked text,
  target_url text,
  status text not null default 'pending',
  http_status integer,
  result_status text,
  evidence_preview text,
  error_message text,
  created_at text,
  updated_at text
);

create index if not exists scan_queue_job_status_idx on scan_queue(job_id, status);
create index if not exists scan_queue_job_idx on scan_queue(job_id);
