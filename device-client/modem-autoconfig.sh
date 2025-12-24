#!/bin/bash
# Modem Auto-Detection and Configuration Script
# This script runs when a USB modem is plugged in

MODEM_DEVICE=$1
LOG_FILE="/var/log/modem-autoconfig.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Modem detected: $MODEM_DEVICE"
log "=========================================="

# Wait for device to be ready
sleep 2

# Check if device exists
if [ ! -e "$MODEM_DEVICE" ]; then
    log "ERROR: Device $MODEM_DEVICE not found"
    exit 1
fi

log "Device found, configuring modem..."

# Try to open and configure the modem
python3 << EOF
import serial
import time

device = '$MODEM_DEVICE'
log_file = '$LOG_FILE'

try:
    with open(log_file, 'a') as log:
        log.write(f"Opening modem on {device}...\n")
        modem = serial.Serial(device, 57600, timeout=2)
        
        # Reset modem
        log.write("Sending ATZ (reset)...\n")
        modem.write(b'ATZ\r')
        time.sleep(1)
        response = modem.read(modem.in_waiting).decode(errors='ignore')
        log.write(f"ATZ Response: {response.strip()}\n")
        
        # Enable caller ID with multiple commands
        commands = [
            ('AT+VCID=1', 'Standard Caller ID'),
            ('AT#CID=1', 'Alternative Caller ID'),
            ('AT+CLIP=1', 'Calling Line ID'),
        ]
        
        for cmd, desc in commands:
            log.write(f"Sending {cmd} ({desc})...\n")
            modem.write(f'{cmd}\r'.encode())
            time.sleep(0.5)
            response = modem.read(modem.in_waiting).decode(errors='ignore')
            log.write(f"Response: {response.strip()}\n")
        
        modem.close()
        log.write("✓ Modem configured successfully\n")
        
except Exception as e:
    with open(log_file, 'a') as log:
        log.write(f"ERROR: {str(e)}\n")
    exit(1)
EOF

if [ $? -eq 0 ]; then
    log "✓ Modem auto-configuration completed successfully"
    
    # Update config.ini with the detected device
    CONFIG_FILE="/etc/call-detector/config.ini"
    if [ -f "$CONFIG_FILE" ]; then
        log "Updating config.ini with device: $MODEM_DEVICE"
        sed -i "s|^device = .*|device = $MODEM_DEVICE|" "$CONFIG_FILE"
    fi
    
    # Restart call-detector service
    log "Restarting call-detector service..."
    systemctl restart call-detector.service
    
    if systemctl is-active --quiet call-detector.service; then
        log "✓ call-detector service restarted successfully"
    else
        log "ERROR: Failed to restart call-detector service"
    fi
else
    log "ERROR: Modem configuration failed"
    exit 1
fi

log "Modem auto-configuration complete"
