#!/bin/bash

# FiLine Wall - Fix Missing Dependencies
# Run this if you get module not found errors

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         FiLine Wall - Dependency Fix Script                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$(dirname "$0")"

echo -e "${BLUE}➜ Checking Node.js version...${NC}"
node --version

echo -e "${BLUE}➜ Cleaning old dependencies...${NC}"
rm -rf node_modules package-lock.json

echo -e "${BLUE}➜ Installing dependencies (this may take a few minutes)...${NC}"
npm install

echo -e "${BLUE}➜ Verifying critical dependencies...${NC}"
MISSING=0

if [ ! -d "node_modules/drizzle-zod" ]; then
    echo -e "${RED}✗ drizzle-zod missing${NC}"
    MISSING=1
else
    echo -e "${GREEN}✓ drizzle-zod installed${NC}"
fi

if [ ! -d "node_modules/drizzle-orm" ]; then
    echo -e "${RED}✗ drizzle-orm missing${NC}"
    MISSING=1
else
    echo -e "${GREEN}✓ drizzle-orm installed${NC}"
fi

if [ ! -d "node_modules/postgres" ]; then
    echo -e "${RED}✗ postgres missing${NC}"
    MISSING=1
else
    echo -e "${GREEN}✓ postgres installed${NC}"
fi

if [ ! -d "node_modules/express" ]; then
    echo -e "${RED}✗ express missing${NC}"
    MISSING=1
else
    echo -e "${GREEN}✓ express installed${NC}"
fi

echo ""
if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          All dependencies installed successfully!              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}You can now start FiLine Wall:${NC}"
    echo -e "  ${BLUE}./start-filine.sh${NC}"
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║             Some dependencies are still missing!               ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Try running:${NC}"
    echo -e "  ${BLUE}npm install --force${NC}"
    exit 1
fi
