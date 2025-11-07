# FiLine Wall - Start Script for Windows
# Simplified script to start the application

# Set error action
$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[✓] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[!] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[✗] $args" -ForegroundColor Red }

# Banner
Clear-Host
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                               ║" -ForegroundColor Cyan
Write-Host "║              FiLine Wall v1.0                 ║" -ForegroundColor Cyan
Write-Host "║         Spam Call Blocking System             ║" -ForegroundColor Cyan
Write-Host "║                                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if setup has been run
if (-not (Test-Path ".env")) {
    Write-Error "Environment file not found!"
    Write-Info "Please run the setup script first: " -NoNewline
    Write-Host ".\setup.ps1" -ForegroundColor Green
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Error "Dependencies not installed!"
    Write-Info "Please run the setup script first: " -NoNewline
    Write-Host ".\setup.ps1" -ForegroundColor Green
    exit 1
}

# Pre-flight checks
Write-Info "Running pre-flight checks..."

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Success "Node.js $nodeVersion"
} catch {
    Write-Error "Node.js not found!"
    exit 1
}

# Check database connection
Write-Info "Checking database connection..."
try {
    $null = npm run healthcheck 2>&1
    Write-Success "Database connection OK"
} catch {
    Write-Warning "Database might not be running or configured correctly"
    Write-Info "The application will attempt to connect on startup..."
}

# Check if port 5000 is available
$portInUse = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Warning "Port 5000 is already in use"
    Write-Info "Another instance might be running, or another application is using this port"
    $continue = Read-Host "Do you want to continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 1
    }
}

Write-Host ""
Write-Info "Starting FiLine Wall..."
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# Display startup information
Write-Info "Server will start on:"
Write-Host "  • API:           " -NoNewline
Write-Host "http://localhost:5000" -ForegroundColor Green
Write-Host "  • Web Interface: " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Green
Write-Host "  • Health Check:  " -NoNewline
Write-Host "http://localhost:5000/health" -ForegroundColor Green
Write-Host ""

$envContent = Get-Content .env -Raw
if ($envContent -match 'NODE_ENV=(.+)') {
    $env = $Matches[1]
    Write-Info "Environment: " -NoNewline
    Write-Host $env -ForegroundColor Cyan
} else {
    Write-Info "Environment: " -NoNewline
    Write-Host "development" -ForegroundColor Cyan
}
Write-Host ""

Write-Info "Press " -NoNewline
Write-Host "Ctrl+C" -ForegroundColor Red -NoNewline
Write-Host " to stop the server"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# Start the application
try {
    npm run dev
} catch {
    Write-Error "Failed to start the application"
    Write-Info "Check the error messages above for details"
    exit 1
}
