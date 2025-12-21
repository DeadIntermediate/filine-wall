#!/bin/bash
# Run this script on the Raspberry Pi to diagnose modem issues

echo "========================================="
echo "FiLine Modem Diagnostic Tool"
echo "========================================="
echo ""

echo "Step 1: Checking for modem devices..."
echo "-------------------------------------"
ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ No modem device found!"
    echo "   Try: sudo lsusb"
    echo "   Make sure USB modem is plugged in"
else
    echo "✓ Modem device found"
fi
echo ""

echo "Step 2: Checking user permissions..."
echo "-------------------------------------"
groups | grep -q dialout
if [ $? -eq 0 ]; then
    echo "✓ User is in dialout group"
else
    echo "❌ User NOT in dialout group"
    echo "   Run: sudo usermod -a -G dialout $USER"
    echo "   Then logout and login again"
fi
echo ""

echo "Step 3: Checking call-detector service..."
echo "-------------------------------------"
sudo systemctl is-active --quiet call-detector.service
if [ $? -eq 0 ]; then
    echo "✓ call-detector service is running"
    echo ""
    echo "Recent logs:"
    sudo journalctl -u call-detector.service -n 10 --no-pager
else
    echo "❌ call-detector service is NOT running"
    echo "   Start with: sudo systemctl start call-detector.service"
    echo "   Check logs: sudo journalctl -u call-detector.service -n 50"
fi
echo ""

echo "Step 4: Testing modem communication..."
echo "-------------------------------------"
cd ~/filine-wall-1/device-client

# Quick Python test
sudo python3 << 'EOF'
import serial
import time

try:
    print("Opening modem on /dev/ttyACM0...")
    modem = serial.Serial('/dev/ttyACM0', 57600, timeout=2)
    print("✓ Modem opened successfully")
    
    # Reset modem
    print("\nSending ATZ (reset)...")
    modem.write(b'ATZ\r')
    time.sleep(1)
    response = modem.read(modem.in_waiting).decode(errors='ignore').strip()
    print(f"Response: {response if response else '(no response)'}")
    
    # Enable caller ID
    print("\nSending AT+VCID=1 (enable caller ID)...")
    modem.write(b'AT+VCID=1\r')
    time.sleep(1)
    response = modem.read(modem.in_waiting).decode(errors='ignore').strip()
    print(f"Response: {response if response else '(no response)'}")
    
    if 'OK' in response or 'ERROR' in response:
        print("✓ Modem is responding to AT commands")
    else:
        print("⚠ Modem may not be responding correctly")
    
    modem.close()
    
except FileNotFoundError:
    print("❌ Modem device not found at /dev/ttyACM0")
    print("   Check if modem is plugged in")
    print("   Try: ls -l /dev/ttyUSB* /dev/ttyACM*")
except serial.SerialException as e:
    print(f"❌ Cannot open modem: {e}")
    print("   You may need to be in the dialout group")
    print("   Or run with: sudo python3 diagnose-modem-pi.sh")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
EOF

echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo ""
echo "If modem is working, test for incoming calls:"
echo "  sudo python3 test-modem-output.py"
echo "  (Then make a test call to your phone line)"
echo ""
echo "To check if phone line has caller ID enabled:"
echo "  - Contact your phone provider"
echo "  - Caller ID must be enabled on the line"
echo "  - Some VoIP services may not support it"
echo ""
echo "To restart the call detector:"
echo "  sudo systemctl restart call-detector.service"
echo ""
echo "To view live logs:"
echo "  sudo journalctl -u call-detector.service -f"
echo ""
