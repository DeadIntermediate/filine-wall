#!/bin/bash

# FiLine Wall - Enable Network Access
# This script opens the firewall port for network access to the dashboard

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FiLine Wall - Enable Network Access${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get the port from environment or use default
PORT=${PORT:-5000}

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo -e "${YELLOW}📡 Current System Information:${NC}"
echo -e "   IP Address: ${GREEN}${LOCAL_IP}${NC}"
echo -e "   Port: ${GREEN}${PORT}${NC}"
echo ""

# Check if UFW is installed and active
if command -v ufw &> /dev/null; then
    echo -e "${BLUE}🔥 Configuring UFW Firewall...${NC}"
    
    # Check if port is already open
    if sudo ufw status | grep -q "${PORT}/tcp"; then
        echo -e "${GREEN}✓${NC} Port ${PORT} is already open"
    else
        echo -e "   Opening port ${PORT}/tcp..."
        sudo ufw allow ${PORT}/tcp
        echo -e "${GREEN}✓${NC} Port ${PORT} opened successfully"
    fi
    
    echo -e "${GREEN}✓${NC} Firewall configured"
else
    echo -e "${YELLOW}⚠${NC}  UFW not installed - firewall configuration skipped"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Network Access Enabled!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📱 Access FiLine Wall Dashboard from any device on your network:${NC}"
echo ""
echo -e "   ${GREEN}http://${LOCAL_IP}:${PORT}${NC}"
echo ""
echo -e "${YELLOW}📝 Instructions:${NC}"
echo -e "   1. Make sure FiLine Wall is running"
echo -e "   2. Open a web browser on any device on your network"
echo -e "   3. Navigate to: ${GREEN}http://${LOCAL_IP}:${PORT}${NC}"
echo -e "   4. Login with your credentials"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • Bookmark the URL for easy access"
echo -e "   • Works on phones, tablets, and computers"
echo -e "   • All devices must be on the same network"
echo -e "   • For external access, set up port forwarding on your router"
echo ""
