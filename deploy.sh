#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Load NEXT_PUBLIC_APINATOR_APP_KEY from .dev.vars so we never hardcode the wrong key
export "$(grep '^NEXT_PUBLIC_APINATOR_APP_KEY=' .dev.vars | head -1)"

# IMPORTANT: Before deploying, ensure these secrets are set on Cloudflare:
#   npx wrangler secret put WORKOS_API_KEY
#   npx wrangler secret put NEXT_PUBLIC_APINATOR_APP_KEY
# (Values are in .dev.vars — these are NOT auto-deployed with the worker)
# DATABASE_URL is no longer needed — using D1 binding instead.

rm -rf .open-next
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
