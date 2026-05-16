#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Load NEXT_PUBLIC_APINATOR_APP_KEY from .dev.vars so we never hardcode the wrong key
export "$(grep '^NEXT_PUBLIC_APINATOR_APP_KEY=' .dev.vars | head -1)"

rm -rf .open-next
npx opennextjs-cloudflare build --skipWranglerConfigCheck
npx opennextjs-cloudflare deploy
