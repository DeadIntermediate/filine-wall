#!/bin/bash

# FiLine Wall - Start Script
# Runs in tmux session with pre-flight checks

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")"

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Print banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════╗
║              FiLine Wall v1.0                 ║
║         Spam Call Blocking System             ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if we're already inside tmux
if [ -n "$TMUX" ]; then
    RUN_IN_TMUX=false
else
    # Check if tmux is installed
    if ! command -v tmux &> /dev/null; then
        log_warning "tmux not installed. Installing..."
        sudo apt update -qq && sudo apt install -y tmux
    fi
    RUN_IN_TMUX=true
fi

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found!"
    exit 1
fi
log_success "Node.js $(node --version)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_error "Dependencies not installed!"
    log_info "Installing dependencies..."
    npm install
fi

# Check/create .env
if [ ! -f .env ]; then
    log_warning ".env file not found. Creating..."
    
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
MODEM_ENABLED=false
MODEM_PATH=/dev/ttyUSB0
MODEM_BAUD_RATE=115200
ENABLE_ML_DETECTION=true
ENABLE_VOICE_ANALYSIS=false
ENABLE_HONEYPOT=false
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log
EOF
    
    log_success ".env created"
fi

# Verify DATABASE_URL
if ! grep -q "DATABASE_URL=" .env; then
    log_error ".env exists but DATABASE_URL is not set!"
    log_info "Run: ./fix-env.sh"
    exit 1
fi
log_success "Environment configured"

# Create required directories
mkdir -p logs models uploads
log_success "Directories ready"

echo ""
log_info "Starting FiLine Wall on port 5000..."
echo ""

# If already in tmux or running directly, start the app
if [ "$RUN_IN_TMUX" = false ]; then
    npm run dev
    exit 0
fi

# Kill existing tmux session if it exists
tmux has-session -t filine-wall 2>/dev/null && tmux kill-session -t filine-wall

# Start in tmux
echo -e "${CYAN}Tmux Controls:${NC}"
echo "  Detach (keep running): Ctrl+B then D"
echo "  Stop server: Ctrl+C"
echo "  Reattach later: tmux attach -t filine-wall"
echo ""
sleep 2

tmux new-session -d -s filine-wall "cd $(pwd) && npm run dev"
sleep 1
tmux attach -t filine-wall
