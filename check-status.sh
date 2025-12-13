#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              FiLine Wall - System Status Check                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check .env file
echo "📄 Checking .env file..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists ($(wc -c < .env) bytes)"
else
    echo "   ❌ .env file NOT FOUND!"
    echo "   → Run: cp .env.example .env"
    exit 1
fi
echo ""

# Check database connection
echo "🗄️  Checking database..."
if grep -q "DATABASE_URL" .env; then
    DB_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2)
    echo "   ✅ Database URL configured: ${DB_URL:0:30}..."
else
    echo "   ⚠️  DATABASE_URL not found in .env"
fi
echo ""

# Check PostgreSQL status
echo "🐘 Checking PostgreSQL..."
if command -v systemctl &> /dev/null; then
    if systemctl is-active --quiet postgresql; then
        echo "   ✅ PostgreSQL is running"
    else
        echo "   ❌ PostgreSQL is NOT running"
        echo "   → Run: sudo systemctl start postgresql"
    fi
else
    echo "   ⚠️  Cannot check PostgreSQL status (systemctl not available)"
fi
echo ""

# Check if server is running
echo "🌐 Checking if FiLine server is running..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "   ✅ Server is running on port 5000"
    HEALTH=$(curl -s http://localhost:5000/api/health)
    echo "   Health check: $HEALTH"
else
    echo "   ⚠️  Server is NOT running on port 5000"
    echo "   → Run: npm run dev"
fi
echo ""

# Check configuration
echo "⚙️  Configuration summary:"
echo "   • Node environment: $(grep NODE_ENV .env | cut -d'=' -f2)"
echo "   • Port: $(grep -E '^PORT=' .env | cut -d'=' -f2)"
echo "   • Auth required: $(grep REQUIRE_AUTH .env | cut -d'=' -f2)"
echo "   • Voice analysis: $(grep ENABLE_VOICE_ANALYSIS .env | cut -d'=' -f2)"
echo "   • NLP detection: $(grep ENABLE_NLP_DETECTION .env | cut -d'=' -f2)"
echo "   • Modem enabled: $(grep MODEM_ENABLED .env | cut -d'=' -f2)"
echo ""

# System info
echo "💻 System information:"
echo "   • Architecture: $(uname -m)"
echo "   • OS: $(uname -s)"
echo "   • Node version: $(node --version 2>/dev/null || echo 'not installed')"
echo "   • NPM version: $(npm --version 2>/dev/null || echo 'not installed')"
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    Status Check Complete                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "To start the server: npm run dev"
echo "To stop the server: Press Ctrl+C"
echo "To check logs: tail -f logs/filine-wall.log"
echo ""
