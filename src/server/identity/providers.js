import { IdentityVerificationTypes } from './types.js';
import { isProductionEnv } from './security.js';
import { createAdminReviewItem, createIdentityVerification } from './repository.js';

export function mockDevProvider(env = {}) {
  const allowed = env.IDENTITY_PROVIDER_MODE === 'mock' && env.ALLOW_DEV_LOGIN === 'true' && !isProductionEnv(env);
  return {
    id: 'mock-dev-identity-provider',
    name: 'Mock Dev Identity Provider',
    mode: 'mock',
    allowed,
    async startRealNameVerification(input, _env, db) {
      if (!allowed) return { ok: false, status: 'pending', code: 'MOCK_PROVIDER_DISABLED' };
      const row = await createIdentityVerification(db, {
        user_id: input.user_id,
        verification_type: IdentityVerificationTypes.REAL_NAME,
        provider: this.id,
        status: 'verified',
        subject_hash: input.subject_hash,
        subject_masked: input.subject_masked,
        evidence_ref: 'mock-dev-only'
      });
      return { ok: true, status: row.status, verification_id: row.id, provider: this.id };
    },
    async checkRealNameVerification() {
      return { ok: allowed, status: allowed ? 'verified' : 'pending' };
    },
    async startPhoneVerification(input, _env, db) {
      if (!allowed) return { ok: false, status: 'pending', code: 'MOCK_PROVIDER_DISABLED' };
      return { ok: true, status: 'pending', challenge_type: 'mock_dev' };
    },
    async checkPhoneVerification() {
      return { ok: allowed, status: allowed ? 'verified' : 'pending' };
    }
  };
}

export function manualReviewProvider() {
  return {
    id: 'manual-review-provider',
    name: 'Manual Review Provider',
    mode: 'manual',
    async startRealNameVerification(input, _env, db) {
      const row = await createIdentityVerification(db, {
        user_id: input.user_id,
        verification_type: IdentityVerificationTypes.REAL_NAME,
        provider: this.id,
        status: 'pending',
        subject_hash: input.subject_hash,
        subject_masked: input.subject_masked,
        evidence_ref: input.evidence_ref || null
      });
      const review = await createAdminReviewItem(db, {
        review_type: IdentityVerificationTypes.REAL_NAME,
        user_id: input.user_id,
        target_hash: input.subject_hash,
        target_masked: input.subject_masked,
        reason: 'Manual real-name review required'
      });
      return { ok: true, status: 'pending', verification_id: row.id, review_id: review.id, provider: this.id };
    },
    async checkRealNameVerification() {
      return { ok: true, status: 'pending' };
    },
    async startPhoneVerification(input, _env, db) {
      const row = await createIdentityVerification(db, {
        user_id: input.user_id,
        verification_type: IdentityVerificationTypes.PHONE_OWNERSHIP,
        provider: this.id,
        status: 'pending',
        subject_hash: input.subject_hash,
        subject_masked: input.subject_masked,
        evidence_ref: input.evidence_ref || null
      });
      const review = await createAdminReviewItem(db, {
        review_type: IdentityVerificationTypes.PHONE_OWNERSHIP,
        user_id: input.user_id,
        target_hash: input.subject_hash,
        target_masked: input.subject_masked,
        reason: 'Manual phone ownership review required'
      });
      return { ok: true, status: 'pending', verification_id: row.id, review_id: review.id, provider: this.id };
    },
    async checkPhoneVerification() {
      return { ok: true, status: 'pending' };
    }
  };
}

export function externalProviderSkeleton(env = {}) {
  return {
    id: 'external-provider-skeleton',
    name: 'External Provider Skeleton',
    mode: 'external',
    configured: Boolean(env.IDENTITY_PROVIDER_API_KEY),
    async startRealNameVerification(input, _env, db) {
      const row = await createIdentityVerification(db, {
        user_id: input.user_id,
        verification_type: IdentityVerificationTypes.REAL_NAME,
        provider: this.id,
        status: 'pending',
        subject_hash: input.subject_hash,
        subject_masked: input.subject_masked,
        evidence_ref: this.configured ? 'external-provider-pending' : 'external-provider-missing-api-key'
      });
      return { ok: true, status: 'pending', skipped: !this.configured, verification_id: row.id, provider: this.id };
    },
    async checkRealNameVerification() {
      return { ok: true, status: 'pending', skipped: !this.configured };
    },
    async startPhoneVerification() {
      return { ok: true, status: 'pending', skipped: !this.configured };
    },
    async checkPhoneVerification() {
      return { ok: true, status: 'pending', skipped: !this.configured };
    }
  };
}

export function getIdentityProvider(env = {}) {
  if (env.IDENTITY_PROVIDER_MODE === 'mock') return mockDevProvider(env);
  if (env.IDENTITY_PROVIDER_MODE === 'external') return externalProviderSkeleton(env);
  return manualReviewProvider(env);
}
