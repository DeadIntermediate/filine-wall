#!/bin/bash

# Fix TypeScript path alias imports to use relative paths
# This fixes the ERR_INVALID_MODULE_SPECIFIER error

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 Fixing TypeScript imports..."
echo ""

cd "$PROJECT_DIR"

# Fix server/routes.ts
echo "Fixing server/routes.ts..."
if [ -f "server/routes.ts" ]; then
    # Replace @db imports with relative paths
    sed -i.bak 's|from "@db";|from "../db/index.js";|g' server/routes.ts
    sed -i.bak 's|from "@db/schema";|from "../db/schema.js";|g' server/routes.ts
    echo "✓ Fixed server/routes.ts"
fi

# Fix server/index.ts if it has @db imports
echo "Fixing server/index.ts..."
if [ -f "server/index.ts" ]; then
    sed -i.bak 's|from "@db";|from "../db/index.js";|g' server/index.ts
    sed -i.bak 's|from "@db/schema";|from "../db/schema.js";|g' server/index.ts
    echo "✓ Fixed server/index.ts"
fi

# Fix all service files
echo "Fixing server/services/*.ts..."
for file in server/services/*.ts; do
    if [ -f "$file" ]; then
        sed -i.bak 's|from "@db";|from "../../db/index.js";|g' "$file"
        sed -i.bak 's|from "@db/schema";|from "../../db/schema.js";|g' "$file"
    fi
done
echo "✓ Fixed service files"

# Fix middleware files
echo "Fixing server/middleware/*.ts..."
for file in server/middleware/*.ts; do
    if [ -f "$file" ]; then
        sed -i.bak 's|from "@db";|from "../../db/index.js";|g' "$file"
        sed -i.bak 's|from "@db/schema";|from "../../db/schema.js";|g' "$file"
    fi
done
echo "✓ Fixed middleware files"

# Clean up backup files
find . -name "*.ts.bak" -delete 2>/dev/null || true

echo ""
echo "✅ All imports fixed!"
echo ""
echo "Now try running:"
echo "  ./start.sh"
