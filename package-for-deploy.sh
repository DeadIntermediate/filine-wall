#!/bin/bash

# FiLine Wall - Package Script
# Creates a deployment-ready archive for transfer to other systems

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Print banner
clear
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════╗
║                                               ║
║         FiLine Wall - Package Script          ║
║       Create Deployment Archive               ║
║                                               ║
╚═══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Package details
PACKAGE_NAME="filine-wall-deployment"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE_NAME="${PACKAGE_NAME}_${TIMESTAMP}.tar.gz"
TEMP_DIR="./deploy-temp"

log_info "Creating deployment package..."
echo ""

# Create temporary directory
log_info "Preparing files..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/$PACKAGE_NAME"

# Copy essential files
log_info "Copying source files..."

# Source code directories
cp -r client "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || log_warning "client/ directory not found"
cp -r server "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || log_warning "server/ directory not found"
cp -r db "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || log_warning "db/ directory not found"
cp -r device-client "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || log_warning "device-client/ directory not found"

# Configuration files
log_info "Copying configuration files..."
cp package.json "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp tsconfig.json "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp vite.config.ts "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp tailwind.config.ts "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp postcss.config.js "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp drizzle.config.ts "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Docker files (if using Docker)
cp docker-compose.yml "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp Dockerfile "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp docker-entrypoint.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp docker-setup.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp nginx.conf "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Python configuration
cp pyproject.toml "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Setup and start scripts
log_info "Copying scripts..."
cp setup.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp setup-wizard.js "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp setup-database.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp start.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp start-tmux.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp filine-ctl.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp install.sh "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Make scripts executable
chmod +x "$TEMP_DIR/$PACKAGE_NAME/"*.sh 2>/dev/null || true

# Documentation
log_info "Copying documentation..."
cp README.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp GETTING_STARTED.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp QUICK_START.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp INSTALL.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp DEPLOYMENT.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp CONSOLE_LOGGING_GUIDE.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp TMUX_GUIDE.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true
cp VERSION.md "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Copy .env.example (but NOT .env with secrets!)
log_info "Copying environment template..."
cp .env.example "$TEMP_DIR/$PACKAGE_NAME/" 2>/dev/null || true

# Create deployment instructions
log_info "Creating deployment instructions..."
cat > "$TEMP_DIR/$PACKAGE_NAME/DEPLOY_README.txt" << 'DEPLOYEOF'
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                    FiLine Wall - Deployment Package               ║
║              Raspberry Pi Spam Call Blocking System               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

📦 QUICK DEPLOYMENT INSTRUCTIONS
================================

1. TRANSFER TO RASPBERRY PI
   --------------------------
   # On your computer:
   scp filine-wall-deployment_*.tar.gz pi@<raspberry-pi-ip>:~/
   
   # Or use USB drive, network share, etc.


2. EXTRACT ON RASPBERRY PI
   ------------------------
   ssh pi@<raspberry-pi-ip>
   cd ~
   tar -xzf filine-wall-deployment_*.tar.gz
   cd filine-wall-deployment


3. RUN AUTOMATED SETUP
   --------------------
   # This will install everything automatically:
   ./setup.sh
   
   # Or use the interactive wizard:
   ./setup-wizard.js


4. START THE SERVER
   -----------------
   # Option A: Standard start
   ./start.sh
   
   # Option B: Tmux (recommended for background)
   ./start-tmux.sh
   
   # Option C: Easy management
   ./filine-ctl.sh start


5. ACCESS THE INTERFACE
   ---------------------
   Open browser to: http://<raspberry-pi-ip>:5000


📚 DETAILED DOCUMENTATION
=========================
- Getting Started: GETTING_STARTED.md
- Installation: INSTALL.md
- Deployment: DEPLOYMENT.md
- Tmux Usage: TMUX_GUIDE.md
- Console Logs: CONSOLE_LOGGING_GUIDE.md


🔧 SYSTEM REQUIREMENTS
======================
- Raspberry Pi 3/4/5 or similar
- Raspberry Pi OS (Debian-based)
- 1GB+ RAM
- 2GB+ free disk space
- Internet connection (for setup)


🚀 ONE-LINE INSTALL
===================
After extracting, just run:

    ./setup.sh && ./start-tmux.sh


📋 WHAT'S INCLUDED
==================
✓ FiLine Wall server application
✓ Web-based admin interface
✓ Database setup scripts
✓ All detection services
✓ Tmux management scripts
✓ Complete documentation
✓ Example configuration


⚡ QUICK TROUBLESHOOTING
========================
Port 5000 in use:
  sudo lsof -i :5000
  
Database issues:
  ./setup-database.sh
  
Dependency problems:
  ./setup.sh
  
View logs:
  ./filine-ctl.sh attach


🆘 SUPPORT
==========
- Check README.md for detailed information
- Review documentation files
- Ensure all dependencies installed


🎉 ENJOY SPAM-FREE CALLING!
============================

DEPLOYEOF

# Create a quick install script
log_info "Creating quick install script..."
cat > "$TEMP_DIR/$PACKAGE_NAME/quick-install.sh" << 'QUICKEOF'
#!/bin/bash

# FiLine Wall - Quick Install Script
# One-command installation for new Raspberry Pi

echo "╔═══════════════════════════════════════════════╗"
echo "║                                               ║"
echo "║         FiLine Wall - Quick Install           ║"
echo "║                                               ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "This will:"
echo "  1. Run full system setup"
echo "  2. Configure database"
echo "  3. Install dependencies"
echo "  4. Start the server in tmux"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 1
fi

# Make scripts executable
chmod +x *.sh 2>/dev/null || true

# Run setup
echo ""
echo "Running setup..."
./setup.sh

# Start server
echo ""
echo "Starting server in tmux..."
./start-tmux.sh detached

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║         Installation Complete! 🎉             ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Access FiLine Wall at: http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "View logs: ./filine-ctl.sh attach"
echo "Stop server: ./filine-ctl.sh stop"
echo ""
QUICKEOF

chmod +x "$TEMP_DIR/$PACKAGE_NAME/quick-install.sh"

# Create file list
log_info "Creating file manifest..."
find "$TEMP_DIR/$PACKAGE_NAME" -type f | sed "s|$TEMP_DIR/$PACKAGE_NAME/||" | sort > "$TEMP_DIR/$PACKAGE_NAME/FILES.txt"

# Create checksum file
log_info "Generating checksums..."
cd "$TEMP_DIR/$PACKAGE_NAME"
find . -type f -exec sha256sum {} \; | sort > CHECKSUMS.txt
cd - > /dev/null

# Create the archive
log_info "Creating archive..."
cd "$TEMP_DIR"
tar -czf "../$ARCHIVE_NAME" "$PACKAGE_NAME"
cd - > /dev/null

# Calculate archive size
ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)

# Clean up temporary directory
log_info "Cleaning up..."
rm -rf "$TEMP_DIR"

# Success!
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Deployment package created successfully!"
echo ""
echo -e "${GREEN}Package Details:${NC}"
echo -e "  • Filename:  ${CYAN}$ARCHIVE_NAME${NC}"
echo -e "  • Size:      ${CYAN}$ARCHIVE_SIZE${NC}"
echo -e "  • Location:  ${CYAN}$(pwd)/$ARCHIVE_NAME${NC}"
echo ""
echo -e "${GREEN}Transfer to Raspberry Pi:${NC}"
echo -e "  ${CYAN}scp $ARCHIVE_NAME pi@<raspberry-pi-ip>:~/${NC}"
echo ""
echo -e "${GREEN}Extract on Raspberry Pi:${NC}"
echo -e "  ${CYAN}tar -xzf $ARCHIVE_NAME${NC}"
echo -e "  ${CYAN}cd $PACKAGE_NAME${NC}"
echo -e "  ${CYAN}./quick-install.sh${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show what's included
log_info "Package contents:"
echo ""
tar -tzf "$ARCHIVE_NAME" | head -20
TOTAL_FILES=$(tar -tzf "$ARCHIVE_NAME" | wc -l)
if [ "$TOTAL_FILES" -gt 20 ]; then
    echo "  ... and $(($TOTAL_FILES - 20)) more files"
fi
echo ""
echo -e "Total files: ${CYAN}$TOTAL_FILES${NC}"
echo ""

log_success "Ready to deploy! 🚀"
echo ""
