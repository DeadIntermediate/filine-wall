#!/bin/bash

# FiLine Wall - Session Manager
# Manage the FiLine Wall tmux session

SESSION_NAME="filine-wall"

show_help() {
    echo "FiLine Wall Session Manager"
    echo ""
    echo "Usage: ./manage-filine.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start     - Start FiLine Wall in tmux session"
    echo "  stop      - Stop FiLine Wall tmux session"
    echo "  restart   - Restart FiLine Wall"
    echo "  attach    - Attach to running session"
    echo "  status    - Check if FiLine Wall is running"
    echo "  logs      - Show live logs"
    echo "  help      - Show this help message"
    echo ""
    echo "Tmux shortcuts (when attached):"
    echo "  Ctrl+B then D  - Detach from session (keeps running)"
    echo "  Ctrl+C         - Stop the server"
}

case "$1" in
    start)
        echo "🚀 Starting FiLine Wall..."
        ./start-filine.sh
        ;;
    
    stop)
        if tmux has-session -t $SESSION_NAME 2>/dev/null; then
            echo "🛑 Stopping FiLine Wall..."
            tmux kill-session -t $SESSION_NAME
            echo "✓ FiLine Wall stopped"
        else
            echo "⚠️  FiLine Wall is not running"
        fi
        ;;
    
    restart)
        echo "🔄 Restarting FiLine Wall..."
        tmux has-session -t $SESSION_NAME 2>/dev/null && tmux kill-session -t $SESSION_NAME
        sleep 1
        ./start-filine.sh
        ;;
    
    attach)
        if tmux has-session -t $SESSION_NAME 2>/dev/null; then
            echo "📎 Attaching to FiLine Wall session..."
            echo "   (Press Ctrl+B then D to detach)"
            tmux attach -t $SESSION_NAME
        else
            echo "⚠️  FiLine Wall is not running"
            echo "   Start it with: ./manage-filine.sh start"
        fi
        ;;
    
    status)
        if tmux has-session -t $SESSION_NAME 2>/dev/null; then
            echo "✓ FiLine Wall is running"
            echo ""
            echo "Session info:"
            tmux list-sessions | grep $SESSION_NAME
            echo ""
            echo "To view logs: ./manage-filine.sh attach"
        else
            echo "⚠️  FiLine Wall is not running"
        fi
        ;;
    
    logs)
        if tmux has-session -t $SESSION_NAME 2>/dev/null; then
            echo "📋 Showing live logs (Ctrl+C to exit)..."
            tmux attach -t $SESSION_NAME
        else
            echo "⚠️  FiLine Wall is not running"
            if [ -f logs/filine-wall.log ]; then
                echo ""
                echo "Showing last 50 lines of log file:"
                tail -50 logs/filine-wall.log
            fi
        fi
        ;;
    
    help|--help|-h|"")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
