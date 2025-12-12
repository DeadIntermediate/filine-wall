#!/bin/bash

# FiLine Wall - PostgreSQL Service Starter
# Detects and starts the correct PostgreSQL service

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Detecting PostgreSQL service...${NC}"
echo ""

# Check if PostgreSQL is already running
if pgrep -x postgres > /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL is already running!${NC}"
    echo ""
    echo "Process details:"
    ps aux | grep postgres | grep -v grep | head -3
    echo ""
    echo "You can proceed with:"
    echo -e "  ${BLUE}./provision-database.sh${NC}"
    exit 0
fi

# Get PostgreSQL version
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1)
    echo -e "${BLUE}PostgreSQL version detected: ${PG_VERSION}${NC}"
else
    echo -e "${RED}✗ PostgreSQL not installed!${NC}"
    exit 1
fi

# List all available PostgreSQL services
echo ""
echo -e "${BLUE}Available PostgreSQL services:${NC}"
systemctl list-unit-files | grep postgres || echo "  (none found)"
echo ""

# Try different service name variations
SERVICES=(
    "postgresql@${PG_VERSION}-main"
    "postgresql-${PG_VERSION}"
    "postgresql@${PG_VERSION}"
    "postgresql"
)

echo -e "${BLUE}Trying to start PostgreSQL...${NC}"
echo ""

STARTED=false
for service in "${SERVICES[@]}"; do
    echo -e "${YELLOW}Trying: ${service}...${NC}"
    if sudo systemctl start "$service" 2>/dev/null; then
        echo -e "${GREEN}✓ Successfully started: ${service}${NC}"
        sudo systemctl enable "$service" 2>/dev/null || true
        STARTED=true
        
        # Verify it's running
        sleep 2
        if sudo systemctl is-active --quiet "$service"; then
            echo -e "${GREEN}✓ Service is active and running${NC}"
            echo ""
            echo "Next steps:"
            echo -e "  ${BLUE}./provision-database.sh${NC}  - Set up database"
            echo -e "  ${BLUE}./start-filine.sh${NC}        - Start FiLine Wall"
        fi
        break
    fi
done

if [ "$STARTED" = false ]; then
    echo ""
    echo -e "${RED}✗ Could not start PostgreSQL service automatically${NC}"
    echo ""
    echo -e "${YELLOW}Manual debugging steps:${NC}"
    echo ""
    echo "1. Check PostgreSQL installation:"
    echo -e "   ${BLUE}dpkg -l | grep postgresql${NC}"
    echo ""
    echo "2. Check available services:"
    echo -e "   ${BLUE}systemctl list-units --all | grep postgres${NC}"
    echo ""
    echo "3. Check PostgreSQL cluster status:"
    echo -e "   ${BLUE}pg_lsclusters${NC}"
    echo ""
    echo "4. Try starting the cluster directly:"
    echo -e "   ${BLUE}sudo pg_ctlcluster ${PG_VERSION} main start${NC}"
    echo ""
    echo "5. Check logs for errors:"
    echo -e "   ${BLUE}sudo journalctl -u postgresql* -n 50${NC}"
    exit 1
fi
