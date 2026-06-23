# Cloudflare Pages + D1 production notes

Open Your Box expects the Cloudflare Pages Function binding name to be `DB`.

## One-time D1 setup

```bash
npx wrangler d1 list
npx wrangler d1 create open-your-box-db
npx wrangler d1 execute open-your-box-db --remote --file=migrations/0001_initial.sql
```

## Pages binding

Cloudflare Dashboard path:

Pages → `open-your-box` → Settings → Functions → D1 database bindings → Add binding

Use:

- Variable name: `DB`
- D1 database: `open-your-box-db`

The runtime reads `context.env.DB` first, then falls back to `OYB_DB` or `OYB_DATABASE` for local compatibility.

## Deploy

```bash
npm install
npm run typecheck
npm run test
npm run build
npx wrangler pages deploy dist --project-name open-your-box
```

The GitHub workflow `.github/workflows/cloudflare-pages.yml` performs the same deployment when these repository secrets exist:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

No API key, token, cookie, credential, TOTP, or secret should be committed to the repository.
