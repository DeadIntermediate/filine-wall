# Quick connection helper for Windows PowerShell
# This will help you connect to the Pi and run commands

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FiLine Raspberry Pi Connection Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pi IP Address: 10.0.0.116" -ForegroundColor Yellow
Write-Host "Username: deadintermediate" -ForegroundColor Yellow
Write-Host "Password: 123456" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening SSH connection..." -ForegroundColor Green
Write-Host ""
Write-Host "After connecting, you can run:" -ForegroundColor Cyan
Write-Host "  cd ~/filine-wall-1/device-client" -ForegroundColor White
Write-Host "  bash update-on-pi.sh" -ForegroundColor White
Write-Host ""
Write-Host "Or manually test:" -ForegroundColor Cyan
Write-Host "  sudo python3 test-modem-output.py" -ForegroundColor White
Write-Host ""
Write-Host "Connecting now..." -ForegroundColor Green
Write-Host ""

# Try to connect via SSH
ssh deadintermediate@10.0.0.116
