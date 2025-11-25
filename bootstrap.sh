#!/bin/bash

# FiLine Wall - Bootstrap Installer
# This is a minimal bootstrap that downloads and runs the full installer
# Use this if the repository is private or for local deployment

set -e

REPO_URL="https://github.com/DeadIntermediate/filine-wall.git"
INSTALL_DIR="$HOME/filine-wall"

echo "🛡️  FiLine Wall - Bootstrap Installer"
echo "========================================"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    sudo apt update -qq
    sudo apt install -y git
fi

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo "Cloning FiLine Wall repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Make installer executable
chmod +x install-complete.sh

# Run the full installer
echo ""
echo "Starting full installation..."
echo ""
./install-complete.sh
