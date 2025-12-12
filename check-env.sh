#!/bin/bash

# FiLine Wall - Environment Diagnostic Tool
# Checks configuration and suggests fixes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 FiLine Wall - Environment Diagnostics${NC}"
echo ""

ISSUES_FOUND=0

# Check 1: .env file exists
echo -e "${BLUE}[1/6]${NC} Checking .env file..."
if [ -f .env ]; then
    echo -e "${GREEN}  ✓${NC} .env file exists"
else
    echo -e "${RED}  ✗${NC} .env file NOT found!"
    echo -e "${YELLOW}  Fix: Run ./provision-database.sh${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 2: DATABASE_URL in .env
echo -e "${BLUE}[2/6]${NC} Checking DATABASE_URL..."
if [ -f .env ] && grep -q "^DATABASE_URL=" .env; then
    DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
    echo -e "${GREEN}  ✓${NC} DATABASE_URL is set"
    echo -e "      ${DB_URL:0:40}..."
else
    echo -e "${RED}  ✗${NC} DATABASE_URL not set in .env!"
    echo -e "${YELLOW}  Fix: Run ./provision-database.sh${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 3: PostgreSQL running
echo -e "${BLUE}[3/6]${NC} Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    if sudo systemctl is-active --quiet postgresql 2>/dev/null || pgrep -x postgres >/dev/null; then
        echo -e "${GREEN}  ✓${NC} PostgreSQL is running"
    else
        echo -e "${YELLOW}  ⚠${NC} PostgreSQL is installed but not running"
        echo -e "${YELLOW}  Fix: sudo systemctl start postgresql${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${RED}  ✗${NC} PostgreSQL not installed!"
    echo -e "${YELLOW}  Fix: sudo apt install postgresql${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 4: Database connection
echo -e "${BLUE}[4/6]${NC} Testing database connection..."
if [ -f .env ] && grep -q "^DATABASE_URL=" .env; then
    DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
    # Extract connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        
        if PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
            echo -e "${GREEN}  ✓${NC} Database connection successful"
        else
            echo -e "${RED}  ✗${NC} Cannot connect to database!"
            echo -e "${YELLOW}  Database: $DB_NAME${NC}"
            echo -e "${YELLOW}  User: $DB_USER${NC}"
            echo -e "${YELLOW}  Host: $DB_HOST:$DB_PORT${NC}"
            echo -e "${YELLOW}  Fix: Run ./provision-database.sh${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    else
        echo -e "${YELLOW}  ⚠${NC} Could not parse DATABASE_URL"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${YELLOW}  ⊘${NC} Skipped (DATABASE_URL not set)"
fi

# Check 5: Node modules
echo -e "${BLUE}[5/6]${NC} Checking dependencies..."
if [ -d node_modules ]; then
    # Check critical packages
    MISSING=""
    for pkg in dotenv drizzle-orm postgres express; do
        if [ ! -d "node_modules/$pkg" ]; then
            MISSING="$MISSING $pkg"
        fi
    done
    
    if [ -z "$MISSING" ]; then
        echo -e "${GREEN}  ✓${NC} All critical dependencies installed"
    else
        echo -e "${RED}  ✗${NC} Missing dependencies:$MISSING"
        echo -e "${YELLOW}  Fix: ./fix-dependencies.sh${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${RED}  ✗${NC} node_modules not found!"
    echo -e "${YELLOW}  Fix: npm install${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check 6: Node.js version
echo -e "${BLUE}[6/6]${NC} Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}  ✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${RED}  ✗${NC} Node.js not installed!"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! FiLine Wall should start normally.${NC}"
    echo ""
    echo "Run: ./start-filine.sh"
else
    echo -e "${RED}✗ Found $ISSUES_FOUND issue(s) that need attention.${NC}"
    echo ""
    echo -e "${YELLOW}Quick Fix (runs all fixes):${NC}"
    echo "  ./provision-database.sh  # Fix database and .env"
    echo "  ./fix-dependencies.sh    # Fix missing packages"
    echo "  ./start-filine.sh        # Start FiLine Wall"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
