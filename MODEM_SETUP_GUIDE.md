# Modem Call Detector Setup Guide

This guide will help you set up the USRobotics modem to detect incoming calls and send them to FiLine Wall for spam screening.

## Current Configuration

Based on your `.env` file:
- **Modem Port**: `/dev/ttyACM0`
- **Baud Rate**: `57600`
- **Status**: Enabled

## Prerequisites

1. **Hardware**: USRobotics modem connected via USB
2. **Permissions**: User must be in `dialout` group
3. **Python Packages**: pyserial, requests

## Quick Setup Steps

### 1. Add User to dialout Group

```bash
sudo usermod -a -G dialout $USER
```

**Important**: Log out and log back in (or reboot) for group changes to take effect.

### 2. Verify Modem Connection

```bash
# Check if modem is detected
ls -la /dev/ttyACM0

# Test modem (should be in dialout group first)
python3 test-modem.py
```

Expected output:
```
✓ Modem opened successfully
✓ Modem reset OK
✓ Caller ID enabled
✓ Modem is working!
```

### 3. Install Call Detector Service

```bash
cd device-client
sudo ./install-service.sh
```

This will:
- Install required Python packages (pyserial, requests)
- Create `/etc/call-detector/` directory
- Copy `call_detector.py` and `encryption.py`
- Create configuration file
- Set up systemd service
- Enable auto-start on boot

### 4. Configure the Service

Edit the configuration:

```bash
sudo nano /etc/call-detector/config.ini
```

Update these settings:
```ini
[server]
url = http://localhost:5000
api_path = /api/admin/devices

[device]
id = local-modem
auth_token = your-auth-token-here

[modem]
port = /dev/ttyACM0
baud_rate = 57600
timeout = 5
caller_id_enabled = true

[encryption]
enabled = false
```

**Note**: For local deployment, you can disable encryption. The `auth_token` can be any value since auth is disabled.

### 5. Start the Service

```bash
# Start the service
sudo systemctl start call-detector

# Check status
sudo systemctl status call-detector

# View live logs
sudo journalctl -u call-detector -f
```

### 6. Test Call Detection

Call your phone line and watch the logs:

```bash
sudo journalctl -u call-detector -f
```

You should see:
```
INFO - Incoming call detected: NMBR = 5551234567
INFO - Call screened: blocked/allowed
```

## Monitoring

### Check Service Status
```bash
sudo systemctl status call-detector
```

### View Recent Logs
```bash
sudo journalctl -u call-detector -n 50
```

### View Live Logs
```bash
sudo journalctl -u call-detector -f
```

### Stop the Service
```bash
sudo systemctl stop call-detector
```

### Restart the Service
```bash
sudo systemctl restart call-detector
```

### Disable Auto-Start
```bash
sudo systemctl disable call-detector
```

## Troubleshooting

### Modem Not Found

**Error**: `No such file or directory: '/dev/ttyACM0'`

**Solution**:
```bash
# Find your modem
ls /dev/ttyUSB* /dev/ttyACM*

# Update config with correct port
sudo nano /etc/call-detector/config.ini
```

### Permission Denied

**Error**: `Permission denied: '/dev/ttyACM0'`

**Solution**:
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Verify group membership (after logout/login)
groups

# Check device permissions
ls -la /dev/ttyACM0
```

### Service Won't Start

**Check logs**:
```bash
sudo journalctl -u call-detector -n 100 --no-pager
```

**Common issues**:
1. Python packages not installed: `sudo apt install python3-serial python3-requests`
2. Configuration file missing: Run `sudo ./install-service.sh` again
3. Port in use: `sudo lsof /dev/ttyACM0`

### Modem Not Responding

**Test modem**:
```bash
python3 test-modem.py
```

**Reset modem**:
```bash
# Unplug and replug USB cable
# Or software reset:
echo "ATZ" | sudo tee /dev/ttyACM0
```

### No Calls Detected

1. **Verify Caller ID is enabled on your phone line** (contact your phone provider)
2. **Check modem settings**:
   ```bash
   # Test caller ID manually
   minicom -D /dev/ttyACM0 -b 57600
   
   # In minicom:
   AT+VCID=1  # Enable caller ID
   AT         # Test response
   ```
3. **Monitor raw modem output**:
   ```bash
   python3 device-client/test-call-detection.py
   ```

## Manual Testing

### Test Call Detection Without Service

```bash
cd device-client
python3 test-call-detection.py
```

Make a test call and watch for caller ID output.

### Test API Connection

```bash
# Test server connectivity
curl http://localhost:5000/health

# Test device endpoint (if auth enabled)
curl -H "Authorization: Bearer your-token" \
     http://localhost:5000/api/admin/devices
```

## Advanced Configuration

### Enable Encryption

1. Generate device credentials in FiLine Wall web interface
2. Update config:
   ```ini
   [encryption]
   enabled = true
   
   [device]
   auth_token = your-generated-token
   ```

3. Restart service:
   ```bash
   sudo systemctl restart call-detector
   ```

### Custom Modem Commands

Edit `/etc/call-detector/call_detector.py` and modify `_setup_modem()` method to add custom AT commands.

### Multiple Modems

Copy and modify the service for each modem:
```bash
sudo cp /etc/systemd/system/call-detector.service \
        /etc/systemd/system/call-detector-2.service

sudo nano /etc/systemd/system/call-detector-2.service
# Update ExecStart to use different config file
```

## Integration with FiLine Wall

Once the service is running:

1. **View detected calls** in FiLine Wall dashboard at `http://localhost:5000`
2. **Check call logs** in the "Call History" section
3. **Monitor blocked calls** in real-time
4. **Add numbers to whitelist/blacklist** from the interface

## Performance Tips

1. **Set appropriate timeout**: Reduce timeout in config for faster detection
2. **Enable caching**: FiLine Wall caches spam database lookups
3. **Use local database**: Set `TWILIO_ACCOUNT_SID` to empty for local-only mode
4. **Monitor resources**: `systemctl status call-detector` shows CPU/memory usage

## Uninstall

To remove the call detector:

```bash
# Stop and disable service
sudo systemctl stop call-detector
sudo systemctl disable call-detector

# Remove service file
sudo rm /etc/systemd/system/call-detector.service

# Remove configuration
sudo rm -rf /etc/call-detector/

# Remove log file
sudo rm /var/log/call-detector.log

# Reload systemd
sudo systemctl daemon-reload
```

## Next Steps

1. ✅ Verify modem connection
2. ✅ Install call detector service
3. ✅ Test with a phone call
4. 📊 Monitor dashboard for blocked calls
5. 🔧 Fine-tune spam detection settings
6. 📱 Add trusted numbers to whitelist

## Support

- **Logs**: `sudo journalctl -u call-detector -f`
- **Test modem**: `python3 test-modem.py`
- **Test detection**: `python3 device-client/test-call-detection.py`
- **Check config**: `sudo cat /etc/call-detector/config.ini`
