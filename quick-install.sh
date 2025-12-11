#!/bin/bash

#############################################
# FiLine Wall - Quick GitHub Install
# Clone and install FiLine Wall from GitHub
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              FiLine Wall - GitHub Quick Install               ║"
echo "╔════════════════════════════════════════════════════════════════╗"
echo -e "${NC}"

# Configuration
REPO_URL="https://github.com/DeadIntermediate/filine-wall.git"
INSTALL_DIR="$HOME/filine-wall"
BRANCH="${1:-main}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed${NC}"
    echo ""
    echo "Please install git first:"
    echo "  Debian/Ubuntu: sudo apt-get install git"
    echo "  macOS: brew install git"
    exit 1
fi

# Check if directory already exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠ Directory $INSTALL_DIR already exists${NC}"
    echo ""
    read -p "Do you want to remove it and reinstall? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}➜ Removing existing directory...${NC}"
        rm -rf "$INSTALL_DIR"
    else
        echo ""
        echo -e "${CYAN}To update an existing installation, use:${NC}"
        echo "  cd $INSTALL_DIR"
        echo "  ./update-from-github.sh"
        exit 0
    fi
fi

# Clone repository
echo -e "${BLUE}➜ Cloning FiLine Wall from GitHub...${NC}"
echo -e "${BLUE}   Repository: $REPO_URL${NC}"
echo -e "${BLUE}   Branch: $BRANCH${NC}"
echo -e "${BLUE}   Destination: $INSTALL_DIR${NC}"
echo ""

if git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"; then
    echo -e "${GREEN}✓ Successfully cloned repository${NC}"
else
    echo -e "${RED}✗ Failed to clone repository${NC}"
    echo ""
    echo "Possible reasons:"
    echo "  - Repository is private (requires authentication)"
    echo "  - Network connection issues"
    echo "  - Branch '$BRANCH' does not exist"
    echo ""
    echo "Try with a different branch:"
    echo "  curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/quick-install.sh | bash -s develop"
    exit 1
fi

cd "$INSTALL_DIR"

# Show repository info
echo ""
echo -e "${CYAN}Repository information:${NC}"
echo -e "  Latest commit: $(git log -1 --oneline)"
echo -e "  Branch: $(git rev-parse --abbrev-ref HEAD)"
echo ""

# Run the complete installer
if [ -f "./install-complete.sh" ]; then
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Running complete installation...${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Export PROJECT_DIR so installer knows where we are
    export PROJECT_DIR="$INSTALL_DIR"
    
    chmod +x ./install-complete.sh
    ./install-complete.sh
else
    echo -e "${YELLOW}⚠ install-complete.sh not found in repository${NC}"
    echo ""
    echo "Manual installation steps:"
    echo "  1. Install dependencies: npm install"
    echo "  2. Set up database: npm run db:push"
    echo "  3. Start server: npm run dev"
    echo ""
    echo "See INSTALL.md for detailed instructions"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            FiLine Wall Installed Successfully!                 ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${CYAN}Installation directory: ${GREEN}$INSTALL_DIR${NC}"
echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo -e "  ${BLUE}cd $INSTALL_DIR${NC}              - Go to install directory"
echo -e "  ${BLUE}./start-filine.sh${NC}                 - Start FiLine Wall"
echo -e "  ${BLUE}./manage-filine.sh status${NC}         - Check status"
echo -e "  ${BLUE}./update-from-github.sh${NC}           - Update from GitHub"
echo ""
echo -e "${CYAN}Access the web interface at: ${GREEN}http://localhost:5000${NC}"
echo ""
