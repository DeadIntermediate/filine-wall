# Hardware Setup Guide

## Overview

FiLine Wall supports automatic hardware detection and driver installation for USB modems and VoIP adapters. The system can automatically detect connected devices, install required drivers, and configure them for use.

## Supported Hardware

### USRobotics USR5637
- **Type**: USB Serial Modem
- **USB ID**: `0baf:00eb`
- **Required Drivers**: `usb-serial`, `pl2303`, `ftdi_sio`
- **Default Path**: `/dev/ttyUSB0`
- **Baud Rate**: 115200

### Grandstream HT802
- **Type**: VoIP Analog Telephone Adapter
- **USB ID**: `2c0b:0003`
- **Required Drivers**: `cdc_acm`
- **Default Path**: `/dev/ttyACM0`
- **Baud Rate**: 115200

### Generic Serial Modem
- **Type**: Standard AT Command Modem
- **Default Path**: `/dev/ttyUSB0`
- **Baud Rate**: 115200

### Custom Device
- **Type**: Manual configuration
- **Path**: User-specified
- **Baud Rate**: User-specified

## Passwordless Sudo Setup

To enable automatic driver installation without password prompts, run:

```bash
sudo ./setup-sudo.sh
```

This script will:
1. Create `/etc/sudoers.d/filine-wall` with specific permissions
2. Allow passwordless execution of:
   - `modprobe` (load kernel modules)
   - `apt-get install` (install driver packages)
   - `tee /etc/modules` (configure persistent drivers)
   - `lsusb` (USB device detection)
   - Serial device listing commands
   - `dmesg` (hardware debugging)

### Manual Sudo Configuration

If you prefer to configure manually, add this to `/etc/sudoers.d/filine-wall`:

```bash
# Replace 'username' with your actual username
username ALL=(ALL) NOPASSWD: /sbin/modprobe
username ALL=(ALL) NOPASSWD: /usr/sbin/modprobe
username ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y linux-modules-extra-raspi
username ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y usb-modeswitch
username ALL=(ALL) NOPASSWD: /usr/bin/apt-get install -y usbutils
username ALL=(ALL) NOPASSWD: /usr/bin/tee -a /etc/modules
username ALL=(ALL) NOPASSWD: /usr/bin/lsusb
username ALL=(ALL) NOPASSWD: /bin/ls /dev/ttyUSB*
username ALL=(ALL) NOPASSWD: /bin/ls /dev/ttyACM*
username ALL=(ALL) NOPASSWD: /usr/bin/dmesg
```

Set permissions:
```bash
sudo chmod 0440 /etc/sudoers.d/filine-wall
sudo visudo -c -f /etc/sudoers.d/filine-wall
```

## Automatic Hardware Detection

### Web Interface

1. Navigate to **Settings** → **Hardware Configuration**
2. Enable the modem toggle
3. Click **Detect Devices** button
4. The system will:
   - Scan for connected USB devices
   - Identify known modems
   - Check driver status
   - Auto-select detected device
   - Install missing drivers automatically

### API Endpoints

#### Detect Connected Devices
```bash
curl http://localhost:5000/api/hardware/detect
```

Response:
```json
{
  "success": true,
  "detectedDevices": [
    {
      "id": "usr5637",
      "name": "USRobotics USR5637",
      "vendorId": "0baf",
      "productId": "00eb",
      "drivers": ["usb-serial", "pl2303", "ftdi_sio"],
      "description": "USB Serial Modem",
      "driverStatus": [
        {"driver": "usb-serial", "loaded": true},
        {"driver": "pl2303", "loaded": true},
        {"driver": "ftdi_sio", "loaded": false}
      ],
      "allDriversLoaded": false
    }
  ],
  "serialDevices": ["/dev/ttyUSB0"],
  "message": "Found 1 known device(s)"
}
```

#### Check Drivers
```bash
curl -X POST http://localhost:5000/api/hardware/drivers/check \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "usr5637",
    "drivers": ["usb-serial", "pl2303", "ftdi_sio"],
    "usbVendorId": "0baf",
    "usbProductId": "00eb"
  }'
```

Response:
```json
{
  "allInstalled": false,
  "installedDrivers": ["usb-serial", "pl2303"],
  "missingDrivers": ["ftdi_sio"],
  "deviceConnected": true,
  "detectedDevice": {
    "id": "usr5637",
    "name": "USRobotics USR5637",
    "vendorId": "0baf",
    "productId": "00eb"
  },
  "message": "Detected USRobotics USR5637. Missing 1 driver(s)."
}
```

#### Install Drivers
```bash
curl -X POST http://localhost:5000/api/hardware/drivers/install \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "usr5637",
    "drivers": ["ftdi_sio"]
  }'
```

Response:
```json
{
  "success": true,
  "installed": ["ftdi_sio"],
  "failed": [],
  "message": "Successfully installed 1 driver(s). Please plug in your device."
}
```

## Manual Hardware Configuration

### Command Line

1. List connected USB devices:
```bash
lsusb
```

2. Check for serial devices:
```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

3. Load required drivers:
```bash
sudo modprobe usb-serial
sudo modprobe pl2303
sudo modprobe ftdi_sio
sudo modprobe cdc_acm
```

4. Make drivers persistent (load on boot):
```bash
echo "usb-serial" | sudo tee -a /etc/modules
echo "pl2303" | sudo tee -a /etc/modules
echo "ftdi_sio" | sudo tee -a /etc/modules
```

5. Install driver packages if needed:
```bash
sudo apt-get install -y linux-modules-extra-raspi
sudo apt-get install -y usb-modeswitch usbutils
```

### Environment Variables

Configure in `.env`:
```bash
# Enable modem
MODEM_ENABLED=true

# Device type: usr5637, grandstream-ht802, generic-serial, custom
MODEM_DEVICE_TYPE=usr5637

# Device path
MODEM_DEVICE_PATH=/dev/ttyUSB0

# Baud rate
MODEM_BAUD_RATE=115200
```

## Troubleshooting

### Device Not Detected

1. Check USB connection:
```bash
lsusb
dmesg | tail -20
```

2. Verify drivers are loaded:
```bash
lsmod | grep -E 'usb_serial|pl2303|ftdi_sio|cdc_acm'
```

3. Check permissions:
```bash
ls -la /dev/ttyUSB0
sudo usermod -aG dialout $USER
```

4. Reload drivers:
```bash
sudo modprobe -r pl2303 ftdi_sio
sudo modprobe usb-serial pl2303 ftdi_sio
```

### Driver Installation Fails

1. Check sudo permissions:
```bash
sudo -n modprobe --version
```

2. Run setup-sudo.sh:
```bash
sudo ./setup-sudo.sh
```

3. Log out and back in for group changes to take effect

### Serial Port Access Denied

Add your user to the `dialout` group:
```bash
sudo usermod -aG dialout $USER
# Log out and back in
```

### Testing Hardware Connection

Use the web interface:
1. Go to Settings → Hardware Configuration
2. Select your device
3. Click **Test Connection**

Or use the API:
```bash
curl -X POST http://localhost:5000/api/hardware/modem/test
```

## Hardware Workflow

1. **Plug in device** → USB modem/adapter connects
2. **Auto-detection** → System scans USB devices
3. **Driver check** → Verifies required kernel modules
4. **Driver install** → Loads missing modules automatically
5. **Configuration** → Sets device path and baud rate
6. **Test connection** → Verifies AT command communication
7. **Ready** → Hardware operational for spam detection

## Security Notes

- Passwordless sudo is limited to specific commands only
- Sudoers configuration is validated before activation
- Only hardware-related commands are permitted
- File permissions are set to 0440 (read-only)
- All driver operations are logged

## Additional Resources

- [AT Commands Reference](https://en.wikipedia.org/wiki/Hayes_command_set)
- [Linux Serial Port Guide](https://www.tldp.org/HOWTO/Serial-HOWTO.html)
- [USB Serial Driver Documentation](https://www.kernel.org/doc/html/latest/usb/usb-serial.html)
