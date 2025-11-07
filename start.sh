#!/bin/bash

# FiLine Wall - Start Script
# Simplified script to start the application

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Print banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════╗
║                                               ║
║              FiLine Wall v1.0                 ║
║         Spam Call Blocking System             ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if setup has been run
if [ ! -f ".env" ]; then
    log_error "Environment file not found!"
    log_info "Please run the setup script first: ${GREEN}./setup.sh${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_error "Dependencies not installed!"
    log_info "Please run the setup script first: ${GREEN}./setup.sh${NC}"
    exit 1
fi

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found!"
    exit 1
fi
log_success "Node.js $(node --version)"

# Check PostgreSQL connection
log_info "Checking database connection..."
if npm run healthcheck &> /dev/null; then
    log_success "Database connection OK"
else
    log_warning "Database might not be running or configured correctly"
    log_info "The application will attempt to connect on startup..."
fi

# Check if port 5000 is available
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warning "Port 5000 is already in use"
    log_info "Another instance might be running, or another application is using this port"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
log_info "Starting FiLine Wall..."
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Display startup information
log_info "Server will start on:"
echo -e "  • API:           ${GREEN}http://localhost:5000${NC}"
echo -e "  • Web Interface: ${GREEN}http://localhost:5173${NC}"
echo -e "  • Health Check:  ${GREEN}http://localhost:5000/health${NC}"
echo ""

log_info "Environment: ${CYAN}$(grep NODE_ENV .env | cut -d'=' -f2)${NC}"
echo ""

log_info "Press ${RED}Ctrl+C${NC} to stop the server"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Trap Ctrl+C for graceful shutdown
trap 'echo ""; log_info "Shutting down FiLine Wall..."; exit 0' INT TERM

# Start the application
npm run dev
