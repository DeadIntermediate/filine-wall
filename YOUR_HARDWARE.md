# Your FiLine Wall Hardware Configuration

## Your Devices

You have **three** supported devices that FiLine Wall can automatically detect and configure:

### 1. USRobotics USR5637
- **Model**: 56k USB Hardware Fax Modem
- **USB ID**: `0baf:00eb`
- **Serial Port**: `/dev/ttyUSB0` (typically)
- **Drivers**: `usb-serial`, `pl2303`, `ftdi_sio`
- **Status**: ✅ Fully supported with auto-detection

### 2. USRobotics USR5686G
- **Model**: 56k USB Voice Fax Modem
- **USB ID**: `0baf:0100`
- **Serial Port**: `/dev/ttyUSB0` or `/dev/ttyUSB1` (if both USR devices connected)
- **Drivers**: `usb-serial`, `ti_usb_3410_5052`
- **Status**: ✅ Fully supported with auto-detection

### 3. Grandstream HT802 V2
- **Model**: VoIP Analog Telephone Adapter
- **USB ID**: `2c0b:0003`
- **Serial Port**: `/dev/ttyACM0`
- **Drivers**: `cdc_acm`
- **Status**: ✅ Fully supported with auto-detection

## Quick Setup

### Step 1: Run Passwordless Sudo Setup (One-time)
```bash
cd /home/deadintermediate/Desktop/Projects/FiLine/filine-wall
sudo ./setup-sudo.sh
```

This allows automatic driver installation without password prompts.

### Step 2: Plug in Your Device
Connect **one** of your modems via USB:
- USR5637 or USR5686G for traditional phone line blocking
- Grandstream HT802 for VoIP/PSTN gateway blocking

### Step 3: Start FiLine Wall
```bash
./start-filine.sh
# Or use tmux:
./manage-filine.sh start
```

### Step 4: Auto-Configure Hardware
1. Open browser to `http://localhost:5000`
2. Navigate to **Settings** → **Hardware Configuration**
3. Enable the modem toggle
4. Click **"Detect Devices"** button
5. System will:
   - Automatically detect which device is plugged in
   - Install required drivers
   - Configure the correct serial port
   - Set optimal baud rate
   - Test connection

That's it! Your hardware is ready to block spam calls.

## Using Multiple Devices

### Scenario 1: Both USRobotics Modems
If you plug in both USR5637 and USR5686G:
- USR5637 will typically appear as `/dev/ttyUSB0`
- USR5686G will appear as `/dev/ttyUSB1`
- Auto-detect will find both devices
- Choose which one to use in the dropdown

### Scenario 2: USRobotics + Grandstream
If you plug in a USR modem and the HT802:
- USR modem: `/dev/ttyUSB0`
- Grandstream: `/dev/ttyACM0`
- Both will be detected
- Use USR for direct phone line blocking
- Use HT802 for VoIP integration

## Checking Connected Devices

### Web Interface
Settings → Hardware Configuration → Click "Detect Devices"

### Command Line
```bash
# List all USB devices
lsusb

# Look for:
# Bus 001 Device 005: ID 0baf:00eb USRobotics USR5637
# Bus 001 Device 006: ID 0baf:0100 USRobotics USR5686G  
# Bus 001 Device 007: ID 2c0b:0003 Grandstream Networks

# List serial ports
ls -la /dev/ttyUSB* /dev/ttyACM*

# Check loaded drivers
lsmod | grep -E 'usb_serial|pl2303|ftdi_sio|ti_usb|cdc_acm'
```

## Troubleshooting

### Device Not Detected?

1. **Check USB connection:**
   ```bash
   lsusb
   dmesg | tail -20
   ```

2. **Verify drivers loaded:**
   ```bash
   lsmod | grep usb_serial
   lsmod | grep ti_usb
   lsmod | grep cdc_acm
   ```

3. **Manually load drivers:**
   ```bash
   sudo modprobe usb-serial
   sudo modprobe ti_usb_3410_5052  # For USR5686G
   sudo modprobe pl2303            # For USR5637
   sudo modprobe cdc_acm           # For HT802
   ```

### Permission Denied on Serial Port?

Add yourself to the `dialout` group:
```bash
sudo usermod -aG dialout deadintermediate
# Log out and back in
```

### Which Device Should I Use?

**For Traditional Phone Line (POTS):**
- Use **USR5637** or **USR5686G**
- Connect: `Phone Wall Jack → Modem LINE → Modem PHONE → Your Phone`
- Best for: Home landline spam blocking

**For VoIP Integration:**
- Use **Grandstream HT802**
- Connect: `VoIP Service → HT802 → Your Phone`
- Best for: Digital phone service spam blocking

**USR5686G vs USR5637:**
- **USR5686G**: Has voice features, better for call recording/analysis
- **USR5637**: Basic fax modem, sufficient for caller ID blocking

## Testing Your Setup

### Web Interface Test
1. Go to Settings → Hardware Configuration
2. Select your device
3. Click **"Test Connection"**
4. Should see: "Modem connection successful"

### Command Line Test
```bash
# Test with API
curl -X POST http://localhost:5000/api/hardware/modem/test

# Manual serial test (replace with your device)
screen /dev/ttyUSB0 115200
# Type: AT
# Should respond: OK
# Press Ctrl+A then K to exit
```

## Current Status

Check what's currently connected:
```bash
curl http://localhost:5000/api/hardware/detect | jq
```

Example output:
```json
{
  "success": true,
  "detectedDevices": [
    {
      "id": "usr5686g",
      "name": "USRobotics USR5686G",
      "vendorId": "0baf",
      "productId": "0100",
      "drivers": ["usb-serial", "ti_usb_3410_5052"],
      "allDriversLoaded": true
    }
  ],
  "serialDevices": ["/dev/ttyUSB0"],
  "message": "Found 1 known device(s)"
}
```

## Next Steps

Once your hardware is configured:
1. ✅ Test incoming call detection
2. ✅ Configure call blocking rules
3. ✅ Set up call screening options
4. ✅ Enable spam database sync
5. ✅ Monitor blocked calls in real-time

Your FiLine Wall is ready to protect you from spam calls! 🛡️
