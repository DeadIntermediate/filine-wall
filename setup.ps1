# FiLine Wall - Automatic Setup Script for Windows
# Run this in PowerShell as Administrator for best results

# Set error action
$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARNING] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }

# Banner
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║                                               ║" -ForegroundColor Blue
Write-Host "║           FiLine Wall Setup v1.0              ║" -ForegroundColor Blue
Write-Host "║     Automatic Installation & Configuration    ║" -ForegroundColor Blue
Write-Host "║                                               ║" -ForegroundColor Blue
Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

Write-Info "Starting automatic setup..."

# Step 1: Check Node.js
Write-Info "Checking Node.js installation..."
try {
    $nodeVersion = (node --version) -replace 'v', ''
    $nodeMajor = [int]($nodeVersion.Split('.')[0])
    
    if ($nodeMajor -lt 18) {
        Write-Error "Node.js version must be 18 or higher. Current: $nodeVersion"
        Write-Info "Download from: https://nodejs.org/"
        exit 1
    }
    Write-Success "Node.js v$nodeVersion detected"
} catch {
    Write-Error "Node.js is not installed!"
    Write-Info "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

# Step 2: Check PostgreSQL
Write-Info "Checking PostgreSQL installation..."
try {
    $null = Get-Command psql -ErrorAction Stop
    Write-Success "PostgreSQL detected"
} catch {
    Write-Warning "PostgreSQL not found in PATH"
    Write-Info "Please ensure PostgreSQL 13+ is installed"
    Write-Info "Download from: https://www.postgresql.org/download/windows/"
    
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 1
    }
}

# Step 3: Install dependencies
Write-Info "Installing Node.js dependencies..."
if (Test-Path "package-lock.json") {
    npm ci
} else {
    npm install
}
Write-Success "Dependencies installed"

# Step 4: Setup environment file
Write-Info "Setting up environment configuration..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Success "Created .env from .env.example"
        
        # Generate secure secrets
        Write-Info "Generating secure secrets..."
        $jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        $encryptionKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        
        # Update .env with generated secrets
        (Get-Content .env) | ForEach-Object {
            $_ -replace 'change-this-to-a-secure-random-string-in-production', $jwtSecret `
               -replace 'change-this-to-a-32-character-string', $encryptionKey
        } | Set-Content .env
        
        Write-Success "Generated secure JWT_SECRET and ENCRYPTION_KEY"
        
        # Prompt for database configuration
        Write-Host ""
        Write-Info "Database Configuration"
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
        
        $dbUser = Read-Host "PostgreSQL username [postgres]"
        if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }
        
        $dbPassSecure = Read-Host "PostgreSQL password" -AsSecureString
        $dbPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassSecure))
        
        $dbName = Read-Host "Database name [filine_wall]"
        if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "filine_wall" }
        
        $dbHost = Read-Host "Database host [localhost]"
        if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }
        
        $dbPort = Read-Host "Database port [5432]"
        if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }
        
        # Update DATABASE_URL in .env
        $databaseUrl = "postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}"
        
        (Get-Content .env) | ForEach-Object {
            $_ -replace 'DATABASE_URL=.*', "DATABASE_URL=$databaseUrl"
        } | Set-Content .env
        
        Write-Success "Database configuration updated"
    } else {
        Write-Error ".env.example not found!"
        exit 1
    }
} else {
    Write-Warning ".env file already exists, skipping creation"
}

# Step 5: Create database if possible
Write-Info "Setting up database..."
$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL=postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)') {
    $dbUser = $Matches[1]
    $dbPass = $Matches[2]
    $dbHost = $Matches[3]
    $dbPort = $Matches[4]
    $dbName = $Matches[5]
    
    try {
        $env:PGPASSWORD = $dbPass
        $dbExists = psql -h $dbHost -p $dbPort -U $dbUser -lqt 2>$null | Select-String -Pattern $dbName
        
        if ($dbExists) {
            Write-Success "Database '$dbName' already exists"
        } else {
            Write-Info "Creating database '$dbName'..."
            createdb -h $dbHost -p $dbPort -U $dbUser $dbName 2>$null
            Write-Success "Database created successfully"
        }
    } catch {
        Write-Warning "Could not create database automatically. Please create it manually:"
        Write-Warning "  createdb -U $dbUser $dbName"
    }
}

# Step 6: Push database schema
Write-Info "Applying database schema..."
npm run db:push
Write-Success "Database schema applied"

# Step 7: Create logs directory
Write-Info "Creating logs directory..."
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType File -Force -Path "logs\.gitkeep" | Out-Null
Write-Success "Logs directory created"

# Step 8: Create models directory
Write-Info "Creating models directory..."
New-Item -ItemType Directory -Force -Path "models" | Out-Null
New-Item -ItemType File -Force -Path "models\.gitkeep" | Out-Null
Write-Success "Models directory created"

# Step 9: Setup complete
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                               ║" -ForegroundColor Green
Write-Host "║          Setup Complete Successfully!         ║" -ForegroundColor Green
Write-Host "║                                               ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Success "FiLine Wall is now ready to use!"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. Review your .env file and adjust settings if needed"
Write-Host "  2. Start the application with: " -NoNewline
Write-Host ".\start.ps1" -ForegroundColor Green
Write-Host "  3. Access the web interface at: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Blue
Write-Host ""
Write-Info "To start the application now, run:"
Write-Host "  .\start.ps1" -ForegroundColor Green
Write-Host ""
