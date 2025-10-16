# FiLine Wall Installation Script for Windows
# Requires PowerShell 5.0+ and Administrator privileges

param(
    [switch]$SkipWSL,
    [switch]$DockerOnly,
    [switch]$Help
)

# Colors for output
$RED = "Red"
$GREEN = "Green" 
$YELLOW = "Yellow"
$BLUE = "Cyan"

# Configuration
$NODE_VERSION = "20.17.0"
$POSTGRES_VERSION = "15"
$PROJECT_NAME = "filinewall"
$INSTALL_DIR = "C:\Program Files\FiLineWall"
$WEB_ROOT = "C:\inetpub\wwwroot\filinewall"

function Write-Header {
    Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor $BLUE
    Write-Host "║                FiLine Wall                   ║" -ForegroundColor $BLUE
    Write-Host "║         Windows Installation Script         ║" -ForegroundColor $BLUE
    Write-Host "║                                              ║" -ForegroundColor $BLUE
    Write-Host "║   Anti-Telemarketing & Spam Call Blocker    ║" -ForegroundColor $BLUE
    Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor $BLUE
}

function Write-Info {
    param($Message)
    Write-Host "[INFO] $Message" -ForegroundColor $GREEN
}

function Write-Warn {
    param($Message)
    Write-Host "[WARN] $Message" -ForegroundColor $YELLOW
}

function Write-Error {
    param($Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $RED
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Chocolatey {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Chocolatey package manager..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:PATH += ";C:\ProgramData\chocolatey\bin"
    } else {
        Write-Info "Chocolatey is already installed"
    }
}

function Install-WSL {
    if ($SkipWSL) {
        Write-Info "Skipping WSL installation"
        return
    }
    
    Write-Info "Checking WSL installation..."
    $wslStatus = wsl --status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Installing WSL 2..."
        wsl --install --distribution Ubuntu
        Write-Warn "WSL installation requires a reboot. Please run this script again after reboot."
        Read-Host "Press Enter to reboot now, or Ctrl+C to cancel"
        Restart-Computer -Force
        exit
    } else {
        Write-Info "WSL is already installed"
    }
}

function Install-Docker {
    if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Docker Desktop..."
        choco install docker-desktop -y
        Write-Warn "Docker Desktop installation requires a reboot or logout/login."
        Write-Info "Please restart and run this script again to complete setup."
        return $false
    } else {
        Write-Info "Docker is already installed"
        return $true
    }
}

function Install-NodeJS {
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Node.js $NODE_VERSION..."
        choco install nodejs --version=$NODE_VERSION -y
        $env:PATH += ";C:\Program Files\nodejs"
        npm install -g npm@latest pnpm
    } else {
        $currentVersion = node --version
        Write-Info "Node.js $currentVersion is already installed"
    }
}

function Install-PostgreSQL {
    if (!(Get-Service -Name postgresql* -ErrorAction SilentlyContinue)) {
        Write-Info "Installing PostgreSQL $POSTGRES_VERSION..."
        choco install postgresql$POSTGRES_VERSION --params '/Password:filinewall_secure_password' -y
        
        # Wait for service to start
        Start-Sleep -Seconds 10
        
        # Create database and user
        Write-Info "Setting up database..."
        $env:PGPASSWORD = "filinewall_secure_password"
        & "C:\Program Files\PostgreSQL\$POSTGRES_VERSION\bin\psql.exe" -U postgres -c "CREATE USER filinewall WITH PASSWORD 'filinewall_secure_password';" 2>$null
        & "C:\Program Files\PostgreSQL\$POSTGRES_VERSION\bin\psql.exe" -U postgres -c "CREATE DATABASE $PROJECT_NAME OWNER filinewall;" 2>$null
        & "C:\Program Files\PostgreSQL\$POSTGRES_VERSION\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $PROJECT_NAME TO filinewall;" 2>$null
    } else {
        Write-Info "PostgreSQL is already installed"
    }
}

function Install-Redis {
    if (!(Get-Command redis-server -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Redis..."
        # Redis for Windows
        choco install redis-64 -y
    } else {
        Write-Info "Redis is already installed"
    }
}

function Install-Python {
    if (!(Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Info "Installing Python..."
        choco install python -y
        $env:PATH += ";C:\Python311;C:\Python311\Scripts"
    } else {
        Write-Info "Python is already installed"
    }
}

function Install-IIS {
    Write-Info "Enabling IIS and required features..."
    Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-CommonHttpFeatures, IIS-HttpErrors, IIS-HttpRedirect, IIS-ApplicationDevelopment, IIS-NetFxExtensibility45, IIS-HealthAndDiagnostics, IIS-HttpLogging, IIS-Security, IIS-RequestFiltering, IIS-Performance, IIS-WebServerManagementTools, IIS-ManagementConsole, IIS-IIS6ManagementCompatibility, IIS-Metabase -All
}

function Setup-Application {
    Write-Info "Setting up FiLine Wall application..."
    
    # Create directories
    New-Item -ItemType Directory -Force -Path $INSTALL_DIR
    New-Item -ItemType Directory -Force -Path $WEB_ROOT
    New-Item -ItemType Directory -Force -Path "C:\Logs\FiLineWall"
    
    # Install Node.js dependencies
    Write-Info "Installing Node.js dependencies..."
    npm install
    
    # Build application
    Write-Info "Building application..."
    npm run build
    
    # Copy built files to web root
    Copy-Item -Path "dist\public\*" -Destination $WEB_ROOT -Recurse -Force
}

function Setup-PythonEnvironment {
    Write-Info "Setting up Python environment for device client..."
    
    Set-Location device-client
    python -m venv venv
    & "venv\Scripts\Activate.ps1"
    pip install cryptography pyserial
    deactivate
    Set-Location ..
}

function Setup-WindowsServices {
    Write-Info "Setting up Windows services..."
    
    # Create service wrapper script for Node.js API
    $serviceScript = @"
const { spawn } = require('child_process');
const path = require('path');

const apiProcess = spawn('node', ['dist/index.js'], {
    cwd: '$INSTALL_DIR',
    env: { 
        ...process.env, 
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://filinewall:filinewall_secure_password@localhost:5432/$PROJECT_NAME'
    },
    stdio: 'inherit'
});

apiProcess.on('close', (code) => {
    console.log(`API process exited with code $code`);
    process.exit(code);
});

process.on('SIGTERM', () => {
    apiProcess.kill('SIGTERM');
});
"@
    
    Set-Content -Path "$INSTALL_DIR\service.js" -Value $serviceScript
    
    # Install node-windows service manager
    npm install -g node-windows
    
    # Create service installation script
    $serviceInstaller = @"
const Service = require('node-windows').Service;

const svc = new Service({
    name: 'FiLineWall API',
    description: 'FiLine Wall Anti-Telemarketing API Server',
    script: '$INSTALL_DIR\\service.js',
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ]
});

svc.on('install', () => {
    svc.start();
});

svc.install();
"@
    
    Set-Content -Path "$INSTALL_DIR\install-service.js" -Value $serviceInstaller
    
    # Install the service
    Write-Info "Installing Windows service..."
    node "$INSTALL_DIR\install-service.js"
}

function Setup-IISConfiguration {
    Write-Info "Configuring IIS..."
    
    # Import WebAdministration module
    Import-Module WebAdministration
    
    # Create application pool
    New-WebAppPool -Name "FiLineWallPool" -Force
    Set-ItemProperty -Path "IIS:\AppPools\FiLineWallPool" -Name processModel.identityType -Value ApplicationPoolIdentity
    
    # Create website
    New-Website -Name "FiLineWall" -Port 80 -PhysicalPath $WEB_ROOT -ApplicationPool "FiLineWallPool" -Force
    
    # Configure reverse proxy for API (requires URL Rewrite and ARR)
    $webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:5000/api/{R:1}" />
                </rule>
                <rule name="Health Check Proxy" stopProcessing="true">
                    <match url="^health" />
                    <action type="Rewrite" url="http://localhost:5000/health" />
                </rule>
                <rule name="SPA Fallback" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>
        <defaultDocument>
            <files>
                <clear />
                <add value="index.html" />
            </files>
        </defaultDocument>
    </system.webServer>
</configuration>
"@
    
    Set-Content -Path "$WEB_ROOT\web.config" -Value $webConfig
}

function Setup-Environment {
    Write-Info "Setting up environment configuration..."
    
    if (!(Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        
        # Generate JWT secret
        $jwtSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        (Get-Content ".env") -replace "your-super-secure-secret-key-here", $jwtSecret | Set-Content ".env"
        
        # Update database URL
        (Get-Content ".env") -replace "postgresql://user:password@localhost:5432/filinewall", "postgresql://filinewall:filinewall_secure_password@localhost:5432/$PROJECT_NAME" | Set-Content ".env"
        
        Write-Info "Environment file created. Please review and update .env as needed."
    }
}

function Install-URLRewrite {
    Write-Info "Installing IIS URL Rewrite module..."
    $urlRewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
    $urlRewritePath = "$env:TEMP\rewrite_amd64_en-US.msi"
    
    Invoke-WebRequest -Uri $urlRewriteUrl -OutFile $urlRewritePath
    Start-Process msiexec.exe -ArgumentList "/i", $urlRewritePath, "/quiet" -Wait
    Remove-Item $urlRewritePath
}

function Install-ARR {
    Write-Info "Installing Application Request Routing..."
    $arrUrl = "https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi"
    $arrPath = "$env:TEMP\requestRouter_amd64.msi"
    
    Invoke-WebRequest -Uri $arrUrl -OutFile $arrPath
    Start-Process msiexec.exe -ArgumentList "/i", $arrPath, "/quiet" -Wait
    Remove-Item $arrPath
}

function Start-Services {
    Write-Info "Starting services..."
    
    # Start PostgreSQL
    Start-Service -Name "postgresql*"
    
    # Start Redis
    Start-Service -Name "Redis"
    
    # IIS should already be running
    
    # FiLineWall API service should start automatically
    Start-Sleep -Seconds 5
}

function Test-Installation {
    Write-Info "Verifying installation..."
    
    # Test web interface
    try {
        $response = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Info "✓ Web interface is accessible"
        }
    } catch {
        Write-Warn "✗ Web interface is not accessible"
    }
    
    # Test API
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Info "✓ API server is running"
        }
    } catch {
        Write-Warn "✗ API server is not running"
    }
    
    # Check services
    $services = @("postgresql*", "Redis", "FiLineWall API")
    foreach ($service in $services) {
        $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq "Running") {
            Write-Info "✓ $service is running"
        } else {
            Write-Warn "✗ $service is not running"
        }
    }
}

function Show-Completion {
    Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor $GREEN
    Write-Host "║              Installation Complete!          ║" -ForegroundColor $GREEN
    Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor $GREEN
    
    Write-Host "🚀 FiLine Wall has been installed successfully!" -ForegroundColor $GREEN
    Write-Host ""
    Write-Host "📱 Web Interface: http://localhost"
    Write-Host "🔧 API Endpoint: http://localhost:5000"
    Write-Host "📁 Installation Directory: $INSTALL_DIR"
    Write-Host "📋 Logs: Windows Event Viewer or C:\Logs\FiLineWall\"
    Write-Host ""
    Write-Host "🔐 Default admin credentials:"
    Write-Host "   Username: admin"
    Write-Host "   Password: admin123 (PLEASE CHANGE THIS!)"
    Write-Host ""
    Write-Host "⚙️  Next steps:"
    Write-Host "1. Review and update the .env file with your settings"
    Write-Host "2. Change the default admin password"
    Write-Host "3. Connect your modem device and configure it"
    Write-Host "4. Set up your phone number whitelist/blocklist"
    Write-Host ""
    Write-Host "📖 Documentation: README.md and DEPLOYMENT.md"
    Write-Host "🆘 Support: Check the GitHub repository for issues and documentation"
}

function Show-Help {
    Write-Host "FiLine Wall Windows Installation Script"
    Write-Host ""
    Write-Host "Usage: .\install.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -SkipWSL      Skip WSL installation (use Windows-native components)"
    Write-Host "  -DockerOnly   Only install Docker version"
    Write-Host "  -Help         Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\install.ps1                # Full installation with WSL"
    Write-Host "  .\install.ps1 -SkipWSL       # Windows-native installation"
    Write-Host "  .\install.ps1 -DockerOnly    # Docker-only installation"
}

function Install-DockerOnly {
    Write-Info "Installing Docker-only version..."
    
    Install-Chocolatey
    $dockerInstalled = Install-Docker
    
    if (!$dockerInstalled) {
        return
    }
    
    Write-Info "Setting up Docker environment..."
    
    # Create docker-compose.yml if it doesn't exist
    if (!(Test-Path "docker-compose.yml")) {
        Write-Error "docker-compose.yml not found. Please ensure you're in the project directory."
        exit 1
    }
    
    # Build and start containers
    docker-compose up -d --build
    
    Write-Info "Docker containers are starting up..."
    Start-Sleep -Seconds 30
    
    Test-Installation
    Show-Completion
}

# Main function
function Main {
    Write-Header
    
    if ($Help) {
        Show-Help
        exit 0
    }
    
    if (!(Test-Administrator)) {
        Write-Error "This script requires Administrator privileges. Please run PowerShell as Administrator."
        exit 1
    }
    
    if ($DockerOnly) {
        Install-DockerOnly
        return
    }
    
    Write-Info "Starting FiLine Wall installation for Windows..."
    Write-Info "This will install Node.js, PostgreSQL, Redis, IIS, and Python dependencies."
    
    $continue = Read-Host "Continue with installation? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Info "Installation cancelled."
        exit 0
    }
    
    try {
        Install-Chocolatey
        
        if (!$SkipWSL) {
            Install-WSL
        }
        
        Install-NodeJS
        Install-PostgreSQL
        Install-Redis
        Install-Python
        Install-IIS
        Install-URLRewrite
        Install-ARR
        Setup-Application
        Setup-PythonEnvironment
        Setup-Environment
        Setup-WindowsServices
        Setup-IISConfiguration
        Start-Services
        Test-Installation
        Show-Completion
        
    } catch {
        Write-Error "Installation failed: $_"
        Write-Error "Please check the error message above and try again."
        exit 1
    }
}

# Run main function
Main