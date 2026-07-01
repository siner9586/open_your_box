import { canRunPhoneDeepScan } from '../identity/gating.js';
import { auditLog, checkRateLimit, getDb, id, now, tablePresence } from '../identity/repository.js';
import { getClientContextHash, isProductionEnv, maskGeneric, normalizeTarget, safeJson, sha256WithSalt } from '../identity/security.js';

const SCAN_TABLES = ['scan_jobs', 'scan_items', 'scan_evidence', 'adapter_runs', 'audit_logs', 'rate_limits'];
const IDENTITY_TABLES = ['users', 'identity_verifications', 'consent_records', 'phone_verification_challenges', 'data_retention_requests', 'admin_review_queue', 'user_sessions'];

export function json(data, status = 200) {
  return new Response(JSON.stringify(safeJson(data), null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function jsonError(code, status = 400, message = code) {
  return json({ ok: false, error: { code, message } }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function db(context) {
  return getDb(context.env || {});
}

function salt(env) {
  return env.SCAN_SALT || env.HASH_SALT || (isProductionEnv(env) ? '' : 'dev-only-local-salt');
}

function adminToken(context) {
  return context.request.headers.get('x-admin-token')
    || context.request.headers.get('x-cron-secret')
    || context.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || '';
}

export function requireAdmin(context) {
  const token = adminToken(context);
  const env = context.env || {};
  return Boolean(token && (token === env.ADMIN_TOKEN || token === env.CRON_SECRET));
}

async function insertJob(d1, job) {
  await d1.prepare(
    `INSERT INTO scan_jobs
     (id, user_id, mode, status, progress, total_items, completed_items, target_summary, error_code, error_message, created_at, updated_at, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)`
  ).bind(job.id, job.user_id, job.mode, job.status, job.progress, job.total_items, job.completed_items, job.target_summary, job.created_at, job.updated_at).run();
}

async function insertItem(d1, item) {
  await d1.prepare(
    `INSERT INTO scan_items
     (id, job_id, target_type, target_hash, target_masked, adapter_id, status, result_status, reason, evidence_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(item.id, item.job_id, item.target_type, item.target_hash, item.target_masked, item.adapter_id, item.status, item.result_status, item.reason, item.evidence_count, item.created_at, item.updated_at).run();
}

async function insertAdapterRun(d1, run) {
  await d1.prepare(
    `INSERT INTO adapter_runs
     (id, job_id, adapter_id, target_type, status, reason, error_message, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(run.id, run.job_id, run.adapter_id, run.target_type, run.status, run.reason || null, run.error_message || null, run.started_at || null, run.finished_at || null).run();
}

async function insertEvidence(d1, evidence) {
  await d1.prepare(
    `INSERT INTO scan_evidence
     (id, job_id, item_id, source, evidence_type, evidence_preview, evidence_ref, severity, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(evidence.id, evidence.job_id, evidence.item_id || null, evidence.source, evidence.evidence_type, evidence.evidence_preview, evidence.evidence_ref || null, evidence.severity, evidence.confidence, evidence.created_at).run();
}

function adapterForTarget(type, deep) {
  if (type === 'email') return 'email-demo-self-check';
  if (type === 'username') return 'username-demo-self-check';
  if (type === 'domain') return 'domain-demo-self-check';
  if (type === 'phone' && deep) return 'phone-deep-scan-gate';
  if (type === 'phone') return 'phone-reserved-safety';
  return 'unsupported-target';
}

export async function submitScan(context) {
  const env = context.env || {};
  const d1 = db(context);
  if (!d1?.prepare) return jsonError('DB_REQUIRED', 503, 'D1 binding DB is required.');
  const input = await readJson(context.request);
  const targets = Array.isArray(input.targets) ? input.targets : [];
  const maxTargets = Number(env.MAX_TARGETS_PER_JOB || 10);
  if (!targets.length) return jsonError('TARGETS_REQUIRED', 400, 'At least one target is required.');
  if (targets.length > maxTargets) return jsonError('TOO_MANY_TARGETS', 400, `At most ${maxTargets} targets are allowed.`);
  const contextHash = await getClientContextHash(context, env);
  const userId = input.user_id || null;
  const rate = await checkRateLimit(d1, { key: `scan_submit:${userId || contextHash.ip_hash}`, limit: Number(env.MAX_SUBMISSIONS_PER_HOUR || 20), window_seconds: 3600 });
  if (!rate.ok) return jsonError('RATE_LIMITED', 429, 'Too many scan submissions.');

  const jobId = id('scan');
  const timestamp = now();
  const normalizedTargets = targets.map(t => ({ type: String(t.type || '').toLowerCase(), value: normalizeTarget(t.type, t.value), mode: t.mode || input.mode || 'standard' })).filter(t => t.type && t.value);
  await insertJob(d1, {
    id: jobId,
    user_id: userId,
    mode: input.mode || 'standard',
    status: 'queued',
    progress: 0,
    total_items: normalizedTargets.length,
    completed_items: 0,
    target_summary: JSON.stringify(normalizedTargets.map(t => ({ type: t.type, masked: maskGeneric(t.value, t.type), mode: t.mode }))),
    created_at: timestamp,
    updated_at: timestamp
  });

  const items = [];
  for (const target of normalizedTargets) {
    const targetHash = await sha256WithSalt(target.value, salt(env));
    const targetMasked = maskGeneric(target.value, target.type);
    const wantsDeep = target.type === 'phone' && (target.mode === 'deep' || input.mode === 'deep');
    let adapterId = adapterForTarget(target.type, wantsDeep);
    let status = 'pending';
    let resultStatus = null;
    let reason = null;
    if (target.type === 'phone' && !wantsDeep) {
      status = 'completed';
      resultStatus = 'skipped';
      reason = 'PHONE_DEEP_SCAN_REQUIRES_VERIFIED_IDENTITY_PHONE_OWNERSHIP_AND_CONSENT';
    }
    if (wantsDeep) {
      const gate = await canRunPhoneDeepScan(userId, targetHash, env, d1, contextHash);
      if (!gate.ok) {
        adapterId = 'phone-reserved-safety';
        status = 'completed';
        resultStatus = 'skipped';
        reason = gate.code;
      }
    }
    const item = {
      id: id('item'),
      job_id: jobId,
      target_type: target.type,
      target_hash: targetHash,
      target_masked: targetMasked,
      adapter_id: adapterId,
      status,
      result_status: resultStatus,
      reason,
      evidence_count: 0,
      created_at: timestamp,
      updated_at: timestamp
    };
    await insertItem(d1, item);
    if (status === 'completed') {
      await insertAdapterRun(d1, { id: id('run'), job_id: jobId, adapter_id: adapterId, target_type: target.type, status: resultStatus || 'skipped', reason, started_at: timestamp, finished_at: timestamp });
    }
    items.push(item);
  }
  const completed = items.filter(item => item.status === 'completed').length;
  await d1.prepare('UPDATE scan_jobs SET completed_items=?, progress=?, status=?, updated_at=? WHERE id=?')
    .bind(completed, items.length ? Math.round((completed / items.length) * 100) : 100, completed === items.length ? 'completed' : 'queued', now(), jobId)
    .run();
  await auditLog(d1, { user_id: userId, action: 'scan_submitted', target_type: 'job', target_hash: jobId, ...contextHash });
  return json({ ok: true, status: completed === items.length ? 'completed' : 'queued', job_id: jobId, items: items.map(item => ({ id: item.id, target_type: item.target_type, target_masked: item.target_masked, adapter_id: item.adapter_id, status: item.status, result_status: item.result_status, reason: item.reason })) }, 202);
}

export async function scanStatus(context) {
  const d1 = db(context);
  const idParam = new URL(context.request.url).searchParams.get('id');
  if (!idParam) return jsonError('JOB_ID_REQUIRED', 400, 'id is required.');
  const job = await d1.prepare('SELECT id, user_id, mode, status, progress, total_items, completed_items, target_summary, error_code, error_message, created_at, updated_at, started_at, finished_at FROM scan_jobs WHERE id=?').bind(idParam).first();
  if (!job) return jsonError('JOB_NOT_FOUND', 404, 'Scan job was not found.');
  return json({ ok: true, job });
}

export async function scanResults(context) {
  const d1 = db(context);
  const idParam = new URL(context.request.url).searchParams.get('id');
  if (!idParam) return jsonError('JOB_ID_REQUIRED', 400, 'id is required.');
  const job = await d1.prepare('SELECT id, user_id, mode, status, progress, total_items, completed_items, target_summary, created_at, updated_at, started_at, finished_at FROM scan_jobs WHERE id=?').bind(idParam).first();
  if (!job) return jsonError('JOB_NOT_FOUND', 404, 'Scan job was not found.');
  const items = await d1.prepare('SELECT id, job_id, target_type, target_masked, adapter_id, status, result_status, reason, evidence_count, created_at, updated_at FROM scan_items WHERE job_id=? ORDER BY created_at').bind(idParam).all();
  const evidence = await d1.prepare('SELECT id, job_id, item_id, source, evidence_type, evidence_preview, evidence_ref, severity, confidence, created_at FROM scan_evidence WHERE job_id=? ORDER BY created_at').bind(idParam).all();
  const runs = await d1.prepare('SELECT id, job_id, adapter_id, target_type, status, reason, error_message, started_at, finished_at FROM adapter_runs WHERE job_id=? ORDER BY started_at').bind(idParam).all();
  return json({ ok: true, job, items: items.results || [], evidence: evidence.results || [], adapter_runs: runs.results || [] });
}

export async function scanAdapters() {
  return json({
    ok: true,
    adapters: [
      { id: 'email-demo-self-check', target_type: 'email', mode: 'demo', enabled: true, description: 'Hash/masked self-check demo evidence only.' },
      { id: 'username-demo-self-check', target_type: 'username', mode: 'demo', enabled: true, description: 'Username self-check demo adapter.' },
      { id: 'domain-demo-self-check', target_type: 'domain', mode: 'demo', enabled: true, description: 'Domain self-check demo adapter for authorized assets.' },
      { id: 'phone-reserved-safety', target_type: 'phone', mode: 'safety', enabled: true, description: 'Phone deep scan is reserved and skipped unless verified identity, ownership, consent, rate limit, and audit gates pass.' },
      { id: 'phone-deep-scan-gate', target_type: 'phone', mode: 'skeleton', enabled: false, description: 'Disabled by default. Even when enabled, first release only records limited gated status.' }
    ]
  });
}

async function processItem(d1, item) {
  const started = now();
  await insertAdapterRun(d1, { id: id('run'), job_id: item.job_id, adapter_id: item.adapter_id, target_type: item.target_type, status: 'running', started_at: started });
  let preview = 'Demo self-check adapter completed. No sensitive raw input is stored.';
  let result = 'no_high_risk_evidence';
  let severity = 'info';
  if (item.adapter_id === 'phone-deep-scan-gate') {
    preview = 'Phone deep scan gate passed; production first release records limited gated status only.';
    result = 'limited_gated_result';
  }
  if (item.adapter_id === 'unsupported-target') {
    preview = 'Unsupported target type skipped.';
    result = 'skipped';
  }
  await insertEvidence(d1, {
    id: id('ev'),
    job_id: item.job_id,
    item_id: item.id,
    source: item.adapter_id,
    evidence_type: 'adapter_status',
    evidence_preview: preview,
    evidence_ref: `${item.adapter_id}:${item.id}`,
    severity,
    confidence: 'medium',
    created_at: now()
  });
  await d1.prepare("UPDATE scan_items SET status='completed', result_status=?, evidence_count=1, updated_at=? WHERE id=?").bind(result, now(), item.id).run();
  await d1.prepare("UPDATE adapter_runs SET status='completed', reason=?, finished_at=? WHERE job_id=? AND adapter_id=? AND target_type=? AND status='running'")
    .bind(result, now(), item.job_id, item.adapter_id, item.target_type)
    .run();
}

export async function runPending(context) {
  if (!requireAdmin(context)) return jsonError('ADMIN_REQUIRED', 401, 'ADMIN_TOKEN or CRON_SECRET required.');
  const d1 = db(context);
  const max = Number(context.env?.MAX_ITEMS_PER_RUN || 25);
  const rows = await d1.prepare("SELECT * FROM scan_items WHERE status='pending' ORDER BY created_at LIMIT ?").bind(max).all();
  const items = rows.results || [];
  for (const item of items) await processItem(d1, item);
  const jobIds = [...new Set(items.map(item => item.job_id))];
  for (const jobId of jobIds) {
    const counts = await d1.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed FROM scan_items WHERE job_id=?").bind(jobId).first();
    const total = Number(counts.total || 0);
    const completed = Number(counts.completed || 0);
    await d1.prepare('UPDATE scan_jobs SET completed_items=?, progress=?, status=?, started_at=COALESCE(started_at, ?), finished_at=?, updated_at=? WHERE id=?')
      .bind(completed, total ? Math.round((completed / total) * 100) : 100, completed >= total ? 'completed' : 'running', now(), completed >= total ? now() : null, now(), jobId)
      .run();
  }
  return json({ ok: true, processed: items.length, fallback: 'd1_pending', job_ids: jobIds });
}

export async function health(context = {}) {
  const env = context.env || {};
  const d1 = db(context);
  const scanTables = await tablePresence(d1, SCAN_TABLES);
  const identityTables = await tablePresence(d1, IDENTITY_TABLES);
  const requiredSecrets = {
    SCAN_SALT: env.SCAN_SALT ? 'present' : 'missing',
    CRON_SECRET: env.CRON_SECRET ? 'present' : 'missing',
    ADMIN_TOKEN: env.ADMIN_TOKEN ? 'present' : 'missing'
  };
  const optionalSecrets = {
    SHODAN_API_KEY: env.SHODAN_API_KEY ? 'present' : 'missing',
    HIBP_API_KEY: env.HIBP_API_KEY ? 'present' : 'missing',
    VIRUSTOTAL_API_KEY: env.VIRUSTOTAL_API_KEY ? 'present' : 'missing',
    GITHUB_TOKEN: env.GITHUB_TOKEN ? 'present' : 'missing',
    IDENTITY_PROVIDER_API_KEY: env.IDENTITY_PROVIDER_API_KEY ? 'present' : 'missing'
  };
  const variables = {
    ENABLE_PHONE_DEEP_SCAN: env.ENABLE_PHONE_DEEP_SCAN || 'false',
    ENABLE_DEMO_ADAPTERS: env.ENABLE_DEMO_ADAPTERS || 'true',
    MAX_TARGETS_PER_JOB: env.MAX_TARGETS_PER_JOB || '10',
    MAX_ITEMS_PER_RUN: env.MAX_ITEMS_PER_RUN || '25',
    MAX_SUBMISSIONS_PER_HOUR: env.MAX_SUBMISSIONS_PER_HOUR || '20',
    IDENTITY_PROVIDER_MODE: env.IDENTITY_PROVIDER_MODE || 'manual',
    ALLOW_DEV_LOGIN: env.ALLOW_DEV_LOGIN || 'false',
    DATA_RETENTION_DAYS: env.DATA_RETENTION_DAYS || '30'
  };
  const scanOk = Object.values(scanTables).every(Boolean);
  const identityOk = Object.values(identityTables).every(Boolean);
  const requiredSecretsOk = Object.values(requiredSecrets).every(v => v === 'present');
  const variablesOk = variables.ENABLE_PHONE_DEEP_SCAN === 'false' && variables.IDENTITY_PROVIDER_MODE === 'manual' && variables.ALLOW_DEV_LOGIN === 'false';
  return json({
    ok: Boolean(d1) && scanOk && identityOk && requiredSecretsOk && variablesOk,
    env: env.CF_PAGES_BRANCH || env.ENVIRONMENT || 'unknown',
    db: { present: Boolean(d1) },
    tables: { scan: scanTables, identity: identityTables },
    secrets: { ...requiredSecrets, ...optionalSecrets },
    variables,
    queue: { present: Boolean(env.SCAN_QUEUE) },
    fallback: { d1_pending: Boolean(d1) }
  });
}
