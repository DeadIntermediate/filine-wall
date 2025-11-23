# Grandstream HT802 Setup Guide

## Overview
The Grandstream HT802 is a 2-port Analog Telephone Adapter (ATA) that converts VoIP/SIP calls to analog phone signals. This guide will help you integrate it with FiLine Wall for call screening and spam detection.

## What You'll Need
- Grandstream HT802 v2 Port Analog Adapter
- Network cable (Ethernet)
- RJ11 phone cable
- Your VoIP/SIP account credentials
- Computer with web browser
- FiLine Wall installation

## Hardware Setup

### Step 1: Physical Connections
```
[Internet/Router] ──(Ethernet)──> [HT802 INTERNET Port]
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
               [FXS Port 1]                         [FXS Port 2]
                    │                                     │
              (RJ11 to FiLine)                  (RJ11 to Phone - Optional)
```

1. Connect the HT802 INTERNET port to your router using an Ethernet cable
2. Connect FiLine Wall's modem interface to FXS Port 1 using an RJ11 cable
3. (Optional) Connect your regular phone to FXS Port 2

### Step 2: Power On
1. Connect the power adapter to the HT802
2. Wait for the device to boot (Status LED will become solid)
3. Device will obtain an IP address via DHCP

## Web Interface Configuration

### Step 3: Access Web Interface
1. Find the HT802's IP address:
   - Check your router's DHCP client list
   - Or use the LCD menu (if available): Press * * * 0 2 on a connected phone
   - Default IP (if static): 192.168.2.1

2. Open a web browser and navigate to: `http://<HT802-IP-ADDRESS>`

3. Login credentials:
   - Default Username: `admin`
   - Default Password: `admin`
   - **IMPORTANT**: Change these immediately for security!

### Step 4: Configure FXS Port 1 (for FiLine Wall)

Navigate to **FXS PORT 1** tab and configure:

#### Account Settings
```
Account Active: Yes
Primary SIP Server: <your-voip-provider-server>
SIP User ID: <your-sip-username>
Authenticate ID: <your-sip-auth-id>
Authenticate Password: <your-sip-password>
```

#### Caller ID Settings (CRITICAL)
```
Caller ID Scheme: Bellcore(FSK)
Caller ID Display: Name and Number
Enable Call Waiting Caller ID: Yes
Send DTMF via: RFC2833
```

#### Call Features
```
Disable Call Waiting: No
Call Waiting Tone Gain: 0db
DTMF Payload Type: 101
```

#### Audio Settings
```
Preferred Vocoder: PCMU (choice 1), PCMA (choice 2)
Use First Matching Vocoder in 200OK SDP: Yes
DTMF Mode: RFC2833
```

#### Network Settings
```
Enable STUN: No (unless required by provider)
NAT Traversal: Keep-alive
```

### Step 5: Configure FXS Port 2 (Optional - for regular phone)
If you want to use FXS Port 2 for a regular phone:
1. Configure similar settings as Port 1
2. Can use same SIP account or different account
3. Ensure Caller ID is enabled here too

### Step 6: Apply and Reboot
1. Click "Update" at the bottom of each configuration page
2. Navigate to **Maintenance** > **Reboot**
3. Click "Reboot" and wait for device to restart (~30 seconds)

## FiLine Wall Configuration

### Step 7: Configure FiLine Wall

1. In FiLine Wall, configure the modem interface:

```typescript
const modem = new ModemInterface({
  deviceId: 'ht802_line1',
  port: '/dev/ttyUSB0',  // Or appropriate port for your setup
  modemModel: 'GRANDSTREAM_HT802',
  baudRate: 115200
});
```

2. If using the web interface, select "Grandstream HT802" from the device dropdown

### Step 8: Test the Setup

1. Make a test call to your number
2. Check FiLine Wall dashboard for:
   - ✅ Caller ID detection
   - ✅ Call screening decision
   - ✅ Log entries

## Verification Checklist

- [ ] HT802 has IP address and is accessible via web interface
- [ ] SIP registration successful (Status page shows "Registered")
- [ ] Caller ID format is set to Bellcore(FSK)
- [ ] Call Waiting Caller ID is enabled
- [ ] Test call shows Caller ID in FiLine Wall
- [ ] FiLine Wall successfully blocks/allows calls based on rules

## Common Settings Issues

### Caller ID Not Showing
**Problem**: FiLine Wall doesn't receive Caller ID information

**Solutions**:
1. Verify "Caller ID Scheme" is set to "Bellcore(FSK)"
2. Check "Enable Call Waiting Caller ID" is "Yes"
3. Confirm VoIP provider supports Caller ID (some don't)
4. Check SIP headers: Some providers send Caller ID in SIP headers only

### Calls Not Routing Through FiLine
**Problem**: Calls go directly to phone without screening

**Solutions**:
1. Ensure FiLine is connected to FXS Port 1
2. Check FXS port is enabled in web interface
3. Verify cable connections (RJ11)
4. Test with different port or cable

### SIP Registration Failed
**Problem**: HT802 shows "Failed" or "Unreachable" status

**Solutions**:
1. Double-check SIP credentials
2. Verify network connectivity
3. Check firewall settings (UDP ports 5060-5061)
4. Enable STUN if behind NAT
5. Contact VoIP provider for correct settings

## Advanced Configuration

### Using Serial Interface
If you need direct serial communication with the HT802:

```bash
# Connect via serial port (usually not needed)
screen /dev/ttyUSB0 115200

# Send AT commands
AT+FMFR?  # Get manufacturer
AT+FMDL?  # Get model
```

### Multiple Line Support
To monitor both FXS ports:

```typescript
// Port 1
const modem1 = new ModemInterface({
  deviceId: 'ht802_port1',
  port: '/dev/ttyUSB0',
  modemModel: 'GRANDSTREAM_HT802'
});

// Port 2  
const modem2 = new ModemInterface({
  deviceId: 'ht802_port2',
  port: '/dev/ttyUSB1',
  modemModel: 'GRANDSTREAM_HT802'
});
```

### Custom DTMF Handling
For advanced call control:

```typescript
modem.on('dtmf-detected', (digit) => {
  console.log('DTMF digit pressed:', digit);
  // Implement custom IVR logic
});
```

## Recommended VoIP Providers
FiLine Wall with HT802 works well with:
- VoIP.ms
- Flowroute
- Twilio Elastic SIP Trunking
- Bandwidth
- Any SIP-compatible provider supporting Caller ID

## Security Recommendations

1. **Change Default Password**: Immediately change admin password
2. **Disable HTTP**: Use HTTPS only in web interface settings
3. **Restrict Access**: Configure allowed IP ranges for web access
4. **Use Strong SIP Password**: Generate complex SIP authentication password
5. **Enable Encryption**: Use SRTP if supported by your provider
6. **Update Firmware**: Keep HT802 firmware up to date

## Firmware Updates

### Updating HT802 Firmware
1. Navigate to **Maintenance** > **Upgrade and Provisioning**
2. Set upgrade method:
   - **TFTP**: Requires local TFTP server
   - **HTTP/HTTPS**: Direct download from Grandstream
   - **Automatic**: Via provisioning server

3. Recommended: Use HTTP/HTTPS method
   ```
   Firmware Server Path: fm.grandstream.com/gs
   Config Server Path: (leave empty unless using provisioning)
   Firmware File Prefix: ht802
   ```

4. Click "Update" and reboot

## Troubleshooting Commands

### Check SIP Registration
```bash
# Via web interface: Status tab
# Look for "Registered" status
```

### View Call Logs
```bash
# Via web interface: Status > Call Status
# Shows recent call history and status
```

### Factory Reset
If you need to start over:
1. **Via Web Interface**: Maintenance > Reset to Factory Default
2. **Via Hardware**: Press and hold reset button for 20+ seconds
3. **Via Phone**: Dial `***99` from connected phone

## Support Resources

- **Grandstream Documentation**: https://www.grandstream.com/support
- **FiLine Wall Documentation**: See MODEM_SUPPORT.md
- **Community Forums**: https://www.grandstream.com/forum

## Comparison: HT802 vs Traditional Modem

| Feature | HT802 ATA | USB Modem |
|---------|-----------|-----------|
| Connection Type | VoIP/SIP | PSTN/Landline |
| Ports | 2 FXS ports | 1 LINE + 1 PHONE |
| Caller ID | Yes (via SIP) | Yes (via FSK/DTMF) |
| Setup Complexity | Medium (web config) | Low (plug & play) |
| Cost per Call | VoIP rates | Landline rates |
| Internet Required | Yes | No |
| Best For | VoIP users | Landline users |

## Next Steps

After setup is complete:
1. Configure call blocking rules in FiLine Wall
2. Set up spam detection sensitivity
3. Add trusted numbers to whitelist
4. Monitor initial performance
5. Fine-tune settings based on call patterns

---

**Need Help?** Check the [MODEM_SUPPORT.md](MODEM_SUPPORT.md) file for more details on modem configuration and AT commands.
