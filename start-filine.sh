#!/bin/bash
cd "$(dirname "$0")"

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

echo "🚀 Starting FiLine Wall..."
echo "📁 Working directory: $(pwd)"
echo "📄 Using .env file: $(pwd)/.env"
echo ""

# Use npm run dev which properly loads .env through the dev script
npm run dev
