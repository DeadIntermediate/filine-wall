# PowerShell script to install modem auto-detection on Raspberry Pi

$PI_HOST = "10.0.0.116"
$PI_USER = "deadintermediate"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Modem Auto-Detection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Copying files to Pi..." -ForegroundColor Yellow

$files = @(
    "device-client\modem-autoconfig.sh",
    "device-client\install-modem-autodetect.sh",
    "device-client\check-modem-status.sh",
    "device-client\test-modem-output.py"
)

foreach ($file in $files) {
    Write-Host "  Copying $file..." -ForegroundColor Gray
    scp -o PreferredAuthentications=password -o PubkeyAuthentication=no "$file" "${PI_USER}@${PI_HOST}:~/Desktop/Projects/FiLine/filine-wall/device-client/"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓" -ForegroundColor Green
    } else {
        Write-Host "    ✗ Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Step 2: Making scripts executable..." -ForegroundColor Yellow
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no $PI_USER@$PI_HOST "cd ~/Desktop/Projects/FiLine/filine-wall/device-client && chmod +x *.sh"

Write-Host ""
Write-Host "Step 3: Installing auto-detection system..." -ForegroundColor Yellow
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no $PI_USER@$PI_HOST "cd ~/Desktop/Projects/FiLine/filine-wall/device-client && sudo bash install-modem-autodetect.sh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Unplug your USB modem from the Pi" -ForegroundColor White
Write-Host "2. Wait 5 seconds" -ForegroundColor White
Write-Host "3. Plug it back in" -ForegroundColor White
Write-Host "4. The modem will be auto-detected and configured!" -ForegroundColor White
Write-Host ""
Write-Host "To check status:" -ForegroundColor Cyan
Write-Host "  .\check-pi-modem.ps1" -ForegroundColor White
Write-Host ""
Write-Host "To view auto-detection logs:" -ForegroundColor Cyan
Write-Host "  ssh -o PreferredAuthentications=password $PI_USER@$PI_HOST 'tail -f /var/log/modem-autoconfig.log'" -ForegroundColor White
Write-Host ""
