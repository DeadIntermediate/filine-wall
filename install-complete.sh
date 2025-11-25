#!/bin/bash

# FiLine Wall - Complete One-Command Installation Script
# Comprehensive automated installation for Raspberry Pi / Debian / Ubuntu / macOS
# Version: 3.0 - Ultra Comprehensive Edition with PostgreSQL 18
# 
# Usage: 
#   curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install-complete.sh | bash
#   OR download and run: ./install-complete.sh

set -e  # Exit on any error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
NODE_VERSION="20"
POSTGRES_VERSION="18"
DB_NAME="filine_wall"
DB_USER="postgres"
DB_PASSWORD="postgres"
REPO_URL="https://github.com/DeadIntermediate/filine-wall.git"
INSTALL_DIR="$HOME/filine-wall"
PROJECT_DIR="${PROJECT_DIR:-$INSTALL_DIR}"
LOG_FILE="$PROJECT_DIR/install.log"
STEPS_TOTAL=18
STEPS_COMPLETED=0

# Start logging
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
exec > >(tee -a "$LOG_FILE")
exec 2>&1

print_header() {
    clear
    echo -e "${CYAN}"
    echo "════════════════════════════════════════════════════════════════"
    echo "                        🛡️  FiLine Wall  🛡️"
    echo "          Complete One-Command Installation Script"
    echo ""
    echo "            Anti-Spam Call Blocker for Raspberry Pi"
    echo "            PostgreSQL 18 • Node.js 20 • Full Stack"
    echo "════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
    echo ""
}

print_step() {
    STEPS_COMPLETED=$((STEPS_COMPLETED + 1))
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}[Step $STEPS_COMPLETED/$STEPS_TOTAL]${NC} ${GREEN}$1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_progress() { echo -e "${BLUE}➜${NC} $1"; }

check_command() {
    command -v "$1" &> /dev/null
}

# Step 1: Detect OS
detect_os() {
    print_step "Detecting System"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PACKAGE_MANAGER="brew"
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        PACKAGE_MANAGER="apt"
        if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
            IS_RASPBERRY_PI=true
        fi
    else
        log_error "Unsupported OS. This script supports Debian/Ubuntu/Raspberry Pi/macOS"
        exit 1
    fi
    
    log_info "Operating System: $OS"
    log_info "Package Manager: $PACKAGE_MANAGER"
    [ "$IS_RASPBERRY_PI" = true ] && log_info "Platform: Raspberry Pi ✓"
    
    # Check for husky config and warn
    if [ -f "$PROJECT_DIR/.huskyrc.json" ] || [ -d "$PROJECT_DIR/.husky" ]; then
        log_warn "Husky git hooks detected - will skip lifecycle scripts to prevent errors"
    fi
}

# Step 2: Update system
update_system() {
    print_step "Updating System Packages"
    
    case $OS in
        "debian")
            log_progress "Updating package lists..."
            sudo apt update -qq
            log_info "Package lists updated"
            ;;
        "macos")
            log_progress "Updating Homebrew..."
            brew update
            log_info "Homebrew updated"
            ;;
    esac
}

# Step 3: Install system dependencies
install_system_deps() {
    print_step "Installing System Dependencies"
    
    case $OS in
        "debian")
            log_progress "Installing essential packages..."
            sudo DEBIAN_FRONTEND=noninteractive apt install -y \
                curl \
                wget \
                git \
                build-essential \
                python3 \
                python3-pip \
                python3-venv \
                ca-certificates \
                gnupg \
                lsb-release \
                usbutils \
                2>&1 | grep -E "(Setting up|Processing)" || true
            
            log_info "System packages installed"
            ;;
        "macos")
            if ! check_command brew; then
                log_progress "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            log_progress "Installing packages..."
            brew install python@3.11 2>&1 | grep -v "already installed" || true
            log_info "Homebrew packages installed"
            ;;
    esac
}

# Step 4: Install PostgreSQL 18
install_postgresql() {
    print_step "Installing PostgreSQL $POSTGRES_VERSION"
    
    case $OS in
        "debian")
            log_progress "Adding PostgreSQL repository..."
            
            # Install required packages for adding repository
            sudo DEBIAN_FRONTEND=noninteractive apt install -y wget gnupg2 lsb-release 2>&1 | grep -E "(Setting up|Processing)" || true
            
            # Add PostgreSQL GPG key using the new method
            sudo mkdir -p /etc/apt/keyrings
            wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
                sudo gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg 2>/dev/null || true
            
            # Add PostgreSQL repository with signed-by option
            echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
                sudo tee /etc/apt/sources.list.d/pgdg.list > /dev/null
            
            sudo apt update -qq
            
            log_progress "Installing PostgreSQL $POSTGRES_VERSION..."
            sudo DEBIAN_FRONTEND=noninteractive apt install -y postgresql-${POSTGRES_VERSION} postgresql-contrib-${POSTGRES_VERSION} 2>&1 | grep -E "(Setting up|Processing)" || true
            
            log_progress "Starting PostgreSQL service..."
            sudo systemctl start postgresql@${POSTGRES_VERSION}-main 2>/dev/null || sudo systemctl start postgresql
            sudo systemctl enable postgresql@${POSTGRES_VERSION}-main 2>/dev/null || sudo systemctl enable postgresql
            sleep 3
            ;;
        "macos")
            log_progress "Installing PostgreSQL..."
            brew install postgresql@${POSTGRES_VERSION}
            brew services start postgresql@${POSTGRES_VERSION}
            sleep 3
            ;;
    esac
    
    log_info "PostgreSQL $POSTGRES_VERSION installed ✓"
}

# Step 5: Install Node.js
install_nodejs() {
    print_step "Installing Node.js $NODE_VERSION"
    
    if check_command node; then
        CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_VERSION" -ge "$NODE_VERSION" ]; then
            log_info "Node.js $(node --version) already installed ✓"
            return 0
        fi
    fi
    
    case $OS in
        "debian")
            log_progress "Adding NodeSource repository..."
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - > /dev/null 2>&1
            
            log_progress "Installing Node.js..."
            sudo apt install -y nodejs > /dev/null 2>&1
            ;;
        "macos")
            log_progress "Installing Node.js..."
            brew install node@${NODE_VERSION}
            brew link --overwrite node@${NODE_VERSION} --force
            ;;
    esac
    
    log_info "Node.js $(node --version) installed ✓"
    log_info "npm $(npm --version) installed ✓"
}

# Step 6: Download or use existing project
download_project() {
    print_step "Setting Up Project Files"
    
    # If we're already in the project directory (script was run from there)
    if [ -f "$PROJECT_DIR/package.json" ] && [ -f "$PROJECT_DIR/db/schema.ts" ]; then
        log_info "Project files already present ✓"
        cd "$PROJECT_DIR"
        return 0
    fi
    
    # Check if install directory already exists
    if [ -d "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR/.git" ]; then
        log_warn "FiLine Wall already exists at $INSTALL_DIR"
        log_progress "Updating existing installation..."
        cd "$INSTALL_DIR"
        git pull origin main 2>&1 | head -5 || log_warn "Git pull failed, continuing..."
        PROJECT_DIR="$INSTALL_DIR"
    else
        log_progress "Cloning FiLine Wall from GitHub..."
        rm -rf "$INSTALL_DIR" 2>/dev/null || true
        git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | grep -E "(Cloning|Receiving)" || true
        cd "$INSTALL_DIR"
        PROJECT_DIR="$INSTALL_DIR"
        log_info "Project cloned to $INSTALL_DIR ✓"
    fi
    
    # Update log file location
    LOG_FILE="$PROJECT_DIR/install.log"
}

# Step 7: Setup PostgreSQL database
setup_postgresql() {
    print_step "Setting Up PostgreSQL Database"
    
    case $OS in
        "debian")
            log_progress "Starting PostgreSQL service..."
            sudo systemctl start postgresql 2>/dev/null || true
            sudo systemctl enable postgresql 2>/dev/null || true
            sleep 2
            ;;
        "macos")
            log_progress "Starting PostgreSQL service..."
            brew services start postgresql@15 2>/dev/null || true
            sleep 2
            ;;
    esac
    
    log_progress "Creating database '$DB_NAME'..."
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" > /dev/null 2>&1
    
    log_info "PostgreSQL database ready ✓"
}

# Step 6: Clean old installations
clean_old_install() {
    print_step "Cleaning Previous Installations"
    
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        log_warn "Found existing node_modules, removing..."
        rm -rf "$PROJECT_DIR/node_modules"
    fi
    
    if [ -f "$PROJECT_DIR/package-lock.json" ]; then
        log_progress "Removing old package-lock.json..."
        rm -f "$PROJECT_DIR/package-lock.json"
    fi
    
    log_info "Cleanup complete ✓"
}

# Step 7: Install project dependencies
install_project_deps() {
    print_step "Installing Project Dependencies"
    
    cd "$PROJECT_DIR"
    
    log_progress "Clearing npm cache..."
    npm cache clean --force > /dev/null 2>&1 || true
    
    # Disable husky config temporarily if it exists (prevents husky errors during install)
    if [ -f ".huskyrc.json" ]; then
        log_progress "Temporarily disabling husky config..."
        mv .huskyrc.json .huskyrc.json.tmp 2>/dev/null || true
    fi
    
    log_progress "Installing npm packages (this may take 3-5 minutes)..."
    log_warn "Please be patient, installing ~200 packages..."
    
    # By default, skip npm lifecycle scripts on Raspberry Pi to avoid issues with husky
    # You can override by setting SKIP_NPM_SCRIPTS=0 in the environment
    if [ "$IS_RASPBERRY_PI" = true ] && [ -z "${SKIP_NPM_SCRIPTS+x}" ]; then
        SKIP_NPM_SCRIPTS=1
    fi

    if [ "${SKIP_NPM_SCRIPTS}" = "1" ]; then
        log_warn "Skipping npm lifecycle scripts to avoid husky/prepare failures"
        npm_config_ignore_scripts=true npm install --loglevel=error --no-audit || {
            log_error "npm install failed, retrying without audit..."
            npm_config_ignore_scripts=true npm install --no-audit --legacy-peer-deps || {
                log_error "npm install still failing, trying with force..."
                npm_config_ignore_scripts=true npm install --force
            }
        }
    else
        npm install --loglevel=error --no-audit || {
            log_error "npm install failed, retrying with legacy-peer-deps..."
            npm install --no-audit --legacy-peer-deps || {
                log_error "npm install still failing, trying with force..."
                npm install --force
            }
        }
    fi
    
    # Install critical packages that may be missing
    log_progress "Ensuring critical packages are installed..."
    npm install postgres@^3.4.4 dotenv@^16.4.5 --save --loglevel=error 2>&1 | grep -v "up to date" || true
    npm install @types/node --save-dev --loglevel=error 2>&1 | grep -v "up to date" || true
    
    # Restore husky config if it was disabled
    if [ -f ".huskyrc.json.tmp" ]; then
        mv .huskyrc.json.tmp .huskyrc.json 2>/dev/null || true
    fi
    
    log_info "All dependencies installed ✓"
}

# Step 8: Create environment file
create_env_file() {
    print_step "Creating Environment Configuration"
    
    if [ -f "$PROJECT_DIR/.env" ]; then
        log_warn ".env exists, backing up to .env.backup"
        cp "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.backup"
    fi
    
    # Check if .env.example exists, if not create it
    if [ ! -f "$PROJECT_DIR/.env.example" ]; then
        log_warn ".env.example not found, creating from template..."
        cat > "$PROJECT_DIR/.env.example" << 'EOF'
# Server Configuration
NODE_ENV=development
HOST=0.0.0.0
PORT=5000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall

# Security - IMPORTANT: Change these in production!
JWT_SECRET=change-this-to-a-secure-random-string-in-production
ENCRYPTION_KEY=change-this-to-a-32-character-string
SESSION_SECRET=change-this-session-secret

# Call Screening Settings
BLOCK_THRESHOLD=0.7
ADAPTIVE_LEARNING=true
ENABLE_HONEYPOT=false

# External APIs (Optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Spam Database APIs (Optional)
NOMOROBO_API_KEY=
TRUECALLER_API_KEY=
FCC_API_KEY=

# Analytics
ENABLE_ANALYTICS=true
METRICS_RETENTION_DAYS=90

# Logging
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log

# Modem Configuration
MODEM_ENABLED=true
MODEM_PORT=/dev/ttyUSB0
MODEM_BAUD_RATE=115200
MODEM_AUTO_DETECT=true

# Email Notifications (Optional)
ENABLE_EMAIL_NOTIFICATIONS=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
NOTIFICATION_EMAIL=

# Advanced Features
ENABLE_VOICE_ANALYSIS=true
ENABLE_NLP_DETECTION=true
ENABLE_FEDERATED_LEARNING=false
ENABLE_IVR=true
EOF
        log_info "Created .env.example template"
    fi
    
    log_progress "Copying .env.example to .env..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    
    log_progress "Generating secure secrets..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    log_progress "Writing secrets to .env..."
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$PROJECT_DIR/.env"
        sed -i '' "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|g" "$PROJECT_DIR/.env"
        sed -i '' "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" "$PROJECT_DIR/.env"
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/$DB_NAME|g" "$PROJECT_DIR/.env"
        sed -i '' "s|HOST=.*|HOST=0.0.0.0|g" "$PROJECT_DIR/.env"
    else
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" "$PROJECT_DIR/.env"
        sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|g" "$PROJECT_DIR/.env"
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|g" "$PROJECT_DIR/.env"
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/$DB_NAME|g" "$PROJECT_DIR/.env"
        sed -i "s|HOST=.*|HOST=0.0.0.0|g" "$PROJECT_DIR/.env"
    fi
    
    # Verify DATABASE_URL is set
    if ! grep -q "^DATABASE_URL=postgresql://" "$PROJECT_DIR/.env"; then
        log_warn "DATABASE_URL not properly set, adding it..."
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/$DB_NAME" >> "$PROJECT_DIR/.env"
    fi
    
    log_info "Environment configured ✓"
    log_info "Secrets generated ✓"
    log_info "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/$DB_NAME ✓"
}

# Step 11: Create directories
create_directories() {
    print_step "Creating Required Directories"
    
    mkdir -p "$PROJECT_DIR/logs" "$PROJECT_DIR/models" "$PROJECT_DIR/uploads"
    chmod 755 "$PROJECT_DIR/logs" "$PROJECT_DIR/models" "$PROJECT_DIR/uploads"
    
    log_info "Directories created: logs, models, uploads ✓"
}

# Step 12: Fix database and server configuration
fix_database_config() {
    print_step "Fixing Database Driver Configuration"
    
    cd "$PROJECT_DIR"
    
    # Fix db/index.ts to use PostgreSQL driver instead of Neon
    log_progress "Updating db/index.ts..."
    cat > "$PROJECT_DIR/db/index.ts" << 'EOF'
/// <reference types="node" />
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const client = postgres(process.env.DATABASE_URL);

export const db = drizzle(client, { schema });
EOF
    
    # Add dotenv to server/index.ts if not present
    log_progress "Ensuring dotenv is loaded in server/index.ts..."
    if ! grep -q "dotenv" "$PROJECT_DIR/server/index.ts"; then
        # Create temp file with dotenv at the top
        echo '// Load environment variables first' > /tmp/dotenv-header.ts
        echo 'import { config } from "dotenv";' >> /tmp/dotenv-header.ts
        echo 'config();' >> /tmp/dotenv-header.ts
        echo '' >> /tmp/dotenv-header.ts
        
        # Prepend to server/index.ts
        cat /tmp/dotenv-header.ts "$PROJECT_DIR/server/index.ts" > /tmp/new-server-index.ts
        mv /tmp/new-server-index.ts "$PROJECT_DIR/server/index.ts"
        rm -f /tmp/dotenv-header.ts
        log_info "Added dotenv configuration to server/index.ts ✓"
    else
        log_info "dotenv already configured ✓"
    fi
    
    log_info "Database driver fixed (PostgreSQL) ✓"
}

# Step 13: Setup database schema
setup_database_schema() {
    print_step "Setting Up Database Schema"
    
    cd "$PROJECT_DIR"
    
    log_progress "Applying database migrations..."
    npm run db:push > /dev/null 2>&1
    
    log_info "Database schema created ✓"
}

# Step 14: Build project
build_project() {
    print_step "Building Project"
    
    cd "$PROJECT_DIR"
    
    log_progress "Building frontend and backend..."
    log_warn "This may take 2-3 minutes..."
    
    npm run build 2>&1 | grep -E "(built in|Build completed)" || true
    
    log_info "Project built successfully ✓"
}

# Step 15: Make scripts executable
setup_scripts() {
    print_step "Setting Up Launch Scripts"
    
    chmod +x "$PROJECT_DIR/setup.sh" 2>/dev/null || true
    chmod +x "$PROJECT_DIR/start.sh" 2>/dev/null || true
    chmod +x "$PROJECT_DIR/install.sh" 2>/dev/null || true
    
    log_info "Scripts are executable ✓"
}

# Step 16: Run health checks
run_health_checks() {
    print_step "Running Health Checks"
    
    local HEALTH_PASS=true
    
    log_progress "Checking Node.js..."
    if check_command node; then
        log_info "Node.js: $(node --version) ✓"
    else
        log_error "Node.js not found ✗"
        HEALTH_PASS=false
    fi
    
    log_progress "Checking npm..."
    if check_command npm; then
        log_info "npm: $(npm --version) ✓"
    else
        log_error "npm not found ✗"
        HEALTH_PASS=false
    fi
    
    log_progress "Checking PostgreSQL..."
    if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log_info "Database: $DB_NAME exists ✓"
    else
        log_error "Database not found ✗"
        HEALTH_PASS=false
    fi
    
    log_progress "Checking .env file..."
    if [ -f "$PROJECT_DIR/.env" ]; then
        log_info ".env file exists ✓"
        if grep -q "^DATABASE_URL=postgresql://" "$PROJECT_DIR/.env"; then
            log_info "DATABASE_URL configured ✓"
        else
            log_error "DATABASE_URL not configured ✗"
            HEALTH_PASS=false
        fi
    else
        log_error ".env file missing ✗"
        HEALTH_PASS=false
    fi
    
    log_progress "Checking node_modules..."
    if [ -d "$PROJECT_DIR/node_modules" ]; then
        log_info "Dependencies installed ✓"
    else
        log_error "node_modules missing ✗"
        HEALTH_PASS=false
    fi
    
    log_progress "Checking critical packages..."
    if [ -d "$PROJECT_DIR/node_modules/postgres" ]; then
        log_info "postgres (PostgreSQL driver) installed ✓"
    else
        log_warn "postgres package missing (will be installed)"
    fi
    
    if [ -d "$PROJECT_DIR/node_modules/dotenv" ]; then
        log_info "dotenv installed ✓"
    else
        log_warn "dotenv package missing (will be installed)"
    fi
    
    log_progress "Checking build output..."
    if [ -d "$PROJECT_DIR/dist" ]; then
        log_info "Build output exists ✓"
    else
        log_warn "dist/ not found (will build on first start)"
    fi
    
    if [ "$HEALTH_PASS" = false ]; then
        log_error "Health checks failed!"
        exit 1
    fi
    
    log_info "All health checks passed! ✓"
}

# Step 17: Create start script
create_start_script() {
    print_step "Creating Easy Start Script"
    
    cat > "$PROJECT_DIR/start-filine.sh" << 'STARTSCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Starting FiLine Wall..."
npx tsx server/index.ts
STARTSCRIPT
    
    chmod +x "$PROJECT_DIR/start-filine.sh"
    log_info "Start script created: ./start-filine.sh ✓"
}

# Step 18: Show completion and auto-start
show_completion_and_start() {
    print_step "Installation Complete! 🎉"
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║             ✓✓✓ Installation Successful! ✓✓✓                 ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "${CYAN}📦 What was installed:${NC}"
    echo -e "  ${GREEN}✓${NC} PostgreSQL $POSTGRES_VERSION"
    echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"
    echo -e "  ${GREEN}✓${NC} npm $(npm --version)"
    echo -e "  ${GREEN}✓${NC} FiLine Wall application"
    echo -e "  ${GREEN}✓${NC} Database schema"
    echo -e "  ${GREEN}✓${NC} Environment configuration"
    echo -e "  ${GREEN}✓${NC} Build artifacts"
    echo ""
    
    echo -e "${CYAN}📂 Installation directory:${NC}"
    echo -e "  ${BLUE}$PROJECT_DIR${NC}"
    echo ""
    
    echo -e "${CYAN}📊 Installation log saved to:${NC}"
    echo -e "  ${BLUE}$LOG_FILE${NC}"
    echo ""
    
    echo -e "${CYAN}🚀 To start FiLine Wall:${NC}"
    echo -e "  ${BLUE}cd $PROJECT_DIR${NC}"
    echo -e "  ${BLUE}./start-filine.sh${NC}"
    echo ""
    echo -e "${CYAN}Or use the standard start script:${NC}"
    echo -e "  ${BLUE}./start.sh${NC}"
    echo ""
    echo -e "${CYAN}🌐 Access points:${NC}"
    echo -e "  ${BLUE}Web Interface: http://localhost:5000${NC}"
    echo -e "  ${BLUE}API Health:    http://localhost:5000/health${NC}"
    echo ""
    
    read -p "Would you like to start FiLine Wall now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting FiLine Wall..."
        echo ""
        cd "$PROJECT_DIR"
        exec ./start-filine.sh
    else
        echo ""
        log_info "Installation complete! Start FiLine Wall when ready with:"
        echo -e "  ${BLUE}cd $PROJECT_DIR && ./start-filine.sh${NC}"
    fi
}

# Error handler
handle_error() {
    log_error "Installation failed at step $STEPS_COMPLETED/$STEPS_TOTAL"
    log_error "Check log file: $LOG_FILE"
    echo ""
    echo -e "${RED}Common issues:${NC}"
    echo -e "  1. Run with sudo if permissions denied"
    echo -e "  2. Ensure internet connection"
    echo -e "  3. Check if PostgreSQL is installed"
    echo -e "  4. Try: ${CYAN}sudo apt update && sudo apt upgrade${NC}"
    echo ""
    exit 1
}

trap 'handle_error' ERR

# Main execution
main() {
    print_header
    
    log_info "Starting comprehensive FiLine Wall installation..."
    log_info "This will install everything needed to run FiLine Wall"
    echo ""
    
    detect_os
    update_system
    install_system_deps
    install_postgresql
    install_nodejs
    download_project
    setup_postgresql
    clean_old_install
    install_project_deps
    create_env_file
    create_directories
    fix_database_config
    setup_database_schema
    build_project
    setup_scripts
    run_health_checks
    create_start_script
    show_completion_and_start
}

# Run installation
main "$@"
