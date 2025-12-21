# Manual Steps to Update and Test Caller ID on Raspberry Pi

## Step 1: Connect to Your Raspberry Pi

Open a new PowerShell or Command Prompt window and run:

```powershell
ssh deadintermediate@10.0.0.116
```

Enter your password when prompted.

**If SSH fails**, verify:
- The password is correct
- The Pi is online: `ping 10.0.0.116`
- SSH is enabled on the Pi

---

## Step 2: Update the Files on the Pi

Once connected to the Pi, run these commands:

### A. Backup current files
```bash
cd ~/filine-wall-1/device-client
cp call_detector.py call_detector.py.backup
```

### B. Update call_detector.py

Open the file for editing:
```bash
nano call_detector.py
```

Find the `_parse_caller_id` function (around line 140) and replace it with this updated version:

```python
def _parse_caller_id(self, line):
    """Parse caller ID information from modem output"""
    try:
        # Log all modem output for debugging
        logging.info(f"[MODEM RAW] {line}")
        
        # Support multiple caller ID formats
        # Format 1: NMBR = <number>
        if "NMBR" in line.upper():
            if "=" in line:
                phone_number = line.split("=")[1].strip()
                logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                return phone_number
        
        # Format 2: CALLER NUMBER: <number>
        if "CALLER" in line.upper() and "NUMBER" in line.upper():
            parts = line.split(":")
            if len(parts) > 1:
                phone_number = parts[1].strip()
                logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                return phone_number
        
        # Format 3: +CLIP: "<number>",<type>
        if "+CLIP" in line.upper():
            import re
            match = re.search(r'"([^"]+)"', line)
            if match:
                phone_number = match.group(1)
                logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
                return phone_number
        
        # Format 4: Just a number pattern (10 digits)
        if line.strip().isdigit() and len(line.strip()) >= 10:
            phone_number = line.strip()
            logging.info(f"[CALLER ID FOUND] Number: {phone_number}")
            return phone_number
        
        return None
    except Exception as e:
        logging.error(f"Error parsing caller ID: {str(e)}")
        return None
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

### C. Create the test script

```bash
nano test-modem-output.py
```

Paste this entire script:

```python
#!/usr/bin/env python3
"""
Test script to monitor raw modem output and diagnose caller ID issues.
Run this script and make a test call to see what the modem actually sends.
"""

import serial
import time
import sys
from configparser import ConfigParser

def test_modem():
    # Load config
    config = ConfigParser()
    config.read('/etc/call-detector/config.ini')
    
    device = config["modem"]["device"]
    baud_rate = int(config["modem"].get("baud_rate", "57600"))
    
    print(f"Opening modem on {device} at {baud_rate} baud...")
    print("=" * 60)
    
    try:
        modem = serial.Serial(
            port=device,
            baudrate=baud_rate,
            timeout=1
        )
        
        print("✓ Modem connected successfully")
        print("\nSending initialization commands...")
        
        # Reset modem
        modem.write(b"ATZ\r")
        time.sleep(1)
        response = modem.read(modem.in_waiting).decode(errors='ignore')
        print(f"ATZ Response: {response.strip()}")
        
        # Try different caller ID commands
        commands = [
            "AT+VCID=1",   # Standard voice caller ID
            "AT#CID=1",    # Alternative format
            "AT+CLIP=1",   # Calling Line Identification
        ]
        
        for cmd in commands:
            print(f"\nSending: {cmd}")
            modem.write(f"{cmd}\r".encode())
            time.sleep(0.5)
            if modem.in_waiting:
                response = modem.read(modem.in_waiting).decode(errors='ignore')
                print(f"Response: {response.strip()}")
        
        print("\n" + "=" * 60)
        print("MONITORING FOR CALLS - Make a test call now!")
        print("Press Ctrl+C to stop")
        print("=" * 60 + "\n")
        
        # Monitor for incoming data
        while True:
            if modem.in_waiting:
                data = modem.readline().decode(errors='ignore').strip()
                if data:
                    print(f"[{time.strftime('%H:%M:%S')}] RAW: {repr(data)}")
                    print(f"[{time.strftime('%H:%M:%S')}] TXT: {data}")
                    
                    # Check for common caller ID patterns
                    if any(keyword in data.upper() for keyword in ['NMBR', 'CALLER', 'CLIP', 'RING']):
                        print("    ⚡ POSSIBLE CALLER ID DATA DETECTED!")
                    print()
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\nStopped by user")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if 'modem' in locals():
            modem.close()
            print("Modem closed")

if __name__ == "__main__":
    test_modem()
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

Make it executable:
```bash
chmod +x test-modem-output.py
```

---

## Step 3: Run the Diagnostic Test

```bash
sudo python3 test-modem-output.py
```

**Now make a test call to your FiLine number!**

You should see output showing exactly what the modem sends. Look for:
- `RING` messages
- Any lines with numbers
- `NMBR`, `CALLER`, or `CLIP` keywords

Press `Ctrl+C` when done.

---

## Step 4: Restart the Call Detector Service

If the test shows the modem is receiving caller ID data:

```bash
# Restart the service with new code
sudo systemctl restart call-detector

# Watch the logs live
sudo tail -f /var/log/call-detector.log
```

Make another test call and look for:
- `[MODEM RAW]` lines
- `[CALLER ID FOUND]` messages
- `🔔 INCOMING CALL DETECTED`

---

## Alternative: Copy Files from Windows

If you prefer to transfer files from Windows instead of editing on Pi:

### Option A: Use WinSCP (Easiest - GUI)
1. Download from https://winscp.net/
2. Connect to `10.0.0.116`
3. Login as `deadintermediate`
4. Navigate to `/home/deadintermediate/filine-wall-1/device-client/`
5. Drag and drop:
   - `call_detector.py`
   - `test-modem-output.py`

### Option B: Use SCP from PowerShell
```powershell
# From the filine-wall-1 directory on Windows
scp device-client/call_detector.py deadintermediate@10.0.0.116:~/filine-wall-1/device-client/
scp device-client/test-modem-output.py deadintermediate@10.0.0.116:~/filine-wall-1/device-client/
```

---

## Troubleshooting

### Can't connect via SSH?
```bash
# From Windows, test connectivity
ping 10.0.0.116

# Check if SSH port is open
Test-NetConnection -ComputerName 10.0.0.116 -Port 22
```

### Password not working?
- Double-check the password
- Try resetting via keyboard/monitor connected to Pi
- Check if account is locked: `sudo passwd -u deadintermediate`

### Modem not found?
```bash
# List USB devices
ls -l /dev/ttyACM* /dev/ttyUSB*

# Check which one is the modem
dmesg | grep tty
```

---

Let me know what you see when you run `test-modem-output.py`!
