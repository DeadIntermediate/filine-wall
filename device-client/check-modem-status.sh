#!/bin/bash
# Quick script to check modem status and manually trigger detection

echo "=========================================="
echo "Modem Status Check"
echo "=========================================="
echo ""

echo "1. Checking for USB devices..."
echo "------------------------------"
lsusb | grep -i "modem\|serial\|robotics" || echo "No modem-like devices found in lsusb"
echo ""

echo "2. Checking for serial devices..."
echo "------------------------------"
if ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null; then
    echo "✓ Serial devices found"
    ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
else
    echo "❌ No serial devices found"
    echo "   The modem may not be plugged in"
fi
echo ""

echo "3. Checking call-detector service..."
echo "------------------------------"
if systemctl is-active --quiet call-detector.service; then
    echo "✓ Service is running"
    echo ""
    echo "Recent logs:"
    journalctl -u call-detector.service -n 5 --no-pager
else
    echo "❌ Service is not running"
    echo "   Start with: sudo systemctl start call-detector.service"
fi
echo ""

echo "4. Checking modem config..."
echo "------------------------------"
if [ -f /etc/call-detector/config.ini ]; then
    echo "Current config:"
    grep -E "device|baud" /etc/call-detector/config.ini
else
    echo "Config file not found"
fi
echo ""

echo "5. Checking auto-detection logs..."
echo "------------------------------"
if [ -f /var/log/modem-autoconfig.log ]; then
    echo "Last 10 lines:"
    tail -10 /var/log/modem-autoconfig.log
else
    echo "No auto-config logs yet"
fi
echo ""

echo "=========================================="
echo "Manual Actions"
echo "=========================================="
echo ""
echo "To manually trigger modem detection:"
echo "  sudo /usr/local/bin/modem-autoconfig.sh /dev/ttyACM0"
echo ""
echo "To restart the service:"
echo "  sudo systemctl restart call-detector.service"
echo ""
echo "To test modem directly:"
echo "  cd ~/filine-wall-1/device-client"
echo "  sudo python3 test-modem-output.py"
echo ""
