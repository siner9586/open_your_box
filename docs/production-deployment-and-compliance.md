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

## Admin review

Admin endpoints require `ADMIN_TOKEN`. Review screens must show masked subjects and provider references only.

## Data rights

The privacy center should support export, deletion, anonymization, and authorization revocation requests. Production retention defaults to `DATA_RETENTION_DAYS=30`.
