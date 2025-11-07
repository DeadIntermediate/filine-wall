#!/bin/bash

# FiLine Wall - Automatic Setup Script
# This script sets up the entire environment automatically

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Print banner
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════╗
║                                               ║
║           FiLine Wall Setup v1.0              ║
║     Automatic Installation & Configuration    ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root (for system-wide installations)
if [[ $EUID -eq 0 ]]; then
   log_warning "Running as root. This is okay for system installations."
fi

log_info "Starting automatic setup..."

# Step 1: Check Node.js
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed!"
    log_info "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version must be 18 or higher. Current: $(node --version)"
    exit 1
fi
log_success "Node.js $(node --version) detected"

# Step 2: Check PostgreSQL
log_info "Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    log_warning "PostgreSQL not found in PATH"
    log_info "Attempting to locate PostgreSQL..."
    
    # Common PostgreSQL locations
    if [ -f "/usr/bin/psql" ] || [ -f "/usr/local/bin/psql" ]; then
        log_success "PostgreSQL found"
    else
        log_error "PostgreSQL is not installed!"
        log_info "Please install PostgreSQL 13+ from https://www.postgresql.org/download/"
        exit 1
    fi
else
    log_success "PostgreSQL detected"
fi

# Step 3: Install dependencies
log_info "Installing Node.js dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi
log_success "Dependencies installed"

# Step 4: Setup environment file
log_info "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success "Created .env from .env.example"
        
        # Generate secure secrets
        log_info "Generating secure secrets..."
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        
        # Update .env with generated secrets
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/change-this-to-a-secure-random-string-in-production/$JWT_SECRET/" .env
            sed -i '' "s/change-this-to-a-32-character-string/$ENCRYPTION_KEY/" .env
        else
            # Linux
            sed -i "s/change-this-to-a-secure-random-string-in-production/$JWT_SECRET/" .env
            sed -i "s/change-this-to-a-32-character-string/$ENCRYPTION_KEY/" .env
        fi
        
        log_success "Generated secure JWT_SECRET and ENCRYPTION_KEY"
        
        # Prompt for database configuration
        echo ""
        log_info "Database Configuration"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        read -p "PostgreSQL username [postgres]: " DB_USER
        DB_USER=${DB_USER:-postgres}
        
        read -sp "PostgreSQL password: " DB_PASS
        echo ""
        
        read -p "Database name [filine_wall]: " DB_NAME
        DB_NAME=${DB_NAME:-filine_wall}
        
        read -p "Database host [localhost]: " DB_HOST
        DB_HOST=${DB_HOST:-localhost}
        
        read -p "Database port [5432]: " DB_PORT
        DB_PORT=${DB_PORT:-5432}
        
        # Update DATABASE_URL in .env
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        else
            sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env
        fi
        
        log_success "Database configuration updated"
    else
        log_error ".env.example not found!"
        exit 1
    fi
else
    log_warning ".env file already exists, skipping creation"
fi

# Step 5: Create database if it doesn't exist
log_info "Setting up database..."
DB_NAME=$(grep DATABASE_URL .env | cut -d'/' -f4 | cut -d'?' -f1)
DB_USER=$(grep DATABASE_URL .env | cut -d'/' -f3 | cut -d':' -f1)

if [ -n "$DB_NAME" ]; then
    # Check if database exists
    if PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME 2>/dev/null; then
        log_success "Database '$DB_NAME' already exists"
    else
        log_info "Creating database '$DB_NAME'..."
        if PGPASSWORD=$DB_PASS createdb -h $DB_HOST -U $DB_USER $DB_NAME 2>/dev/null; then
            log_success "Database created successfully"
        else
            log_warning "Could not create database automatically. Please create it manually:"
            log_warning "  createdb $DB_NAME"
        fi
    fi
fi

# Step 6: Push database schema
log_info "Applying database schema..."
npm run db:push
log_success "Database schema applied"

# Step 7: Create logs directory
log_info "Creating logs directory..."
mkdir -p logs
touch logs/.gitkeep
log_success "Logs directory created"

# Step 8: Create models directory for ML
log_info "Creating models directory..."
mkdir -p models
touch models/.gitkeep
log_success "Models directory created"

# Step 9: Setup complete message
echo ""
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════╗
║                                               ║
║          Setup Complete Successfully!         ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo ""
log_success "FiLine Wall is now ready to use!"
echo ""
log_info "Next steps:"
echo "  1. Review your .env file and adjust settings if needed"
echo "  2. Start the application with: ${GREEN}./start.sh${NC}"
echo "  3. Access the web interface at: ${BLUE}http://localhost:5173${NC}"
echo ""
log_info "To start the application now, run:"
echo -e "  ${GREEN}./start.sh${NC}"
echo ""
