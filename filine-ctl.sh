#!/bin/bash

# FiLine Wall - Tmux Management Script
# Easily manage the tmux session

SESSION_NAME="filine-wall"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if tmux session exists
session_exists() {
    tmux has-session -t $SESSION_NAME 2>/dev/null
}

# Show usage
usage() {
    echo -e "${CYAN}FiLine Wall - Tmux Manager${NC}"
    echo ""
    echo "Usage: $0 {start|stop|restart|attach|status|logs}"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}start${NC}     - Start FiLine Wall in tmux session"
    echo -e "  ${GREEN}stop${NC}      - Stop the tmux session"
    echo -e "  ${GREEN}restart${NC}   - Restart the application"
    echo -e "  ${GREEN}attach${NC}    - Attach to the running session"
    echo -e "  ${GREEN}status${NC}    - Check if session is running"
    echo -e "  ${GREEN}logs${NC}      - View logs (attach to session)"
    echo ""
}

# Start the session
start_session() {
    if session_exists; then
        log_error "Session already running!"
        log_info "Use '$0 attach' to view it or '$0 restart' to restart"
        exit 1
    fi
    
    log_info "Starting FiLine Wall in tmux..."
    ./start-tmux.sh detached
    log_success "Session started! Use '$0 attach' to view logs"
}

# Stop the session
stop_session() {
    if ! session_exists; then
        log_error "No session running!"
        exit 1
    fi
    
    log_info "Stopping FiLine Wall..."
    tmux kill-session -t $SESSION_NAME
    log_success "Session stopped"
}

# Restart the session
restart_session() {
    log_info "Restarting FiLine Wall..."
    if session_exists; then
        stop_session
        sleep 1
    fi
    start_session
}

# Attach to the session
attach_session() {
    if ! session_exists; then
        log_error "No session running!"
        log_info "Use '$0 start' to start the server"
        exit 1
    fi
    
    log_info "Attaching to session... (Press Ctrl+B then D to detach)"
    tmux attach-session -t $SESSION_NAME
}

# Check status
check_status() {
    if session_exists; then
        log_success "FiLine Wall is ${GREEN}RUNNING${NC}"
        echo ""
        echo "Session info:"
        tmux list-sessions -F "  • Name: #{session_name}" 2>/dev/null | grep $SESSION_NAME
        tmux list-sessions -F "  • Windows: #{session_windows}" 2>/dev/null | grep -A1 $SESSION_NAME | tail -1
        tmux list-sessions -F "  • Created: #{session_created_string}" 2>/dev/null | grep -A2 $SESSION_NAME | tail -1
        echo ""
        echo "Use '$0 attach' to view logs"
    else
        log_error "FiLine Wall is ${RED}NOT RUNNING${NC}"
        echo ""
        echo "Use '$0 start' to start the server"
    fi
}

# Main script
case "$1" in
    start)
        start_session
        ;;
    stop)
        stop_session
        ;;
    restart)
        restart_session
        ;;
    attach|logs)
        attach_session
        ;;
    status)
        check_status
        ;;
    *)
        usage
        exit 1
        ;;
esac
