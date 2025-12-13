#!/bin/bash

# FiLine Wall - Quick Setup Script for Raspberry Pi
# This script ensures .env file exists with proper configuration

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          FiLine Wall - Quick Setup for Raspberry Pi           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Detect architecture
ARCH=$(uname -m)
echo "🔍 Detected architecture: $ARCH"

# Determine if this is 32-bit or 64-bit ARM
if [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armhf" ]; then
    echo "   → 32-bit ARM (armhf) detected"
    IS_32BIT=true
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    echo "   → 64-bit ARM (arm64) detected"
    IS_32BIT=false
elif [ "$ARCH" = "x86_64" ]; then
    echo "   → x86-64 detected"
    IS_32BIT=false
else
    echo "   → Unknown architecture, assuming 64-bit"
    IS_32BIT=false
fi
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "📄 .env file already exists"
    read -p "   Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Keeping existing .env file"
        
        # Update ML settings based on architecture
        if [ "$IS_32BIT" = true ]; then
            echo "   Updating ML settings for 32-bit ARM..."
            sed -i 's/^ENABLE_VOICE_ANALYSIS=.*/ENABLE_VOICE_ANALYSIS=false/' .env
            sed -i 's/^ENABLE_NLP_DETECTION=.*/ENABLE_NLP_DETECTION=false/' .env
            echo "   ✅ Disabled ML features for 32-bit compatibility"
        fi
        
        echo ""
        echo "✅ Setup complete!"
        exit 0
    fi
    mv .env .env.backup
    echo "   Backed up existing .env to .env.backup"
fi
echo ""

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo "❌ Error: .env.example not found!"
    exit 1
fi

echo "📝 Creating .env file from .env.example..."
cp .env.example .env

# Generate secure random strings
echo "🔐 Generating secure secrets..."

# Generate JWT secret (64 characters)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

# Generate encryption key (exactly 32 characters for AES-256)
ENCRYPTION_KEY=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# Generate session secret (64 characters)
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

# Update .env with generated secrets
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env

echo "   ✅ Secrets generated"
echo ""

# Configure based on architecture
if [ "$IS_32BIT" = true ]; then
    echo "⚙️  Configuring for 32-bit ARM (rule-based mode)..."
    
    # Disable ML features that require TensorFlow
    sed -i 's/^ENABLE_VOICE_ANALYSIS=.*/ENABLE_VOICE_ANALYSIS=false/' .env
    sed -i 's/^ENABLE_NLP_DETECTION=.*/ENABLE_NLP_DETECTION=false/' .env
    sed -i 's/^ENABLE_FEDERATED_LEARNING=.*/ENABLE_FEDERATED_LEARNING=false/' .env
    
    echo "   ✅ Disabled ML features (TensorFlow not available on 32-bit ARM)"
    echo "   ✅ Rule-based spam detection will be used"
else
    echo "⚙️  Configuring for 64-bit system (full ML capabilities)..."
    
    # Enable ML features
    sed -i 's/^ENABLE_VOICE_ANALYSIS=.*/ENABLE_VOICE_ANALYSIS=true/' .env
    sed -i 's/^ENABLE_NLP_DETECTION=.*/ENABLE_NLP_DETECTION=true/' .env
    
    echo "   ✅ ML features enabled"
fi
echo ""

# Set default database URL
echo "🗄️  Configuring database..."
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall|' .env
echo "   ✅ Database URL set to local PostgreSQL"
echo ""

# Set other defaults
echo "📋 Setting default configuration..."
sed -i 's/^NODE_ENV=.*/NODE_ENV=development/' .env
sed -i 's/^PORT=.*/PORT=5000/' .env
sed -i 's/^HOST=.*/HOST=0.0.0.0/' .env
sed -i 's/^REQUIRE_AUTH=.*/REQUIRE_AUTH=false/' .env
sed -i 's/^LOG_LEVEL=.*/LOG_LEVEL=info/' .env

# Ensure log file path exists
if ! grep -q "^LOG_FILE=" .env; then
    echo "LOG_FILE=logs/filine-wall.log" >> .env
fi

echo "   ✅ Default configuration applied"
echo ""

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs
chmod 755 logs
echo "   ✅ Logs directory created"
echo ""

# Display configuration summary
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                 Configuration Summary                         ║"
echo "╠═══════════════════════════════════════════════════════════════╣"

if [ "$IS_32BIT" = true ]; then
    echo "║  Architecture:     32-bit ARM (armhf)                        ║"
    echo "║  ML Features:      DISABLED (rule-based mode)                ║"
    echo "║  Voice Analysis:   DISABLED                                  ║"
    echo "║  NLP Detection:    DISABLED                                  ║"
else
    echo "║  Architecture:     64-bit ($ARCH)                            ║"
    echo "║  ML Features:      ENABLED                                   ║"
    echo "║  Voice Analysis:   ENABLED                                   ║"
    echo "║  NLP Detection:    ENABLED                                   ║"
fi

echo "║  Database:         PostgreSQL (localhost)                    ║"
echo "║  Port:             5000                                       ║"
echo "║  Auth Required:    false (local deployment)                  ║"
echo "║  Environment:      development                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Install dependencies:  npm install --legacy-peer-deps"
echo "  2. Setup database:        npm run db:push"
echo "  3. Start server:          npm run dev"
echo ""
echo "Note: Use --legacy-peer-deps flag due to react-simple-maps compatibility"
echo "      If you need to configure external APIs (Twilio, etc.),"
echo "      edit the .env file manually."
echo ""
