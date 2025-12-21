# Modem Diagnostic Script for Raspberry Pi
# This script connects to the Pi and runs diagnostics on the modem

$PI_IP = "10.0.0.116"
$PI_USER = "deadintermediate"
$PI_PASS = "123456"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FiLine Modem Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Checking if modem device exists..." -ForegroundColor Yellow
$checkDevice = @"
ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null | head -10
"@

Write-Host "Step 2: Checking modem permissions..." -ForegroundColor Yellow
$checkPerms = @"
groups | grep -E 'dialout|tty'
"@

Write-Host "Step 3: Testing modem communication..." -ForegroundColor Yellow
$testModem = @"
cd ~/filine-wall-1/device-client && sudo python3 -c "
import serial
import time
try:
    modem = serial.Serial('/dev/ttyACM0', 57600, timeout=1)
    print('✓ Modem opened successfully')
    modem.write(b'ATZ\r')
    time.sleep(1)
    response = modem.read(modem.in_waiting).decode(errors='ignore')
    print(f'ATZ Response: {response}')
    modem.write(b'AT+VCID=1\r')
    time.sleep(0.5)
    response = modem.read(modem.in_waiting).decode(errors='ignore')
    print(f'Caller ID Enable Response: {response}')
    modem.close()
except Exception as e:
    print(f'❌ Error: {e}')
"
"@

Write-Host ""
Write-Host "Running diagnostics on Pi..." -ForegroundColor Green
Write-Host ""

# Run comprehensive diagnostic
$diagnosticScript = @"
echo '=== MODEM DIAGNOSTICS ==='
echo ''
echo '1. Checking for USB modem devices:'
ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || echo 'No modem devices found!'
echo ''
echo '2. Checking user permissions (should be in dialout group):'
groups
echo ''
echo '3. Checking if call-detector service is running:'
sudo systemctl status call-detector.service --no-pager | head -15
echo ''
echo '4. Checking recent call-detector logs:'
sudo journalctl -u call-detector.service -n 20 --no-pager
echo ''
echo '5. Testing modem directly...'
cd ~/filine-wall-1/device-client
if [ -f test-modem-output.py ]; then
    echo 'Starting modem test (will run for 10 seconds)...'
    timeout 10 sudo python3 test-modem-output.py 2>&1 || echo 'Modem test completed'
else
    echo 'test-modem-output.py not found'
fi
"@

# Execute diagnostic script on Pi
ssh -o ConnectTimeout=10 $PI_USER@$PI_IP $diagnosticScript

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Common issues and fixes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Issue 1: No modem device found" -ForegroundColor White
Write-Host "  Fix: Check USB cable and run 'lsusb' on Pi" -ForegroundColor Gray
Write-Host ""
Write-Host "Issue 2: Permission denied" -ForegroundColor White
Write-Host "  Fix: sudo usermod -a -G dialout deadintermediate" -ForegroundColor Gray
Write-Host "       Then logout/login or reboot" -ForegroundColor Gray
Write-Host ""
Write-Host "Issue 3: Modem not responding to AT commands" -ForegroundColor White
Write-Host "  Fix: Try different baud rate (115200, 9600)" -ForegroundColor Gray
Write-Host "       Or check modem power/reset" -ForegroundColor Gray
Write-Host ""
Write-Host "Issue 4: No RING or caller ID data" -ForegroundColor White
Write-Host "  Fix: Verify phone line is connected" -ForegroundColor Gray
Write-Host "       Enable caller ID on phone line subscription" -ForegroundColor Gray
Write-Host "       Try AT+VCID=1 or AT#CID=1 commands" -ForegroundColor Gray
Write-Host ""
Write-Host "To manually test modem on Pi:" -ForegroundColor Cyan
Write-Host "  ssh $PI_USER@$PI_IP" -ForegroundColor White
Write-Host "  cd ~/filine-wall-1/device-client" -ForegroundColor White
Write-Host "  sudo python3 test-modem-output.py" -ForegroundColor White
Write-Host "  (Then make a test call)" -ForegroundColor White
Write-Host ""
