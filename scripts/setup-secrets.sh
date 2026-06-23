#!/usr/bin/env bash
set -euo pipefail

REPO=${REPO:-siner9586/open_your_box}
CLOUDFLARE_PROJECT_NAME=${CLOUDFLARE_PROJECT_NAME:-open-your-box}

SECRETS=(
  SHODAN_API_KEY
  HIBP_API_KEY
  CENSYS_API_ID
  CENSYS_API_SECRET
  VIRUSTOTAL_API_KEY
  ABUSEIPDB_API_KEY
  OTX_API_KEY
  GITHUB_CLIENT_ID
  GITHUB_CLIENT_SECRET
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
)

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }
need gh
need npx

echo "This script writes secrets to GitHub Actions and Cloudflare Pages. It never writes secret values into the repository."
for name in "${SECRETS[@]}"; do
  value=${!name:-}
  if [[ -z "$value" ]]; then
    read -r -s -p "${name}= " value
    echo
  fi
  if [[ -z "$value" ]]; then
    echo "Skip empty ${name}"
    continue
  fi
  gh secret set "$name" -R "$REPO" --body "$value"
  printf '%s' "$value" | npx wrangler pages secret put "$name" --project-name "$CLOUDFLARE_PROJECT_NAME"
  unset value
done

echo "Secret sync completed for ${REPO} and Cloudflare Pages project ${CLOUDFLARE_PROJECT_NAME}."
