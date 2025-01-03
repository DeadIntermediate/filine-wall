#!/bin/bash

# Exit on any error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit 1
fi

echo "Updating system packages..."
apt-get update
apt-get upgrade -y

echo "Installing required packages..."
apt-get install -y python3 python3-pip python3-venv python3-dev libffi-dev build-essential

# Create service user
echo "Creating service user..."
useradd -r -s /bin/false calldetector || true

# Create necessary directories with secure permissions
echo "Setting up directories..."
mkdir -p /etc/call-detector
mkdir -p /var/log/call-detector
chown calldetector:calldetector /var/log/call-detector
chmod 700 /etc/call-detector  # Only owner can access

# Install Python dependencies
echo "Installing Python packages..."
python3 -m pip install requests cryptography

# Copy files
echo "Installing service files..."
cp call_detector.py encryption.py /usr/local/bin/
chmod +x /usr/local/bin/call_detector.py

# Create systemd service file
cat > /etc/systemd/system/call-detector.service << EOL
[Unit]
Description=Call Detector Service
After=network.target

[Service]
Type=simple
User=calldetector
ExecStart=/usr/bin/python3 /usr/local/bin/call_detector.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# Create default config file with secure permissions
cat > /etc/call-detector/config.ini << EOL
[server]
url = http://your-web-interface-url

[device]
id = your-device-id
auth_token = your-auth-token
EOL

# Set proper permissions
chown -R calldetector:calldetector /etc/call-detector
chmod 600 /etc/call-detector/config.ini  # Only owner can read/write config

# Enable and start service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable call-detector
systemctl start call-detector

echo "Installation complete!"
echo "Please edit /etc/call-detector/config.ini with your device credentials from the web interface."
echo "Then restart the service with: systemctl restart call-detector"