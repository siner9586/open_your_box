import { json, jsonError, readJson } from '../scan/async.js';
import { ConsentType } from './types.js';
import { getIdentityProvider } from './providers.js';
import {
  createConsentRecord,
  createOrGetUser,
  createPhoneChallenge,
  createRetentionRequest,
  createSession,
  auditLog,
  decideAdminReview,
  getDb,
  getUserVerificationSummary,
  id,
  listAdminReviews,
  revokeConsent as revokeConsentRecord,
  verifyPhoneChallenge
} from './repository.js';
import {
  createRandomToken,
  getClientContextHash,
  hashSessionToken,
  maskEmail,
  maskGeneric,
  maskName,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  normalizeTarget,
  safeJson,
  sha256WithSalt,
  isProductionEnv
} from './security.js';

function salt(env) {
  return env.SCAN_SALT || env.HASH_SALT || (isProductionEnv(env) ? '' : 'dev-only-local-salt');
}

function adminAuthorized(context) {
  const token = context.request.headers.get('x-admin-token') || context.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(token && context.env?.ADMIN_TOKEN && token === context.env.ADMIN_TOKEN);
}

export async function devLogin(context) {
  const env = context.env || {};
  if (env.ALLOW_DEV_LOGIN !== 'true' || env.IDENTITY_PROVIDER_MODE !== 'mock') {
    return jsonError('DEV_LOGIN_DISABLED', 403, 'Development login is disabled.');
  }
  const db = getDb(env);
  const input = await readJson(context.request);
  const email = normalizeEmail(input.email || 'demo@example.com');
  const user = await createOrGetUser(db, {
    auth_provider: 'dev',
    auth_subject: email,
    email_hash: await sha256WithSalt(email, salt(env)),
    display_name_masked: maskGeneric(input.display_name || 'demo user', 'name')
  });
  const sessionToken = createRandomToken('session');
  await createSession(db, { user_id: user.id, token_hash: await hashSessionToken(sessionToken, env) });
  await auditLog(db, { user_id: user.id, action: 'dev_login', ...(await getClientContextHash(context, env)) });
  return json(safeJson({
    ok: true,
    user_id: user.id,
    session_token: sessionToken,
    display_name_masked: user.display_name_masked,
    email_masked: maskEmail(email)
  }));
}

export async function startRealName(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  const userId = input.user_id;
  if (!userId) return jsonError('USER_REQUIRED', 400, 'user_id is required.');
  await createOrGetUser(db, { id: userId, auth_provider: 'local', auth_subject: userId, display_name_masked: maskName(input.name || 'manual user') });
  const subject = normalizeTarget('real_name', `${input.name || ''}:${input.id_number || input.evidence_ref || 'manual'}`);
  const provider = getIdentityProvider(env);
  const result = await provider.startRealNameVerification({
    user_id: userId,
    subject_hash: await sha256WithSalt(subject, salt(env)),
    subject_masked: maskName(input.name || 'manual review'),
    evidence_ref: input.evidence_ref || 'manual-review'
  }, env, db);
  await auditLog(db, { user_id: userId, action: 'identity_real_name_started', target_type: 'real_name', ...(await getClientContextHash(context, env)) });
  return json(safeJson({ ok: true, ...result }));
}

export async function identityStatus(context) {
  const env = context.env || {};
  const db = getDb(env);
  const url = new URL(context.request.url);
  const userId = url.searchParams.get('user_id') || context.request.headers.get('x-user-id');
  if (!userId) return jsonError('USER_REQUIRED', 400, 'user_id is required.');
  return json(safeJson({ ok: true, user_id: userId, ...(await getUserVerificationSummary(db, userId)) }));
}

export async function startPhoneVerification(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  if (!input.user_id) return jsonError('USER_REQUIRED', 400, 'user_id is required.');
  const phone = normalizePhone(input.phone);
  if (!phone) return jsonError('PHONE_REQUIRED', 400, 'A valid phone value is required.');
  await createOrGetUser(db, { id: input.user_id, auth_provider: 'local', auth_subject: input.user_id, display_name_masked: 'u***' });
  const phoneHash = await sha256WithSalt(phone, salt(env));
  const provider = getIdentityProvider(env);
  const challengeType = provider.mode === 'mock' && provider.allowed ? 'mock_dev' : 'manual_review';
  const ttl = Number(env.PHONE_VERIFICATION_CODE_TTL_SECONDS || 600);
  const codeHash = challengeType === 'mock_dev' ? await sha256WithSalt(String(input.dev_code || '000000'), salt(env)) : null;
  const challenge = await createPhoneChallenge(db, {
    user_id: input.user_id,
    phone_hash: phoneHash,
    phone_masked: maskPhone(phone),
    challenge_type: challengeType,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString()
  });
  const providerResult = await provider.startPhoneVerification({
    user_id: input.user_id,
    subject_hash: phoneHash,
    subject_masked: maskPhone(phone),
    evidence_ref: challenge.id
  }, env, db);
  await auditLog(db, { user_id: input.user_id, action: 'identity_phone_started', target_type: 'phone', target_hash: phoneHash, ...(await getClientContextHash(context, env)) });
  return json(safeJson({ ok: true, status: 'pending', challenge_id: challenge.id, phone_masked: challenge.phone_masked, provider: provider.id, provider_status: providerResult.status }));
}

export async function verifyPhone(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  const codeHash = input.code ? await sha256WithSalt(String(input.code), salt(env)) : null;
  const result = await verifyPhoneChallenge(db, { challenge_id: input.challenge_id, code_hash: codeHash });
  await auditLog(db, { action: result.ok ? 'identity_phone_verified' : 'identity_phone_verify_pending', ...(await getClientContextHash(context, env)) });
  if (!result.ok) return json(safeJson({ ok: false, error: { code: result.code, message: 'Manual review is required or the challenge is not verified.' }, status: result.status || 'pending' }), 202);
  return json(safeJson({ ok: true, status: result.status, phone_masked: result.phone_masked }));
}

export async function grantConsent(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  if (!input.user_id) return jsonError('USER_REQUIRED', 400, 'user_id is required.');
  const consentType = input.consent_type || ConsentType.PERSONAL_SELF_CHECK;
  const targetType = input.target_type || null;
  const normalized = targetType && input.target_value ? normalizeTarget(targetType, input.target_value) : '';
  const targetHash = normalized ? await sha256WithSalt(normalized, salt(env)) : input.target_hash || null;
  const targetMasked = normalized ? maskGeneric(normalized, targetType) : input.target_masked || null;
  const contextHash = await getClientContextHash(context, env);
  const consent = await createConsentRecord(db, {
    user_id: input.user_id,
    job_id: input.job_id || null,
    consent_type: consentType,
    consent_version: input.consent_version || '2026-07-01',
    target_type: targetType,
    target_hash: targetHash,
    target_masked: targetMasked,
    ...contextHash
  });
  await auditLog(db, { user_id: input.user_id, action: 'consent_granted', target_type: targetType, target_hash: targetHash, ...contextHash });
  return json(safeJson({ ok: true, status: consent.status, consent_id: consent.id, target_masked: consent.target_masked }));
}

export async function revokeConsent(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  const targetHash = input.target_value && input.target_type ? await sha256WithSalt(normalizeTarget(input.target_type, input.target_value), salt(env)) : input.target_hash || null;
  const result = await revokeConsentRecord(db, { user_id: input.user_id, consent_type: input.consent_type, target_hash: targetHash });
  await auditLog(db, { user_id: input.user_id, action: 'consent_revoked', target_type: input.target_type || null, target_hash: targetHash, ...(await getClientContextHash(context, env)) });
  return json(safeJson({ ok: true, status: 'revoked', ...result }));
}

export async function privacyRequest(context) {
  const env = context.env || {};
  const db = getDb(env);
  const input = await readJson(context.request);
  const type = ['export', 'delete', 'anonymize'].includes(input.request_type) ? input.request_type : 'export';
  const request = await createRetentionRequest(db, { user_id: input.user_id || null, request_type: type, scope: input.scope || 'self' });
  await auditLog(db, { user_id: input.user_id || null, action: `privacy_${type}_requested`, ...(await getClientContextHash(context, env)) });
  return json(safeJson({ ok: true, status: request.status, request_id: request.id, request_type: request.request_type }));
}

export async function adminReviews(context) {
  if (!adminAuthorized(context)) return jsonError('ADMIN_REQUIRED', 401, 'Admin token required.');
  const url = new URL(context.request.url);
  const reviews = await listAdminReviews(getDb(context.env || {}), {
    status: url.searchParams.get('status') || 'pending',
    limit: Number(url.searchParams.get('limit') || 50)
  });
  return json(safeJson({ ok: true, reviews }));
}

export async function adminReviewDecide(context) {
  if (!adminAuthorized(context)) return jsonError('ADMIN_REQUIRED', 401, 'Admin token required.');
  const input = await readJson(context.request);
  const result = await decideAdminReview(getDb(context.env || {}), {
    review_id: input.review_id,
    decision: input.decision,
    reviewer: input.reviewer || 'admin',
    review_note: input.review_note || null
  });
  if (!result.ok) return jsonError(result.code || 'REVIEW_DECISION_FAILED', 404, 'Review item was not found.');
  return json(safeJson({ ok: true, ...result }));
}

export { id };
