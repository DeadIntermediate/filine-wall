# Caller ID Troubleshooting Guide

## Problem
The call detector isn't picking up phone numbers during test calls.

## Updated Files
I've updated `call_detector.py` to:
1. **Add verbose logging** - Now logs ALL modem output with `[MODEM RAW]` prefix
2. **Support multiple caller ID formats** - Recognizes various modem output patterns:
   - `NMBR = <number>`
   - `CALLER NUMBER: <number>`
   - `+CLIP: "<number>"`
   - Raw 10-digit numbers
3. **Better modem initialization** - Tries multiple caller ID enable commands
4. **Visual indicators** - Uses emojis (🔔 ✅🚫) to make call events easy to spot in logs

## Diagnostic Steps

### Step 1: Run the Test Script
Use the new diagnostic tool to see exactly what your modem is sending:

```bash
sudo python3 device-client/test-modem-output.py
```

Then **make a test call**. You should see output like:
```
[14:23:45] RAW: 'RING'
[14:23:45] TXT: RING
    ⚡ POSSIBLE CALLER ID DATA DETECTED!

[14:23:46] RAW: 'NMBR = 5551234567'
[14:23:46] TXT: NMBR = 5551234567
    ⚡ POSSIBLE CALLER ID DATA DETECTED!
```

### Step 2: Check What Your Modem Sends
Look at the output from Step 1 and identify:
- ✅ Does the modem show "RING" when a call comes in?
- ✅ Does it show any number information?
- ✅ What format is the number in?

### Step 3: Restart the Call Detector
After updating the code:

```bash
# Stop the service
sudo systemctl stop call-detector

# Start it manually to see live logs
sudo python3 device-client/call_detector.py
```

Now make another test call and watch for:
- `[MODEM RAW]` lines showing what the modem sends
- `[CALLER ID FOUND]` messages when a number is detected
- `🔔 INCOMING CALL DETECTED` when a call is recognized

### Step 4: Check Common Issues

#### Issue A: No caller ID service from phone company
**Symptom**: Modem shows "RING" but no number information
**Solution**: Contact your phone provider to enable Caller ID service

#### Issue B: Modem doesn't support caller ID
**Symptom**: No response to AT+VCID commands
**Solution**: Check your modem model documentation for caller ID support

#### Issue C: Wrong modem device
**Symptom**: "Failed to initialize modem" errors
**Solution**: 
```bash
# Find connected modems
ls -l /dev/ttyACM* /dev/ttyUSB*

# Update config.ini with correct device
sudo nano /etc/call-detector/config.ini
```

#### Issue D: Baud rate mismatch
**Symptom**: Garbled output or no response
**Solution**: Try different baud rates in config.ini: 9600, 19200, 57600, 115200

#### Issue E: Caller ID format not recognized
**Symptom**: Modem shows caller info but detector doesn't catch it
**Solution**: 
1. Note the exact format from `test-modem-output.py`
2. I can update the parser to handle that specific format

## Quick Verification

Run this command to check if the service is running:
```bash
sudo systemctl status call-detector
```

View recent logs:
```bash
sudo journalctl -u call-detector -n 50 --no-pager
```

Or check the log file:
```bash
sudo tail -f /var/log/call-detector.log
```

Look for `[MODEM RAW]` entries to see what your modem is actually sending.

## Next Steps

1. Run `test-modem-output.py` and make a test call
2. Share the output with me if caller ID still isn't detected
3. I can then customize the parser for your specific modem's format

The updated code should now show you EXACTLY what the modem is sending, which will help us diagnose why the number isn't being detected.
