# Hardware Setup Guide - FiLine Wall

Complete guide for connecting your modem and phone system to FiLine Wall.

## Table of Contents
1. [Required Hardware](#required-hardware)
2. [Modem Compatibility Check](#modem-compatibility-check)
3. [Setup Scenarios](#setup-scenarios)
4. [Troubleshooting](#troubleshooting)

---

## Required Hardware

### Minimum Setup
- **Raspberry Pi 4** (4GB+ RAM recommended)
- **Compatible Modem** (see below)
- **RJ11 Cables** (2-3 standard phone cables)
- **USB Cable** (Type-A to Type-B, usually included with modem)
- **Power Supply** for Raspberry Pi
- **MicroSD Card** (32GB+, SanDisk Extreme recommended)

### Optional Hardware
- **RJ11 Splitter** (2-way or 3-way for multiple phones)
- **UPS (Uninterruptible Power Supply)** for reliability
- **USB Hub** (if connecting multiple modems)

---

## Modem Compatibility Check

### ✅ CORRECT Modem: USRobotics USR5637

The **USRobotics USR5637** is the recommended modem for FiLine Wall.

**Physical Identification:**
```
┌────────────────────────────────┐
│  USRobotics USR5637           │
│  56K USB Modem                │
├────────────────────────────────┤
│                                │
│  LINE    PHONE      USB-B      │
│  [RJ11]  [RJ11]   [Square USB] │
│                                │
└────────────────────────────────┘
```

**Key Features:**
- ✅ **2 RJ11 Ports**: LINE (input) and PHONE (output)
- ✅ **1 USB Port**: Type-B (square connector)
- ✅ **Pass-through capability**: Can block calls before phone rings
- ✅ **Caller ID support**: Full NMBR + NAME
- ✅ **Price**: ~$50-70 USD

**Where to Buy:**
- Amazon: Search "USRobotics USR5637"
- eBay: Often available used for $30-40
- NewEgg, B&H Photo Video

### ❌ INCORRECT Modem: Generic USB Modems

**Does NOT work:**
```
┌────────────────┐
│  Generic USB   │──[USB Type-A Cable]
│  [RJ11]        │   (attached)
└────────────────┘
```

**Why it doesn't work:**
- ❌ Only 1 RJ11 port (no PHONE port)
- ❌ Cannot pass calls through to your phone
- ❌ Can only monitor calls, not block them
- ❌ Your phone will still ring for spam calls

**If you have this modem:** You need to purchase a USR5637 or Grandstream HT802.

### ✅ Alternative: Grandstream HT802 (VoIP)

See `GRANDSTREAM_HT802_SETUP.md` for complete setup guide.

**Best for:**
- VoIP/SIP phone service
- Need to monitor 2 phone lines
- Don't have traditional landline

---

## Setup Scenarios

### Scenario 1: Traditional Landline (Most Common)

**Equipment:**
- Wall phone jack (PSTN landline)
- USRobotics USR5637
- Raspberry Pi 4
- Your telephone(s)

**Connection Diagram:**
```
[Wall Phone Jack]
       │
       │ (RJ11 Cable #1)
       ↓
┌──────────────────┐
│   USR5637 MODEM  │
│                  │
│ LINE ←───────────┤ (Input from wall)
│                  │
│ PHONE ───────────┼───→ [Your Phone(s)]
│                  │     (RJ11 Cable #2)
│ USB ─────────────┼───→ [Raspberry Pi 4]
│                  │     (USB Cable)
└──────────────────┘
```

**Step-by-Step:**
1. **Unplug your phone** from the wall jack
2. **Connect wall jack** to USR5637 **LINE port** (RJ11 Cable #1)
3. **Connect your phone** to USR5637 **PHONE port** (RJ11 Cable #2)
4. **Connect USB cable** from USR5637 to Raspberry Pi
5. Power on Raspberry Pi and run FiLine Wall
6. Test with a call

**Cables Needed:**
- 2x RJ11 cables (standard phone cables)
- 1x USB Type-A to Type-B cable

---

### Scenario 2: Spectrum/Cable Modem with Phone Service

**Equipment:**
- Spectrum modem/gateway (provides Internet + Phone)
- USRobotics USR5637
- Raspberry Pi 4
- Your telephone(s)

**Connection Diagram:**
```
[Coax Cable from Street]
       │
       ↓
┌─────────────────────┐
│  SPECTRUM MODEM     │
│  (Gateway/Router)   │
├─────────────────────┤
│ [Ethernet Ports]    │ ──→ Network devices
│ [Phone Port] (RJ11) │
└──────┬──────────────┘
       │ (RJ11 Cable #1)
       ↓
┌──────────────────┐
│   USR5637 MODEM  │
│                  │
│ LINE ←───────────┤
│                  │
│ PHONE ───────────┼───→ [Your Phone(s)]
│                  │     (RJ11 Cable #2)
│ USB ─────────────┼───→ [Raspberry Pi 4]
│                  │     (USB Cable)
└──────────────────┘
```

**Step-by-Step:**
1. **Locate the Phone port** on your Spectrum modem (usually labeled "TEL1" or "PHONE")
2. **Connect Spectrum phone port** to USR5637 **LINE port** (RJ11 Cable #1)
3. **Connect your phone** to USR5637 **PHONE port** (RJ11 Cable #2)
4. **Connect USB cable** from USR5637 to Raspberry Pi
5. Power on Raspberry Pi and run FiLine Wall
6. Test with a call

**Important:** Do NOT use a splitter on the Spectrum phone port - connect directly to USR5637.

---

### Scenario 3: Multiple Phones (Using Splitter)

**Equipment:**
- USRobotics USR5637 (already connected to wall/Spectrum)
- RJ11 Splitter (2-way or 3-way)
- Multiple telephones
- Extra RJ11 cables

**Connection Diagram:**
```
[Wall/Spectrum] → [USR5637 LINE Port]
                        │
                   [USB] ──→ Raspberry Pi
                        │
                  [PHONE Port]
                        │
                        ↓
                  [RJ11 Splitter]
                  ┌─────┼─────┐
                  │     │     │
              [Phone][Phone][Phone]
```

**Step-by-Step:**
1. Complete basic setup (Scenario 1 or 2)
2. **Disconnect your phone** from USR5637 PHONE port
3. **Connect RJ11 splitter** to USR5637 PHONE port
4. **Connect multiple phones** to splitter outputs
5. All phones will ring for legitimate calls
6. All phones can make outgoing calls

**Splitter Limits:**
- Maximum: 5-10 phones (depends on REN rating)
- Quality matters: Use good splitters to avoid static
- Can daisy-chain splitters if needed

**Alternative:** Use a cordless phone base station instead of splitters:
```
[USR5637 PHONE Port] → [Cordless Base Station] → (Wireless to multiple handsets)
```

---

### Scenario 4: Bypass Phone (NOT Recommended)

**⚠️ Warning:** This setup leaves one phone unprotected from spam!

**Equipment:**
- RJ11 Splitter on LINE side
- USR5637
- 2 phones (one protected, one not)

**Connection Diagram:**
```
[Wall/Spectrum]
      │
      ↓
[RJ11 Splitter]
   ┌──┴──┐
   │     │
   ↓     ↓
[USR5637] [Direct Phone]
   │        (Unprotected!)
   ↓
[Protected Phone]
```

**Why NOT to do this:**
- ❌ Direct phone bypasses FiLine Wall completely
- ❌ Spam calls reach the unprotected phone
- ❌ Defeats the purpose of call screening
- ❌ Can cause line loading issues

**Only use if:** You specifically want one emergency phone that always works, even if FiLine or Pi is offline.

---

## Cable Reference

### RJ11 Cables (Phone Cables)
- **Type**: Standard telephone cable
- **Connectors**: RJ11 (6P4C or 6P2C)
- **Length**: 3-25 feet (avoid very long cables for best signal)
- **Where to get**: Any hardware store, Amazon, included with phones

**All RJ11 cables are the same** - just standard phone cables.

### USB Cables
- **Type**: USB Type-A to Type-B
- **Type-A End**: Flat rectangular (plugs into Raspberry Pi)
- **Type-B End**: Square with beveled corners (plugs into modem)
- **Usually included** with USR5637 modem

---

## Port Identification

### USR5637 Port Labels

**Front/Back View:**
```
┌──────────────────────────────────────┐
│  USRobotics USR5637                  │
│                                      │
│  Status LEDs: [PWR] [RX] [TX] [CD]  │
└──────────────────────────────────────┘

Back/Side:
┌─────────────────────────────────────┐
│                                     │
│  LINE      PHONE        USB-B       │
│  ○○○○      ○○○○         ▯           │
│   ↑         ↑            ↑          │
│  From     To Phone    To Pi         │
│  Wall                                │
└─────────────────────────────────────┘
```

**Port Icons:**
- LINE port: Often has telephone pole icon 📞
- PHONE port: Often has telephone handset icon ☎
- USB port: Standard USB symbol

---

## Spectrum Modem Port Identification

Most Spectrum modems/gateways look like:

```
┌──────────────────────────────────┐
│     SPECTRUM MODEM/GATEWAY       │
├──────────────────────────────────┤
│                                  │
│  COAX  [●]                       │
│  POWER [●]                       │
│  ETHERNET [●][●][●][●]           │
│  TEL1  [●]  ← Phone port (RJ11)  │
│  TEL2  [●]  ← 2nd line (if any)  │
│                                  │
└──────────────────────────────────┘
```

**Labels may vary:**
- TEL1, PHONE1, TELEPHONE
- Usually green or white port
- Same size as wall phone jack

---

## Software Configuration

Once hardware is connected:

### 1. Configure Device in FiLine Wall

**Via Web Interface:**
1. Navigate to Settings → Device Configuration
2. Click "Add Device"
3. Select modem model: "USRobotics USR5637"
4. Enter port: `/dev/ttyUSB0` (Linux/Pi) or `COM3` (Windows)
5. Save configuration

**Via Configuration File:**
```typescript
const modem = new ModemInterface({
  deviceId: 'primary_line',
  port: '/dev/ttyUSB0',
  modemModel: 'USR5637',
  baudRate: 115200
});
```

### 2. Test Connection

Run modem test:
```bash
# On Raspberry Pi
cd ~/filine-wall
npm run test:modem
```

Expected output:
```
✓ Modem detected: USRobotics USR5637
✓ Caller ID enabled
✓ Ready to screen calls
```

---

## Troubleshooting

### Issue: No Caller ID Detected

**Symptoms:**
- Calls come through but FiLine doesn't see caller ID
- Logs show "Unknown Caller"

**Solutions:**
1. Check if your phone service includes Caller ID
   - Call your provider (Spectrum, AT&T, etc.)
   - Caller ID is sometimes an add-on service ($5-10/month)
2. Verify modem initialization
   - Check logs for "AT+VCID=1" command
   - Should see "Caller ID enabled" in logs
3. Test with known number
   - Call from your cell phone
   - Check if Caller ID appears

### Issue: Phone Doesn't Ring for Any Calls

**Symptoms:**
- No calls get through
- Dead silence when someone calls

**Solutions:**
1. Check PHONE port connection
   - Ensure phone is connected to USR5637 PHONE port
   - Try different RJ11 cable
2. Check FiLine logs
   - Look for "call-allowed" events
   - Verify calls aren't being auto-blocked
3. Disable FiLine temporarily
   - Unplug USB from Pi
   - If phone works, it's a software config issue
   - If phone doesn't work, it's a wiring issue

### Issue: USB Modem Not Detected

**Symptoms:**
- FiLine can't find `/dev/ttyUSB0`
- "No modem detected" error

**Solutions:**
1. Check USB connection
   ```bash
   # On Raspberry Pi/Linux
   lsusb
   # Should see "USRobotics" in the list
   
   ls /dev/ttyUSB*
   # Should show /dev/ttyUSB0
   ```
2. Try different USB port on Pi
3. Check USB cable (try replacement)
4. Install USB serial drivers
   ```bash
   sudo apt-get update
   sudo apt-get install setserial
   ```

### Issue: Calls Go Through But Aren't Blocked

**Symptoms:**
- FiLine detects spam
- Logs show "call-blocked"
- But phone still rings

**Solutions:**
1. **Check modem model** - You might have the wrong modem!
   - Does your modem have a PHONE port?
   - If not, you need USR5637, not a generic USB modem
2. Check if using splitter incorrectly
   - Splitter should be on PHONE port, not LINE port
3. Check USB communication
   - Verify Pi can send hangup command (ATH)
   - Check for "Failed to send command" errors in logs

### Issue: Outgoing Calls Don't Work

**Symptoms:**
- Can't make calls from your phone
- Get fast busy signal or silence

**Solutions:**
1. Check LINE port connection
   - Must be connected to wall/Spectrum
2. Check for dial tone
   - Pick up phone, should hear dial tone
   - If no dial tone, check all connections
3. Try bypassing FiLine
   - Connect phone directly to wall
   - If works, issue is with FiLine/modem
   - If doesn't work, issue is with phone service

### Issue: Static or Poor Call Quality

**Symptoms:**
- Crackling, static, or echo on calls
- Calls drop frequently

**Solutions:**
1. Check cable quality
   - Replace cheap RJ11 cables with quality ones
   - Keep cables under 25 feet when possible
2. Reduce splitters
   - Too many splitters can degrade signal
   - Use max 2-3 splits
3. Check for interference
   - Keep modem away from Wi-Fi router
   - Avoid running phone cables parallel to power cables
4. Check line loading
   - Disconnect some phones if you have many
   - Each phone adds load to the line

---

## Best Practices

### 1. Power Reliability
- **Use a UPS** for Raspberry Pi
- Power outages will disable call blocking
- UPS keeps protection active during outages

### 2. Cable Management
- **Label your cables** ("Wall to Modem", "Modem to Phone", etc.)
- Use **cable ties** to keep organized
- Leave **some slack** for future changes

### 3. Testing
- **Test monthly** with a call from your cell phone
- Check **Caller ID detection**
- Verify **spam blocking** works
- Monitor **call logs** in web interface

### 4. Backup Configuration
- **Save modem settings** (AT&W command does this automatically)
- **Backup FiLine config** regularly
- Keep **hardware list** of your setup

### 5. Documentation
- **Take photos** of your setup
- **Note port numbers** and device IDs
- Keep **receipts** for hardware purchases

---

## Quick Reference

### Cables Needed (Minimum)
| Cable Type | From | To | Purpose |
|------------|------|-----|---------|
| RJ11 #1 | Wall/Spectrum | USR5637 LINE | Incoming calls |
| RJ11 #2 | USR5637 PHONE | Your Phone | Protected phone |
| USB A-to-B | USR5637 USB | Raspberry Pi | Control/Monitor |

### Port Checklist
- [ ] Wall jack connected to LINE port
- [ ] Phone connected to PHONE port
- [ ] USB connected to Raspberry Pi
- [ ] All connections snug and secure
- [ ] No splitters on LINE port
- [ ] FiLine software configured

### Common Port Paths
- **Linux/Raspberry Pi**: `/dev/ttyUSB0`
- **Windows**: `COM3` or `COM4`
- **macOS**: `/dev/cu.usbserial-*`

---

## Need Help?

1. Check `MODEM_SUPPORT.md` for AT command reference
2. Check `GRANDSTREAM_HT802_SETUP.md` if using VoIP
3. Review logs in FiLine web interface
4. Test with development mode to isolate issues

**Remember:** The most common issue is using the wrong modem. Make sure you have the USRobotics USR5637 with both LINE and PHONE ports!
