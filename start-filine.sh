#!/bin/bash
cd "$(dirname "$0")"

# Check if we're already inside tmux
if [ -n "$TMUX" ]; then
    echo "Already running inside tmux session"
    RUN_IN_TMUX=false
else
    # Check if tmux is installed
    if ! command -v tmux &> /dev/null; then
        echo "⚠️  tmux not installed. Installing..."
        sudo apt update -qq && sudo apt install -y tmux
    fi
    RUN_IN_TMUX=true
fi

# Check if .env exists, create if missing
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating one now..."
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall

# Server Configuration
NODE_ENV=development
HOST=0.0.0.0
PORT=5000

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Modem Configuration
MODEM_ENABLED=false
MODEM_PATH=/dev/ttyUSB0
MODEM_BAUD_RATE=115200

# Feature Flags
ENABLE_ML_DETECTION=true
ENABLE_VOICE_ANALYSIS=false
ENABLE_HONEYPOT=false

# Logging
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log
EOF
    
    echo "✓ .env file created with default configuration"
    echo ""
fi

# Verify .env has DATABASE_URL
if ! grep -q "DATABASE_URL=" .env; then
    echo "❌ ERROR: .env file exists but DATABASE_URL is not set!"
    echo ""
    echo "Please run: ./fix-env.sh"
    exit 1
fi

# If running in tmux, start the app directly
if [ "$RUN_IN_TMUX" = false ]; then
    echo "🚀 Starting FiLine Wall..."
    echo "📁 Working directory: $(pwd)"
    echo "📄 Using .env file: $(pwd)/.env"
    echo ""
    npm run dev
    exit 0
fi

# Kill existing tmux session if it exists
tmux has-session -t filine-wall 2>/dev/null && tmux kill-session -t filine-wall

# Start new tmux session
echo "🚀 Starting FiLine Wall in tmux session..."
echo "📁 Working directory: $(pwd)"
echo "📄 Using .env file: $(pwd)/.env"
echo ""
echo "To attach to the session: tmux attach -t filine-wall"
echo "To detach from session: Press Ctrl+B then D"
echo "To stop FiLine Wall: tmux kill-session -t filine-wall"
echo ""

# Create tmux session and run the app
tmux new-session -d -s filine-wall "cd $(pwd) && npm run dev"

# Wait a moment for the session to start
sleep 2

# Attach to the session
echo "Attaching to tmux session..."
tmux attach -t filine-wall
