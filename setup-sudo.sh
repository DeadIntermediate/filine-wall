#!/bin/bash

#############################################
# FiLine Wall - Passwordless Sudo Setup
# Configures sudo permissions for driver management
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   FiLine Wall - Sudo Configuration    ║"
echo "╔════════════════════════════════════════╗"
echo -e "${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ This script must be run as root${NC}"
   echo -e "${YELLOW}Please run: sudo ./setup-sudo.sh${NC}"
   exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
if [ "$ACTUAL_USER" = "root" ]; then
    echo -e "${YELLOW}Warning: Running as root user. Enter the username that will run FiLine Wall:${NC}"
    read -r ACTUAL_USER
fi

echo -e "${BLUE}Configuring passwordless sudo for user: ${GREEN}$ACTUAL_USER${NC}"

# Create sudoers file for FiLine Wall
SUDOERS_FILE="/etc/sudoers.d/filine-wall"

echo -e "${YELLOW}Creating sudoers configuration...${NC}"

cat > "$SUDOERS_FILE" << EOF
# FiLine Wall - Passwordless sudo configuration
# Created: $(date)
# This file grants specific sudo permissions needed for hardware driver management

# Allow modprobe for loading kernel modules
$ACTUAL_USER ALL=(ALL) NOPASSWD: /sbin/modprobe
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/sbin/modprobe

# Allow apt-get for installing driver packages
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y linux-modules-extra-raspi
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y usb-modeswitch
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y usbutils

# Allow tee for writing to /etc/modules (for persistent driver loading)
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/modules

# Allow lsusb for device detection
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/lsusb

# Allow listing serial devices
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/ls /dev/ttyUSB*
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/ls /dev/ttyACM*

# Allow dmesg for debugging hardware issues
$ACTUAL_USER ALL=(ALL) NOPASSWD: /usr/bin/dmesg

# Allow systemctl for modem service management (if needed later)
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart filine-modem.service
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop filine-modem.service
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/systemctl start filine-modem.service
$ACTUAL_USER ALL=(ALL) NOPASSWD: /bin/systemctl status filine-modem.service
EOF

# Set correct permissions (must be 0440)
chmod 0440 "$SUDOERS_FILE"

# Validate the sudoers file
echo -e "${YELLOW}Validating sudoers configuration...${NC}"
if visudo -c -f "$SUDOERS_FILE"; then
    echo -e "${GREEN}✓ Sudoers file is valid${NC}"
else
    echo -e "${RED}✗ Sudoers file validation failed!${NC}"
    rm -f "$SUDOERS_FILE"
    exit 1
fi

# Test sudo access
echo -e "${YELLOW}Testing sudo access...${NC}"
if sudo -u "$ACTUAL_USER" sudo -n modprobe --version &> /dev/null; then
    echo -e "${GREEN}✓ Passwordless sudo is working correctly${NC}"
else
    echo -e "${RED}✗ Passwordless sudo test failed${NC}"
    echo -e "${YELLOW}You may need to log out and log back in for changes to take effect${NC}"
fi

# Install required packages for USB management
echo -e "${YELLOW}Installing USB management tools...${NC}"
apt-get update -qq
apt-get install -y usbutils usb-modeswitch

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Setup Complete Successfully!      ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo ""
echo -e "${BLUE}Configured permissions for:${NC}"
echo -e "  • Loading kernel modules (modprobe)"
echo -e "  • Installing driver packages (apt-get)"
echo -e "  • Configuring persistent drivers (/etc/modules)"
echo -e "  • USB device detection (lsusb)"
echo -e "  • Serial device access"
echo ""
echo -e "${YELLOW}Note: You may need to log out and log back in for changes to take full effect${NC}"
echo ""
echo -e "${BLUE}To verify, run:${NC}"
echo -e "  sudo -n modprobe --version"
echo ""
