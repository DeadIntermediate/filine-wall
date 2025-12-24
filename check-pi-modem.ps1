# Quick script to check modem status on Pi

$PI_HOST = "10.0.0.116"
$PI_USER = "deadintermediate"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking Modem Status on Pi" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no $PI_USER@$PI_HOST "cd ~/Desktop/Projects/FiLine/filine-wall/device-client && bash check-modem-status.sh"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
