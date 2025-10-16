#!/bin/bash

# FiLine Wall - Quick Fixes for Critical Issues
# This script fixes the most important issues to get the project production-ready

set -e

echo "🔧 FiLine Wall - Critical Fixes Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Fix TypeScript compilation errors
echo -e "${BLUE}📝 Step 1: Installing missing TypeScript types...${NC}"
npm install --save-dev @types/node

echo -e "${GREEN}✓${NC} TypeScript types installed"
echo ""

# 2. Update tsconfig.json
echo -e "${BLUE}📝 Step 2: Updating tsconfig.json...${NC}"

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "types": ["node", "vite/client"],
    
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    /* Additional Checks */
    "exactOptionalPropertyTypes": false,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    
    /* Module Resolution */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    
    /* Advanced */
    "downlevelIteration": true,
    "allowJs": false,
    "checkJs": false,
    
    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"],
      "@db/*": ["./db/*"],
      "@server/*": ["./server/*"]
    }
  },
  "include": [
    "client/src",
    "server",
    "db"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "build"
  ],
  "references": [
    { "path": "./tsconfig.node.json" }
  ]
}
EOF

echo -e "${GREEN}✓${NC} tsconfig.json updated"
echo ""

# 3. Create environment validation
echo -e "${BLUE}📝 Step 3: Creating environment validation...${NC}"

mkdir -p server/config

cat > server/config/validateEnv.ts << 'EOF'
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1000).max(65535)).default('5000'),
  
  // Optional API keys
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  NUMVERIFY_API_KEY: z.string().optional(),
  NUMLOOKUP_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    console.error('\n💡 Check your .env file and compare with .env.example');
    process.exit(1);
  }
}
EOF

echo -e "${GREEN}✓${NC} Environment validation created"
echo ""

# 4. Add npm scripts for common tasks
echo -e "${BLUE}📝 Step 4: Adding helpful npm scripts...${NC}"

# Read current package.json
if [ -f package.json ]; then
  # Use Node.js to safely update package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Add new scripts
    pkg.scripts = {
      ...pkg.scripts,
      'fix:types': 'npm install --save-dev @types/node && tsc --noEmit',
      'db:seed': 'tsx db/seed.ts',
      'db:reset': 'drizzle-kit drop && npm run db:push && npm run db:seed',
      'db:backup': 'pg_dump -U filinewall filinewall > backup-$(date +%Y%m%d-%H%M%S).sql',
      'docker:build': 'docker build -t filinewall .',
      'docker:run': 'docker run -p 5000:5000 --env-file .env filinewall',
      'prod:start': 'NODE_ENV=production npm start',
      'dev:debug': 'NODE_OPTIONS=\"--inspect\" npm run dev',
      'install:all': 'npm install && cd client && npm install',
      'analyze': 'npm run build -- --analyze',
      'validate:env': 'tsx server/config/validateEnv.ts'
    };
    
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    console.log('✅ Package.json updated with new scripts');
  "
fi

echo -e "${GREEN}✓${NC} npm scripts added"
echo ""

# 5. Create .gitignore additions
echo -e "${BLUE}📝 Step 5: Updating .gitignore...${NC}"

cat >> .gitignore << 'EOF'

# Database backups
*.sql
*.sql.gz
backup-*.sql

# Environment files
.env
.env.local
.env.production
.env.development

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
coverage/
.nyc_output/

# Cache
.cache/
.parcel-cache/

# Build
dist/
build/
.next/

# ML models
data/ml-models/*.json
data/ml-models/*.h5
EOF

echo -e "${GREEN}✓${NC} .gitignore updated"
echo ""

# 6. Create a basic seed file for database
echo -e "${BLUE}📝 Step 6: Creating database seed file...${NC}"

cat > db/seed.ts << 'EOF'
import { db } from './index';
import { users, phoneNumbers, featureSettings } from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');
  
  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@filinewall.local',
      role: 'admin',
      active: true
    }).onConflictDoNothing();
    
    console.log('✅ Admin user created (username: admin, password: admin123)');
    
    // Add some example spam numbers
    await db.insert(phoneNumbers).values([
      {
        number: '555-spam-001',
        type: 'blacklist',
        description: 'Known telemarketer',
        reputationScore: '10'
      },
      {
        number: '555-spam-002',
        type: 'blacklist',
        description: 'Robocall scam',
        reputationScore: '5'
      }
    ]).onConflictDoNothing();
    
    console.log('✅ Example spam numbers added');
    
    // Add default feature settings
    await db.insert(featureSettings).values([
      {
        featureKey: 'voice_analysis',
        isEnabled: true,
        category: 'ai',
        displayOrder: 1
      },
      {
        featureKey: 'pattern_detection',
        isEnabled: true,
        category: 'ai',
        displayOrder: 2
      },
      {
        featureKey: 'community_intelligence',
        isEnabled: true,
        category: 'network',
        displayOrder: 3
      }
    ]).onConflictDoNothing();
    
    console.log('✅ Feature settings configured');
    
    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📝 You can now login with:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Remember to change the admin password!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
EOF

echo -e "${GREEN}✓${NC} Database seed file created"
echo ""

# 7. Create a health check script
echo -e "${BLUE}📝 Step 7: Creating health check script...${NC}"

cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# Health check script for FiLine Wall

echo "🏥 FiLine Wall Health Check"
echo "============================"

# Check if server is running
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not responding"
    exit 1
fi

# Check database connection
if curl -s http://localhost:5000/health | grep -q '"database":"healthy"'; then
    echo "✅ Database connection OK"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Check memory usage
MEMORY_USED=$(curl -s http://localhost:5000/health | grep -o '"used":[0-9]*' | grep -o '[0-9]*')
if [ "$MEMORY_USED" -lt 1024 ]; then
    echo "✅ Memory usage OK (${MEMORY_USED}MB)"
else
    echo "⚠️  High memory usage (${MEMORY_USED}MB)"
fi

echo ""
echo "✅ All health checks passed!"
EOF

chmod +x scripts/health-check.sh

echo -e "${GREEN}✓${NC} Health check script created"
echo ""

# 8. Run type checking
echo -e "${BLUE}📝 Step 8: Running TypeScript type check...${NC}"

if npm run type-check; then
    echo -e "${GREEN}✓${NC} TypeScript compilation successful!"
else
    echo -e "${YELLOW}⚠${NC}  Some TypeScript errors remain (check the output above)"
fi
echo ""

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Critical Fixes Applied!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}What was fixed:${NC}"
echo "  ✅ Installed @types/node"
echo "  ✅ Updated tsconfig.json with proper configuration"
echo "  ✅ Created environment validation"
echo "  ✅ Added useful npm scripts"
echo "  ✅ Updated .gitignore"
echo "  ✅ Created database seed file"
echo "  ✅ Created health check script"
echo ""
echo -e "${BLUE}New npm scripts available:${NC}"
echo "  npm run fix:types        - Fix TypeScript errors"
echo "  npm run db:seed          - Seed database with test data"
echo "  npm run db:reset         - Reset and reseed database"
echo "  npm run validate:env     - Validate environment variables"
echo "  npm run prod:start       - Start in production mode"
echo "  npm run dev:debug        - Start with debugger"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review and update your .env file"
echo "  2. Run: npm run db:push"
echo "  3. Run: npm run db:seed"
echo "  4. Run: npm start"
echo ""
echo -e "${YELLOW}For the complete roadmap, see: IMPROVEMENTS_ROADMAP.md${NC}"
echo ""
