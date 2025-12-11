#!/bin/bash

#############################################
# FiLine Wall - GitHub Pull Updater
# Pull latest changes from GitHub and update
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════╗"
echo "║   FiLine Wall - GitHub Updater        ║"
echo "╔════════════════════════════════════════╗"
echo -e "${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}✗ Error: Not a git repository${NC}"
    echo -e "${YELLOW}This script must be run from the FiLine Wall directory${NC}"
    echo ""
    echo "To install from GitHub for the first time, use:"
    echo "  curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install-complete.sh | bash"
    exit 1
fi

echo -e "${BLUE}➜ Current directory: $(pwd)${NC}"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo -e "${YELLOW}⚠ Warning: You have uncommitted changes${NC}"
    echo ""
    echo "Your local changes:"
    git status --short
    echo ""
    read -p "Do you want to stash your changes and continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}➜ Stashing local changes...${NC}"
        git stash push -m "Auto-stash before update $(date)"
        STASHED=true
    else
        echo -e "${RED}✗ Update cancelled${NC}"
        exit 1
    fi
fi

# Fetch latest changes
echo -e "${BLUE}➜ Fetching latest changes from GitHub...${NC}"
git fetch origin

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}✓ Current branch: $CURRENT_BRANCH${NC}"

# Pull latest changes
echo -e "${BLUE}➜ Pulling latest changes...${NC}"
if git pull origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}✓ Successfully pulled latest changes${NC}"
else
    echo -e "${RED}✗ Failed to pull changes${NC}"
    if [ "$STASHED" = true ]; then
        echo -e "${BLUE}➜ Restoring your stashed changes...${NC}"
        git stash pop
    fi
    exit 1
fi

# Show what changed
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Recent changes:${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
git log --oneline -5
echo ""

# Check if package.json changed
if git diff HEAD@{1} --name-only | grep -q "package.json"; then
    echo -e "${YELLOW}⚠ package.json changed - dependencies may need updating${NC}"
    read -p "Do you want to install/update dependencies? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${BLUE}➜ Installing dependencies...${NC}"
        npm install
        echo -e "${GREEN}✓ Dependencies updated${NC}"
    fi
fi

# Check if database schema changed
if git diff HEAD@{1} --name-only | grep -q "db/schema.ts"; then
    echo -e "${YELLOW}⚠ Database schema changed - migration may be needed${NC}"
    read -p "Do you want to push database changes? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${BLUE}➜ Pushing database changes...${NC}"
        npm run db:push
        echo -e "${GREEN}✓ Database schema updated${NC}"
    fi
fi

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo ""
    echo -e "${BLUE}➜ Restoring your stashed changes...${NC}"
    if git stash pop; then
        echo -e "${GREEN}✓ Stashed changes restored${NC}"
    else
        echo -e "${YELLOW}⚠ Conflicts detected while restoring changes${NC}"
        echo "Please resolve conflicts manually and run: git stash drop"
    fi
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Update Complete Successfully!     ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Review the changes above"
echo "  2. Restart FiLine Wall:"
echo "     ${BLUE}./manage-filine.sh restart${NC}"
echo ""
echo "  Or manually:"
echo "     ${BLUE}npm run dev${NC}"
echo ""
