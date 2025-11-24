#!/bin/bash

# Fix .env file - ensure DATABASE_URL is properly set
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🔧 Fixing .env configuration..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Creating .env from .env.example..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
    else
        echo "❌ .env.example also not found. Creating minimal .env..."
        cat > .env << 'EOF'
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall
JWT_SECRET=change-this-to-a-secure-random-string
ENCRYPTION_KEY=change-this-to-a-32-character-string
SESSION_SECRET=change-this-session-secret
BLOCK_THRESHOLD=0.7
ADAPTIVE_LEARNING=true
ENABLE_HONEYPOT=false
ENABLE_ANALYTICS=true
METRICS_RETENTION_DAYS=90
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log
MODEM_ENABLED=true
MODEM_PORT=/dev/ttyUSB0
MODEM_BAUD_RATE=115200
MODEM_AUTO_DETECT=true
ENABLE_VOICE_ANALYSIS=true
ENABLE_NLP_DETECTION=true
ENABLE_FEDERATED_LEARNING=false
ENABLE_IVR=true
EOF
        echo "✅ Created minimal .env file"
    fi
fi

# Check current DATABASE_URL
echo "Checking DATABASE_URL..."
if grep -q "^DATABASE_URL=" .env; then
    CURRENT_DB=$(grep "^DATABASE_URL=" .env | head -n 1)
    echo "Current: $CURRENT_DB"
    
    # Check if it's empty or placeholder
    if echo "$CURRENT_DB" | grep -qE "DATABASE_URL=$|DATABASE_URL=postgresql://filine:|DATABASE_URL=change-this"; then
        echo "⚠️  DATABASE_URL is invalid or placeholder"
        # Remove old DATABASE_URL lines
        sed -i '/^DATABASE_URL=/d' .env
        # Add correct one
        echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall" >> .env
        echo "✅ Updated DATABASE_URL to: postgresql://postgres:postgres@localhost:5432/filine_wall"
    else
        echo "✅ DATABASE_URL looks valid"
    fi
else
    echo "⚠️  DATABASE_URL not found in .env"
    echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall" >> .env
    echo "✅ Added DATABASE_URL: postgresql://postgres:postgres@localhost:5432/filine_wall"
fi

# Generate secure secrets if they're still placeholder values
echo ""
echo "Checking security secrets..."

generate_secret() {
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
}

# Fix JWT_SECRET if it's a placeholder
if grep -qE "^JWT_SECRET=(change-this|YOUR_)" .env; then
    echo "Generating new JWT_SECRET..."
    NEW_JWT=$(generate_secret)
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT|g" .env
    echo "✅ Generated new JWT_SECRET"
fi

# Fix ENCRYPTION_KEY if it's a placeholder
if grep -qE "^ENCRYPTION_KEY=(change-this|YOUR_)" .env; then
    echo "Generating new ENCRYPTION_KEY..."
    NEW_ENC=$(generate_secret)
    sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$NEW_ENC|g" .env
    echo "✅ Generated new ENCRYPTION_KEY"
fi

# Fix SESSION_SECRET if it's a placeholder
if grep -qE "^SESSION_SECRET=(change-this|YOUR_)" .env; then
    echo "Generating new SESSION_SECRET..."
    NEW_SESSION=$(generate_secret)
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$NEW_SESSION|g" .env
    echo "✅ Generated new SESSION_SECRET"
fi

echo ""
echo "✅ .env configuration fixed!"
echo ""
echo "Current DATABASE_URL:"
grep "^DATABASE_URL=" .env
echo ""
echo "You can now run:"
echo "  ./start.sh"
