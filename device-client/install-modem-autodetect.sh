#!/bin/bash
# Installation script for modem auto-detection
# Run this on the Raspberry Pi to set up automatic modem detection

echo "=========================================="
echo "FiLine Modem Auto-Detection Installer"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Step 1: Installing modem auto-config script..."
cp "$SCRIPT_DIR/modem-autoconfig.sh" /usr/local/bin/modem-autoconfig.sh
chmod +x /usr/local/bin/modem-autoconfig.sh
echo "✓ Script installed to /usr/local/bin/modem-autoconfig.sh"
echo ""

echo "Step 2: Installing udev rule..."
cat > /etc/udev/rules.d/99-modem-autodetect.rules << 'EOF'
# Udev rule for automatic modem detection
SUBSYSTEM=="tty", KERNEL=="ttyACM*", ACTION=="add", RUN+="/usr/local/bin/modem-autoconfig.sh /dev/%k"
SUBSYSTEM=="tty", KERNEL=="ttyUSB*", ACTION=="add", RUN+="/usr/local/bin/modem-autoconfig.sh /dev/%k"
SUBSYSTEM=="tty", KERNEL=="ttyACM*", MODE="0666", GROUP="dialout"
SUBSYSTEM=="tty", KERNEL=="ttyUSB*", MODE="0666", GROUP="dialout"
EOF
echo "✓ Udev rule installed"
echo ""

echo "Step 3: Reloading udev rules..."
udevadm control --reload-rules
udevadm trigger
echo "✓ Udev rules reloaded"
echo ""

echo "Step 4: Adding user to dialout group..."
usermod -a -G dialout deadintermediate
echo "✓ User added to dialout group"
echo ""

echo "Step 5: Creating log file..."
touch /var/log/modem-autoconfig.log
chmod 666 /var/log/modem-autoconfig.log
echo "✓ Log file created at /var/log/modem-autoconfig.log"
echo ""

echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Now:"
echo "1. Unplug the modem (if connected)"
echo "2. Wait 5 seconds"
echo "3. Plug the modem back in"
echo "4. Check logs: tail -f /var/log/modem-autoconfig.log"
echo ""
echo "The modem will be automatically detected and configured!"
echo ""
echo "To test manually:"
echo "  lsusb                          # Check if modem is detected"
echo "  ls -l /dev/ttyACM* /dev/ttyUSB*  # Check device file"
echo ""
