# Modem Support Documentation

## Overview
FiLine Wall now includes comprehensive support for multiple USB modem models with intelligent auto-detection and configuration capabilities.

## Supported Modem Models

### ✅ USRobotics USR5637 (Recommended)
- **Full Name**: USRobotics USR5637 USB Fax Modem
- **Type**: V.92 56K External USB Modem
- **Baud Rate**: 115200 bps
- **Features**:
  - ✅ Caller ID detection (NMBR + NAME)
  - ✅ Formatted Caller ID
  - ✅ Voice mode support
  - ✅ DTMF detection
  - ✅ Call waiting support
  - ✅ Distinctive ring support
  - ✅ Hardware flow control (RTS/CTS)

**Why Recommended**: Industry-standard modem with excellent Caller ID support, reliable performance, and comprehensive AT command set.

### ✅ StarTech USB56KEMH2
- **Full Name**: StarTech 56k USB V.92 External Fax Modem
- **Type**: V.92 56K External USB Modem  
- **Baud Rate**: 115200 bps
- **Features**:
  - ✅ Caller ID detection (NMBR + NAME)
  - ✅ Voice mode support
  - ✅ DTMF detection
  - ✅ Call waiting support
  - ✅ Hardware flow control

**Compatibility**: Excellent alternative to USRobotics with similar capabilities.

### ✅ Generic V.92 Modems
- **Type**: Any V.92 compatible USB modem with Caller ID support
- **Baud Rate**: 115200 bps (configurable)
- **Features**:
  - ✅ Basic Caller ID detection
  - ⚠️ Advanced features may vary

**Note**: Generic profile provides baseline functionality. Some features may not work depending on modem manufacturer.

---

## Auto-Detection Feature

The system automatically detects your modem model and applies the optimal configuration:

```typescript
const modem = new ModemInterface({
  deviceId: 'device_123',
  port: '/dev/ttyUSB0',
  // No modemModel specified - will auto-detect
});
```

Detection process:
1. Query modem manufacturer (`AT+FMFR?`)
2. Query modem model (`AT+FMDL?`)
3. Match against known profiles
4. Fall back to Generic V.92 if unknown

---

## Manual Configuration

You can manually specify the modem model:

```typescript
const modem = new ModemInterface({
  deviceId: 'device_123',
  port: '/dev/ttyUSB0',
  modemModel: 'USR5637',  // Options: 'USR5637', 'STARTECH_V92', 'GENERIC_V92'
  developmentMode: false
});
```

---

## USRobotics USR5637 Specific Features

### Advanced Caller ID
The USR5637 provides both number and name information:

```typescript
modem.on('caller-name', (name) => {
  console.log('Caller name:', name);
});
```

### Distinctive Ring Support
Allows different ring patterns for different call types:

```typescript
// Configuration handled automatically
// AT-SDR command configured during initialization
```

### Voice Mode Capabilities
Supports answering calls and playing audio messages:

```typescript
// Used for IVR screening
await modem.screenCall(phoneNumber);
```

---

## Initialization Process

### USR5637 Initialization Sequence
```
1. ATZ          - Reset modem to default state
2. AT&F         - Load factory defaults
3. ATE0         - Disable command echo
4. ATQ0         - Enable result codes
5. ATV1         - Verbose result codes
6. AT+VCID=1    - Enable Caller ID detection
7. AT#CID=1     - Enable formatted Caller ID
8. AT+FCLASS=0  - Set to data mode (not fax)
9. ATS0=0       - Disable auto-answer
10. AT&K3       - Enable RTS/CTS flow control
11. ATX4        - Enable all call progress detection
12. ATM0        - Speaker off
13. AT&W        - Save settings to NVRAM
```

Each command includes appropriate delays for modem processing.

---

## Connection Setup

### Hardware Connection
```
[Phone Line] → [LINE Port] → [Modem] → [PHONE Port] → [Your Phone]
                                ↓
                            [USB Cable]
                                ↓
                         [Computer/Raspberry Pi]
```

### USB Port Detection

#### Linux
```bash
# List USB devices
lsusb

# Find modem port
ls -la /dev/tty*

# Common ports:
# /dev/ttyUSB0
# /dev/ttyUSB1
# /dev/ttyACM0
```

#### macOS
```bash
ls -la /dev/tty.usb*

# Common ports:
# /dev/tty.usbserial-*
# /dev/tty.usbmodem*
```

#### Windows (WSL)
```bash
# Use PowerShell to identify COM port
Get-WmiObject Win32_SerialPort

# In WSL, access as:
/dev/ttyS<number>
```

---

## Configuration File Setup

Add to your `.env` file:

```bash
# Modem Configuration
MODEM_PORT=/dev/ttyUSB0
MODEM_BAUDRATE=115200
MODEM_MODEL=USR5637  # Optional: auto-detect if not set
DEVICE_ENCRYPTION_ENABLED=true
```

---

## Troubleshooting

### Modem Not Detected
```bash
# 1. Check USB connection
lsusb | grep -i modem

# 2. Check permissions
ls -l /dev/ttyUSB0

# 3. Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER
# Then logout and login

# 4. Check if modem is claimed by another service
sudo lsof /dev/ttyUSB0
```

### Caller ID Not Working
1. Ensure your phone service includes Caller ID
2. Check modem supports Caller ID (USR5637 does)
3. Verify `AT+VCID=1` command in initialization
4. Check phone line connection (must be between wall and modem)

### Modem Initialization Fails
```bash
# Test modem manually
screen /dev/ttyUSB0 115200

# Then type:
ATZ
AT+FMFR?
AT+FMDL?

# Press Ctrl+A, K to exit
```

### Permission Denied Errors
```bash
# Linux: Add user to dialout group
sudo usermod -a -G dialout $USER

# macOS: Check security settings
# System Preferences → Security & Privacy → Full Disk Access
```

---

## Testing Your Modem

### Using the Built-in Test Function

```typescript
import { ModemInterface } from './server/services/modemInterface';

async function testModem() {
  const modem = new ModemInterface({
    deviceId: 'test_device',
    port: '/dev/ttyUSB0',
    modemModel: 'USR5637',
    developmentMode: false // Set to true for simulated testing
  });

  modem.on('call-blocked', (data) => {
    console.log('✗ Call blocked:', data);
  });

  modem.on('call-allowed', (data) => {
    console.log('✓ Call allowed:', data);
  });

  modem.on('caller-name', (name) => {
    console.log('📞 Caller name:', name);
  });

  const initialized = await modem.initialize();
  if (initialized) {
    const status = await modem.getStatus();
    console.log('Modem Status:', status);
    
    // Wait for incoming calls...
    console.log('Waiting for incoming calls. Press Ctrl+C to exit.');
  }
}

testModem().catch(console.error);
```

### Development Mode Testing
```typescript
const modem = new ModemInterface({
  deviceId: 'test_device',
  port: '/dev/ttyUSB0',
  modemModel: 'USR5637',
  developmentMode: true  // Simulates modem without hardware
});

await modem.initialize();

// Simulate incoming calls
modem.simulateIncomingCall('+14155551234');  // Legitimate
modem.simulateIncomingCall('+15551230000');  // Spam (ends with 0000)
modem.simulateIncomingCall('+15551234567');  // Spam (starts with +1555)
```

---

## Response Patterns

### USR5637 Caller ID Responses
```
RING                          # Phone is ringing
NMBR=4155551234              # Caller number
NAME=JOHN DOE                 # Caller name (if available)
DATE=1107                     # Date (MMDD)
TIME=1430                     # Time (HHMM)
```

### Other Response Codes
```
OK                            # Command successful
ERROR                         # Command failed
NO CARRIER                    # Call disconnected
BUSY                          # Line busy
NO DIALTONE                   # No dial tone detected
CONNECT                       # Connection established
```

---

## Advanced Configuration

### Custom Modem Profile

Create a custom profile for an unlisted modem:

```typescript
import { type ModemProfile } from '../config/modemProfiles';

const CUSTOM_MODEM_PROFILE: ModemProfile = {
  name: 'My Custom Modem',
  manufacturer: 'CustomCorp',
  model: 'CUSTOM_V92',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: {
    rtscts: true,
    xon: false,
    xoff: false,
  },
  initSequence: [
    { cmd: 'ATZ', description: 'Reset', delay: 1000 },
    { cmd: 'AT&F', description: 'Factory defaults', delay: 1000 },
    { cmd: 'AT+VCID=1', description: 'Caller ID on', delay: 500 },
    { cmd: 'ATS0=0', description: 'Manual answer', delay: 300 },
    { cmd: 'AT&W', description: 'Save', delay: 1000 },
  ],
  features: {
    callerIdSupport: true,
    voiceMode: false,
    dtmfDetection: false,
    callWaiting: false,
    distinctiveRing: false,
  },
  responsePatterns: {
    callerIdPrefix: 'NMBR=',
    ringPattern: 'RING',
    hangupPattern: 'NO CARRIER',
    busyPattern: 'BUSY',
  },
};
```

---

## Performance Optimization

### Baud Rate Selection
- **115200**: Recommended for all supported modems
- **57600**: Alternative if connection issues occur
- **38400**: Fallback for older systems

### Flow Control
- **Hardware (RTS/CTS)**: Recommended - prevents data loss
- **Software (XON/XOFF)**: Fallback option
- **None**: Not recommended - may cause data corruption

---

## Security Considerations

1. **Device Authentication**: Each modem requires unique device ID and auth token
2. **Encryption**: All device-to-server communication uses AES-256-GCM
3. **Access Control**: Modem access restricted to configured users
4. **Audit Logging**: All modem events logged for security review

---

## Modem Status Information

Query modem status at any time:

```typescript
const status = await modem.getStatus();

console.log(status);
// {
//   initialized: true,
//   callInProgress: false,
//   lastCommand: 'AT&W',
//   retryCount: 0,
//   portOpen: true,
//   developmentMode: false,
//   modemProfile: {
//     name: 'USRobotics USR5637',
//     manufacturer: 'USRobotics',
//     model: 'USR5637',
//     callerIdSupport: true
//   }
// }
```

---

## Where to Buy

### USRobotics USR5637
- **Amazon**: Search "USRobotics 5637 USB Modem"
- **Newegg**: Computer Hardware → Modems
- **Price Range**: $40-60 USD
- **Part Number**: USR5637

### StarTech USB56KEMH2
- **Amazon**: Search "StarTech USB 56K Modem"
- **StarTech.com**: Direct from manufacturer
- **Price Range**: $35-50 USD
- **Part Number**: USB56KEMH2

---

## Additional Resources

- [USRobotics USR5637 Manual](http://support.usr.com/support/5637/5637-ug.pdf)
- [AT Command Reference](http://www.smstrace.com/doc/at_commands.pdf)
- [V.92 Specification](https://www.itu.int/rec/T-REC-V.92)
- Project Issues: https://github.com/DeadIntermediate/filine-wall/issues

---

## FAQ

**Q: Can I use an internal modem?**
A: The system is designed for USB modems. Internal modems require different configuration and are not currently supported.

**Q: Do I need a landline for testing?**
A: Yes, a real phone line connection is required for production use. Development mode allows testing without hardware.

**Q: Will this work with VoIP?**
A: Standard USB modems require traditional analog phone lines. VoIP requires different hardware/software.

**Q: Can I connect multiple modems?**
A: Yes! Each modem needs a unique device ID and port configuration.

**Q: What about international support?**
A: V.92 modems work globally, but Caller ID formats vary by country. The system uses E.164 phone number format.

---

*Last Updated: November 7, 2025*
*FiLine Wall Version: 1.0.0*
