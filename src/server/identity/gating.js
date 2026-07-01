import { ConsentType, GateReason } from './types.js';
import { auditLog, checkRateLimit, getIdentityVerificationStatus, hasConsent } from './repository.js';

export async function requireVerifiedUser(userId, db) {
  if (!userId) return { ok: false, code: GateReason.USER_NOT_VERIFIED };
  const status = await getIdentityVerificationStatus(db, userId, 'real_name');
  return status.status === 'verified' ? { ok: true, verification: status } : { ok: false, code: GateReason.USER_NOT_VERIFIED };
}

export async function requirePhoneOwnership(userId, phoneHash, db) {
  if (!userId || !phoneHash) return { ok: false, code: GateReason.PHONE_NOT_VERIFIED };
  const status = await getIdentityVerificationStatus(db, userId, 'phone_ownership', phoneHash);
  if (status.status === 'verified') return { ok: true, verification: status };
  const otherPhone = await getIdentityVerificationStatus(db, userId, 'phone_ownership');
  if (otherPhone.status === 'verified' && otherPhone.subject_hash !== phoneHash) return { ok: false, code: GateReason.PHONE_TARGET_MISMATCH };
  return { ok: false, code: GateReason.PHONE_NOT_VERIFIED };
}

export async function requireConsent(userId, consentType, targetHash, db) {
  const ok = await hasConsent(db, userId, consentType, targetHash);
  return ok ? { ok: true } : { ok: false, code: GateReason.CONSENT_REQUIRED };
}

export async function canRunPhoneDeepScan(userId, phoneHash, env = {}, db, context = {}) {
  if (env.ENABLE_PHONE_DEEP_SCAN !== 'true') {
    await auditLog(db, { user_id: userId, action: 'phone_deep_scan_blocked', target_type: 'phone', target_hash: phoneHash, ...context });
    return { ok: false, code: GateReason.PHONE_DEEP_SCAN_DISABLED };
  }
  const user = await requireVerifiedUser(userId, db);
  if (!user.ok) {
    await auditLog(db, { user_id: userId, action: 'phone_deep_scan_blocked', target_type: 'phone', target_hash: phoneHash, ...context });
    return user;
  }
  const phone = await requirePhoneOwnership(userId, phoneHash, db);
  if (!phone.ok) {
    await auditLog(db, { user_id: userId, action: 'phone_deep_scan_blocked', target_type: 'phone', target_hash: phoneHash, ...context });
    return phone;
  }
  const consent = await requireConsent(userId, ConsentType.PHONE_DEEP_SCAN, phoneHash, db);
  if (!consent.ok) {
    await auditLog(db, { user_id: userId, action: 'phone_deep_scan_blocked', target_type: 'phone', target_hash: phoneHash, ...context });
    return consent;
  }
  const rate = await checkRateLimit(db, {
    key: `phone_deep_scan:${userId}:${phoneHash}`,
    limit: Number(env.MAX_SUBMISSIONS_PER_HOUR || 20),
    window_seconds: 3600
  });
  if (!rate.ok) {
    await auditLog(db, { user_id: userId, action: 'phone_deep_scan_rate_limited', target_type: 'phone', target_hash: phoneHash, ...context });
    return { ok: false, code: GateReason.RATE_LIMITED };
  }
  await auditLog(db, { user_id: userId, action: 'phone_deep_scan_allowed', target_type: 'phone', target_hash: phoneHash, ...context });
  return { ok: true };
}
