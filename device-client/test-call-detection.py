#!/usr/bin/env python3
"""
Quick test of the call detector - run this to test incoming call detection
without installing as a service.
"""
import sys
import os
import time
import serial
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

MODEM_PORT = '/dev/ttyACM0'
BAUD_RATE = 57600

def test_call_detection():
    print("=" * 60)
    print("FiLine Wall - Call Detection Test")
    print("=" * 60)
    print(f"Modem: {MODEM_PORT} @ {BAUD_RATE} baud")
    print("Waiting for incoming calls...")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    try:
        # Open modem
        modem = serial.Serial(
            port=MODEM_PORT,
            baudrate=BAUD_RATE,
            timeout=1
        )
        
        # Initialize modem
        logging.info("Initializing modem...")
        modem.write(b'ATZ\r')
        time.sleep(1)
        response = modem.read(modem.in_waiting or 1).decode('utf-8', errors='ignore')
        logging.info(f"Reset response: {response.strip()}")
        
        # Enable Caller ID
        logging.info("Enabling Caller ID...")
        modem.write(b'AT+VCID=1\r')
        time.sleep(1)
        response = modem.read(modem.in_waiting or 1).decode('utf-8', errors='ignore')
        logging.info(f"Caller ID response: {response.strip()}")
        
        # Enable verbose mode for better caller ID info
        modem.write(b'AT+FCLASS=8\r')  # Voice mode
        time.sleep(0.5)
        
        logging.info("✅ Modem ready! Monitoring for calls...")
        print("\n📞 Call when ready - I'll detect it!\n")
        
        buffer = ""
        while True:
            if modem.in_waiting:
                data = modem.read(modem.in_waiting).decode('utf-8', errors='ignore')
                buffer += data
                
                # Process complete lines
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.strip()
                    
                    if not line:
                        continue
                    
                    # Log all modem output
                    logging.debug(f"Modem: {line}")
                    
                    # Detect incoming call patterns
                    if 'RING' in line:
                        print("\n" + "=" * 60)
                        print("🔔 INCOMING CALL DETECTED!")
                        print("=" * 60)
                    
                    elif 'NMBR' in line or 'NAME' in line:
                        print(f"📋 Caller Info: {line}")
                    
                    elif 'DATE' in line or 'TIME' in line:
                        print(f"🕐 Call Time: {line}")
                    
                    elif line.startswith('+'):
                        # Raw caller ID data
                        print(f"📞 Raw Data: {line}")
                        
                        # Parse caller ID
                        if 'NMBR' in line:
                            number = line.split('=')[-1].strip()
                            print(f"\n✨ PHONE NUMBER: {number}")
                            print("\n🔍 This would be sent to FiLine Wall for screening...")
                            print("=" * 60 + "\n")
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\n👋 Stopping call detection...")
        modem.close()
        print("✅ Modem closed")
    
    except serial.SerialException as e:
        print(f"\n❌ Serial port error: {e}")
        print("\nTroubleshooting:")
        print("1. Check if you're in dialout group: groups")
        print("2. Add yourself: sudo usermod -a -G dialout $USER")
        print("3. Log out and back in, or run: newgrp dialout")
        sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_call_detection()
