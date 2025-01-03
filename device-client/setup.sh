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
apt-get install -y python3 python3-pip python3-venv python3-dev libffi-dev build-essential \
    usb-modeswitch usb-modeswitch-data ppp wvdial picocom minicom \
    modemmanager libqmi-utils udev

# Create service user
echo "Creating service user..."
useradd -r -s /bin/false calldetector || true

# Add user to dialout group for modem access
usermod -a -G dialout calldetector

# Create necessary directories with secure permissions
echo "Setting up directories..."
mkdir -p /etc/call-detector
mkdir -p /var/log/call-detector
chown calldetector:calldetector /var/log/call-detector
chmod 700 /etc/call-detector  # Only owner can access

# Install Python dependencies
echo "Installing Python packages..."
python3 -m pip install requests cryptography pyserial

# Setup udev rules for USB modems
echo "Setting up USB modem rules..."
cat > /etc/udev/rules.d/99-usb-serial.rules << EOL
# USRobotics 5637
SUBSYSTEM=="tty", ATTRS{idVendor}=="0baf", ATTRS{idProduct}=="0303", SYMLINK+="ttyUSB-modem"
# Generic USB modem rules
SUBSYSTEM=="tty", ATTRS{interface}=="USB 2.0 Fax Modem", SYMLINK+="ttyUSB-modem"
KERNEL=="ttyUSB[0-9]*", ATTRS{interface}=="Modem", SYMLINK+="ttyUSB-modem"
EOL

# Reload udev rules
udevadm control --reload-rules
udevadm trigger

# Copy files
echo "Installing service files..."
cp call_detector.py encryption.py /usr/local/bin/
chmod +x /usr/local/bin/call_detector.py

# Create wvdial configuration
echo "Configuring modem settings..."
cat > /etc/wvdial.conf << EOL
[Dialer Defaults]
Init1 = ATZ
Init2 = ATQ0 V1 E1 S0=0 &C1 &D2 +FCLASS=0
Modem Type = USB Modem
Modem = /dev/ttyUSB-modem
Baud = 57600
EOL

# Create systemd service file
cat > /etc/systemd/system/call-detector.service << EOL
[Unit]
Description=Call Detector Service
After=network.target ModemManager.service

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

[modem]
device = /dev/ttyUSB-modem
baud_rate = 57600
init_string = ATZ
caller_id_format = CLIP
EOL

# Set proper permissions
chown -R calldetector:calldetector /etc/call-detector
chmod 600 /etc/call-detector/config.ini  # Only owner can read/write config

# Enable modem-related services
echo "Enabling modem services..."
systemctl enable ModemManager
systemctl start ModemManager

# Enable and start call detector service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable call-detector
systemctl start call-detector

echo "Installation complete!"
echo "Please edit /etc/call-detector/config.ini with your device credentials from the web interface."
echo "Then restart the service with: systemctl restart call-detector"

# Test modem connection
echo "Testing modem connection..."
if [ -e "/dev/ttyUSB-modem" ]; then
    echo "Modem device found at /dev/ttyUSB-modem"
    echo "Testing modem communication..."
    echo "AT" > /dev/ttyUSB-modem
    sleep 1
    response=$(cat /dev/ttyUSB-modem)
    if [[ $response == *"OK"* ]]; then
        echo "Modem is responding correctly"
    else
        echo "Warning: Modem not responding. Please check connections"
    fi
else
    echo "Warning: Modem device not found. Please check if modem is connected"
fi