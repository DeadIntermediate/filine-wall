#!/bin/bash
# FiLine Wall Call Detector - Simple Service Installer
# This installs the call detector as a systemd service

set -e

echo "╔════════════════════════════════════════╗"
echo "║   FiLine Wall - Call Detector Setup   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root: sudo ./install-service.sh"
  exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
INSTALL_DIR="/home/$ACTUAL_USER/filine-wall/device-client"

echo "📦 Installing Python dependencies..."
apt-get update -qq
apt-get install -y python3-pip python3-serial python3-requests python3-cryptography > /dev/null 2>&1

# Install Python packages
pip3 install --quiet pyserial requests cryptography configparser

echo "✓ Dependencies installed"
echo ""

# Create config directory
echo "📁 Creating configuration directory..."
mkdir -p /etc/call-detector
chmod 755 /etc/call-detector

# Copy or create config file
if [ ! -f /etc/call-detector/config.ini ]; then
    echo "📝 Creating default configuration..."
    cat > /etc/call-detector/config.ini << 'EOF'
[server]
url = http://localhost:5000

[device]
id = raspberry-pi-filine
auth_token = local-dev-token-no-auth-required

[modem]
device = /dev/ttyACM0
baud_rate = 57600
init_string = ATZ
caller_id_command = AT+VCID=1

[logging]
level = INFO
file = /var/log/call-detector.log
EOF
    chmod 644 /etc/call-detector/config.ini
    echo "✓ Config created at /etc/call-detector/config.ini"
else
    echo "✓ Using existing config at /etc/call-detector/config.ini"
fi

# Create log directory
echo "📋 Setting up logging..."
mkdir -p /var/log/call-detector
touch /var/log/call-detector.log
chmod 755 /var/log/call-detector
chmod 644 /var/log/call-detector.log

# Add user to dialout group
echo "🔐 Configuring permissions..."
usermod -a -G dialout $ACTUAL_USER
echo "✓ User '$ACTUAL_USER' added to dialout group"

# Create systemd service
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/call-detector.service << EOF
[Unit]
Description=FiLine Wall Call Detector Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$ACTUAL_USER
Group=dialout
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/call_detector.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/call-detector

# Allow access to serial devices
SupplementaryGroups=dialout

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo ""
echo "╔════════════════════════════════════════╗"
echo "║        Installation Complete! ✅       ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Service Commands:"
echo "  Start:   sudo systemctl start call-detector"
echo "  Stop:    sudo systemctl stop call-detector"
echo "  Status:  sudo systemctl status call-detector"
echo "  Logs:    sudo journalctl -u call-detector -f"
echo ""
echo "Auto-start on boot:"
echo "  Enable:  sudo systemctl enable call-detector"
echo "  Disable: sudo systemctl disable call-detector"
echo ""
echo "Configuration file: /etc/call-detector/config.ini"
echo "Log file: /var/log/call-detector.log"
echo ""
echo "Note: You may need to log out and back in for group changes to take effect"
echo ""
