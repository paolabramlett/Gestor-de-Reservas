#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 Building and deploying..."
git add -A
git commit -m "${1:-deploy}" || true
git push || true

DEPLOY_URL=$(npx vercel --prod --yes --json 2>/dev/null | tail -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['deployment']['url'])" 2>/dev/null || \
  npx vercel ls app 2>/dev/null | grep Ready | head -1 | awk '{print $4}')

echo "Aliasing $DEPLOY_URL → roomly-beta.vercel.app"
npx vercel alias set "$DEPLOY_URL" roomly-beta.vercel.app

echo "✅ Done: https://roomly-beta.vercel.app"
