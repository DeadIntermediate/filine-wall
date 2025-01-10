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
    modemmanager libqmi-utils udev portaudio19-dev jq

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
python3 -m pip install requests cryptography pyserial tensorflow numpy pandas scikit-learn \
    pyaudio wave librosa meyda-python

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

# Create systemd service file with dependencies
cat > /etc/systemd/system/call-detector.service << EOL
[Unit]
Description=Call Detector Service with AI Spam Detection
After=network.target ModemManager.service
Wants=network.target ModemManager.service

[Service]
Type=simple
User=calldetector
Environment=TF_CPP_MIN_LOG_LEVEL=2
ExecStart=/usr/bin/python3 /usr/local/bin/call_detector.py
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

# Create default config file with secure permissions
cat > /etc/call-detector/config.ini << EOL
[server]
url = ${MASTER_SERVER_URL}
heartbeat_interval = 30

[device]
id = ${DEVICE_ID}
auth_token = ${AUTH_TOKEN}
encryption_key = ${ENCRYPTION_KEY}

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

# Enable and start services
echo "Enabling modem services..."
systemctl enable ModemManager
systemctl start ModemManager

# Enable and start call detector service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable call-detector
systemctl start call-detector

echo "Installation complete!"
echo "Please verify the device registration in the master interface."

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