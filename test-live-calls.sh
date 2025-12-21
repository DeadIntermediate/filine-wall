#!/bin/bash
# Live call monitoring test - Run this and make a test call

echo "========================================="
echo "FiLine Live Call Monitor Test"
echo "========================================="
echo ""
echo "This will monitor the modem for incoming calls."
echo "Keep this running and make a test call."
echo ""
echo "Press Ctrl+C to stop"
echo ""
echo "========================================="
echo ""

cd ~/filine-wall-1/device-client

# Check if service is running
echo "Checking call-detector service status..."
if sudo systemctl is-active --quiet call-detector.service; then
    echo "⚠ call-detector service IS RUNNING"
    echo "   Stopping it temporarily for this test..."
    sudo systemctl stop call-detector.service
    echo "   (We'll restart it after)"
    RESTART_SERVICE=true
else
    echo "✓ Service is not running, we can proceed"
    RESTART_SERVICE=false
fi
echo ""

# Run the test
echo "Starting live modem monitor..."
echo "Waiting for incoming calls on /dev/ttyACM0..."
echo ""

sudo python3 << 'EOF'
import serial
import time
import sys
from datetime import datetime

def log(msg):
    timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    print(f"[{timestamp}] {msg}")
    sys.stdout.flush()

try:
    log("Opening modem on /dev/ttyACM0 at 57600 baud...")
    modem = serial.Serial('/dev/ttyACM0', 57600, timeout=0.1)
    log("✓ Modem connected")
    
    # Initialize modem
    log("Initializing modem...")
    modem.write(b'ATZ\r')
    time.sleep(1)
    response = modem.read(modem.in_waiting).decode(errors='ignore')
    log(f"ATZ response: {response.strip() if response.strip() else '(empty)'}")
    
    # Enable caller ID with multiple commands
    commands = [
        ('AT+VCID=1', 'Standard Caller ID'),
        ('AT#CID=1', 'Alternative Caller ID'),
        ('AT+CLIP=1', 'Calling Line ID'),
    ]
    
    for cmd, desc in commands:
        log(f"Sending {cmd} ({desc})...")
        modem.write(f'{cmd}\r'.encode())
        time.sleep(0.5)
        if modem.in_waiting:
            response = modem.read(modem.in_waiting).decode(errors='ignore')
            log(f"  Response: {response.strip()}")
    
    log("")
    log("="*60)
    log("🔊 MODEM IS NOW LISTENING FOR CALLS")
    log("="*60)
    log("📞 MAKE A TEST CALL NOW TO YOUR PHONE LINE")
    log("="*60)
    log("")
    
    call_detected = False
    ring_count = 0
    
    # Monitor for calls
    while True:
        if modem.in_waiting:
            data = modem.read(modem.in_waiting).decode(errors='ignore')
            
            for line in data.split('\r\n'):
                line = line.strip()
                if not line:
                    continue
                    
                # Log all modem output
                log(f"MODEM: {line}")
                
                # Check for call-related keywords
                upper_line = line.upper()
                
                if 'RING' in upper_line:
                    ring_count += 1
                    log(f"🔔 RING DETECTED! (Ring #{ring_count})")
                    call_detected = True
                    
                if any(kw in upper_line for kw in ['NMBR', 'CALLER', 'CLIP', 'NAME']):
                    log(f"📋 CALLER ID DATA: {line}")
                    call_detected = True
                    
                if 'DATE' in upper_line or 'TIME' in upper_line:
                    log(f"📅 TIMESTAMP DATA: {line}")
        
        time.sleep(0.1)
        
except KeyboardInterrupt:
    log("")
    log("="*60)
    log("Test stopped by user")
    log("="*60)
    if call_detected:
        log(f"✓ SUCCESS: Detected {ring_count} rings")
        log("  The modem IS working!")
    else:
        log("❌ NO CALLS DETECTED")
        log("")
        log("Possible issues:")
        log("  1. Phone line not connected to modem")
        log("  2. No call was made during test")
        log("  3. Caller ID not enabled on phone service")
        log("  4. Wrong port or baud rate")
    log("="*60)
    
except Exception as e:
    log(f"❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

finally:
    if 'modem' in locals():
        modem.close()
        log("Modem closed")
EOF

echo ""
echo "========================================="

# Restart service if it was running
if [ "$RESTART_SERVICE" = true ]; then
    echo "Restarting call-detector service..."
    sudo systemctl start call-detector.service
    echo "✓ Service restarted"
fi

echo ""
echo "Test complete!"
echo ""
echo "If you saw RING or caller ID data, the modem works!"
echo "If not, check:"
echo "  1. Is the phone line plugged into the modem?"
echo "  2. Did you actually make a test call?"
echo "  3. Is caller ID enabled on your phone service?"
echo ""
