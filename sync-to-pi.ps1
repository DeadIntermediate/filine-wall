# Sync updated files to Raspberry Pi

$PI_IP = "10.0.0.116"
$PI_USER = "deadintermediate"
$PI_PASS = "123456"
$LOCAL_PATH = "device-client/"
$REMOTE_PATH = "/home/deadintermediate/filine-wall-1/device-client/"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Sync Files to Raspberry Pi" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if we have SCP available
$hasScp = Get-Command scp -ErrorAction SilentlyContinue

if ($hasScp) {
    Write-Host "Copying updated files to Raspberry Pi..." -ForegroundColor Green
    
    # Copy the updated call_detector.py
    Write-Host "• call_detector.py" -ForegroundColor Yellow
    scp "$LOCAL_PATH/call_detector.py" "${PI_USER}@${PI_IP}:${REMOTE_PATH}"
    
    # Copy the test script
    Write-Host "• test-modem-output.py" -ForegroundColor Yellow
    scp "$LOCAL_PATH/test-modem-output.py" "${PI_USER}@${PI_IP}:${REMOTE_PATH}"
    
    Write-Host ""
    Write-Host "✓ Files synced!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Connect to Pi: ssh deadintermediate@10.0.0.116" -ForegroundColor White
    Write-Host "2. Run: sudo systemctl restart call-detector" -ForegroundColor White
    Write-Host "3. Or test: sudo python3 $REMOTE_PATH/test-modem-output.py" -ForegroundColor White
    
} else {
    Write-Host "SCP not found. Manual sync instructions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Use WinSCP (GUI tool)" -ForegroundColor Cyan
    Write-Host "Download: https://winscp.net/" -ForegroundColor White
    Write-Host "Host: $PI_IP" -ForegroundColor White
    Write-Host "User: $PI_USER" -ForegroundColor White
    Write-Host "Password: $PI_PASS" -ForegroundColor White
    Write-Host ""
    Write-Host "Copy these files to ${REMOTE_PATH}:" -ForegroundColor Cyan
    Write-Host "• device-client/call_detector.py" -ForegroundColor White
    Write-Host "• device-client/test-modem-output.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Install Git Bash or WSL for SCP support" -ForegroundColor Cyan
}

Write-Host ""
