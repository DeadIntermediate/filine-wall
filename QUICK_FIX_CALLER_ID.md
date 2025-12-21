# QUICK START - Fix Caller ID Detection

## The Issue
Your call detector isn't recognizing phone numbers because it only looks for one specific format (`NMBR =`), but your modem might use a different format.

## The Solution - 3 Simple Steps

### Step 1: Connect to Your Raspberry Pi

**In a NEW PowerShell window**, run:
```powershell
ssh deadintermediate@10.0.0.116
```

When prompted, enter password: `123456`

---

### Step 2: Run the Update Script

Once connected to the Pi, copy and paste these commands:

```bash
cd ~/filine-wall-1/device-client

# Download the update script from the repo if needed
curl -o update-on-pi.sh https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/device-client/update-on-pi.sh

# Or create it manually (skip curl if it worked)
# Then run it:
bash update-on-pi.sh
```

**OR if the script doesn't exist**, just run these commands directly:

```bash
cd ~/filine-wall-1/device-client

# Pull latest changes from git (if this is a git repo)
git pull

# Test the modem to see what it's sending
sudo python3 test-modem-output.py
```

**Now make a test call!** Watch what appears on screen.

Press `Ctrl+C` when done.

---

### Step 3: Restart the Service

After you see what the modem sends:

```bash
# Restart with the updated code
sudo systemctl restart call-detector

# Watch the logs in real-time
sudo tail -f /var/log/call-detector.log
```

**Make another test call** and look for:
- `[MODEM RAW]` - Shows what modem sends
- `[CALLER ID FOUND]` - Number detected!
- `🔔 INCOMING CALL DETECTED` - Call recognized!

Press `Ctrl+C` to stop watching logs.

---

## Alternative: Manual File Transfer

If you can't SSH, use WinSCP:

1. **Download WinSCP**: https://winscp.net/eng/download.php
2. **Connect**:
   - Host: `10.0.0.116`
   - User: `deadintermediate`
   - Password: `123456`
3. **Navigate to**: `/home/deadintermediate/filine-wall-1/device-client/`
4. **Upload these files** from your Windows machine:
   - `call_detector.py`
   - `test-modem-output.py`
5. **Then SSH in** and restart: `sudo systemctl restart call-detector`

---

## What Changed in call_detector.py?

The updated code now:
- ✅ Logs EVERY line the modem sends
- ✅ Recognizes 4 different caller ID formats
- ✅ Has better error messages
- ✅ Shows visual indicators (🔔 ✅ 🚫)

---

## Still Not Working?

**Run this to see EXACTLY what the modem sends:**
```bash
sudo python3 test-modem-output.py
# Make a test call
# Send me the output and I'll help!
```

**Check if modem is connected:**
```bash
ls -l /dev/ttyACM* /dev/ttyUSB*
```

**Check service status:**
```bash
sudo systemctl status call-detector
```

**View error logs:**
```bash
sudo journalctl -u call-detector -n 100
```
