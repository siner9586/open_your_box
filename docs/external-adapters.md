# External adapter configuration

Open Your Box reads external adapter credentials only from runtime secrets. Do not commit real keys to the repository.

## Secret names

- `SHODAN_API_KEY` — verified IP service summary via Shodan host endpoint.
- `HIBP_API_KEY` — verified email breach-name summary via HIBP k-anonymity range endpoint.
- `CENSYS_API_ID` / `CENSYS_API_SECRET` — verified IP host-service summary via Censys host endpoint.
- `VIRUSTOTAL_API_KEY` — verified IP/domain reputation summary.
- `ABUSEIPDB_API_KEY` — verified IP abuse reputation summary.
- `OTX_API_KEY` — verified IP/domain OTX pulse summary.
- `CLOUDFLARE_API_TOKEN` — verified Cloudflare zone and DNS inventory.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth connection for user-owned or organisation-owned assets.

## Local setup helper

Run:

```bash
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh
```

The script prompts for values and writes them to both GitHub Actions secrets and Cloudflare Pages secrets. It never writes the secret values into repository files.

## Runtime requirements

Every external lookup remains gated by one of these conditions:

1. `payload.authorization.verified === true`
2. `payload.authorization.method === "manual_admin_test"`
3. `payload.authorization.method === "cloudflare_zone"`

If ownership is not verified, adapters return a limited-status finding rather than executing the external lookup.

## Cloudflare D1

The API stores completed reports in D1 when a binding named one of the following exists:

- `DB`
- `OYB_DB`
- `OYB_DATABASE`

Apply the migration:

```bash
npx wrangler d1 execute <DATABASE_NAME_OR_ID> --file=migrations/0001_initial.sql
```

Then bind that D1 database to the Pages project as `DB` or `OYB_DB`.
