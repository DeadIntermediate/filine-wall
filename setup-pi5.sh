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
echo "  • ML Features: FULL ENABLED"
echo "    - Voice Analysis"
echo "    - Advanced NLP Detection"
echo "    - Reinforcement Learning"
echo "    - Federated Learning"
echo "    - Collaborative Threat Intelligence"
echo "    - Real-time Transcription"
echo "    - Behavioral Analysis"
echo "  • Environment: Production"
echo "  • Database: Remote PostgreSQL (10.0.0.97)"
echo "  • Modem: /dev/ttyACM0 @ 57600 baud"
echo "  • Authentication: Disabled (local mode)"
echo "  • Performance: Optimized for Pi 5 (4 cores)"
echo "  • Honeypot: Enabled"
echo ""

# Check if using remote database
DB_HOST=$(grep DATABASE_URL .env | cut -d'@' -f2 | cut -d':' -f1)
if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
    # Create local database if it doesn't exist
    echo "📦 Setting up local PostgreSQL database..."
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw filine_wall; then
        echo "✓ Database 'filine_wall' already exists"
    else
        sudo -u postgres psql -c "CREATE DATABASE filine_wall;" > /dev/null 2>&1
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filine_wall TO postgres;" > /dev/null 2>&1
        echo "✓ Created database 'filine_wall'"
    fi
else
    echo "📦 Using remote PostgreSQL database at $DB_HOST"
    echo "   Skipping local database setup..."
    echo ""
    echo "⚠️  Make sure the remote database is configured!"
    echo "   Run on PostgreSQL server: ./setup-postgres-remote.sh"
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
echo "  ✅ Full ML/AI spam detection (all models enabled)"
echo "  ✅ Voice analysis with TensorFlow"
echo "  ✅ Advanced NLP & pattern detection"
echo "  ✅ Adaptive & reinforcement learning"
echo "  ✅ Collaborative threat intelligence"
echo "  ✅ Real-time call transcription"
echo "  ✅ Behavioral analysis & anomaly detection"
echo "  ✅ Honeypot system for scammer tracking"
echo "  ✅ Multi-threaded processing (4 cores)"
echo ""
echo "To view logs: tmux attach -t filine-wall"
echo "To detach:    Press Ctrl+B, then D"
echo ""
