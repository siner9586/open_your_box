# Production deployment and compliance guide

This project is for self-check or explicitly authorized asset checks only. Public production must keep `ENABLE_PHONE_DEEP_SCAN=false`, `IDENTITY_PROVIDER_MODE=manual`, and `ALLOW_DEV_LOGIN=false`.

## Deploy

```bash
npm run build
npm run db:migrate:remote
npx wrangler pages deploy dist --project-name open-your-box
BASE_URL=<PRODUCTION_URL> RUN_PENDING_TOKEN=<CRON_SECRET> npm run smoke
BASE_URL=<PRODUCTION_URL> ADMIN_TOKEN=<ADMIN_TOKEN> npm run smoke:identity
```

## Cloudflare secrets

Set secret values interactively. Do not commit real values.

```bash
npx wrangler secret put SCAN_SALT
npx wrangler secret put CRON_SECRET
npx wrangler secret put ADMIN_TOKEN
```

Optional secrets: `SHODAN_API_KEY`, `HIBP_API_KEY`, `VIRUSTOTAL_API_KEY`, `GITHUB_TOKEN`, `IDENTITY_PROVIDER_API_KEY`.

## Identity and authorization

Manual review is the production default. Sensitive input must be normalized, masked in responses, and stored only as salted hashes or provider references. Any deep mobile-number capability must remain disabled until real identity, number ownership, consent, rate limiting, and audit logging are all active.

The first production release supports:

- real-name verification requests through `identity_verifications`
- phone ownership requests through `phone_verification_challenges` and `identity_verifications`
- explicit consent through `consent_records`
- privacy export/delete/anonymize requests through `data_retention_requests`
- admin review through `admin_review_queue`
- audit logging through `audit_logs`

The service must not store real names, ID numbers, phone numbers, API keys, OTP codes, passwords, or session tokens in plaintext. API responses return masked values only.

## Phone deep scan gate

`ENABLE_PHONE_DEEP_SCAN=false` is mandatory for the first production release. A deep phone target must be skipped with `PHONE_DEEP_SCAN_DISABLED` unless the operator deliberately changes this variable in a future approved release.

If enabled later, the gate still requires all of the following:

1. `ENABLE_PHONE_DEEP_SCAN=true`
2. `real_name` verification is `verified`
3. `phone_ownership` verification is `verified`
4. `phone_deep_scan` consent is `granted`
5. target `phone_hash` matches the verified phone hash
6. rate limit passes
7. audit log is written

The current adapter is a skeleton and must not perform credential stuffing, password validation, captcha bypass, login-state probing, or large-scale platform enumeration.

## Admin review

Admin endpoints require `ADMIN_TOKEN`. Review screens must show masked subjects and provider references only.

## Data rights

The privacy center should support export, deletion, anonymization, and authorization revocation requests. Production retention defaults to `DATA_RETENTION_DAYS=30`.

## Health acceptance

`/api/health` must return only `present` or `missing` for secrets. Production is healthy only when D1 is present, scan and identity tables exist, `SCAN_SALT`, `CRON_SECRET`, and `ADMIN_TOKEN` are present, and variables are `ENABLE_PHONE_DEEP_SCAN=false`, `IDENTITY_PROVIDER_MODE=manual`, `ALLOW_DEV_LOGIN=false`.

Queue is optional for this release. If `SCAN_QUEUE` is missing, D1 pending fallback remains the supported path.
