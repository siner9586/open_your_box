export const VerificationStatus = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  MISSING: 'missing'
});

export const ConsentType = Object.freeze({
  PERSONAL_SELF_CHECK: 'personal_self_check',
  COMPANY_AUTHORIZED_CHECK: 'company_authorized_check',
  PHONE_DEEP_SCAN: 'phone_deep_scan',
  DATA_RETENTION: 'data_retention',
  REPORT_EXPORT: 'report_export'
});

export const IdentityVerificationTypes = Object.freeze({
  REAL_NAME: 'real_name',
  PHONE_OWNERSHIP: 'phone_ownership',
  COMPANY_OWNERSHIP: 'company_ownership',
  DOMAIN_OWNERSHIP: 'domain_ownership',
  MANUAL_REVIEW: 'manual_review'
});

export const GateReason = Object.freeze({
  PHONE_DEEP_SCAN_DISABLED: 'PHONE_DEEP_SCAN_DISABLED',
  USER_NOT_VERIFIED: 'USER_NOT_VERIFIED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  PHONE_TARGET_MISMATCH: 'PHONE_TARGET_MISMATCH'
});
