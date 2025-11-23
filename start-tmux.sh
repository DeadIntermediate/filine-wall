#!/bin/bash

# FiLine Wall - Tmux Start Script
# Starts the application in a tmux session for easy management

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Session name
SESSION_NAME="filine-wall"

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
║              (Tmux Session)                   ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    log_error "tmux is not installed!"
    log_info "Install it with: ${GREEN}sudo apt install tmux${NC} (Debian/Ubuntu)"
    log_info "              or: ${GREEN}sudo yum install tmux${NC} (RedHat/CentOS)"
    log_info "              or: ${GREEN}brew install tmux${NC} (macOS)"
    exit 1
fi

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

# Check if session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    log_warning "Session '$SESSION_NAME' already exists!"
    echo ""
    echo "Options:"
    echo "  1) Attach to existing session"
    echo "  2) Kill existing session and start new one"
    echo "  3) Exit"
    echo ""
    read -p "Choose an option (1-3): " -n 1 -r
    echo ""
    
    case $REPLY in
        1)
            log_info "Attaching to existing session..."
            tmux attach-session -t $SESSION_NAME
            exit 0
            ;;
        2)
            log_info "Killing existing session..."
            tmux kill-session -t $SESSION_NAME
            ;;
        3)
            log_info "Exiting..."
            exit 0
            ;;
        *)
            log_error "Invalid option"
            exit 1
            ;;
    esac
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
    log_info "Another instance might be running"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
log_info "Creating tmux session: ${CYAN}$SESSION_NAME${NC}"
echo ""

# Display startup information
log_info "Server will start on:"
echo -e "  • API:           ${GREEN}http://localhost:5000${NC}"
echo -e "  • Web Interface: ${GREEN}http://localhost:5173${NC}"
echo -e "  • Health Check:  ${GREEN}http://localhost:5000/health${NC}"
echo ""
log_info "Environment: ${CYAN}$(grep NODE_ENV .env | cut -d'=' -f2 || echo 'development')${NC}"
echo ""

# Create tmux session
log_info "Starting FiLine Wall in tmux..."
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Create new tmux session in detached mode
tmux new-session -d -s $SESSION_NAME

# Set up the window
tmux send-keys -t $SESSION_NAME "cd $(pwd)" C-m
tmux send-keys -t $SESSION_NAME "clear" C-m

# Display banner in tmux
tmux send-keys -t $SESSION_NAME "echo -e '\033[0;36m'" C-m
tmux send-keys -t $SESSION_NAME "cat << 'EOF'
╔═══════════════════════════════════════════════╗
║                                               ║
║              FiLine Wall v1.0                 ║
║         Spam Call Blocking System             ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF" C-m
tmux send-keys -t $SESSION_NAME "echo -e '\033[0m'" C-m
tmux send-keys -t $SESSION_NAME "echo ''" C-m
tmux send-keys -t $SESSION_NAME "echo -e '\033[0;34m[INFO]\033[0m Server starting...'" C-m
tmux send-keys -t $SESSION_NAME "echo -e '\033[0;34m[INFO]\033[0m Press Ctrl+C to stop the server'" C-m
tmux send-keys -t $SESSION_NAME "echo -e '\033[0;34m[INFO]\033[0m Press Ctrl+B then D to detach from this session'" C-m
tmux send-keys -t $SESSION_NAME "echo ''" C-m
tmux send-keys -t $SESSION_NAME "echo -e '\033[1;33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m'" C-m
tmux send-keys -t $SESSION_NAME "echo ''" C-m

# Start the application
tmux send-keys -t $SESSION_NAME "npm run dev" C-m

# Wait a moment for the session to initialize
sleep 1

log_success "Tmux session '${CYAN}$SESSION_NAME${NC}' created!"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Tmux Commands:${NC}"
echo -e "  • Attach to session:    ${CYAN}tmux attach -t $SESSION_NAME${NC}"
echo -e "  • Detach from session:  ${CYAN}Ctrl+B then D${NC}"
echo -e "  • Kill session:         ${CYAN}tmux kill-session -t $SESSION_NAME${NC}"
echo -e "  • List sessions:        ${CYAN}tmux ls${NC}"
echo ""
echo -e "${GREEN}Quick Commands:${NC}"
echo -e "  • View logs:            ${CYAN}./start-tmux.sh attach${NC}"
echo -e "  • Stop server:          ${CYAN}./start-tmux.sh stop${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if user wants to attach immediately
if [[ "$1" != "detached" ]]; then
    log_info "Attaching to session in 2 seconds..."
    log_info "Press ${RED}Ctrl+C${NC} now to stay detached"
    sleep 2
    tmux attach-session -t $SESSION_NAME
fi
