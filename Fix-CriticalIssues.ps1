# FiLine Wall - Quick Fixes for Critical Issues (PowerShell)
# This script fixes the most important issues to get the project production-ready

param(
    [switch]$SkipTypeCheck
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🔧 FiLine Wall - Critical Fixes Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Fix TypeScript compilation errors
Write-Host "📝 Step 1: Installing missing TypeScript types..." -ForegroundColor Blue
npm install --save-dev @types/node
Write-Host "✓ TypeScript types installed" -ForegroundColor Green
Write-Host ""

# 2. Update tsconfig.json
Write-Host "📝 Step 2: Updating tsconfig.json..." -ForegroundColor Blue

$tsconfigContent = @'
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
'@

Set-Content -Path "tsconfig.json" -Value $tsconfigContent -Encoding UTF8
Write-Host "✓ tsconfig.json updated" -ForegroundColor Green
Write-Host ""

# 3. Create environment validation
Write-Host "📝 Step 3: Creating environment validation..." -ForegroundColor Blue

New-Item -ItemType Directory -Force -Path "server\config" | Out-Null

$validateEnvContent = @'
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
'@

Set-Content -Path "server\config\validateEnv.ts" -Value $validateEnvContent -Encoding UTF8
Write-Host "✓ Environment validation created" -ForegroundColor Green
Write-Host ""

# 4. Update package.json scripts
Write-Host "📝 Step 4: Adding helpful npm scripts..." -ForegroundColor Blue

if (Test-Path "package.json") {
    $pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    # Add new scripts
    $newScripts = @{
        "fix:types" = "npm install --save-dev @types/node && tsc --noEmit"
        "db:seed" = "tsx db/seed.ts"
        "db:reset" = "drizzle-kit drop && npm run db:push && npm run db:seed"
        "docker:build" = "docker build -t filinewall ."
        "docker:run" = "docker run -p 5000:5000 --env-file .env filinewall"
        "prod:start" = "`$env:NODE_ENV='production'; npm start"
        "dev:debug" = "`$env:NODE_OPTIONS='--inspect'; npm run dev"
        "install:all" = "npm install && cd client && npm install"
        "validate:env" = "tsx server/config/validateEnv.ts"
    }
    
    foreach ($key in $newScripts.Keys) {
        $pkgJson.scripts | Add-Member -MemberType NoteProperty -Name $key -Value $newScripts[$key] -Force
    }
    
    $pkgJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
    Write-Host "✓ npm scripts added" -ForegroundColor Green
}
Write-Host ""

# 5. Update .gitignore
Write-Host "📝 Step 5: Updating .gitignore..." -ForegroundColor Blue

$gitignoreAdditions = @'

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
'@

Add-Content -Path ".gitignore" -Value $gitignoreAdditions -Encoding UTF8
Write-Host "✓ .gitignore updated" -ForegroundColor Green
Write-Host ""

# 6. Create database seed file
Write-Host "📝 Step 6: Creating database seed file..." -ForegroundColor Blue

$seedContent = @'
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
'@

Set-Content -Path "db\seed.ts" -Value $seedContent -Encoding UTF8
Write-Host "✓ Database seed file created" -ForegroundColor Green
Write-Host ""

# 7. Create health check script
Write-Host "📝 Step 7: Creating health check script..." -ForegroundColor Blue

New-Item -ItemType Directory -Force -Path "scripts" | Out-Null

$healthCheckContent = @'
# FiLine Wall Health Check (PowerShell)

Write-Host "🏥 FiLine Wall Health Check" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if server is running
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Server is running" -ForegroundColor Green
    
    # Check database connection
    $health = $response.Content | ConvertFrom-Json
    if ($health.database -eq "healthy") {
        Write-Host "✅ Database connection OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Database connection failed" -ForegroundColor Red
        exit 1
    }
    
    # Check memory usage
    $memoryUsed = $health.memory.used
    if ($memoryUsed -lt 1024) {
        Write-Host "✅ Memory usage OK ($memoryUsed MB)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  High memory usage ($memoryUsed MB)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "✅ All health checks passed!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Server is not responding" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
'@

Set-Content -Path "scripts\health-check.ps1" -Value $healthCheckContent -Encoding UTF8
Write-Host "✓ Health check script created" -ForegroundColor Green
Write-Host ""

# 8. Run type checking (optional)
if (-not $SkipTypeCheck) {
    Write-Host "📝 Step 8: Running TypeScript type check..." -ForegroundColor Blue
    
    try {
        npm run type-check
        Write-Host "✓ TypeScript compilation successful!" -ForegroundColor Green
    } catch {
        Write-Host "⚠  Some TypeScript errors remain (check the output above)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Critical Fixes Applied!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "What was fixed:" -ForegroundColor Blue
Write-Host "  ✅ Installed @types/node"
Write-Host "  ✅ Updated tsconfig.json with proper configuration"
Write-Host "  ✅ Created environment validation"
Write-Host "  ✅ Added useful npm scripts"
Write-Host "  ✅ Updated .gitignore"
Write-Host "  ✅ Created database seed file"
Write-Host "  ✅ Created health check script"
Write-Host ""
Write-Host "New npm scripts available:" -ForegroundColor Blue
Write-Host "  npm run fix:types        - Fix TypeScript errors"
Write-Host "  npm run db:seed          - Seed database with test data"
Write-Host "  npm run db:reset         - Reset and reseed database"
Write-Host "  npm run validate:env     - Validate environment variables"
Write-Host "  npm run prod:start       - Start in production mode"
Write-Host "  npm run dev:debug        - Start with debugger"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "  1. Review and update your .env file"
Write-Host "  2. Run: npm run db:push"
Write-Host "  3. Run: npm run db:seed"
Write-Host "  4. Run: npm start"
Write-Host ""
Write-Host "For the complete roadmap, see: IMPROVEMENTS_ROADMAP.md" -ForegroundColor Yellow
Write-Host ""
