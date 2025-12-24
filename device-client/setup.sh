#!/bin/bash

# Exit on any error
set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root"
  exit 1
fi

echo "Installing Node.js and required packages..."
apt-get update
apt-get install -y nodejs npm udev \
    usb-modeswitch usb-modeswitch-data ppp \
    modemmanager libqmi-utils udev portaudio19-dev jq

# Install Node.js dependencies
npm install -g typescript ts-node @tensorflow/tfjs-node serialport

# Create service user
useradd -r -s /bin/false calldetector || true
usermod -a -G dialout calldetector

# Create directories
mkdir -p /etc/call-detector /var/log/call-detector
chown calldetector:calldetector /var/log/call-detector
chmod 700 /etc/call-detector

# Supported USB modem udev rules
cat > /etc/udev/rules.d/99-supported-modems.rules << EOL
# USRobotics 5637 USB Fax Modem
SUBSYSTEM=="tty", ATTRS{idVendor}=="0baf", ATTRS{idProduct}=="0303", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
# Prolific chipset (used by some USRobotics and StarTech modems)
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", ATTRS{idProduct}=="2303", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
# StarTech 56k USB V.92 Modem (USB56KEMH2)
SUBSYSTEM=="tty", ATTRS{idVendor}=="06cd", ATTRS{idProduct}=="0121", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
# StarTech 56k USB V.92 Modem (alternative chipset)
SUBSYSTEM=="tty", ATTRS{idVendor}=="0557", ATTRS{idProduct}=="2008", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
EOL

# Reload udev
udevadm control --reload-rules
udevadm trigger

# Modem initialization script
cat > /etc/call-detector/init-modem.sh << EOL
#!/bin/bash
stty -F /dev/ttyUSB-modem 115200
echo "ATZ" > /dev/ttyUSB-modem
sleep 1
echo "AT&F" > /dev/ttyUSB-modem
sleep 1
echo "AT+VCID=1" > /dev/ttyUSB-modem
sleep 1
echo "AT&K3" > /dev/ttyUSB-modem
sleep 1
echo "AT&W" > /dev/ttyUSB-modem
EOL
chmod +x /etc/call-detector/init-modem.sh

# Systemd service
cat > /etc/systemd/system/call-detector.service << EOL
[Unit]
Description=Call Detector Service with V.92 USB Modem
After=network.target ModemManager.service
Wants=ModemManager.service

[Service]
Type=simple
User=calldetector
Environment=NODE_ENV=production
ExecStartPre=/etc/call-detector/init-modem.sh
ExecStart=/usr/bin/node /usr/local/bin/call_detector.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/call-detector/service.log
StandardError=append:/var/log/call-detector/error.log

# Security hardening
PrivateTmp=true
ProtectSystem=full
NoNewPrivileges=true
ProtectHome=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true

[Install]
WantedBy=multi-user.target
EOL

# Enable services
systemctl daemon-reload
systemctl enable ModemManager
systemctl start ModemManager
systemctl enable call-detector
systemctl start call-detector

# Test modem connection
echo "Testing V.92 USB modem connection..."
if [ -e "/dev/ttyUSB-modem" ]; then
    echo "Modem device found at /dev/ttyUSB-modem"
    echo "Testing communication..."
    echo "ATZ" > /dev/ttyUSB-modem
    sleep 1
    response=$(cat /dev/ttyUSB-modem)
    if [[ $response == *"OK"* ]]; then
        echo "Modem responding correctly"
    else
        echo "Warning: Modem not responding. Please check connections"
    fi
else
    echo "Warning: Modem not found. Please check if supported modem is connected"
    echo "Supported models: USRobotics 5637, StarTech 56k USB V.92"
fi

echo "Setup complete! Your V.92 USB modem is ready for call screening."
echo "Monitor logs with: journalctl -u call-detector -f"

# Create default config file with secure permissions
cat > /etc/call-detector/config.ini << EOL
[server]
url = http://your-master-server
heartbeat_interval = 30

[device]
id = 
auth_token = 
encryption_key = 

[modem]
device = /dev/ttyUSB-modem
baud_rate = 57600
init_string = ATZ
caller_id_format = CLIP

[spam_detection]
enabled = true
ai_model_path = /etc/call-detector/models/spam_model.h5
confidence_threshold = 0.85
feature_extraction = meyda

[voice_analysis]
enabled = true
sample_rate = 44100
frame_size = 2048
features = energy,zcr,spectralCentroid,mfcc
model_path = /etc/call-detector/models/voice_model.h5

[logging]
level = INFO
max_size = 10485760
backup_count = 5
EOL

# Set proper permissions
chown -R calldetector:calldetector /etc/call-detector
chmod 600 /etc/call-detector/config.ini  # Only owner can read/write config

# Create log rotation configuration
cat > /etc/logrotate.d/call-detector << EOL
/var/log/call-detector/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 640 calldetector calldetector
}
EOL

# Register device with master server
echo "Registering device with master server..."
MASTER_SERVER_URL="http://your-master-server"
REGISTRATION_RESPONSE=$(curl -s -X POST "${MASTER_SERVER_URL}/api/devices/register" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\": \"$(hostname)\", \"deviceType\": \"call_detector\", \"publicKey\": \"$(openssl rand -base64 32)\"}")

# Extract credentials from response
DEVICE_ID=$(echo $REGISTRATION_RESPONSE | jq -r '.deviceId')
AUTH_TOKEN=$(echo $REGISTRATION_RESPONSE | jq -r '.authToken')
ENCRYPTION_KEY=$(echo $REGISTRATION_RESPONSE | jq -r '.encryptionKey')

if [ -z "$DEVICE_ID" ] || [ -z "$AUTH_TOKEN" ] || [ -z "$ENCRYPTION_KEY" ]; then
    echo "Error: Failed to register device with master server"
    exit 1
fi

# Update config file with registration details
sed -i "s/^id =.*/id = ${DEVICE_ID}/" /etc/call-detector/config.ini
sed -i "s/^auth_token =.*/auth_token = ${AUTH_TOKEN}/" /etc/call-detector/config.ini
sed -i "s/^encryption_key =.*/encryption_key = ${ENCRYPTION_KEY}/" /etc/call-detector/config.ini


# Download AI models
echo "Setting up AI models..."
mkdir -p /etc/call-detector/models
if [ ! -f "/etc/call-detector/models/spam_model.h5" ]; then
    echo "Warning: Spam detection model not found. Please download from the master server."
fi
if [ ! -f "/etc/call-detector/models/voice_model.h5" ]; then
    echo "Warning: Voice analysis model not found. Please download from the master server."
fi

# Print status summary
echo "Installation Status:"
echo "==================="
systemctl status call-detector --no-pager
echo "==================="
echo "Check logs with: journalctl -u call-detector -f"
echo "Configuration file: /etc/call-detector/config.ini"
echo "Log files: /var/log/call-detector/"

# Verify device registration
echo "Verifying device registration..."
VERIFICATION_RESPONSE=$(curl -s -X GET "${MASTER_SERVER_URL}/api/devices/${DEVICE_ID}/status" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

DEVICE_STATUS=$(echo $VERIFICATION_RESPONSE | jq -r '.status')
if [ "$DEVICE_STATUS" == "active" ]; then
    echo "Device successfully registered and active"
else
    echo "Warning: Device registration status: ${DEVICE_STATUS}"
    echo "Please check the master interface for more details"
fi