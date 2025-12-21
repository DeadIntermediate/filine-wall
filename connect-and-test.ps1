# PowerShell script to connect to Raspberry Pi and run diagnostics

$PI_IP = "10.0.0.116"
$PI_USER = "deadintermediate"
$PI_PASS = "123456"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "FiLine Caller ID Diagnostic Tool" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if plink is available (PuTTY's command-line tool)
$hasPlink = Get-Command plink -ErrorAction SilentlyContinue

if (-not $hasPlink) {
    Write-Host "Option 1: Using SSH (recommended)" -ForegroundColor Yellow
    Write-Host "Run these commands in sequence:" -ForegroundColor White
    Write-Host ""
    Write-Host "# Connect to Pi" -ForegroundColor Green
    Write-Host "ssh deadintermediate@10.0.0.116" -ForegroundColor White
    Write-Host "# Password: 123456" -ForegroundColor Gray
    Write-Host ""
    Write-Host "# Once connected, run the diagnostic:" -ForegroundColor Green
    Write-Host "sudo python3 /home/deadintermediate/filine-wall-1/device-client/test-modem-output.py" -ForegroundColor White
    Write-Host ""
    Write-Host "# Or check the call detector logs:" -ForegroundColor Green
    Write-Host "sudo tail -f /var/log/call-detector.log" -ForegroundColor White
    Write-Host ""
    Write-Host "# Or restart with live logging:" -ForegroundColor Green
    Write-Host "sudo systemctl stop call-detector" -ForegroundColor White
    Write-Host "sudo python3 /home/deadintermediate/filine-wall-1/device-client/call_detector.py" -ForegroundColor White
    Write-Host ""
    Write-Host "==================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option 2: Install PuTTY for automated connection" -ForegroundColor Yellow
    Write-Host "Download from: https://www.putty.org/" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Connecting to Raspberry Pi..." -ForegroundColor Green
    Write-Host ""
    
    # Note: plink with password requires special handling
    Write-Host "Manual connection required. Run:" -ForegroundColor Yellow
    Write-Host "plink -ssh deadintermediate@10.0.0.116 -pw 123456" -ForegroundColor White
}

Write-Host ""
Write-Host "📱 After connecting, make a test call and watch for:" -ForegroundColor Cyan
Write-Host "   • [MODEM RAW] lines showing modem output" -ForegroundColor White
Write-Host "   • [CALLER ID FOUND] when number is detected" -ForegroundColor White
Write-Host "   • 🔔 INCOMING CALL DETECTED messages" -ForegroundColor White
Write-Host ""
