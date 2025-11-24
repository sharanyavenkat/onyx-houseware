#!/bin/bash
set -e

echo "🔨 Building frontend..."
npx vite build

echo "🔨 Building production server..."
npx esbuild server/prod.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

echo "✅ Production build complete!"
echo "📦 Verifying no vite imports..."
if grep -q "from \"vite\"" dist/index.js; then
  echo "❌ ERROR: vite imports found in production bundle!"
  exit 1
else
  echo "✅ Clean production bundle - no vite dependencies"
fi
