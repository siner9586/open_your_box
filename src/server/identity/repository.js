export const now = () => new Date().toISOString();

export function id(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const getDb = env => env?.DB || env?.OYB_DB || env?.OYB_DATABASE || null;

function requireDb(db) {
  if (!db?.prepare) throw new Error('D1_DB_REQUIRED');
  return db;
}

async function first(db, sql, ...params) {
  return requireDb(db).prepare(sql).bind(...params).first();
}

async function run(db, sql, ...params) {
  return requireDb(db).prepare(sql).bind(...params).run();
}

export async function tablePresence(db, tableNames = []) {
  if (!db?.prepare) return Object.fromEntries(tableNames.map(name => [name, false]));
  const result = {};
  for (const table of tableNames) {
    const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
    result[table] = Boolean(row);
  }
  return result;
}

export async function createOrGetUser(db, input = {}) {
  const timestamp = now();
  const authProvider = input.auth_provider || 'local';
  const authSubject = input.auth_subject || input.id || id('subject');
  if (input.id) {
    const existingById = await first(db, 'SELECT * FROM users WHERE id=? LIMIT 1', input.id);
    if (existingById) return existingById;
  }
  let user = await first(db, 'SELECT * FROM users WHERE auth_provider=? AND auth_subject=? LIMIT 1', authProvider, authSubject);
  if (!user && input.email_hash) user = await first(db, 'SELECT * FROM users WHERE email_hash=? LIMIT 1', input.email_hash);
  if (user) return user;
  const userId = input.id || id('usr');
  await run(
    db,
    `INSERT INTO users (id, auth_provider, auth_subject, email_hash, phone_hash, display_name_masked, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    userId,
    authProvider,
    authSubject,
    input.email_hash || null,
    input.phone_hash || null,
    input.display_name_masked || null,
    timestamp,
    timestamp
  );
  return first(db, 'SELECT * FROM users WHERE id=?', userId);
}

export async function createSession(db, input = {}) {
  const sessionId = input.id || id('sess');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO user_sessions (id, user_id, token_hash, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?)`,
    sessionId,
    input.user_id,
    input.token_hash,
    timestamp,
    timestamp
  );
  return { id: sessionId, user_id: input.user_id, status: 'active', created_at: timestamp };
}

export async function getSessionUser(db, tokenHash) {
  if (!tokenHash) return null;
  return first(
    db,
    `SELECT users.* FROM user_sessions
     JOIN users ON users.id = user_sessions.user_id
     WHERE user_sessions.token_hash=? AND user_sessions.status='active'
     LIMIT 1`,
    tokenHash
  );
}

export async function createIdentityVerification(db, input = {}) {
  const verificationId = input.id || id('iv');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO identity_verifications
     (id, user_id, verification_type, provider, status, subject_hash, subject_masked, evidence_ref, reviewed_by, review_note, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    verificationId,
    input.user_id,
    input.verification_type,
    input.provider || 'manual',
    input.status || 'pending',
    input.subject_hash,
    input.subject_masked,
    input.evidence_ref || null,
    input.reviewed_by || null,
    input.review_note || null,
    input.expires_at || null,
    timestamp,
    timestamp
  );
  return first(db, 'SELECT * FROM identity_verifications WHERE id=?', verificationId);
}

export async function getIdentityVerificationStatus(db, userId, verificationType, subjectHash = null) {
  const params = [userId, verificationType];
  let sql = `SELECT * FROM identity_verifications WHERE user_id=? AND verification_type=?`;
  if (subjectHash) {
    sql += ' AND subject_hash=?';
    params.push(subjectHash);
  }
  sql += ` ORDER BY CASE status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, updated_at DESC LIMIT 1`;
  const row = await first(db, sql, ...params);
  return row || { status: 'missing' };
}

export async function createConsentRecord(db, input = {}) {
  const consentId = input.id || id('consent');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO consent_records
     (id, user_id, job_id, consent_type, consent_version, status, target_type, target_hash, target_masked, ip_hash, ua_hash, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, 'granted', ?, ?, ?, ?, ?, ?, NULL)`,
    consentId,
    input.user_id || null,
    input.job_id || null,
    input.consent_type,
    input.consent_version || '2026-07-01',
    input.target_type || null,
    input.target_hash || null,
    input.target_masked || null,
    input.ip_hash || null,
    input.ua_hash || null,
    timestamp
  );
  return first(db, 'SELECT * FROM consent_records WHERE id=?', consentId);
}

export async function revokeConsent(db, input = {}) {
  const timestamp = now();
  await run(
    db,
    `UPDATE consent_records SET status='revoked', revoked_at=?
     WHERE user_id=? AND consent_type=? AND status='granted'
       AND (? IS NULL OR target_hash=?)`,
    timestamp,
    input.user_id,
    input.consent_type,
    input.target_hash || null,
    input.target_hash || null
  );
  return { revoked: true, revoked_at: timestamp };
}

export async function hasConsent(db, userId, consentType, targetHash = null) {
  const row = await first(
    db,
    `SELECT id FROM consent_records
     WHERE user_id=? AND consent_type=? AND status='granted'
       AND (? IS NULL OR target_hash=?)
     ORDER BY created_at DESC LIMIT 1`,
    userId,
    consentType,
    targetHash,
    targetHash
  );
  return Boolean(row);
}

export async function createPhoneChallenge(db, input = {}) {
  const challengeId = input.id || id('phone_ch');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO phone_verification_challenges
     (id, user_id, phone_hash, phone_masked, challenge_type, status, code_hash, attempt_count, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?)`,
    challengeId,
    input.user_id,
    input.phone_hash,
    input.phone_masked,
    input.challenge_type || 'manual_review',
    input.code_hash || null,
    input.expires_at,
    timestamp,
    timestamp
  );
  return first(db, 'SELECT * FROM phone_verification_challenges WHERE id=?', challengeId);
}

export async function verifyPhoneChallenge(db, input = {}) {
  const challenge = await first(db, 'SELECT * FROM phone_verification_challenges WHERE id=? LIMIT 1', input.challenge_id);
  if (!challenge) return { ok: false, code: 'PHONE_CHALLENGE_NOT_FOUND' };
  if (challenge.status !== 'pending') return { ok: false, code: 'PHONE_CHALLENGE_NOT_PENDING', status: challenge.status };
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    await run(db, "UPDATE phone_verification_challenges SET status='expired', updated_at=? WHERE id=?", now(), challenge.id);
    return { ok: false, code: 'PHONE_CHALLENGE_EXPIRED' };
  }
  if (input.code_hash && challenge.code_hash && input.code_hash === challenge.code_hash) {
    const timestamp = now();
    await run(db, "UPDATE phone_verification_challenges SET status='verified', updated_at=? WHERE id=?", timestamp, challenge.id);
    await createIdentityVerification(db, {
      user_id: challenge.user_id,
      verification_type: 'phone_ownership',
      provider: 'mock-dev-identity-provider',
      status: 'verified',
      subject_hash: challenge.phone_hash,
      subject_masked: challenge.phone_masked,
      evidence_ref: challenge.id
    });
    return { ok: true, status: 'verified', phone_hash: challenge.phone_hash, phone_masked: challenge.phone_masked };
  }
  await run(db, 'UPDATE phone_verification_challenges SET attempt_count=attempt_count+1, updated_at=? WHERE id=?', now(), challenge.id);
  return { ok: false, code: 'PHONE_MANUAL_REVIEW_PENDING', status: 'pending' };
}

export async function getUserVerificationSummary(db, userId) {
  const real = await getIdentityVerificationStatus(db, userId, 'real_name');
  const phone = await getIdentityVerificationStatus(db, userId, 'phone_ownership');
  const consents = await requireDb(db)
    .prepare("SELECT consent_type, status, target_type, target_masked, created_at, revoked_at FROM consent_records WHERE user_id=? ORDER BY created_at DESC LIMIT 50")
    .bind(userId)
    .all();
  return {
    real_name: real.status || 'missing',
    phone_ownership: phone.status || 'missing',
    consents: consents.results || []
  };
}

export async function createRetentionRequest(db, input = {}) {
  const requestId = input.id || id('privacy');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO data_retention_requests (id, user_id, request_type, status, scope, result_ref, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    requestId,
    input.user_id || null,
    input.request_type,
    input.scope || 'self',
    input.result_ref || null,
    timestamp,
    timestamp
  );
  return first(db, 'SELECT * FROM data_retention_requests WHERE id=?', requestId);
}

export async function createAdminReviewItem(db, input = {}) {
  const reviewId = input.id || id('review');
  const timestamp = now();
  await run(
    db,
    `INSERT INTO admin_review_queue (id, review_type, user_id, job_id, target_hash, target_masked, status, reason, reviewer, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`,
    reviewId,
    input.review_type,
    input.user_id || null,
    input.job_id || null,
    input.target_hash || null,
    input.target_masked || null,
    input.reason || null,
    timestamp,
    timestamp
  );
  return first(db, 'SELECT * FROM admin_review_queue WHERE id=?', reviewId);
}

export async function listAdminReviews(db, { status = 'pending', limit = 50 } = {}) {
  const rows = await requireDb(db)
    .prepare(`SELECT id, review_type, user_id, job_id, target_masked, status, reason, reviewer, created_at, updated_at
              FROM admin_review_queue WHERE status=? ORDER BY created_at DESC LIMIT ?`)
    .bind(status, Math.min(Number(limit) || 50, 100))
    .all();
  return rows.results || [];
}

export async function decideAdminReview(db, input = {}) {
  const review = await first(db, 'SELECT * FROM admin_review_queue WHERE id=? LIMIT 1', input.review_id);
  if (!review) return { ok: false, code: 'REVIEW_NOT_FOUND' };
  const approved = input.decision === 'approved' || input.decision === 'approve';
  const status = approved ? 'approved' : 'rejected';
  const verificationStatus = approved ? 'verified' : 'rejected';
  const timestamp = now();
  await run(db, 'UPDATE admin_review_queue SET status=?, reviewer=?, updated_at=? WHERE id=?', status, input.reviewer || 'admin', timestamp, review.id);
  const verificationType = review.review_type === 'phone_ownership' ? 'phone_ownership' : review.review_type === 'real_name' ? 'real_name' : 'manual_review';
  await run(
    db,
    `UPDATE identity_verifications
     SET status=?, reviewed_by=?, review_note=?, updated_at=?
     WHERE user_id=? AND verification_type=? AND subject_hash=? AND status='pending'`,
    verificationStatus,
    input.reviewer || 'admin',
    input.review_note || null,
    timestamp,
    review.user_id,
    verificationType,
    review.target_hash
  );
  return { ok: true, status, review_id: review.id };
}

export async function auditLog(db, input = {}) {
  if (!db?.prepare) return { ok: false, skipped: true };
  await run(
    db,
    `INSERT INTO audit_logs (id, user_id, action, target_type, target_hash, ip_hash, user_agent_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id || id('audit'),
    input.user_id || null,
    input.action,
    input.target_type || null,
    input.target_hash || null,
    input.ip_hash || null,
    input.ua_hash || input.user_agent_hash || null,
    now()
  );
  return { ok: true };
}

export async function checkRateLimit(db, input = {}) {
  if (!db?.prepare) return { ok: true, remaining: Number(input.limit || 20) };
  const limit = Number(input.limit || 20);
  const windowSeconds = Number(input.window_seconds || 3600);
  const bucket = `${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const key = String(input.key || 'anonymous').slice(0, 200);
  const resetAt = new Date((Number(bucket) + 1) * windowSeconds * 1000).toISOString();
  const existing = await first(db, 'SELECT count FROM rate_limits WHERE key=? AND bucket=?', key, bucket);
  if (existing && Number(existing.count) >= limit) return { ok: false, remaining: 0, reset_at: resetAt };
  if (existing) await run(db, 'UPDATE rate_limits SET count=count+1, reset_at=? WHERE key=? AND bucket=?', resetAt, key, bucket);
  else await run(db, 'INSERT INTO rate_limits (key, bucket, count, reset_at) VALUES (?, ?, 1, ?)', key, bucket, resetAt);
  return { ok: true, remaining: existing ? Math.max(limit - Number(existing.count) - 1, 0) : limit - 1, reset_at: resetAt };
}
