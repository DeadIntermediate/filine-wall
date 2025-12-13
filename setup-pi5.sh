#!/bin/bash
# Raspberry Pi 5 Production Setup for FiLine Wall
# This sets up FiLine Wall with full ML features on 64-bit ARM

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  FiLine Wall - Raspberry Pi 5 Setup       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    echo "⚠️  Warning: This script is designed for 64-bit ARM (aarch64)"
    echo "   Detected: $ARCH"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✓ Architecture: $ARCH (64-bit ARM)"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists"
    echo ""
    read -p "Backup and replace with Pi 5 production config? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%s)
        echo "✓ Backed up existing .env"
        cp .env.pi5-production .env
        echo "✓ Installed Pi 5 production config"
    fi
else
    cp .env.pi5-production .env
    echo "✓ Created .env with Pi 5 production config"
fi

echo ""
echo "🔧 Configuration:"
echo "  • ML Features: ENABLED (Voice Analysis, NLP)"
echo "  • Environment: Production"
echo "  • Modem: /dev/ttyACM0 @ 57600 baud"
echo "  • Authentication: Disabled (local mode)"
echo ""

# Create database if it doesn't exist
echo "📦 Setting up PostgreSQL database..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw filine_wall; then
    echo "✓ Database 'filine_wall' already exists"
else
    sudo -u postgres psql -c "CREATE DATABASE filine_wall;" > /dev/null 2>&1
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filine_wall TO postgres;" > /dev/null 2>&1
    echo "✓ Created database 'filine_wall'"
fi

echo ""
echo "📊 Pushing database schema..."
npm run db:push

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║           Setup Complete! ✅               ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Start FiLine Wall:"
echo "  ./start-filine.sh"
echo ""
echo "The server will run in a tmux session with:"
echo "  • Full ML/AI spam detection"
echo "  • Voice analysis"
echo "  • Advanced NLP detection"
echo "  • Adaptive learning"
echo ""
echo "To view logs: tmux attach -t filine-wall"
echo "To detach:    Press Ctrl+B, then D"
echo ""
