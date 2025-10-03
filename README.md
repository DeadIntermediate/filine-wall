# Call Flow with V.92 USB Modem

## Supported Hardware
- USRobotics 5637 USB Fax Modem
- StarTech 56k USB Dial-up and Fax Modem V.92 External

## Hardware Setup
1. Connect your USB modem to your Raspberry Pi via USB
2. Connect your phone line to the modem's LINE port
3. Connect your phone to the modem's PHONE port

## How It Works
1. When a call comes in, it's first intercepted by the modem before reaching your phone
2. The modem captures the Caller ID information using `AT+VCID=1` command
3. Our software quickly checks:
   - Local cache for known numbers
   - AI spam prediction
   - Voice pattern analysis
   - Call pattern analysis
   
4. Based on the analysis (takes milliseconds):
   - If spam: Call is blocked before your phone rings
   - If uncertain: Call is screened (modem answers first)
   - If safe: Call is allowed to ring through to your phone

## Modem Command Flow
```
1. RING detected
2. NMBR=1234567890 (Caller ID captured)
3. Quick analysis performed
4. If blocking:
   - ATH (Hang up command)
5. If screening:
   - ATA (Answer command)
   - Voice analysis performed
6. If allowing:
   - Let ring continue to phone
```

These V.92 USB modems are ideal for this setup because:
1. Supports Caller ID capture (VCID)
2. Hardware-level call control
3. Voice quality sampling
4. Compatible with standard AT commands
5. Reliable USB interface
6. Automatic device detection

## Installation
The setup script (`device-client/setup.sh`) automatically:
1. Detects your supported V.92 USB modem
2. Creates proper device symlinks
3. Sets up udev rules for both USRobotics and StarTech modems
4. Configures modem initialization
5. Sets up the necessary permissions

Just run the setup script as root and follow the prompts.
