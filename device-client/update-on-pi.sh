#!/bin/bash
# Run this script on the Raspberry Pi to update the call detector

echo "=========================================="
echo "FiLine Call Detector Update Script"
echo "=========================================="
echo ""

# Navigate to the device-client directory
cd ~/filine-wall-1/device-client || exit 1

# Backup current file
echo "Creating backup..."
cp call_detector.py call_detector.py.backup.$(date +%Y%m%d_%H%M%S)

# Update the _parse_caller_id function
echo "Updating call_detector.py..."

# Create a temporary Python script to update the file
cat > /tmp/update_call_detector.py << 'PYTHON_SCRIPT'
import re

with open('call_detector.py', 'r') as f:
    content = f.read()

# Find and replace the _parse_caller_id function
old_function = r'def _parse_caller_id\(self, line\):.*?(?=\n    def |\n\nif __name__|$)'

new_function = '''def _parse_caller_id(self, line):
        """Parse caller ID information from modem output"""
        try:
            # Log all modem output for debugging
            logging.info(f"[MODEM RAW] {line}")
            
            # Support multiple caller ID formats
            # Format 1: NMBR = <number>
            if "NMBR" in line.upper():
                if "=" in line:
                    phone_number = line.split("=")[1].strip()
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 2: CALLER NUMBER: <number>
            if "CALLER" in line.upper() and "NUMBER" in line.upper():
                parts = line.split(":")
                if len(parts) > 1:
                    phone_number = parts[1].strip()
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 3: +CLIP: "<number>",<type>
            if "+CLIP" in line.upper():
                import re
                match = re.search(r'"([^"]+)"', line)
                if match:
                    phone_number = match.group(1)
                    logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                    return phone_number
            
            # Format 4: Just a number pattern (10 digits)
            if line.strip().isdigit() and len(line.strip()) >= 10:
                phone_number = line.strip()
                logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                return phone_number
            
            return None
        except Exception as e:
            logging.error(f"Error parsing caller ID: {str(e)}")
            return None'''

content = re.sub(old_function, new_function, content, flags=re.DOTALL)

with open('call_detector.py', 'w') as f:
    f.write(content)

print("Updated _parse_caller_id function")
PYTHON_SCRIPT

python3 /tmp/update_call_detector.py

# Also update the monitor_calls function for better logging
cat > /tmp/update_monitor.py << 'PYTHON_SCRIPT'
import re

with open('call_detector.py', 'r') as f:
    content = f.read()

# Update logging in monitor_calls
content = re.sub(
    r'logging\.debug\(f"Modem output: \{line\}"\)',
    '# Modem output now logged in _parse_caller_id',
    content
)

content = re.sub(
    r'logging\.info\(f"Incoming call detected from: \{phone_number\}"\)',
    'logging.info(f"🔔 INCOMING CALL DETECTED from: {phone_number}")',
    content
)

content = re.sub(
    r'logging\.info\(f"Blocked call from \{phone_number\}"\)',
    'logging.info(f"🚫 BLOCKED call from {phone_number}")',
    content
)

with open('call_detector.py', 'w') as f:
    f.write(content)

print("Updated monitor_calls logging")
PYTHON_SCRIPT

python3 /tmp/update_monitor.py

echo "✓ call_detector.py updated!"
echo ""

# Create test script if it doesn't exist
if [ ! -f test-modem-output.py ]; then
    echo "Creating test-modem-output.py..."
    cat > test-modem-output.py << 'PYTHON_TEST'
#!/usr/bin/env python3
"""
Test script to monitor raw modem output and diagnose caller ID issues.
Run this script and make a test call to see what the modem actually sends.
"""

import serial
import time
import sys
from configparser import ConfigParser

def test_modem():
    # Load config
    config = ConfigParser()
    config.read('/etc/call-detector/config.ini')
    
    device = config["modem"]["device"]
    baud_rate = int(config["modem"].get("baud_rate", "57600"))
    
    print(f"Opening modem on {device} at {baud_rate} baud...")
    print("=" * 60)
    
    try:
        modem = serial.Serial(
            port=device,
            baudrate=baud_rate,
            timeout=1
        )
        
        print("✓ Modem connected successfully")
        print("\nSending initialization commands...")
        
        # Reset modem
        modem.write(b"ATZ\r")
        time.sleep(1)
        response = modem.read(modem.in_waiting).decode(errors='ignore')
        print(f"ATZ Response: {response.strip()}")
        
        # Try different caller ID commands
        commands = [
            "AT+VCID=1",   # Standard voice caller ID
            "AT#CID=1",    # Alternative format
            "AT+CLIP=1",   # Calling Line Identification
        ]
        
        for cmd in commands:
            print(f"\nSending: {cmd}")
            modem.write(f"{cmd}\r".encode())
            time.sleep(0.5)
            if modem.in_waiting:
                response = modem.read(modem.in_waiting).decode(errors='ignore')
                print(f"Response: {response.strip()}")
        
        print("\n" + "=" * 60)
        print("MONITORING FOR CALLS - Make a test call now!")
        print("Press Ctrl+C to stop")
        print("=" * 60 + "\n")
        
        # Monitor for incoming data
        while True:
            if modem.in_waiting:
                data = modem.readline().decode(errors='ignore').strip()
                if data:
                    print(f"[{time.strftime('%H:%M:%S')}] RAW: {repr(data)}")
                    print(f"[{time.strftime('%H:%M:%S')}] TXT: {data}")
                    
                    # Check for common caller ID patterns
                    if any(keyword in data.upper() for keyword in ['NMBR', 'CALLER', 'CLIP', 'RING']):
                        print("    ⚡ POSSIBLE CALLER ID DATA DETECTED!")
                    print()
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if 'modem' in locals():
            modem.close()
            print("Modem closed")

if __name__ == "__main__":
    test_modem()
PYTHON_TEST

    chmod +x test-modem-output.py
    echo "✓ test-modem-output.py created!"
fi

echo ""
echo "=========================================="
echo "Update complete! Next steps:"
echo "=========================================="
echo ""
echo "Option 1: Run diagnostic test"
echo "  sudo python3 test-modem-output.py"
echo "  (Then make a test call)"
echo ""
echo "Option 2: Restart call detector service"
echo "  sudo systemctl restart call-detector"
echo "  sudo tail -f /var/log/call-detector.log"
echo "  (Then make a test call)"
echo ""
echo "Option 3: Run call detector manually"
echo "  sudo systemctl stop call-detector"
echo "  sudo python3 call_detector.py"
echo "  (Then make a test call and watch output)"
echo ""
