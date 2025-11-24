#!/bin/bash

# Fix database driver issue - switch from Neon to PostgreSQL
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🔧 Fixing database driver and environment configuration..."
echo ""

# Step 1: Install required packages
echo "📦 Installing required packages..."
npm install pg@^8.13.1 dotenv@^16.4.5 --save --loglevel=error
npm install @types/pg --save-dev --loglevel=error

# Step 2: Fix db/index.ts
echo "🔧 Updating db/index.ts to use PostgreSQL driver..."

cat > db/index.ts << 'EOF'
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
EOF

echo "✅ Database configuration fixed!"

# Step 3: Add dotenv to server/index.ts if not present
echo "🔧 Adding dotenv to server/index.ts..."

if ! grep -q "dotenv" server/index.ts; then
    # Create temp file with dotenv import at the top
    cat > /tmp/server-index-header.txt << 'EOF'
// Load environment variables first
import { config } from "dotenv";
config();

EOF
    
    # Combine header with rest of file (skip first line if it's already an import)
    cat /tmp/server-index-header.txt > /tmp/new-server-index.ts
    cat server/index.ts >> /tmp/new-server-index.ts
    mv /tmp/new-server-index.ts server/index.ts
    rm -f /tmp/server-index-header.txt
    echo "✅ Added dotenv configuration"
else
    echo "✅ dotenv already configured"
fi

echo ""
echo "✅ All fixes applied!"
echo ""
echo "Now try running:"
echo "  ./start.sh"
